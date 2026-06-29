#!/usr/bin/env bash
# Erzeugt /opt/infisical/.env mit frischen Secrets ON-BOX (Werte werden NICHT ausgegeben).
# ENCRYPTION_KEY + AUTH_SECRET sind die Kronjuwelen — separat OFF-BOX sichern (Passwortmanager).
set -euo pipefail
cd /opt/infisical
umask 077
if [ -f .env ]; then echo ".env existiert bereits — unverändert gelassen"; exit 0; fi
ENCRYPTION_KEY=$(openssl rand -hex 16)
AUTH_SECRET=$(openssl rand -base64 32)
PG_PW=$(openssl rand -hex 24)
REDIS_PW=$(openssl rand -hex 24)
cat > .env <<EOF
ENCRYPTION_KEY=$ENCRYPTION_KEY
AUTH_SECRET=$AUTH_SECRET
POSTGRES_PASSWORD=$PG_PW
REDIS_PASSWORD=$REDIS_PW
DB_CONNECTION_URI=postgres://infisical:$PG_PW@db:5432/infisical
REDIS_URL=redis://default:$REDIS_PW@redis:6379
SITE_URL=http://localhost:8080
HTTPS_ENABLED=false
HOST=0.0.0.0
PORT=8080
TELEMETRY_ENABLED=false
EOF
chmod 600 .env
echo "OK: /opt/infisical/.env (0600) geschrieben — Secrets nicht ausgegeben"
