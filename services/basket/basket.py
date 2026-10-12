"""basket service: what a guest or user is about to order. Stored in Redis as JSON, one key per basket.
Asks menu for the real price and stock, so the browser can't set prices."""
import json, logging, os, time
import redis, requests
from flask import Flask, jsonify, request, g

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
MENU = f"http://{os.environ.get('MENU_HOST', 'localhost')}:{os.environ.get('MENU_PORT', '8080')}"
TTL = 3600 * 4  # a basket lives 4 hours

app = Flask(__name__)
r = redis.Redis(host=REDIS_HOST, port=6379, socket_timeout=3, decode_responses=True)
logging.basicConfig(level=logging.INFO, format="%(message)s")
def log(level, msg, **kw):
    print(json.dumps({"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "level": level, "msg": msg, "service": "basket", **kw}), flush=True)

@app.before_request
def start(): g.t0 = time.time()
@app.after_request
def done(resp):
    log("INFO", f"{request.method} {request.path} {resp.status_code}", requestId=request.headers.get("X-Request-Id", ""), ms=int((time.time() - g.t0) * 1000))
    return resp

def load(bid):
    raw = r.get(f"basket:{bid}")
    return json.loads(raw) if raw else {"items": [], "delivery": None, "subtotal": 0, "total": 0}

def save(bid, b):
    b["subtotal"] = sum(i["price"] * i["qty"] for i in b["items"])
    b["total"] = b["subtotal"] + (b["delivery"]["fee"] if b.get("delivery") else 0)
    r.set(f"basket:{bid}", json.dumps(b), ex=TTL)
    return b

@app.get("/health")
def health():
    try: ok = r.ping()
    except Exception: ok = False
    return jsonify(app="OK", redis=ok), (200 if ok else 503)

@app.get("/basket/<bid>")
def get_basket(bid):
    return jsonify(load(bid))

@app.post("/add/<bid>/<sku>/<int:qty>")
def add(bid, sku, qty):
    try:
        item = requests.get(f"{MENU}/item/{sku}", timeout=5, headers={"X-Request-Id": request.headers.get("X-Request-Id", "")})
    except requests.RequestException as e:
        return jsonify(message="menu not reachable", error=str(e)), 503
    if item.status_code == 404: return jsonify(message="item not found"), 404
    item = item.json()
    b = load(bid)
    line = next((i for i in b["items"] if i["sku"] == sku), None)
    want = (line["qty"] if line else 0) + qty
    if want > item.get("stock", 0): return jsonify(message="not enough left today", left=item.get("stock", 0)), 409
    if line: line["qty"] = want
    else: b["items"].append({"sku": sku, "name": item["name"], "cafe": item["cafe"], "price": item["price"], "qty": qty})
    b["items"] = [i for i in b["items"] if i["qty"] > 0]
    return jsonify(save(bid, b))

@app.post("/update/<bid>/<sku>/<int:qty>")
def update(bid, sku, qty):
    b = load(bid)
    for i in b["items"]:
        if i["sku"] == sku: i["qty"] = qty
    b["items"] = [i for i in b["items"] if i["qty"] > 0]
    return jsonify(save(bid, b))

# used by delivery: the chosen district, mode and fee
@app.post("/delivery/<bid>")
def set_delivery(bid):
    b = load(bid)
    b["delivery"] = request.get_json(force=True)
    return jsonify(save(bid, b))

# at login the guest basket moves to the user's name
@app.post("/rename/<old>/<new>")
def rename(old, new):
    b = load(old)
    if b["items"]:
        save(new, b); r.delete(f"basket:{old}")
    return jsonify(load(new))

# used by payment after a successful order
@app.delete("/basket/<bid>")
def delete(bid):
    r.delete(f"basket:{bid}")
    return "", 204

@app.errorhandler(404)
def nf(e): return jsonify(message=f"route {request.method} {request.path} not found"), 404
