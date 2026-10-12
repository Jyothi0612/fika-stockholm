# 09 · payment (Python)

The payment service is a demo mobile pay: **no real money moves**. When you pay, it:

1. checks the user exists (user service),
2. reads the basket and checks it has items and a delivery choice (basket service),
3. saves the order to the user's history with status `paid` (first, so the kitchen always finds it),
4. puts the order on the RabbitMQ `orders` queue for the kitchen, and empties the basket.

Server: **RHEL 9 practice AMI**, security group **fika-payment**, DNS `payment.fika.<domain>` → private IP. Needs [04-rabbitmq](04-rabbitmq.md), [06-user](06-user.md) and [07-basket](07-basket.md).

## Install Python 3.14

```shell
dnf install python3.14 python3.14-pip -y
```

## App user, download, install

```shell
useradd --system --home /app --shell /sbin/nologin --comment "fika system user" fika
mkdir /app
curl -L -o /tmp/payment.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/payment.tar.gz
cd /app
tar -xzf /tmp/payment.tar.gz
python3.14 -m venv /app/.venv
/app/.venv/bin/pip install -r requirements.txt
```

## Service file

```shell
vim /etc/systemd/system/payment.service
```

```ini
[Unit]
Description=Fika payment service
After=network-online.target

[Service]
User=fika
WorkingDirectory=/app
Environment=USER_HOST=user.fika.<domain>
Environment=USER_PORT=8080
Environment=BASKET_HOST=basket.fika.<domain>
Environment=BASKET_PORT=8080
Environment=AMQP_HOST=rabbitmq.fika.<domain>
Environment=AMQP_USER=fika
Environment=AMQP_PASS=fika123
ExecStart=/app/.venv/bin/gunicorn --config gunicorn.conf.py payment:app
SyslogIdentifier=payment
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```shell
systemctl daemon-reload
systemctl enable payment
systemctl start payment
```

## Verify

```shell
curl -s localhost:8080/health        # {"app":"OK","rabbitmq":true}
journalctl -u payment -n 20          # after an order: "order paid", with the order ID
```

| Method | Path | Answer |
|---|---|---|
| POST | `/pay/<basket>` | `{"user": "<name>"}` → 200 with `orderid`; 401 not logged in; 400 empty basket or no delivery choice; 503 a service or RabbitMQ is down |

## Security group

Allow **inbound TCP 8080** from `fika-frontend`.

## Troubleshooting

| You see | Cause |
|---|---|
| `/health` hangs about 5 s, then `"rabbitmq":false` | RabbitMQ security group doesn't allow fika-payment, or wrong `AMQP_HOST` |
| Pay answers `payments are paused, try again in a minute` | RabbitMQ unreachable at that moment: same checks |
| Pay answers `please log in first` while logged in | payment can't reach user: `USER_HOST`, user security group |
| Edited the service file but nothing changed | `systemctl daemon-reload && systemctl restart payment` |
