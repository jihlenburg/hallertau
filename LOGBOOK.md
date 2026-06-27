# Logbuch — HopfenBlick

Chronologische Notizen zu Entscheidungen und Arbeitsschritten. Neueste Einträge oben.
Format je Eintrag: Datum · Was · Warum · Ergebnis/Verweis.

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
