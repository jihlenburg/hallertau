# Infrastruktur — DoldenBlick

**Stand:** 2026-06-27. Hosting bei **Hetzner Cloud**. Namenskonvention: Infrastruktur =
**„Hallertau"** (Repo, Hetzner-Projekt), Produkt/Marke = **„DoldenBlick"** (s. `docs/naming.md`).

> Zugangsdaten (Hetzner Cloud API-Token) stehen ausschließlich in `.env`
> (`HETZNER_API_TOKEN`, gitignored). **Nicht** in dieses Dokument aufnehmen.
> Der Token ist projektgebunden (Hetzner-Projekt „Hallertau"); er kann **keine**
> Projekte anlegen und **keine** Domains registrieren — beides ist Console-/Registrar-Sache.

## Server `doldenblick-01`
| | |
|---|---|
| Hetzner-Projekt | Hallertau |
| Server-ID | `145742852` |
| Typ | `cx23` (2 vCPU / 4 GB / 40 GB, x86) — ≈ €6.53/mo + IPv4 |
| Standort | Nuremberg (`nbg1`) |
| Image | Ubuntu 24.04 LTS |
| IPv4 | `91.98.203.240` |
| IPv6 | `2a01:4f8:1c18:6e05::1` (/64-Block: `2a01:4f8:1c18:6e05::/64`) |
| SSH | `ssh root@91.98.203.240` mit `~/.ssh/id_ed25519` — **nur Key**, kein Passwort |
| SSH-Key in Projekt | id `114361592` (`jihlenburg@macbook-pro-m1`) |
| Webserver | nginx 1.24; serviert die **DoldenBlick-App** (Vite-Build aus `app/dist/`) + Bright-Sky-Reverse-Proxy |

Erstinstallation via **cloud-init** (`infra/cloud-init.yml`): nginx + Platzhalter, ufw,
Passwort-Login aus. Die Platzhalterseite wurde durch die App ersetzt (s. Deployment).

## Deployment der App
- **Skript:** `infra/deploy.sh [user@host]` (Default `root@91.98.203.240`) — baut die App,
  spielt `app/dist/` per `rsync --delete` nach `/var/www/html`, legt das nginx-Snippet
  `infra/nginx-doldenblick.conf` als `/etc/nginx/snippets/doldenblick-app.conf` ab und bindet
  es per `include` in den 443-Server-Block ein; `nginx -t` + Reload mit Rollback. Idempotent,
  mit Backups (`/root/webroot-backup.*`, `/root/nginx-default.bak.*`).
- **Architektur:** rein statische SPA (kein Backend, State im `localStorage`). Open-Meteo und
  die Kartendienste laufen browser-direkt (CORS, HTTPS); **nur Bright Sky** (DWD-Warnungen) geht
  über den nginx-Proxy `/api/brightsky/` → `https://api.brightsky.dev/`. Keine Secrets/API-Keys.
- **Verifiziert (2026-06-28):** `https://doldenblick.de` liefert die App (HTTP 200), Assets laden,
  `/api/brightsky/alerts` liefert JSON, 80→443-Redirect intakt; Overview rendert mit Live-Daten.

## DNS — Zone `doldenblick.de`
| | |
|---|---|
| Zone-ID | `1421900` (Hetzner Cloud DNS, `mode=primary`) |
| Registrar | Hetzner; Delegation `.de` → `hydrogen`/`oxygen`.ns.hetzner.com, `helium`.ns.hetzner.de |
| Records | `A`/`AAAA` für `@` und `www` → Server; `CAA 0 issue "letsencrypt.org"` |

Verwaltet über die in den Hetzner-**Cloud-API** integrierte DNS:
`GET/POST https://api.hetzner.cloud/v1/zones/1421900/rrsets` (RRSet-Modell, Bearer-Token).
Die alte `dns.hetzner.com`-API ist abgelöst (301 → console.hetzner.com).

## TLS / HTTPS
- **Let's Encrypt** (certbot `--nginx`) für `doldenblick.de` + `www`, 80→443-Redirect.
- Auto-Renewal via `certbot.timer` (Dry-Run erfolgreich getestet).
- CAA-Record beschränkt Ausstellung auf Let's Encrypt.

## Härtung (Baseline) — `infra/harden.sh`
- **SSH** (`/etc/ssh/sshd_config.d/99-hardening.conf`): root nur per Key
  (`prohibit-password`), kein Passwort/Keyboard-Interactive, kein TCP-/X11-/Agent-Forwarding,
  `MaxAuthTries 3`, Idle-Timeout. Vor Neustart mit `sshd -t` validiert.
- **fail2ban**: sshd-Jail (aggressive, 4 Fehlversuche → 1 h Bann).
- **unattended-upgrades**: automatische Sicherheitsupdates aktiv.
- **sysctl** (`/etc/sysctl.d/99-hardening.conf`): SYN-Cookies, rp_filter, keine
  Source-Routes/Redirects, log_martians, `kptr_restrict`, `dmesg_restrict`.
- **ufw**: default deny incoming; offen nur 22, 80, 443 (v4 + v6).
- **Hetzner Cloud Firewall** `doldenblick-web` (id `11207357`): Edge-Filter, inbound
  nur 22/80/443/icmp — zusätzlich zur ufw (Defense in Depth).
- **nginx**: Security-Header (HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy), `server_tokens off`.
- **Backups**: Hetzner-Automatik aktiv (täglich, 7 Slots, Fenster 18–22 UTC, +20% Preis).
  Wiederherstellung/Rollback über Console oder API (`/v1/servers/145742852/actions`).

### Bewusst NICHT umgesetzt (Workflow-Änderung / schwer reversibel)
- Non-root-Sudo-User + `PermitRootLogin no`; SSH-Port verschieben.
- HSTS-**Preload**-Submission (monatelang bindend); HSTS `preload`-Flag.
- Monitoring/Alerting, IP-Allowlist für SSH.

## Reproduktion
1. Server (cx23, nbg1, ubuntu-24.04, SSH-Key) mit `infra/cloud-init.yml` als user-data anlegen
   (Hetzner Cloud API `POST /v1/servers`).
2. DNS-Zone + A/AAAA/CAA setzen (`/v1/zones/.../rrsets`), Delegation in der Console prüfen.
3. Härtung + HTTPS: `ssh root@<ip> 'bash -s' < infra/harden.sh`
   (LE-E-Mail/Domains ggf. im Skript anpassen).
4. App ausrollen: `./infra/deploy.sh root@<ip>` (baut + deployt + Proxy + Reload).
