# 05 · menu (Node.js)

The menu service lists the cafés and what they sell. It reads the `menu` database in MongoDB. basket and delivery ask it for prices, stock and café locations.

Server: **RHEL 9 practice AMI**, security group **fika-menu**, DNS `menu.fika.<domain>` → private IP. Needs [01-mongodb](01-mongodb.md) first.

## Install Node.js 24

```shell
dnf module disable nodejs -y
dnf module enable nodejs:24 -y
dnf install nodejs -y
node -v
```

## App user and folder

Run the app as a system user with no login shell:

```shell
useradd --system --home /app --shell /sbin/nologin --comment "fika system user" fika
mkdir /app
```

## Download and install

```shell
curl -L -o /tmp/menu.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/menu.tar.gz
cd /app
tar -xzf /tmp/menu.tar.gz
npm install
```

`npm install` reads `package.json` and installs the exact versions in `package-lock.json` into `/app/node_modules`.

## Load the menu data

The cafés and items come with the code, in `db/menu-data.js`. Install the MongoDB shell and load them:

```shell
vim /etc/yum.repos.d/mongo.repo     # same repo file as in 01-mongodb
dnf install mongodb-mongosh -y
mongosh --host mongodb.fika.<domain> </app/db/menu-data.js
```

It prints `menu: 6 cafés, 26 items`. Safe to run again.

## Service file

```shell
vim /etc/systemd/system/menu.service
```

```ini
[Unit]
Description=Fika menu service
After=network-online.target

[Service]
User=fika
Environment=MONGO_URL="mongodb://mongodb.fika.<domain>:27017/menu"
ExecStart=/bin/node /app/server.js
SyslogIdentifier=menu
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```shell
systemctl daemon-reload
systemctl enable menu
systemctl start menu
```

## Verify

```shell
systemctl status menu
curl -s localhost:8080/health        # {"app":"OK","mongo":true}
curl -s localhost:8080/cafes
curl -s localhost:8080/cafes/hasselby/items
journalctl -u menu -n 20
```

| Method | Path | Answer |
|---|---|---|
| GET | `/cafes` | all cafés |
| GET | `/cafes/<id>` | one café, with its location (used by delivery) |
| GET | `/cafes/<id>/items` | that café's items |
| GET | `/item/<sku>` | one item with price and stock (used by basket) |
| GET | `/search/<text>` | items whose name or description match |

## Security group

Allow **inbound TCP 8080** from `fika-frontend`, `fika-basket` and `fika-delivery`.

## Troubleshooting

| You see | Cause |
|---|---|
| `/health` gives `"mongo":false`, log says `MongoDB not reachable, retrying in 5s` | MongoDB security group, DNS name, or mongod on 127.0.0.1 |
| `/cafes` is `[]` | the menu data was not loaded |
