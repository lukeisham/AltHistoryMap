"""Read-only static server for AltHistoryMap: serves the app/ folder to 127.0.0.1 and nothing else.

The app is a static site and writes nothing, so every verb except GET and HEAD is refused.
`Start AltHistoryMap.command` and the Home launcher both run this file.
"""

import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / "app"

HOST = "127.0.0.1"
PORT = 8801

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".bin": "application/octet-stream",
    ".ahmap": "application/octet-stream",
}
FALLBACK_TYPE = "application/octet-stream"


def send_failure(handler: BaseHTTPRequestHandler, status: int, message: str) -> None:
    body = message.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "text/plain; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    if status == 405:
        handler.send_header("Allow", "GET, HEAD")
    handler.end_headers()
    if handler.command != "HEAD":
        handler.wfile.write(body)


def resolve_within(app_dir: Path, url_path: str) -> Path | None:
    """The file a URL path names, or None if it escapes app_dir. Resolving before comparing
    catches `..` and symlinks that a string-prefix check would miss."""
    if "\0" in url_path:
        return None
    target = (app_dir / (url_path.lstrip("/") or "index.html")).resolve()
    root = app_dir.resolve()
    return target if root in target.parents else None


class Handler(BaseHTTPRequestHandler):
    server_version = "AltHistoryMap/1"

    def _serve(self) -> None:
        url_path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        target = resolve_within(self.server.app_dir, url_path)  # type: ignore[attr-defined]
        if target is None:
            return send_failure(self, 403, "forbidden")
        if not target.is_file():
            return send_failure(self, 404, "not found")
        try:
            body = target.read_bytes()
        except OSError as exc:
            print(f"[serve] cannot read {target}: {exc}", file=sys.stderr)
            return send_failure(self, 500, "internal error")
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(target.suffix.lower(), FALLBACK_TYPE))
        self.send_header("Content-Length", str(len(body)))
        # The files are rebuilt in place, so a stale cached map must never be served.
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _refuse(self) -> None:
        send_failure(self, 405, "method not allowed")

    do_GET = do_HEAD = _serve  # noqa: N815
    do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = _refuse  # noqa: N815

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 — stdlib signature
        pass


class Server(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], app_dir: Path) -> None:
        self.app_dir = app_dir
        super().__init__(address, Handler)


def create_httpd(host: str = HOST, port: int = PORT, app_dir: Path = APP_DIR) -> Server:
    return Server((host, port), app_dir)


def run() -> None:
    # A collision exits non-zero instead of choosing another port, so a launcher never opens the wrong instance.
    try:
        httpd = create_httpd()
    except OSError as exc:
        sys.exit(f"[serve] could not bind {HOST}:{PORT}: {exc}")
    with httpd:
        print(f"AltHistoryMap -> http://{HOST}:{PORT}")
        print("Ctrl-C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    run()
