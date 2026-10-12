#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TAIPEI = ZoneInfo("Asia/Taipei")


class SitePublishPreparationError(RuntimeError):
    pass


def _project_id(root: Path) -> str:
    path = root / ".openai" / "hosting.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SitePublishPreparationError(f"無法讀取 Site 設定：{path}") from exc
    project_id = str(payload.get("project_id") or "").strip()
    if not project_id:
        raise SitePublishPreparationError(f"Site 設定缺少 project_id：{path}")
    return project_id


def overlay_daily_data(source_root: Path, site_checkout: Path, meal_date: date) -> int:
    source_root = source_root.resolve()
    site_checkout = site_checkout.resolve()
    if source_root == site_checkout:
        raise SitePublishPreparationError("Site checkout 不得與本機資料專案相同")
    if not (site_checkout / ".git").is_dir():
        raise SitePublishPreparationError(
            f"不是已同步的 Site 原始碼 checkout：{site_checkout}"
        )
    source_project_id = _project_id(source_root)
    target_project_id = _project_id(site_checkout)
    if source_project_id != target_project_id:
        raise SitePublishPreparationError(
            f"Site project_id 不一致：{source_project_id} != {target_project_id}"
        )

    date_text = meal_date.isoformat()
    raw_source = source_root / "data" / "raw" / "fatrace-daily" / date_text
    report_path = raw_source / "report.json"
    if not report_path.is_file():
        raise SitePublishPreparationError(f"找不到當日抓取報告：{report_path}")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SitePublishPreparationError(f"當日抓取報告無效：{report_path}") from exc
    if report.get("mealDate") != date_text:
        raise SitePublishPreparationError(f"抓取報告日期不符：{report_path}")
    if report.get("summary", {}).get("failed"):
        raise SitePublishPreparationError("當日抓取仍有失敗學校，不準備發布")

    raw_target = site_checkout / "data" / "raw" / "fatrace-daily" / date_text
    raw_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(raw_source, raw_target, dirs_exist_ok=True)

    parsed_source = source_root / "data" / "parsed" / "schools" / "fatrace"
    parsed_target = site_checkout / "data" / "parsed" / "schools" / "fatrace"
    copied = 0
    for record in sorted(parsed_source.glob(f"*/{date_text}.json")):
        target = parsed_target / record.parent.name / record.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(record, target)
        copied += 1
    expected = int(report.get("summary", {}).get("available", 0)) + int(
        report.get("summary", {}).get("noMeal", 0)
    )
    if copied != expected:
        raise SitePublishPreparationError(
            f"reviewed 紀錄數不符：應有 {expected}，實際 {copied}"
        )
    return copied


def _run(command: list[str], checkout: Path) -> None:
    print(f"$ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=checkout, check=True)


def verify_and_build(site_checkout: Path) -> None:
    package_runner = os.environ.get("DEMETER_PACKAGE_RUNNER", "npm")
    commands = [
        [sys.executable, "scripts/build_database.py"],
        [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
        ["node", "--check", "web/app.js"],
        [package_runner, "run", "test:worker"],
        [package_runner, "run", "build"],
    ]
    for command in commands:
        _run(command, site_checkout)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Overlay reviewed daily meal data onto a freshly synchronized Site checkout, "
            "then validate and build it for credentialed publication."
        )
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(TAIPEI).date(),
        help="要發布的供餐日期，預設為臺北時區今天",
    )
    parser.add_argument(
        "--site-checkout",
        type=Path,
        required=True,
        help="透過 Sites 短效憑證剛同步的最新 Site 原始碼目錄",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="只疊加資料，供測試使用",
    )
    args = parser.parse_args(argv)

    try:
        copied = overlay_daily_data(PROJECT_ROOT, args.site_checkout, args.date)
        if not args.skip_build:
            verify_and_build(args.site_checkout.resolve())
    except (OSError, subprocess.CalledProcessError, SitePublishPreparationError) as exc:
        parser.error(str(exc))

    print(
        json.dumps(
            {
                "status": "ready_for_credentialed_publish",
                "projectId": _project_id(PROJECT_ROOT),
                "mealDate": args.date.isoformat(),
                "reviewedRecords": copied,
                "siteCheckout": str(args.site_checkout.resolve()),
                "note": "尚需由 Codex 使用 Sites 短效憑證推送並部署。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
