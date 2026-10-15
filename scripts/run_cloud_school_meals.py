#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TAIPEI = ZoneInfo("Asia/Taipei")
PUBLISHABLE_STATUSES = {"available", "no_meal"}
INCOMPLETE_STATUSES = {"failed", "not_published"}


def _run(command: list[str]) -> int:
    print(f"$ {' '.join(command)}", flush=True)
    return subprocess.run(command, cwd=PROJECT_ROOT, check=False).returncode


def _report_path(meal_date: date) -> Path:
    return (
        PROJECT_ROOT
        / "data"
        / "raw"
        / "fatrace-daily"
        / meal_date.isoformat()
        / "report.json"
    )


def _load_report(meal_date: date) -> dict[str, Any]:
    path = _report_path(meal_date)
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"無法讀取當日抓取報告：{path}") from exc
    if not isinstance(report, dict) or report.get("mealDate") != meal_date.isoformat():
        raise RuntimeError(f"當日抓取報告格式或日期不符：{path}")
    results = report.get("results")
    if not isinstance(results, list):
        raise RuntimeError(f"當日抓取報告缺少 results：{path}")
    return report


def _school_ids_with_status(
    report: dict[str, Any], statuses: set[str]
) -> list[int]:
    selected: list[int] = []
    for result in report["results"]:
        if not isinstance(result, dict) or result.get("recordStatus") not in statuses:
            continue
        school_id = int(result.get("fatraceSchoolId", 0))
        if school_id <= 0:
            raise RuntimeError("當日抓取報告包含無效學校代碼")
        selected.append(school_id)
    return selected


def _archive_report(meal_date: date, mode: str) -> Path:
    source = _report_path(meal_date)
    timestamp = datetime.now(TAIPEI).strftime("%Y%m%dT%H%M%S%z")
    target = source.parent / "runs" / f"{timestamp}-{mode}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.{os.getpid()}.tmp")
    temporary.write_bytes(source.read_bytes())
    os.replace(temporary, target)
    return target


def _chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def _fetch_command(
    meal_date: date,
    *,
    school_ids: list[int] | None,
    timeout: float,
    interval: float,
    retries: int,
    skip_ingredients: bool,
) -> list[str]:
    command = [
        sys.executable,
        "scripts/fetch_school_meals.py",
        "--date",
        meal_date.isoformat(),
        "--timeout",
        str(timeout),
        "--interval",
        str(interval),
        "--retries",
        str(retries),
    ]
    for school_id in school_ids or []:
        command.extend(["--school", str(school_id)])
    if skip_ingredients:
        command.append("--skip-ingredients")
    return command


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run the safe cloud collection, validation and Site publish workflow."
    )
    parser.add_argument("--mode", choices=("main", "retry"), required=True)
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(TAIPEI).date(),
    )
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--publish-chunk-size", type=int, default=81)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=1.2)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--skip-ingredients", action="store_true")
    args = parser.parse_args(argv)
    if args.publish_chunk_size < 1 or args.publish_chunk_size > 100:
        parser.error("--publish-chunk-size 必須介於 1 與 100")

    retry_ids: list[int] | None = None
    if args.mode == "retry":
        try:
            previous = _load_report(args.date)
        except RuntimeError:
            print("當日尚無抓取報告；補抓改為執行全市主批次。")
            args.mode = "main"
        else:
            retry_ids = _school_ids_with_status(previous, INCOMPLETE_STATUSES)
            if not retry_ids:
                print("當日沒有 failed 或 not_published 學校，不發出來源請求。")
                return 0
            print(f"補抓學校數：{len(retry_ids)}", flush=True)

    fetch_status = _run(
        _fetch_command(
            args.date,
            school_ids=retry_ids,
            timeout=args.timeout,
            interval=args.interval,
            retries=args.retries,
            skip_ingredients=args.skip_ingredients,
        )
    )
    if fetch_status not in (0, 2):
        return fetch_status

    try:
        report = _load_report(args.date)
        archive = _archive_report(args.date, args.mode)
        publishable_ids = _school_ids_with_status(report, PUBLISHABLE_STATUSES)
        incomplete_ids = _school_ids_with_status(report, INCOMPLETE_STATUSES)
    except RuntimeError as exc:
        parser.error(str(exc))
    print(f"抓取報告已備份：{archive.relative_to(PROJECT_ROOT)}")

    if not publishable_ids:
        print("官方尚無可發佈紀錄；既有 reviewed JSON、SQLite 與 Site 保持不變。")
        return 2

    commands = [
        [sys.executable, "scripts/review_school_meals.py", "--date", args.date.isoformat()],
        [sys.executable, "scripts/build_database.py"],
        [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
        ["node", "--check", "web/app.js"],
        [sys.executable, "scripts/build_static_site.py"],
    ]
    for command in commands:
        status = _run(command)
        if status != 0:
            return status

    if args.publish:
        for school_chunk in _chunks(publishable_ids, args.publish_chunk_size):
            command = [
                sys.executable,
                "scripts/publish_school_meals.py",
                "--date",
                args.date.isoformat(),
            ]
            for school_id in school_chunk:
                command.extend(["--school-id", str(school_id)])
            status = _run(command)
            if status != 0:
                return status

    print(
        json.dumps(
            {
                "status": "complete" if not incomplete_ids else "incomplete",
                "mode": args.mode,
                "mealDate": args.date.isoformat(),
                "publishableSchools": len(publishable_ids),
                "incompleteSchools": len(incomplete_ids),
                "published": args.publish,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 2 if incomplete_ids else 0


if __name__ == "__main__":
    raise SystemExit(main())
