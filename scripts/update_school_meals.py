#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TAIPEI = ZoneInfo("Asia/Taipei")


def _run(command: list[str]) -> int:
    print(f"$ {' '.join(command)}", flush=True)
    result = subprocess.run(command, cwd=PROJECT_ROOT, check=False)
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collect, review and optionally rebuild the active school-meal site."
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(TAIPEI).date(),
    )
    parser.add_argument("--school", action="append", default=[])
    parser.add_argument("--district", default="西區")
    parser.add_argument(
        "--registry",
        type=Path,
        default=PROJECT_ROOT
        / "data"
        / "reference"
        / "taichung-active-elementary-schools.json",
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=1.2)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument(
        "--verify-and-build",
        action="store_true",
        help="完成後重建 SQLite、執行測試、檢查 JavaScript 並重建 dist",
    )
    args = parser.parse_args()

    fetch = [
        sys.executable,
        "scripts/fetch_school_meals.py",
        "--date",
        args.date.isoformat(),
        "--registry",
        str(args.registry),
        "--district",
        args.district,
        "--timeout",
        str(args.timeout),
        "--interval",
        str(args.interval),
        "--retries",
        str(args.retries),
    ]
    for school in args.school:
        fetch.extend(["--school", school])
    if _run(fetch) != 0:
        return 1

    report_path = (
        PROJECT_ROOT
        / "data"
        / "raw"
        / "fatrace-daily"
        / args.date.isoformat()
        / "report.json"
    )
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if not report.get("summary", {}).get("available") and not report.get("summary", {}).get("noMeal"):
        print("官方尚未發布任何完整紀錄；既有 reviewed JSON、SQLite 與 dist 保持不變。")
        return 2

    review = [
        sys.executable,
        "scripts/review_school_meals.py",
        "--date",
        args.date.isoformat(),
    ]
    review_status = _run(review)
    if review_status not in (0, 2):
        return review_status
    if review_status == 2:
        return 2
    if not args.verify_and_build:
        return 0

    commands = [
        [sys.executable, "scripts/build_database.py"],
        [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
        ["node", "--check", "web/app.js"],
        [sys.executable, "scripts/build_static_site.py"],
    ]
    for command in commands:
        status = _run(command)
        if status != 0:
            return status
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
