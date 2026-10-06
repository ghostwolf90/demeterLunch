#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ipaddress
import json
import logging
import mimetypes
import secrets
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WEB_ROOT = PROJECT_ROOT / "web"
DEFAULT_ADMIN_ROOT = PROJECT_ROOT / "admin"
DEFAULT_DATA_ROOT = PROJECT_ROOT / "data" / "raw"
DEFAULT_DATABASE = PROJECT_ROOT / "data" / "lunch.db"
DEFAULT_NEWS_DATA = PROJECT_ROOT / "data" / "news" / "news.json"
LOGGER = logging.getLogger(__name__)

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.admin_actions import AdminActionRunner  # noqa: E402
from src.admin_status import load_admin_status  # noqa: E402
from src.dashboard import load_dashboard  # noqa: E402


def load_menus(data_root: Path) -> dict[str, object]:
    menus: list[dict[str, object]] = []
    for metadata_path in data_root.glob("**/metadata.json"):
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            LOGGER.warning("Skipping invalid metadata %s: %s", metadata_path, exc)
            continue
        if not isinstance(metadata, dict):
            continue

        article_dir = metadata_path.parent
        relative_dir = article_dir.relative_to(data_root)
        images: list[dict[str, object]] = []
        for image in metadata.get("images", []):
            if not isinstance(image, dict) or not isinstance(image.get("file"), str):
                continue
            image_path = article_dir / image["file"]
            if not image_path.is_file():
                continue
            item = dict(image)
            item["url"] = "/data/" + "/".join(
                [*relative_dir.parts, image["file"]]
            )
            images.append(item)

        menu = dict(metadata)
        menu["images"] = images
        menu["localPath"] = str(relative_dir)
        menus.append(menu)

    menus.sort(
        key=lambda item: (
            str(item.get("endDate") or ""),
            int(item.get("week") or 0),
        ),
        reverse=True,
    )
    all_images = [image for menu in menus for image in menu.get("images", [])]
    starts = [str(menu["startDate"]) for menu in menus if menu.get("startDate")]
    ends = [str(menu["endDate"]) for menu in menus if menu.get("endDate")]
    return {
        "menus": menus,
        "stats": {
            "menuCount": len(menus),
            "imageCount": len(all_images),
            "totalBytes": sum(int(image.get("bytes") or 0) for image in all_images),
            "earliestStartDate": min(starts) if starts else None,
            "latestEndDate": max(ends) if ends else None,
        },
        "sourceSite": "https://zxes.blogspot.com/",
    }


def load_news(news_path: Path) -> dict[str, object]:
    payload = json.loads(news_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        raise ValueError("News data must be an object with an items array")
    return payload


def make_handler(
    web_root: Path,
    data_root: Path,
    database_path: Path = DEFAULT_DATABASE,
    news_path: Path = DEFAULT_NEWS_DATA,
    admin_root: Path = DEFAULT_ADMIN_ROOT,
    project_root: Path = PROJECT_ROOT,
) -> type[BaseHTTPRequestHandler]:
    action_runner = AdminActionRunner(project_root)
    action_token = secrets.token_urlsafe(32)

    class LunchRequestHandler(BaseHTTPRequestHandler):
        server_version = "DemeterLunch/0.1"

        def do_GET(self) -> None:  # noqa: N802
            request = urlsplit(self.path)
            path = unquote(request.path)
            if path == "/api/admin/status":
                if not self._is_loopback_client():
                    self._send_json({"error": "Local access only"}, status=403)
                    return
                try:
                    payload = load_admin_status(project_root)
                except (OSError, ValueError) as exc:
                    LOGGER.exception("Unable to load admin status")
                    self._send_json({"error": str(exc)}, status=500)
                    return
                payload["actionToken"] = action_token
                self._send_json(payload)
                return
            if path == "/api/admin/action":
                if not self._is_loopback_client():
                    self._send_json({"error": "Local access only"}, status=403)
                    return
                self._send_json(action_runner.status())
                return
            if path == "/api/dashboard":
                query = parse_qs(request.query)
                selected_date = query.get("date", [None])[0]
                meal_type = query.get("mealType", ["meat"])[0]
                try:
                    dashboard = load_dashboard(database_path, selected_date, meal_type)
                except (OSError, ValueError) as exc:
                    LOGGER.exception("Unable to load dashboard")
                    self._send_json({"error": str(exc)}, status=500)
                    return
                self._send_json(dashboard)
                return
            if path == "/api/menus":
                self._send_json(load_menus(data_root))
                return
            if path == "/api/news":
                try:
                    payload = load_news(news_path)
                except (OSError, json.JSONDecodeError, ValueError) as exc:
                    LOGGER.exception("Unable to load news")
                    self._send_json({"error": str(exc)}, status=500)
                    return
                self._send_json(payload)
                return
            if path == "/api/health":
                self._send_bytes(
                    b'{"status":"ok"}',
                    "application/json; charset=utf-8",
                    cache_control="no-store",
                )
                return
            if path.startswith("/data/"):
                self._serve_file(data_root, path.removeprefix("/data/"), cache_images=True)
                return
            if path in {"/admin", "/admin/"}:
                if not self._is_loopback_client():
                    self.send_error(403, "Local access only")
                    return
                self._serve_file(admin_root, "index.html", cache_images=False)
                return
            if path.startswith("/admin/"):
                if not self._is_loopback_client():
                    self.send_error(403, "Local access only")
                    return
                self._serve_file(
                    admin_root,
                    path.removeprefix("/admin/"),
                    cache_images=False,
                )
                return

            relative = "index.html" if path in {"", "/"} else path.lstrip("/")
            self._serve_file(web_root, relative, cache_images=False)

        def do_POST(self) -> None:  # noqa: N802
            path = unquote(urlsplit(self.path).path)
            if path != "/api/admin/update":
                self.send_error(404, "Not found")
                return
            if not self._is_loopback_client():
                self._send_json({"error": "Local access only"}, status=403)
                return
            provided_token = self.headers.get("X-Demeter-Admin", "")
            if not secrets.compare_digest(provided_token, action_token):
                self._send_json({"error": "Invalid action token"}, status=403)
                return
            started = action_runner.start_update()
            self._send_json(action_runner.status(), status=202 if started else 409)

        def _send_json(self, payload: object, *, status: int = 200) -> None:
            data = json.dumps(
                payload, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            self._send_bytes(
                data,
                "application/json; charset=utf-8",
                cache_control="no-store",
                status=status,
            )

        def _is_loopback_client(self) -> bool:
            try:
                return ipaddress.ip_address(self.client_address[0]).is_loopback
            except ValueError:
                return False

        def _serve_file(
            self, root: Path, relative: str, *, cache_images: bool
        ) -> None:
            try:
                root_resolved = root.resolve(strict=True)
                requested = (root_resolved / relative).resolve(strict=True)
                requested.relative_to(root_resolved)
            except (OSError, ValueError):
                self.send_error(404, "Not found")
                return
            if not requested.is_file():
                self.send_error(404, "Not found")
                return
            try:
                data = requested.read_bytes()
            except OSError:
                self.send_error(500, "Unable to read file")
                return
            content_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
            cache_control = "public, max-age=3600" if cache_images else "no-cache"
            self._send_bytes(data, content_type, cache_control=cache_control)

        def _send_bytes(
            self,
            data: bytes,
            content_type: str,
            *,
            cache_control: str,
            status: int = 200,
        ) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", cache_control)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format: str, *args: object) -> None:
            LOGGER.info("%s - %s", self.address_string(), format % args)

    return LunchRequestHandler


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the local lunch menu website.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--web-root", type=Path, default=DEFAULT_WEB_ROOT)
    parser.add_argument("--admin-root", type=Path, default=DEFAULT_ADMIN_ROOT)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--news", type=Path, default=DEFAULT_NEWS_DATA)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if not args.web_root.is_dir():
        parser.error(f"Website directory does not exist: {args.web_root}")
    if not args.admin_root.is_dir():
        parser.error(f"Admin directory does not exist: {args.admin_root}")
    if not args.database.is_file():
        parser.error(
            f"Database does not exist: {args.database}. Run scripts/build_database.py first."
        )
    args.data_dir.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(
        (args.host, args.port),
        make_handler(
            args.web_root,
            args.data_dir,
            args.database,
            args.news,
            args.admin_root,
            PROJECT_ROOT,
        ),
    )
    url = f"http://{args.host}:{server.server_port}"
    print(f"Lunch website running at {url}", flush=True)
    print(f"Local admin dashboard at {url}/admin/", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
