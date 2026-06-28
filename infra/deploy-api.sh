#!/usr/bin/env bash
# Deployt den DoldenBlick-Backend-Dienst (api/) nach doldenblick-01:
# Node 22 LTS sicherstellen → gebautes dist/ + package*.json → npm ci (prod) →
# systemd-Service (Loopback 8787) → nginx-/api/-Upstream (additiv). Idempotent, mit Rollback.
#
# Voraussetzungen: SSH-Key-Zugang als root (~/.ssh/id_ed25519); lokal node/npm + rsync.
# Aufruf:  ./infra/deploy-api.sh [user@host]        (Default: root@91.98.203.240)
set -euo pipefail

HOST="${1:-root@91.98.203.240}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR=/opt/doldenblick-api
SNIPPET=/etc/nginx/snippets/doldenblick-app.conf
SVC=/etc/systemd/system/doldenblick-api.service
SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"

echo "==> 1/7  API bauen (tsc)"
( cd "$ROOT/api" && npm ci && npm run build )

echo "==> 2/7  Node 22 LTS sicherstellen"
$SSH "$HOST" 'command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs; }; node -v'

echo "==> 3/7  Service-User + Zielverzeichnis"
$SSH "$HOST" "id doldenblick >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin doldenblick; mkdir -p $APPDIR"

echo "==> 4/7  Artefakte übertragen (dist + package*.json) + Prod-Deps"
rsync -az --delete -e "$SSH" "$ROOT/api/dist/" "$HOST:$APPDIR/dist/"
scp -o BatchMode=yes "$ROOT/api/package.json" "$ROOT/api/package-lock.json" "$HOST:$APPDIR/"
$SSH "$HOST" "cd $APPDIR && npm ci --omit=dev && chown -R doldenblick:doldenblick $APPDIR"

echo "==> 5/7  systemd-Unit installieren + starten"
scp -o BatchMode=yes "$ROOT/infra/doldenblick-api.service" "$HOST:$SVC"
# restart (nicht --now): zieht auch bei Re-Deploys den neuen Code; startet falls gestoppt.
$SSH "$HOST" "systemctl daemon-reload && systemctl enable doldenblick-api && systemctl restart doldenblick-api && systemctl is-active doldenblick-api"

echo "==> 6/7  nginx-Snippet (brightsky + api) einspielen + testen (Rollback bei Fehler)"
TS=$(date +%Y%m%d-%H%M%S)
$SSH "$HOST" "cp -a $SNIPPET /root/snippet-backup.$TS"
scp -o BatchMode=yes "$ROOT/infra/nginx-doldenblick.conf" "$HOST:$SNIPPET"
$SSH "$HOST" "nginx -t && systemctl reload nginx || { cp -a /root/snippet-backup.$TS $SNIPPET; nginx -t && systemctl reload nginx; echo 'ROLLBACK ausgeführt'; exit 1; }"

echo "==> 7/7  Loopback-Smoke"
$SSH "$HOST" "curl -fsS http://127.0.0.1:8787/api/health && echo"

echo "Fertig → https://doldenblick.de/api/version"
