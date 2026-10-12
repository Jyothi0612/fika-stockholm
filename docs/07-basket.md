# 07 · basket (Python)

The basket service keeps what a guest or user is about to order, in Redis (one key per basket, for 4 hours). It asks menu for the real price and stock, so the browser can't change prices. At login, the guest basket moves to the user's name.

Server: **RHEL 9 practice AMI**, security group **fika-basket**, DNS `basket.fika.<domain>` → private IP. Needs [02-redis](02-redis.md) and [05-menu](05-menu.md).

## Install Python 3.14

RHEL 9 comes with Python 3.9 as `python3`. A newer version installs next to it, with its own name, so system tools keep using 3.9:

```shell
dnf install python3.14 python3.14-pip -y
python3.14 --version
```

## App user, download, install

```shell
useradd --system --home /app --shell /sbin/nologin --comment "fika system user" fika
mkdir /app
curl -L -o /tmp/basket.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/basket.tar.gz
cd /app
tar -xzf /tmp/basket.tar.gz
python3.14 -m venv /app/.venv
/app/.venv/bin/pip install -r requirements.txt
```

The virtual environment (`/app/.venv`) keeps the app's libraries (Flask, gunicorn, redis, requests) apart from the system's Python.

## Service file

```shell
vim /etc/systemd/system/basket.service
```

```ini
[Unit]
Description=Fika basket service
After=network-online.target

[Service]
User=fika
WorkingDirectory=/app
Environment=REDIS_HOST=redis.fika.<domain>
Environment=MENU_HOST=menu.fika.<domain>
Environment=MENU_PORT=8080
ExecStart=/app/.venv/bin/gunicorn --config gunicorn.conf.py basket:app
SyslogIdentifier=basket
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`WorkingDirectory=/app` matters: gunicorn looks for `basket.py` and `gunicorn.conf.py` in the current folder.

```shell
systemctl daemon-reload
systemctl enable basket
systemctl start basket
```

## Verify

```shell
curl -s localhost:8080/health                       # {"app":"OK","redis":true}
curl -s -XPOST localhost:8080/add/test-1/HS-KANEL/2 # adds 2 kanelbullar to basket "test-1"
curl -s localhost:8080/basket/test-1
journalctl -u basket -n 20
```

| Method | Path | Answer |
|---|---|---|
| GET | `/basket/<id>` | the basket |
| POST | `/add/<id>/<sku>/<qty>` | adds items; 409 if not enough left today |
| POST | `/update/<id>/<sku>/<qty>` | sets a quantity (0 removes) |
| POST | `/delivery/<id>` | stores the delivery choice and fee, used by delivery |
| POST | `/rename/<old>/<new>` | moves the guest basket to the user, at login |
| DELETE | `/basket/<id>` | empties the basket, used by payment |

## Security group

Allow **inbound TCP 8080** from `fika-frontend`, `fika-delivery` and `fika-payment`.

## Troubleshooting

| You see | Cause |
|---|---|
| `status=203/EXEC` in `systemctl status` | the venv is missing: re-run the `python3.14 -m venv` and `pip install` steps |
| `Failed to find attribute 'app'` or `No module named 'basket'` | `WorkingDirectory=/app` missing in the service file |
| Add to basket: `menu not reachable` | `MENU_HOST`, or the menu security group doesn't allow fika-basket |
