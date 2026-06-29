# DoldenBlick — Self-hosted Infisical (Vault)

Selbstgehosteter Secrets-Manager. **Dedizierte** Box (Isolation = der Sinn des Self-Hostings); Prod
(`doldenblick-01`) hängt **nicht** in einer Boot-/Runtime-Abhängigkeit — Infisical ist **Sync-Quelle**.

## Topologie
- Box **doldenblick-vault** (Hetzner `cx23`/x86, nbg1). Öffentliche IP nur SSH (Cloud-Firewall = Admin-IP),
  privat **10.0.0.2** im Netz `doldenblick-net` (10.0.0.0/16, eu-central).
- Stack (Docker Compose in `/opt/infisical`): **Infisical v0.161.9 + Postgres 16 + Redis 7**.
  - Backend nur an `127.0.0.1:8080` (SSH-Tunnel-Admin) **und** `10.0.0.2:8080` (privat, für Prod) gebunden.
  - db/redis ohne Host-Ports. Secrets in `/opt/infisical/.env` (0600, on-box erzeugt) — **nie** im Repo.
- 2 GB Swap; `unattended-upgrades` (Security + ESM-Security + Updates) + Auto-Reboot 04:30.

## Admin-Zugang (kein öffentlicher Port)
```
ssh -L 8080:127.0.0.1:8080 root@<public-ip>     # dann http://localhost:8080
```
Erst-Admin via Headless-Bootstrap (`POST /api/v1/admin/bootstrap`); Passwort + Automations-Token
root-only in `/opt/infisical/admin-credentials.txt`. E-Mail/SMTP: **Postmark** (s. `REFERENCE.md` §5.5)
→ Passwort-Reset / E-Mail-MFA aktiv.

## Dateien
- `docker-compose.yml` — gehärteter Stack (gepinnte Tags, mem_limits, Bindings).
- `setup-env.sh` — erzeugt `/opt/infisical/.env` on-box (Secrets, nie ausgegeben).
- `bringup.sh` — `compose pull` + `up` + Health-Poll.
- `harden-updates.sh` — Backlog anwenden + `unattended-upgrades`-Härtung.

## Prod-Sync (LIVE seit 2026-06-29)
`doldenblick-01` (privat 10.0.0.3) holt seine Secrets aus Infisical via `doldenblick-secrets-sync.py`
(+ `.service`/`.timer`, alle 10 min, fail-safe): rendert `/etc/doldenblick/doldenblick-rs.env`, systemd
`EnvironmentFile=` unverändert. Bei Vault-Ausfall = no-op (Datei bleibt) → Prod bootet/läuft weiter. Identität:
read-only `viewer` (verifiziert). pg_dump-Backup-Cron aktiv.

## Offen (Tightening, kein Blocker)
- Custom read-only-Rolle nur `prod`-Env (statt `viewer`). Postgres-Restore-Drill. Voller Cold-Boot-Test (opt.).

⚠️ Niemals Secret-Werte ins Repo. `.env` und `admin-credentials.txt` bleiben on-box (0600).
