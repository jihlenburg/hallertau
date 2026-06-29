#!/usr/bin/env bash
# Zieht die gepinnten Images, startet den Stack, wartet auf Backend-Health.
set -euo pipefail
cd /opt/infisical
docker compose pull
docker compose up -d
echo "== compose ps =="; docker compose ps
echo "== warte auf Backend-Health (/api/status) =="
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/status || true)
  if [ "$code" = "200" ]; then
    echo "BACKEND HEALTHY (/api/status 200) nach ~$((i*6))s"
    curl -s http://127.0.0.1:8080/api/status; echo
    docker compose ps
    exit 0
  fi
  sleep 6
done
echo "TIMEOUT — Backend nicht healthy"
docker compose ps
echo "== backend logs (tail) =="; docker compose logs --tail=50 backend
exit 1
