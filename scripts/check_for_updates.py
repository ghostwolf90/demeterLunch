#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.app import build_crawler  # noqa: E402
from src.update_monitor import (  # noqa: E402
    article_marker,
    build_monitor_state,
    classify_change,
    load_monitor_state,
    write_monitor_state,
)


DEFAULT_SINCE = date(2026, 9, 1)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check Blogger for a new or changed school lunch post."
    )
    parser.add_argument("--since", type=date.fromisoformat, default=DEFAULT_SINCE)
    parser.add_argument("--data-dir", type=Path, default=PROJECT_ROOT / "data" / "raw")
    parser.add_argument(
        "--state-file",
        type=Path,
        default=PROJECT_ROOT / "data" / "monitor" / "state.json",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download source images after a new or changed post is detected.",
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=1.0)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    crawler = build_crawler(
        data_dir=args.data_dir, timeout=args.timeout, interval=args.interval
    )
    try:
        latest = crawler.discover_latest(since=args.since)
        if latest is None:
            print(json.dumps({"status": "no-menu", "changed": False}, ensure_ascii=False))
            return 0

        marker = article_marker(latest)
        previous = load_monitor_state(args.state_file)
        status = classify_change(previous, marker)
        download_status = None
        if args.download and status in {"new", "updated"}:
            report = crawler.fetch_latest(since=args.since)
            if report.summary.failed:
                raise RuntimeError("New menu was detected, but its source image could not be saved")
            if report.outcomes:
                download_status = report.outcomes[0].status

        state = build_monitor_state(
            marker, status, download_status=download_status
        )
        write_monitor_state(args.state_file, state)
        print(json.dumps(state, ensure_ascii=False))
        return 0
    except Exception as exc:
        logging.getLogger(__name__).exception("Menu update check failed")
        print(
            json.dumps(
                {"status": "failed", "changed": False, "error": str(exc)},
                ensure_ascii=False,
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
