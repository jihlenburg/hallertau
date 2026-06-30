#!/usr/bin/env bash
# Deployt den DoldenBlick-Accounts-Dienst (accounts/) nach doldenblick-01:
# gebautes dist/ + prod-Deps + Migrationen → systemd (Loopback 8789) → nginx-Locations (additiv).
#
# VORAUSSETZUNGEN (gated, separat eingerichtet — siehe Task 14):
#   - Postgres auf doldenblick-01, DB 'doldenblick' + Rolle vorhanden
#   - Infisical-prod-Secrets: ACCOUNTS_DATABASE_URL→DATABASE_URL, SESSION_SIGNING_KEY,
#     RP_ID, RP_ORIGIN, SITE_URL, POSTMARK_SERVER_API_TOKEN
#   - secrets-sync rendert /etc/doldenblick/doldenblick-accounts.env (root:root 600)
# Aufruf:  ./infra/deploy-accounts.sh [user@host]   (Default: root@91.98.203.240)
set -euo pipefail
HOST="${1:-root@91.98.203.240}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR=/opt/doldenblick-accounts
SNIPPET=/etc/nginx/snippets/doldenblick-app.conf
SVC=/etc/systemd/system/doldenblick-accounts.service
ENVF=/etc/doldenblick/doldenblick-accounts.env
SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"

echo "==> 1/8  Accounts bauen (tsc)"
( cd "$ROOT/accounts" && npm ci && npm run build )

echo "==> 2/8  Node 22 sicherstellen"
$SSH "$HOST" 'command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs; }; node -v'

echo "==> 3/8  Service-User + Zielverzeichnis"
$SSH "$HOST" "id doldenblick >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin doldenblick; mkdir -p $APPDIR"

echo "==> 4/8  Artefakte + Migrationen + Prod-Deps"
rsync -az --delete -e "$SSH" "$ROOT/accounts/dist/" "$HOST:$APPDIR/dist/"
rsync -az --delete -e "$SSH" "$ROOT/accounts/migrations/" "$HOST:$APPDIR/migrations/"
scp -o BatchMode=yes "$ROOT/accounts/package.json" "$ROOT/accounts/package-lock.json" "$HOST:$APPDIR/"
$SSH "$HOST" "cd $APPDIR && npm ci --omit=dev && chown -R doldenblick:doldenblick $APPDIR"

echo "==> 5/8  EnvironmentFile prüfen (vom Infisical-Sync gerendert)"
$SSH "$HOST" "test -s $ENVF || { echo 'FEHLER: $ENVF fehlt — erst Infisical-Secrets + secrets-sync einrichten (gated)'; exit 1; }"

echo "==> 6/8  Migrationen (node-pg-migrate up)"
$SSH "$HOST" "cd $APPDIR && set -a; . $ENVF; set +a; npx --yes node-pg-migrate -m migrations up"

echo "==> 7/8  systemd-Unit + (neu)starten; nginx-Snippet + Rollback"
scp -o BatchMode=yes "$ROOT/infra/doldenblick-accounts.service" "$HOST:$SVC"
$SSH "$HOST" "systemctl daemon-reload && systemctl enable doldenblick-accounts && systemctl restart doldenblick-accounts && systemctl is-active doldenblick-accounts"
TS=$(date +%Y%m%d-%H%M%S)
$SSH "$HOST" "cp -a $SNIPPET /root/snippet-backup.$TS"
scp -o BatchMode=yes "$ROOT/infra/nginx-doldenblick.conf" "$HOST:$SNIPPET"
$SSH "$HOST" "nginx -t && systemctl reload nginx || { cp -a /root/snippet-backup.$TS $SNIPPET; nginx -t && systemctl reload nginx; echo 'ROLLBACK ausgeführt'; exit 1; }"

echo "==> 8/8  Loopback-Smoke"
$SSH "$HOST" "curl -fsS http://127.0.0.1:8789/api/accounts/health && echo"
echo "Fertig → https://doldenblick.de/api/accounts/version"
