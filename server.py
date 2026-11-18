"""Toi Line: сервер. Только стандартная библиотека Python 3.10+.

Запуск: ADMIN_KEY=придумайте PORT=8000 DATA_DIR=./data python server.py
Вся логика в toi.py, здесь только HTTP: чтение тела, ответы, адрес посетителя.
"""
import ipaddress
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import toi

PORT = int(os.environ.get("PORT", "8000"))
MAX_BODY = 12 * 1024 * 1024  # селфи и заставка приходят base64 в JSON

# Адрес посетителя: X-Forwarded-For дописывают по дороге Cloudflare и Railway, начало строки пишет сам браузер.
# Идём справа налево и пропускаем адреса прокси: первый оставшийся — настоящее устройство.
CF_NETS = [ipaddress.ip_network(n) for n in (  # https://www.cloudflare.com/ips/
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
    "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22", "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32",
    "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32")]


def proxy_hop(a):
    try:
        x = ipaddress.ip_address(a)
    except ValueError:
        return False
    return x.is_private or x.is_loopback or x.is_link_local or any(x in n for n in CF_NETS)


def real_ip(xff, peer):
    for a in reversed([p.strip() for p in (xff or "").split(",") if p.strip()]):
        if not proxy_hop(a):
            return a
    return peer


class H(BaseHTTPRequestHandler):
    server_version = "ToiOnline"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):
        sys.stdout.write("%s %s\n" % (self.command, self.path.split("?")[0]))
        sys.stdout.flush()

    # --- то, чем пользуется toi.py
    def ip(self):
        return real_ip(self.headers.get("X-Forwarded-For"), self.client_address[0])

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("too big")
        self._read = True
        return self.rfile.read(n) if n else b""

    def json_body(self):
        try:
            return json.loads(self.body() or b"{}")
        except ValueError:
            return None

    def drain(self):
        """Ответили, не прочитав тело: дочитываем, иначе остаток испортит следующий запрос в том же соединении."""
        if self.command != "POST" or getattr(self, "_read", True):
            return
        self._read = True
        n = int(self.headers.get("Content-Length") or 0)
        if 0 < n <= MAX_BODY:
            self.rfile.read(n)
        elif n > MAX_BODY:
            self.close_connection = True

    def sec(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")

    def send_bytes(self, code, data, ctype, extra=None):
        self.drain()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.sec()
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def send_json(self, code, obj, headers=None):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_bytes(code, b, "application/json; charset=utf-8", {"Cache-Control": "no-store", **(headers or {})})

    def err(self, code, msg):
        self.send_json(code, {"error": msg})

    # --- маршруты
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self.send_json(200, {"ok": True})
        if path == "/toionline" or path.startswith("/toionline/"):  # старые ссылки с postik.link/toionline
            new = path[len("/toionline"):] or "/"
            self.send_response(301)
            self.send_header("Location", new + (("?" + self.path.split("?", 1)[1]) if "?" in self.path else ""))
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        return toi.handle_get(self, path)

    def do_HEAD(self):
        return self.do_GET()

    def do_POST(self):
        self._read = False
        if int(self.headers.get("Content-Length") or 0) > MAX_BODY:
            self.close_connection = True
            return self.err(413, "Слишком большой файл")
        return toi.handle_post(self, urlparse(self.path).path)


def main():
    toi.db()  # база и демо-той создаются при старте
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    srv.daemon_threads = True
    print(f"Toi Line запущен на порту {PORT}", flush=True)
    if not toi.admin_key():
        print("ВНИМАНИЕ: ADMIN_KEY не задан, админка отключена.", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
