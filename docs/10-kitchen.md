# 10 · kitchen (Go)

The kitchen is a worker, not a web service: it has **no port**. It reads the `orders` queue in RabbitMQ, "bakes" each order (a short pause per item), and logs whether it is ready for pickup or out for delivery by bike. Because it only reads the queue, orders wait safely whenever the kitchen is down.

Server: **RHEL 9 practice AMI**, security group **fika-kitchen**, DNS `kitchen.fika.<domain>` → private IP (optional). Needs [04-rabbitmq](04-rabbitmq.md).

## Install Go

```shell
dnf install golang -y
go version
```

## App user, download, build

```shell
useradd --system --home /app --shell /sbin/nologin --comment "fika system user" fika
mkdir /app
curl -L -o /tmp/kitchen.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/kitchen.tar.gz
cd /app
tar -xzf /tmp/kitchen.tar.gz
go build -o kitchen .
```

`go.mod` and `go.sum` list the exact libraries, like `package.json` and `package-lock.json`. `go build` downloads them, checks them against `go.sum`, and creates the binary `/app/kitchen`.

## Service file

```shell
vim /etc/systemd/system/kitchen.service
```

```ini
[Unit]
Description=Fika kitchen worker
After=network-online.target

[Service]
User=fika
Environment=AMQP_HOST=rabbitmq.fika.<domain>
Environment=AMQP_USER=fika
Environment=AMQP_PASS=fika123
ExecStart=/app/kitchen
SyslogIdentifier=kitchen
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```shell
systemctl daemon-reload
systemctl enable kitchen
systemctl start kitchen
```

## Verify

There is no `/health`: read the log.

```shell
journalctl -u kitchen -f
```

```json
{"level":"INFO","msg":"connected to RabbitMQ, waiting for orders","service":"kitchen","queue":"orders"}
{"level":"INFO","msg":"order received","orderid":"…","user":"anna","items":3,"total":198,"cafe":"Bullhörnan","requestId":"…"}
{"level":"INFO","msg":"order out for delivery by bike","orderid":"…","district":"Östermalm","etaMinutes":20}
```

The `requestId` is the one nginx created for the click on Pay, so you can find the same order in the nginx and payment logs.

On the RabbitMQ server, `rabbitmqctl list_queues name messages consumers` should show `orders 0 1`.

## Security group

No inbound rules (SSH only). The kitchen connects **out** to RabbitMQ 5672, so the **RabbitMQ** group must allow `fika-kitchen`.

## Troubleshooting

| You see | Cause |
|---|---|
| `lost connection to RabbitMQ, retrying in 5s … i/o timeout` | the RabbitMQ security group doesn't allow fika-kitchen (payment can still work, so this is easy to miss) |
| `… connection refused` | RabbitMQ is down, or `AMQP_HOST` points to the wrong server |
| `ACCESS_REFUSED` | user `fika` missing on RabbitMQ, or wrong password |
| Orders paid but nothing in this log | check `messages` in `rabbitmqctl list_queues`: if it grows, the kitchen isn't connected |
