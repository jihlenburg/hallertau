#!/usr/bin/env bash
# Tägliches Postgres-Backup des Infisical-Stacks (pg_dump -Fc), Rotation auf 14 Stände.
# WICHTIG: Der Dump ist mit ENCRYPTION_KEY verschlüsselt — Key separat OFF-BOX sichern, sonst nutzlos.
set -euo pipefail
cd /opt/infisical
mkdir -p backups
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="backups/infisical-$TS.dump"
docker compose exec -T db pg_dump -Fc -U infisical infisical > "$OUT"
ls -1t backups/infisical-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
