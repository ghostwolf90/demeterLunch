#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import sys
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


def main() -> int:
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
    args = parser.parse_args()

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

    failed = [item for item in results if item["recordStatus"] == "failed"]
    registry_label = (
        str(args.registry.relative_to(PROJECT_ROOT))
        if args.registry.is_relative_to(PROJECT_ROOT)
        else str(args.registry)
    )
    report = {
        "schemaVersion": 1,
        "checkedAt": checked_at,
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
            "failed": len(failed),
        },
        "results": results,
    }
    report_path = args.output_dir / args.date.isoformat() / "report.json"
    write_json_atomic(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 2 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
