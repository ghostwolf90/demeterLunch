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


def _print_chinese_summary(
    *,
    meal_date: date,
    mode: str,
    report: dict[str, Any] | None,
    publish_requested: bool,
    published_schools: int,
    checked_schools: int,
    outcome: str,
    detail: str,
) -> None:
    results = report.get("results", []) if isinstance(report, dict) else []
    counts = {
        status: sum(
            isinstance(item, dict) and item.get("recordStatus") == status
            for item in results
        )
        for status in ("available", "no_meal", "not_published", "failed")
    }
    retry_count = counts["not_published"] + counts["failed"]
    mode_label = "全市首輪" if mode == "main" else "補抓未完成學校"
    if publish_requested and checked_schools == 0:
        publish_label = "本次無需發布"
    elif publish_requested:
        publish_label = f"已發布 {published_schools} 校"
    else:
        publish_label = "未要求發布（僅完成收集、校讀與建置）"
    print("\n＝＝＝＝＝ 午餐資料更新總結 ＝＝＝＝＝")
    print(f"供餐日期：{meal_date.isoformat()}")
    print(f"執行模式：{mode_label}")
    print(f"本次檢查：{checked_schools} 校")
    print(f"取得午餐資料：{counts['available']} 校")
    print(f"官方註記無供餐：{counts['no_meal']} 校")
    print(f"尚未發布資料：{counts['not_published']} 校")
    print(f"抓取失敗：{counts['failed']} 校")
    print(f"發布狀態：{publish_label}")
    print(f"下次待重試：{retry_count} 校")
    print(f"最終狀態：{outcome}")
    print(f"說明：{detail}")
    print("＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝")


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
    previous: dict[str, Any] | None = None
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
                _print_chinese_summary(
                    meal_date=args.date,
                    mode=args.mode,
                    report=previous,
                    publish_requested=args.publish,
                    published_schools=0,
                    checked_schools=0,
                    outcome="已完成",
                    detail="既有報告沒有待補抓學校，本次未發出來源請求。",
                )
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
        _print_chinese_summary(
            meal_date=args.date,
            mode=args.mode,
            report=previous,
            publish_requested=args.publish,
            published_schools=0,
            checked_schools=len(retry_ids or []),
            outcome="執行失敗",
            detail=f"資料抓取程序異常結束，回傳代碼 {fetch_status}。",
        )
        return fetch_status

    try:
        report = _load_report(args.date)
        archive = _archive_report(args.date, args.mode)
        publishable_ids = _school_ids_with_status(report, PUBLISHABLE_STATUSES)
        incomplete_ids = _school_ids_with_status(report, INCOMPLETE_STATUSES)
    except (OSError, RuntimeError) as exc:
        _print_chinese_summary(
            meal_date=args.date,
            mode=args.mode,
            report=None,
            publish_requested=args.publish,
            published_schools=0,
            checked_schools=len(retry_ids or []),
            outcome="執行失敗",
            detail=str(exc),
        )
        return 2
    print(f"抓取報告已備份：{archive.relative_to(PROJECT_ROOT)}")

    if not publishable_ids:
        print("官方尚無可發佈紀錄；既有 reviewed JSON、SQLite 與 Site 保持不變。")
        _print_chinese_summary(
            meal_date=args.date,
            mode=args.mode,
            report=report,
            publish_requested=args.publish,
            published_schools=0,
            checked_schools=len(report["results"]),
            outcome="等待資料",
            detail="本次沒有可發布紀錄；尚未發布與失敗學校已保留，供下次重試。",
        )
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
            _print_chinese_summary(
                meal_date=args.date,
                mode=args.mode,
                report=report,
                publish_requested=args.publish,
                published_schools=0,
                checked_schools=len(report["results"]),
                outcome="驗證或建置失敗",
                detail=f"指令 {' '.join(command)} 回傳代碼 {status}，尚未發布。",
            )
            return status

    published_schools = 0
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
                _print_chinese_summary(
                    meal_date=args.date,
                    mode=args.mode,
                    report=report,
                    publish_requested=True,
                    published_schools=published_schools,
                    checked_schools=len(report["results"]),
                    outcome="部分發布後中斷" if published_schools else "發布失敗",
                    detail=f"發布程序回傳代碼 {status}；未完成學校仍保留供下次重試。",
                )
                return status
            published_schools += len(school_chunk)

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
    if incomplete_ids:
        outcome = "部分完成"
        detail = "可用資料已處理；尚未發布與失敗學校已保留，下一次執行同一指令會自動補抓。"
    else:
        outcome = "全部完成"
        detail = "本批次沒有待補抓學校。"
    _print_chinese_summary(
        meal_date=args.date,
        mode=args.mode,
        report=report,
        publish_requested=args.publish,
        published_schools=published_schools,
        checked_schools=len(report["results"]),
        outcome=outcome,
        detail=detail,
    )
    return 2 if incomplete_ids else 0


if __name__ == "__main__":
    raise SystemExit(main())
