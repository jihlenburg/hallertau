# HopfenBlick — Referenz (Single Source of Truth)

Kompakte, vollständige Nachschlage-Datei für das Projekt: Design-Tokens,
Architektur, Datenquellen, API-Endpunkte, Domänen-Formeln und Konventionen.
Ergänzt `CLAUDE.md` (Leitplanken) und `app/README.md` (Startanleitung).
Bei Änderungen an Tokens/Logik **hier mitpflegen.**

Inhalt:
1. [Überblick & Status](#1-überblick--status)
2. [Repo-Struktur](#2-repo-struktur)
3. [Design-System (Tokens)](#3-design-system-tokens)
4. [App-Architektur](#4-app-architektur)
5. [Datenquellen & API-Endpunkte](#5-datenquellen--api-endpunkte)
6. [Domänen-Logik & Formeln](#6-domänen-logik--formeln)
7. [Onboarding (Feld-Import)](#7-onboarding-feld-import)
8. [Build / Run / Test](#8-build--run--test)
9. [Inhaltliche Leitplanken & Fachbegriffe](#9-inhaltliche-leitplanken--fachbegriffe)
10. [Beispielbetrieb & Demo-Daten](#10-beispielbetrieb--demo-daten)
11. [Konventionen](#11-konventionen)
12. [Bewusste Vereinfachungen & Grenzen](#12-bewusste-vereinfachungen--grenzen)

---

## 1. Überblick & Status

**HopfenBlick** = Konzept + Prototyp für ein webbasiertes Feld-Dashboard für
Hopfenbetriebe in der Hallertau (Bayern). Leitidee: ein **abendliches Briefing**
(wenige Ampel-Statuskarten mit je einer Empfehlung), keine Karten-Ebenen-Software.

Zwei Teile im Repo:
- **Konzept** (`mockups/`, `report/`, `deliverables/`, `build.sh`): vier pixelgenaue
  HTML-Mockups + deutscher Konzeptbericht (PDF). **Unverändert lassen** (Referenz).
- **App** (`app/`): erster lauffähiger Prototyp der Übersicht-Ansicht inkl. realem
  Onboarding (Feld-Import). Vite + TypeScript + maplibre-gl.

Sprache durchgängig **Deutsch**, sachlich, nicht alarmierend (Wahrscheinlichkeiten
statt Zuspitzung).

---

## 2. Repo-Struktur

```
/
├─ CLAUDE.md                Projekt-Leitplanken (für Claude Code)
├─ REFERENCE.md             diese Datei
├─ LOGBOOK.md               chronologisches Arbeitslog (neueste oben)
├─ TODO.md                  offene Punkte / nächste Schritte
├─ README.md                Projekt-README (Konzeptstand)
├─ LICENSE                  GPL-3.0
├─ build.sh                 rendert Mockups→PNG, Report→PDF (wkhtmltopdf/-image)
├─ scripts/stamp_pages.py   Seitenzahlen ins PDF (PyMuPDF)
├─ mockups/                 m1_overview, m2_mobile, m3_map, m4_onboarding (.html)
├─ report/report.html       Berichtsquelle; Bilder in report/img/
├─ deliverables/            gerenderte PNG/PDF
├─ assets/fonts/            Barlow (von build.sh geladen, nicht eingecheckt)
└─ app/                     ← der Prototyp (siehe §4)
   ├─ index.html  package.json  tsconfig.json  vite.config.ts  README.md
   ├─ data/demo-fields.geojson
   └─ src/
      ├─ main.ts            App-Hülle, Top-Bar, Routing (Übersicht/Felder)
      ├─ state.ts           Feld-Store (localStorage) + Auswahl + pub/sub
      ├─ types.ts           FieldProps/Feature/Collection, Status
      ├─ map.ts             MapLibre: OpenFreeMap + DOP40 + Felder-Layer
      ├─ styles.css         Design-Tokens (CSS-Variablen) + Layout
      ├─ ui/icons.ts        Inline-SVGs (Logo, Spalier, Karten-Chips)
      ├─ api/
      │  ├─ openMeteo.ts    Vorhersage + ET0 (+ lastNDaysIndices)
      │  └─ brightSky.ts    DWD-Warnungen (über Vite-Proxy)
      ├─ domain/
      │  ├─ wetbulb.ts      Feuchtkugel (Stull) + ΔT        (+ .test.ts)
      │  ├─ sprayWindow.ts  Spritzfenster-Ableitung          (+ .test.ts)
      │  ├─ waterBalance.ts ETc = ET0·Kc − Niederschlag      (+ .test.ts)
      │  ├─ weather.ts      Wetterbewertung (DWD/abgeleitet)
      │  ├─ wmo.ts          WMO-Wettercode → Text/Schwere
      │  └─ fields.ts       Zentroid, Fläche (turf), normalizeField
      ├─ onboarding/
      │  ├─ index.ts        Methoden-UI (m4), Dropzone, Review
      │  ├─ importShape.ts  Shape-ZIP → GeoJSON (shpjs+proj4)
      │  └─ importGeojson.ts GeoJSON-Parser
      └─ overview/
         ├─ index.ts        Greeting, Map-Panel, Live-Datenfluss
         └─ cards.ts        Ampelkarten-HTML + Mini-Visualisierungen
```

---

## 3. Design-System (Tokens)

### 3.1 Farben (Quelle: `CLAUDE.md` + `app/src/styles.css`)

| Rolle              | Hex       | CSS-Variable        | Verwendung |
|--------------------|-----------|---------------------|------------|
| Ink (Text)         | `#182a20` | `--ink`             | Haupttext, Überschriften |
| Ink soft           | `#3c5147` | `--ink-soft`        | Fließtext/Empfehlungen |
| Muted              | `#6b7d72` | `--muted`           | Sekundärtext, Eyebrows |
| Faint              | `#93a399` | `--faint`           | Quellenangaben, Achsen |
| Marke grün         | `#2f6b4a` | `--brand`           | Top-Bar, Akzente, Buttons |
| Marke dunkel       | `#234f37` | `--brand-dark`      | Gradient-Start, Logo-Linien |
| Gold               | `#c8902a` | `--gold`            | Highlight, ausgewählte Kante |
| Gold hell          | `#e3b24e` | `--gold-light`      | Avatar, Logo-Dolde, Spalier |
| Blau               | `#2f6fb0` | `--blue`            | Info/Radar/Bewässerung |
| Hintergrund        | `#f4f6f3` | `--bg`              | Seitenhintergrund |
| Fläche             | `#ffffff` | `--surface`         | Karten, Panels |
| Linie              | `#e4e8e3` | `--line`            | Trenner, Rahmen |

### 3.2 Status-Paletten (Ampelprinzip)

| Status   | Basis      | Text-Ink   | Tint (Fläche) | CSS-Klasse | Bedeutung |
|----------|------------|------------|---------------|------------|-----------|
| Gut      | `#2e9e63`  | `#1f7d4c`  | `#e4f3ea`     | `.good`    | alles im grünen Bereich |
| Achtung  | `#d9962a`  | `#a9701a`  | `#f9efd9`     | `.warn`    | beobachten / prüfen |
| Warnung  | `#cf4f3c`  | `#b23e2c`  | `#f9e2dd`     | `.alert`   | Handlungsbedarf |
| Info     | `#2f6fb0`  | `#255d97`  | `#e2edf6`     | `.info`    | neutral / „kommt noch" |

Karten haben eine **farbige linke Kante** (`.card::before`, 8 px) in der Status-Basis,
einen Chip-Hintergrund in der Tint-Farbe und einen Statuspunkt (`.sdot`) in der Basis.

### 3.3 Typografie

- **Display:** `Barlow Semi Condensed` (600/700) — Überschriften, Stat-Werte, Eyebrows.
- **Text:** `Barlow` (400/500/600/700) — Fließtext.
- App: self-hosted via `@fontsource/barlow` und `@fontsource/barlow-semi-condensed`
  (kein CDN; DSGVO-freundlich/offline). Mockups: über fontconfig (von `build.sh` geladen).
- Fallback-Stack: `system-ui, sans-serif`.

### 3.4 Maße & Effekte

- Kartenradius: `--radius: 18px`.
- Schatten: `--shadow: 0 7px 20px rgba(24,42,32,0.09)` (in Mockups zusätzlich `-webkit-`).
- Top-Bar-Gradient: `linear-gradient(90deg, #1c3f2c, #2f6b4a)`.
- Übersicht-Layout (App): `grid-template-columns: 1fr 540px` (Karten | Map-Panel),
  Karten-Grid `1fr 1fr`, Gap 22px.

### 3.5 Signatur-Motive

- **Hopfendolden-Logo** (gold `#e3b24e`, Linien `#234f37`) — siehe `ui/icons.ts` `logo`.
- **„Spalier"-Motiv**: vertikale Goldlinien (Hopfenreihen) in der Top-Bar (`trellis`).
- Karten-Chip-Icons (Wetter, Spritze, Peronospora-Tropfen, Wasser, Satellit, Wachstum).

> ⚠️ **Mockups vs. App:** In `mockups/*.html` gelten harte CSS-Regeln (wkhtmltoimage,
> alte WebKit-Engine): **kein** Flexbox/Grid, **keine** CSS-Variablen/`calc()`/Counter;
> Layout über **absolute Positionierung** in fester px-Größe; `-webkit-`-Präfixe; inline SVG.
> In `app/` ist **modernes CSS erlaubt** (Flexbox/Grid/Variablen).

---

## 4. App-Architektur

- **Stack:** Vite 5 + TypeScript 5 + `maplibre-gl` 4, **kein UI-Framework** (Vanilla-TS).
  Karten/Bilder als inline SVG bzw. MapLibre-Layer. Tests mit Vitest.
- **Routing:** `main.ts` rendert eine App-Hülle (Top-Bar mit Segment-Nav
  „Übersicht"/„Felder") und mountet je nach Route `overview` oder `onboarding`.
  Ohne angelegte Felder wird auf Onboarding umgeleitet.
- **State (`state.ts`):** zentraler Feld-Store mit pub/sub (`subscribe`).
  Persistenz im **localStorage**:
  - `hopfenblick.fields.v1` → `FeatureCollection` der Schläge
  - `hopfenblick.selected.v1` → ID des gewählten Schlags
- **Datenfluss Übersicht:**
  1. `getSelected()` → Schlag → `centroidLonLat()` (turf) = Abfrage-Standort.
  2. `fetchOpenMeteo(lat,lon)` + `fetchDwdAlerts(lat,lon)`.
  3. Ableitungen: `assessWeather`, `evaluateSprayWindow`, `computeWaterBalance`.
  4. `overview/cards.ts` rendert Ampelkarten; jede nennt ihre Quelle.
  5. Feldwechsel (Klick auf Karte/Liste) → `selectField()` → re-fetch (AbortController
     bricht laufende Abfrage ab).
- **Fehler-/Ladezustände:** je Live-Karte „lädt …" bzw. „Nicht abrufbar".
- **Typen (`types.ts`):** `FieldProps { id, name, sorte, flaeche_ha, flaeche_calc_ha? }`,
  `FieldFeature`/`FieldCollection` (GeoJSON Polygon/MultiPolygon),
  `Status = 'good'|'warn'|'alert'|'info'`.

---

## 5. Datenquellen & API-Endpunkte

### 5.1 Open-Meteo (Vorhersage + ET0) — `api/openMeteo.ts`
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- **CORS-fähig**, kein Key, kein Backend nötig.
- Feste Parameter:
  - `latitude`, `longitude` (4 Nachkommastellen), `timezone=Europe/Berlin`
  - `wind_speed_unit=kmh`, `past_days=7`, `forecast_days=7`
  - `current=temperature_2m,weather_code,wind_speed_10m`
  - `hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,`
    `precipitation_probability,wind_speed_10m,wind_gusts_10m,et0_fao_evapotranspiration`
  - `daily=weather_code,temperature_2m_max,temperature_2m_min,`
    `precipitation_probability_max,precipitation_sum,et0_fao_evapotranspiration`
- Modelle bis ~2 km (ICON-D2); Auflösung um Au grob (~1–11 km).

### 5.2 DWD-Warnungen über Bright Sky — `api/brightSky.ts`
- Echtes Ziel: `https://api.brightsky.dev/alerts?lat=..&lon=..`
- Aufruf im Code über **Vite-Dev-Proxy**: `/api/brightsky/alerts?...`
  (Konfig in `vite.config.ts`: rewrite `^/api/brightsky` → `''`, target brightsky).
  → umgeht CORS im Dev; **nur** `npm run dev`. Prod bräuchte echten Proxy.
- Genutzte Felder je Alert: `event_de`, `headline_de`, `description_de`, `severity`
  (`minor|moderate|severe|extreme` → Rang 1–4 via `severityRank`).
- Schlägt der Abruf fehl → `null` → Wetterkarte fällt auf abgeleitete Einschätzung zurück.

### 5.3 Basemap & Luftbild — `map.ts`
- **OpenFreeMap** Vektor-Style (keyless, OpenMapTiles-Schema):
  `https://tiles.openfreemap.org/styles/liberty`
- **Bayern DOP40** Luftbild (Open Data, WMS 1.3.0, keyless):
  Base `https://geoservices.bayern.de/od/wms/dop/v1/dop40`,
  Layer `by_dop40c`, `FORMAT=image/jpeg`, `CRS=EPSG:3857`, Kachel via `{bbox-epsg-3857}`.
  Attribution: „© Bayerische Vermessungsverwaltung". Als umschaltbarer Layer („Luftbild").

### 5.4 Weitere genannte Quellen (Konzept/Platzhalter)
- **LfL Bayern**: Agrarmeteorologie + **Peronospora-Warndienst** (Hüll), ISIP,
  Bewässerungsservice (`wetter-by.de`, `lfl.bayern.de/ipz/hopfen`).
- **Copernicus/Sentinel**: S1 (Radar) & S2 (NDRE) für Vitalitäts-Screening.
- **iBALIS** (`stmelf.bayern.de/ibalis`) / **InVeKoS-Feldstückkarte** (`gdi.bmleh.de`)
  für den Feld-Import. Bayer. Geobasisdaten: `geodaten.bayern.de/opengeodata`.

---

## 6. Domänen-Logik & Formeln

### 6.1 Feuchtkugeltemperatur (Stull 2011) — `domain/wetbulb.ts`
RH wird auf 5–99 % geklemmt. T in °C, RH in %:
```
Tw = T·atan(0.151977·√(RH+8.313659))
   + atan(T+RH) − atan(RH−1.676331)
   + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035
```
**ΔT (Feuchtkugeldepression) = T − Tw.** Referenz: T=20 °C, RH=50 % → Tw ≈ 13,7 °C.
Gültig grob RH 5–99 %, T −20…50 °C, Meereshöhe. **Näherung** — bewusst grob gerundet.

### 6.2 Spritzfenster — `domain/sprayWindow.ts`
Konstante `SPRAY` (dokumentiert, konservativ):
| Schwelle | Wert | Bedeutung |
|---|---|---|
| `WIND_MAX` | 15 km/h | mittlerer Wind |
| `GUST_MAX` | 25 km/h | Böen |
| `PRECIP_PROB_MAX` | 30 % | Niederschlagswahrsch. |
| `DT_MIN`..`DT_MAX` | 2..8 °C | günstiger ΔT-Bereich |
| `HOUR_START`..`HOUR_END` | 5..21 | Tagstunden |
| `MIN_HOURS` | 2 | Mindestfensterlänge |
| `HORIZON_H` | 48 | Vorausschau |
Eine Stunde ist „geeignet", wenn alle Bedingungen erfüllt sind (Tagstunde, Wind/Böen,
`precip ≤ 0.1 mm`, Prob ≤ 30 %, ΔT in 2..8). Erstes zusammenhängendes Fenster ≥ 2 h
wird gewählt. Status: **good** (Fenster ≤ 24 h), **warn** (erst später), **alert** (keins).

### 6.3 Wasserbilanz — `domain/waterBalance.ts`
```
ETc     = Σ ET0(7 Tage) · Kc
Defizit = ETc − Σ Niederschlag(7 Tage)        (positiv = Wasserbedarf)
```
- `KC_HOPS = 1.05` (mittsaisonal, pauschal; keine BBCH-Staffelung).
- Schwellen `WB`: Defizit ≤ 5 → **good**; ≤ 20 → **warn**; > 20 → **alert** (mm/7 T).
- **Klimatische** Bilanz, **kein Bodenmodell** (keine Speicherkapazität/Wurzeltiefe/Beregnung).
- Tagesindizes der letzten 7 Tage: `openMeteo.lastNDaysIndices(daily.time, 7, now)`.

### 6.4 Wetterbewertung — `domain/weather.ts` + `domain/wmo.ts`
- Liegen **DWD-Alerts** vor: stärkster nach `severity` → Rang ≥ 3 ⇒ **alert**, sonst **warn**;
  `warningSource='dwd'`.
- Sonst aus Vorhersage abgeleitet (`warningSource='derived'`): Gewitter-Code ⇒ „Gewitter
  möglich" (warn); schwerer Code oder Prob ≥ 70 % ⇒ „Wechselhaft" (warn); sonst „Ruhiges
  Wetter" (good). UI kennzeichnet die Quelle (amtlich vs. abgeleitet).
- `wmo()` mappt WMO-Codes → deutscher Text + Flags `severe`/`thunder`.

### 6.5 Feld-Helfer — `domain/fields.ts`
- `areaHa(feature)` = turf-Fläche / 10000, auf 2 Nachkommastellen.
- `centroidLonLat(feature)` = turf-Zentroid → `[lon, lat]`.
- `normalizeField(feature, index)` übernimmt Name/Sorte/Fläche aus gängigen
  Attributnamen (z. B. `name/NAME/schlag/FELDSTUECK`, `sorte/kultur/frucht`,
  `flaeche_ha/FLAECHE/ha`), berechnet `flaeche_calc_ha` und vergibt eine ID.

---

## 7. Onboarding (Feld-Import)

Empfohlener Weg laut Report: **iBALIS-Export hochladen** — eigene Feldstücke als
**Shape-ZIP (UTM32)**. Umgesetzte Methoden (`onboarding/`):
- **Shape-ZIP** (`importShape.ts`): `shpjs` liest `.shp/.dbf/.prj` aus dem ZIP und
  reprojiziert via `proj4` anhand der `.prj` nach **WGS84** (erkennt UTM32/EPSG:25832).
  Nur Polygon/MultiPolygon werden übernommen.
- **GeoJSON-Upload** (`importGeojson.ts`): erwartet WGS84; FeatureCollection oder Feature.
- **„Demo-Betrieb laden"**: `data/demo-fields.geojson` (Raw-Import via Vite `?raw`).
- **Review**: Tabelle zum Prüfen/Anpassen von Name/Sorte/Fläche; berechnete Fläche
  („aus Geometrie") als Kontrolle; Karten-Vorschau mit DOP-Luftbild.
- **Übernehmen** → `setFields()` → localStorage → Übersicht.
- „Auf der Karte antippen" (InVeKoS-WFS) und „Manuell zeichnen/GPS" sind als
  **„kommt noch"** markiert (siehe `TODO.md`).

Hinweis: DBF-Encoding (Umlaute, cp1252/.cpg) ist noch nicht robust gehärtet (TODO).

---

## 8. Build / Run / Test

**App** (`cd app`):
```bash
npm install
npm run dev      # Vite-Dev-Server http://localhost:5173 (inkl. Bright-Sky-Proxy)
npm run build    # tsc --noEmit + vite build → dist/
npm run preview  # gebauten Build ausliefern
npm test         # Vitest (9 Tests: wetbulb, sprayWindow, waterBalance)
```
- Keine Secrets/Keys nötig. Bundle groß (~1 MB, maplibre+shpjs) — für Prototyp ok.

**Konzept/Report** (Repo-Root, separater Toolchain):
```bash
./build.sh       # wkhtmltoimage/-pdf: Mockups→PNG, Report→PDF, Seitenzahlen
```
Voraussetzungen: `wkhtmltopdf`, `python3` mit `pymupdf`+`pillow`, `fontconfig`, `curl`.

---

## 9. Inhaltliche Leitplanken & Fachbegriffe

- Sprache **Deutsch**, sachlich, **nicht** alarmierend; Wahrscheinlichkeiten statt Zuspitzung.
- **Schlag** = einheitlich bewirtschaftete Fläche ≠ **Feldstück** (Bewirtschaftungsblock,
  InVeKoS) ≠ **Flurstück** (Eigentumseinheit, ALKIS).
- Felder anlegen: **Agrar-** statt Liegenschaftskataster — iBALIS/Mehrfachantrag bzw.
  offene InVeKoS-Feldstückkarte; **nicht** ALKIS-Vektor (in Bayern kostenpflichtig).
- Satellit = **regionales Screening**, nicht teilflächengenau (10-m-Pixel auf 7-m-Gerüst).
- Datenquellen in der UI offen nennen; ΔT/Spritzfenster sind **Orientierung**, keine
  verbindliche Pflanzenschutz-Anweisung.
- Lizenzen: Open-Meteo/Bright Sky nicht-kommerziell frei; bayer. Geobasisdaten kommerziell
  mit Namensnennung; LfL-Weiterverbreitung ggf. abstimmen. Schrift Barlow = SIL OFL.
  Projektcode = GPL-3.0.

---

## 10. Beispielbetrieb & Demo-Daten

- Fiktiver Betrieb **„Familie Huber"**, Au i.d.Hallertau, **6 Schläge / 18,4 ha**.
- Beispiel-Schlag **„Attenhofen West"** (Sorte **Herkules**, ~3,2 ha).
- `app/data/demo-fields.geojson` (WGS84, lon/lat), Zentrum ~`[11.7847, 48.4283]`:
  | Name | Sorte | ha |
  |---|---|---|
  | Attenhofen West | Herkules | 3,2 |
  | Mitterfeld | Hallertauer Tradition | 2,6 |
  | Sandlinse | Perle | 1,9 |
  | Auer Berg | Herkules | 4,1 |
  | Lange Wiese | Saphir | 2,4 |
  | Kirchfeld | Hallertauer Tradition | 4,2 |
- Sortenliste im Review (`onboarding/index.ts`): Herkules, Perle, Hallertauer Tradition,
  Saphir, Hallertauer Mittelfrüh, Spalter Select, unbekannt.

---

## 11. Konventionen

- **Branch:** Entwicklung auf `claude/repo-initialization-z6styj`; mit
  `git push -u origin <branch>` (bei Netzfehlern Exponential-Backoff). Kein PR ohne
  ausdrückliche Aufforderung.
- **LOGBOOK.md / TODO.md** pflegen (siehe `CLAUDE.md`): nach jedem nennenswerten
  Schritt Logbuch-Eintrag (Datum · Was · Warum · Ergebnis/Commit); TODOs abhaken.
- **Mockups/Report/build.sh** nicht verändern (Referenz). **Keine Secrets** committen.
  Open-Data-Attribution beibehalten.
- Commit-Stil: prägnanter Imperativ-Betreff + erklärender Body (Deutsch).

---

## 12. Bewusste Vereinfachungen & Grenzen

- Wasserbilanz ist **klimatisch**, kein Bodenmodell; Kc fix 1.05.
- ΔT/Spritzfenster: Näherung + konservative Schwellen, keine Beratung.
- Open-Meteo löst um Au grob auf → benachbarte Schläge liefern sehr ähnliche
  Wetterwerte (Feldauswahl v. a. für Verortung & künftige feldspezifische Daten).
- Bright-Sky-Proxy nur im Dev-Server (Prod-Proxy fehlt).
- Bundle nicht code-gesplittet; DBF-Encoding nicht gehärtet; nur Polygone importierbar.
- Demo-Geometrien sind fiktiv (rechteckig) und ersetzen später den echten Import.
- Platzhalter-Karten (Peronospora, Feld-Check/Satellit, Wachstum) noch ohne Live-Daten.
