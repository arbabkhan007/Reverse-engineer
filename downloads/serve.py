#!/usr/bin/env python3
"""
Static file server that forces downloads instead of inline rendering.

Python's default http.server serves .md as text/markdown, which many browsers
render inline rather than downloading. This adds Content-Disposition: attachment
for every file and correct Content-Types.

Run from the directory to serve:  python3 serve.py [port]
"""
import sys
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(__file__).parent.resolve()

TYPES = {
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".zip": "application/zip",
    ".py": "text/plain; charset=utf-8",
    ".html": "text/html; charset=utf-8",
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def guess_type(self, path):
        return TYPES.get(Path(path).suffix.lower(), "application/octet-stream")

    def end_headers(self):
        # index.html (and the directory root) should render; everything else downloads
        name = Path(self.path.split("?")[0]).name
        if name and not name.endswith(".html"):
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(f"{self.address_string()} {fmt % args}\n")


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"serving {ROOT} on 0.0.0.0:{PORT}", flush=True)
    srv.serve_forever()
