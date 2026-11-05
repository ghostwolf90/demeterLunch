#!/usr/bin/env python3
"""逐區收集、驗證及發布；抓取與發布進度分開持久保存。"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from datetime import date, datetime
import fcntl
import json
from pathlib import Path
import sys
import subprocess
import threading
import time

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.publish_school_meals import (  # noqa: E402
    DEFAULT_SITE_URL, DEFAULT_TOKEN_FILE, ManualPublishError,
    _read_token, build_publish_bundle, publish_bundle,
)
from src.fatrace_daily import (  # noqa: E402
    DAILY_USER_AGENT, TAIPEI, STABLE_STATUSES, DailyMealStorage,
    FatraceDailyClient, load_school_registry, write_json_atomic,
)
from src.http_client import HttpClient, RequestRateLimiter  # noqa: E402
from src.school_meal_data import (  # noqa: E402
    promote_candidate, save_reviewed_record,
)


def now() -> str:
    return datetime.now(TAIPEI).isoformat(timespec="seconds")


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"資料必須為 JSON 物件：{path}")
    return value


@contextmanager
def run_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("已有逐區更新程序執行中，請勿同時啟動。") from None
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def summary(rows: list[dict], *, publishing: bool) -> dict:
    counts = Counter(row.get("status", "not_checked") for row in rows)
    ready = [row for row in rows if row.get("status") in STABLE_STATUSES]
    published = sum(row.get("publishedHash") == row.get("contentHash") for row in ready)
    return {
        "schools": len(rows), "available": counts["available"],
        "noMeal": counts["no_meal"], "notPublished": counts["not_published"],
        "failed": counts["failed"], "notChecked": counts["not_checked"],
        "published": published, "unpublished": len(ready) - published,
        "publishEnabled": publishing,
    }


def print_summary(label: str, totals: dict, elapsed: float) -> None:
    print(
        f"\n【{label}】\n"
        f"  學校總數：{totals['schools']} 校\n"
        f"  有菜單：{totals['available']} 校\n"
        f"  官方不供餐：{totals['noMeal']} 校\n"
        f"  尚未公布：{totals['notPublished']} 校\n"
        f"  抓取／驗證失敗：{totals['failed']} 校\n"
        f"  尚未檢查：{totals['notChecked']} 校\n\n"
        f"  已發布：{totals['published']} 校\n"
        f"  有效資料待發布：{totals['unpublished']} 校\n\n"
        f"  耗時：{elapsed:.1f} 秒\n", flush=True,
    )


def rebuild_local(root: Path) -> bool:
    print("\n更新本機 SQLite 與網站快照……", flush=True)
    for command in (
        ["node", "--check", "web/app.js"],
        [sys.executable, "scripts/build_static_site.py"],
    ):
        try:
            status = subprocess.run(command, cwd=root, check=False).returncode
        except OSError as exc:
            print(f"本機重建無法執行：{exc}", flush=True)
            status = 1
        if status:
            print("本機重建失敗；已發布資料與抓取進度保留，重跑可重試重建。", flush=True)
            return False
    return True


def run(args, *, root: Path = PROJECT_ROOT, client=None, publisher=publish_bundle,
        token: str | None = None, rebuild=rebuild_local) -> int:
    schools = load_school_registry(args.registry)
    requested_cities = [
        value for value in (getattr(args, "city", None) or []) if value
    ]
    available_cities = list(dict.fromkeys(school.city for school in schools))
    if requested_cities:
        unknown_cities = set(requested_cities) - set(available_cities)
        if unknown_cities:
            raise ValueError(f"名冊找不到縣市：{'、'.join(sorted(unknown_cities))}")
        schools = [school for school in schools if school.city in requested_cities]
        city_order = [city for city in requested_cities if city in available_cities]
    else:
        city_order = available_cities
    if args.district and len(city_order) != 1:
        raise ValueError("多縣市名冊使用 --district 時必須同時指定一個 --city")
    districts = list(dict.fromkeys(school.district for school in schools))
    if args.district:
        unknown = set(args.district) - set(districts)
        if unknown:
            raise ValueError(f"名冊找不到行政區：{'、'.join(sorted(unknown))}")
        districts = [item for item in districts if item in args.district]
        schools = [school for school in schools if school.district in districts]
    scopes = [
        (city, district)
        for city in city_order
        for district in dict.fromkeys(
            school.district for school in schools if school.city == city
        )
    ]
    raw_root = root / "data/raw/fatrace-daily"
    progress_root = root / "data/monitor/district-updates" / args.date.isoformat()
    mode = "dishes-only" if args.skip_ingredients else "with-ingredients"
    progress_path = progress_root / f"{mode}.json"
    with run_lock(progress_root.parent / ".lock"):
        if not args.no_publish and token is None:
            token = _read_token(DEFAULT_TOKEN_FILE)  # Fail before collecting if not configured.
        progress = read_json(progress_path) if progress_path.exists() else {
            "schemaVersion": 1, "mealDate": args.date.isoformat(),
            "includeIngredients": not args.skip_ingredients, "schools": {},
        }
        if (progress.get("schemaVersion") != 1
                or progress.get("mealDate") != args.date.isoformat()
                or progress.get("includeIngredients") != (not args.skip_ingredients)
                or not isinstance(progress.get("schools"), dict)):
            raise ValueError("進度檔格式或日期／食材模式不符；保留檔案，請人工確認。")
        rows = progress["schools"]
        workers = int(getattr(args, "workers", 1))
        if not 1 <= workers <= 4:
            raise ValueError("工作數必須介於 1 至 4")
        rate_limiter = RequestRateLimiter(args.interval) if client is None else None
        worker_state = threading.local()

        def worker_client():
            if client is not None:
                return client
            value = getattr(worker_state, "client", None)
            if value is None:
                value = FatraceDailyClient(HttpClient(
                    timeout=args.timeout,
                    min_interval=args.interval,
                    retries=args.retries,
                    user_agent=DAILY_USER_AGENT,
                    rate_limiter=rate_limiter,
                ), include_ingredients=not args.skip_ingredients)
                worker_state.client = value
            return value

        def fetch_school(school):
            fetch_started = time.monotonic()
            active_client = worker_client()
            raw, candidate = active_client.probe(school, args.date)
            if candidate.get("status") == "available":
                raw, candidate = active_client.collect(school, args.date)
            return raw, candidate, time.monotonic() - fetch_started

        storage = DailyMealStorage(raw_root)
        def needs_fetch(school):
            row = rows.get(str(school.fatrace_school_id), {})
            if args.refresh_all or row.get("status") not in STABLE_STATUSES:
                return True
            try:
                stored = read_json(storage.target_path(school, args.date) / "candidate.json")
                return not (stored.get("contentHash") == row.get("contentHash")
                            and stored.get("mealDate") == args.date.isoformat()
                            and stored.get("school") == school.as_dict())
            except (OSError, ValueError):
                return True

        # Keep the requested/registry city order, while visiting pending
        # districts first inside each city.
        if not args.refresh_all:
            ordered_scopes = []
            for city in city_order:
                city_scopes = [scope for scope in scopes if scope[0] == city]
                city_scopes.sort(key=lambda scope: not any(
                    needs_fetch(school)
                    for school in schools
                    if (school.city, school.district) == scope
                ))
                ordered_scopes.extend(city_scopes)
            scopes = ordered_scopes
        started = time.monotonic()
        build_ok = True
        performance = {
            "workers": workers,
            "requestIntervalSeconds": args.interval,
            "fetchSeconds": 0.0,
            "publishSeconds": 0.0,
            "buildSeconds": 0.0,
            "publishBatches": 0,
            "publishedSchools": 0,
        }

        def checkpoint():
            progress["updatedAt"] = now()
            write_json_atomic(progress_path, progress)

        executor = (
            ThreadPoolExecutor(max_workers=workers, thread_name_prefix="meal-fetch")
            if client is None and workers > 1 else None
        )
        try:
            for city, district in scopes:
                district_started = time.monotonic()
                selected = [
                    school for school in schools
                    if school.city == city and school.district == district
                ]
                pending_by_id = {
                    school.fatrace_school_id: needs_fetch(school)
                    for school in selected
                }
                selected.sort(
                    key=lambda school: not pending_by_id[school.fatrace_school_id]
                )
                pending_schools = [
                    school for school in selected
                    if pending_by_id[school.fatrace_school_id]
                ]
                reused_schools = [
                    school for school in selected
                    if not pending_by_id[school.fatrace_school_id]
                ]
                pending = len(pending_schools)
                print(f"\n開始處理 {city} {district}，共 {len(selected)} 校（{args.date}）。", flush=True)
                print(
                    f"  待抓取 {pending} 校；沿用成功資料 {len(selected) - pending} 校；"
                    f"同時處理上限 {workers} 校。",
                    flush=True,
                )
                ready = []

                def prepare_row(school):
                    key = str(school.fatrace_school_id)
                    row = rows.setdefault(key, {})
                    row.update(school=school.name, city=city, district=district)
                    return row

                def accept_candidate(school, raw, candidate, *, reused, fetch_seconds=0.0):
                    row = prepare_row(school)
                    candidate_path = storage.target_path(school, args.date) / "candidate.json"
                    if not reused:
                        # Verify identity/date before any raw or reviewed replacement.
                        if (candidate.get("mealDate") != args.date.isoformat()
                                or candidate.get("school") != school.as_dict()):
                            raise ValueError("候選資料的日期或學校與要求不符")
                        if candidate.get("status") in STABLE_STATUSES:
                            promote_candidate(candidate, reviewed_at=now(),
                                              reviewed_by="Demeter 逐區結構驗證與來源核對")
                        elif candidate.get("status") != "not_published":
                            raise ValueError("官方回應狀態無效")
                        storage.save(school, args.date, raw, candidate)
                        candidate = read_json(candidate_path)
                    if (candidate.get("mealDate") != args.date.isoformat()
                            or candidate.get("school") != school.as_dict()):
                        raise ValueError("已存資料的日期或學校不符")
                    row.update(status=candidate["status"], error=None)
                    if not reused:
                        row.update(
                            checkedAt=now(),
                            fetchDurationSeconds=round(fetch_seconds, 3),
                        )
                    if candidate["status"] in STABLE_STATUSES:
                        reviewed = promote_candidate(candidate, reviewed_at=now(),
                            reviewed_by="Demeter 逐區結構驗證與來源核對")
                        save_reviewed_record(root / "data/parsed", reviewed)
                        row["contentHash"] = reviewed["contentHash"]
                        if row.get("publishedHash") != reviewed["contentHash"]:
                            ready.append(school)
                    print(f"  {school.name}：" + ("沿用已成功資料，未重新抓取" if reused else {
                        "available": "菜單驗證完成", "no_meal": "官方明確不供餐",
                        "not_published": "官方尚未公布，下次補查",
                    }[row["status"]]), flush=True)

                for school in pending_schools:
                    row = prepare_row(school)
                    row["attempts"] = row.get("attempts", 0) + 1
                    row["status"] = "not_checked"
                if pending_schools:
                    checkpoint()

                fetch_phase_started = time.monotonic()
                if executor is not None:
                    futures = {
                        executor.submit(fetch_school, school): school
                        for school in pending_schools
                    }
                    completed = ((futures[future], future) for future in as_completed(futures))
                else:
                    completed = ((school, None) for school in pending_schools)

                for school, future in completed:
                    row = prepare_row(school)
                    try:
                        result = future.result() if future is not None else fetch_school(school)
                        accept_candidate(school, *result[:2], reused=False,
                                         fetch_seconds=result[2])
                    except Exception as exc:
                        row.update(status="failed", checkedAt=now(), error=str(exc))
                        print(f"  {school.name}：抓取／驗證失敗：{exc}", flush=True)
                    checkpoint()
                performance["fetchSeconds"] += time.monotonic() - fetch_phase_started

                for school in reused_schools:
                    row = prepare_row(school)
                    try:
                        candidate_path = storage.target_path(school, args.date) / "candidate.json"
                        accept_candidate(
                            school,
                            None,
                            read_json(candidate_path),
                            reused=True,
                        )
                    except Exception as exc:
                        row.update(status="failed", checkedAt=now(), error=str(exc))
                        print(f"  {school.name}：已存資料驗證失敗：{exc}", flush=True)
                if reused_schools:
                    checkpoint()
                if ready and not args.no_publish:
                    results = [{"school": school.name, "fatraceSchoolId": school.fatrace_school_id,
                                "recordStatus": rows[str(school.fatrace_school_id)]["status"]}
                               for school in ready]
                    report = {"mealDate": args.date.isoformat(), "results": results,
                              "summary": {"schools": len(results),
                                  "available": sum(r["recordStatus"] == "available" for r in results),
                                  "noMeal": sum(r["recordStatus"] == "no_meal" for r in results),
                                  "notPublished": 0, "failed": 0}}
                    publish_started = None
                    publish_seconds = 0.0
                    try:
                        bundle = build_publish_bundle(root, args.date, report=report)
                        publish_started = time.monotonic()
                        response = publisher(bundle, DEFAULT_SITE_URL, token)
                        publish_seconds = time.monotonic() - publish_started
                        if response.get("status") != "published":
                            raise ManualPublishError("發布回應未確認成功")
                        for school in ready:
                            row = rows[str(school.fatrace_school_id)]
                            row.update(
                                publishedHash=row["contentHash"],
                                publishedAt=now(),
                                publishError=None,
                                publishDurationSeconds=round(publish_seconds, 3),
                            )
                        performance["publishedSchools"] += len(ready)
                        print(
                            f"  {city} {district}：本次發布成功 {len(ready)} 校，"
                            f"上傳耗時 {publish_seconds:.1f} 秒。",
                            flush=True,
                        )
                    except Exception as exc:
                        if publish_started is not None:
                            publish_seconds = time.monotonic() - publish_started
                        for school in ready:
                            rows[str(school.fatrace_school_id)].update(
                                publishError=str(exc),
                                publishDurationSeconds=round(publish_seconds, 3),
                            )
                        print(f"  {city} {district}：發布失敗，下次直接補傳：{exc}", flush=True)
                    finally:
                        if publish_started is not None:
                            performance["publishSeconds"] += publish_seconds
                            performance["publishBatches"] += 1
                    checkpoint()
                totals = summary([rows[str(s.fatrace_school_id)] for s in selected],
                                 publishing=not args.no_publish)
                print_summary(f"{city} {district}處理總結", totals, time.monotonic() - district_started)
            if any(rows[str(s.fatrace_school_id)].get("status") in STABLE_STATUSES for s in schools):
                build_started = time.monotonic()
                build_ok = rebuild(root)
                performance["buildSeconds"] = time.monotonic() - build_started
        except KeyboardInterrupt:
            checkpoint()
            print("\n已中斷並保存進度；相同日期與模式重跑即可接續。", flush=True)
            return 130
        finally:
            if executor is not None:
                executor.shutdown(wait=True, cancel_futures=True)
            totals = summary([rows.get(str(s.fatrace_school_id), {}) for s in schools],
                             publishing=not args.no_publish)
            progress["lastRunSummary"] = totals
            performance["totalSeconds"] = time.monotonic() - started
            if rate_limiter is not None:
                performance["sourceRequests"] = rate_limiter.request_count
            progress["lastRunPerformance"] = {
                key: round(value, 3) if isinstance(value, float) else value
                for key, value in performance.items()
            }
            checkpoint()
            print_summary("本次全程總結", totals, time.monotonic() - started)
            print(
                "【效能分段】\n"
                f"  官方資料抓取：{performance['fetchSeconds']:.1f} 秒\n"
                f"  Site 發布 API：{performance['publishSeconds']:.1f} 秒\n"
                f"  本機資料與網站建置：{performance['buildSeconds']:.1f} 秒\n"
                f"  官方 API 請求：{performance.get('sourceRequests', 0)} 次\n",
                flush=True,
            )
            for school in schools:
                row = rows.get(str(school.fatrace_school_id), {})
                if row.get("status") in {"failed", "not_published", "not_checked", None} or (
                        not args.no_publish and row.get("publishedHash") != row.get("contentHash")):
                    print(f"  待處理：{school.city} {school.district} {school.name}："
                          f"{row.get('error') or row.get('publishError') or {'not_published': '官方尚未公布', 'not_checked': '尚未檢查'}.get(row.get('status'), '待發布')}", flush=True)
            print(f"進度檔：{progress_path}", flush=True)
        if not build_ok or totals["failed"] or (not args.no_publish and totals["unpublished"]):
            return 1
        return 2 if totals["notPublished"] or totals["notChecked"] else 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="依縣市、行政區下載、驗證及發布學校午餐，預設接續進度並發布。")
    parser.add_argument("--date", type=date.fromisoformat, default=datetime.now(TAIPEI).date())
    parser.add_argument("--registry", type=Path, default=PROJECT_ROOT / "data/reference/active-elementary-schools.json")
    parser.add_argument("--city", action="append", help="只處理指定縣市，可重複使用；依指定順序執行")
    parser.add_argument("--district", action="append", help="只處理指定行政區，可重複使用")
    parser.add_argument("--no-publish", action="store_true", help="只下載與驗證，不發布")
    parser.add_argument("--refresh-all", action="store_true", help="重查所有選定學校；相同內容不重傳")
    parser.add_argument("--skip-ingredients", action="store_true", help="只收集菜色")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=1.2)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument(
        "--workers", type=int, default=2,
        help="同時處理學校數，預設 2；所有工作共用全域請求間隔",
    )
    args = parser.parse_args(argv)
    if (args.timeout <= 0 or args.interval < 0 or args.retries < 0
            or not 1 <= args.workers <= 4):
        parser.error("逾時必須大於零，請求間隔及重試次數不得小於零，工作數必須介於 1 至 4")
    try:
        return run(args)
    except (OSError, ValueError, ManualPublishError) as exc:
        print(f"無法開始更新：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
