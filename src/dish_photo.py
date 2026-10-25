"""Restricted, bounded photo delivery for the local preview server."""
import re
import threading
import time

from .http_client import HttpClient
from .image_downloader import inspect_image

_client = HttpClient(timeout=2.5, min_interval=1, retries=0,
                     user_agent="HaoHaoFood/1.0 (+https://haohaofood.cc; school lunch photo viewer)")
_lock = threading.Lock()
_cache: dict[str, tuple[float, bytes, str]] = {}


class PhotoSourceBusy(RuntimeError):
    """Let the visitor use the official photo instead of joining a download queue."""


def load_dish_photo(dish_id: str) -> tuple[bytes, str]:
    if not re.fullmatch(r"[1-9]\d{0,19}", dish_id):
        raise ValueError("Invalid dish ID")
    now = time.monotonic()
    cached = _cache.get(dish_id)
    if cached and cached[0] > now:
        return cached[1], cached[2]
    if not _lock.acquire(blocking=False):
        raise PhotoSourceBusy("Photo source busy")
    try:
        response = _client.get(
            f"https://fatraceschool.k12ea.gov.tw/dish/pic/{dish_id}",
            max_bytes=5 * 1024 * 1024, accept="image/jpeg,image/png,image/webp",
        )
        image_format, _, _ = inspect_image(response.data)
        content_type = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(image_format)
        if not content_type:
            raise ValueError("Unsupported photo type")
        if len(_cache) >= 32:
            _cache.pop(next(iter(_cache)))
        _cache[dish_id] = (now + 3600, response.data, content_type)
        return response.data, content_type
    finally:
        _lock.release()
