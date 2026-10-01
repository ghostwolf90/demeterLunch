from __future__ import annotations

import logging
import os
import ssl
import time
from dataclasses import dataclass
from email.message import Message
from urllib.error import HTTPError, URLError
from urllib.request import HTTPSHandler, Request, build_opener


LOGGER = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "DemeterLunchCollector/0.1 "
    "(+https://zxes.blogspot.com/; personal archival use)"
)


class RequestError(RuntimeError):
    """Raised when an HTTP request cannot be completed safely."""


class ResponseTooLarge(RequestError):
    """Raised when a response exceeds its configured size limit."""


@dataclass(frozen=True)
class HttpResponse:
    data: bytes
    url: str
    status: int
    headers: Message

    @property
    def content_type(self) -> str:
        return self.headers.get_content_type().lower()

    def text(self) -> str:
        charset = self.headers.get_content_charset() or "utf-8"
        try:
            return self.data.decode(charset)
        except (LookupError, UnicodeDecodeError):
            return self.data.decode("utf-8", errors="replace")


class HttpClient:
    def __init__(
        self,
        *,
        timeout: float = 20.0,
        min_interval: float = 1.0,
        retries: int = 2,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        self.timeout = timeout
        self.min_interval = max(0.0, min_interval)
        self.retries = max(0, retries)
        self.user_agent = user_agent
        self._last_request_at: float | None = None
        self._opener = build_opener(HTTPSHandler(context=_verified_ssl_context()))

    def get(
        self,
        url: str,
        *,
        max_bytes: int,
        accept: str = "*/*",
        extra_headers: dict[str, str] | None = None,
    ) -> HttpResponse:
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            self._wait_for_rate_limit()
            headers = {"User-Agent": self.user_agent, "Accept": accept}
            headers.update(extra_headers or {})
            request = Request(url, headers=headers, method="GET")
            try:
                LOGGER.debug("GET %s", url)
                with self._opener.open(request, timeout=self.timeout) as response:
                    self._last_request_at = time.monotonic()
                    data = response.read(max_bytes + 1)
                    if len(data) > max_bytes:
                        raise ResponseTooLarge(
                            f"Response exceeded {max_bytes} bytes: {url}"
                        )
                    return HttpResponse(
                        data=data,
                        url=response.geturl(),
                        status=response.status,
                        headers=response.headers,
                    )
            except HTTPError as exc:
                self._last_request_at = time.monotonic()
                last_error = exc
                if exc.code != 429 and not 500 <= exc.code < 600:
                    raise RequestError(f"HTTP {exc.code} for {url}") from exc
                if attempt >= self.retries:
                    break
                delay = _retry_delay(exc.headers.get("Retry-After"), attempt)
                LOGGER.warning("HTTP %s for %s; retrying in %.1fs", exc.code, url, delay)
                time.sleep(delay)
            except (URLError, TimeoutError, OSError) as exc:
                self._last_request_at = time.monotonic()
                last_error = exc
                if attempt >= self.retries:
                    break
                delay = 2**attempt
                LOGGER.warning("Request failed for %s; retrying in %.1fs", url, delay)
                time.sleep(delay)

        raise RequestError(f"Request failed after retries: {url}: {last_error}")

    def _wait_for_rate_limit(self) -> None:
        if self._last_request_at is None:
            return
        elapsed = time.monotonic() - self._last_request_at
        remaining = self.min_interval - elapsed
        if remaining > 0:
            time.sleep(remaining)


def _retry_delay(retry_after: str | None, attempt: int) -> float:
    if retry_after:
        try:
            return min(60.0, max(1.0, float(retry_after)))
        except ValueError:
            pass
    return float(2**attempt)


def _verified_ssl_context() -> ssl.SSLContext:
    """Use Python's CA setup, with the macOS system bundle as a safe fallback."""
    verify_paths = ssl.get_default_verify_paths()
    candidates = [
        verify_paths.cafile,
        verify_paths.openssl_cafile,
        "/etc/ssl/cert.pem",
        "/private/etc/ssl/cert.pem",
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return ssl.create_default_context(cafile=candidate)
    return ssl.create_default_context()
