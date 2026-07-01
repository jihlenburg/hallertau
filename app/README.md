# DoldenBlick — App (Prototyp „Übersicht")

Erster **lauffähiger** Prototyp der Übersicht-Ansicht aus den DoldenBlick-Mockups:
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
npm run preview  # gebauten Build lokal ausliefern (Vite, ohne Bright-Sky-Proxy)
npm run serve    # dist/ ausliefern UND /api/brightsky proxen (server.mjs) — prod-tauglich
npm test         # Vitest (Feuchtkugel, Spritzfenster, Wasserbilanz, Wetter, Raster, Import)
```

## Was funktioniert

- **Passwortloses Betriebs-Onboarding** (`/onboarding`, `/onboarding/verify`): ein
  vierschrittiger Wizard, der einen Betrieb beim `accounts/`-Dienst anlegt. Anmeldung
  **ohne Passwort** — Magic-Link per E-Mail oder Passkey (Fingerabdruck/Gesichts-Scan).
  Der Wizard nutzt den Accounts-Client (`src/api/accounts.ts`) und dieselbe Feld-Import-
  Logik wie unten; Schläge landen serverseitig (Postgres) statt nur im Browser.
- **Schnell-Onboarding im Browser (offline):** „Felder" → Schläge anlegen, ohne Konto
  - **iBALIS-Export hochladen** (empfohlen): Shape-ZIP (`.shp/.dbf/.prj`) wird im
    Browser gelesen (`shpjs` + `proj4`), **UTM32 / EPSG:25832 → WGS84** wird
    anhand der `.prj` automatisch erkannt.
  - **GeoJSON-Upload** (WGS84) und **„Demo-Betrieb laden"**.
  - Anschließend **Review**: Name, Sorte und Fläche prüfen/anpassen; die Fläche
    wird zur Kontrolle aus der Geometrie berechnet (`@turf/area`).
  - Gespeichert wird im `localStorage` des Browsers (kein Backend nötig).
- **Übersicht:** Karte mit allen Schlägen, ein Schlag ist wählbar (Klick auf die
  Fläche oder die Liste). Standort der Abfragen = **Zentroid** des Schlags.
- **Live-Ampelkarten** für den gewählten Schlag:
  - **Wetter & Warnungen** – Open-Meteo-Vorhersage + amtliche DWD-Warnungen via
    Bright Sky (mit Rückfall auf eine aus den Wettercodes abgeleitete Einschätzung,
    klar als solche gekennzeichnet). Der abgeleitete Pfad erkennt **Nachtfrost** aus dem
    Tagestiefstwert; „nicht abrufbar" wird von „keine Warnung" unterschieden. Die Karte
    stellt klar: **kein Echtzeit-Alarm** — für Frost/Hagel/Sturm die DWD-WarnWetterApp.
  - **Spritzfenster** – aus den Stundenwerten abgeleitet (Wind, Niederschlag,
    **ΔT** = Feuchtkugeldepression nach Stull 2011), nächste 48 h. Überschrift framt
    „Wetter geeignet"; bei Schwachwind-Frühfenster Hinweis auf mögliche **Inversionslage**
    (Abdrift). Etikett & Auflagen bleiben Sache des Anwenders.
  - **Bewässerung** – klimatische Wasserbilanz **ETc = ET₀(FAO-56) · Kc(Hopfen) −
    Niederschlag** über 7 Tage, als **Tendenz** ausgewiesen (nicht als Beregnungsmenge).
  - **Peronospora**, **Feld-Check (Satellit)**, **Wachstum** erscheinen als
    **Roadmap-Streifen** unter den Live-Karten (nicht als leere Kacheln im Raster).
- **Tageskopf „N Hinweise für morgen"** aggregiert über alle Schläge (ein Abruf je
  ~2-km-Rasterzelle); ein Hinweis nennt, wenn der gewählte Schlag mit Nachbarn dieselbe
  Modellzelle teilt (regionaler Rasterwert).
- Jede Karte nennt sichtbar ihre **Datenquelle**.

## Technik

- **Vite + TypeScript + maplibre-gl**, kein UI-Framework (Vanilla-TS-Module).
- **Basemap:** OpenFreeMap (keyless Vektor-Tiles, OpenMapTiles-Schema). Als
  Luftbild-Layer fürs Onboarding/Verorten **Bayern DOP40** (offenes WMS).
- **Schriften:** Barlow / Barlow Semi Condensed **self-hosted** via `@fontsource`
  (kein Google-Fonts-CDN — DSGVO-freundlich, offline-fähig).
- **Keine Secrets, keine API-Keys.** Open-Meteo ist CORS-fähig; die DWD-Warnungen
  von Bright Sky laufen über einen Proxy unter `/api/brightsky`, damit CORS keine Rolle
  spielt — im **Dev** via Vite (`vite.config.ts`), in **Prod** via `server.mjs`
  (`npm run serve`), das `dist/` ausliefert UND denselben Proxy bereitstellt.
  Serverlos genügt eine kleine Funktion am selben Pfad, z. B. als Cloudflare Worker:

  ```js
  // /api/brightsky/* → api.brightsky.dev/*
  export default {
    async fetch(req) {
      const url = new URL(req.url)
      const target = 'https://api.brightsky.dev' +
        url.pathname.replace(/^\/api\/brightsky/, '') + url.search
      return fetch(target, { headers: { accept: 'application/json' } })
    },
  }
  ```

## Bewusste Vereinfachungen (ehrlich)

- Die Wasserbilanz ist eine **klimatische** Bilanz, **kein Bodenmodell**
  (ohne Speicherkapazität, Wurzeltiefe, bereits erfolgte Beregnung). Der
  Kc-Wert ist mittsaisonal pauschal `1.05`.
- ΔT und die Spritzfenster-Schwellen sind **Orientierung**, keine
  Pflanzenschutz-Anweisung (Schwellen als Konstanten in `src/domain/sprayWindow.ts`).
- Open-Meteo löst um Au i.d.Hallertau räumlich grob auf (~1–11 km); benachbarte
  Schläge liefern daher sehr ähnliche Wetter-Werte. Die Übersicht **weist das jetzt
  on-screen aus**, wenn der gewählte Schlag mit Nachbarn dieselbe ~2-km-Rasterzelle
  teilt. Die Feldauswahl ist für Verortung und künftige feldspezifische Daten angelegt.
- ΔT/Spritzfenster ist eine **Wetter-Eignung**, keine Pflanzenschutz-Anweisung; bei
  Schwachwind-Frühfenstern wird vor möglicher **Inversionslage** (Abdrift) gewarnt.
- Wetter (abgeleitet) flaggt **Nachtfrost**, ersetzt aber **keinen Echtzeit-Alarm**
  (Karte verweist auf die DWD-WarnWetterApp).
- Die Demo-Geometrien (`data/demo-fields.geojson`) sind fiktiv und ersetzen
  später den iBALIS-/Shape-Import.

## Projektstruktur

```
app/
  index.html            Einstieg
  vite.config.ts        Dev-Proxy für Bright Sky
  server.mjs            Prod-Server: dist/ ausliefern + /api/brightsky proxen (npm run serve)
  data/demo-fields.geojson
  src/
    main.ts             App-Hülle + Routing (Übersicht / Felder / Onboarding-Wizard)
    state.ts            Feld-Store (localStorage) + Auswahl
    map.ts              MapLibre: OpenFreeMap + DOP40 + Felder-Layer
    onboarding/         Import (Shape-ZIP, GeoJSON), Review, Bayern-Plausibilitätscheck,
                        wizard.ts (passwortloser 4-Schritt-Flow) + fieldMap.ts (Karte zeichnen)
    overview/           Übersicht: Greeting, Ampelkarten, Map-Panel, Roadmap-Streifen
    domain/             wetbulb · sprayWindow · waterBalance · weather · grid · fields (+ Tests)
    api/                openMeteo · brightSky · accounts (Magic-Link/Passkey/Onboarding)
    ui/                 icons
```

## Datenquellen & Attribution

Open-Meteo · DWD (über Bright Sky) · LfL Bayern (Agrarmeteorologie &
Peronospora-Warndienst) · Copernicus/Sentinel · Bayerische Vermessungsverwaltung
(DOP40, Open Data) · Kartenbasis OpenFreeMap/OpenMapTiles · Feld-Import aus
iBALIS / InVeKoS. Es gelten die jeweiligen Nutzungsbedingungen der Quellen.
