# 06 · user (Node.js)

The user service gives every visitor a guest ID (counted in Redis), creates accounts (passwords stored only as bcrypt hashes, in MongoDB), checks logins, and keeps each user's order history.

Server: **RHEL 9 practice AMI**, security group **fika-user**, DNS `user.fika.<domain>` → private IP. Needs [01-mongodb](01-mongodb.md) and [02-redis](02-redis.md).

## Install Node.js 24

```shell
dnf module disable nodejs -y
dnf module enable nodejs:24 -y
dnf install nodejs -y
```

## App user, download, install

```shell
useradd --system --home /app --shell /sbin/nologin --comment "fika system user" fika
mkdir /app
curl -L -o /tmp/user.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/user.tar.gz
cd /app
tar -xzf /tmp/user.tar.gz
npm install
```

## Service file

```shell
vim /etc/systemd/system/user.service
```

```ini
[Unit]
Description=Fika user service
After=network-online.target

[Service]
User=fika
Environment=MONGO_URL="mongodb://mongodb.fika.<domain>:27017/users"
Environment=REDIS_URL="redis://redis.fika.<domain>:6379"
ExecStart=/bin/node /app/server.js
SyslogIdentifier=user
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```shell
systemctl daemon-reload
systemctl enable user
systemctl start user
```

## Verify

```shell
curl -s localhost:8080/health        # {"app":"OK","mongo":true,"redis":true}
curl -s localhost:8080/uniqueid      # {"uuid":"guest-1"}, then guest-2, …
journalctl -u user -n 20
```

| Method | Path | Answer |
|---|---|---|
| GET | `/uniqueid` | a new guest ID (Redis `INCR guest-counter`) |
| POST | `/register` | `{name, email, password}` → 201, or 409 if the name is taken |
| POST | `/login` | `{name, password}` → 200, or 401 |
| GET | `/check/<name>` | 200 or 404, used by payment |
| POST | `/order/<name>` | saves an order to the history (status `paid`), used by payment |
| PUT | `/order/<name>/<orderid>/status` | `{status, pickupCode?, etaMinutes?}`, used by the kitchen |
| GET | `/order/<name>/<orderid>` | one order with its live status, used by the order page |
| GET | `/history/<name>` | the user's orders, newest first |

## Security group

Allow **inbound TCP 8080** from `fika-frontend`, `fika-payment` and `fika-kitchen` (the kitchen reports each order's status).

## Troubleshooting

| You see | Cause |
|---|---|
| `/health` 503 with `"redis":false` | Redis security group (allow fika-user), or Redis protected mode |
| `/health` 503 with `"mongo":false` | MongoDB security group (allow fika-user) |
| Sign in works, Pay says "please log in first" | payment can't reach user: check `USER_HOST` in payment.service |
