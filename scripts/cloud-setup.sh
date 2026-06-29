#!/usr/bin/env bash
# Einmaliger Setup für Claude Code Web (Cloud-Umgebung).
# Im claude.ai/code-Environment unter „Setup script" eintragen:
#   bash scripts/cloud-setup.sh
#
# Erwartete Environment-Variablen (im claude.ai/code-Environment setzen — NICHT im Repo):
#   COPERNICUS_CLIENT_ID, COPERNICUS_CLIENT_SECRET   (CDSE OAuth)
#   OPENWEATHERMAP_API_KEY, HETZNER_API_TOKEN, GOOGLE_CLOUD_STORAGE_BUCKET,
#   POSTMARK_SERVER_API_TOKEN, POSTMARK_ACCOUNT_API_TOKEN
#   GOOGLE_APPLICATION_CREDENTIALS  = absoluter Zielpfad der GEE-Service-Account-JSON (z. B. /root/gee-sa.json)
#   GEE_SA_KEY_B64                  = base64 der GEE-Service-Account-JSON (lokal erzeugen, s. docs/claude-code-web.md)
#   SSH_DEPLOY_KEY_B64 (optional)   = base64 des Deploy-SSH-Privatekeys (nur falls aus der Cloud deployt wird)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> npm ci (app, api, rs)"
for d in app api rs; do
  if [ -f "$ROOT/$d/package-lock.json" ]; then ( cd "$ROOT/$d" && npm ci ); fi
done

echo "==> GEE-Service-Account-JSON materialisieren"
if [ -n "${GEE_SA_KEY_B64:-}" ] && [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  mkdir -p "$(dirname "$GOOGLE_APPLICATION_CREDENTIALS")"
  umask 077
  printf '%s' "$GEE_SA_KEY_B64" | base64 -d > "$GOOGLE_APPLICATION_CREDENTIALS"
  chmod 600 "$GOOGLE_APPLICATION_CREDENTIALS"
  echo "  → $GOOGLE_APPLICATION_CREDENTIALS"
else
  echo "  (GEE_SA_KEY_B64/GOOGLE_APPLICATION_CREDENTIALS nicht gesetzt — übersprungen; GEE-Backtest dann n/a)"
fi

echo "==> SSH-Deploy-Key materialisieren (optional)"
if [ -n "${SSH_DEPLOY_KEY_B64:-}" ]; then
  mkdir -p "$HOME/.ssh"; umask 077
  printf '%s' "$SSH_DEPLOY_KEY_B64" | base64 -d > "$HOME/.ssh/id_ed25519"
  chmod 600 "$HOME/.ssh/id_ed25519"
  echo "  → $HOME/.ssh/id_ed25519 (für Deploy nach doldenblick-01)"
else
  echo "  (SSH_DEPLOY_KEY_B64 nicht gesetzt — kein Cloud-Deploy; lokal oder via CI deployen)"
fi

echo "==> fertig. CDSE/OWM/Hetzner-Keys stehen als process.env zur Verfügung (kein .env nötig)."
