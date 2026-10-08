#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.school_meal_data import (  # noqa: E402
    PUBLIC_RECORD_STATUSES,
    SchoolMealValidationError,
    promote_candidate,
    save_reviewed_record,
)


TAIPEI = ZoneInfo("Asia/Taipei")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate collected official daily records and promote them to reviewed JSON."
    )
    parser.add_argument("--date", required=True, type=date.fromisoformat)
    parser.add_argument(
        "--raw-root",
        type=Path,
        default=PROJECT_ROOT / "data" / "raw" / "fatrace-daily",
    )
    parser.add_argument(
        "--parsed-root",
        type=Path,
        default=PROJECT_ROOT / "data" / "parsed",
    )
    parser.add_argument(
        "--reviewed-by",
        default="Demeter 結構驗證與來源核對",
    )
    args = parser.parse_args()

    date_root = args.raw_root / args.date.isoformat()
    paths = sorted(date_root.glob("*/candidate.json"))
    if not paths:
        parser.error(f"找不到候選資料：{date_root}")

    reviewed_at = datetime.now(TAIPEI).isoformat(timespec="seconds")
    results: list[dict[str, object]] = []
    publishable: list[dict[str, object]] = []
    try:
        for path in paths:
            candidate = json.loads(path.read_text(encoding="utf-8"))
            if candidate.get("status") not in PUBLIC_RECORD_STATUSES:
                results.append(
                    {
                        "school": candidate.get("school", {}).get("name", path.parent.name),
                        "fatraceSchoolId": candidate.get("school", {}).get("fatraceSchoolId"),
                        "mealDate": candidate.get("mealDate"),
                        "recordStatus": candidate.get("status"),
                        "saveStatus": "skipped",
                        "reason": "官方尚未發布完整資料，不取代既有 reviewed 紀錄。",
                    }
                )
                continue
            reviewed = promote_candidate(
                candidate,
                reviewed_at=reviewed_at,
                reviewed_by=args.reviewed_by,
            )
            publishable.append(reviewed)
        for reviewed in publishable:
            status, target = save_reviewed_record(args.parsed_root, reviewed)
            results.append(
                {
                    "school": reviewed["school"]["name"],
                    "fatraceSchoolId": reviewed["school"]["fatraceSchoolId"],
                    "mealDate": reviewed["mealDate"],
                    "recordStatus": reviewed["status"],
                    "saveStatus": status,
                    "path": str(target.relative_to(PROJECT_ROOT))
                    if target.is_relative_to(PROJECT_ROOT)
                    else str(target),
                }
            )
    except (OSError, json.JSONDecodeError, SchoolMealValidationError) as exc:
        parser.error(str(exc))

    output = {
        "reviewedAt": reviewed_at,
        "summary": {
            "candidates": len(paths),
            "publishable": len(publishable),
            "skipped": len(paths) - len(publishable),
        },
        "records": results,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if publishable else 2


if __name__ == "__main__":
    raise SystemExit(main())
