# Logbuch — DoldenBlick

Chronologische Notizen zu Entscheidungen und Arbeitsschritten. Neueste Einträge oben.
Format je Eintrag: Datum · Was · Warum · Ergebnis/Verweis.

---

## 2026-06-28 · Satelliten-Recherche-Schwarm abgeschlossen → Synthese + 7-stufige Bau-Reihenfolge
**Was:** Der Deep-Research-Schwarm (8 Agenten, ~294k Tokens, 6 Facetten + Synthese + Vollständigkeits-Kritik)
ist fertig; Ergebnisse unter `docs/hops/satellite/`. **Kernbefund:** kein freier Satellit ist auf 0,5–2 ha
Hopfen-Gerüst teilflächengenau → **gestaffelter Stack**: S2 (+S1, +HLS) frei = Screening-Backbone;
Weltraum-Thermal (ECOSTRESS/Landsat-ET) + S1-Bodenfeuchte als Inputs in den **bestehenden FAO-56-Dienst**;
PlanetScope (~3 m) = bezahlte Feld-Delta; **UAV/VHR = einzige im Hopfen peer-reviewed validierte teilflächen-
genaue Quelle** (Štofaj/Kumhálová 2025, Žatec). **Datenzugang: CDSE Sentinel Hub Statistical API** (server-
seitige Per-Schlag-Zonalstatistik, ~€0/Monat im Demo-Maßstab) — GEE vom kritischen Pfad fern. Ehrlichkeit
bestätigt: Screening-Label Pflicht, **keine Qualitäts-/Alpha-Claims**, **keine RS-Krankheitsdiagnose**
(an LfL/ISIP deferieren). 7-stufige Bau-Reihenfolge; 12 Lücken/Risiken in `research-gaps.md`.
**Verweise:** `docs/hops/satellite/{README,sensors,indices,literature,stress,infra,fieldscale,research-gaps}.md`.

## 2026-06-28 · Prämissenwechsel „Infrastruktur vor Nachfrage" + Satelliten-Recherche & Pixel-Purity-Backtest
**Was:** Nutzerentscheidung (endgültig): das **Nachfrage-Gate ist aufgehoben** — ALLE Datenquellen werden
genutzt, Infrastruktur wird **proaktiv** gebaut. (1) Deep-Research-Schwarm (Workflow `satellite-hops-research`,
6 Facetten + Synthese + Vollständigkeits-Kritik) zur neuesten Satelliten-/Fernerkundungsforschung für Hopfen
gestartet. (2) Datenfreier **Pixel-Purity-Backtest** (`scripts/pixel-purity-backtest.mjs`) auf den Demo-Schlägen:
kanten-reine Sentinel-2-Pixel je Schlag, phasen-gemittelt — **10 m ~160–374**, **20 m ~36–87**.
**Befund:** 10 m → Feld-Aggregat + grobe Teilfläche tragfähig; 20 m NDRE → nur **Feldmittel als Screening**,
teilflächengenau nicht seriös; intra-Schlag-Mischung (Spalier) ist NICHT erfasst → **obere Schranke**, echter
NDRE-Zeitreihen-Backtest gegen Bodenwahrheit (CDSE/GEE) ist der nächste Schritt.
**Warum:** „Es gibt keine Nachfrage ohne erstklassige Infrastruktur." Prämisse in Memory + Doku verankert.
**Verweise:** `docs/hops/satellite/field-scale-backtest.md`; Memory `infrastructure-before-demand`.

## 2026-06-28 · Interaktiver Spritzfenster-Streifen (Fenster-Markierung + Stunden-Detail)
**Was:** (Brainstorm → Spec → TDD → Deploy.) Der Streifen ist jetzt ein CSS-Grid (1 Spalte je Stunde):
- **Fenster-Markierung:** Unterklammer + Label „Fenster HH–HH" exakt unter den Fenster-Balken; der
  Anzeige-Bereich verlängert sich bis zum Fensterende (mind. 24 h, Deckel 36 h) — behebt die frühere
  Inkonsistenz „Streifen zeigt 1 Balken, Überschrift nennt 08–11".
- **Stunden-Detail:** fokussierbare Balken (Hover/Tap/Tastatur) → Detailzeile (`aria-live`) mit Uhrzeit,
  ΔT, Wind, Böen, Regen %, Wolke % und dem BINDENDEN Grund (`sprayReason`): nass → Nacht → Wind/Böen →
  ΔT zu hoch → ΔT zu niedrig → geeignet (+ Inversionsvorsicht). Ruhezustand = Legende.
- `SprayHour` um `gust`/`prob` erweitert; `barsViz` → `sprayStrip` ersetzt.
**Warum:** Antwortet auf die Nutzerfrage „woher kommt das Muster?" direkt in der UI (bindender Grund je
Stunde) und macht Streifen + Überschrift konsistent.
**Verifikation:** 70 Tests grün (sprayReason je Zweig, sprayHourDetail, sprayStrip — TDD); Build sauber;
Desktop + Mobil verifiziert + Fokus-Screenshot (14:00 → „✗ Wind/Böen zu stark", Böen 27 > 25). Deployt.
**Verweise:** Spec `docs/superpowers/specs/2026-06-28-spray-strip-interactivity-design.md`;
`app/src/domain/sprayWindow.ts`, `app/src/overview/{cards,index}.ts`, `app/src/styles.css`.

## 2026-06-28 · Spritzfenster: Inversionswarnung mit Bewölkung verfeinert
**Was:** `cloud_cover` in den Open-Meteo-Stundenabruf aufgenommen; die Strahlungsinversions-Warnung
greift nur noch bei Schwachwind (<4 km/h) + Dämmerungsstunde UND klarem Himmel (≤50 %). Fehlt der
Bewölkungswert, bleibt der bisherige Schwachwind-Proxy (rückwärtskompatibel).
**Warum:** Bedeckte Nächte unterdrücken die Ausstrahlung → keine (oder schwache) Inversion; die alte
Heuristik warnte auch bei Bewölkung unnötig.
**Verifikation:** 52 Tests grün (2 neue: bedeckt→keine Warnung, klar→Warnung, TDD), Build sauber. Deployt.
**Verweise:** `app/src/domain/sprayWindow.ts`, `app/src/api/openMeteo.ts`.

## 2026-06-28 · 7-Tage-Vorhersagestreifen im Karten-Panel
**Was:** Kompakter Streifen unter der Karte: je Tag Wochentag (heute „Heute") · minimalistisches
Wetterglyph (`wmoCategory` → clear/partly/cloud/fog/rain/snow/storm) · Max/Min · Regenwahrscheinlichkeit.
Aus den Open-Meteo-Tageswerten des gewählten Schlags (`forecastStrip`, rein/getestet).
**Verifikation:** 50 Tests grün (wmoCategory + forecastStrip, TDD); Build sauber; Desktop- und
Mobil-Screenshot (7 Spalten passen auf 390 px) geprüft. Deployt.
**Verweise:** `app/src/domain/wmo.ts`, `app/src/overview/cards.ts`, `app/src/styles.css`.

## 2026-06-28 · Initial-Bundle verkleinert (shpjs/proj4 lazy)
**Was:** `importShapeZip` lädt shpjs (+ proj4) per dynamischem `import()` erst beim tatsächlichen
ZIP-Import → eigener Lazy-Chunk (~142 KB / gzip 47 KB); Initial-Chunk 987→846 KB (gzip 280→233).
**Warum:** Die Übersicht (häufigster Pfad für wiederkehrende Nutzer) braucht den Shape-Parser nie.
**Hinweis:** maplibre bleibt bewusst im Initial-Chunk (Karte ist above-fold).
**Verifikation:** 47 Tests grün, Build sauber (Lazy-Chunk sichtbar). Deployt.
**Verweise:** `app/src/onboarding/importShape.ts`.

## 2026-06-28 · GeoJSON-Export der Schläge (Backup ohne Backend)
**Was:** „Export"-Button im Karten-Panel lädt die Schläge als GeoJSON-FeatureCollection herunter
(`export.ts`: `fieldsToGeoJson` rein/getestet + `downloadText` via Blob/Anchor).
**Warum:** Datensicherung ohne Server — der Nutzer behält seine angelegten Flächen.
**Verifikation:** 47 Tests grün (2 neu, TDD), Build sauber, Übersicht-Screenshot zeigt den Button. Deployt.
**Verweise:** `app/src/export.ts`, `app/src/overview/index.ts`.

## 2026-06-28 · Onboarding: Boden-Auswahl je Schlag
**Was:** Spalte „Boden" (SOIL_TYPES, großgeschrieben) in der Schlag-Prüfung; schreibt
`FieldProps.soilType` (Default Lehm beim Übernehmen). Speist die live `/api/water-balance` je Schlag
(Client sendet `soilType`); Lead-Text ergänzt („Der Boden bestimmt die Wasserbilanz je Schlag").
**Warum:** Macht die per-Schlag-Wasserbilanz farmer-steuerbar (vorher überall Lehm-Default).
**Verifikation:** 45/45 Tests grün, Build sauber, Onboarding-Review-Screenshot zeigt die Spalte. Deployt.
**Verweise:** `app/src/onboarding/index.ts`.

## 2026-06-28 · Backend-Cache für Open-Meteo (TTL + Anfrage-Bündelung)
**Was:** In-Memory-TTL-Cache (`api/src/sources/cache.ts`, 30 min, Schlüssel ~1-km-Zelle) vor dem
Open-Meteo-Abruf. Cacht die **Promise** (bündelt gleichzeitige identische Anfragen — z. B. Whole-Farm
mit mehreren Schlägen einer Zelle), cacht **Fehler nicht** (nächster Aufruf lädt neu), Zeit injizierbar.
Route nutzt standardmäßig `fetchOpenMeteoDailyCached`.
**Warum:** Die Übersicht ruft `/api/water-balance` je Schlag; wiederholte/co-lokierte Anfragen sollen
nicht jedes Mal die freie Open-Meteo-API treffen (Latenz + Höflichkeit).
**Verifikation:** 38/38 Tests grün (5 neue Cache-Tests, TDD); Build sauber; live deployt: Erstanfrage
~266 ms, Folgeanfragen ~70-80 ms (Cache-Hit).
**Verweise:** `api/src/sources/{cache,openMeteo}.ts`, `api/src/app.ts`.

## 2026-06-28 · Responsives Mobil-Layout (Übersicht + Onboarding)
**Was:** Viewport `width=device-width`; Media-Queries — ≤1100px stapeln die zweispaltigen Layouts
(Übersicht-Karten|Karte, Onboarding) untereinander, ≤760px einspaltige Karten, umbruchfähige Leiste
(Datum eigene Zeile), niedrigere Karte (340px), Drop-Zone vertikal. **ResizeObserver** in `FieldMap`
vermisst die Karte bei Layout-/Viewport-Änderungen neu — behebt eine leere/zu schmale Karte nach
Reflow (Single-Column-Mobil) bzw. Geräte-Drehung.
**Warum:** Das Abend-Briefing muss auf Telefon/Schlepper-Display lesbar sein (Viewport war desktop-fix
`width=1280` → auf dem Handy skaliertes Desktop-Layout).
**Verifikation:** 45/45 Tests grün, Build sauber; Screenshots Desktop unverändert + Mobil (390×844)
geprüft — Übersicht und Onboarding stapeln sauber, Karte füllt voll (alle 6 Schläge sichtbar).
Deployt; HTTPS-Smoke grün.
**Verweise:** `app/index.html`, `app/src/styles.css` (Responsiv-Block), `app/src/map.ts` (ResizeObserver).

## 2026-06-28 · Client-Cutover Wasserbilanz → Backend-API (live) + adversarielle Review
**Was:** Die Übersicht rechnet die Wasserbilanz nicht mehr selbst, sondern rendert `GET /api/water-balance`.
- **Client:** `api/waterBalance.ts` (typisierter Client, `X-Client-API`, 426→„App veraltet"); WB-Karte
  aus dem API-Ergebnis (Dr/RAW/TAW, Ks, Netto-Empfehlung, Fenster) mit Wurzelraum-„Eimer"-Meter;
  unabhängige Degradation; Farm-Header zählt WB je Schlag. Tot entfernt: client-`computeWaterBalance`/`kc`.
- **Proxys:** vite.config.ts + server.mjs reichen `/api/water-balance` + `/api/version` ans Backend
  durch (Prod: nginx). Capture-Wait gehärtet (`!lädt …`).
- **Adversarielle Review** (Workflow, 4 Linsen × Refute/Confirm, 27 Agenten): 23 Befunde, **17 bestätigt**
  (0 Blocker). Behoben: (M) Farm-Header fror bei Wetter-Fehler auf „lädt" ein → defensiv je Zelle +
  terminaler ehrlicher Zustand; (M) Schlagliste tastaturbedienbar (`button`-Semantik, `aria-current`,
  Enter/Space). (Minor) WB-Fehler/Inkompatibel jetzt RUHIG (info statt rotem Alarm); Disclaimer in allen
  Zweigen; „Boden: Lehm" großgeschrieben; „Netto ≈ X mm … ggf. auf mehrere Gaben"; RO=0/I=0 in der Karte
  sichtbar; Backend-Caveat provenienz-genau (Bodenart-Richtwert statt „250-m-Raster"); Kontrast AA
  (`--faint`, Summary-Pill, Fokus-Ring auf der Leiste); RAW-Marke kräftiger; Klartext-Caption „61 Tage".

**Warum:** „map tiles client, water balance … on the backend" — Strong Separation am Client vollzogen.

**Verifikation:** App 45/45 + API 33/33 Tests grün, beide Builds sauber, Screenshots der Übersicht
geprüft. Beide deployt (API-Caveat + SPA); HTTPS-Smoke grün, keine Regression (Root + brightsky 200).

**Offen:** responsives Mobil-Layout (Viewport noch `width=1280`); Onboarding-Boden-Auswahl; doppelter
Abruf der ausgewählten Zelle (refresh + refreshFarm) als Nit.

**Verweise:** `app/src/{api/waterBalance,overview/index,overview/cards}.ts`; Review-Workflow `cutover-review`.

## 2026-06-28 · Backend `api/` auf doldenblick-01 deployt + auf Fastify 5 gehärtet
**Was:** Den Wasserbilanz-Dienst produktiv ausgerollt (reproduzierbar via `infra/deploy-api.sh`).
- **Runtime:** Node 22 LTS via NodeSource installiert; Dienst als eigener System-User `doldenblick`
  unter systemd (`doldenblick-api.service`, gehärtet: `ProtectSystem=strict`, `NoNewPrivileges`,
  `RestrictAddressFamilies` …), bindet nur `127.0.0.1:8787`.
- **nginx:** drei exakte `/api/`-Locations (`health`, `version`, `water-balance`) → Loopback-Proxy,
  additiv zum bestehenden `/api/brightsky/`; `nginx -t` + Reload mit Snippet-Backup/Rollback.
- **Security:** `npm audit` zeigte 5 High (transitiv `fast-uri ≤3.1.1`). Erst per `overrides` auf
  `fast-uri ^3.1.2` (4→1), dann **Fastify 4 → 5.8.5** gehoben → **0 Schwachstellen** (prod).
  Reale Exposition der Fastify-Advisories war ~null (kein `sendWebStream`, keine Body-Schema-
  Validierung, `request.protocol/host` ungenutzt), Upgrade dennoch durchgezogen (33/33 Tests grün).

**Warum:** „deploy … end-to-end" — die Compute-Schicht real, same-origin und sicher verfügbar machen,
bereit für den Client-Cutover.

**Verifikation:** Öffentlich über HTTPS bestätigt: `/api/version` (Header `X-API-Version: 1`),
`/api/health`, `/api/water-balance` (Lehm → warn/Dr 76.7; Sand → alert/Ks 0.56/Empf. 68.9 mm).
426-Guard greift öffentlich. **Keine Regression:** SPA-Root + `/api/brightsky/alerts` weiterhin 200.
Server: `fastify 5.8.5`, Service `active (running)`.

**Offen:** Client-Cutover (Overview ruft die Route statt selbst zu rechnen); Monitoring des Dienstes.

**Verweise:** `infra/{deploy-api.sh,doldenblick-api.service,nginx-doldenblick.conf}`; `api/README.md`.

## 2026-06-28 · Backend `api/` — zustandsloser FAO-56-Wasserbilanz-Dienst (Strong Separation)
**Was:** Erste Scheibe der Compute-Schicht als eigenständiger TypeScript-/Fastify-Dienst unter `api/`.
Umsetzung der **Strong-Separation-of-Concerns**-Entscheidung: Client = Präsentation + Tiles; Backend =
Datenabruf (BFF) **und** Rechnung.
- **Domäne** (`api/src/domain/`): `soil`, `kc`, `waterBalance` (FAO-56-Bucket inkl. **Ks**) aus
  `app/src/domain` portiert (Tests mitgezogen); neu: `waterBalanceSeries` (zustandsloser Warm-up:
  Init Feldkapazität am Fensteranfang, historisches Kc je Tag, bis `asOf`).
- **Quelle** (`api/src/sources/openMeteo.ts`): server-seitiger Open-Meteo-Abruf (BFF, globales `fetch`),
  tägliche ET0+Niederschlag über `past_days=60` + `forecast_days=7`.
- **Route** `GET /api/water-balance?lat&lon&soilType|nfkMmPerM&rootDepthM&asOf` → Status/Dr/Ks/
  Empfehlung + Fenster + Provenienz + Caveats. Validierung (400), Quellenfehler → 502.
- **Versionsvertrag** (`api/src/version.ts`): `API_VERSION` (Major) in jeder Antwort (Body
  `apiVersion` + Header `X-API-Version`), `GET /api/version` zum Preflight, Datenrouten weisen
  inkompatible Clients (Header `X-Client-API`/`?clientApi`) mit **426** ab; `/api/health` +
  `/api/version` bleiben offen. *(Auf Nutzerwunsch ergänzt.)*

**Warum:** Datenabruf raus aus dem Browser; eine Single Source of Truth für die Agronomie-Mathematik;
zustandslos → heute ohne DB deploybar. Persistenz/Worker bleiben gegatet (Backend-Spec §13).

**Verifikation:** 33/33 Vitest grün; `tsc` sauber. Live-Smoke gegen echtes Open-Meteo
(Hallertau 48.42,11.78): `dr 76.7 mm`, `status warn`, Fenster 2026-04-29→06-28 (61 Tage),
`asOf` = heute (Berlin). Versions-Header/`/api/version`/426-Guard live bestätigt.

**Offen:** Deploy auf doldenblick-01 (systemd + nginx-`/api/`-Upstream); Client-Cutover (Overview ruft
die Route statt selbst zu rechnen) als Folge-Aufgabe.

**Verweise:** `api/` (`README.md`, `src/{domain,sources,routes,version,app,server}.ts`); Spec
`docs/superpowers/specs/2026-06-28-agronomic-compute-layer-design.md` (Architektur-Update + §8-Notiz).

## 2026-06-28 · Screenshot-Capture + Frutiger-Review als Hook automatisiert
**Was:** Die visuelle Review-Schleife (Screenshots aller Client-Zustände → Frutiger-Rubrik) als
stehenden Prozess verankert.
- **Capture-Skript** `app/scripts/capture-states.mjs` (`npm run screenshots`): puppeteer-core treibt
  System-Chrome (`--enable-unsafe-swiftshader` für Headless-WebGL/maplibre), startet `server.mjs`,
  seedet Demo-Schläge, wartet auf Live-Daten → `docs/screenshots/{onboarding-methods,onboarding-review,overview}.png`.
- **Hook** `.claude/settings.json` (`PostToolUse`→`Bash`, `async`, `timeout 240`): erkennt einen
  vollen Testlauf (`npm test` / `npm run test`) per `jq`+`grep` und ruft dann `npm run screenshots`
  nicht-blockierend auf. Gezielte `vitest run <pfad>` und `npm run build` lösen bewusst **nicht** aus.
  Portabel via `$CLAUDE_PROJECT_DIR`; feuert nur in Claude-Code-Sitzungen, nicht in CI.

**Warum:** „Auf jedem Testlauf / nach neuen Features" sollte der UI-Stand gegen Frutigers Maßstab
(Legibilität, koordiniertes Typo-System, Ruhe) geprüft werden — der Capture-Teil ist nun hands-off,
das visuelle Urteil bleibt bei Claude/Agent.

**Verifikation:** `jq -e` über die Hook-Definition grün; Match-Logik pipe-getestet
(`npm test`/`npm run test` → MATCH; `npx vitest run …`, `npm run build`, `git status` → nomatch).
**Caveat:** Eine **neu angelegte** `.claude/settings.json` aktiviert der Watcher erst nach einmaligem
Öffnen von `/hooks` (oder Neustart) — nur Verzeichnisse mit Settings bei Sitzungsstart werden beobachtet.

**Verweise:** `.claude/settings.json`, `app/scripts/capture-states.mjs`, `docs/screenshots/README.md`.

## 2026-06-28 · App auf doldenblick-01 deployt (https://doldenblick.de live)
**Was:** Den Vite-Build (`app/dist/`) auf den Hetzner-Server ausgerollt und die Platzhalterseite
ersetzt. Reproduzierbar über neues `infra/deploy.sh` + `infra/nginx-doldenblick.conf`.
- **Statisch:** `npm run build` → `rsync --delete app/dist/ → /var/www/html`; Backups unter
  `/root/webroot-backup.*` und `/root/nginx-default.bak.*`; Eigentümer auf `root:root` normalisiert.
- **Proxy:** nginx-Snippet `/etc/nginx/snippets/doldenblick-app.conf` (Reverse-Proxy
  `/api/brightsky/` → `api.brightsky.dev`) per einzeiligem `include` in den 443-Server-Block
  (certbot-verwaltet) eingebunden — ersetzt den Vite-Dev-Proxy. `nginx -t` + Reload mit Rollback.
- **Architektur:** rein statische SPA, kein Backend; Open-Meteo + Karten browser-direkt (CORS),
  nur Bright Sky über den Proxy. Keine Secrets/API-Keys nötig.

**Warum:** „Deploy please" — vom Prototyp auf die echte, öffentlich erreichbare Domain.

**Verifikation:** `https://doldenblick.de` → HTTP 200, Titel „DoldenBlick — Übersicht";
gehashte JS/CSS-Assets 200; `/api/brightsky/alerts` liefert echtes DWD-Alert-JSON (HTTP 200);
80→443-Redirect intakt; Overview im Browser gerendert mit Live-Daten (0 Konsolenfehler),
inkl. amtlicher DWD-Warnung über den neuen Proxy. `infra/deploy.sh` syntaxgeprüft.

**Offen:** Auto-Deploy/CI optional; Monitoring/Alerting steht noch (s. TODO „Infrastruktur").
docs/infrastructure.md + TODO.md nachgezogen.

**Verweise:** `infra/deploy.sh`, `infra/nginx-doldenblick.conf`, `docs/infrastructure.md`.

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
