# HopfenBlick — App (Prototyp „Übersicht")

Erster **lauffähiger** Prototyp der Übersicht-Ansicht aus den HopfenBlick-Mockups:
eine MapLibre-Karte mit den eigenen Schlägen, darüber Statuskarten nach dem
Ampelprinzip mit **echten, aus Open-Meteo abgeleiteten** Werten – plus ein
**reales Onboarding** (Feld-Import aus iBALIS / GeoJSON).

> Die statischen Mockups unter `../mockups/` und der Bericht unter `../report/`
> bleiben unverändert als Referenz. Diese App ist ein eigenständiger Schritt
> „vom Mockup zum Prototyp".

## Schnellstart

```bash
cd app
npm install
npm run dev      # startet Vite auf http://localhost:5173
```

Weitere Skripte:

```bash
npm run build    # Typecheck (tsc) + Produktions-Build nach dist/
npm run preview  # gebauten Build lokal ausliefern
npm test         # Vitest (Spritzfenster, Wasserbilanz, Feuchtkugel)
```

## Was funktioniert

- **Onboarding (real):** „Felder" → Schläge anlegen
  - **iBALIS-Export hochladen** (empfohlen): Shape-ZIP (`.shp/.dbf/.prj`) wird im
    Browser gelesen (`shpjs` + `proj4`), **UTM32 / EPSG:25832 → WGS84** wird
    anhand der `.prj` automatisch erkannt.
  - **GeoJSON-Upload** (WGS84) und **„Demo-Betrieb laden"**.
  - Anschließend **Review**: Name, Sorte und Fläche prüfen/anpassen; die Fläche
    wird zur Kontrolle aus der Geometrie berechnet (`@turf/area`).
  - Gespeichert wird im `localStorage` des Browsers (kein Backend).
- **Übersicht:** Karte mit allen Schlägen, ein Schlag ist wählbar (Klick auf die
  Fläche oder die Liste). Standort der Abfragen = **Zentroid** des Schlags.
- **Live-Ampelkarten** für den gewählten Schlag:
  - **Wetter & Warnungen** – Open-Meteo-Vorhersage + amtliche DWD-Warnungen via
    Bright Sky (mit Rückfall auf eine aus den Wettercodes abgeleitete Einschätzung,
    klar als solche gekennzeichnet).
  - **Spritzfenster** – aus den Stundenwerten abgeleitet (Wind, Niederschlag,
    **ΔT** = Feuchtkugeldepression nach Stull 2011), nächste 48 h.
  - **Bewässerung** – klimatische Wasserbilanz **ETc = ET₀(FAO-56) · Kc(Hopfen) −
    Niederschlag** über 7 Tage.
  - **Peronospora**, **Feld-Check (Satellit)**, **Wachstum** sind als Platzhalter
    mit „KOMMT NOCH" gekennzeichnet.
- Jede Karte nennt sichtbar ihre **Datenquelle**.

## Technik

- **Vite + TypeScript + maplibre-gl**, kein UI-Framework (Vanilla-TS-Module).
- **Basemap:** OpenFreeMap (keyless Vektor-Tiles, OpenMapTiles-Schema). Als
  Luftbild-Layer fürs Onboarding/Verorten **Bayern DOP40** (offenes WMS).
- **Schriften:** Barlow / Barlow Semi Condensed **self-hosted** via `@fontsource`
  (kein Google-Fonts-CDN — DSGVO-freundlich, offline-fähig).
- **Keine Secrets, keine API-Keys.** Open-Meteo ist CORS-fähig; die DWD-Warnungen
  von Bright Sky laufen im Dev-Server über einen **Vite-Proxy**
  (`/api/brightsky`, siehe `vite.config.ts`), damit CORS keine Rolle spielt.
  Hinweis: Dieser Proxy gilt nur für `npm run dev`; ein rein statischer
  Prod-Build bräuchte einen eigenen kleinen Proxy für Bright Sky.

## Bewusste Vereinfachungen (ehrlich)

- Die Wasserbilanz ist eine **klimatische** Bilanz, **kein Bodenmodell**
  (ohne Speicherkapazität, Wurzeltiefe, bereits erfolgte Beregnung). Der
  Kc-Wert ist mittsaisonal pauschal `1.05`.
- ΔT und die Spritzfenster-Schwellen sind **Orientierung**, keine
  Pflanzenschutz-Anweisung (Schwellen als Konstanten in `src/domain/sprayWindow.ts`).
- Open-Meteo löst um Au i.d.Hallertau räumlich grob auf (~1–11 km); benachbarte
  Schläge liefern daher sehr ähnliche Wetter-Werte. Die Feldauswahl ist für
  Verortung und künftige feldspezifische Daten (Satellit, Boden) angelegt.
- Die Demo-Geometrien (`data/demo-fields.geojson`) sind fiktiv und ersetzen
  später den iBALIS-/Shape-Import.

## Projektstruktur

```
app/
  index.html            Einstieg
  vite.config.ts        Dev-Proxy für Bright Sky
  data/demo-fields.geojson
  src/
    main.ts             App-Hülle + Routing (Übersicht / Felder)
    state.ts            Feld-Store (localStorage) + Auswahl
    map.ts              MapLibre: OpenFreeMap + DOP40 + Felder-Layer
    onboarding/         Import (Shape-ZIP, GeoJSON), Review
    overview/           Übersicht: Greeting, Ampelkarten, Map-Panel
    domain/             wetbulb · sprayWindow · waterBalance · weather · fields (+ Tests)
    api/                openMeteo · brightSky
    ui/                 icons
```

## Datenquellen & Attribution

Open-Meteo · DWD (über Bright Sky) · LfL Bayern (Agrarmeteorologie &
Peronospora-Warndienst) · Copernicus/Sentinel · Bayerische Vermessungsverwaltung
(DOP40, Open Data) · Kartenbasis OpenFreeMap/OpenMapTiles · Feld-Import aus
iBALIS / InVeKoS. Es gelten die jeweiligen Nutzungsbedingungen der Quellen.
