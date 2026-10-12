# 01 · MongoDB

MongoDB stores documents (JSON). Fika keeps the cafés, menu items, users and their order history here.

| Database | Used by | Collections |
|---|---|---|
| `menu` | menu | `cafes`, `items` |
| `users` | user | `users`, `orders` |

Server: **RHEL 9 practice AMI**, security group **fika-mongodb**, DNS `mongodb.fika.<domain>` → private IP.

## Install

MongoDB is not in the RHEL repositories, so add the MongoDB repo:

```shell
vim /etc/yum.repos.d/mongo.repo
```

```ini
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
```

```shell
dnf install mongodb-org -y
systemctl enable mongod
systemctl start mongod
```

## Configure

By default MongoDB only listens on `127.0.0.1`, so the other servers can't reach it. Listen on all interfaces:

```shell
sed -i 's/127.0.0.1/0.0.0.0/' /etc/mongod.conf
systemctl restart mongod
```

`restart`, not `start`: mongod is already running and only reads the config when it starts.

## Verify

```shell
systemctl status mongod
ss -lntp | grep 27017      # should show 0.0.0.0:27017
```

The data is loaded later, from the menu server ([05-menu](05-menu.md)). After that:

```shell
mongosh --quiet --eval 'db.getSiblingDB("menu").items.countDocuments()'   # 26
```

## Security group

Allow **inbound TCP 27017** from `fika-menu` and `fika-user` only.

## Troubleshooting

| You see (on menu or user) | Cause |
|---|---|
| `MongoServerSelectionError: … timed out` | security group, or the DNS name points to the wrong IP |
| `connect ECONNREFUSED …:27017` | mongod stopped, or still on 127.0.0.1: check `ss -lntp` |
