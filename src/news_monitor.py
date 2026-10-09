from __future__ import annotations

import hashlib
import html
import json
import os
import re
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin, urlsplit, urlunsplit

from .http_client import HttpClient, RequestError


NEWS_USER_AGENT = (
    "DemeterLunchNews/1.0 "
    "(+https://zxes.blogspot.com/; personal, non-commercial monitoring)"
)

STRONG_TERMS = (
    "營養午餐",
    "學校午餐",
    "校園午餐",
    "學童午餐",
    "午餐專法",
    "免費午餐",
    "午餐費",
    "團膳",
    "供膳",
    "食農教育",
    "飲食教育",
    "校園食安",
)
SCHOOL_TERMS = ("校園", "學校", "學童", "學生", "國小", "國中", "高中")
MEAL_TERMS = ("午餐", "供餐", "餐食", "食材", "食安", "食農", "食育")
LOCAL_TERMS = ("臺中", "台中", "中市")
FOOD_SAFETY_TERMS = (
    "食安",
    "中毒",
    "農藥",
    "異物",
    "停餐",
    "停售",
    "召回",
    "供應鏈",
    "團膳",
)
POLICY_TERMS = ("專法", "免費", "補助", "經費", "政策", "標準", "採購", "自治條例")
EDUCATION_TERMS = ("食農", "食育", "飲食教育", "惜食", "產地")


@dataclass(frozen=True)
class NewsSource:
    id: str
    name: str
    url: str
    source_type: str
    priority: int
    local: bool = False
    fallback_url: str | None = None


SOURCES = (
    NewsSource(
        id="taichung-city",
        name="臺中市政府",
        url="https://www.taichung.gov.tw/10179/564770/rss?nodeId=9962",
        source_type="官方公告",
        priority=4,
        local=True,
        fallback_url="https://www.taichung.gov.tw/9962/Lpsimplelist",
    ),
    NewsSource(
        id="moe",
        name="教育部",
        url="https://www.moe.gov.tw/Rss_News.aspx?n=9E7AC85F1954DDA8",
        source_type="官方公告",
        priority=4,
    ),
    NewsSource(
        id="cna-politics",
        name="中央通訊社",
        url="https://feeds.feedburner.com/rsscna/politics",
        source_type="新聞報導",
        priority=2,
    ),
    NewsSource(
        id="cna-life",
        name="中央通訊社",
        url="https://feeds.feedburner.com/rsscna/lifehealth",
        source_type="新聞報導",
        priority=2,
    ),
    NewsSource(
        id="cna-local",
        name="中央通訊社",
        url="https://feeds.feedburner.com/rsscna/local",
        source_type="新聞報導",
        priority=2,
    ),
)


def fetch_news(
    client: HttpClient,
    *,
    now: datetime | None = None,
    lookback_days: int = 30,
    max_items: int = 20,
    sources: Iterable[NewsSource] = SOURCES,
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    cutoff = current - timedelta(days=max(1, lookback_days))
    candidates: list[dict[str, Any]] = []
    statuses: list[dict[str, str]] = []

    for source in sources:
        try:
            response = client.get(
                source.url,
                max_bytes=2_000_000,
                accept="application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5",
            )
            parsed = parse_feed(response.data, source)
            if not parsed:
                raise ValueError("新聞動態沒有可讀條目")
            candidates.extend(parsed)
            statuses.append(
                {
                    "id": source.id,
                    "status": "ok",
                    "items": str(len(parsed)),
                    "format": "feed",
                }
            )
        except (RequestError, ET.ParseError, ValueError) as feed_exc:
            if not source.fallback_url:
                statuses.append(
                    {"id": source.id, "status": "failed", "error": str(feed_exc)}
                )
                continue
            try:
                response = client.get(
                    source.fallback_url,
                    max_bytes=2_000_000,
                    accept="text/html, application/xhtml+xml;q=0.9, */*;q=0.5",
                )
                parsed = parse_news_list(response.text(), source, response.url)
                if not parsed:
                    raise ValueError("新聞列表沒有可讀條目")
                candidates.extend(parsed)
                statuses.append(
                    {
                        "id": source.id,
                        "status": "ok",
                        "items": str(len(parsed)),
                        "format": "html-fallback",
                    }
                )
            except (RequestError, ValueError) as html_exc:
                statuses.append(
                    {
                        "id": source.id,
                        "status": "failed",
                        "error": f"feed: {feed_exc}; html: {html_exc}",
                    }
                )

    if not any(status["status"] == "ok" for status in statuses):
        raise RuntimeError("所有新聞來源目前都無法讀取")

    relevant: list[dict[str, Any]] = []
    for item in candidates:
        published = parse_datetime(item.get("publishedAt"))
        if published is None or published < cutoff or published > current + timedelta(days=1):
            continue
        score = relevance_score(item["title"], item.get("summary", ""))
        if score < 5:
            continue
        item["score"] = score + int(item.pop("sourcePriority", 0))
        item["category"] = classify_category(item["title"], item.get("summary", ""))
        item["whyItMatters"] = relevance_note(item["category"], bool(item["isLocal"]))
        item["important"] = bool(
            item["isLocal"] and item["category"] == "食安與供應"
        )
        item.pop("summary", None)
        relevant.append(item)

    deduplicated: dict[str, dict[str, Any]] = {}
    for item in relevant:
        key = normalize_title(item["title"])
        previous = deduplicated.get(key)
        if previous is None or (item["score"], item["publishedAt"]) > (
            previous["score"],
            previous["publishedAt"],
        ):
            deduplicated[key] = item

    items = sorted(
        deduplicated.values(),
        key=lambda item: (item["publishedAt"], item["score"]),
        reverse=True,
    )[: max(1, max_items)]
    for item in items:
        item.pop("score", None)
    return items, statuses


def parse_feed(payload: bytes, source: NewsSource) -> list[dict[str, Any]]:
    root = ET.fromstring(payload)
    entries = list(root.findall(".//item"))
    if not entries:
        entries = [element for element in root.iter() if local_name(element.tag) == "entry"]

    items: list[dict[str, Any]] = []
    for entry in entries:
        title = child_text(entry, ("title",))
        url = entry_link(entry)
        published = child_text(entry, ("pubDate", "published", "updated", "dc:date"))
        summary = child_text(entry, ("description", "summary", "content"))
        published_at = parse_datetime(published)
        if not title or not url or published_at is None:
            continue
        items.append(
            build_source_item(title, url, published_at.isoformat(), source, summary)
        )
    return items


def parse_news_list(
    payload: str, source: NewsSource, base_url: str
) -> list[dict[str, Any]]:
    parser = TaichungNewsListParser(base_url)
    parser.feed(payload)
    parser.close()
    return [
        build_source_item(row["title"], row["url"], row["date"], source)
        for row in parser.rows
    ]


def build_source_item(
    title: str, url: str, published: str, source: NewsSource, summary: str = ""
) -> dict[str, Any]:
    published_at = parse_datetime(published)
    if published_at is None:
        raise ValueError(f"無法辨識新聞日期: {published}")
    clean_title = clean_text(title)
    canonical_url = canonicalize_url(url)
    return {
        "id": hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()[:16],
        "title": clean_title,
        "url": canonical_url,
        "publishedAt": published_at.isoformat().replace("+00:00", "Z"),
        "source": source.name,
        "sourceId": source.id,
        "sourceType": source.source_type,
        "sourcePriority": source.priority,
        "isLocal": source.local or any(term in clean_title for term in LOCAL_TERMS),
        "summary": clean_text(summary),
    }


class TaichungNewsListParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.base_host = urlsplit(base_url).netloc.lower()
        self.rows: list[dict[str, str]] = []
        self._list_section_depth = 0
        self._row: dict[str, str] | None = None
        self._anchor_text: list[str] | None = None
        self._time_text: list[str] | None = None

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        attributes = dict(attrs)
        if tag == "section":
            classes = (attributes.get("class") or "").split()
            if self._list_section_depth or "listTable" in classes:
                self._list_section_depth += 1
            return
        if not self._list_section_depth:
            return
        if tag == "tr":
            self._row = {}
        elif tag == "a" and self._row is not None:
            href = (attributes.get("href") or "").strip()
            resolved = urljoin(self.base_url, href)
            if href and urlsplit(resolved).netloc.lower() == self.base_host:
                self._row["url"] = resolved
                self._anchor_text = []
        elif tag == "time" and self._row is not None:
            self._time_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "section" and self._list_section_depth:
            self._list_section_depth -= 1
            return
        if not self._list_section_depth:
            return
        if tag == "a" and self._anchor_text is not None:
            if self._row is not None:
                self._row["title"] = clean_text("".join(self._anchor_text))
            self._anchor_text = None
        elif tag == "time" and self._time_text is not None:
            if self._row is not None:
                self._row["date"] = clean_text("".join(self._time_text))
            self._time_text = None
        elif tag == "tr" and self._row is not None:
            if all(self._row.get(key) for key in ("title", "url", "date")):
                self.rows.append(self._row)
            self._row = None
            self._anchor_text = None
            self._time_text = None

    def handle_data(self, data: str) -> None:
        if self._anchor_text is not None:
            self._anchor_text.append(data)
        if self._time_text is not None:
            self._time_text.append(data)


def relevance_score(title: str, summary: str) -> int:
    title_score = sum(8 for term in STRONG_TERMS if term in title)
    if any(term in title for term in SCHOOL_TERMS) and any(
        term in title for term in MEAL_TERMS
    ):
        title_score += 7
    if title_score < 5:
        return 0
    summary_score = min(3, sum(1 for term in STRONG_TERMS if term in summary))
    return title_score + summary_score


def classify_category(title: str, summary: str) -> str:
    if any(term in title for term in FOOD_SAFETY_TERMS):
        return "食安與供應"
    if any(term in title for term in EDUCATION_TERMS):
        return "食育現場"
    if any(term in title for term in POLICY_TERMS):
        return "營養與政策"
    text = f"{title} {summary}"
    if any(term in text for term in FOOD_SAFETY_TERMS):
        return "食安與供應"
    if any(term in text for term in EDUCATION_TERMS):
        return "食育現場"
    if any(term in text for term in POLICY_TERMS):
        return "營養與政策"
    return "校園午餐"


def relevance_note(category: str, is_local: bool) -> str:
    if is_local and category == "食安與供應":
        return "涉及臺中校園食材或供餐安全，家長可留意主管機關後續說明。"
    if is_local:
        return "與臺中校園供餐、補助或執行方式直接相關。"
    notes = {
        "食安與供應": "涉及校園食材、供應鏈或食安，值得留意後續處理。",
        "營養與政策": "關乎學校午餐制度、經費或供餐標準的變化。",
        "食育現場": "提供從校園午餐延伸飲食與食農教育的案例。",
        "校園午餐": "呈現校園午餐的近期做法與公共討論。",
    }
    return notes[category]


def build_news_payload(
    items: list[dict[str, Any]],
    statuses: list[dict[str, str]],
    *,
    now: datetime | None = None,
    lookback_days: int = 30,
) -> dict[str, Any]:
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return {
        "schemaVersion": 1,
        "generatedAt": current.isoformat().replace("+00:00", "Z"),
        "lookbackDays": lookback_days,
        "itemCount": len(items),
        "items": items,
        "sources": statuses,
        "sourcePolicy": "僅顯示標題、日期、來源、本站整理的關聯說明與原文連結。",
    }


def payload_fingerprint(payload: dict[str, Any]) -> str:
    stable_items = [
        {
            key: item.get(key)
            for key in (
                "id",
                "title",
                "url",
                "publishedAt",
                "source",
                "category",
                "whyItMatters",
                "important",
            )
        }
        for item in payload.get("items", [])
        if isinstance(item, dict)
    ]
    serialized = json.dumps(stable_items, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}-", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    try:
        parsed = parsedate_to_datetime(text)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def child_text(entry: ET.Element, names: tuple[str, ...]) -> str:
    wanted = {name.split(":")[-1] for name in names}
    for child in entry.iter():
        if child is entry or local_name(child.tag) not in wanted:
            continue
        text = "".join(child.itertext()).strip()
        if text:
            return text
    return ""


def entry_link(entry: ET.Element) -> str:
    for child in entry.iter():
        if local_name(child.tag) != "link":
            continue
        href = child.attrib.get("href", "").strip()
        rel = child.attrib.get("rel", "alternate")
        if href and rel in {"", "alternate"}:
            return href
        if child.text and child.text.strip():
            return child.text.strip()
    return child_text(entry, ("guid",))


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].split(":")[-1]


def clean_text(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html.unescape(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def canonicalize_url(url: str) -> str:
    parts = urlsplit(html.unescape(url.strip()))
    return urlunsplit((parts.scheme, parts.netloc.lower(), parts.path, parts.query, ""))


def normalize_title(title: str) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", title.casefold())
