# Farmer-Onboarding & passwortlose Identität — Design-Spec (v1)

**Datum:** 2026-06-30 · **Status:** zur Umsetzung freigegeben (Design) · **Sprache:** Deutsch (Tech-Begriffe EN)

## 1. Ziel & Scope

Erste echte **Konto-/Identitätsschicht** für DoldenBlick: ein Hopfenbetrieb kann sich selbst
ein Feld-Briefing einrichten — **passwortlos**, mit automatischer Legitimitätsprüfung, in einem
ruhigen, angenehmen Ablauf. Heute hat das Produkt **keine** Konten/Auth/Persistenz (statische SPA +
zustandslose Compute-Backends). Diese Spec führt die **Fundament-Schicht** ein und macht sie über den
**Onboarding-Flow** erlebbar.

**In v1:**
- Onboarding-Flow (4 Schritte, s. §3).
- Passwortlose Auth: **Passkeys (WebAuthn)** + **E-Mail-Magic-Link** (Postmark), Sessions.
- **Legitimitätsprüfung = iBALIS/Mehrfachantrag-Import** (Besitznachweis + Feldeinrichtung in einem).
- Neuer zustandsbehafteter Dienst **`accounts/`** (Fastify) + **Postgres**; Secrets über Infisical.
- Datenmodell **für Mehrbenutzer pro Betrieb vorbereitet** (kein Team-UI in v1).

**Nicht in v1 (eigene spätere Zyklen):** Team-/Mehrbenutzer-Verwaltung (nur Schema-Vorsorge),
Admin-Dashboard, Self-Service-Einstellungen über Basis hinaus, „auf Gerüstfläche zuschneiden",
mobiles Onboarding-Spezialdesign (Flow ist responsiv, aber kein eigener Build).

**Erfolgskriterien:** Ein realer Hallertau-Hopfenbetrieb kommt in ≤4 Schritten, ohne Passwort, vom
Klick bis zur fertig eingerichteten Übersicht; eine zufällige Person ohne gültigen iBALIS-Export kommt
**nicht** durch das Gate; ein Vault-/Dienstausfall blockiert keinen bereits eingeloggten Betrieb.

## 2. Leitprinzipien (das „angenehme" Gefühl)
- **Durchgängig passwortlos** — nie ein Passwortfeld.
- **Eine Entscheidung pro Bildschirm**, ruhiges Tempo, klare Fortschrittsanzeige.
- **Wert vor Verpflichtung** — die eigenen Felder erscheinen, bevor mehr abgefragt wird.
- **Der Aha-Moment**: die echten Hopfen-Schläge erscheinen aus dem iBALIS-Import auf der Karte.
- **Nachsichtig & fortsetzbar** — Magic-Link auf jedem Gerät; Passkey optional; Abbruch resümierbar.
- **Marke:** Deutsch, sachlich, nicht alarmierend; Frutiger-Rubrik, Barlow, Grün/Gold, Spalier-Motiv.

## 3. Onboarding-Flow (4 Schritte)

**① Willkommen** — Markenbildschirm (Spalier, Hopfendolde). Ein Feld: **E-Mail**. Button *„Briefing
einrichten"*. Kein Passwort, kein Name. Anlegen eines **provisorischen Kontos** (unbestätigt).

**② E-Mail bestätigen (Magic-Link)** — *„Wir haben Ihnen einen Link an … geschickt."* Postmark-Mail mit
einmaligem Link (TTL 30 min, einmalig nutzbar). Klick → E-Mail verifiziert, **Session** angelegt.
Gerätübergreifend (Start am Desktop, Abschluss am Handy möglich).

**③ Felder aus iBALIS importieren (Aha + Gate)** — kurzer Helfer *„So exportieren Sie Ihre Feldstücke
aus iBALIS"* (2–3 Schritte, bebildert). Drag-&-Drop des Exports (Shapefile-ZIP; vgl. bestehendes
`app/src/onboarding` + `shpjs`). Upload → Parser → **automatisches Gate** (§6, unsichtbar) → die
Feldstücke erscheinen auf einer MapLibre-Karte: *„Wir haben N Schläge gefunden, davon M mit Hopfen."*
Bei Misserfolg: freundliche Erklärung + Wiederholen + seltener Pfad *„prüfen lassen"* (Admin-Queue, Stub).

**④ Schnellzugang (Passkey)** — *„Künftig per Fingerabdruck oder Gesicht anmelden — kein Passwort."*
Ein Tipp → WebAuthn-Registrierung (Windows Hello / Touch ID / Face / Android). *„Später"* →
E-Mail-Link bleibt dauerhaft nutzbar (Passkey jederzeit später ergänzbar). **Blockiert nie.**

→ **Übersicht** (abendliches Briefing) mit eingerichtetem Betrieb: *„Ihr Briefing ist startklar."*

## 4. Identitäts- & Datenmodell (Postgres)

Konto = **Betrieb** mit **primärem Betreiber**. **Vorsorge für Mehrbenutzer** über `farm_members`
(v1 legt genau eine Owner-Zeile an; mehr Mitglieder = reine Datenänderung, kein Umbau).

- **`users`** — `id`, `email` (unique, citext), `email_verified_at`, `name?`, `created_at`, `last_login_at`.
- **`farms`** — `id`, `betriebsnummer?`, `name` (z. B. „Familie Huber"), `anbaugebiet`, `verification_status`
  (`pending|verified|review`), `created_at`.
- **`farm_members`** — `farm_id`, `user_id`, `role` (`owner|member`), `created_at`. *(Team-Vorsorge.)*
- **`passkey_credentials`** — `id`, `user_id`, `credential_id` (unique), `public_key`, `counter`,
  `transports`, `device_name`, `created_at`, `last_used_at`. *(WebAuthn, pro User.)*
- **`magic_link_tokens`** — `id`, `user_id?`/`email`, `token_hash`, `purpose` (`signin|verify`),
  `expires_at`, `used_at`. *(Nur Hash gespeichert.)*
- **`sessions`** — `id`, `user_id`, `expires_at`, `created_at`, `user_agent?`, `ip?`.
- **`schlaege`** — `id`, `farm_id`, `name`, `flik`, `geometry` (GeoJSON/geometry), `kultur`, `sorte?`,
  `source` (`ibalis`), `created_at`. *(Die Felder aus dem Import.)*
- **`ibalis_imports`** — `id`, `farm_id`, `summary_json`, `validation_json`, `created_at`. *(Audit.)*

Migrationen versioniert (Tool im Plan festgelegt). **v1 ohne PostGIS:** Geometrien als GeoJSON in
`jsonb`; Anbaugebiet-/Punkt-in-Polygon-Prüfung serverseitig in JS (wenige Polygone/Felder).

## 5. Authentifizierung
- **Passkeys (WebAuthn):** Bibliothek **@simplewebauthn/server** + **@simplewebauthn/browser** (keine
  Eigen-Krypto). Endpunkte: `register-options` → Browser-Ceremony → `register-verify`;
  `auth-options` → Browser → `auth-verify`. Credential pro `user`. Platform-Authenticators bevorzugt.
- **Magic-Link:** `POST /api/auth/magic-link {email}` erzeugt Token (nur Hash gespeichert), Versand via
  **Postmark** (`POSTMARK_SERVER_API_TOKEN`, From `noreply@doldenblick.de`). `POST /api/auth/verify {token}`
  → E-Mail verifiziert, Session.
- **Sessions:** serverseitig (`sessions`-Tabelle) hinter **signiertem, httpOnly, Secure, SameSite=Lax**
  Cookie; Session-Signing-Key aus Infisical. Mittelware lädt `user` + aktiven `farm`.
- **Kein Passwort-Pfad** existiert.

## 6. Legitimitäts-Gate (iBALIS-Import) — automatisch, ohne Handprüfung
Beim Import (`POST /api/onboarding/import`, multipart):
1. **Besitznachweis** — der Export stammt aus dem authentifizierten iBALIS des Betreibers (nur dieser
   kann ihn ziehen). Das Hochladen *ist* der Nachweis.
2. **Struktur** — gültiger InVeKoS-Export, Feldstücke mit FLIK + Geometrie + Nutzung/Kulturart parsebar.
3. **Hopfen** — mind. ein Feldstück trägt die **Kulturart Hopfen**.
4. **Anbaugebiet** — Geometrien liegen in einem Hopfen-Anbaugebiet-Polygon (Hallertau/Spalt/Tettnang/
   Elbe-Saale; mitgeliefertes GeoJSON).
5. **Öffentlicher Abgleich (verstärkend, wo verfügbar)** — FLIK/Geometrie gegen die **öffentliche
   InVeKoS-Feldstückskarte** (WFS, soweit per-Parzelle abfragbar) gegenprüfen. Kernsignal bleiben 1–4;
   5 erhöht die Hürde, ist aber nicht alleinige Bedingung (keine offene Signatur-Verifikation des Exports).

Ergebnis `verified` → `farm` (verified) + `schlaege` anlegen, mit `user` verknüpfen. Sonst freundliche
Rückmeldung + Wiederholen + optional `review` (Admin-Queue als Stub; manuelle Ausnahme, nicht Routine).
**Ehrlichkeitsgrenze (dokumentiert):** kein kryptografischer Echtheitsbeweis möglich; Hürde hoch,
Betrugsanreiz für ein Nischen-Briefing-Tool nahe null; Admin-Spot-Check/Revoke als Ausnahmehebel.

## 7. Architektur
- **Neuer Dienst `accounts/`** (Fastify 5 + TS, Muster wie `api/`/`rs/`): Auth, Onboarding-Import,
  Konto-/Betriebs-CRUD (Basis). Port z. B. `:8789`, gebunden an `127.0.0.1` + private IP.
- **Postgres** auf **dedizierter App-Daten-Box** (Hetzner, privates Netz `doldenblick-net`) — Trennung
  von der öffentlichen Prod-Box (PII/Passkey-Credentials). Spiegelt die Vault-Entscheidung. *(Alternative
  (a): auf `doldenblick-01`; günstiger, Prod wird zustandsbehaftet — bewusst verworfen.)*
- **nginx auf `doldenblick-01`** proxyt `/api/auth/*` + `/api/onboarding/*` über das **private Netz** an
  den `accounts/`-Dienst (das beim Vault-Cutover angehängte Netz trägt das).
- **Secrets** (DB-URL, `POSTMARK_SERVER_API_TOKEN`, Session-Signing-Key) über **Infisical** (Sync-Timer
  wie bei `rs`) → lokaler `EnvironmentFile`; keine Boot-Abhängigkeit.
- **Frontend:** Onboarding-Wizard in `app/` (erweitert `app/src/onboarding`), MapLibre für die Felder,
  ruft `accounts/` über die genannten Pfade. Übersicht wird nach Login betriebsspezifisch geladen.
- **Box-Provisionierung ist ein gated Schritt** (wie der Vault) — ausdrückliche Freigabe nötig.

## 8. Datenfluss (Happy Path)
SPA ① E-Mail → `accounts/` legt User+Token an → Postmark-Mail → ② Klick `/verify` → Session-Cookie →
③ Upload Export → Parser+Gate → `farms`/`schlaege` → Karte zeigt Felder → ④ WebAuthn-Register →
Credential gespeichert → Redirect Übersicht (lädt Schläge des Betriebs).

## 9. Fehler-/Edge-Behandlung
E-Mail nicht angekommen → erneut senden · Link abgelaufen/benutzt → neu anfordern · Import ungültig/kein
Hopfen/außerhalb Anbaugebiet → erklärende Meldung + Wiederholen + `review`-Pfad · Passkey nicht
unterstützt/abgelehnt → E-Mail-Link-Fallback (blockiert nie) · halbfertiges Onboarding → via frischen
Magic-Link fortsetzbar · `accounts/`-/Vault-Ausfall → eingeloggte Betriebe unbeeinflusst (lokaler
EnvironmentFile + serverseitige Sessions).

## 10. Tests (TDD, Vitest — projektüblich test-first)
- **Unit:** Magic-Link erzeugen/verifizieren (TTL, Einmaligkeit, nur-Hash); WebAuthn-Register/-Auth
  (SimpleWebAuthn-Testvektoren); iBALIS-Parser (Shapefile/DBF-Encoding); Gate-Validator (Hopfen,
  Anbaugebiet-Punkt-in-Polygon, FLIK-Abgleich gemockt); Session-Mittelware.
- **Integration:** voller Onboarding-Happy-Path; Gate-Fehlerpfade; Resume; Cookie-Sicherheit.
- **Sicherheits-Checks:** Token nur als Hash; Cookie httpOnly/Secure/SameSite; Rate-Limit auf
  Magic-Link/Import; keine Secrets im Client/Log.

## 11. Offene Punkte / spätere Zyklen
Team-/Mitglieder-Verwaltung (Schema steht), Admin-Dashboard (Servicing/Revoke), Self-Service
(Profil/Geräte/Schläge), „auf Gerüstfläche zuschneiden", Postgres-Backup/Restore für die Daten-Box,
öffentlicher FLIK-WFS-Abgleich härten.
