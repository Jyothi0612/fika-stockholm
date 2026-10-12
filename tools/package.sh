#!/bin/bash
# Build one .tar.gz per server into dist/. Each one is extracted straight into /app on its server.
# Published as GitHub release assets: https://github.com/Jyothi0612/fika-stockholm/releases/latest/download/<name>.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
X="--exclude=node_modules --exclude=__pycache__ --exclude=target --exclude=.venv --exclude=kitchen/kitchen --exclude=.DS_Store"
tar $X -czf dist/menu.tar.gz     -C services/menu     server.js package.json package-lock.json -C ../.. db/menu-data.js
tar $X -czf dist/user.tar.gz     -C services/user     server.js package.json package-lock.json
tar $X -czf dist/basket.tar.gz   -C services/basket   basket.py requirements.txt gunicorn.conf.py
tar $X -czf dist/payment.tar.gz  -C services/payment  payment.py requirements.txt gunicorn.conf.py
tar $X -czf dist/delivery.tar.gz -C services/delivery pom.xml src
tar $X -czf dist/kitchen.tar.gz  -C services/kitchen  main.go go.mod go.sum
tar $X -czf dist/frontend.tar.gz -C frontend/html     .
tar $X -czf dist/mysql-data.tar.gz -C db stockholm.sql app-user.sql
for f in dist/*.tar.gz; do echo "$f: $(tar -tzf "$f" | tr '\n' ' ')"; done
