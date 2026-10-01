from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import Article


def article_marker(article: Article) -> dict[str, Any]:
    parsed = article.parsed_title
    return {
        "id": article.id,
        "title": article.title,
        "url": article.url,
        "updatedAt": article.updated_at,
        "sourceFingerprint": article.source_fingerprint(),
        "schoolYear": parsed.school_year if parsed else None,
        "semester": parsed.semester if parsed else None,
        "week": parsed.week if parsed else None,
        "startDate": parsed.start_date.isoformat() if parsed else None,
        "endDate": parsed.end_date.isoformat() if parsed else None,
    }


def classify_change(
    previous_state: dict[str, Any] | None, marker: dict[str, Any]
) -> str:
    if not previous_state or not isinstance(previous_state.get("article"), dict):
        return "initialized"
    previous = previous_state["article"]
    if previous.get("id") != marker.get("id"):
        return "new"
    if (
        previous.get("updatedAt") != marker.get("updatedAt")
        or previous.get("sourceFingerprint") != marker.get("sourceFingerprint")
    ):
        return "updated"
    return "unchanged"


def build_monitor_state(
    marker: dict[str, Any],
    status: str,
    *,
    download_status: str | None = None,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "changed": status in {"new", "updated"},
        "downloadStatus": download_status,
        "article": marker,
    }


def load_monitor_state(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def write_monitor_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}-", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
