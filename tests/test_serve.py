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

    def request(self, method: str, path: str) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port)
        try:
            connection.request(method, path)
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

    def test_bound_to_loopback_only(self) -> None:
        self.assertEqual(self.httpd.server_address[0], "127.0.0.1")


if __name__ == "__main__":
    unittest.main()
