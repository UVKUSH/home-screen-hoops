#!/usr/bin/env python3
"""
Local dev server that never caches.

python -m http.server sends no Cache-Control, so browsers apply heuristic
freshness and happily reuse an ES module you edited seconds ago — you reload,
see no change, and go hunting for a bug that isn't there. This sends no-store
on everything instead.

    python3 tools/serve.py [port]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass          # the request spam isn't useful here


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(("", port), partial(NoCacheHandler, directory="."))
    print(f"serving http://localhost:{port}  (no-cache)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
