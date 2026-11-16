"""Проверка Toi Online на живом сервере :
ADMIN_KEY=test PORT=8123 python server.py
BASE=http://127.0.0.1:8123 ADMIN_KEY=test python test_toi.py
"""
import base64
import json
import os
import socket
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

BASE = os.environ.get("BASE", "http://127.0.0.1:8123")
KEY = os.environ.get("ADMIN_KEY", "test")
# самый маленький настоящий JPEG (1×1)
JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////"
    "2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAAB"
    "AAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMR"
    "AD8AH//Z")
PHOTO = "data:image/jpeg;base64," + base64.b64encode(JPEG).decode()


def req(path, body=None, headers=None, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json", **(headers or {})} if data else (headers or {})
    r = urllib.request.Request(BASE + path, data=data, headers=h, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            b = resp.read()
            return resp.status, (b if raw else json.loads(b or b"{}"))
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            return e.code, json.loads(b)
        except ValueError:
            return e.code, b


class SSE:
    """Слушаем поток в отдельном потоке и копим события."""
    def __init__(self, path):
        self.events = []
        u = urlparse(BASE)
        self.s = socket.create_connection((u.hostname, u.port or 80), timeout=30)
        self.s.sendall(f"GET {path} HTTP/1.1\r\nHost: {u.hostname}\r\nAccept: text/event-stream\r\n\r\n".encode())
        threading.Thread(target=self.run, daemon=True).start()

    def run(self):
        buf = b""
        try:
            while True:
                chunk = self.s.recv(4096)
                if not chunk:
                    return
                buf += chunk
                while b"\n\n" in buf:
                    block, buf = buf.split(b"\n\n", 1)
                    kind, data = None, None
                    for line in block.decode(errors="replace").splitlines():
                        if line.startswith("event: "):
                            kind = line[7:]
                        elif line.startswith("data: "):
                            data = line[6:]
                    if kind:
                        self.events.append((kind, json.loads(data) if data else None))
        except OSError:
            return

    def wait(self, kind, pred=lambda d: True, t=5):
        end = time.time() + t
        while time.time() < end:
            for k, d in self.events:
                if k == kind and pred(d):
                    return d
            time.sleep(0.05)
        raise AssertionError(f"нет события {kind}, есть {[k for k, _ in self.events]}")

    def close(self):
        self.s.close()


def ok(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ✓", msg)


def main():
    print("Toi Online")
    code, _ = req("/", raw=True)
    ok(code == 200, "страница админки открывается")
    code, j = req("/api/admin/events")
    ok(code == 401, "без ключа список мероприятий закрыт")
    code, j = req("/api/admin/events", {"type": "wedding", "names": "Диас & Диара", "date": "21 · 11 · 2026",
                                                  "tpl": "pink", "kaspi_phone": "+7 701 000 00 00", "kaspi_name": "Диас Е.",
                                                  "moderation": True, "bg1": "javascript:", "hack": 1}, {"X-Toi-Admin": KEY})
    ok(code == 200 and j["id"], "мероприятие создано")
    eid, L = j["id"], j["links"]
    ok(all(k in L for k in ("guest", "mod", "led", "album")), "у мероприятия три ссылки и альбом")
    mod = "/api" + L["mod"]
    led = "/api" + L["led"]
    for p in (L["guest"], L["mod"], L["led"], L["album"], "/static/common.js", "/static/qrcode.js", "/sw.js"):
        code, _ = req(p, raw=True)
        ok(code == 200, f"открывается {p.split('/')[2] if p.count('/') > 2 else p}")

    code, j = req(f"/api/e/{eid}")
    ok(code == 200 and j["cfg"]["names"] == "Диас & Диара", "гость получает настройки праздника")
    ok("bg1" not in j["cfg"] or j["cfg"]["bg1"].startswith("#"), "мусор в цветах отброшен")
    ok("hack" not in j["cfg"] and "mod_key" not in json.dumps(j), "лишние поля и ключи не видны гостю")
    code, _ = req(led.replace(L["led"].split("/")[-1], "wrongkey00") + "/state")
    ok(code == 404, "чужой ключ экрана не подходит")
    code, _ = req(mod.replace(L["mod"].split("/")[-1], "wrongkey00") + "/state")
    ok(code == 404, "чужой ключ пульта не подходит")

    s_mod = SSE(mod + "/stream")
    s_led = SSE(led + "/stream")
    s_mod.wait("hello")
    s_led.wait("hello")
    code, j = req(mod + "/state")
    ok(code == 200 and j["online"]["led"] >= 1, "пульт видит, что экран на связи")

    # обычная открытка с фото → ждёт модератора
    code, g1 = req(f"/api/e/{eid}/card", {"name": "Ерлан ағай", "msg": "Бақытты болыңдар!", "table": "7", "frame": "soft", "photo": PHOTO})
    ok(code == 200 and g1["status"] == "pending", "открытка гостя ждёт модератора")
    c = s_mod.wait("card", lambda d: d["id"] == g1["id"])
    ok(c["photo"].endswith(".jpg") and c["table"] == "7", "пульт сразу получил открытку с фото")
    code, raw = req(c["photo"], raw=True)
    ok(code == 200 and raw[:3] == b"\xff\xd8\xff", "фото открытки отдаётся")
    time.sleep(0.2)
    ok(not any(k == "card" for k, _ in s_led.events), "экран не видит непроверенную открытку")

    # конверт
    code, g2 = req(f"/api/e/{eid}/card", {"name": "Жанар", "msg": "Будь самой счастливой!", "amount": 10000})
    ok(code == 200 and g2["status"] == "pending", "конверт ждёт подтверждения перевода")
    code, j = req(f"/api/e/{eid}/card", {"name": "Жадный", "msg": "x", "amount": 100})
    ok(code == 400, "конверт меньше 500 ₸ не принимается")
    code, j = req(f"/api/e/{eid}/card", {"name": "", "msg": "x"})
    ok(code == 400, "без имени не принимается")
    code, j = req(f"/api/e/{eid}/card", {"name": "А", "msg": "x", "photo": "data:image/png;base64,AAAA"})
    ok(code == 400, "не-JPEG фото не принимается")

    # модератор: в эфир
    code, j = req(mod + "/act", {"id": g1["id"], "action": "approve"})
    ok(code == 200 and j["card"]["status"] == "approved", "модератор отправил открытку в эфир")
    d = s_led.wait("card", lambda d: d["id"] == g1["id"])
    ok(d["status"] == "approved" and "paid" not in d, "экран получил открытку в реальном времени")
    code, j = req(mod + "/act", {"id": g2["id"], "action": "approve"})
    ok(j["card"]["paid"] is True, "подтверждённый конверт отмечен оплаченным")
    s_led.wait("card", lambda d: d["id"] == g2["id"] and d["amount"] == 10000)

    code, j = req(f"/api/e/{eid}/card/{g1['id']}?token={g1['token']}")
    ok(code == 200 and j["status"] == "approved", "гость видит, что открытка в очереди")
    code, j = req(f"/api/e/{eid}/card/{g1['id']}?token=bad")
    ok(code == 404, "чужой статус не подсмотреть")

    code, j = req(led + "/state")
    ok(code == 200 and len(j["cards"]) == 2, "экран после перезагрузки получает всю очередь")

    # экран показал
    code, j = req(led + "/shown", {"ids": [g2["id"], g1["id"]]})
    ok(code == 200 and sorted(j["ok"]) == sorted([g1["id"], g2["id"]]), "экран отметил показанные")
    s_mod.wait("card", lambda d: d["id"] == g1["id"] and d["status"] == "shown")
    code, j = req(f"/api/a/{eid}")
    ok(code == 200 and len(j["cards"]) == 2, "показанные открытки попали в альбом")

    # ещё раз и скрыть
    req(mod + "/act", {"id": g1["id"], "action": "requeue"})
    s_led.wait("card", lambda d: d["id"] == g1["id"] and d["status"] == "approved" and not d["shown_at"])
    ok(True, "«Показать ещё раз» возвращает открытку на экран")
    req(mod + "/act", {"id": g1["id"], "action": "hide"})
    s_led.wait("card", lambda d: d["id"] == g1["id"] and d["status"] == "hidden")
    code, j = req(f"/api/a/{eid}")
    ok(len(j["cards"]) == 1, "скрытая открытка ушла из альбома")

    # настройки экрана
    code, j = req(mod + "/cfg", {"names": "Диас & Диара ♥", "tpl": "green", "moderation": False, "font": "<script>"})
    ok(code == 200 and j["cfg"]["names"] == "Диас & Диара ♥" and j["cfg"]["tpl"] == "green", "настройки сохранились")
    s_led.wait("config", lambda d: d["tpl"] == "green")
    ok(True, "экран получил новые настройки сразу")
    code, j = req(mod + "/cfg", {"splash": PHOTO})
    ok(code == 200 and j["cfg"]["splash_url"].endswith(".jpg"), "заставка загружена")
    code, g3 = req(f"/api/e/{eid}/card", {"name": "Сауле", "msg": "Любви!"})
    ok(g3["status"] == "approved", "без проверки открытка сразу идёт на экран")
    s_led.wait("card", lambda d: d["id"] == g3["id"])

    code, j = req(mod + "/state")
    ok(code == 200 and len(j["cards"]) == 3 and j["links"]["led"] == L["led"], "пульт видит все открытки и ссылки")

    code, j = req("/api/admin/events", headers={"X-Toi-Admin": KEY})
    ok(any(e["id"] == eid and e["sum"] == 10000 for e in j["events"]), "в списке мероприятий видна сумма конвертов")
    code, _ = req(f"/api/admin/events/{eid}/delete", {}, {"X-Toi-Admin": KEY})
    code, _ = req(f"/api/e/{eid}")
    ok(code == 404, "удалённое мероприятие закрыто")
    s_mod.close()
    s_led.close()
    print("Toi Online: всё хорошо")


if __name__ == "__main__":
    main()
