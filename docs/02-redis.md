# 02 · Redis

Redis keeps data in RAM, so reads and writes are very fast. Fika uses it for two small, busy things:

| Used by | What it stores |
|---|---|
| user | `guest-counter`: every visitor gets a guest ID (`guest-1`, `guest-2`, …) before logging in |
| basket | `basket:<id>`: one basket per guest or user, as JSON, kept for 4 hours |

Server: **RHEL 9 practice AMI**, security group **fika-redis**, DNS `redis.fika.<domain>` → private IP.

## Install

```shell
dnf module disable redis -y
dnf module enable redis:7 -y
dnf install redis -y
```

## Configure

Listen on all interfaces, and turn off protected mode (the security group does the protecting):

```shell
sed -i -e 's/^bind 127.0.0.1/bind 0.0.0.0/' -e 's/^protected-mode yes/protected-mode no/' /etc/redis/redis.conf
systemctl enable redis
systemctl start redis
```

Changed `redis.conf` while Redis was already running? Use `systemctl restart redis`; `start` does nothing to a running service.

## Verify

```shell
systemctl status redis
ss -lntp | grep 6379       # 0.0.0.0:6379
redis-cli ping             # PONG
```

After a few orders:

```shell
redis-cli get guest-counter
redis-cli keys 'basket:*'
redis-cli get basket:<name>
```

## Security group

Allow **inbound TCP 6379** from `fika-user` and `fika-basket`.

## Troubleshooting

| You see | Cause |
|---|---|
| `"redis":false` on user or basket health, and `telnet redis.fika.<domain> 6379` hangs | security group |
| `-DENIED Redis is running in protected mode` | config changed but Redis not restarted: `systemctl restart redis` |
