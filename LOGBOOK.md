# Logbuch — DoldenBlick

Chronologische Notizen zu Entscheidungen und Arbeitsschritten. Neueste Einträge oben.
Format je Eintrag: Datum · Was · Warum · Ergebnis/Verweis.

---

## 2026-06-27 · Rebrand „HopfenBlick" → „DoldenBlick" (alle Artefakte, Deliverables neu gerendert)
**Was:** Produktname durchgängig umgestellt.
- **Quelltext/Doku/Mockups/Report:** Marken-Token in allen forward-facing Artefakten ersetzt
  (CLAUDE.md, READMEs, REFERENCE.md, REPORT.md, `app/*`, `mockups/*.html`, `report/report.html`,
  `build.sh`, `scripts/stamp_pages.py`) — inkl. Zwei-Ton-Wortmarke `Dolden<small>Blick</small>`.
  Der **Agrarbegriff „Hopfen"** (Hopfenbau, Hopfendolde, Hopfen-Dashboard) wurde bewusst NICHT
  angetastet — nur das Marken-Kompositum.
- **Identifier:** localStorage-Keys `hopfenblick.*` → `doldenblick.*`; npm-Paket `doldenblick-app`
  (`package.json` + `package-lock.json`). Bestehende Demo-localStorage verwaist (neu ladbar).
- **Deliverables:** alte `HopfenBlick_*`-Dateien entfernt; mit dem **lokalen wkhtmltopdf/-image-Binary**
  (`~/.local/wkhtmltox/bin`, v0.12.6 patched-qt) + pymupdf neu gerendert → `DoldenBlick_Mockup1–4_*.png`,
  `report/img/*.jpg`, `DoldenBlick_Report.pdf` (11 S.). Neuer Name jetzt **in den Pixeln** (visuell geprüft).
- **History bewusst erhalten:** frühere LOGBOOK-Einträge und `docs/naming.md` (Namensvergleich)
  behalten „HopfenBlick" als Beleg; nur forward-facing Artefakte umbenannt.
- **„from now on":** in `CLAUDE.md` (Titel/Produktname) verankert + Projekt-Memory gespeichert.

**Warum:** Nutzerentscheidung (s. Namensfindungs-Eintrag). Der Engine-Blocker der Vorrunde
(kein wkhtmltopdf) entfiel, weil der Nutzer ein funktionierendes Binary bereitstellte.

**Verifikation:** repo-weite Suche zeigt keine Marken-Token mehr außerhalb der History;
Mockup- (m1) und PDF-Cover visuell geprüft (Wortmarke „DoldenBlick"); `tsc` sauber,
`npm test` grün (37/37), `build.sh` exit 0.

**Verweise:** TODO.md „Name/Marke" + „Report-PDF" abgehakt; `docs/naming.md` als Entscheidungs-Record.

---

## 2026-06-27 · Cloud-Server live + gehärtet, doldenblick.de mit HTTPS
**Was:** Ersten Cloud-Server für DoldenBlick bei **Hetzner Cloud** (Projekt „Hallertau")
aufgesetzt, Domain verdrahtet und gehärtet. Details + Reproduktion in `docs/infrastructure.md`,
Skripte in `infra/`.
- **Server** `doldenblick-01` (id 145742852): cx23, Nuremberg, Ubuntu 24.04 LTS,
  IPv4 91.98.203.240 / IPv6 2a01:4f8:1c18:6e05::1, SSH nur per Key. cloud-init:
  nginx + Platzhalterseite, ufw.
- **DNS** (Hetzner Cloud DNS, Zone-ID 1421900): A/AAAA für `@` und `www` → Server,
  CAA `letsencrypt.org`. Wichtig: Hetzner hat DNS in die **Cloud-API** integriert
  (`/v1/zones/.../rrsets`) — alte `dns.hetzner.com`-API abgelöst (301 → console).
- **HTTPS**: Let's Encrypt (certbot --nginx), 80→443-Redirect, Auto-Renewal (Dry-Run ok).
- **Härtung** (`infra/harden.sh`): SSH-Drop-in (key-only root, MaxAuthTries 3, kein
  Forwarding), fail2ban, unattended-upgrades, sysctl-Netzhärtung, Hetzner Cloud Firewall
  (id 11207357, nur 22/80/443/icmp) zusätzlich zur ufw, nginx Security-Header + HSTS.

**Warum:** Vom Konzept/Prototyp zum erreichbaren Produkt-Platzhalter unter der echten Domain.

**Verifikation:** `https://doldenblick.de` + `www` → HTTP 200, gültiges LE-Zertifikat
(ssl_verify=0), 80→443-Redirect; alle Security-Header gesetzt; A/AAAA/CAA an allen drei
Hetzner-NS aufgelöst; SSH bleibt durch die Cloud Firewall erreichbar; certbot-Renewal-Dry-Run ok.

**Offen (bewusst zurückgehalten, Lockout-/Workflow-Risiko):** Non-root-User +
`PermitRootLogin no`, SSH-Port verschieben, HSTS-Preload, Backups/Snapshots, Monitoring.
Lokaler Mac-Resolver hatte `doldenblick.de` als 127.0.0.1 gecacht → `dscacheutil -flushcache`.

**Verweise:** `docs/infrastructure.md`, `infra/cloud-init.yml`, `infra/harden.sh`. Noch nicht committed.

---

## 2026-06-27 · Namensfindung → Arbeitsname „DoldenBlick"
**Was:** Brainstorming zum Produktnamen. Kandidaten in vier Richtungen (Akronym,
Hopfen-Kompositum, regional, funktional) erzeugt, gegen **DENIC-Whois** auf freie
`.de`-Domains gefiltert und für die Shortlist ein **Marken-Vorabscreening** (7 parallele
Such-Agenten, DPMA/EUIPO-Webtreffer + offenes Web, Schwerpunkt Bier-Marken/Kl. 32)
gemacht. Vollständige Liste + Domain-Status + Marken-Findings in **`docs/naming.md`**.

**Entscheidung (Nutzer):** Neuer Arbeitsname **„DoldenBlick"** (`doldenblick.de` frei).
*Dolde* = Hopfendolde, Schwester von „HopfenBlick".

**Wichtig:** Nur Web-Vorabscreening, **keine** rechtsverbindliche Markenrecherche; die
amtlichen Register (DPMAregister, TMview) ließen sich nicht automatisiert abfragen.
Restrisiko (benachbarte „Dolden"-Biermarken wie Riedenburger *Dolden Sud*) **bewusst
akzeptiert** für jetzt. Cleanere Alternativen wären „HopfenWacht"/„DoldenKompass" gewesen.

**Warum:** Name sollte regional/evokativ sein **und** eine freie `.de`-Domain haben.

**Offen:** Amtliche Markenrecherche (Kl. 9/42 + 32) vor kommerziellem Einsatz; Domain
sichern; Rename „HopfenBlick" → „DoldenBlick" quer durchs Repo (separater Schritt). → `TODO.md`.

**Verweise:** `docs/naming.md`. Noch nicht committed.

---

## 2026-06-27 · Fixes aus Devil's-Advocate-Review (Ehrlichkeit & Korrektheit)
**Was:** Umsetzung der verifizierten Punkte aus einer adversariellen Review (12 Thesen,
je gegengeprüft). Alle Code-Änderungen test-first (TDD).
- **Wetter** (`weather.ts`): Nachtfrost-Zweig im abgeleiteten Pfad (Tagestiefstwert ≤ 0 →
  Frostgefahr/alert, ≤ 2 → Bodenfrost/warn); `alertsReachable` trennt „nicht abrufbar"
  (null) von „keine Warnung" ([]); Wetterkarte: Hinweis „kein Echtzeit-Alarm" (+ neue Tests).
- **Spritzfenster** (`sprayWindow.ts`): Inversionsvorsicht bei Schwachwind-Dämmerung
  (`inversion`-Flag, Abdrift-Hinweis), Überschrift „Wetter geeignet" statt Spritz-Anweisung.
- **Feuchtkugel** (`wetbulb.test.ts`): Referenztabelle über den Spritzbereich; Meereshöhe-
  Druck-Annahme + Hallertau-Höhe dokumentiert.
- **Bewässerung** (`cards.ts`/`overview`): Überschrift als **Tendenz** (`balanceLabel`)
  statt „Defizit X mm" (mm nur klein in der Viz); 5/20-Schwellen als Heuristik dokumentiert.
- **Raster-Ehrlichkeit** (`grid.ts`): `gridCellKey` (~2 km); on-screen-Hinweis, wenn der
  gewählte Schlag mit Nachbarn dieselbe Open-Meteo-Zelle teilt.
- **Import-Härtung** (`importShape.ts`): `assertPlausibleBavaria`/`isInBavaria` —
  klarer Fehler bei nicht reprojizierten Koordinaten (fehlende/zerbrochene .prj).
- **Layout** (`overview`): drei „KOMMT NOCH"-Kacheln → ein **Roadmap-Streifen** unter den
  Live-Karten; **Whole-Farm**-Tageskopf „N Hinweise für morgen" (ein Abruf je Rasterzelle).
- **Prod-Proxy** (`server.mjs`, `npm run serve`): liefert `dist/` + proxt `/api/brightsky`
  (Dev-Proxy galt nur für `npm run dev`); Cloudflare-Worker-Snippet im `app/README`.
- **Report-Faktenkorrektur:** BVerwG-Urteil präzisiert (§ 1 i.V.m. Anlagen 1 u. 3 der AVDüV,
  Az. 10 CN 1.25, Datumsstempel) und Kostenaussage „ohne teure Lizenzen" im Summary mit
  kommerzieller Stufe ergänzt — in `REPORT.md` **und** `report/report.html`.

**Warum:** Die Review fand keine grundsätzlichen Fehlentscheidungen, aber je einen realen,
schmalen Punkt pro These — meist „Vorbehalt aus Code/README on-screen sichtbar machen" plus
zwei echte Code-Lücken (frostblinder abgeleiteter Pfad; fehlender Prod-Proxy).

**Verifikation:** `tsc --noEmit` sauber; `npm test` grün (37 Tests, 7 Dateien). `server.mjs`
syntaxgeprüft (`node --check`).

**Offen:** `deliverables/HopfenBlick_Report.pdf` ist **veraltet** — Neubau braucht
`wkhtmltopdf` (+ pymupdf), hier nicht installierbar (Homebrew-Cask entfernt). Neubau via
`./build.sh` auf einer Maschine/Docker mit der Toolchain. Roadmap-Punkte (Farmer-Research,
NDRE-Backtest, WFS-Onboarding, Proxy-Deployment) siehe `TODO.md`.

**Verweise:** REFERENCE.md §§5–7, 12 mitgepflegt; app/README aktualisiert.

---

## 2026-06-27 · .env-Format korrigiert & Secrets vor Git geschützt
**Was:** `.env` aufgeräumt und abgesichert.
- **Format:** Der Earth-Engine-Dienstkonto-Schlüssel lag als **mehrzeiliges, nicht
  quotiertes JSON** direkt in `.env` — bricht zeilenorientierte Parser
  (python-dotenv, Node `dotenv`, `source`). JSON ausgelagert nach
  `secrets/ee-service-account.json`; `.env` referenziert es über die
  Standardvariable `GOOGLE_APPLICATION_CREDENTIALS` (Google-Clientlibs lesen sie nativ).
- **Schutz:** `.env` war **nicht** in `.gitignore` und untracked — ein `git add .`
  hätte echte Zugangsdaten committed. `.gitignore` um `.env`, `.env.local`,
  `secrets/` und `!.env.example` ergänzt.
- **Schema-Doku:** `.env.example` mit leeren Platzhaltern angelegt (eincheckbar).
- OpenWeatherMap- und Hetzner-Key bleiben als einzeilige `KEY=value` in `.env`
  (kein Auslagern nötig — einfache String-Tokens; Auslagern war nur ein
  Format-Fix für das JSON-Blob, kein Sicherheitsgewinn).

**Warum:** Mehrzeiliges JSON ist im `.env`-Format unparsbar; ungetrackte echte
Secrets sind ein Leak-Risiko.

**Verifikation:** `git check-ignore` bestätigt `.env`/`secrets/` ignoriert,
`.env.example` trackbar; `git status` zeigt keine Secrets mehr. JSON valide
(`json.load` ok), `.env` parst zu 4 sauberen Keys (zuvor gebrochen).

**Offen (Nutzer):** Zugangsdaten **rotieren**, falls die alte `.env` je geteilt/
gepusht wurde (GCP-Key, OpenWeatherMap, Hetzner). Im Repo-Verlauf war sie nie.

**Verweise:** Noch nicht committed (wartet auf Freigabe).

---

## 2026-06-27 · Referenzdateien REFERENCE.md & REPORT.md
**Was:** `REFERENCE.md` (Single Source of Truth: Design-Tokens inkl. Farb-/Status-
Paletten, Typografie, App-Architektur, API-Endpunkte mit Parametern, Domänen-Formeln,
Konventionen, Grenzen) und `REPORT.md` (vollständige Markdown-Fassung des Konzept-
berichts aus `report/report.html` inkl. Tabellen, Hinweis-Boxen, Abbildungs-Captions
und Berichts-Designschema) angelegt. Schnellzugriff in `CLAUDE.md` verlinkt.
**Warum:** Künftig leichter und durchsuchbarer Zugriff auf alle Informationen an einem Ort.
**Ergebnis:** Verweise in `CLAUDE.md`; `report/report.html` bleibt maßgeblich.

---

## 2026-06-27 · App-Prototyp „Übersicht" + reales Onboarding
**Was:** Neuer Ordner `app/` — lauffähiger Prototyp der Übersicht-Ansicht
(Vite + TypeScript + maplibre-gl, kein Framework). Mockups/Report/`build.sh`
bleiben unverändert als Referenz.

**Umgesetzt:**
- **Reales Onboarding** (`app/src/onboarding/`): iBALIS **Shape-ZIP-Import** im
  Browser (`shpjs` + `proj4`, UTM32/EPSG:25832 → WGS84), **GeoJSON-Upload**,
  **„Demo-Betrieb laden"**; Review-Schritt (Name/Sorte/Fläche prüfen, Fläche via
  `@turf/area` berechnet); Persistenz in `localStorage`.
- **Übersicht** (`app/src/overview/`): MapLibre-Karte (OpenFreeMap keyless +
  Bayern-DOP40-WMS), Schläge wählbar (Klick/Liste), Standort = Zentroid.
  Live-Ampelkarten aus Open-Meteo: Wetter & Warnungen (+ DWD via Bright Sky),
  Spritzfenster (Wind/Niederschlag/ΔT), Bewässerung (ETc = ET₀·Kc − Niederschlag).
  Peronospora/Feld-Check/Wachstum als Platzhalter. Jede Karte nennt ihre Quelle.
- **Domäne** (`app/src/domain/`): `wetbulb` (Stull 2011), `sprayWindow`,
  `waterBalance` (Kc Hopfen = 1.05), `weather`, `fields`. Vitest: 9 Tests grün.

**Entscheidungen (nach Reflexion mit Nutzer):**
- Basemap **OpenFreeMap** statt MapLibre-Demotiles (bei Feld-Zoom sonst leer).
- DWD-Warnungen über **Vite-Proxy** (`/api/brightsky`) statt CORS-Direktabruf.
- **Keine erfundene Bodenfeuchte** (Mockup-Wert nicht datengedeckt) → ehrliche
  klimatische Wasserbilanz; Bewässerung **mit Kc** (ETc) statt nur ET₀.
- Schriften **self-hosted** via `@fontsource` (DSGVO, offline) statt Google-CDN.
- Lade-/Fehlerzustände je Karte; Tests für die riskante Mathematik.

**Verifikation:** `tsc` sauber, `npm run build` ok, 9/9 Tests grün. Flow im
Browser (Playwright) durchgespielt: Onboarding → Demo → Review → Übersicht.
Open-Meteo und Bright Sky per curl gegen die echten Endpunkte bestätigt
(Live-Daten füllen die Karten auf einer Maschine mit Netzzugang).

**Verweise:** Commit `ef6ee5e`; Details in `app/README.md`. Offene Punkte → `TODO.md`.

---

## 2026-06-27 · Repository initialisiert
**Was:** Inhalt von `hopfenblick.zip` ins Repo übernommen (mockups/, report/,
deliverables/, scripts/, build.sh, CLAUDE.md, README.md, .gitignore).
**Warum:** Ausgangsstand (Konzept-Mockups + Bericht) als Grundlage einchecken.
**Ergebnis:** Bestehende GPL-3.0-`LICENSE` passt zur README; Commit `f28a7c0`.
