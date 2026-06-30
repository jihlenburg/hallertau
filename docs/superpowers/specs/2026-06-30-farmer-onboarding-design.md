# Farmer-Onboarding & passwortlose Identität — Design-Spec (v1, **Pilot-Grade**)

**Datum:** 2026-06-30 · **Status:** re-scoped nach Devil's-Advocate-Review (Ansatz **A**) · **Sprache:** Deutsch (Tech EN)

## 0. Warum diese (re-skopte) Form — Devil's-Advocate-getrieben
Ein adversariales 3-Agenten-Review ergab 2× PROCEED-WITH-NAMED-FIX + 1× DON'T-PROCEED, konvergent:
*zu viel Maschine, zu wenig Mensch, zu früh.* Konsequenzen, hier eingearbeitet:
- **#1 (Gate):** Pflicht-iBALIS-Upload = Abbruchklippe (Mehrfachantrag wird oft *für* den Betrieb erstellt;
  Shapefile-/Encoding-/Nutzungscode-Fallen; öffentliche Feldstückskarte ist WMS-Viewer, **keine** Parzellen-
  abfrage). → Import wird **optionaler Beschleuniger**, **nicht** das Tor; Default = Felder auf der Karte zeichnen/tippen.
- **#2 (Auth):** passwortlos-only ohne menschliche Rettung = Aussperr-Albtraum (Gerät tot, E-Mail unerreichbar,
  Hofübergabe). → Magic-Link **primär**, Passkey **optional**, **menschlicher Re-Enrollment-Pfad in v1**.
- **#3 (Timing):** volle Self-Serve-Foundation für **null** Nutzer = verfrühte Skalierung. → **Pilot-grade**,
  assistiert, **keine neue Box**, erst den Briefing-Wert validieren. „Infrastruktur vor Nachfrage" gilt für
  *zustandslose* Compute, kehrt sich für *zustandsbehaftete PII/Security-Infra* um (verfällt ungenutzt).

## 1. Ziel & Scope (Pilot-Grade)
**Echte** Konten (kein Wegwerf-Code, vorwärtskompatibles Schema), aber dimensioniert, um die **ersten paar**
Hallertau-Hopfenbetriebe **assistiert** zu onboarden und den **Briefing-Wert günstig zu validieren** —
**nicht** Self-Serve at scale. Die Skalierungsteile werden **später** ergänzt, wenn der Wert bewiesen ist.

**In v1:**
- **Assistiertes/eingeladenes Onboarding** (keine öffentliche Self-Serve-Anmeldung). Betreiber (du/Berater)
  lädt eine Handvoll Betriebe ein bzw. richtet mit ihnen ein. Legitimität = **menschlich** (du kennst die Pilotbetriebe).
- **Feldeinrichtung = zeichnen/tippen/suchen auf der MapLibre-Karte** (Linie des bestehenden Onboardings);
  **iBALIS-Import optional** als Beschleuniger; Geometrie-**Sanity-Check** = innerhalb Hopfen-Anbaugebiet-Polygon (weich, kein hartes Tor).
- **Auth:** Magic-Link (Postmark) **primär**; Passkey (WebAuthn) **optional**; **menschlicher Recovery-Pfad**.
- **Minimale Persistenz: Postgres auf bestehender Infra (keine neue Box).**
- **Vorwärtskompatibles Schema** (inkl. `farm_members` für spätere Mehrbenutzer).

**Out of v1 — späterer „Scale"-Zyklus, sobald Briefing validiert:** öffentliche Self-Serve-Anmeldung;
**automatisches iBALIS-Legitimitäts-Gate** + öffentlicher WFS-Abgleich; **dedizierte App-Daten-Box**; volles
**Admin-Dashboard**; Team-UI; Self-Service über Basis hinaus; Postgres-Backup/Restore der Daten-Box.

**Erfolgskriterium v1:** 3–5 reale Hopfenbetriebe sind assistiert eingerichtet, melden sich passwortlos wieder
an, ein Ausgesperrter wird vom Betreiber wieder eingebunden — und wir lernen, ob das Briefing nützt.

## 2. Leitprinzipien (das „angenehme" Gefühl)
Passwortlos im Gefühl · eine Entscheidung pro Schritt · **Wert vor Verpflichtung** (Felder erscheinen früh) ·
der Aha-Moment = die Schläge auf der Karte · nachsichtig/fortsetzbar · **immer ein menschlicher Ausweg** ·
Marke: Deutsch, sachlich, nicht alarmierend; Frutiger-Rubrik, Barlow, Grün/Gold, Spalier.

## 3. Onboarding-Flow (assistiert, Pilot)
**① Einladung** — Betreiber legt den Betrieb an und sendet eine Einladung (Postmark-Magic-Link). Klick →
Konto + Session. (Start am Desktop, Abschluss am Handy möglich.)
**② Felder einrichten** — **Default: Schläge auf der Karte zeichnen/tippen/suchen** (kann der Betreiber
gemeinsam mit dem Landwirt tun). **Optional:** *„iBALIS-Export importieren"* (Shapefile → Felder auf Karte).
Sanity: Geometrien im Hopfen-Anbaugebiet (weiche Warnung, kein Block).
**③ Schläge bestätigen** — benennen/auswählen.
**④ Schnellzugang (optional Passkey)** — *„künftig per Fingerabdruck/Gesicht"*; *„Später"* → Magic-Link bleibt.
→ **Übersicht** (Briefing) des Betriebs.
**Menschlicher Recovery-Pfad (v1):** Betreiber kann Einladung/Link neu senden, Passkeys zurücksetzen/neu
einrollen, einen Betrieb auf eine neue Person übertragen — nach Out-of-Band-Prüfung (Telefon).

## 4. Authentifizierung
- **Magic-Link (primär):** `POST /api/auth/magic-link {email}` → Token (nur Hash, TTL 30 min, einmalig),
  Versand via **Postmark** (`POSTMARK_SERVER_API_TOKEN`, From `noreply@doldenblick.de`); `verify` → Session.
- **Passkey (optional):** `@simplewebauthn/server`+`/browser`; Register/Auth-Ceremonies; Credential pro User.
- **Sessions:** serverseitig (`sessions`) hinter signiertem httpOnly/Secure/SameSite=Lax-Cookie; Signing-Key via Infisical.
- **Menschlicher Recovery-Pfad:** schlanker, geschützter Betreiber-Mechanismus (CLI oder winziger Auth-Endpoint)
  für Link-neu-senden / Passkeys-rücksetzen / Betrieb-übertragen. **Nicht** das volle Admin-Dashboard — nur der Rettungshebel.
- **Kein Passwort-Pfad.**

## 5. Datenmodell (Postgres, vorwärtskompatibel)
`users` (email citext unique, email_verified_at, name?, last_login_at) · `farms` (betriebsnummer?, name,
anbaugebiet, created_at) · **`farm_members`** (farm_id, user_id, role owner|member — Team-Vorsorge) ·
`passkey_credentials` (user_id, credential_id unique, public_key, counter, transports, device_name, last_used_at) ·
`magic_link_tokens` (email/user_id, token_hash, purpose, expires_at, used_at) · `sessions` (user_id, expires_at,
user_agent?, ip?) · `schlaege` (farm_id, name, flik?, geometry jsonb GeoJSON, kultur?, sorte?, source draw|ibalis) ·
`ibalis_imports?` (farm_id, summary_json, created_at — optional, nur wenn importiert).
**v1 ohne PostGIS:** Geometrien als GeoJSON `jsonb`; Anbaugebiet-Punkt-in-Polygon serverseitig in JS. Migrationen versioniert (Tool im Plan).

## 6. Architektur (keine neue Box)
- **Neuer Dienst `accounts/`** (Fastify 5 + TS, Muster wie `api/`/`rs/`): Magic-Link, Passkey, Onboarding
  (Felder speichern, optional Import-Parse), Betreiber-Recovery. Port z. B. `:8789`, an `127.0.0.1` gebunden.
- **Postgres auf `doldenblick-01`** (klein, nativ oder Einzel-Container — Entscheidung im Plan). Pilot-Datenmenge
  ist gering. *Bewusster Pilot-Tradeoff:* PII liegt vorerst auf der öffentlichen Box; **Migrations-Trigger:** bei
  realer Nachfrage/echtem PII-Volumen → Umzug auf eine **dedizierte App-Daten-Box** (der aufgeschobene Teil).
  Prod-**Swap** vorab nachrüsten (offener TODO) als Vorsichtsmaßnahme.
- **Secrets** (DB-URL, Postmark-Token, Session-Signing-Key) via **Infisical**-Sync (Timer wie `rs`) → lokaler EnvironmentFile.
- **nginx (doldenblick-01)** proxyt `/api/auth/*` + `/api/onboarding/*` → `accounts/` (lokal).
- **Frontend:** assistierter Onboarding-Wizard in `app/` (erweitert `app/src/onboarding`), MapLibre Feld-Zeichnen/-Tippen.

## 7. Datenfluss (Happy Path)
Betreiber lädt ein → Farmer-Klick `/verify` → Session-Cookie → Felder auf Karte zeichnen (oder optional Import) →
`farms`/`schlaege` → optional Passkey → Übersicht (lädt Schläge des Betriebs). Recovery: Betreiber-Hebel.

## 8. Fehler-/Edge-Behandlung
E-Mail nicht da → neu senden · Link abgelaufen/benutzt → neu anfordern · Import ungültig → **fällt sanft auf
Karten-Zeichnen zurück** (nie Sackgasse) · Geometrie außerhalb Anbaugebiet → weiche Warnung, kein Block ·
Passkey nicht unterstützt/abgelehnt → Magic-Link bleibt · **Aussperrung → Betreiber-Recovery** · `accounts/`-/
Vault-Ausfall → eingeloggte Betriebe unbeeinflusst (serverseitige Sessions + lokaler EnvironmentFile).

## 9. Tests (TDD, Vitest — test-first)
Unit: Magic-Link (TTL/Einmaligkeit/nur-Hash) · Passkey-Register/-Auth (SimpleWebAuthn-Vektoren) · Geometrie-
Validator (Punkt-in-Polygon Anbaugebiet) · optionaler iBALIS-Parser (Shapefile/DBF-Encoding) · Session-Mittelware ·
Betreiber-Recovery (Link-resend/Passkey-reset/Betrieb-übertragen). Integration: assistierter Happy-Path; Import-
Fallback-auf-Zeichnen; Resume; Cookie-Sicherheit. Security: Token nur Hash; Cookie httpOnly/Secure/SameSite;
Rate-Limit auf Magic-Link; keine Secrets im Client/Log.

## 10. Aufgeschoben (Scale-Zyklus, nach Briefing-Validierung)
Öffentliche Self-Serve-Anmeldung · automatisches iBALIS-Legitimitäts-Gate + öffentlicher WFS-Abgleich ·
dedizierte App-Daten-Box (+ Postgres-Backup/Restore) · volles Admin-Dashboard · Team-/Mitglieder-UI ·
Self-Service (Profil/Geräte/Schläge) · „auf Gerüstfläche zuschneiden".
