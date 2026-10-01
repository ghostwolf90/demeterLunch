from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
import hashlib
import json
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ParsedTitle:
    school_year: int
    semester: int
    week: int
    week_end: int | None
    start_date: date
    end_date: date


@dataclass(frozen=True)
class ImageSource:
    original_url: str
    download_url: str
    declared_width: int | None = None
    declared_height: int | None = None


@dataclass
class Article:
    id: str
    title: str
    url: str
    published_at: str | None
    updated_at: str | None
    labels: list[str] = field(default_factory=list)
    images: list[ImageSource] = field(default_factory=list)
    source: str = "atom"
    parsed_title: ParsedTitle | None = None

    def source_fingerprint(self) -> str:
        payload = {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "images": [image.download_url for image in self.images],
        }
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def metadata(self, downloaded_images: list[dict[str, Any]]) -> dict[str, Any]:
        parsed = self.parsed_title
        return {
            "schemaVersion": 1,
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "publishedAt": self.published_at,
            "updatedAt": self.updated_at,
            "schoolYear": parsed.school_year if parsed else None,
            "semester": parsed.semester if parsed else None,
            "week": parsed.week if parsed else None,
            "weekEnd": parsed.week_end if parsed else None,
            "startDate": parsed.start_date.isoformat() if parsed else None,
            "endDate": parsed.end_date.isoformat() if parsed else None,
            "labels": self.labels,
            "source": self.source,
            "sourceFingerprint": self.source_fingerprint(),
            "images": downloaded_images,
        }


@dataclass
class CrawlSummary:
    fetched: int = 0
    candidates: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0

    def as_lines(self) -> str:
        return "\n".join(
            [
                f"Fetched: {self.fetched}",
                f"Candidates: {self.candidates}",
                f"Created: {self.created}",
                f"Updated: {self.updated}",
                f"Skipped: {self.skipped}",
                f"Failed: {self.failed}",
            ]
        )


@dataclass(frozen=True)
class ArticleOutcome:
    article: Article
    status: str
    path: Path | None = None
    downloaded_images: int = 0


@dataclass
class CrawlReport:
    summary: CrawlSummary
    outcomes: list[ArticleOutcome] = field(default_factory=list)
