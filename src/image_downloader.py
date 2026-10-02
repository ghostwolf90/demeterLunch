from __future__ import annotations

import hashlib
import logging
import struct
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

from .http_client import HttpClient
from .models import ImageSource


LOGGER = logging.getLogger(__name__)


class InvalidImageError(ValueError):
    """Raised when downloaded content is not a supported image."""


class ImageDownloader:
    def __init__(self, http: HttpClient, *, max_bytes: int = 30 * 1024 * 1024) -> None:
        self.http = http
        self.max_bytes = max_bytes

    def download(
        self, source: ImageSource, destination_dir: Path, index: int
    ) -> dict[str, Any]:
        response, image_format, width, height = self._fetch_best_available(source)
        suffix = {"jpeg": ".jpg", "png": ".png", "gif": ".gif", "webp": ".webp"}[
            image_format
        ]
        filename = f"menu-{index:02d}{suffix}"
        destination = destination_dir / filename
        destination.write_bytes(response.data)
        digest = hashlib.sha256(response.data).hexdigest()
        LOGGER.info("Saved image %s", destination)
        return {
            "file": filename,
            "role": classify_menu_image_role(source, index),
            "originalUrl": source.original_url,
            "downloadUrl": source.download_url,
            "contentType": response.content_type,
            "bytes": len(response.data),
            "sha256": digest,
            "width": width,
            "height": height,
            "declaredOriginalWidth": source.declared_width,
            "declaredOriginalHeight": source.declared_height,
            "matchesDeclaredDimensions": _matches_declared_dimensions(
                source, width, height
            ),
        }

    def _fetch_best_available(
        self, source: ImageSource
    ) -> tuple[Any, str, int | None, int | None]:
        accept = "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.1"
        best_response = self.http.get(
            source.download_url,
            max_bytes=self.max_bytes,
            accept=accept,
        )
        best_format, best_width, best_height = inspect_image(best_response.data)

        # Google image serving occasionally returns a 1600px cached derivative
        # for an s0 URL. Retry without cache when the feed declares a larger
        # original, and keep whichever response has the largest pixel area.
        for _ in range(2):
            if _matches_declared_dimensions(source, best_width, best_height):
                break
            LOGGER.warning(
                "Blogger returned %sx%s for declared %sx%s; retrying original image",
                best_width,
                best_height,
                source.declared_width,
                source.declared_height,
            )
            retry_response = self.http.get(
                source.download_url,
                max_bytes=self.max_bytes,
                accept=accept,
                extra_headers={"Cache-Control": "no-cache"},
            )
            retry_format, retry_width, retry_height = inspect_image(retry_response.data)
            if _pixel_area(retry_width, retry_height) > _pixel_area(
                best_width, best_height
            ):
                best_response = retry_response
                best_format = retry_format
                best_width = retry_width
                best_height = retry_height

        if not _matches_declared_dimensions(source, best_width, best_height):
            LOGGER.warning(
                "Highest available image remains %sx%s (declared %sx%s): %s",
                best_width,
                best_height,
                source.declared_width,
                source.declared_height,
                source.download_url,
            )
        return best_response, best_format, best_width, best_height


def inspect_image(data: bytes) -> tuple[str, int | None, int | None]:
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width, height = struct.unpack(">II", data[16:24])
        return "png", width, height
    if data.startswith(b"\xff\xd8"):
        width, height = _jpeg_dimensions(data)
        return "jpeg", width, height
    if data.startswith((b"GIF87a", b"GIF89a")) and len(data) >= 10:
        width, height = struct.unpack("<HH", data[6:10])
        return "gif", width, height
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "webp", None, None
    raise InvalidImageError("Downloaded response is not a supported image")


def classify_menu_image_role(source: ImageSource, index: int) -> str | None:
    """Classify the three recurring menu images without relying on order alone."""
    names = " ".join(
        unquote(Path(urlsplit(url).path).name).lower()
        for url in (source.original_url, source.download_url)
    )
    if "葷" in names or any(
        name.startswith(("m_", "m-", "meat")) for name in names.split()
    ):
        return "meat_detail"
    if "素" in names or any(
        name.startswith(("v_", "v-", "veg")) for name in names.split()
    ):
        return "vegetarian_detail"
    if index == 1:
        return "summary"
    return None


def _jpeg_dimensions(data: bytes) -> tuple[int | None, int | None]:
    position = 2
    sof_markers = {
        0xC0,
        0xC1,
        0xC2,
        0xC3,
        0xC5,
        0xC6,
        0xC7,
        0xC9,
        0xCA,
        0xCB,
        0xCD,
        0xCE,
        0xCF,
    }
    while position + 4 <= len(data):
        if data[position] != 0xFF:
            position += 1
            continue
        while position < len(data) and data[position] == 0xFF:
            position += 1
        if position >= len(data):
            break
        marker = data[position]
        position += 1
        if marker in {0x01, 0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if position + 2 > len(data):
            break
        segment_length = int.from_bytes(data[position : position + 2], "big")
        if segment_length < 2 or position + segment_length > len(data):
            break
        if marker in sof_markers and segment_length >= 7:
            height = int.from_bytes(data[position + 3 : position + 5], "big")
            width = int.from_bytes(data[position + 5 : position + 7], "big")
            return width, height
        position += segment_length
    return None, None


def _matches_declared_dimensions(
    source: ImageSource, width: int | None, height: int | None
) -> bool:
    if not source.declared_width or not source.declared_height:
        return True
    if width is None or height is None:
        return False
    return width >= source.declared_width and height >= source.declared_height


def _pixel_area(width: int | None, height: int | None) -> int:
    return (width or 0) * (height or 0)
