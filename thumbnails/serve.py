#!/usr/bin/env python3
"""Local preview/download server for the spreadsheet thumbnail gallery."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

ROOT = Path(__file__).parent.resolve()
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8001


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        name = Path(path).name
        if name and name != "index.html" and "." in name:
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(f"{self.address_string()} {fmt % args}\n")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"serving thumbnail gallery from {ROOT} on 0.0.0.0:{PORT}", flush=True)
    server.serve_forever()
