from __future__ import annotations

import logging
from datetime import date, datetime

from .article_parser import TitleParseError, is_lunch_article, parse_title
from .feed_client import BloggerFeedClient, FeedError
from .html_client import BloggerHtmlClient, HtmlError
from .image_downloader import ImageDownloader
from .models import Article, ArticleOutcome, CrawlReport, CrawlSummary
from .storage import ArticleStorage


LOGGER = logging.getLogger(__name__)


class LunchCrawler:
    def __init__(
        self,
        feed_client: BloggerFeedClient,
        html_client: BloggerHtmlClient,
        image_downloader: ImageDownloader,
        storage: ArticleStorage,
    ) -> None:
        self.feed_client = feed_client
        self.html_client = html_client
        self.image_downloader = image_downloader
        self.storage = storage

    def import_history(self, *, since: date) -> CrawlReport:
        articles = self._discover(since=since, max_pages=100)
        candidates = self._prepare_candidates(articles, since)
        candidates.sort(key=_article_sort_key)
        return self._process(articles, candidates)

    def fetch_latest(self, *, since: date) -> CrawlReport:
        articles = self._discover(since=since, max_pages=1)
        candidates = self._prepare_candidates(articles, since)
        selected = [max(candidates, key=_article_sort_key)] if candidates else []
        return self._process(articles, selected)

    def _discover(self, *, since: date, max_pages: int) -> list[Article]:
        try:
            return self.feed_client.fetch_articles(since=since, max_pages=max_pages)
        except FeedError as exc:
            LOGGER.warning("Atom feed unavailable; falling back to HTML: %s", exc)
        try:
            return self.html_client.fetch_articles(since=since, max_pages=max_pages)
        except HtmlError as exc:
            raise RuntimeError(f"Both Atom and HTML discovery failed: {exc}") from exc

    def _prepare_candidates(self, articles: list[Article], since: date) -> list[Article]:
        candidates: list[Article] = []
        for article in articles:
            if not is_lunch_article(article.title, article.labels):
                continue
            try:
                article.parsed_title = parse_title(article.title)
            except TitleParseError as exc:
                LOGGER.warning("%s; preserving article with null parsed fields", exc)

            if article.parsed_title:
                if article.parsed_title.end_date < since:
                    continue
            else:
                published = _iso_date(article.published_at)
                if published and published < since:
                    continue
            candidates.append(article)
        return candidates

    def _process(
        self, discovered: list[Article], candidates: list[Article]
    ) -> CrawlReport:
        summary = CrawlSummary(fetched=len(discovered), candidates=len(candidates))
        outcomes: list[ArticleOutcome] = []

        for article in candidates:
            target = self.storage.article_path(article)
            try:
                if self.storage.is_current(article, target):
                    LOGGER.info("Skipping unchanged article: %s", article.title)
                    summary.skipped += 1
                    outcomes.append(ArticleOutcome(article, "skipped", target, 0))
                    continue
            except Exception as exc:
                LOGGER.warning("Existing metadata is unusable for %s: %s", target, exc)

            existed = target.exists()
            staging = None
            try:
                staging = self.storage.create_staging_dir(target)
                if not article.images:
                    raise ValueError("Article contains no downloadable images")
                downloaded = [
                    self.image_downloader.download(source, staging, index)
                    for index, source in enumerate(article.images, start=1)
                ]
                self.storage.write_metadata(staging, article.metadata(downloaded))
                self.storage.commit(staging, target)
            except Exception as exc:
                if staging is not None:
                    self.storage.discard(staging)
                summary.failed += 1
                LOGGER.error("Failed to store %s: %s", article.title, exc)
                outcomes.append(ArticleOutcome(article, "failed"))
                continue

            status = "updated" if existed else "created"
            if existed:
                summary.updated += 1
            else:
                summary.created += 1
            LOGGER.info("%s: %s", status.capitalize(), target)
            outcomes.append(ArticleOutcome(article, status, target, len(downloaded)))

        return CrawlReport(summary=summary, outcomes=outcomes)


def _article_sort_key(article: Article) -> tuple[date, str]:
    if article.parsed_title:
        return article.parsed_title.end_date, article.updated_at or ""
    return _iso_date(article.published_at) or date.min, article.updated_at or ""


def _iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None
