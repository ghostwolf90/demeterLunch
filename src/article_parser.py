from __future__ import annotations

import re
from datetime import date
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

from .models import ImageSource, ParsedTitle


class TitleParseError(ValueError):
    """Raised when a lunch article title cannot be parsed."""


TITLE_PATTERN = re.compile(
    r"(?P<school_year>\d{2,3})\s*學年度\s*"
    r"第?\s*(?P<semester>[一二12])\s*學期\s*"
    r"第\s*(?P<week>\d{1,2})"
    r"(?:\s*[-~～至]\s*(?P<week_end>\d{1,2}))?\s*週\s*"
    r"(?P<start>\d{4})\s*[-~～至]\s*(?P<end>\d{2,4})\s*"
    r"菜單\s*及\s*營養素分析"
)

SEMESTER_MAP = {"一": 1, "二": 2, "1": 1, "2": 2}


def is_lunch_article(title: str, labels: list[str] | None = None) -> bool:
    # Labels are useful supporting metadata but are not authoritative: the site
    # contains at least one survey post carrying a menu-related label.
    return "菜單" in title and "營養素分析" in title


def parse_title(title: str) -> ParsedTitle:
    match = TITLE_PATTERN.search(title)
    if not match:
        raise TitleParseError(f"Unsupported lunch title format: {title}")

    school_year = int(match.group("school_year"))
    semester = SEMESTER_MAP[match.group("semester")]
    week = int(match.group("week"))
    week_end = int(match.group("week_end")) if match.group("week_end") else None

    start_month, start_day = _parse_mmdd(match.group("start"))
    end_text = match.group("end")
    if len(end_text) == 2:
        end_month, end_day = start_month, int(end_text)
    else:
        end_month, end_day = _parse_mmdd(end_text)

    base_year = school_year + 1911
    start_year = _calendar_year(base_year, semester, start_month)
    end_year = _calendar_year(base_year, semester, end_month)

    try:
        start_date = date(start_year, start_month, start_day)
        end_date = date(end_year, end_month, end_day)
        if end_date < start_date:
            end_date = date(end_year + 1, end_month, end_day)
    except ValueError as exc:
        raise TitleParseError(f"Invalid date in lunch title: {title}") from exc

    return ParsedTitle(
        school_year=school_year,
        semester=semester,
        week=week,
        week_end=week_end,
        start_date=start_date,
        end_date=end_date,
    )


def _parse_mmdd(value: str) -> tuple[int, int]:
    return int(value[:2]), int(value[2:])


def _calendar_year(base_year: int, semester: int, month: int) -> int:
    if semester == 1:
        return base_year if month >= 8 else base_year + 1
    return base_year + 1


BLOGGER_IMAGE_HOSTS = {"blogger.googleusercontent.com"}
BLOGGER_SIZE_SEGMENT = re.compile(
    r"/(?:s\d+(?:-[wh]\d+)*(?:-[a-z])?|w\d+(?:-h\d+)?(?:-[a-z])?)/",
    re.IGNORECASE,
)


def normalize_blogger_image_url(url: str) -> str:
    parts = urlsplit(url)
    if parts.hostname and parts.hostname.lower() in BLOGGER_IMAGE_HOSTS:
        path = BLOGGER_SIZE_SEGMENT.sub("/s0/", parts.path, count=1)
        return urlunsplit((parts.scheme, parts.netloc, path, parts.query, ""))
    return url


def extract_images(content_html: str, base_url: str) -> list[ImageSource]:
    parser = _ArticleImageParser(base_url)
    parser.feed(content_html)
    parser.close()
    return parser.images


class _ArticleImageParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.anchor_url: str | None = None
        self.images: list[ImageSource] = []
        self._seen: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag.lower() == "a":
            href = values.get("href")
            self.anchor_url = urljoin(self.base_url, href) if href else None
            return
        if tag.lower() != "img":
            return

        src = values.get("data-original-src") or values.get("src")
        if not src:
            return
        src_url = urljoin(self.base_url, src)
        original_url = self.anchor_url if _looks_like_image_url(self.anchor_url) else src_url
        download_url = normalize_blogger_image_url(original_url)
        if download_url in self._seen:
            return
        self._seen.add(download_url)
        self.images.append(
            ImageSource(
                original_url=original_url,
                download_url=download_url,
                declared_width=_optional_int(values.get("data-original-width")),
                declared_height=_optional_int(values.get("data-original-height")),
            )
        )

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a":
            self.anchor_url = None


def _looks_like_image_url(url: str | None) -> bool:
    if not url:
        return False
    parts = urlsplit(url)
    if parts.hostname and parts.hostname.lower() in BLOGGER_IMAGE_HOSTS:
        return True
    return bool(re.search(r"\.(?:jpe?g|png|gif|webp)(?:$|\?)", url, re.IGNORECASE))


def _optional_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None
