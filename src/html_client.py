from __future__ import annotations

import html
import logging
import re
from datetime import date, timedelta
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from .article_parser import extract_images, is_lunch_article
from .http_client import HttpClient, RequestError
from .models import Article


LOGGER = logging.getLogger(__name__)


class HtmlError(RuntimeError):
    """Raised when the HTML fallback cannot read the site."""


class BloggerHtmlClient:
    def __init__(
        self,
        http: HttpClient,
        *,
        site_url: str = "https://zxes.blogspot.com/",
    ) -> None:
        self.http = http
        self.site_url = site_url.rstrip("/") + "/"

    def fetch_articles(
        self,
        *,
        since: date | None = None,
        max_pages: int = 100,
    ) -> list[Article]:
        page_url: str | None = self.site_url
        visited_pages: set[str] = set()
        visited_posts: set[str] = set()
        articles: list[Article] = []
        cutoff_hint = since - timedelta(days=7) if since else None

        for page_number in range(1, max_pages + 1):
            if not page_url or page_url in visited_pages:
                break
            visited_pages.add(page_url)
            LOGGER.info("Fetching HTML listing page %d", page_number)
            try:
                response = self.http.get(
                    page_url,
                    max_bytes=10 * 1024 * 1024,
                    accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
                )
            except RequestError as exc:
                raise HtmlError(f"Unable to fetch HTML listing: {exc}") from exc

            listing = _ListingParser(response.url)
            listing.feed(response.text())
            listing.close()

            for title, post_url in listing.posts:
                if post_url in visited_posts or not is_lunch_article(title):
                    continue
                visited_posts.add(post_url)
                try:
                    article = self._fetch_article(post_url, fallback_title=title)
                except (RequestError, ValueError) as exc:
                    LOGGER.error("Failed to read article %s: %s", post_url, exc)
                    continue
                articles.append(article)

            if cutoff_hint and _listing_crossed_cutoff(listing.posts, cutoff_hint):
                break
            page_url = listing.older_url

        return articles

    def _fetch_article(self, url: str, *, fallback_title: str) -> Article:
        response = self.http.get(
            url,
            max_bytes=10 * 1024 * 1024,
            accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        )
        parser = _ArticlePageParser(response.url)
        parser.feed(response.text())
        parser.close()
        article_url = parser.canonical_url or response.url
        post_id = parser.post_id or _fallback_post_id(article_url)
        return Article(
            id=post_id,
            title=parser.title or fallback_title,
            url=article_url,
            published_at=parser.published_at,
            updated_at=parser.updated_at,
            labels=parser.labels,
            images=extract_images("".join(parser.body_html), article_url),
            source="html",
        )


class _ListingParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.posts: list[tuple[str, str]] = []
        self.older_url: str | None = None
        self._in_title = False
        self._title_href: str | None = None
        self._title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        if tag.lower() in {"h2", "h3"} and "post-title" in classes:
            self._in_title = True
            self._title_href = None
            self._title_parts = []
            return
        if tag.lower() == "a":
            href = values.get("href")
            if values.get("id") == "Blog1_blog-pager-older-link" and href:
                self.older_url = urljoin(self.base_url, href)
            if self._in_title and href:
                self._title_href = urljoin(self.base_url, href)

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() not in {"h2", "h3"} or not self._in_title:
            return
        title = " ".join("".join(self._title_parts).split())
        if title and self._title_href:
            self.posts.append((title, self._title_href))
        self._in_title = False
        self._title_href = None
        self._title_parts = []


class _ArticlePageParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title: str | None = None
        self.canonical_url: str | None = None
        self.published_at: str | None = None
        self.updated_at: str | None = None
        self.post_id: str | None = None
        self.labels: list[str] = []
        self.body_html: list[str] = []
        self._body_div_depth = 0
        self._in_title = False
        self._title_parts: list[str] = []
        self._in_labels = False
        self._in_label_link = False
        self._label_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())

        if tag.lower() == "meta":
            key = values.get("itemprop") or values.get("property")
            content = values.get("content")
            if key == "datePublished" and content:
                self.published_at = content
            elif key == "dateModified" and content:
                self.updated_at = content
            elif key == "og:title" and content and not self.title:
                self.title = content
        elif tag.lower() == "link":
            rel = (values.get("rel") or "").split()
            if "canonical" in rel and values.get("href"):
                self.canonical_url = urljoin(self.base_url, values["href"])

        if tag.lower() in {"h2", "h3"} and "post-title" in classes:
            self._in_title = True
            self._title_parts = []

        if tag.lower() == "span" and "post-labels" in classes:
            self._in_labels = True
        elif tag.lower() == "a" and self._in_labels:
            self._in_label_link = True
            self._label_parts = []

        if tag.lower() == "div" and "post-body" in classes and self._body_div_depth == 0:
            self._body_div_depth = 1
            body_id = values.get("id") or ""
            match = re.search(r"post-body-(\d+)", body_id)
            if match:
                self.post_id = match.group(1)
            return

        if self._body_div_depth > 0:
            if tag.lower() == "div":
                self._body_div_depth += 1
            self.body_html.append(self.get_starttag_text() or f"<{tag}>")

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if self._body_div_depth > 0:
            self.body_html.append(self.get_starttag_text() or f"<{tag} />")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_parts.append(data)
        if self._in_label_link:
            self._label_parts.append(data)
        if self._body_div_depth > 0:
            self.body_html.append(html.escape(data))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"h2", "h3"} and self._in_title:
            title = " ".join("".join(self._title_parts).split())
            if title:
                self.title = title
            self._in_title = False
        if tag.lower() == "a" and self._in_label_link:
            label = " ".join("".join(self._label_parts).split())
            if label:
                self.labels.append(label)
            self._in_label_link = False
        if tag.lower() == "span" and self._in_labels:
            self._in_labels = False

        if self._body_div_depth > 0:
            if tag.lower() == "div":
                self._body_div_depth -= 1
                if self._body_div_depth == 0:
                    return
            self.body_html.append(f"</{tag}>")


def _listing_crossed_cutoff(
    posts: list[tuple[str, str]], cutoff: date
) -> bool:
    hints: list[date] = []
    for _, url in posts:
        match = re.search(r"/(\d{4})/(\d{2})/", urlsplit(url).path)
        if match:
            hints.append(date(int(match.group(1)), int(match.group(2)), 1))
    cutoff_month = date(cutoff.year, cutoff.month, 1)
    return bool(hints and min(hints) < cutoff_month)


def _fallback_post_id(url: str) -> str:
    path = urlsplit(url).path.rstrip("/")
    slug = path.rsplit("/", 1)[-1].removesuffix(".html")
    return slug or "unknown"

