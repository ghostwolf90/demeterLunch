from __future__ import annotations

from pathlib import Path

from .crawler import LunchCrawler
from .feed_client import BloggerFeedClient
from .html_client import BloggerHtmlClient
from .http_client import HttpClient
from .image_downloader import ImageDownloader
from .storage import ArticleStorage


def build_crawler(
    *,
    data_dir: Path,
    timeout: float,
    interval: float,
) -> LunchCrawler:
    http = HttpClient(timeout=timeout, min_interval=interval, retries=2)
    return LunchCrawler(
        feed_client=BloggerFeedClient(http),
        html_client=BloggerHtmlClient(http),
        image_downloader=ImageDownloader(http),
        storage=ArticleStorage(data_dir),
    )

