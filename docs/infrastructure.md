# Infrastruktur — DoldenBlick

**Stand:** 2026-07-01 (Basis 2026-06-27). Hosting bei **Hetzner Cloud**. Namenskonvention: Infrastruktur =
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
| Webserver | nginx 1.24; serviert die **DoldenBlick-App** (Vite-Build aus `app/dist/`) + Bright-Sky-Proxy + drei loopback-`/api/*`-Dienste (8787/8788/8789) |
| Datenbank | **Postgres 16** (nativ, nicht Docker); DB `doldenblick` für den Accounts-Dienst (s. Erweiterung 2026-07-01) |

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
| Records | `A`/`AAAA` für `@` und `www` → Server; `CAA 0 issue "letsencrypt.org"`; **Postmark**: DKIM `…pm._domainkey` (TXT), Return-Path `pm-bounces` (CNAME → `pm.mtasv.net`) |

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

---

# Erweiterung 2026-06-29 — Secrets-Box, privates Netz, E-Mail, Quirks

## Server `doldenblick-vault` (Secrets-Manager)
| | |
|---|---|
| Zweck | Selbstgehostetes **Infisical** — **dediziert** (Isolation = Sinn des Self-Hostings), getrennt von Prod |
| Server-ID | `146139826` |
| Typ | `cx23` (x86, 2 vCPU / 4 GB) — nbg1 |
| IPv4 (public) | `178.105.188.207` — **nur SSH** (Cloud-Firewall von Admin-IP) |
| IPv6 | `2a01:4f8:c2c:e759::1` |
| Privat | `10.0.0.2` (`enp7s0`, Netz `doldenblick-net`) |
| OS / Kernel | Ubuntu 24.04 / 6.8.0-124 |
| Extras | **2 GB Swap**; Docker 29.6 + compose v5.2; unattended-upgrades gehärtet (Security+ESM+Updates) + **Auto-Reboot 04:30** |

### Infisical-Stack (`/opt/infisical`; Compose-Spiegel in `infra/infisical/`)
- **backend** `infisical/infisical:v0.161.9` — Port 8080, gebunden an `127.0.0.1:8080` (SSH-Tunnel-Admin) **und** `10.0.0.2:8080` (privat, für Prod).
- **db** `postgres:16-alpine`, **redis** `redis:7-alpine` — beide **ohne** Host-Port; Redis `--maxmemory-policy noeviction`.
- Secrets in `/opt/infisical/.env` (0600, on-box erzeugt). Admin-Passwort + Automations-Token: `/opt/infisical/admin-credentials.txt` (0600).
- Erster Super-Admin **headless** (`POST /api/v1/admin/bootstrap`), Org **„DoldenBlick"**. **Admin-Zugang (kein Public-Port):** `ssh -L 8080:127.0.0.1:8080 root@178.105.188.207` → `http://localhost:8080` (Passwort rotieren + TOTP-MFA).
- **Kernarchitektur:** Infisical = **Sync-Quelle, NICHT** Laufzeit-Abhängigkeit. Prod behält die autoritative `EnvironmentFile`; der **Agent** rendert sie. Vault-Ausfall darf Prod-Boot/-Redeploy nie blockieren (**Cold-Boot-Test** vor Cutover). Self-Hosting kauft Rotation/Revocation/Scoping/Audit, **nicht** Laufzeit-Vertraulichkeit gegen Root.
- **Kronjuwelen** `ENCRYPTION_KEY`/`AUTH_SECRET`: irreversibel → **off-box sichern** (Passwortmanager).

## Privates Netz & Vault-Firewall
- **`doldenblick-net`** — ID `12385081`, `10.0.0.0/16`, Subnetz `10.0.0.0/24`, Zone `eu-central`. Vault = `10.0.0.2`.
  **Prod noch nicht angehängt** (Gate; Attach = NIC-Reconfig der Prod-Box → mit Health-Check + Rollback).
- **Cloud-Firewall `doldenblick-vault-fw`** — ID `11213357` (nur Vault): inbound `tcp/22`+`icmp` von Admin-IP `178.193.212.25/32`; outbound alles. (Prod hat separat `doldenblick-web` id `11207357`.)
  ⚠️ Admin-IP dynamisch — bei ISP-Wechsel Regel via API nachziehen.

## E-Mail (Postmark)
- Server für `doldenblick.de` (Postmark-Domain-ID 7836036). **Domain verifiziert** 2026-06-29 (DKIM + custom Return-Path).
- SMTP `smtp.postmarkapp.com:587` (STARTTLS, `SMTP_SECURE=false`); **Server-Token = SMTP-User UND -Passwort**; Absender `noreply@doldenblick.de`.
- Tokens in `.env`: `POSTMARK_SERVER_API_TOKEN` (Versand) + `POSTMARK_ACCOUNT_API_TOKEN` (Domain-/Signatur-Verwaltung + Verify) — **nicht** austauschbar.
- Nutzung **nur serverseitig** (Backend/BFF), Token nie im Client. Erst-Nutzer: Infisical (Passwort-Reset/MFA). Details: `REFERENCE.md` §5.5.

## QUIRKS & GOTCHAS (Session 2026-06-29 — damit wir das nicht erneut durchleben)

**Prozess (wichtigster Punkt):** **Dieses Dokument zuerst lesen.** Die „DNS-ist-in-der-Cloud-API"-Tatsache stand hier längst — ein nicht gelesener SSOT kostet Zeit.

**Shell / zsh (lokale Maschine):**
- Unquoted `$VAR` wird in zsh **nicht** wort-gesplittet: `SSH="ssh -o …"; $SSH host` ⇒ „command not found". → `ssh -o …` direkt oder `${=SSH}`.
- **`status` ist read-only** (zsh-Spezialvariable) ⇒ `status=$(…)` bricht ab. Anderen Namen nehmen.
- Vordergrund-`sleep` ist blockiert ⇒ Warte-/Poll-Schleifen als Hintergrund-Kommando.

**Hetzner Cloud (Server/Netz/Firewall):**
- Netz-Zonen: `eu-central`={nbg1,fsn1,hel1}, `us-east`=ash, `us-west`=hil, `ap-southeast`=sin. Privates Netz + alle Server müssen **dieselbe Zone** haben. **CAX (ARM) nur eu-central.**
- **Cloud-Firewalls filtern nur das Public-Interface** — Privatnetz ist ungefiltert (trusted). ⇒ Infisical-Port **nicht** public öffnen. SSH-only-FW **nicht** an Prod (80/443!).
- Public IPv4 beim Erstellen behalten (cloud-init-Egress); `--without-ipv4` killt apt/Docker-Pull (kein NAT).
- Default-Image hat **keinen Swap** ⇒ Swapfile in cloud-init.
- `user_data` muss mit `#cloud-config` beginnen, ≤ 32 KiB.

**Hetzner DNS (in Cloud-API integriert):**
- **`HETZNER_API_TOKEN` (Cloud-Token) verwaltet DNS.** Alt-API `dns.hetzner.com/api/v1` → 301.
- Zonen-Liste-Falle: ID nicht abschneiden (`doldenblick.de` = `1421900`, nicht „1421").
- Records = **RRSets** (`/zones/{id}/rrsets`, `name` relativ, `@`=Apex). **CNAME** braucht **trailing dot**; **TXT muss in doppelte Anführungszeichen** (sonst `422 "TXT records must be fully escaped with double quotes"`).

**Ubuntu / apt / Updates:**
- **unattended-upgrades ist auf 24.04 default installiert + Timer aktiv** — frische Box hat ihn nur noch nicht ausgelöst (sieht aus wie „keine Updates", Konfig ist ok).
- **needrestart (24.04)** startet Dienste nach apt neu ⇒ `DEBIAN_FRONTEND=noninteractive` + `NEEDRESTART_MODE=a` (Docker-Restart wurde deferred → Container unberührt).
- Kernel-Update braucht **Reboot** (`/var/run/reboot-required`); Auto-Reboot 04:30 erledigt das. SSH-Unit heißt **`ssh`** (nicht `sshd`).

**Bash-Scripting:**
- **`set -o pipefail` + `grep` ohne Treffer ⇒ Exit 1** ⇒ falscher Abbruch (z. B. `apt list --upgradable | grep -v Listing | wc -l` bei 0 offenen = Erfolg!). grep-Exit abfangen.

**Docker / Infisical (Self-Host):**
- Image `infisical/infisical:v0.161.9` (multi-arch). **Versions-Falle:** Web-Suche meldete „latest=0.43" (falsch) — GitHub-Releases/Docker-Hub sind autoritativ. **Tag pinnen.**
- 3 Dienste backend + `postgres:16-alpine` + `redis:7-alpine`. **Stock-Compose ist POC** (latest, pg14, ALLOW_EMPTY_PASSWORD, Port 80) — nicht so deployen.
- Pflicht-Env: `ENCRYPTION_KEY` (`openssl rand -hex 16`), `AUTH_SECRET` (`openssl rand -base64 32`), `DB_CONNECTION_URI`, `REDIS_URL`, `SITE_URL` (absolute URL).
- **`HOST=0.0.0.0` im Container** (Default localhost ⇒ Port antwortet nicht). Host-seitig nur an `127.0.0.1` + private IP binden.
- Migrationen laufen beim App-Start (Advisory-Lock). **`env_file` interpoliert kein `${VAR}`** ⇒ literale Passwörter in den URIs. **Redis `noeviction`** (BullMQ). **Postgres-Major-Pin** zählt.
- Admin headless: `POST /api/v1/admin/bootstrap {email,password,organization}` (erster = Super-Admin; liefert `identity.credentials.token`). `GET /api/v1/admin/config` → `initialized`/`allowSignUp`.
- SMTP: Boot verifiziert die Verbindung („SMTP - Verified connection"); `emailConfigured` in `/api/status`. **`SITE_URL` muss exakt der Browser-Origin entsprechen** (Cookies/CSRF). Ohne SMTP nur Emergency-Kit-Recovery.
- Maschinen-Identität: **Universal Auth** (nicht Token-Auth); read-only-prod = **custom Rolle** (Viewer spannt alle Envs); `--projectId` zwingend; `INFISICAL_DOMAIN` pinnen; Trusted-IP-Allowlist ist **kostenpflichtig**; **kein `--mount`**. **`infisical run` hat keinen Offline-Cache** ⇒ **Agent** nutzen.

**Postmark:**
- **Server-Token** (Versand; = SMTP-User UND -Passwort) ≠ **Account-Token** (Domain-Verwaltung+Verify) — nicht austauschbar.
- `/domains` braucht `count` **UND** `offset` (sonst 422). `GET /server` gibt den Server-Token in `ApiTokens` zurück (nicht blind `head -c` → Leak).
- DKIM-Wert ist `k=rsa; p=…` (Leerzeichen nach `;`) — exakt aus der Account-API, nicht vom Screenshot abtippen. Verify: `PUT /domains/{id}/verifyDkim` + `verifyReturnPath`.

**Secrets-Handling (Prozess):**
- Werte **nie** drucken/committen. **On-box** erzeugen (openssl). Tokens via **SSH-stdin-Heredoc** (nicht Kommandozeile → nicht in `ps`/Transkript). `.env` mit `set -a; . ./.env; set +a` laden.

## Status & offene Punkte (Stand 2026-06-29)
**ERLEDIGT — Prod-Cutover LIVE (no-downtime):** `doldenblick-01` privat angehängt (**10.0.0.3**); Projekt
`doldenblick` + Envs; **8 Secrets** (inkl. GEE-JSON) in `prod`; read-only-Maschinen-Identität (verifiziert: liest,
Schreiben 403); `pg_dump`-Backup-Cron. Fail-safe **Secrets-Sync** (`doldenblick-secrets-sync.timer`, alle 10 min)
rendert `/etc/doldenblick/doldenblick-rs.env` aus Infisical — systemd `EnvironmentFile=` unverändert. Bei
Vault-/Netz-Fehler: no-op (Datei unangetastet). **Resilienz bewiesen:** Vault aus → `rs`-Restart kommt aus lokalem
File hoch (rs/health 200) → **keine Laufzeit-Abhängigkeit**. Kronjuwelen/Admin-PW off-box, PW rotiert + TOTP.

**Offen (Tightening, kein Blocker):**
- Custom read-only-Projektrolle nur `prod`-Env (statt built-in `viewer`, der alle Envs liest; dev/staging leer).
- Postgres-Restore-Drill (Dump testweise zurückspielen). Voller Cold-Boot-Test (echter Prod-Reboot) — optional, kurze Downtime.
- `cloud-setup.sh` (Claude Code Web) auf Infisical umstellen; lokale `.env` perspektivisch ablösen.
- `doldenblick-01` hat **keinen Swap** (Vault: 2 GB) — bei Bedarf nachrüsten.

---

# Erweiterung 2026-07-01 — Accounts-Dienst + passwortloses Onboarding (Prod)

Der `accounts/`-Dienst (passwortlose Identität + Betriebs-Onboarding) ist auf `doldenblick-01`
deployt und live. Erster **zustandsbehafteter** Dienst → erstes Postgres auf der Prod-Box.

## Postgres (auf `doldenblick-01`)
- **Postgres 16, nativ** (apt, nicht Docker) — lokal, hört nur auf den Unix-Socket / `127.0.0.1`.
- DB `doldenblick` + eigene Rolle für den Dienst. **Passwort lebt ausschließlich in Infisical**
  (`ACCOUNTS_DATABASE_URL` → im Sync als `DATABASE_URL` gerendert) und in der on-box EnvironmentFile —
  **nie** gedruckt/committet. Anlage von Rolle/DB war **gated** (erst nach ausdrücklicher Prod-Freigabe).
- **Migrationen:** `node-pg-migrate up` aus `accounts/migrations/` (001 init · 002 webauthn-challenge ·
  003 schlaege-region), idempotent im Deploy.
- Backup-Drill/Restore für diese DB steht noch aus (Tightening).

## systemd — `doldenblick-accounts`
- Unit `infra/doldenblick-accounts.service`: `node dist/server.js`, Loopback **:8789**, User `doldenblick`,
  `EnvironmentFile=/etc/doldenblick/doldenblick-accounts.env` (root:root 600).
- Gehärtet wie die anderen Dienste, aber `RestrictAddressFamilies` schließt **`AF_UNIX`** ein
  (Postgres-Socket) zusätzlich zu `AF_INET/AF_INET6` (Postmark-HTTPS).

## Secrets-Sync — jetzt Multi-Target
`infra/infisical/doldenblick-secrets-sync.py` rendert nun **zwei** EnvironmentFiles, fail-safe **pro Ziel**
(Fehler bei einem Ziel lässt das andere unberührt; Restart nur bei echter Änderung):
- `doldenblick-rs.env` ← `COPERNICUS_CLIENT_ID/SECRET` → restart `doldenblick-rs`
- `doldenblick-accounts.env` ← `DATABASE_URL, SESSION_SIGNING_KEY, RP_ID, RP_ORIGIN, SITE_URL,
  POSTMARK_SERVER_API_TOKEN` → restart `doldenblick-accounts`

Prinzip unverändert: Infisical ist **Sync-Quelle, keine Boot-Abhängigkeit** — der Dienst startet aus
der lokalen EnvironmentFile, auch wenn der Vault down ist.

## nginx (`infra/nginx-doldenblick.conf`)
Additiv zum bestehenden Snippet:
- **Prefix** `location /api/auth/` und `location /api/onboarding/` → `127.0.0.1:8789`
  (`/api/onboarding/` mit `client_max_body_size 8m` für GeoJSON-Schläge).
- **Exakt** `location = /api/accounts/health` und `= /api/accounts/version` (Ops, analog zu `/api/rs/*`).
- **SPA-History-Fallback** (exakt) `= /onboarding` und `= /onboarding/verify` → `try_files $uri /index.html`.
  Bewusst **kein** pauschaler `/index.html`-Fallback: nur die zwei real existierenden pfadbasierten
  Routen (die `main.ts` über `window.location.pathname` kennt) liefern die SPA aus; alles andere 404t
  ehrlich weiter.

## Deploy — `infra/deploy-accounts.sh`
Baut `dist/`, rsync von `dist/` + `migrations/` nach `/opt/doldenblick-accounts`, `npm ci --omit=dev`,
Env-Check, `node-pg-migrate up`, systemd (neu-)start, nginx-Snippet mit Backup + `nginx -t` + Rollback,
Loopback-Health `curl 127.0.0.1:8789/api/accounts/health`.

## QUIRKS (Session 2026-07-01 — Deploy des Accounts-Dienstes)

**Grüne Tests ≠ „läuft" — zweimal am selben Dienst gelernt:**
- **`tsc` typecheckt, Vitest/esbuild nicht.** Der Build lief lokal grün (Vitest), aber `tsc` auf dem
  Deploy brach mit echten Typfehlern ab (Index auf `undefined`, `Buffer` vs. `Uint8Array`). → Deploy-Gate
  baut jetzt zwingend mit `tsc`.
- **Node-ESM verlangt `with { type: 'json' }` — tsc/esbuild nicht.** Ein `import … from './x.json'` ging
  durch beide Builder, aber Node warf zur Laufzeit `ERR_IMPORT_ATTRIBUTE_MISSING` → Crash-Loop. Fix:
  Domänendaten (Anbaugebiete) als **TS-Const** statt importiertem JSON. Gate prüft nun zusätzlich einen
  echten `node --input-type=module -e "import('./dist/...')"`-Laufzeit-Import des Builds.

**nginx-Reload ist graceful, nicht atomar:** Direkt nach `systemctl reload nginx` beantworten
auslaufende alte Worker kurz noch mit der alten Config — eine neu hinzugefügte `location` kann für
~1 s einen veralteten 404 liefern. Kein Cache, kein Bug: einmal nachfassen, dann stabil. Beim Verifizieren
von frisch reloadeten Routen kurz warten / erneut prüfen.

## Status (2026-07-01)
**LIVE & verifiziert:** `/onboarding` + `/onboarding/verify` (200), `/api/accounts/health` + `/version`
(200), `/api/onboarding/me` (401 = Guard aktiv), `/api/auth/passkey/auth-options` (200); übrige Dienste
(`/api/version`, `/api/rs/version`) unberührt; unbekannte Pfade weiterhin 404 (kein pauschaler Fallback).
**Offen (Tightening):** Restore-Drill für die `doldenblick`-DB; Postgres-Backup in den bestehenden
`pg_dump`-Cron aufnehmen; Passkey-/Magic-Link-UX fürs echte Betriebs-Onboarding polieren.
