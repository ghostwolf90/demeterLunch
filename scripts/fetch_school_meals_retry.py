#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.fatrace_daily import (  # noqa: E402
    DAILY_USER_AGENT,
    DailyMealStorage,
    FatraceDailyClient,
    load_school_registry,
    write_json_atomic,
)
from src.http_client import HttpClient  # noqa: E402


TAIPEI = ZoneInfo("Asia/Taipei")
REPORT_STATUSES = ("available", "no_meal", "not_published", "failed")


def _load_retry_report(path: Path, meal_date: date) -> dict[str, object]:
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"無法讀取既有抓取報告：{path}") from exc
    if not isinstance(report, dict) or report.get("mealDate") != meal_date.isoformat():
        raise ValueError(f"既有抓取報告格式或日期不符：{path}")
    results = report.get("results")
    if not isinstance(results, list) or not results:
        raise ValueError(f"既有抓取報告缺少 results：{path}")
    seen: set[int] = set()
    for result in results:
        if not isinstance(result, dict):
            raise ValueError(f"既有抓取報告包含無效結果：{path}")
        school_id = int(result.get("fatraceSchoolId", 0))
        if school_id <= 0 or school_id in seen:
            raise ValueError(f"既有抓取報告包含無效或重複學校代碼：{school_id}")
        if result.get("recordStatus") not in REPORT_STATUSES:
            raise ValueError(f"既有抓取報告包含無效狀態：{school_id}")
        seen.add(school_id)
    return report


def _merge_retry_report(
    previous: dict[str, object], retry: dict[str, object]
) -> dict[str, object]:
    previous_results = previous.get("results")
    retry_results = retry.get("results")
    if not isinstance(previous_results, list) or not isinstance(retry_results, list):
        raise ValueError("補抓報告缺少 results")

    failed_ids = {
        int(result.get("fatraceSchoolId", 0))
        for result in previous_results
        if isinstance(result, dict) and result.get("recordStatus") == "failed"
    }
    replacements = {
        int(result.get("fatraceSchoolId", 0)): result
        for result in retry_results
        if isinstance(result, dict)
    }
    if set(replacements) != failed_ids:
        raise ValueError("補抓結果與原報告的失敗學校不一致")

    merged_results = [
        replacements.get(int(result.get("fatraceSchoolId", 0)), result)
        for result in previous_results
        if isinstance(result, dict)
    ]
    summary = {
        "schools": len(merged_results),
        "available": sum(
            result.get("recordStatus") == "available" for result in merged_results
        ),
        "noMeal": sum(
            result.get("recordStatus") == "no_meal" for result in merged_results
        ),
        "notPublished": sum(
            result.get("recordStatus") == "not_published"
            for result in merged_results
        ),
        "failed": sum(
            result.get("recordStatus") == "failed" for result in merged_results
        ),
    }
    duration_seconds = round(
        float(previous.get("durationSeconds") or 0)
        + float(retry.get("durationSeconds") or 0),
        3,
    )
    merged = dict(previous)
    merged.update(
        {
            "completedAt": retry.get("completedAt"),
            "durationSeconds": duration_seconds,
            "averageSecondsPerSchool": round(
                duration_seconds / len(merged_results), 3
            ),
            "summary": summary,
            "results": merged_results,
            "lastRetry": {
                "checkedAt": retry.get("checkedAt"),
                "completedAt": retry.get("completedAt"),
                "durationSeconds": retry.get("durationSeconds"),
                "schools": len(retry_results),
            },
        }
    )
    return merged


def main(argv: list[str] | None = None) -> int:
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
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="只補抓既有同日報告中的 failed 學校，並合併回完整報告",
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
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logger = logging.getLogger(__name__)

    if args.retry_failed and (args.school or args.city or args.district):
        parser.error("--retry-failed 不可與 --school、--city 或 --district 同時使用")

    report_path = args.output_dir / args.date.isoformat() / "report.json"
    previous_report: dict[str, object] | None = None
    if args.retry_failed:
        try:
            previous_report = _load_retry_report(report_path, args.date)
        except ValueError as exc:
            parser.error(str(exc))
        failed_ids = {
            int(result["fatraceSchoolId"])
            for result in previous_report["results"]
            if isinstance(result, dict) and result.get("recordStatus") == "failed"
        }
        if not failed_ids:
            print("既有報告沒有 failed 學校，不需要補抓。")
            return 0
        requested = {str(school_id) for school_id in failed_ids}
        print(f"只補抓 failed 學校：{len(requested)} 校", flush=True)
    else:
        requested = {
            str(value).strip() for value in args.school if str(value).strip()
        }

    schools = load_school_registry(args.registry)
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
    checked_at = datetime.now(TAIPEI).isoformat()
    results: list[dict[str, object]] = []

    for school in schools:
        logger.info(
            "Collecting %s (%s) for %s",
            school.full_name,
            school.fatrace_school_id,
            args.date,
        )
        try:
            raw, candidate = client.collect(school, args.date)
            outcome = storage.save(school, args.date, raw, candidate)
            results.append(
                {
                    "school": school.name,
                    "fatraceSchoolId": school.fatrace_school_id,
                    "recordStatus": candidate["status"],
                    "saveStatus": outcome.status,
                    "path": str(outcome.path.relative_to(PROJECT_ROOT))
                    if outcome.path.is_relative_to(PROJECT_ROOT)
                    else str(outcome.path),
                }
            )
        except Exception as exc:
            logger.exception("Failed to collect %s", school.full_name)
            results.append(
                {
                    "school": school.name,
                    "fatraceSchoolId": school.fatrace_school_id,
                    "recordStatus": "failed",
                    "saveStatus": "not_written",
                    "error": str(exc),
                }
            )

    registry_label = (
        str(args.registry.relative_to(PROJECT_ROOT))
        if args.registry.is_relative_to(PROJECT_ROOT)
        else str(args.registry)
    )
    completed_at = datetime.now(TAIPEI).isoformat()
    duration_seconds = round(time.monotonic() - started_monotonic, 3)
    attempt_report: dict[str, object] = {
        "schemaVersion": 1,
        "checkedAt": checked_at,
        "completedAt": completed_at,
        "durationSeconds": duration_seconds,
        "averageSecondsPerSchool": round(duration_seconds / len(results), 3),
        "mealDate": args.date.isoformat(),
        "registry": registry_label,
        "includeIngredients": not args.skip_ingredients,
        "summary": {
            "schools": len(results),
            "available": sum(
                item["recordStatus"] == "available" for item in results
            ),
            "noMeal": sum(item["recordStatus"] == "no_meal" for item in results),
            "notPublished": sum(
                item["recordStatus"] == "not_published" for item in results
            ),
            "failed": sum(
                item["recordStatus"] == "failed" for item in results
            ),
        },
        "results": results,
    }
    try:
        report = (
            _merge_retry_report(previous_report, attempt_report)
            if previous_report is not None
            else attempt_report
        )
    except ValueError as exc:
        parser.error(str(exc))
    write_json_atomic(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if previous_report is not None:
        logger.info(
            "Retried %s schools in %.1f seconds; merged report covers %s schools",
            len(results),
            duration_seconds,
            report["summary"]["schools"],
        )
    else:
        logger.info(
            "Completed %s schools in %.1f seconds (average %.1f seconds per school)",
            len(results),
            duration_seconds,
            duration_seconds / len(results),
        )
    return 2 if report["summary"]["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
