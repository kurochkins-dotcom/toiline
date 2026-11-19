"""Toi Line: живой LED-экран для тоя (Антон 16.11.2026). Самостоятельный сервис (раньше жил внутри Постика).

На каждое мероприятие три ссылки:
  /g/<id>              гость (QR на столе и на экране)
  /m/<id>/<ключ>       пульт тамады (модерация, эфир, оформление экрана)
  /s/<id>/<ключ>       LED-экран (оператор открывает в Chrome и жмёт F11)
плюс альбом /a/<id> после тоя и кабинет организатора /o (вход по логину = номер мероприятия и паролю,
модерации там нет: организатор со стороны семьи видит праздник, приглашение, конверты и итог).

Связь в реальном времени: Server-Sent Events (веб-сокетов в стандартной библиотеке нет, а SSE хватает:
команды идут от сервера к экрану и пульту, обратно обычные POST). Деньги через нас не идут: гость переводит
на Kaspi организатора, модератор сверяет и подтверждает. База своя (toi.db) в DATA_DIR, фото там же.
"""
import base64
import hmac
import json
import os
import queue
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlparse, parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE, "data"))
TOI_DIR = os.path.join(DATA_DIR, "toi")
DB_PATH = os.path.join(DATA_DIR, "toi.db")


def admin_key():
    return (os.environ.get("TOI_ADMIN_KEY") or os.environ.get("ADMIN_KEY") or "").strip()


PHOTO_MAX = 3 * 1024 * 1024       # селфи после сжатия в браузере весит 100–300 КБ
SPLASH_MAX = 6 * 1024 * 1024
MIN_ENV = 500                     # минимальный конверт, ₸
MAX_ENV = 5_000_000
GUEST_LIMIT = (60, 600)           # против ботов: 60 открыток с одного адреса за 10 минут (гостя сдерживает FREE_EVERY)
FREE_EVERY = 30 * 60              # бесплатное поздравление с одного устройства — раз в 30 минут
ORG_COOKIE = "toi_org"            # вход организатора: случайный токен, сессии в таблице org_sessions
ORG_DAYS = 60
DEV_COOKIE = "toi_dev"            # cookie устройства: по ней считаем бесплатные поздравления, а не по IP (в зале один Wi-Fi)
SSE_LIFETIME = 270                # поток живёт ~4.5 минуты, браузер сам переподключается (прокси не любят вечные ответы)
SSE_PING = 15                     # Cloudflare рвёт тихое соединение через 100 сек

ID_ABC = "abcdefghjkmnpqrstuvwxyz23456789"  # без 0/o, 1/l/i: ссылку диктуют по телефону
HEX = re.compile(r"#[0-9a-fA-F]{6}")
# Оформление (ТЗ 0.2, 0.10): шаблон-приглашение + общая палитра и шрифт имён на весь сервис
TPLS = {"mag", "arch", "iris", "frame", "clean", "typo", "oval", "kraft", "photo"}
PALETTES = {"ivory", "powder", "sage", "bordeaux", "night"}
NFONTS = {"corm", "play", "noto", "prata", "pinyon"}
FILMS = {"warm", "bw", "none"}              # фильтр на фото гостей: плёнка (тепло), ч/б, без
CARDS = {"auto", "portrait", "landscape"}  # формат карточки-полароида на экране
TYPES = {"wedding", "jubilee", "uzatu", "tusau"}
LANGS = {"kz", "ru"}
FRAMES = {"altyn", "kara", "kumis"}        # рамки Premium: Алтын, Қара-алтын, Күміс

_db_lock = threading.Lock()
_db = None
_subs_lock = threading.Lock()
_subs = {}        # id мероприятия -> {(очередь, роль)}
_rate = {}        # адрес -> [время]


# ---------------------------------------------------------------- база
def db():
    global _db
    if _db is None:
        os.makedirs(TOI_DIR, exist_ok=True)
        c = sqlite3.connect(DB_PATH, check_same_thread=False)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript("""
        CREATE TABLE IF NOT EXISTS events(
            id TEXT PRIMARY KEY, mod_key TEXT NOT NULL, led_key TEXT NOT NULL,
            created INTEGER NOT NULL, cfg TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS cards(
            id INTEGER PRIMARY KEY AUTOINCREMENT, eid TEXT NOT NULL, created INTEGER NOT NULL,
            name TEXT NOT NULL, msg TEXT NOT NULL, frame TEXT NOT NULL DEFAULT 'orn', tbl TEXT NOT NULL DEFAULT '',
            amount INTEGER NOT NULL DEFAULT 0, photo TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
            paid INTEGER NOT NULL DEFAULT 0, approved_at INTEGER, shown_at INTEGER,
            gtoken TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS cards_eid ON cards(eid, status);
        CREATE TABLE IF NOT EXISTS free_pass(
            dev TEXT NOT NULL, eid TEXT NOT NULL, last INTEGER NOT NULL, PRIMARY KEY(dev, eid));
        CREATE TABLE IF NOT EXISTS org_sessions(
            token TEXT PRIMARY KEY, eid TEXT NOT NULL, created INTEGER NOT NULL);
        """)
        try:   # пароль организатора (ТЗ 0.8); у мероприятий, созданных раньше, появится при первом открытии админки
            c.execute("ALTER TABLE events ADD COLUMN org_pw TEXT NOT NULL DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        _db = c
        ensure_demo()
    return _db


DEMO = {"id": "demo", "led": "demo"}   # Антон 16.11: показать хозяйке тойханы, ссылки постоянные


def ensure_demo():
    """Демо-той: открытки и конверты сразу на экране, без модератора и без перевода."""
    r = _db.execute("SELECT cfg FROM events WHERE id=?", (DEMO["id"],)).fetchone()
    if r:
        cfg = json.loads(r["cfg"])
        if cfg.get("tpl") not in TPLS:   # демо со старым оформлением (до 18.11) переводим на новые шаблоны
            cfg.update({"tpl": "arch", "palette": "ivory", "nfont": "corm"})
            _db.execute("UPDATE events SET cfg=? WHERE id=?", (json.dumps(clean_cfg({}, cfg), ensure_ascii=False), DEMO["id"]))
            _db.commit()
        return
    cfg = clean_cfg({"type": "wedding", "tpl": "arch", "palette": "ivory", "nfont": "corm", "kind": "Үйлену тойы",
                     "names": "Диас & Диара", "sub": "Шаңырақтарың биік болсын!", "date": "Toi Line · демо",
                     "moderation": False, "kaspi_name": "Демо", "kaspi_phone": "+7 700 000 00 00"})
    cfg["demo"] = True
    _db.execute("INSERT INTO events(id,mod_key,led_key,created,cfg) VALUES(?,?,?,?,?)",
                (DEMO["id"], new_id(10), DEMO["led"], now_ms(), json.dumps(cfg, ensure_ascii=False)))
    _db.commit()


def q(sql, args=(), one=False):
    with _db_lock:
        cur = db().execute(sql, args)
        rows = cur.fetchall()
        db().commit()
        return (rows[0] if rows else None) if one else rows


def ex(sql, args=()):
    with _db_lock:
        cur = db().execute(sql, args)
        db().commit()
        return cur.lastrowid


def now_ms():
    return int(time.time() * 1000)


def new_id(n):
    return "".join(secrets.choice(ID_ABC) for _ in range(n))


# ---------------------------------------------------------------- настройки мероприятия
def clean_str(v, n):
    v = v if isinstance(v, str) else ""
    v = re.sub(r"[\x00-\x1f\x7f]", " ", v).strip()
    return v[:n]


def clean_cfg(j, old=None):
    """Берём из присланного только известные поля и проверяем каждое. Чего нет в j, остаётся как было."""
    c = dict(old or {})
    j = j if isinstance(j, dict) else {}
    for k, n in (("kind", 40), ("names", 60), ("sub", 90), ("date", 30), ("hello", 200), ("kaspi_name", 60),
                 ("kaspi_phone", 20), ("organizer", 60),
                 # «О празднике» из кабинета организатора: попадает в приглашение, экран и альбом
                 ("title", 120), ("time", 10), ("place", 80), ("address", 120), ("host", 80)):
        if k in j:
            c[k] = clean_str(j[k], n)
    if "gis" in j:   # ссылка на маршрут в 2GIS
        link = clean_str(j["gis"], 300)
        c["gis"] = link if re.match(r"https://[^\s\"'<>]+$", link) else ""
    if isinstance(j.get("inv"), dict):   # приглашение: свой шаблон/цвет/шрифт (пусто — как у экрана), язык, свой текст
        iv, old_iv = j["inv"], dict(c.get("inv") or {})
        for k, allowed in (("tpl", TPLS), ("palette", PALETTES), ("nfont", NFONTS), ("lang", LANGS)):
            if k in iv:
                old_iv[k] = iv[k] if iv[k] in allowed else ""
        if "text" in iv:
            old_iv["text"] = clean_str(iv["text"], 160)
        c["inv"] = old_iv
    if "kaspi_link" in j:
        link = clean_str(j["kaspi_link"], 300)
        c["kaspi_link"] = link if re.match(r"https://[^\s\"'<>]+$", link) else ""
    if j.get("type") in TYPES:
        c["type"] = j["type"]
    if j.get("tpl") in TPLS:
        c["tpl"] = j["tpl"]
    if j.get("palette") in PALETTES:
        c["palette"] = j["palette"]
    if j.get("nfont") in NFONTS:
        c["nfont"] = j["nfont"]
    if j.get("film") in FILMS:
        c["film"] = j["film"]
    if j.get("card") in CARDS:
        c["card"] = j["card"]
    for k in ("fx_sheen", "fx_sparkle"):
        if k in j:
            c[k] = bool(j[k])
    if "quick" in j and isinstance(j["quick"], list):
        c["quick"] = [s for s in (clean_str(x, 80) for x in j["quick"][:8]) if s]
    if "moderation" in j:
        c["moderation"] = bool(j["moderation"])
    if "pct" in j:
        c["pct"] = max(0, min(50, int(num(j["pct"]))))
    if "deposit" in j:
        c["deposit"] = max(0, min(10_000_000, int(num(j["deposit"]))))
    c.setdefault("type", "wedding")
    if c.get("tpl") not in TPLS:
        c["tpl"] = "mag"
    for k in ("bgpat", "bg1", "bg2", "c1", "acc", "font", "size", "sheen"):   # поля старого оформления
        c.pop(k, None)
    c.setdefault("palette", "ivory")
    c.setdefault("nfont", "corm")
    if c.get("film") not in FILMS:  # старый «vhs» и прочее → плёнка
        c["film"] = "warm"
    c.setdefault("fx_sheen", True)
    c.setdefault("fx_sparkle", True)
    c.setdefault("moderation", True)
    c.setdefault("card", "auto")
    c.setdefault("splash", "")
    c.setdefault("couple", "")
    c.setdefault("pct", 10)
    c.setdefault("deposit", 20000)
    return c


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0


def get_event(eid):
    if not re.fullmatch(r"[a-z0-9]{4,12}", eid or ""):
        return None
    r = q("SELECT * FROM events WHERE id=? AND deleted=0", (eid,), one=True)
    if not r:
        return None
    e = dict(r)
    e["cfg"] = json.loads(e["cfg"])
    return e


def public_cfg(e):
    c = dict(e["cfg"])
    c["id"] = e["id"]
    for k in ("splash", "couple"):   # своя заставка-фон и фото пары
        c[k + "_url"] = f"/p/{e['id']}/{c[k]}.jpg" if c.get(k) else ""
        c.pop(k, None)
    return c


def links(e):
    return {"guest": f"/g/{e['id']}", "mod": f"/m/{e['id']}/{e['mod_key']}",
            "led": f"/s/{e['id']}/{e['led_key']}", "album": f"/a/{e['id']}"}


def new_password():
    return new_id(8)


def org_password(e):
    """Пароль организатора; у старых мероприятий создаём при первом обращении."""
    if not e.get("org_pw"):
        e["org_pw"] = new_password()
        ex("UPDATE events SET org_pw=? WHERE id=?", (e["org_pw"], e["id"]))
    return e["org_pw"]


def reset_org_password(eid):
    pw = new_password()
    ex("UPDATE events SET org_pw=? WHERE id=?", (pw, eid))
    ex("DELETE FROM org_sessions WHERE eid=?", (eid,))   # старый вход перестаёт работать
    return pw


def org_login(login, password):
    e = get_event(clean_str(login, 12).lower())
    if not e or e["cfg"].get("demo") or not password or not hmac.compare_digest(org_password(e).encode(), clean_str(password, 40).encode()):
        return None
    tok = secrets.token_hex(24)
    ex("INSERT INTO org_sessions(token,eid,created) VALUES(?,?,?)", (tok, e["id"], now_ms()))
    if secrets.randbelow(20) == 0:
        ex("DELETE FROM org_sessions WHERE created < ?", (now_ms() - ORG_DAYS * 86400000,))
    return tok, e


def org_event(h):
    """Мероприятие по cookie организатора или None."""
    m = re.search(r"(?:^|;\s*)" + ORG_COOKIE + r"=([0-9a-f]{48})", h.headers.get("Cookie") or "")
    if not m:
        return None
    r = q("SELECT eid, created FROM org_sessions WHERE token=?", (m.group(1),), one=True)
    if not r or r["created"] < now_ms() - ORG_DAYS * 86400000:
        return None
    return get_event(r["eid"])


def org_cookie(h, tok, age):
    sec = "; Secure" if (h.headers.get("X-Forwarded-Proto") or "").lower() == "https" else ""
    return {"Set-Cookie": f"{ORG_COOKIE}={tok}; Path=/; Max-Age={age}; HttpOnly; SameSite=Lax{sec}"}


def envelopes(e):
    """Конверты для организатора: подтверждённые тамадой (деньги пришли на Kaspi), без скрытых, и итог одной строкой."""
    rows = q("SELECT * FROM cards WHERE eid=? AND amount>0 AND paid=1 AND status IN ('approved','shown') ORDER BY created",
             (e["id"],))
    items = [{"name": r["name"], "table": r["tbl"], "amount": r["amount"], "t": r["created"]} for r in rows]
    total = sum(i["amount"] for i in items)
    pct = int(e["cfg"].get("pct", 10))
    fee = round(total * pct / 100)
    dep = int(e["cfg"].get("deposit", 20000))
    return items, {"count": len(items), "sum": total, "pct": pct, "fee": fee, "deposit": dep, "due": fee - dep}


ORG_FIELDS = ("kind", "names", "date", "title", "time", "place", "address", "host", "gis", "inv")


def create_event(cfg):
    for _ in range(20):
        eid = new_id(6)
        if not q("SELECT 1 FROM events WHERE id=?", (eid,), one=True):
            break
    e = {"id": eid, "mod_key": new_id(10), "led_key": new_id(10), "created": now_ms(), "cfg": clean_cfg(cfg),
         "org_pw": new_password()}
    ex("INSERT INTO events(id,mod_key,led_key,created,cfg,org_pw) VALUES(?,?,?,?,?,?)",
       (e["id"], e["mod_key"], e["led_key"], e["created"], json.dumps(e["cfg"], ensure_ascii=False), e["org_pw"]))
    os.makedirs(os.path.join(TOI_DIR, eid), exist_ok=True)
    return e


def save_cfg(e, cfg):
    e["cfg"] = cfg
    ex("UPDATE events SET cfg=? WHERE id=?", (json.dumps(cfg, ensure_ascii=False), e["id"]))
    publish(e["id"], "config", public_cfg(e), roles=("mod", "led"))


# ---------------------------------------------------------------- открытки
def card_out(r, full=False):
    d = {"id": r["id"], "t": r["created"], "name": r["name"], "msg": r["msg"], "frame": r["frame"],
         "table": r["tbl"], "amount": r["amount"], "status": r["status"], "paid": bool(r["paid"]),
         "approved_at": r["approved_at"], "shown_at": r["shown_at"],
         "photo": f"/p/{r['eid']}/{r['photo']}.jpg" if r["photo"] else ""}
    if not full:
        d.pop("paid")
    return d


def cards_of(eid, statuses):
    marks = ",".join("?" * len(statuses))
    return q(f"SELECT * FROM cards WHERE eid=? AND status IN ({marks}) ORDER BY id", (eid, *statuses))


def save_jpeg(eid, data_url, limit):
    """Фото приходит как data:image/jpeg;base64 (браузер уже сжал и повернул). Возвращает имя файла без .jpg."""
    m = re.match(r"data:image/jpeg;base64,([A-Za-z0-9+/=\s]+)$", data_url or "")
    if not m:
        raise ValueError("Фото должно быть в формате JPEG")
    raw = base64.b64decode(m.group(1))
    if len(raw) > limit or raw[:3] != b"\xff\xd8\xff":
        raise ValueError("Фото не подходит, попробуйте другое")
    name = secrets.token_hex(12)
    d = os.path.join(TOI_DIR, eid)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name + ".jpg"), "wb") as f:
        f.write(raw)
    return name


def rate_ok(ip):
    n, win = GUEST_LIMIT
    t = time.time()
    lst = [x for x in _rate.get(ip, []) if t - x < win]
    if len(lst) >= n:
        _rate[ip] = lst
        return False
    lst.append(t)
    _rate[ip] = lst
    if len(_rate) > 5000:
        for k in list(_rate)[:2500]:
            _rate.pop(k, None)
    return True


def device(h):
    """Кто отправляет: cookie устройства, а если её нет — адрес. Для первого визита отдаём Set-Cookie."""
    m = re.search(r"(?:^|;\s*)" + DEV_COOKIE + r"=([0-9a-f]{32})", h.headers.get("Cookie") or "")
    if m:
        return m.group(1), None
    v = secrets.token_hex(16)
    return h.ip(), {"Set-Cookie": f"{DEV_COOKIE}={v}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax"}


def free_wait(eid, dev):
    """Сколько секунд осталось до следующего бесплатного поздравления с этого устройства (0 — можно)."""
    if not dev:
        return 0
    r = q("SELECT last FROM free_pass WHERE dev=? AND eid=?", (dev, eid), one=True)
    if not r:
        return 0
    return max(0, (r["last"] + FREE_EVERY * 1000 - now_ms() + 999) // 1000)


def mark_free(eid, dev):
    """Запомнить, когда с устройства было бесплатное поздравление. Старое подчищаем: лишнего о гостях не держим."""
    if not dev:
        return
    ex("INSERT OR REPLACE INTO free_pass(dev,eid,last) VALUES(?,?,?)", (dev, eid, now_ms()))
    if secrets.randbelow(20) == 0:
        ex("DELETE FROM free_pass WHERE last < ?", (now_ms() - 7 * 86400000,))


def free_text(sec):
    m = (sec + 59) // 60
    return "меньше минуты" if m <= 1 else f"{m} мин"


class FreeLimit(Exception):
    """Бесплатное поздравление с этого устройства уже было в последние полчаса."""

    def __init__(self, left):
        super().__init__("free limit")
        self.left = left


def add_card(e, j, ip, dev=""):
    name = clean_str(j.get("name"), 30)
    msg = clean_str(j.get("msg"), 140)
    if not name:
        raise ValueError("Напишите своё имя")
    if not msg and not j.get("photo"):
        raise ValueError("Добавьте фото или пожелание")
    amount = int(num(j.get("amount")))
    if amount and not MIN_ENV <= amount <= MAX_ENV:
        raise ValueError(f"Сумма конверта от {MIN_ENV} ₸")
    frame = j.get("frame") if j.get("frame") in FRAMES else "altyn"
    tbl = clean_str(str(j.get("table") or ""), 6)
    # Бесплатное поздравление — одно с устройства в полчаса. Конверт (платный) отправляется сколько угодно.
    if not amount:
        left = free_wait(e["id"], dev)
        if left:
            raise FreeLimit(left)
    photo = save_jpeg(e["id"], j["photo"], PHOTO_MAX) if j.get("photo") else ""
    # Конверт всегда ждёт модератора: он сверяет перевод в Kaspi. Обычная открытка — если включена проверка.
    demo = bool(e["cfg"].get("demo"))
    status = "pending" if not demo and (amount or e["cfg"].get("moderation", True)) else "approved"
    t = now_ms()
    token = secrets.token_hex(8)
    cid = ex("INSERT INTO cards(eid,created,name,msg,frame,tbl,amount,photo,status,approved_at,gtoken,ip) "
             "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
             (e["id"], t, name, msg, frame, tbl, amount, photo, status, t if status == "approved" else None, token, ip))
    if demo and amount:
        ex("UPDATE cards SET paid=1 WHERE id=?", (cid,))
    if not amount:
        mark_free(e["id"], dev)
    r = q("SELECT * FROM cards WHERE id=?", (cid,), one=True)
    publish(e["id"], "card", card_out(r, True), roles=("mod",))
    if status == "approved":
        publish(e["id"], "card", card_out(r), roles=("led",))
    return r


def queue_pos(eid, r):
    """Сколько открыток покажут раньше этой (примерно: конверты идут вне очереди)."""
    if r["amount"]:
        return q("SELECT COUNT(*) n FROM cards WHERE eid=? AND status IN ('pending','approved') AND amount>=? AND id<?",
                 (eid, r["amount"], r["id"]), one=True)["n"] + 1
    return q("SELECT COUNT(*) n FROM cards WHERE eid=? AND status IN ('pending','approved') AND id<?",
             (eid, r["id"]), one=True)["n"] + 1


def act(e, j):
    cid = int(num(j.get("id")))
    a = j.get("action")
    r = q("SELECT * FROM cards WHERE id=? AND eid=?", (cid, e["id"]), one=True)
    if not r:
        raise ValueError("Открытка не найдена")
    t = now_ms()
    if a == "approve":       # «В эфир»; для конверта это ещё и «деньги пришли»
        if r["status"] in ("pending", "hidden"):
            ex("UPDATE cards SET status='approved', approved_at=?, paid=? WHERE id=?",
               (t, 1 if r["amount"] else 0, cid))
    elif a == "hide":        # «Скрыть»: с экрана и из альбома; если конверт оплачен, организатор возвращает деньги гостю
        ex("UPDATE cards SET status='hidden' WHERE id=?", (cid,))
    elif a == "requeue":     # показать ещё раз
        if r["status"] == "shown":
            ex("UPDATE cards SET status='approved', approved_at=?, shown_at=NULL WHERE id=?", (t, cid))
    else:
        raise ValueError("Неизвестное действие")
    r = q("SELECT * FROM cards WHERE id=?", (cid,), one=True)
    publish(e["id"], "card", card_out(r, True), roles=("mod",))
    publish(e["id"], "card", card_out(r), roles=("led",))
    return r


def mark_shown(e, ids):
    out = []
    for cid in ids[:50]:
        r = q("SELECT * FROM cards WHERE id=? AND eid=?", (int(num(cid)), e["id"]), one=True)
        if r and r["status"] == "approved":
            ex("UPDATE cards SET status='shown', shown_at=? WHERE id=?", (now_ms(), r["id"]))
            r = q("SELECT * FROM cards WHERE id=?", (r["id"],), one=True)
            publish(e["id"], "card", card_out(r, True), roles=("mod",))
            publish(e["id"], "card", card_out(r), roles=("led",))
            out.append(r["id"])
    return out


# ---------------------------------------------------------------- реальное время
def publish(eid, kind, data, roles=("mod", "led")):
    msg = (kind, data)
    with _subs_lock:
        for qu, role in list(_subs.get(eid, ())):
            if role in roles:
                try:
                    qu.put_nowait(msg)
                except queue.Full:
                    pass


def stream(h, e, role):
    qu = queue.Queue(maxsize=500)
    key = (qu, role)
    with _subs_lock:
        _subs.setdefault(e["id"], set()).add(key)
    try:
        h.send_response(200)
        h.send_header("Content-Type", "text/event-stream; charset=utf-8")
        h.send_header("Cache-Control", "no-cache, no-transform")
        h.send_header("X-Accel-Buffering", "no")
        h.send_header("Connection", "close")
        h.close_connection = True
        h.end_headers()
        h.wfile.write(b"retry: 3000\n\nevent: hello\ndata: {}\n\n")
        end = time.time() + SSE_LIFETIME
        while time.time() < end:
            try:
                kind, data = qu.get(timeout=SSE_PING)
                h.wfile.write(f"event: {kind}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode())
            except queue.Empty:
                h.wfile.write(b": ping\n\n")
    except (BrokenPipeError, ConnectionResetError, OSError):
        pass
    finally:
        with _subs_lock:
            s = _subs.get(e["id"])
            if s:
                s.discard(key)
                if not s:
                    _subs.pop(e["id"], None)


def online(eid):
    with _subs_lock:
        roles = [r for _, r in _subs.get(eid, ())]
    return {"led": roles.count("led"), "mod": roles.count("mod")}


# ---------------------------------------------------------------- HTTP
PAGES = {"": "admin.html", "g": "guest.html", "m": "mod.html", "s": "led.html", "a": "album.html", "o": "org.html"}
CTYPES = {"js": "application/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "svg": "image/svg+xml",
          "png": "image/png", "jpg": "image/jpeg", "ttf": "font/ttf", "json": "application/json; charset=utf-8", "webmanifest": "application/manifest+json"}


def _file(h, path, ctype, cache="no-cache", extra=None):
    if not os.path.isfile(path):
        return h.err(404, "Не найдено")
    with open(path, "rb") as f:
        h.send_bytes(200, f.read(), ctype, {"Cache-Control": cache, **(extra or {})})


def _keyed(eid, key, field):
    e = get_event(eid)
    if not e or not hmac.compare_digest(e[field], key or ""):
        return None
    return e


_bad = {}  # адрес -> [время неверного ключа]: 10 ошибок за 15 минут закрывают админку для адреса


def _is_admin(h):
    k = admin_key()
    ip, t = h.ip(), time.time()
    fails = [x for x in _bad.get(ip, []) if t - x < 900]
    if not k or len(fails) >= 10:
        return False
    if hmac.compare_digest(k, (h.headers.get("X-Toi-Admin") or "").strip()):
        return True
    if h.headers.get("X-Toi-Admin"):
        _bad[ip] = fails + [t]
    return False


def handle_get(h, path):
    """Все GET. Возвращает после ответа."""
    p = path.strip("/")
    parts = p.split("/") if p else []
    try:
        # страницы
        if not parts:
            return _file(h, os.path.join(STATIC, "admin.html"), "text/html; charset=utf-8")
        if parts[0] == "g" and len(parts) == 2:      # странице гостя сразу выдаём cookie устройства
            _, cookie = device(h)
            return _file(h, os.path.join(STATIC, PAGES["g"]), "text/html; charset=utf-8", extra=cookie)
        if parts[0] in ("a",) and len(parts) == 2 or parts[0] in ("m", "s") and len(parts) == 3:
            return _file(h, os.path.join(STATIC, PAGES[parts[0]]), "text/html; charset=utf-8")
        if parts == ["o"]:   # кабинет организатора: вход и разделы на одной странице
            return _file(h, os.path.join(STATIC, PAGES["o"]), "text/html; charset=utf-8")
        if parts == ["p"]:   # презентация возможностей для показа на iPad (вход по ключу администратора)
            return _file(h, os.path.join(STATIC, "present.html"), "text/html; charset=utf-8")
        if parts == ["sw.js"]:  # сервис-воркер в корне управляет всеми страницами
            return _file(h, os.path.join(STATIC, "sw.js"), CTYPES["js"])
        if len(parts) == 2 and parts[0] == "static":
            m = re.fullmatch(r"([a-z0-9_-]+)\.(js|css|svg|png|webmanifest)", parts[1])
            if not m:
                return h.err(404, "Не найдено")
            if parts[1] in ("qrcode.js", "html2canvas.js", "jszip.js"):   # сторонние библиотеки не меняются
                return _file(h, os.path.join(STATIC, parts[1]), CTYPES["js"], "public, max-age=86400")
            return _file(h, os.path.join(STATIC, parts[1]), CTYPES[m.group(2)])
        if len(parts) == 3 and parts[0] == "static" and parts[1] in ("img", "fonts"):   # рамки, гравюры, шрифты
            m = re.fullmatch(r"([a-z0-9_-]+)\.(png|jpg|ttf)", parts[2])
            if not m:
                return h.err(404, "Не найдено")
            return _file(h, os.path.join(STATIC, parts[1], parts[2]), CTYPES[m.group(2)], "public, max-age=604800")
        if len(parts) == 3 and parts[0] == "p":   # фото: имя случайное, поэтому кэшируем надолго
            m = re.fullmatch(r"([0-9a-f]{24})\.jpg", parts[2])
            if not m or not get_event(parts[1]):
                return h.err(404, "Не найдено")
            return _file(h, os.path.join(TOI_DIR, parts[1], parts[2]), "image/jpeg", "private, max-age=31536000, immutable")
        # данные
        if len(parts) >= 3 and parts[0] == "api":
            return api_get(h, parts[1:])
        return h.err(404, "Не найдено")
    except Exception as ex_:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        return h.err(500, "Ошибка сервера: " + str(ex_)[:100])


def api_get(h, parts):
    kind = parts[0]
    if kind == "o" and parts[1:] == ["state"]:   # кабинет организатора: без ссылок тамады и экрана
        e = org_event(h)
        if not e:
            return h.err(401, "Войдите в кабинет")
        items, tot = envelopes(e)
        shown = q("SELECT COUNT(*) n, COALESCE(SUM(photo<>''),0) p FROM cards WHERE eid=? AND status='shown'", (e["id"],), one=True)
        lk = links(e)
        return h.send_json(200, {"cfg": public_cfg(e), "links": {"guest": lk["guest"], "album": lk["album"]},
                                 "envelopes": items, "totals": tot, "album": {"cards": shown["n"], "photos": shown["p"]}})
    if kind == "admin" and parts[1:] == ["events"]:
        if not _is_admin(h):
            return h.err(401, "Нужен ключ администратора")
        out = []
        for r in q("SELECT * FROM events WHERE deleted=0 ORDER BY created DESC LIMIT 200"):
            e = dict(r)
            e["cfg"] = json.loads(e["cfg"])
            n = q("SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN amount>0 AND status IN ('approved','shown') THEN amount END),0) s "
                  "FROM cards WHERE eid=?", (e["id"],), one=True)
            out.append({"id": e["id"], "created": e["created"], "names": e["cfg"].get("names", ""),
                        "date": e["cfg"].get("date", ""), "kind": e["cfg"].get("kind", ""), "type": e["cfg"].get("type", ""),
                        "tpl": e["cfg"].get("tpl", ""), "palette": e["cfg"].get("palette", ""), "cards": n["n"],
                        "sum": n["s"], "links": links(e), "org": None if e["cfg"].get("demo") else {"login": e["id"], "password": org_password(e)}})
        return h.send_json(200, {"events": out})
    if kind == "e" and len(parts) == 2:          # гость: настройки праздника
        e = get_event(parts[1])
        if not e:
            return h.err(404, "Мероприятие не найдено")
        return h.send_json(200, {"cfg": public_cfg(e)})
    if kind == "e" and len(parts) == 4 and parts[2] == "card":   # гость: что с моей открыткой
        e = get_event(parts[1])
        tok = (parse_qs(urlparse(h.path).query).get("token") or [""])[0]
        r = e and q("SELECT * FROM cards WHERE id=? AND eid=?", (int(num(parts[3])), e["id"]), one=True)
        if not r or not hmac.compare_digest(r["gtoken"], tok):
            return h.err(404, "Не найдено")
        return h.send_json(200, {"status": r["status"], "pos": queue_pos(e["id"], r) if r["status"] in ("pending", "approved") else 0})
    if kind == "a" and len(parts) == 2:          # альбом: только показанные
        e = get_event(parts[1])
        if not e:
            return h.err(404, "Мероприятие не найдено")
        cards = [card_out(r) for r in q("SELECT * FROM cards WHERE eid=? AND status='shown' ORDER BY shown_at", (e["id"],))]
        return h.send_json(200, {"cfg": public_cfg(e), "cards": cards})
    if kind in ("m", "s") and len(parts) == 4:   # пульт и экран
        e = _keyed(parts[1], parts[2], "mod_key" if kind == "m" else "led_key")
        if not e:
            return h.err(404, "Ссылка неверная")
        role = "mod" if kind == "m" else "led"
        if parts[3] == "stream":
            return stream(h, e, role)
        if parts[3] == "state":
            if role == "mod":
                cards = [card_out(r, True) for r in q("SELECT * FROM cards WHERE eid=? ORDER BY id", (e["id"],))]
                return h.send_json(200, {"cfg": public_cfg(e), "cards": cards, "links": links(e), "online": online(e["id"])})
            cards = [card_out(r) for r in cards_of(e["id"], ("approved", "shown"))]
            return h.send_json(200, {"cfg": public_cfg(e), "cards": cards, "links": {"guest": links(e)["guest"]}})
    return h.err(404, "Не найдено")


def handle_post(h, path):
    parts = path.strip("/").split("/")
    try:
        if len(parts) < 3 or parts[0] != "api":
            return h.err(404, "Не найдено")
        j = h.json_body() or {}
        kind = parts[1]
        if kind == "o":
            return org_post(h, parts[2:], j)
        if kind == "admin" and parts[2:] == ["events"]:
            if not _is_admin(h):
                return h.err(401, "Нужен ключ администратора")
            e = create_event(j)
            return h.send_json(200, {"id": e["id"], "links": links(e)})
        if kind == "admin" and len(parts) == 5 and parts[2] == "events" and parts[4] == "password":
            if not _is_admin(h):
                return h.err(401, "Нужен ключ администратора")
            if not get_event(parts[3]):
                return h.err(404, "Мероприятие не найдено")
            return h.send_json(200, {"login": parts[3], "password": reset_org_password(parts[3])})
        if kind == "admin" and len(parts) == 5 and parts[2] == "events" and parts[4] == "delete":
            if not _is_admin(h):
                return h.err(401, "Нужен ключ администратора")
            ex("UPDATE events SET deleted=1 WHERE id=?", (parts[3],))
            return h.send_json(200, {"ok": True})
        if kind == "e" and len(parts) == 4 and parts[3] == "card":
            e = get_event(parts[2])
            if not e:
                return h.err(404, "Мероприятие не найдено")
            if not rate_ok(e["id"] + "|" + h.ip()):
                return h.err(429, "Слишком много открыток подряд. Подождите пару минут.")
            dev, cookie = device(h)
            try:
                r = add_card(e, j, h.ip(), dev)
            except FreeLimit as fl:
                return h.send_json(429, {"error": "Бесплатное поздравление можно отправить раз в 30 минут. "
                                                  f"Следующее — через {free_text(fl.left)}, а конверт можно отправить в любое время.",
                                         "retry": fl.left}, headers=cookie)
            except ValueError as v:
                return h.err(400, str(v))
            return h.send_json(200, {"id": r["id"], "token": r["gtoken"], "status": r["status"], "pos": queue_pos(e["id"], r)},
                               headers=cookie)
        if kind == "m" and len(parts) == 5:
            e = _keyed(parts[2], parts[3], "mod_key")
            if not e:
                return h.err(404, "Ссылка неверная")
            if parts[4] == "act":
                try:
                    return h.send_json(200, {"card": card_out(act(e, j), True)})
                except ValueError as v:
                    return h.err(400, str(v))
            if parts[4] == "cfg":
                cfg = clean_cfg(j, e["cfg"])
                for k in ("splash", "couple"):   # свой фон и фото пары: data:URL или пусто, чтобы убрать
                    if k in j:
                        if j[k]:
                            try:
                                cfg[k] = save_jpeg(e["id"], j[k], SPLASH_MAX)
                            except ValueError as v:
                                return h.err(400, str(v))
                        else:
                            cfg[k] = ""
                save_cfg(e, cfg)
                return h.send_json(200, {"cfg": public_cfg(e)})
        if kind == "s" and len(parts) == 5 and parts[4] == "shown":
            e = _keyed(parts[2], parts[3], "led_key")
            if not e:
                return h.err(404, "Ссылка неверная")
            ids = j.get("ids") if isinstance(j.get("ids"), list) else []
            return h.send_json(200, {"ok": mark_shown(e, ids)})
        return h.err(404, "Не найдено")
    except Exception as ex_:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        return h.err(500, "Ошибка сервера: " + str(ex_)[:100])


_org_bad = {}  # адрес -> [время неверного пароля]: 10 ошибок за 15 минут закрывают вход для адреса


def org_post(h, parts, j):
    if parts == ["login"]:
        ip, t = h.ip(), time.time()
        fails = [x for x in _org_bad.get(ip, []) if t - x < 900]
        if len(fails) >= 10:
            return h.err(429, "Слишком много попыток. Подождите 15 минут.")
        res = org_login(j.get("login"), j.get("password"))
        if not res:
            _org_bad[ip] = fails + [t]
            return h.err(401, "Неверный логин или пароль")
        tok, e = res
        return h.send_json(200, {"ok": True}, headers=org_cookie(h, tok, ORG_DAYS * 86400))
    if parts == ["logout"]:
        m = re.search(r"(?:^|;\s*)" + ORG_COOKIE + r"=([0-9a-f]{48})", h.headers.get("Cookie") or "")
        if m:
            ex("DELETE FROM org_sessions WHERE token=?", (m.group(1),))
        return h.send_json(200, {"ok": True}, headers=org_cookie(h, "", 0))
    e = org_event(h)
    if not e:
        return h.err(401, "Войдите в кабинет")
    if parts == ["cfg"]:   # только поля организатора: модерацию, Kaspi и оформление экрана меняет тамада
        cfg = clean_cfg({k: j[k] for k in ORG_FIELDS if k in j}, e["cfg"])
        if "couple" in j:
            if j["couple"]:
                try:
                    cfg["couple"] = save_jpeg(e["id"], j["couple"], SPLASH_MAX)
                except ValueError as v:
                    return h.err(400, str(v))
            else:
                cfg["couple"] = ""
        save_cfg(e, cfg)
        return h.send_json(200, {"cfg": public_cfg(e)})
    return h.err(404, "Не найдено")
