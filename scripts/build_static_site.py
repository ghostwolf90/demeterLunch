#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.dashboard import load_dashboard  # noqa: E402
from src.menu_data import build_database  # noqa: E402


def build_static_site(
    *,
    web_root: Path,
    raw_root: Path,
    parsed_root: Path,
    database_path: Path,
    output_root: Path,
) -> dict[str, int]:
    database_stats = build_database(parsed_root, database_path)
    if output_root.exists():
        shutil.rmtree(output_root)
    shutil.copytree(web_root, output_root)

    with sqlite3.connect(database_path) as connection:
        dates = [
            row[0]
            for row in connection.execute(
                "SELECT date FROM daily_menus ORDER BY date"
            ).fetchall()
        ]
    if not dates:
        raise ValueError("資料庫沒有可匯出的供餐日")

    dashboards = {day: load_dashboard(database_path, day) for day in dates}
    latest = dashboards[dates[-1]]
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "days": [dashboards[day]["selected"] for day in dates],
        "dinnerSuggestions": {
            day: dashboards[day]["dinnerSuggestion"] for day in dates
        },
        "insights": latest["insights"],
        "archive": latest["archive"],
        "dateRange": latest["dateRange"],
        "totalDays": latest["totalDays"],
    }
    data_output = output_root / "data"
    data_output.mkdir(parents=True, exist_ok=True)
    (data_output / "site-data.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    copied_images = 0
    for week in latest["archive"]:
        relative = str(week["sourceImage"]).removeprefix("/data/")
        source = raw_root / relative
        if not source.is_file():
            raise FileNotFoundError(f"找不到原始菜單圖：{source}")
        destination = data_output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied_images += 1

    return {
        **database_stats,
        "images": copied_images,
        "outputFiles": sum(path.is_file() for path in output_root.rglob("*")),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the static, deployable version of the lunch website."
    )
    parser.add_argument("--web-root", type=Path, default=PROJECT_ROOT / "web")
    parser.add_argument("--raw-root", type=Path, default=PROJECT_ROOT / "data" / "raw")
    parser.add_argument(
        "--parsed-root", type=Path, default=PROJECT_ROOT / "data" / "parsed"
    )
    parser.add_argument(
        "--database", type=Path, default=PROJECT_ROOT / "data" / "lunch.db"
    )
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "dist")
    args = parser.parse_args()
    stats = build_static_site(
        web_root=args.web_root,
        raw_root=args.raw_root,
        parsed_root=args.parsed_root,
        database_path=args.database,
        output_root=args.output,
    )
    print(
        f"Built {args.output} with {stats['days']} days, "
        f"{stats['images']} source images and {stats['outputFiles']} files."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
