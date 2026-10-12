# 08 · delivery (Java + Maven)

The delivery service prices pickup or a bike delivery. It reads the districts from MySQL, asks menu where the café is, works out the distance, the minutes (10 to prepare, bikes at about 15 km/h) and the fee (demo pricing: 39 kr + 9 kr per km), and writes the choice into the basket.

Server: **RHEL 9 practice AMI**, security group **fika-delivery**, DNS `delivery.fika.<domain>` → private IP. Needs [03-mysql](03-mysql.md), [05-menu](05-menu.md) and [07-basket](07-basket.md).

It is written in Java with Spring Boot. **Maven** downloads the libraries and builds one `.jar` file. Use **at least 1 GB of RAM** (t3.micro is fine); the build takes a few minutes the first time.

## Install Java 25 and Maven

```shell
dnf module enable maven:3.9 -y
dnf install maven java-25-openjdk-devel -y
```

`dnf install maven` also brings an older Java (21), and makes it the default. Choose Java 25:

```shell
alternatives --config java       # type the number of the java-25-openjdk line
```

Maven finds Java through `JAVA_HOME`. The folder name contains the full version, so read it from the `java` symlink, and save it for every login:

```shell
echo "export JAVA_HOME=$(dirname $(dirname $(readlink -f /usr/bin/java)))" > /etc/profile.d/java.sh
source /etc/profile.d/java.sh
java -version     # 25
mvn -v            # Maven 3.9, Java version: 25
```

## App user, download, build

```shell
useradd --system --home /app --shell /sbin/nologin --comment "fika system user" fika
mkdir /app
curl -L -o /tmp/delivery.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/delivery.tar.gz
cd /app
tar -xzf /tmp/delivery.tar.gz
mvn clean package
mv target/delivery.jar delivery.jar
```

`mvn clean package` reads `pom.xml`, downloads the libraries into `~/.m2/repository`, compiles, runs the tests and packages `target/delivery.jar`.

## Service file

```shell
vim /etc/systemd/system/delivery.service
```

```ini
[Unit]
Description=Fika delivery service
After=network-online.target

[Service]
User=fika
Environment=DB_HOST=mysql.fika.<domain>
Environment=DB_USER=delivery
Environment=DB_PASS=Fika@123
Environment=MENU_HOST=menu.fika.<domain>
Environment=BASKET_HOST=basket.fika.<domain>
ExecStart=/bin/java -jar /app/delivery.jar
SyslogIdentifier=delivery
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```shell
systemctl daemon-reload
systemctl enable delivery
systemctl start delivery
```

Java takes 10 to 20 seconds to start; `/health` answers after that.

## Verify

```shell
curl -s localhost:8080/health                                 # {"app":"OK","mysql":true}
curl -s localhost:8080/districts | head -c 300
curl -s "localhost:8080/quote/hasselby/21?mode=delivery"      # Strandbageriet → Hässelby: 0.4 km, 12 min, 43 kr
journalctl -u delivery -n 20
```

| Method | Path | Answer |
|---|---|---|
| GET | `/districts` | all districts, sorted the Swedish way |
| GET | `/quote/<cafe>/<district>?mode=delivery\|pickup` | km, minutes, fee |
| POST | `/confirm/<basket>/<cafe>/<district>?mode=…` | prices it and writes it into the basket |

## Security group

Allow **inbound TCP 8080** from `fika-frontend`.

## Troubleshooting

| You see | Cause |
|---|---|
| `mvn` says `release version 25 not supported` | Maven still uses Java 21: `alternatives --config java`, then `source /etc/profile.d/java.sh` |
| `"mysql":false`, `Communications link failure` | MySQL security group (allow fika-delivery) or `DB_HOST` |
| `Access denied for user 'delivery'` | `app-user.sql` not loaded on the MySQL server |
| quote says `menu not reachable` | `MENU_HOST`, or the menu security group doesn't allow fika-delivery |
