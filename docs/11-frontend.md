# 11 · frontend (nginx)

The frontend server is the only public one. nginx serves the web shop and passes every `/api/<service>/` call to the right server, over private IPs.

Server: **RHEL 9 practice AMI**, security group **fika-frontend**, DNS `fika.<domain>` → **public** IP. Build it last, when every service is up.

## Install nginx

```shell
dnf module disable nginx -y
dnf module enable nginx:1.26 -y
dnf install nginx -y
systemctl enable nginx
systemctl start nginx
```

Open `http://<public-ip>`: you should see the default nginx page.

## Deploy the web shop

```shell
rm -rf /usr/share/nginx/html/*
curl -L -o /tmp/frontend.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/frontend.tar.gz
cd /usr/share/nginx/html
tar -xzf /tmp/frontend.tar.gz
```

## Proxy config

We don't touch `/etc/nginx/nginx.conf`: its default `server` block already loads every file in `/etc/nginx/default.d/`, so add ours there.

```shell
curl -L -o /etc/nginx/default.d/fika.conf https://raw.githubusercontent.com/Jyothi0612/fika-stockholm/main/conf/fika.conf
vim /etc/nginx/default.d/fika.conf
```

Replace each `<…-HOST>` with the DNS name, for example `<MENU-HOST>` → `menu.fika.agenticengg.online`. The important lines:

```nginx
location /api/menu/     { proxy_pass http://menu.fika.<domain>:8080/; }
location /api/user/     { proxy_pass http://user.fika.<domain>:8080/; }
location /api/basket/   { proxy_pass http://basket.fika.<domain>:8080/; }
location /api/delivery/ { proxy_pass http://delivery.fika.<domain>:8080/; }
location /api/payment/  { proxy_pass http://payment.fika.<domain>:8080/; }
```

The trailing `/` after `:8080` removes the `/api/<service>` part: `/api/menu/cafes` reaches the menu server as `/cafes`.

```shell
nginx -t
systemctl restart nginx
```

nginx looks up these names **when it starts**. If a server's IP changes later, update the DNS record and run `systemctl reload nginx`.

## Verify

```shell
curl -s localhost/api/menu/cafes | head -c 200
curl -s localhost/health
```

Then in a browser: `http://fika.<domain>`, and `http://fika.<domain>/status` for every service's health.

**A full order:** pick a café → Add → Basket → Bike delivery + district → Sign in / create account → Pay. Then on the kitchen server: `journalctl -u kitchen -n 5`.

## What nginx adds

- **X-Request-Id:** every request gets a unique ID, passed to the service and returned to the browser, so one click can be traced through every log.
- **JSON errors:** if nginx can't reach a service it answers `{"message":"service not reachable (502 Bad Gateway from nginx)"}`; if a service is slower than 30 s, `504` the same way.
- **One-page app:** paths like `/cafe/hasselby`, `/basket` or `/status` all return `index.html`; the browser shows the right page.

## Security group

Allow **inbound TCP 80** from `0.0.0.0/0` (and 22 from your IP).

## Troubleshooting

| You see in the browser | Cause |
|---|---|
| page doesn't open at all | DNS `fika.<domain>` points to an old public IP (stopped/started instance), or port 80 not open |
| page opens, cafés list says `502 Bad Gateway from nginx` | nginx can't reach menu: menu down, or the menu security group doesn't allow fika-frontend |
| `nginx: [emerg] host not found in upstream "menu.fika…"` | DNS record missing: create it, then `systemctl restart nginx` |
| `/status` shows one red service | check that server: `systemctl status`, `curl localhost:8080/health`, `journalctl -u` |
