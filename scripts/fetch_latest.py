#!/usr/bin/env python3
from __future__ import annotations

import argparse
import logging
import sys
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.app import build_crawler


DEFAULT_SINCE = date(2026, 9, 1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch the latest school lunch post.")
    parser.add_argument(
        "--since",
        type=date.fromisoformat,
        default=DEFAULT_SINCE,
        help="Ignore menus ending before this date (default: 2026-09-01)",
    )
    parser.add_argument(
        "--data-dir", type=Path, default=Path("data/raw"), help="Raw data directory"
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument(
        "--interval",
        type=float,
        default=1.0,
        help="Minimum seconds between requests (default: 1.0)",
    )
    parser.add_argument(
        "--log-level", choices=["DEBUG", "INFO", "WARNING", "ERROR"], default="INFO"
    )
    args = parser.parse_args()
    _configure_logging(args.log_level)

    crawler = build_crawler(
        data_dir=args.data_dir, timeout=args.timeout, interval=args.interval
    )
    try:
        report = crawler.fetch_latest(since=args.since)
    except Exception:
        logging.getLogger(__name__).exception("Latest fetch failed")
        return 2

    if report.outcomes:
        outcome = report.outcomes[0]
        print(f"Latest lunch post:\n{outcome.article.title}\n")
        print(f"Status: {outcome.status}")
        print(f"Downloaded: {outcome.downloaded_images} images")
        if outcome.path:
            print(f"Saved: {outcome.path}")
        print()
    else:
        print("No lunch post found in the configured date range.\n")
    print(report.summary.as_lines())
    return 1 if report.summary.failed else 0


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


if __name__ == "__main__":
    raise SystemExit(main())

