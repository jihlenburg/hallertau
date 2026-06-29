# TODO — DoldenBlick

Offene Punkte und nächste Schritte. `[ ]` offen · `[x]` erledigt · `[~]` in Arbeit.
Erledigtes wandert mit Datum/Commit ins `LOGBOOK.md`.

## Stand der offenen Punkte (2026-06-28, autonomer Lauf)
> **PRÄMISSENWECHSEL (2026-06-28): „Infrastruktur vor Nachfrage!"** — das Nachfrage-Gate ist **aufgehoben**.
> ALLE Datenquellen sind jetzt in Scope; die zuvor „gegateten" server-only Quellen (Sentinel/GEE, RADOLAN,
> LfL, ERA5, SoilGrids) werden **proaktiv gebaut**. Reihenfolge wird durch die laufende Satelliten-Recherche
> informiert. Siehe Memory `infrastructure-before-demand`. Die **Auflösungs-Ehrlichkeit** bleibt als
> Daten-/UX-Regel (Screening-Hinweis bis Feld-Backtest), nicht als Bau-Gate.

Alle **autonom sicher umsetzbaren Engineering-Punkte sind erledigt** (s. Häkchen + LOGBOOK):
Client-Cutover Wasserbilanz, responsives Mobil-Layout, Backend-Open-Meteo-Cache, Boden-Auswahl,
GeoJSON-Export, Bundle-Verschlankung, fields-Tests, 7-Tage-Vorhersage, Inversion mit Bewölkung,
Sorte-Fidelity, interaktiver Spritzfenster-Streifen. Die verbleibenden `[ ]`:
- **Jetzt in Scope (Gate aufgehoben):** Satelliten-„Feld-Check" (Sentinel/Fusion), RADOLAN-Radar, LfL
  Peronospora, ERA5, server-Compute-Schicht — Recherche-Schwarm + Pixel-Purity-Backtest laufen/erledigt.
- **Blockiert (extern/menschlich/Zugangsdaten):** Domain/`.info`-Registrierung, Markenrecherche,
  MapTiler-Key, Push/E-Mail (Channel+Creds), Monitoring/Alerting (Alarm-Kanal nötig), Lizenzklärung,
  Farmer-Research, „echte Beispieldateien" für DBF-Encoding/Format-Tests.
- **Riskant unbeaufsichtigt:** SSH-Härtung (Non-root/Port — Aussperr-Risiko), HSTS-Preload (bindend).
- **Größere Features (Design mit dir):** „auf Gerüstfläche zuschneiden", InVeKoS-WFS-Auswahl,
  manuelles Zeichnen (terra-draw) — je eigener Brainstorm/Spec wert.
- **Bewusste Entscheidung:** Bright-Sky-Cache zurückgestellt — DWD-Warnungen (sicherheitskritisch)
  bleiben auf dem resilienten nginx-Direktpfad statt an die Node-Service-Uptime gekoppelt zu werden.
- **Marginal:** Client-seitige Dedup (Backend-Cache mildert sie bereits); freie Sorten-Eingabe.

## Prototyp-App (`app/`)

### Onboarding
- [x] Mobile Onboarding-Variante (Touch, kleinere Viewports) — responsives Layout (Viewport
      device-width, Media-Queries ≤1100/≤760, Drop-Zone vertikal). — 2026-06-28
- [ ] „Auf Gerüstfläche zuschneiden"-Screen (Vorgewende/Wege ausnehmen) für die
      spätere Satelliten-Auswertung.
- [ ] „Auf der Karte antippen": offene **InVeKoS-Feldstücke** per WFS laden und wählen.
- [ ] „Manuell zeichnen / GPS": Polygone selbst zeichnen (z. B. terra-draw).
- [ ] DBF-Encoding robust behandeln (Umlaute, cp1252/.cpg) beim Shape-Import.
- [ ] Mehrere Schlagkartei-Formate testen (365FarmNet, NEXT, FARMDOK; ISO-XML).
- [x] **Boden-Auswahl je Schlag** in der Ersteinrichtung (SOIL_TYPES-Dropdown → `FieldProps.soilType`),
      speist `/api/water-balance` je Schlag. — 2026-06-28
- [~] Sorten-Schritt: importierte Sorte wird im Dropdown erhalten (Fidelity-Fix, kein stilles
      Zurücksetzen auf „Herkules") ✓; offen: freie Sorten-Eingabe („andere …"). — 2026-06-28

### Übersicht / Karten
- [ ] **Peronospora**: LfL-Warndienst (Hüll) anbinden (Quelle/Recht klären).
- [~] **Feld-Check (Satellit)** *(Backend LIVE)*: zustandsloser `rs/`-Dienst (CDSE Sentinel-2,
      `POST /api/field-vigor` → NDVI/SAVI 10 m + NDRE/CIre/NDMI 20 m, Pixel-Purity-Konfidenz,
      Screening-Label) deployt auf doldenblick-01 (systemd `doldenblick-rs`, nginx). Backtests:
      Geometrie (`scripts/pixel-purity-backtest.mjs`) + echtes S2 via GEE (`scripts/gee-backtest.py`).
      **Offen:** Client-„Feld-Check"-Karte (ruft `/api/field-vigor`, ersetzt den „Bald verfügbar"-Chip);
      später LfL-Krankheits-Konnektor, RADOLAN, Thermal/SAR in FAO-56, optional PlanetScope/UAV-Tier.
- [ ] **Wachstum & Erntefenster**: Phänologie-/GTS-Modell je Sorte.
- [x] 7-Tage-Vorhersagestreifen im Map-Panel (Wochentag · Wetterglyph · Max/Min · Regen-%),
      aus Open-Meteo-Tageswerten. — 2026-06-28
- [x] **Interaktiver Spritzfenster-Streifen:** Fenster-Markierung (Unterklammer + Label, Anzeige bis
      Fensterende verlängert) + Stunden-Detail bei Hover/Tap/Fokus inkl. bindendem Grund
      (`sprayReason`). — 2026-06-28
- [~] Pro-Gitterzelle cachen — Whole-Farm-Kopf bündelt Wetter je Rasterzelle (`gridCellKey`);
      Backend cacht zudem die Wasserbilanz je ~1-km-Zelle (TTL), sodass der doppelte
      `refresh()`/`refreshFarm()`-Abruf der gewählten Zelle billig ist. Client-Dedup noch offen (Nit).
- [ ] Kc nach BBCH/Phase staffeln statt fixem 1.05.
- [x] Inversionsvorsicht verfeinert: Bewölkung (`cloud_cover`) einbezogen — Inversionswarnung nur
      bei Schwachwind + Dämmerung UND klarem Himmel (≤50 %); fehlt der Wert, greift der Proxy. — 2026-06-28
- [x] Tipping-Bucket/AWC-Bodenmodell als echte Bewässerungs-Stufe — umgesetzt im Backend
      (FAO-56 Wurzelraum-Bilanz + Ks, `/api/water-balance`), Client gecutovert. — 2026-06-28

### Technik / Qualität
- [x] Bright Sky im **Prod-Build**: `server.mjs` (`npm run serve`) liefert `dist/` + Proxy;
      Cloudflare-Worker-Snippet im `app/README`. — 2026-06-27 (Deployment noch offen, s. u.)
- [x] Prod-Proxy **deployt**: nginx Reverse-Proxy `/api/brightsky` auf doldenblick-01
      (`infra/deploy.sh` + `infra/nginx-doldenblick.conf`). — 2026-06-28
- [ ] Optional: MapTiler-Key per `.env` als höherwertige Basemap-Alternative.
- [x] Bundle-Größe senken: shpjs (+proj4) lazy via dynamischem `import()` → eigener Chunk,
      Initial-Bundle 987→846 KB (gzip 280→233). maplibre bleibt above-fold im Initial-Chunk
      (bewusst nicht lazy). — 2026-06-28
- [~] Mehr Tests: `weather` ✓, `grid` ✓, `cards` ✓, Import-Bayern-Guard ✓, `fields.normalizeField` ✓,
      `api/waterBalance`-Client ✓, `export` ✓, API (Domäne/Quelle/Route/Version/Cache) ✓;
      offen: echte Shape-/GeoJSON-Parser (mit echten Beispieldateien).
- [x] Export der angelegten Schläge als GeoJSON (Backup ohne Backend) — „Export"-Button im
      Karten-Panel. — 2026-06-28

## Name / Marke (s. `docs/naming.md`)
- [x] Arbeitsname festgelegt: **„DoldenBlick"** (`doldenblick.de` frei). — 2026-06-27
- [ ] Domain `doldenblick.de` registrieren/sichern (Momentaufnahme, keine Reservierung).
- [ ] **Amtliche Markenrecherche** vor kommerziellem Einsatz: DPMAregister + EUIPO/TMview,
      Nizza-Klassen 9 & 42 (Software) und 32 (Bier); Restrisiko „Dolden"-Biermarken
      (Riedenburger *Dolden Sud*, *Dolden Mädel*) bewusst akzeptiert für jetzt.
- [x] Rename „HopfenBlick" → „DoldenBlick" quer durchs Repo (CLAUDE.md, README,
      Mockups, Report, `deliverables/`-Dateinamen, app/, localStorage-Keys, npm-Paket);
      Deliverables mit lokalem wkhtml-Binary neu gerendert. — 2026-06-27

## Infrastruktur / Hosting (s. `docs/infrastructure.md`)
- [x] Cloud-Server `doldenblick-01` bei Hetzner (Projekt „Hallertau"), Ubuntu 24.04, nginx. — 2026-06-27
- [x] DNS-Zone `doldenblick.de` + A/AAAA/CAA, Delegation `.de` → Hetzner-NS. — 2026-06-27
- [x] HTTPS via Let's Encrypt (certbot, Auto-Renewal). — 2026-06-27
- [x] Basis-Härtung: SSH-Drop-in, fail2ban, unattended-upgrades, sysctl, ufw + Cloud Firewall,
      nginx Security-Header/HSTS. — 2026-06-27
- [ ] **Optional, schwerer/Workflow:** Non-root-Sudo-User + `PermitRootLogin no`; SSH-Port verschieben.
- [ ] **Optional:** HSTS-Preload-Submission (erst nach längerem Stabilbetrieb, bindend).
- [x] **Backups** des Servers aktiviert (Hetzner, täglich, 7 Slots, Fenster 18–22 UTC, +20%). — 2026-06-27
- [ ] **Monitoring/Alerting** (Uptime, Zertifikatsablauf, Plattenplatz).
- [ ] `doldenblick.info` registrieren (zurückgestellt) bzw. später Redirect auf `.de`.
- [x] Deployment der echten App (`app/`) auf doldenblick-01 statt Platzhalter; Prod-Proxy
      `/api/brightsky` via nginx; `https://doldenblick.de` live verifiziert. — 2026-06-28

## Produkt / Konzept
- [x] **Backend (`api/`) — Strong Separation of Concerns, erste Scheibe:** zustandsloser
      Wasserbilanz-Compute-Service (FAO-56-Bucket + Ks), Open-Meteo-Warm-up serverseitig (BFF),
      `GET /api/water-balance` + `GET /api/version` + Versionsvertrag (`X-API-Version`/426-Guard).
      33 Vitest grün, Live-Smoke ok. **Kein Postgres.** — 2026-06-28
- [x] **Deploy `api/` auf doldenblick-01:** Node 22 + systemd `doldenblick-api` (Loopback 8787,
      gehärtet) + nginx-`/api/`-Locations (additiv); HTTPS-Smoke grün; Fastify 5.8.5, 0 Schwachstellen.
      Reproduzierbar via `infra/deploy-api.sh`. — 2026-06-28
- [x] **Client-Cutover Wasserbilanz:** Overview ruft `GET /api/water-balance` statt selbst zu rechnen;
      altes `computeWaterBalance`/`kc` entfernt; Client sendet `X-Client-API`. Adversarielle Review
      (17 Befunde behoben), beide deployt, HTTPS-Smoke grün. — 2026-06-28
- [x] Caching **Open-Meteo** im Backend: In-Memory-TTL-Cache (30 min, ~1-km-Zelle) + Bündelung
      gleichzeitiger Anfragen; live ~266 ms → ~70 ms (Cache-Hit). — 2026-06-28
- [ ] Caching **Bright Sky** (DWD-Warnungen) im Backend (derzeit nur nginx-Proxy, kein Cache).
- [ ] Push-/E-Mail-Benachrichtigungen (abendliches Briefing) — die Übersicht flaggt
      Nachtfrost jetzt in-app und verweist auf die DWD-WarnWetterApp, ersetzt aber keinen
      Echtzeit-Alarm; einziger DoldenBlick-eigener Push-Kandidat ist das Spritzfenster.
- [ ] Primäre **Farmer-Research** (Hallertau) zur Validierung der Abend-Briefing-Kadenz
      und Whole-Farm-Synthese (Persona in REPORT.md §3 ist bislang unbelegt).
- [x] **Report-PDF + Mockups neu gebaut**: alle Deliverables mit lokalem
      wkhtmltopdf/-image-Binary (`~/.local/wkhtmltox/bin`) + pymupdf neu gerendert —
      neuer Name „DoldenBlick" in den Pixeln (4 PNG, 4 Vorschau-JPG, PDF 11 S.). — 2026-06-27
- [ ] Lizenzen vor produktivem Einsatz klären (Open-Meteo/Bright Sky nicht-kommerziell;
      LfL-Weiterverbreitung ggf. abstimmen).

## Erledigt (Kurzliste, Details im LOGBOOK)
- [x] Repository initialisiert (Mockups, Report, Build). — 2026-06-27
- [x] App-Prototyp „Übersicht" + reales iBALIS-/GeoJSON-Onboarding. — 2026-06-27
- [x] Devil's-Advocate-Fixes: Frost-Erkennung, Inversionsvorsicht, Wasserbilanz als Tendenz,
      Raster-Ehrlichkeitshinweis, Import-Plausibilitätscheck, Roadmap-Streifen,
      Whole-Farm-Tageskopf, Prod-Proxy, Report-Faktenkorrektur (alle test-first). — 2026-06-27
- [x] **Visuelle Review-Schleife als Hook automatisiert:** `npm run screenshots` (puppeteer-core +
      System-Chrome) + Projekt-Hook `.claude/settings.json` (`PostToolUse`/`Bash`, async) feuert bei
      vollem Testlauf; Frutiger-Urteil bleibt bei Claude. — 2026-06-28
