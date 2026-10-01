from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from urllib.parse import urlencode

from .article_parser import extract_images
from .http_client import HttpClient, RequestError
from .models import Article


LOGGER = logging.getLogger(__name__)

ATOM = "http://www.w3.org/2005/Atom"
OPEN_SEARCH = "http://a9.com/-/spec/opensearchrss/1.0/"
NS = {"atom": ATOM, "open": OPEN_SEARCH}


class FeedError(RuntimeError):
    """Raised when the Blogger Atom feed is unavailable or invalid."""


class BloggerFeedClient:
    def __init__(
        self,
        http: HttpClient,
        *,
        site_url: str = "https://zxes.blogspot.com/",
        page_size: int = 50,
    ) -> None:
        self.http = http
        self.site_url = site_url.rstrip("/") + "/"
        self.page_size = min(50, max(1, page_size))

    def fetch_articles(
        self,
        *,
        since: date | None = None,
        max_pages: int = 100,
    ) -> list[Article]:
        params = urlencode(
            {"alt": "atom", "max-results": self.page_size, "start-index": 1}
        )
        next_url: str | None = f"{self.site_url}feeds/posts/default?{params}"
        articles: list[Article] = []
        seen_pages: set[str] = set()
        discovery_cutoff = since - timedelta(days=7) if since else None

        for page_number in range(1, max_pages + 1):
            if not next_url or next_url in seen_pages:
                break
            seen_pages.add(next_url)
            LOGGER.info("Fetching Atom feed page %d", page_number)
            try:
                response = self.http.get(
                    next_url,
                    max_bytes=10 * 1024 * 1024,
                    accept="application/atom+xml, application/xml;q=0.9, */*;q=0.1",
                )
                page_articles, next_url, _ = parse_atom_feed(
                    response.data, self.site_url
                )
            except (RequestError, ET.ParseError, ValueError) as exc:
                raise FeedError(f"Unable to read Blogger feed: {exc}") from exc

            articles.extend(page_articles)
            if discovery_cutoff and page_articles:
                dates = [_published_date(article.published_at) for article in page_articles]
                known_dates = [value for value in dates if value is not None]
                # Blogger returns entries newest first. Once the oldest entry on
                # a page crosses the cutoff, all required entries were visited.
                if known_dates and min(known_dates) < discovery_cutoff:
                    break

        return articles


def parse_atom_feed(
    xml_data: bytes | str, site_url: str
) -> tuple[list[Article], str | None, int | None]:
    root = ET.fromstring(xml_data)
    articles: list[Article] = []

    for entry in root.findall("atom:entry", NS):
        title = entry.findtext("atom:title", default="", namespaces=NS).strip()
        entry_id = entry.findtext("atom:id", default="", namespaces=NS)
        post_id = entry_id.rsplit("post-", 1)[-1] if "post-" in entry_id else entry_id
        url = _alternate_link(entry) or site_url
        content = entry.findtext("atom:content", default="", namespaces=NS)
        labels = [
            node.attrib.get("term", "")
            for node in entry.findall("atom:category", NS)
            if node.attrib.get("term")
        ]
        articles.append(
            Article(
                id=post_id,
                title=title,
                url=url,
                published_at=entry.findtext("atom:published", namespaces=NS),
                updated_at=entry.findtext("atom:updated", namespaces=NS),
                labels=labels,
                images=extract_images(content, url),
                source="atom",
            )
        )

    next_url = next(
        (
            link.attrib.get("href")
            for link in root.findall("atom:link", NS)
            if link.attrib.get("rel") == "next" and link.attrib.get("href")
        ),
        None,
    )
    total_text = root.findtext("open:totalResults", namespaces=NS)
    total = int(total_text) if total_text and total_text.isdigit() else None
    return articles, next_url, total


def _alternate_link(entry: ET.Element) -> str | None:
    return next(
        (
            link.attrib.get("href")
            for link in entry.findall("atom:link", NS)
            if link.attrib.get("rel") == "alternate" and link.attrib.get("href")
        ),
        None,
    )


def _published_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None
