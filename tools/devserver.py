"""Static dev server for the design system.

Three things the stock `python -m http.server` gets wrong for this job:

1. It caches. It sends Last-Modified, so a browser happily reuses a stale
   tokens.css after you edit it — which looks exactly like a CSS bug and
   costs a debugging cycle. We send no-store on everything.

2. It is single-threaded. One held keep-alive connection (the Claude preview
   pane, say) blocks every other client, including your Chrome tab.
   ThreadingHTTPServer fixes that.

3. It binds IPv4 only. On Windows `localhost` resolves to ::1 first, so a
   browser gets connection-refused even though the server is "running".
   We bind a dual-stack IPv6 socket that accepts both.

    python tools/devserver.py [port] [root]
"""
import http.server
import os
import socket
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        # Python sends text/html with no charset, so a browser falls back to
        # its locale default and UTF-8 content renders as mojibake.
        base = super().guess_type(path)

        # Markdown is served as text/markdown, which browsers download rather
        # than display. In a dev server we want to read it, not save it.
        if base == "text/markdown" or path.endswith(".md"):
            return "text/plain; charset=utf-8"

        textual = base.startswith("text/") or base in (
            "application/javascript", "application/json", "image/svg+xml",
        )
        return base + "; charset=utf-8" if textual else base

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))
        sys.stderr.flush()


class DualStackServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    address_family = socket.AF_INET6

    def server_bind(self):
        # Accept IPv4-mapped addresses too, so 127.0.0.1 and ::1 both work.
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        return super().server_bind()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    root = sys.argv[2] if len(sys.argv) > 2 else "."
    os.chdir(root)

    try:
        server = DualStackServer(("::", port), NoCacheHandler)
    except OSError:
        # No IPv6 on this box — fall back to IPv4 on all interfaces.
        DualStackServer.address_family = socket.AF_INET
        server = DualStackServer(("0.0.0.0", port), NoCacheHandler)

    print("serving %s" % os.getcwd(), flush=True)
    print("  http://localhost:%d/website/                 (the website)" % port, flush=True)
    print("  http://localhost:%d/design-system/previews/  (the design system)" % port, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
