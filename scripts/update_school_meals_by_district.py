#!/usr/bin/env python3
"""逐區收集、驗證及發布；抓取與發布進度分開持久保存。"""
from __future__ import annotations

import argparse
from collections import Counter
from contextlib import contextmanager
from datetime import date, datetime
import fcntl
import json
from pathlib import Path
import sys
import subprocess
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
from src.http_client import HttpClient  # noqa: E402
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
        [sys.executable, "scripts/build_database.py"],
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
    districts = list(dict.fromkeys(school.district for school in schools))
    if args.district:
        unknown = set(args.district) - set(districts)
        if unknown:
            raise ValueError(f"名冊找不到行政區：{'、'.join(sorted(unknown))}")
        districts = [item for item in districts if item in args.district]
        schools = [school for school in schools if school.district in districts]
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
        client = client or FatraceDailyClient(HttpClient(
            timeout=args.timeout, min_interval=args.interval, retries=args.retries,
            user_agent=DAILY_USER_AGENT,
        ), include_ingredients=not args.skip_ingredients)
        storage = DailyMealStorage(raw_root)
        started = time.monotonic()
        build_ok = True

        def checkpoint():
            progress["updatedAt"] = now()
            write_json_atomic(progress_path, progress)

        try:
            for district in districts:
                district_started = time.monotonic()
                selected = [school for school in schools if school.district == district]
                print(f"\n開始處理 {district}，共 {len(selected)} 校（{args.date}）。", flush=True)
                ready = []
                for school in selected:
                    key = str(school.fatrace_school_id)
                    row = rows.setdefault(key, {})
                    row.update(school=school.name, district=district)
                    candidate_path = storage.target_path(school, args.date) / "candidate.json"
                    try:
                        candidate = None
                        if not args.refresh_all and row.get("status") in STABLE_STATUSES:
                            try:
                                stored = read_json(candidate_path)
                                if stored.get("contentHash") == row.get("contentHash"):
                                    candidate = stored
                            except (OSError, ValueError):
                                pass
                        if candidate is None:
                            row["attempts"] = row.get("attempts", 0) + 1
                            row["status"] = "not_checked"
                            checkpoint()
                            raw, candidate = client.probe(school, args.date)
                            if candidate.get("status") == "available":
                                raw, candidate = client.collect(school, args.date)
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
                        row.update(status=candidate["status"], checkedAt=now(), error=None)
                        if candidate["status"] in STABLE_STATUSES:
                            reviewed = promote_candidate(candidate, reviewed_at=now(),
                                reviewed_by="Demeter 逐區結構驗證與來源核對")
                            save_reviewed_record(root / "data/parsed", reviewed)
                            row["contentHash"] = reviewed["contentHash"]
                            if row.get("publishedHash") != reviewed["contentHash"]:
                                ready.append(school)
                        print(f"  {school.name}：" + {
                            "available": "菜單驗證完成", "no_meal": "官方明確不供餐",
                            "not_published": "官方尚未公布，下次補查",
                        }[row["status"]], flush=True)
                    except Exception as exc:
                        row.update(status="failed", checkedAt=now(), error=str(exc))
                        print(f"  {school.name}：抓取／驗證失敗：{exc}", flush=True)
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
                    try:
                        bundle = build_publish_bundle(root, args.date, report=report)
                        response = publisher(bundle, DEFAULT_SITE_URL, token)
                        if response.get("status") != "published":
                            raise ManualPublishError("發布回應未確認成功")
                        for school in ready:
                            row = rows[str(school.fatrace_school_id)]
                            row.update(publishedHash=row["contentHash"], publishedAt=now(), publishError=None)
                        print(f"  {district}：本次發布成功 {len(ready)} 校。", flush=True)
                    except Exception as exc:
                        for school in ready:
                            rows[str(school.fatrace_school_id)]["publishError"] = str(exc)
                        print(f"  {district}：發布失敗，下次直接補傳：{exc}", flush=True)
                    checkpoint()
                totals = summary([rows[str(s.fatrace_school_id)] for s in selected],
                                 publishing=not args.no_publish)
                print_summary(f"{district}處理總結", totals, time.monotonic() - district_started)
            if any(rows[str(s.fatrace_school_id)].get("status") in STABLE_STATUSES for s in schools):
                build_ok = rebuild(root)
        except KeyboardInterrupt:
            checkpoint()
            print("\n已中斷並保存進度；相同日期與模式重跑即可接續。", flush=True)
            return 130
        finally:
            totals = summary([rows.get(str(s.fatrace_school_id), {}) for s in schools],
                             publishing=not args.no_publish)
            progress["lastRunSummary"] = totals
            checkpoint()
            print_summary("本次全程總結", totals, time.monotonic() - started)
            for school in schools:
                row = rows.get(str(school.fatrace_school_id), {})
                if row.get("status") in {"failed", "not_published", "not_checked", None} or (
                        not args.no_publish and row.get("publishedHash") != row.get("contentHash")):
                    print(f"  待處理：{school.district} {school.name}："
                          f"{row.get('error') or row.get('publishError') or {'not_published': '官方尚未公布', 'not_checked': '尚未檢查'}.get(row.get('status'), '待發布')}", flush=True)
            print(f"進度檔：{progress_path}", flush=True)
        if not build_ok or totals["failed"] or (not args.no_publish and totals["unpublished"]):
            return 1
        return 2 if totals["notPublished"] or totals["notChecked"] else 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="依行政區下載、驗證及發布學校午餐，預設接續進度並發布。")
    parser.add_argument("--date", type=date.fromisoformat, default=datetime.now(TAIPEI).date())
    parser.add_argument("--registry", type=Path, default=PROJECT_ROOT / "data/reference/taichung-active-elementary-schools.json")
    parser.add_argument("--district", action="append", help="只處理指定行政區，可重複使用")
    parser.add_argument("--no-publish", action="store_true", help="只下載與驗證，不發布")
    parser.add_argument("--refresh-all", action="store_true", help="重查所有選定學校；相同內容不重傳")
    parser.add_argument("--skip-ingredients", action="store_true", help="只收集菜色")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=1.2)
    parser.add_argument("--retries", type=int, default=2)
    args = parser.parse_args(argv)
    if args.timeout <= 0 or args.interval < 0 or args.retries < 0:
        parser.error("逾時必須大於零，請求間隔及重試次數不得小於零")
    try:
        return run(args)
    except (OSError, ValueError, ManualPublishError) as exc:
        print(f"無法開始更新：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
