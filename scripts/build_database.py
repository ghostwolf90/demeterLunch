#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.menu_data import DataValidationError, build_database  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate reviewed lunch menus and build the local SQLite database."
    )
    parser.add_argument(
        "--parsed-dir", type=Path, default=PROJECT_ROOT / "data" / "parsed"
    )
    parser.add_argument(
        "--database", type=Path, default=PROJECT_ROOT / "data" / "lunch.db"
    )
    args = parser.parse_args()
    try:
        stats = build_database(args.parsed_dir, args.database)
    except DataValidationError as exc:
        parser.error(str(exc))
    print(
        f"Built {args.database} from {stats['weeks']} weeks, "
        f"{stats['days']} days and {stats['items']} menu items."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
