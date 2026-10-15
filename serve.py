"""Read-only static server for AltHistoryMap: serves the app/ folder to 127.0.0.1 and nothing else.

    python3 serve.py                 run it; in a terminal it also opens your browser
    python3 serve.py --port 9000     use another port
    python3 serve.py --no-browser    do not open a browser

The app is a static site and writes nothing, so every verb except GET and HEAD is refused. Requests
whose Host header is not this machine are refused (a web page cannot reach the server through a rebound
DNS name), and every response carries a Content-Security-Policy that lets the page load only its own files.
Run without a terminal (a launcher or supervisor) it opens no browser and keeps the exact port.
Needs only Python 3.8 or newer.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import threading
import urllib.parse
import webbrowser
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

LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
PORT_TRIES = 10
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; "
        "connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
}


def send_failure(handler: BaseHTTPRequestHandler, status: int, message: str) -> None:
    body = message.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "text/plain; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    for name, value in SECURITY_HEADERS.items():
        handler.send_header(name, value)
    if status == 405:
        handler.send_header("Allow", "GET, HEAD")
    handler.end_headers()
    if handler.command != "HEAD":
        handler.wfile.write(body)


def host_is_local(host_header: str | None) -> bool:
    """Whether a Host header names this machine. A missing header (HTTP/1.0) passes."""
    if not host_header:
        return True
    try:
        return urllib.parse.urlsplit("//" + host_header).hostname in LOCAL_HOSTS
    except ValueError:
        return False


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
        if not host_is_local(self.headers.get("Host")):
            return send_failure(self, 403, "forbidden")
        url_path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        target = resolve_within(self.server.app_dir, url_path)  # type: ignore[attr-defined]
        if target is None:
            return send_failure(self, 403, "forbidden")
        if not target.is_file():
            return send_failure(self, 404, "not found")
        try:
            info = target.stat()
            body = target.read_bytes()
        except OSError as exc:
            print(f"[serve] cannot read {target}: {exc}", file=sys.stderr)
            return send_failure(self, 500, "internal error")
        etag = '"' + hashlib.sha1(f"{info.st_mtime_ns}:{info.st_size}".encode()).hexdigest()[:20] + '"'
        status = 304 if self.headers.get("If-None-Match") == etag else 200
        self.send_response(status)
        self.send_header("Content-Type", CONTENT_TYPES.get(target.suffix.lower(), FALLBACK_TYPE))
        self.send_header("Content-Length", "0" if status == 304 else str(len(body)))
        # The files are rebuilt in place: the browser asks every time, and the ETag makes an unchanged file a 304.
        self.send_header("Cache-Control", "no-cache")
        self.send_header("ETag", etag)
        for name, value in SECURITY_HEADERS.items():
            self.send_header(name, value)
        self.end_headers()
        if status == 304:
            return
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


def bind(port: int, interactive: bool) -> Server:
    """Binds the port. Interactive runs step up to the next free port; a launcher run keeps the exact port,
    so the launcher never opens the wrong instance."""
    last: OSError | None = None
    for candidate in range(port, port + (PORT_TRIES if interactive else 1)):
        try:
            return create_httpd(port=candidate)
        except OSError as exc:
            last = exc
    sys.exit(f"[serve] could not bind {HOST}:{port}: {last}")


def run(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Serve AltHistoryMap on this computer only.")
    parser.add_argument("--port", type=int, default=PORT, help=f"port to listen on (default {PORT})")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    args = parser.parse_args(argv)
    interactive = sys.stdin.isatty() and sys.stdout.isatty()
    httpd = bind(args.port, interactive)
    url = f"http://{HOST}:{httpd.server_address[1]}"
    with httpd:
        print(f"AltHistoryMap -> {url}")
        print("Press Ctrl-C (or close this window) to stop.")
        if interactive and not args.no_browser:
            threading.Timer(0.3, webbrowser.open, (url,)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    run()
