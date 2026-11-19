"""Проверка Toi Line на живом сервере :
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


def dev(path="/g/demo"):
    """Cookie устройства так же, как её получает браузер гостя."""
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE + path), timeout=10) as r:
            for v in r.headers.get_all("Set-Cookie") or []:
                if v.startswith("toi_dev="):
                    return v.split(";")[0]
    except urllib.error.HTTPError:
        pass
    return ""


def org_cookie(login, password):
    """Вход организатора: возвращает cookie toi_org=… или пустую строку."""
    r = urllib.request.Request(BASE + "/api/o/login", data=json.dumps({"login": login, "password": password}).encode(),
                               headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            for v in resp.headers.get_all("Set-Cookie") or []:
                if v.startswith("toi_org="):
                    return v.split(";")[0]
    except urllib.error.HTTPError:
        pass
    return ""


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
    print("Toi Line")
    code, _ = req("/", raw=True)
    ok(code == 200, "страница админки открывается")
    code, j = req("/api/admin/events")
    ok(code == 401, "без ключа список мероприятий закрыт")
    code, j = req("/api/admin/events", {"type": "wedding", "names": "Диас & Диара", "date": "21 · 11 · 2026",
                                                  "tpl": "arch", "kaspi_phone": "+7 701 000 00 00", "kaspi_name": "Диас Е.",
                                                  "moderation": True, "bg1": "javascript:", "hack": 1}, {"X-Toi-Admin": KEY})
    ok(code == 200 and j["id"], "мероприятие создано")
    eid, L = j["id"], j["links"]
    ok(all(k in L for k in ("guest", "mod", "led", "album")), "у мероприятия три ссылки и альбом")
    cA, cB, cC = dev(f"/g/{eid}"), dev(f"/g/{eid}"), dev(f"/g/{eid}")
    mod = "/api" + L["mod"]
    led = "/api" + L["led"]
    for p in (L["guest"], L["mod"], L["led"], L["album"], "/static/common.js", "/static/qrcode.js", "/static/toi.css", "/static/img/frame-altyn-h.png", "/static/fonts/toi-comforter.ttf", "/sw.js"):
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
    code, g1 = req(f"/api/e/{eid}/card", {"name": "Ерлан ағай", "msg": "Бақытты болыңдар!", "table": "7", "frame": "kara", "photo": PHOTO},
                   {"Cookie": cA})
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
    code, j = req(f"/api/e/{eid}/card", {"name": "А", "msg": "x", "photo": "data:image/png;base64,AAAA"}, {"Cookie": cB})
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
    code, j = req(mod + "/cfg", {"names": "Диас & Диара ♥", "tpl": "oval", "palette": "night", "moderation": False, "nfont": "<script>"})
    ok(code == 200 and j["cfg"]["names"] == "Диас & Диара ♥" and j["cfg"]["tpl"] == "oval" and j["cfg"]["palette"] == "night" and j["cfg"]["nfont"] == "corm", "настройки сохранились")
    s_led.wait("config", lambda d: d["tpl"] == "oval")
    ok(True, "экран получил новые настройки сразу")
    code, j = req(mod + "/cfg", {"film": "vhs", "fx_sheen": False})
    ok(code == 200 and j["cfg"]["film"] == "vhs" and j["cfg"]["fx_sheen"] is False, "фильтр фото и эффекты сохраняются")
    code, j = req(mod + "/cfg", {"card": "landscape"})
    ok(code == 200 and j["cfg"]["card"] == "landscape", "формат карточки сохраняется")
    code, j = req(mod + "/cfg", {"card": "что-то"})
    ok(code == 200 and j["cfg"]["card"] == "landscape", "неизвестный формат отбрасывается")
    code, j = req(mod + "/cfg", {"tpl": "мусор", "palette": "мусор", "film": "мусор"})
    ok(code == 200 and j["cfg"]["tpl"] == "oval" and j["cfg"]["palette"] == "night" and j["cfg"]["film"] == "vhs", "неизвестный шаблон и палитра не ломают настройки")
    code, j = req(mod + "/cfg", {"splash": PHOTO})
    ok(code == 200 and j["cfg"]["splash_url"].endswith(".jpg"), "заставка загружена")
    code, j = req(mod + "/cfg", {"couple": PHOTO})
    ok(code == 200 and j["cfg"]["couple_url"].endswith(".jpg"), "фото пары загружено")
    code, g3 = req(f"/api/e/{eid}/card", {"name": "Сауле", "msg": "Любви!"}, {"Cookie": cC})
    ok(g3["status"] == "approved", "без проверки открытка сразу идёт на экран")
    s_led.wait("card", lambda d: d["id"] == g3["id"])

    code, j = req(mod + "/state")
    ok(code == 200 and len(j["cards"]) == 3 and j["links"]["led"] == L["led"], "пульт видит все открытки и ссылки")

    # бесплатное поздравление — одно с устройства в полчаса, конверты без ограничений (проверяем на демо-тое)
    d1, d2 = dev("/g/demo"), dev("/g/demo")
    code, j = req("/api/e/demo/card", {"name": "Айгуль", "msg": "Бақытты болсын!"}, {"Cookie": d1})
    ok(code == 200, "с нового устройства бесплатное проходит")
    code, j = req("/api/e/demo/card", {"name": "Айгуль", "msg": "Ещё раз!"}, {"Cookie": d1})
    ok(code == 429 and j.get("retry", 0) > 1700, "второе бесплатное с того же устройства отклоняется")
    code, j = req("/api/e/demo/card", {"name": "Айгуль", "msg": "Конверт!", "amount": 5000}, {"Cookie": d1})
    ok(code == 200, "конверт с того же устройства проходит сразу")
    code, j = req("/api/e/demo/card", {"name": "Ерлан", "msg": "Құтты болсын!"}, {"Cookie": d2})
    ok(code == 200, "другое устройство не заблокировано")

    code, j = req("/api/admin/events", headers={"X-Toi-Admin": KEY})
    ok(any(e["id"] == eid and e["sum"] == 10000 for e in j["events"]), "в списке мероприятий видна сумма конвертов")

    # кабинет организатора (ТЗ 0.8): вход по логину и паролю, без модерации и без ссылок тамады
    org = next(e["org"] for e in j["events"] if e["id"] == eid)
    ok(org["login"] == eid and len(org["password"]) == 8, "в админке есть логин и пароль организатора")
    code, _ = req("/api/o/state")
    ok(code == 401, "без входа кабинет организатора закрыт")
    code, _ = req("/api/o/login", {"login": eid, "password": "неверный"})
    ok(code == 401, "неверный пароль не пускает")
    code, _ = req("/api/o/login", {"login": "demo", "password": ""})
    ok(code == 401, "в демо-той организатором не войти")
    oc = org_cookie(eid, org["password"])
    ok(oc.startswith("toi_org="), "верный пароль даёт вход")
    code, j = req("/api/o/state", headers={"Cookie": oc})
    ok(code == 200 and set(j["links"]) == {"guest", "album"}, "организатор не видит ссылок пульта и экрана")
    ok(j["totals"]["count"] == 1 and j["totals"]["sum"] == 10000 and j["totals"]["fee"] == 1000
       and j["totals"]["due"] == 1000 - j["totals"]["deposit"], "конверты и итог одной строкой")
    before = req(mod + "/state")[1]["cfg"]
    code, j = req("/api/o/cfg", {"names": "Әділхан & Гүлбаршын", "place": "Grand Ballroom", "time": "18:00",
                                 "gis": "javascript:alert(1)", "moderation": not before["moderation"], "pct": 0,
                                 "inv": {"tpl": "oval", "lang": "ru", "palette": "bad", "text": "Дорогие гости"}},
                  {"Cookie": oc})
    c = j["cfg"]
    ok(code == 200 and c["names"] == "Әділхан & Гүлбаршын" and c["place"] == "Grand Ballroom" and c["gis"] == "",
       "организатор меняет данные праздника, плохая ссылка не сохраняется")
    ok(c["moderation"] == before["moderation"] and c["pct"] == before["pct"], "модерацию и процент организатор поменять не может")
    ok(c["inv"] == {"tpl": "oval", "lang": "ru", "palette": "", "text": "Дорогие гости"}, "настройки приглашения сохраняются")
    code, _ = req(f"/api/admin/events/{eid}/password", {}, {"X-Toi-Admin": KEY})
    code, _ = req("/api/o/state", headers={"Cookie": oc})
    ok(code == 401, "после нового пароля старый вход не работает")
    code, page = req("/o", raw=True)
    ok(code == 200 and "Кабинет организатора".encode() in page, "страница кабинета организатора открывается")

    code, _ = req(f"/api/admin/events/{eid}/delete", {}, {"X-Toi-Admin": KEY})
    code, _ = req(f"/api/e/{eid}")
    ok(code == 404, "удалённое мероприятие закрыто")
    s_mod.close()
    s_led.close()
    print("Toi Line: всё хорошо")


if __name__ == "__main__":
    main()
