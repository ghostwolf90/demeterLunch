#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.http_client import HttpClient  # noqa: E402
from src.news_monitor import (  # noqa: E402
    NEWS_USER_AGENT,
    build_news_payload,
    fetch_news,
    load_json,
    payload_fingerprint,
    write_json_atomic,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Refresh recent school-lunch news from public RSS feeds."
    )
    parser.add_argument(
        "--news-file",
        type=Path,
        default=PROJECT_ROOT / "data" / "news" / "news.json",
    )
    parser.add_argument(
        "--state-file",
        type=Path,
        default=PROJECT_ROOT / "data" / "news" / "state.json",
    )
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--max-items", type=int, default=20)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=0.8)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    checked_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        client = HttpClient(
            timeout=args.timeout,
            min_interval=args.interval,
            retries=1,
            user_agent=NEWS_USER_AGENT,
        )
        items, statuses = fetch_news(
            client,
            lookback_days=args.days,
            max_items=args.max_items,
        )
        payload = build_news_payload(
            items,
            statuses,
            lookback_days=args.days,
        )
        fingerprint = payload_fingerprint(payload)
        previous_payload = load_json(args.news_file)
        previous_fingerprint = (
            payload_fingerprint(previous_payload) if previous_payload else None
        )
        changed = previous_fingerprint != fingerprint
        if changed:
            write_json_atomic(args.news_file, payload)

        failed_sources = [
            source["id"] for source in statuses if source.get("status") == "failed"
        ]
        important = [item for item in items if item.get("important")]
        state = {
            "schemaVersion": 1,
            "checkedAt": checked_at,
            "status": "updated" if changed else "unchanged",
            "changed": changed,
            "fingerprint": fingerprint,
            "itemCount": len(items),
            "failedSources": failed_sources,
            "importantItems": [
                {"title": item["title"], "url": item["url"]} for item in important
            ],
        }
        write_json_atomic(args.state_file, state)
        print(json.dumps(state, ensure_ascii=False))
        return 0
    except Exception as exc:
        logging.getLogger(__name__).exception("News update check failed")
        failure = {
            "schemaVersion": 1,
            "checkedAt": checked_at,
            "status": "failed",
            "changed": False,
            "error": str(exc),
        }
        write_json_atomic(args.state_file, failure)
        print(json.dumps(failure, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
