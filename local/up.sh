#!/bin/bash
# local test: fill fika.conf with the compose service names, then start everything
set -e
cd "$(dirname "$0")"
mkdir -p default.d
sed -e 's/<MENU-HOST>/menu/; s/<USER-HOST>/user/; s/<BASKET-HOST>/basket/; s/<DELIVERY-HOST>/delivery/; s/<PAYMENT-HOST>/payment/' ../conf/fika.conf > default.d/fika.conf
docker compose up -d
echo "open http://localhost:8090 (delivery and kitchen take a minute or two to build)"
