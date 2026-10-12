"""payment service: demo mobile pay (no real money). Checks the user and the basket,
puts the order on the RabbitMQ "orders" queue for the kitchen, saves it to the user's history
and empties the basket."""
import json, os, time, uuid
import pika, requests
from flask import Flask, jsonify, request, g

def url(name): return f"http://{os.environ.get(name + '_HOST', 'localhost')}:{os.environ.get(name + '_PORT', '8080')}"
USER, BASKET = url("USER"), url("BASKET")
AMQP = dict(host=os.environ.get("AMQP_HOST", "localhost"), user=os.environ.get("AMQP_USER", "guest"), pw=os.environ.get("AMQP_PASS", "guest"))

app = Flask(__name__)
def log(level, msg, **kw):
    print(json.dumps({"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "level": level, "msg": msg, "service": "payment", **kw}), flush=True)

@app.before_request
def start(): g.t0, g.rid = time.time(), request.headers.get("X-Request-Id", "")
@app.after_request
def done(resp):
    log("INFO", f"{request.method} {request.path} {resp.status_code}", requestId=g.rid, ms=int((time.time() - g.t0) * 1000))
    return resp

def channel():
    params = pika.ConnectionParameters(host=AMQP["host"], credentials=pika.PlainCredentials(AMQP["user"], AMQP["pw"]),
                                       connection_attempts=1, socket_timeout=5, blocked_connection_timeout=5)
    conn = pika.BlockingConnection(params)
    ch = conn.channel()
    ch.queue_declare(queue="orders", durable=True)
    return conn, ch

@app.get("/health")
def health():
    try:
        conn, _ = channel(); conn.close(); ok = True
    except Exception as e:
        log("ERROR", "RabbitMQ not reachable", error=str(e)); ok = False
    return jsonify(app="OK", rabbitmq=ok), (200 if ok else 503)

@app.post("/pay/<bid>")
def pay(bid):
    body = request.get_json(force=True, silent=True) or {}
    name = body.get("user")
    hdr = {"X-Request-Id": g.rid}
    try:
        if not name or requests.get(f"{USER}/check/{name}", timeout=5, headers=hdr).status_code != 200:
            return jsonify(message="please log in first"), 401
        basket = requests.get(f"{BASKET}/basket/{bid}", timeout=5, headers=hdr).json()
    except requests.RequestException as e:
        return jsonify(message="a service is not reachable", error=str(e)), 503
    if not basket.get("items"): return jsonify(message="your basket is empty"), 400
    if not basket.get("delivery"): return jsonify(message="choose pickup or delivery first"), 400

    order = {"orderid": str(uuid.uuid4()), "user": name, "items": basket["items"], "delivery": basket["delivery"],
             "total": basket["total"], "currency": "SEK", "requestId": g.rid}
    # save first, so the kitchen always finds the order when it reports progress
    try:
        requests.post(f"{USER}/order/{name}", json={**{k: order[k] for k in ("orderid", "items", "delivery", "total")}, "status": "paid"},
                      timeout=5, headers=hdr).raise_for_status()
    except requests.RequestException as e:
        return jsonify(message="could not save the order", error=str(e)), 503
    try:
        conn, ch = channel()
        ch.basic_publish(exchange="", routing_key="orders", body=json.dumps(order), properties=pika.BasicProperties(delivery_mode=2))
        conn.close()
    except Exception as e:
        log("ERROR", "could not queue the order", error=str(e), orderid=order["orderid"])
        try: requests.put(f"{USER}/order/{name}/{order['orderid']}/status", json={"status": "payment failed"}, timeout=5, headers=hdr)
        except requests.RequestException: pass
        return jsonify(message="payments are paused, try again in a minute", error=str(e)), 503
    try:
        requests.delete(f"{BASKET}/basket/{bid}", timeout=5, headers=hdr)
    except requests.RequestException as e:
        log("WARN", "order queued but the basket was not emptied", error=str(e), orderid=order["orderid"])
    log("INFO", "order paid", orderid=order["orderid"], user=name, total=order["total"])
    return jsonify(orderid=order["orderid"], total=order["total"], message="Tack! Your fika is on its way to the kitchen.")

@app.errorhandler(404)
def nf(e): return jsonify(message=f"route {request.method} {request.path} not found"), 404
