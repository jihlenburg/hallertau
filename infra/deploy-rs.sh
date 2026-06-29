#!/usr/bin/env bash
# Deployt den DoldenBlick-RS-Dienst (rs/, Satelliten-Feld-Check) nach doldenblick-01:
# gebautes dist/ + prod-Deps → systemd (Loopback 8788) → nginx-/api/-Locations (additiv).
# CDSE-Credentials werden als root:root-600-EnvironmentFile geschrieben (aus der Umgebung,
# nie im Repo/Log). Idempotent, mit nginx-Rollback.
#
# Voraussetzungen: SSH-Key-Zugang als root; lokal node/npm + rsync; für Schritt 5 müssen
# COPERNICUS_CLIENT_ID/SECRET in der Umgebung sein (z. B. `set -a; . ./.env; set +a`).
# Aufruf:  set -a; . ./.env; set +a; ./infra/deploy-rs.sh [user@host]
set -euo pipefail

HOST="${1:-root@91.98.203.240}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR=/opt/doldenblick-rs
SNIPPET=/etc/nginx/snippets/doldenblick-app.conf
SVC=/etc/systemd/system/doldenblick-rs.service
ENVF=/etc/doldenblick/doldenblick-rs.env
SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"

echo "==> 1/8  RS bauen (tsc)"
( cd "$ROOT/rs" && npm ci && npm run build )

echo "==> 2/8  Node 22 sicherstellen"
$SSH "$HOST" 'command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs; }; node -v'

echo "==> 3/8  Service-User + Zielverzeichnis"
$SSH "$HOST" "id doldenblick >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin doldenblick; mkdir -p $APPDIR"

echo "==> 4/8  Artefakte + Prod-Deps"
rsync -az --delete -e "$SSH" "$ROOT/rs/dist/" "$HOST:$APPDIR/dist/"
scp -o BatchMode=yes "$ROOT/rs/package.json" "$ROOT/rs/package-lock.json" "$HOST:$APPDIR/"
$SSH "$HOST" "cd $APPDIR && npm ci --omit=dev && chown -R doldenblick:doldenblick $APPDIR"

echo "==> 5/8  CDSE-Credentials als EnvironmentFile (root:root 600)"
if [ -n "${COPERNICUS_CLIENT_ID:-}" ] && [ -n "${COPERNICUS_CLIENT_SECRET:-}" ]; then
  $SSH "$HOST" "umask 077; mkdir -p /etc/doldenblick; cat > $ENVF" <<EOF
COPERNICUS_CLIENT_ID=$COPERNICUS_CLIENT_ID
COPERNICUS_CLIENT_SECRET=$COPERNICUS_CLIENT_SECRET
EOF
  $SSH "$HOST" "chown root:root $ENVF && chmod 600 $ENVF && echo '  EnvironmentFile gesetzt'"
else
  echo "  WARNUNG: COPERNICUS_CLIENT_ID/SECRET nicht in der Umgebung — EnvironmentFile NICHT geschrieben."
  echo "          Der Dienst startet, /api/field-vigor liefert bis dahin 502."
  $SSH "$HOST" "test -f $ENVF || { umask 077; mkdir -p /etc/doldenblick; printf 'COPERNICUS_CLIENT_ID=\nCOPERNICUS_CLIENT_SECRET=\n' > $ENVF; chmod 600 $ENVF; }"
fi

echo "==> 6/8  systemd-Unit installieren + (neu)starten"
scp -o BatchMode=yes "$ROOT/infra/doldenblick-rs.service" "$HOST:$SVC"
$SSH "$HOST" "systemctl daemon-reload && systemctl enable doldenblick-rs && systemctl restart doldenblick-rs && systemctl is-active doldenblick-rs"

echo "==> 7/8  nginx-Snippet (brightsky + api + rs) + Rollback"
TS=$(date +%Y%m%d-%H%M%S)
$SSH "$HOST" "cp -a $SNIPPET /root/snippet-backup.$TS"
scp -o BatchMode=yes "$ROOT/infra/nginx-doldenblick.conf" "$HOST:$SNIPPET"
$SSH "$HOST" "nginx -t && systemctl reload nginx || { cp -a /root/snippet-backup.$TS $SNIPPET; nginx -t && systemctl reload nginx; echo 'ROLLBACK ausgeführt'; exit 1; }"

echo "==> 8/8  Loopback-Smoke"
$SSH "$HOST" "curl -fsS http://127.0.0.1:8788/api/rs/health && echo"
echo "Fertig → https://doldenblick.de/api/rs/version"
