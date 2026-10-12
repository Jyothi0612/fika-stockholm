# 04 · RabbitMQ

RabbitMQ is a message queue. Payment puts each paid order on the `orders` queue and moves on; the kitchen takes orders off the queue when it is ready. If the kitchen is down, the orders simply wait in the queue.

| Queue | Sent by | Read by |
|---|---|---|
| `orders` | payment | kitchen |

Server: **RHEL 9 practice AMI**, security group **fika-rabbitmq**, DNS `rabbitmq.fika.<domain>` → private IP.

## Install

RabbitMQ and the Erlang version it needs come from the RabbitMQ team's own repositories:

```shell
vim /etc/yum.repos.d/rabbitmq.repo
```

```ini
[modern-erlang]
name=modern-erlang-el9
baseurl=https://yum1.rabbitmq.com/erlang/el/9/$basearch
        https://yum2.rabbitmq.com/erlang/el/9/$basearch
repo_gpgcheck=1
enabled=1
gpgkey=https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key
gpgcheck=1
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
pkg_gpgcheck=1
autorefresh=1
type=rpm-md

[modern-erlang-noarch]
name=modern-erlang-el9-noarch
baseurl=https://yum1.rabbitmq.com/erlang/el/9/noarch
        https://yum2.rabbitmq.com/erlang/el/9/noarch
repo_gpgcheck=1
enabled=1
gpgkey=https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key
       https://github.com/rabbitmq/signing-keys/releases/download/3.0/rabbitmq-release-signing-key.asc
gpgcheck=1
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
pkg_gpgcheck=1
autorefresh=1
type=rpm-md

[rabbitmq-el9]
name=rabbitmq-el9
baseurl=https://yum2.rabbitmq.com/rabbitmq/el/9/$basearch
        https://yum1.rabbitmq.com/rabbitmq/el/9/$basearch
repo_gpgcheck=1
enabled=1
gpgkey=https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-server.9F4587F226208342.key
       https://github.com/rabbitmq/signing-keys/releases/download/3.0/rabbitmq-release-signing-key.asc
gpgcheck=1
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
pkg_gpgcheck=1
autorefresh=1
type=rpm-md

[rabbitmq-el9-noarch]
name=rabbitmq-el9-noarch
baseurl=https://yum2.rabbitmq.com/rabbitmq/el/9/noarch
        https://yum1.rabbitmq.com/rabbitmq/el/9/noarch
repo_gpgcheck=1
enabled=1
gpgkey=https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-server.9F4587F226208342.key
       https://github.com/rabbitmq/signing-keys/releases/download/3.0/rabbitmq-release-signing-key.asc
gpgcheck=1
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
pkg_gpgcheck=1
autorefresh=1
type=rpm-md
```

```shell
dnf install erlang rabbitmq-server -y
systemctl enable rabbitmq-server
systemctl start rabbitmq-server
```

## Configure

The built-in `guest` user can only log in from localhost. Create the user the services use:

```shell
rabbitmqctl add_user fika fika123
rabbitmqctl set_permissions -p / fika ".*" ".*" ".*"
```

## Verify

```shell
systemctl status rabbitmq-server
ss -lntp | grep 5672
rabbitmqctl list_users
rabbitmqctl list_queues name messages consumers     # after the kitchen starts: orders 0 1
```

`messages` is how many orders are waiting; `consumers` is how many kitchens are reading. Stop the kitchen, place an order, and watch `messages` go to 1.

## Security group

Allow **inbound TCP 5672** from `fika-payment` and `fika-kitchen`.

## Troubleshooting

| You see | Cause |
|---|---|
| payment health `"rabbitmq":false`, or kitchen log `dial tcp …:5672: i/o timeout` | security group (check **both** payment and kitchen are allowed) |
| `ACCESS_REFUSED - Login was refused` | user `fika` missing or wrong password in the service file |
