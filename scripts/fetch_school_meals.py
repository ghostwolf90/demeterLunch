#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.fatrace_daily import (  # noqa: E402
    DAILY_USER_AGENT,
    DailyMealStorage,
    FatraceDailyClient,
    STABLE_STATUSES,
    load_school_registry,
    write_json_atomic,
)
from src.http_client import HttpClient  # noqa: E402


from scripts.fetch_school_meals_retry import _merge_retry_report  # noqa: E402,F401

TAIPEI = ZoneInfo("Asia/Taipei")


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _relative_path(path: Path) -> str:
    return (
        str(path.relative_to(PROJECT_ROOT))
        if path.is_relative_to(PROJECT_ROOT)
        else str(path)
    )


def _resume_results(
    report_path: Path,
    meal_date: date,
    *,
    include_ingredients: bool,
) -> dict[int, dict[str, Any]]:
    report = _read_json(report_path)
    if (
        not report
        or report.get("mealDate") != meal_date.isoformat()
        or report.get("includeIngredients") is not include_ingredients
        or not isinstance(report.get("results"), list)
    ):
        return {}
    results: dict[int, dict[str, Any]] = {}
    for item in report["results"]:
        if not isinstance(item, dict):
            continue
        try:
            school_id = int(item.get("fatraceSchoolId") or 0)
        except (TypeError, ValueError):
            continue
        if school_id > 0:
            results[school_id] = item
    return results


def _stored_candidate(
    output_dir: Path,
    meal_date: date,
    school_id: int,
) -> dict[str, Any] | None:
    candidate = _read_json(
        output_dir
        / meal_date.isoformat()
        / str(school_id)
        / "candidate.json"
    )
    school = candidate.get("school") if candidate else None
    try:
        candidate_school_id = (
            int(school.get("fatraceSchoolId") or 0)
            if isinstance(school, dict)
            else 0
        )
    except (TypeError, ValueError):
        candidate_school_id = 0
    if (
        not candidate
        or candidate.get("mealDate") != meal_date.isoformat()
        or candidate_school_id != school_id
    ):
        return None
    return candidate


def _non_negative_int(value: object) -> int:
    try:
        parsed = int(value or 0)
    except (TypeError, ValueError):
        return 0
    return max(parsed, 0)


def main(argv: list[str] | None = None) -> int:
    if "--retry-failed" in (sys.argv[1:] if argv is None else argv):
        from scripts.fetch_school_meals_retry import main as retry_main
        return retry_main(argv)
    started_monotonic = time.monotonic()
    parser = argparse.ArgumentParser(
        description="Collect public daily meal records for registered schools."
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(TAIPEI).date(),
        help="供餐日期，格式 YYYY-MM-DD（預設為臺北時區今天）",
    )
    parser.add_argument(
        "--registry",
        type=Path,
        default=PROJECT_ROOT
        / "data"
        / "reference"
        / "taichung-active-elementary-schools.json",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=PROJECT_ROOT / "data" / "raw" / "fatrace-daily",
    )
    parser.add_argument(
        "--school",
        action="append",
        default=[],
        help="只收集指定校名或 fatraceSchoolId，可重複使用",
    )
    parser.add_argument("--city", help="只收集指定縣市")
    parser.add_argument("--district", help="只收集指定行政區")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=1.2)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument(
        "--skip-ingredients",
        action="store_true",
        help="只收集菜色、不逐道查詢食材",
    )
    progress = parser.add_mutually_exclusive_group()
    progress.add_argument(
        "--resume",
        action="store_true",
        help="沿用同日進度，只抓未完成、未發布或先前失敗的學校",
    )
    progress.add_argument(
        "--refresh-all",
        action="store_true",
        help="忽略同日既有進度，重新檢查範圍內全部學校",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logger = logging.getLogger(__name__)

    schools = load_school_registry(args.registry)
    requested = {str(value).strip() for value in args.school if str(value).strip()}
    if requested:
        schools = [
            school
            for school in schools
            if school.name in requested
            or school.full_name in requested
            or str(school.fatrace_school_id) in requested
        ]
        found = {
            value
            for value in requested
            if any(
                value
                in {school.name, school.full_name, str(school.fatrace_school_id)}
                for school in schools
            )
        }
        missing = requested - found
        if missing:
            parser.error(f"學校名冊找不到：{', '.join(sorted(missing))}")
    if args.city:
        schools = [school for school in schools if school.city == args.city]
    if args.district:
        schools = [school for school in schools if school.district == args.district]
    if not schools:
        parser.error("篩選後沒有可收集的學校")

    http = HttpClient(
        timeout=args.timeout,
        min_interval=args.interval,
        retries=args.retries,
        user_agent=DAILY_USER_AGENT,
    )
    client = FatraceDailyClient(
        http, include_ingredients=not args.skip_ingredients
    )
    storage = DailyMealStorage(args.output_dir)
    checked_at = datetime.now(TAIPEI).isoformat(timespec="seconds")
    report_path = args.output_dir / args.date.isoformat() / "report.json"
    registry_label = _relative_path(args.registry)
    prior_results = (
        _resume_results(
            report_path,
            args.date,
            include_ingredients=not args.skip_ingredients,
        )
        if args.resume
        else {}
    )
    results_by_id: dict[int, dict[str, Any]] = {}
    for school in schools:
        result: dict[str, Any] = {
            "school": school.name,
            "fullName": school.full_name,
            "district": school.district,
            "fatraceSchoolId": school.fatrace_school_id,
            "recordStatus": "not_checked",
            "saveStatus": "not_written",
            "checkedAt": None,
            "attempts": 0,
        }
        previous = prior_results.get(school.fatrace_school_id)
        if previous:
            result.update(previous)
            result.update(
                {
                    "school": school.name,
                    "fullName": school.full_name,
                    "district": school.district,
                    "fatraceSchoolId": school.fatrace_school_id,
                }
            )
        if result.get("recordStatus") in STABLE_STATUSES:
            candidate = _stored_candidate(
                args.output_dir,
                args.date,
                school.fatrace_school_id,
            )
            if not candidate or candidate.get("status") != result["recordStatus"]:
                result.update(
                    {
                        "recordStatus": "not_checked",
                        "saveStatus": "not_written",
                        "checkedAt": None,
                    }
                )
        results_by_id[school.fatrace_school_id] = result

    if args.refresh_all or not args.resume:
        pending_schools = list(schools)
    else:
        priority = {"failed": 0, "not_published": 1, "not_checked": 2}
        registry_order = {
            school.fatrace_school_id: index
            for index, school in enumerate(schools)
        }
        pending_schools = sorted(
            (
                school
                for school in schools
                if results_by_id[school.fatrace_school_id].get("recordStatus")
                not in STABLE_STATUSES
            ),
            key=lambda school: (
                priority.get(
                    str(
                        results_by_id[school.fatrace_school_id].get(
                            "recordStatus"
                        )
                    ),
                    3,
                ),
                registry_order[school.fatrace_school_id],
            ),
        )
    reused_completed = len(schools) - len(pending_schools)
    checked_this_run = 0

    def build_report(*, completed_at: str | None = None) -> dict[str, Any]:
        duration_seconds = round(time.monotonic() - started_monotonic, 3)
        ordered_results = [
            results_by_id[school.fatrace_school_id] for school in schools
        ]
        counts = {
            status: sum(
                item.get("recordStatus") == status for item in ordered_results
            )
            for status in (
                "available",
                "no_meal",
                "not_published",
                "failed",
                "not_checked",
            )
        }
        not_published_schools = [
            {
                "school": item["school"],
                "district": item["district"],
                "fatraceSchoolId": item["fatraceSchoolId"],
                "checkedAt": item.get("checkedAt"),
                "attempts": item.get("attempts", 0),
            }
            for item in ordered_results
            if item.get("recordStatus") == "not_published"
        ]
        return {
            "schemaVersion": 2,
            "checkedAt": checked_at,
            "updatedAt": datetime.now(TAIPEI).isoformat(timespec="seconds"),
            "completedAt": completed_at,
            "durationSeconds": duration_seconds,
            "averageSecondsPerSchool": (
                round(duration_seconds / checked_this_run, 3)
                if checked_this_run
                else 0
            ),
            "mealDate": args.date.isoformat(),
            "registry": registry_label,
            "includeIngredients": not args.skip_ingredients,
            "runMode": (
                "refresh_all"
                if args.refresh_all
                else "resume"
                if args.resume
                else "fresh"
            ),
            "summary": {
                "schools": len(ordered_results),
                "available": counts["available"],
                "noMeal": counts["no_meal"],
                "notPublished": counts["not_published"],
                "failed": counts["failed"],
                "notChecked": counts["not_checked"],
                "completed": counts["available"] + counts["no_meal"],
                "pending": (
                    counts["not_published"]
                    + counts["failed"]
                    + counts["not_checked"]
                ),
                "checkedThisRun": checked_this_run,
                "reusedCompleted": reused_completed,
            },
            "notPublishedSchools": not_published_schools,
            "results": ordered_results,
        }

    write_json_atomic(report_path, build_report())

    for school in pending_schools:
        logger.info(
            "Checking availability for %s (%s) on %s",
            school.full_name,
            school.fatrace_school_id,
            args.date,
        )
        previous_attempts = _non_negative_int(
            results_by_id[school.fatrace_school_id].get("attempts")
        )
        attempted_at = datetime.now(TAIPEI)
        try:
            raw, candidate = client.probe(
                school,
                args.date,
                fetched_at=attempted_at,
            )
            availability_status = str(candidate.get("status") or "")
            if availability_status == "available":
                logger.info(
                    "Meal data is available for %s; collecting details",
                    school.full_name,
                )
                raw, candidate = client.collect(
                    school,
                    args.date,
                    fetched_at=attempted_at,
                )
            outcome = storage.save(school, args.date, raw, candidate)
            saved_candidate = _stored_candidate(
                args.output_dir,
                args.date,
                school.fatrace_school_id,
            )
            effective_status = str(
                (saved_candidate or candidate).get("status") or availability_status
            )
            result = {
                "school": school.name,
                "fullName": school.full_name,
                "district": school.district,
                "fatraceSchoolId": school.fatrace_school_id,
                "recordStatus": effective_status,
                "availabilityStatus": availability_status,
                "saveStatus": outcome.status,
                "checkedAt": candidate.get("fetchedAt")
                or attempted_at.isoformat(timespec="seconds"),
                "attempts": previous_attempts + 1,
                "path": _relative_path(outcome.path),
            }
            if availability_status == "not_published":
                result["note"] = (
                    "指定日期尚未查到校方上傳的公開午餐資料；下次續跑會優先重試。"
                )
            if outcome.status == "preserved":
                result["note"] = (
                    "本次未查到資料，但已保留先前有效紀錄，不以空結果取代。"
                )
            results_by_id[school.fatrace_school_id] = result
        except Exception as exc:
            logger.exception("Failed to collect %s", school.full_name)
            results_by_id[school.fatrace_school_id] = {
                "school": school.name,
                "fullName": school.full_name,
                "district": school.district,
                "fatraceSchoolId": school.fatrace_school_id,
                "recordStatus": "failed",
                "saveStatus": "not_written",
                "checkedAt": attempted_at.isoformat(timespec="seconds"),
                "attempts": previous_attempts + 1,
                "error": str(exc),
            }
        checked_this_run += 1
        write_json_atomic(report_path, build_report())

    completed_at = datetime.now(TAIPEI).isoformat(timespec="seconds")
    report = build_report(completed_at=completed_at)
    write_json_atomic(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    missing_uploads = report["notPublishedSchools"]
    if missing_uploads:
        logger.info(
            "%s schools have not uploaded data for %s:",
            len(missing_uploads),
            args.date,
        )
        for item in missing_uploads:
            logger.info(
                "  %s %s (%s), last checked %s",
                item["district"],
                item["school"],
                item["fatraceSchoolId"],
                item["checkedAt"],
            )
    duration_seconds = float(report["durationSeconds"])
    logger.info(
        "Checked %s schools, reused %s completed schools in %.1f seconds "
        "(average %.1f seconds per checked school)",
        checked_this_run,
        reused_completed,
        duration_seconds,
        float(report["averageSecondsPerSchool"]),
    )
    return 2 if report["summary"]["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
