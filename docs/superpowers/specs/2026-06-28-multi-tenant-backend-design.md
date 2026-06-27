# Spec: Multi-Tenant-Backend & Datenhaltung — DoldenBlick

**Datum:** 2026-06-28 · **Status:** Entwurf zur Review · **Sprache:** Deutsch (Code/Terms en)

## Entscheidungs-Zusammenfassung
DoldenBlick bekommt ein **selbst gehostetes** Backend mit **PostgreSQL + PostGIS** als
System of Record, um (1) **Self-Service-Mehrmandantenkonten** (Landwirt:innen melden sich an,
ihre Schläge persistieren serverseitig und syncen über Geräte) und (2) **betriebsübergreifende
räumliche Analytik** zu ermöglichen. Gewählt wurde **Option 2** (all-Hetzner, self-hosted) mit
einer **Durability-Harness** statt einer Managed-DB.

**Topologie:** Start auf **einer** physischen Hetzner-VM, aber alle Teile laufen als **getrennte
Container** auf einem lokalen Docker-Netz — logisch separiert und damit **split-ready**: das
Auslagern von Postgres auf eine eigene VM (privates Netz) ist später eine Konfigurations-, keine
Architekturänderung.

> **Bewusst akzeptiertes Risiko (Devil's-Advocate #1):** Das Produkt hat aktuell ~0 Nutzer; der
> härteste Einwand war „Nachfrage ist der Engpass, nicht Persistenz". Der Nutzer entscheidet,
> dennoch zu bauen — Gegenmaßnahme: schlanke erste Scheibe (Phase 1) und früh echte Hallertau-
> Landwirt:innen auf den Build holen. Siehe §13.

## 1. Ziel & Kontext
- **Heute:** reine statische SPA (Vite/TS); Schläge als GeoJSON in `localStorage`
  (`doldenblick.fields.v1`). Kein Backend, keine DB. Eine gehärtete Hetzner-VM
  (`doldenblick-01`, nginx + TLS) unter `https://doldenblick.de`.
- **Skala (Designgrenze):** deutscher Hopfensektor, ~1.000–3.000 Betriebe → kleine Datenmenge.
  Eine gut indizierte Postgres-Instanz bedient OLTP **und** Analytik (Materialized Views); kein
  separater Analytik-Store nötig.

## 2. Scope
**In:** Konten + Auth; Betriebe (Tenants) + Schläge (PostGIS-Polygone) serverseitig; Mandanten-
isolation via RLS; Geräte-Sync; betriebsübergreifende Analytik (Views); Durability-Harness;
Containerisierung (split-ready); Frontend-Umstellung auf API mit Offline-Cache.
**Out (vorerst):** Bezahlung/Abrechnung; Rollen jenseits „Mitglied eines Betriebs"; Echtzeit-
Collaboration/CRDT-Merge (LWW genügt für eine Person auf mehreren Geräten); zweite physische VM
(split-ready vorbereitet, aber nicht jetzt); Push-Benachrichtigungen.

## 3. Architektur-Überblick
```
                       Internet  (HTTPS 443)
                          │
   ┌──────────────────────┼───────────────────────── eine Hetzner-VM ─────────┐
   │  nginx (Host, vorhanden) — TLS/certbot, statische SPA,                    │
   │     /api/        → reverse-proxy → 127.0.0.1:8080 (api-Container)          │
   │     /api/brightsky/ → api.brightsky.dev  (unverändert)                     │
   │                                   │ loopback                              │
   │   ┌───────────────── Docker-Compose (internes Bridge-Netz) ───────────┐   │
   │   │  api   (Node/TS, Fastify)  ──db:5432──▶  db (postgis/postgis)      │   │
   │   │  publiziert nur auf 127.0.0.1:8080      KEIN Host-Port (privat)    │   │
   │   │  backup (Cron-Sidecar) ──pg_dump/WAL──▶ Hetzner Object Storage     │   │
   │   └───────────────────────────────────────────────────────────────────┘   │
   │  Datenverzeichnis von db liegt auf einem dediz. Hetzner-Volume (Snapshots)  │
   └─────────────────────────────────────────────────────────────────────────┘
```
- **nginx bleibt der einzige öffentliche Eingang** (TLS/certbot laufen schon, gehärtet). Es
  proxyt `/api/` auf den api-Container (nur Loopback). Browser sprechen ausschließlich
  `https://doldenblick.de` an → **same-origin, kein CORS**, einfache Cookie-Sessions.
- **db** veröffentlicht **keinen** Host-Port → nur über das interne Docker-Netz erreichbar, also
  nicht öffentlich (entspricht „localhost-Binding", erfüllt die Sicherheits-Eigenschaft ohne 2. VM).
- **Split-ready:** Der api-Container kennt die DB über `DATABASE_URL`. Umzug von Postgres auf eine
  eigene VM = nur diese URL auf die private IP der neuen VM zeigen + Volume migrieren.

## 4. Komponenten (Verantwortung · Schnittstelle · Abhängigkeit)
- **nginx (Ingress):** TLS, SPA-Auslieferung, Reverse-Proxy. Schnittstelle: HTTPS außen,
  HTTP-Loopback innen. Abh.: api-Container.
- **api (Node/TS, Fastify):** Auth, mandantengebundenes CRUD (Betriebe/Schläge), Analytik-Endpunkte.
  Setzt pro Request den RLS-Kontext. Schnittstelle: JSON/REST unter `/api`. Abh.: db.
- **db (Postgres 16 + PostGIS):** System of Record. Schnittstelle: SQL über internes Netz.
  Datenverzeichnis auf dediziertem Volume. Abh.: keine.
- **backup (Sidecar/Cron):** logische Dumps + WAL-Archiv → Object Storage, verschlüsselt.
  Schnittstelle: zeitgesteuert. Abh.: db, Object Storage.
- **Object Storage (Hetzner, EU, extern):** Off-site-Backups/Exporte + große Caches
  (Satellit/Wetter). Schnittstelle: S3.

## 5. Datenmodell & Mandantenisolation
```sql
users        (id uuid pk, email citext unique, password_hash text, created_at)
farms        (id uuid pk, name text, region text, location geometry(Point,4326), created_at)
farm_members (user_id uuid fk, farm_id uuid fk, role text, primary key(user_id,farm_id))
fields       (id uuid pk, farm_id uuid fk, name text, variety text,
              geom geometry(Polygon,4326), area_ha numeric, source text,
              created_at, updated_at)              -- GIST-Index auf geom
sessions     (id uuid pk, user_id uuid fk, expires_at timestamptz)
```
- Fläche via `ST_Area(geom::geography)`; regionale Analytik via räumliche Joins.
- **Mandantenisolation = PostgreSQL Row-Level Security.** Jede mandantengebundene Tabelle trägt
  `farm_id`; pro Request setzt die API `SET LOCAL app.user_id = …` in der Transaktion; RLS-Policy:
  Zugriff nur auf Zeilen, deren `farm_id` in den `farm_members` des aktuellen Users steht.
  Die App verbindet sich mit einer **Nicht-Superuser-Rolle ohne `BYPASSRLS`** (Footgun vermeiden).

## 6. Authentifizierung
- **E-Mail + Passwort** (argon2id), **serverseitige Sessions** (httpOnly, Secure, SameSite=Lax
  Cookie; `sessions`-Tabelle). Kein Dritt-Provider. Passwort-Reset via E-Mail (später; SMTP nötig).
- Eingaben mit **zod** validiert. Rate-Limiting auf Auth-Endpunkten (fail-closed).

## 7. Datensicherheit & Langzeit-Verfügbarkeit (Durability-Harness)
Kernprinzip: **Lebenszyklus der Daten vom Lebenszyklus der Compute trennen.** Compute ist
wegwerfbar (aus `infra/` neu baubar); die Daten überleben unabhängig.
- **Daten auf dediziertem Hetzner-Volume** (eigene Snapshots, unabhängig von der VM-Disk).
- **3-2-1-Backups in offenen Formaten:** nächtlicher `pg_dump` **plus** kontinuierliches
  **WAL-Archiving (PITR)** → **verschlüsselt** (age/gpg) ins **Object Storage** (versioniert).
  Zusätzlich periodischer **offen-Format-Export** (GeoJSON + Parquet) — lesbar ohne den DB-Vendor.
- **Vier Pflicht-Artefakte VOR den ersten echten Mandantendaten** (Devil's-Advocate #2):
  1. **Getestete Wiederherstellung** — geplanter PITR-Restore auf eine Wegwerf-Instanz, real
     verifiziert, im Kalender wiederkehrend. (Backups ohne Restore-Test sind keine Backups.)
  2. **Automatisierte Patch-Pipeline** — `unattended-upgrades` (OS) + verfolgte Postgres-Minor-
     Version-Kadenz (Image-Pin + Update-Routine).
  3. **RLS-Isolations-Tests in CI** — beweisen, dass Betrieb A Betrieb B nie sieht; inkl.
     Superuser-/`BYPASSRLS`-Footgun.
  4. **Breach-Response- & DPA/Controller-Plan** — schriftlich (DoldenBlick ist Verantwortlicher).
- **Verschlüsselung:** TLS außen (vorhanden); Backups at-rest verschlüsselt; DB-Volume optional
  LUKS. Secrets via Docker-Secrets/`.env` (gitignored), nicht im Image.
- **Kein öffentlicher DB-Port; scoped DB-Credentials; bestehende ufw + Cloud Firewall.**

## 8. Frontend-Änderungen
- `state.ts`: `localStorage` wird **Offline-Cache** statt Quelle der Wahrheit; State spricht die
  API an (optimistische Updates, Re-Sync bei Reconnect) → „funktioniert im Feld ohne Netz" bleibt.
- **Erstanmeldungs-Migration:** vorhandene `localStorage`-Schläge ins neue Konto importieren
  (keine verwaisten Daten).
- Onboarding-Import (Shape/GeoJSON) POSTet künftig in das Konto.

## 9. Analytics
- Betriebsübergreifende Auswertungen als **Materialized Views** in derselben DB (z. B. Fläche je
  Sorte je Region), **nächtlich** refresht (Cron). Räumliche Joins via PostGIS.
- Zugriff vorerst operator-/aggregat-seitig; personenbezogene Rohdaten bleiben RLS-geschützt.

## 10. Deployment / Infrastructure-as-Code
- **Docker Compose** definiert `api`, `db`, `backup`; internes Bridge-Netz; `db` ohne Host-Port;
  `api` nur auf `127.0.0.1:8080`. Postgres-Daten als Named Volume auf dem dediz. Hetzner-Volume.
- Host-**nginx** bekommt einen `/api/`-Proxy-Block (Snippet analog `infra/nginx-doldenblick.conf`).
- Erweiterung von `infra/`: `compose.yml`, `api/Dockerfile`, Migrations, `infra/backup.sh`,
  `infra/restore-drill.sh`. Deploy analog `infra/deploy.sh` (build → push → `compose up -d` →
  Migrationen → Healthcheck/Rollback).
- **Split-ready:** Postgres später auf eigene VM = `DATABASE_URL` auf private IP + Volume-Move.

## 11. Testing
- **Domänen-Unit-Tests** (bestehen, Vitest) bleiben.
- **DB-Integrationstests** gegen echtes Postgres+PostGIS (Wegwerf-Container).
- **RLS-Isolationstests** (Pflicht-Artefakt §7.3) in CI.
- **API-Tests** (Auth-Flows, CRUD, Validierung, Rate-Limit).
- **Restore-Drill** als wiederkehrender Ops-Test (Pflicht-Artefakt §7.1).

## 12. Rollout-Phasen
1. **Phase 1 (erste Implementierungsscheibe):** Compose (db+api) neben der SPA; Auth
   (E-Mail/Passwort, Sessions); Schläge-CRUD; RLS + Isolationstests; nginx `/api/`. Frontend:
   `state.ts` → API + Offline-Cache + Erstanmeldungs-Migration.
2. **Phase 2:** Durability-Harness vollständig (Volume, WAL/PITR, verschlüsselte Off-site-Backups,
   die 4 Artefakte) — **abgeschlossen, bevor echte Mandantendaten landen.**
3. **Phase 3:** Analytik-Views + Endpunkte; offene-Format-Exporte.
4. **Später (evidenzgetrieben):** Postgres auf eigene VM (privates Netz), wenn Last/Compliance/
   zusätzliche Ingress-Pfade es belegen (Devil's-Advocate #3).

## 13. Offene Risiken & Devil's-Advocate-Ergebnisse
- **#1 Nachfrage (DON'T-ADOPT-now):** bewusst akzeptiert; Gegenmaßnahme schlanke Phase 1 + frühe
  Felderprobung mit echten Betrieben. **Falsifizierung:** ≥10–20 aktiv wiederkehrende Nutzer der
  localStorage-Version bzw. konkrete Abwanderung mangels Sync würden das Bauen klar rechtfertigen.
- **#2 Self-Hosting-Ops (ADOPT-WITH-FIX):** adressiert durch §7 (4 Pflicht-Artefakte). Ohne diese
  Artefakte vor echten Daten gilt die Entscheidung als nicht erfüllt → dann Managed EU-Postgres.
- **#3 Topologie (DON'T-ADOPT-split-now):** adressiert — eine VM jetzt, container-separiert &
  split-ready; zweite VM nur evidenzgetrieben.
- **Offen:** SMTP/Passwort-Reset-Weg; Wahl Backup-Verschlüsselung (age vs gpg); ob `varieties` als
  Lookup-Tabelle (vorerst Freitext); Monitoring/Alerting (Uptime, Cert-Ablauf, Backup-Erfolg).
