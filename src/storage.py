from __future__ import annotations

import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any

from .models import Article


class StorageError(RuntimeError):
    """Raised when local article data cannot be stored safely."""


class ArticleStorage:
    def __init__(self, root: Path | str = Path("data/raw")) -> None:
        self.root = Path(root)

    def article_path(self, article: Article) -> Path:
        parsed = article.parsed_title
        if not parsed:
            return self.root / "unparsed" / _safe_component(article.id)
        calendar_school_year = parsed.school_year + 1911
        week_name = f"week-{parsed.week:02d}"
        if parsed.week_end is not None:
            week_name += f"-{parsed.week_end:02d}"
        return (
            self.root
            / str(calendar_school_year)
            / f"semester-{parsed.semester}"
            / week_name
        )

    def load_metadata(self, target: Path) -> dict[str, Any] | None:
        path = target / "metadata.json"
        if not path.is_file():
            return None
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise StorageError(f"Unable to read {path}: {exc}") from exc
        return value if isinstance(value, dict) else None

    def is_current(self, article: Article, target: Path) -> bool:
        metadata = self.load_metadata(target)
        if not metadata:
            return False
        if metadata.get("schemaVersion") != 1:
            return False
        if metadata.get("id") != article.id:
            return False
        if article.updated_at:
            if metadata.get("updatedAt") != article.updated_at:
                return False
        elif metadata.get("sourceFingerprint") != article.source_fingerprint():
            return False
        images = metadata.get("images")
        if not isinstance(images, list) or not images:
            return False
        return all(
            isinstance(image, dict)
            and isinstance(image.get("file"), str)
            and (target / image["file"]).is_file()
            for image in images
        )

    def create_staging_dir(self, target: Path) -> Path:
        target.parent.mkdir(parents=True, exist_ok=True)
        return Path(
            tempfile.mkdtemp(prefix=f".{target.name}-", suffix=".tmp", dir=target.parent)
        )

    def write_metadata(self, staging: Path, metadata: dict[str, Any]) -> None:
        path = staging / "metadata.json"
        try:
            path.write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        except OSError as exc:
            raise StorageError(f"Unable to write {path}: {exc}") from exc

    def commit(self, staging: Path, target: Path) -> None:
        backup: Path | None = None
        try:
            if target.exists():
                backup = target.with_name(f".{target.name}.backup-{uuid.uuid4().hex}")
                os.replace(target, backup)
            os.replace(staging, target)
        except OSError as exc:
            if backup and backup.exists() and not target.exists():
                os.replace(backup, target)
            raise StorageError(f"Unable to commit {target}: {exc}") from exc
        else:
            if backup:
                shutil.rmtree(backup, ignore_errors=True)

    @staticmethod
    def discard(staging: Path) -> None:
        shutil.rmtree(staging, ignore_errors=True)


def _safe_component(value: str) -> str:
    safe = "".join(character for character in value if character.isalnum() or character in "-_")
    return safe or "unknown"
