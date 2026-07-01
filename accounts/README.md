# DoldenBlick Accounts (passwortlose Identität + Onboarding)

TypeScript-/Fastify-Dienst für alles rund um „wer ist das und welche Schläge gehören dazu".
Zwei Aufgaben: **Anmelden ohne Passwort** (Magic-Link per E-Mail oder Passkey/WebAuthn) und das
**Onboarding** eines Betriebs (Name + Schläge als GeoJSON). Anders als `api/` und `rs/` ist dieser
Dienst **zustandsbehaftet** — er spricht ein lokales **Postgres**.

Warum passwortlos: Hopfenbetriebe sind kleine, oft familiengeführte Betriebe; ein vergessenes
Passwort ist eine Hürde, kein Schutz. Ein Magic-Link in die E-Mail oder der Fingerabdruck/Gesichts-
Scan des Geräts (Passkey) ist niedrigschwelliger **und** sicherer.

## Endpunkte

**Anmeldung (öffentlich, rate-limitiert):**

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/auth/magic-link` | Magic-Link anfordern (verschickt E-Mail via Postmark) |
| POST | `/api/auth/verify` | Magic-Link-Token einlösen → Session (Single-Use, atomar) |
| POST | `/api/auth/passkey/register-options` | WebAuthn-Registrierung starten |
| POST | `/api/auth/passkey/register-verify` | Passkey registrieren |
| POST | `/api/auth/passkey/auth-options` | WebAuthn-Anmeldung starten |
| POST | `/api/auth/passkey/auth-verify` | Passkey prüfen → Session |

**Onboarding (Session erforderlich):**

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/onboarding/me` | Aktueller Nutzer + zugeordneter Betrieb (`401` ohne Session) |
| POST | `/api/onboarding/farm` | Betrieb anlegen/benennen |
| POST | `/api/onboarding/schlaege` | Schläge als GeoJSON übernehmen |

**Betrieb (Ops):**

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/accounts/health` | Liveness (`{status:"ok"}`) |
| GET | `/api/accounts/version` | `{name, version, contract}` (Versions-Preflight) |

## Sessions & Sicherheit
- **Session** = serverseitig, als HMAC-signiertes httpOnly-Cookie (keine JWT im Client, kein
  Token im `localStorage`). Signaturschlüssel aus `SESSION_SIGNING_KEY`.
- **Magic-Links** sind **einmalig**: das Einlösen ist eine bedingte `UPDATE … RETURNING`, sodass
  zwei parallele Klicks nicht beide eine Session bekommen.
- **Passkeys** über `@simplewebauthn/server`; Challenge wird kurzlebig in der DB gehalten
  (`002_webauthn_challenge.sql`). `RP_ID`/`RP_ORIGIN` müssen exakt zur Browser-Origin passen.
- **Rate-Limit** (`@fastify/rate-limit`) auf den öffentlichen Auth-Routen (5 / 15 min), damit der
  Magic-Link-Versand nicht als Mailbombe missbraucht werden kann.

## Datenmodell (Postgres, `migrations/`)
- `001_init.sql` — Nutzer, Betriebe (`farms`), Mitgliedschaften (Rolle `owner`/`member`), Schläge,
  Magic-Link-Token. Nutzt `citext` (Case-insensitive-E-Mail) und `gen_random_uuid()`.
- `002_webauthn_challenge.sql` — kurzlebige WebAuthn-Challenges.
- `003_schlaege_region.sql` — Region/Anbaugebiet je Schlag.
- **Team ist vorgesehen, aber schlank:** ein Betrieb kann mehrere Mitglieder haben
  (`owner`/`member`); Betriebsübertragung läuft transaktional (`reassignOwner`, `ON CONFLICT`).

## Betreiber-Recovery (`src/operator/`)
Für den Fall „Nutzer kommt nicht rein": eine CLI, die einen Magic-Link erzeugt, einen Passkey
zurücksetzt oder einen Betrieb überträgt — bewusst **nur on-box** (kein öffentlicher Endpunkt).

## Versionsvertrag
Wie `api/`: jede Antwort trägt eine `contract`-Major; `/api/accounts/version` erlaubt Clients den
Preflight. Additive Felder erhöhen die Major **nicht**, brechende Änderungen schon.

## Entwicklung
```
cd accounts
npm install
npm run dev        # tsx watch (Port 8789, Loopback)
npm test           # vitest (105 Tests; DB-nah via pg-mem, kein echtes Postgres nötig)
npm run build      # tsc → dist/
npm start          # node dist/server.js
```
Bindet nur an `127.0.0.1` — nginx terminiert TLS und proxyt `/api/auth/*`, `/api/onboarding/*`
und `/api/accounts/*` same-origin hierher. Konfiguration über Env (vom Infisical-Sync gerendert):
`DATABASE_URL`, `SESSION_SIGNING_KEY`, `RP_ID`, `RP_ORIGIN`, `SITE_URL`, `POSTMARK_SERVER_API_TOKEN`.

## Deployment
`infra/deploy-accounts.sh` baut `dist/`, spielt Artefakte + Migrationen nach `/opt/doldenblick-accounts`,
installiert Prod-Deps, fährt `node-pg-migrate up`, (neu-)startet die systemd-Unit `doldenblick-accounts`
und spielt das nginx-Snippet mit Rollback ein. Voraussetzung: Postgres + Rolle/DB auf dem Server und
die gerenderte EnvironmentFile (siehe `docs/infrastructure.md`).

> **Node-ESM-Falle (hart gelernt):** Vitest/esbuild strippt Typen **ohne** Typecheck und akzeptiert
> JSON-Importe, die Node zur Laufzeit ablehnt. Grüne Tests ≠ „läuft". Domänendaten (Anbaugebiete)
> liegen deshalb als **TS-Const** vor, nicht als importiertes JSON. Deploy-Gates prüfen daher
> zusätzlich `tsc` **und** einen echten `node`-Laufzeit-Import des Builds.
