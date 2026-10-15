"""Smoke and gate tests for serve.py: a real server on an ephemeral port over a temp folder."""

import http.client
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import serve  # noqa: E402


class ServeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        outer = Path(self.tmp.name)
        (outer / "secret.txt").write_text("outside the app folder")
        app = outer / "app"
        (app / "data").mkdir(parents=True)
        (app / "index.html").write_text("<p>home</p>")
        (app / "data" / "map.ahmap").write_bytes(b"\x00\x01")
        self.httpd = serve.create_httpd(port=0, app_dir=app)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def request(self, method: str, path: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_permitted_get_passes_with_type_and_no_cache(self) -> None:
        status, headers, body = self.request("GET", "/")
        self.assertEqual((status, body), (200, b"<p>home</p>"))
        self.assertTrue(headers["Content-Type"].startswith("text/html"))
        self.assertEqual(headers["Cache-Control"], "no-cache")
        self.assertEqual(self.request("GET", "/data/map.ahmap")[1]["Content-Type"], "application/octet-stream")
        status, headers, body = self.request("HEAD", "/")
        self.assertEqual((status, body, headers["Content-Length"]), (200, b"", "11"))

    def test_every_write_verb_is_refused(self) -> None:
        for method in ("POST", "PUT", "DELETE", "PATCH"):
            status, headers, _ = self.request(method, "/index.html")
            self.assertEqual(status, 405, method)
            self.assertEqual(headers["Allow"], "GET, HEAD")

    def test_traversal_and_listing_are_blocked(self) -> None:
        self.assertEqual(self.request("GET", "/../secret.txt")[0], 403)
        self.assertEqual(self.request("GET", "/%2e%2e/secret.txt")[0], 403)
        self.assertEqual(self.request("GET", "/data/")[0], 404)
        self.assertEqual(self.request("GET", "/missing.js")[0], 404)

    def test_every_response_carries_the_security_headers(self) -> None:
        for path in ("/", "/missing.js", "/../secret.txt"):
            headers = self.request("GET", path)[1]
            self.assertIn("script-src 'self'", headers["Content-Security-Policy"], path)
            self.assertNotIn("unsafe-inline", headers["Content-Security-Policy"], path)
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff", path)

    def test_unchanged_file_is_a_304(self) -> None:
        etag = self.request("GET", "/")[1]["ETag"]
        status, _, body = self.request("GET", "/", {"If-None-Match": etag})
        self.assertEqual((status, body), (304, b""))
        self.assertEqual(self.request("GET", "/", {"If-None-Match": '"other"'})[0], 200)

    def test_foreign_host_header_is_refused(self) -> None:
        self.assertEqual(self.request("GET", "/", {"Host": "evil.example"})[0], 403)
        self.assertEqual(self.request("GET", "/", {"Host": "evil.example:8801"})[0], 403)
        for host in ("127.0.0.1", "localhost:8801", "[::1]:8801"):
            self.assertEqual(self.request("GET", "/", {"Host": host})[0], 200, host)

    def test_launcher_run_keeps_its_port_and_interactive_run_steps_up(self) -> None:
        taken = self.port
        with self.assertRaises(SystemExit):
            serve.bind(taken, interactive=False)
        other = serve.bind(taken, interactive=True)
        try:
            self.assertGreater(other.server_address[1], taken)
        finally:
            other.server_close()

    def test_bound_to_loopback_only(self) -> None:
        self.assertEqual(self.httpd.server_address[0], "127.0.0.1")


if __name__ == "__main__":
    unittest.main()
