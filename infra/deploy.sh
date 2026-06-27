#!/usr/bin/env bash
# Deployt die gebaute App (app/dist/) nach doldenblick-01 und richtet den
# Bright-Sky-Reverse-Proxy in nginx ein. Idempotent, mit Backups + Rollback.
#
# Voraussetzungen: SSH-Key-Zugang als root (~/.ssh/id_ed25519), lokal: node/npm + rsync.
# Aufruf:  ./infra/deploy.sh [user@host]        (Default: root@91.98.203.240)
set -euo pipefail

HOST="${1:-root@91.98.203.240}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEBROOT=/var/www/html
SNIPPET=/etc/nginx/snippets/doldenblick-app.conf
CONF=/etc/nginx/sites-available/default
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=12"

echo "==> 1/4  App bauen (tsc + vite)"
( cd "$ROOT/app" && npm run build )

echo "==> 2/4  Backups + statisches Bundle nach $HOST:$WEBROOT"
TS=$(date +%Y%m%d-%H%M%S)
ssh $SSH_OPTS "$HOST" "cp -a $WEBROOT /root/webroot-backup.$TS && cp -a $CONF /root/nginx-default.bak.$TS"
rsync -az --delete -e "ssh $SSH_OPTS" "$ROOT/app/dist/" "$HOST:$WEBROOT/"
ssh $SSH_OPTS "$HOST" "chown -R root:root $WEBROOT"

echo "==> 3/4  Bright-Sky-Proxy-Snippet einspielen + einbinden (idempotent)"
scp $SSH_OPTS "$ROOT/infra/nginx-doldenblick.conf" "$HOST:$SNIPPET"
ssh $SSH_OPTS "$HOST" "grep -q 'doldenblick-app.conf' $CONF || { \
  awk '{print} /server_name www\\.doldenblick\\.de doldenblick\\.de/ {print \"    include snippets/doldenblick-app.conf;\"}' $CONF > $CONF.tmp && mv $CONF.tmp $CONF; }"

echo "==> 4/4  nginx testen + neu laden (Rollback bei Fehler)"
ssh $SSH_OPTS "$HOST" "nginx -t && systemctl reload nginx || { \
  cp -a \$(ls -t /root/nginx-default.bak.* | head -1) $CONF; nginx -t && systemctl reload nginx; echo 'ROLLBACK ausgeführt'; exit 1; }"

echo "Fertig → https://doldenblick.de"
