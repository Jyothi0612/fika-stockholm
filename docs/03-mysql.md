# 03 · MySQL

MySQL stores data in tables with fixed columns. Fika keeps the Stockholm districts here (name, postcode area, centre point), which delivery uses to price a bike ride.

| Database | Used by | Tables |
|---|---|---|
| `stockholm` | delivery | `districts` |

Server: **RHEL 9 practice AMI**, security group **fika-mysql**, DNS `mysql.fika.<domain>` → private IP.

## Install

```shell
dnf module enable mysql:8.4 -y
dnf install mysql-server -y
systemctl enable mysqld
systemctl start mysqld
```

## Configure

A new MySQL starts with an empty root password. Set it (`Fika@1`, or your own):

```shell
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'Fika@1';"
mysql -u root -pFika@1 -e "SELECT 1"      # prints 1: the password works
```

Don't use `mysql_secure_installation --set-root-pass`, as in older guides: that option was only in Red Hat's MySQL 8.0. MySQL 8.4 doesn't have it, so the password is never set and the next step fails with `ERROR 1045 Access denied for user 'root'@'localhost'`.

Running this a second time fails with `Access denied … (using password: NO)`: that only means the password is already set.

## Load the data, here on the MySQL server

Load the districts and create the app user **on this server**. root may only log in from localhost on MySQL 8, so loading the data from another server as root fails with `ERROR 1130 (HY000): Host '…' is not allowed to connect`.

```shell
curl -L -o /tmp/mysql-data.tar.gz https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/mysql-data.tar.gz
mkdir -p /tmp/fika-db && tar -xzf /tmp/mysql-data.tar.gz -C /tmp/fika-db
mysql -u root -pFika@1 < /tmp/fika-db/stockholm.sql
mysql -u root -pFika@1 < /tmp/fika-db/app-user.sql
```

- `stockholm.sql` creates the `stockholm` database (UTF-8, Swedish sort order, so Å Ä Ö sort after Z) and 21 districts. Safe to run again.
- `app-user.sql` creates the user `delivery` with password `Fika@123`. It may only **read** the `stockholm` database, and it may connect from any host; the security group decides which hosts can reach 3306.

## Verify

```shell
systemctl status mysqld
ss -lntp | grep 3306
mysql -u root -pFika@1 -e "SELECT name, postcode FROM stockholm.districts ORDER BY name;"
mysql -u root -pFika@1 -e "SELECT user, host FROM mysql.user;"      # delivery | %
```

## Security group

Allow **inbound TCP 3306** from `fika-delivery` only.

## Troubleshooting

| You see on this server | Cause |
|---|---|
| `ERROR 1045 Access denied for user 'root'@'localhost' (using password: YES)` | the root password was never set (e.g. `--set-root-pass` was used, which MySQL 8.4 rejects): run the `ALTER USER` step above without `-p` |
| `ERROR 1045 … (using password: NO)` | the root password is already set: add `-pFika@1` |

| You see on delivery | Cause |
|---|---|
| `"mysql":false`, and `Communications link failure` in the log | security group, or wrong `DB_HOST` |
| `Access denied for user 'delivery'` | `app-user.sql` was not loaded, or the password in `delivery.service` differs |
| District names like `Ã–stermalm` | data loaded without `SET NAMES utf8mb4`: reload `stockholm.sql` from this release |
