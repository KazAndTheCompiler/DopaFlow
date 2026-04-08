#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        requested_path = self.translate_path(self.path)
        if self.path.startswith("/assets/") or self.path.startswith("/fonts/") or os.path.exists(requested_path):
            return super().do_GET()
        self.path = "/index.html"
        return super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--dir", required=True)
    args = parser.parse_args()

    server = ThreadingHTTPServer(
        (args.host, args.port),
        lambda *inner_args, **inner_kwargs: SpaHandler(*inner_args, directory=args.dir, **inner_kwargs),
    )
    print(f"Serving DopaFlow release at http://{args.host}:{args.port} from {args.dir}")
    server.serve_forever()


if __name__ == "__main__":
    main()
