# DoldenBlick API (Backend: BFF + Compute)

Zustandsloser TypeScript-/Fastify-Dienst. Umsetzung der **Strong Separation of Concerns**
(Spec `docs/superpowers/specs/2026-06-28-agronomic-compute-layer-design.md`, Architektur-Update):
der **Client** macht nur Präsentation + Kartenkacheln; das **Backend** holt alle Datenquellen
(Backend-for-Frontend) **und** rechnet (FAO-56-Wasserbilanz). Der Client ruft ausschließlich
same-origin `/api/*` und rendert — keine Physik, kein Datenabruf im Browser.

Erste Scheibe: **Wasserbilanz** (FAO-56 Wurzelraum-Tipping-Bucket, Allen et al. 1998),
**zustandslos** — kein Postgres. `Dr` wird je Request aus der Feldkapazität am Fensteranfang
über das Open-Meteo-`past_days`-Fenster (60 Tage + Vorhersage) bis „heute" neu hergeleitet.

## Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/health` | Liveness (`{status, service, apiVersion}`) |
| GET | `/api/version` | Versions-Preflight (`{service, apiVersion, minClientVersion}`) |
| GET | `/api/water-balance` | FAO-56-Wasserbilanz je Standort |

### `GET /api/water-balance`
Query: `lat`, `lon` (Pflicht) · `soilType` (eine von `sand, lehmiger sand, lehm, toniger lehm, ton`)
oder `nfkMmPerM` (Override) · `rootDepthM` (Default 1.0) · `asOf` (`YYYY-MM-DD`, Default heute Europe/Berlin).

Antwort (gekürzt):
```json
{
  "apiVersion": 1, "card": "water-balance",
  "status": "warn", "dr": 76.7, "ks": 1, "deficit": 76.7, "recommendMm": 0,
  "taw": 180, "raw": 90,
  "window": { "from": "2026-04-29", "to": "2026-06-28", "days": 61 },
  "soil": { "soilType": "lehm", "nfkMmPerM": 180, "rootDepthM": 1 },
  "asOf": "2026-06-28",
  "provenance": { "et0": "Open-Meteo (FAO-56 ET0)", "precip": "Open-Meteo (Niederschlag)", "soil": "…" },
  "caveats": [ "…250-m-grob…", "…RO=0/I=0…", "…Orientierung, keine Beregnungsanweisung." ]
}
```
Fehler: `400` (lat/lon/Boden ungültig) · `426` (Client-Version inkompatibel) · `502` (Datenquelle/Compute).

## Versionsvertrag (Client ⇄ Backend)
Damit beide Seiten Kompatibilität prüfen können (`api/src/version.ts`):
- **`API_VERSION`** (Major) wird bei BREAKING Vertragsänderungen erhöht; additive Felder **nicht**.
- Jede Antwort trägt `apiVersion` (Body) **und** den Header `X-API-Version`.
- Der Client preflightet via `GET /api/version` oder deklariert seine Major per Header
  `X-Client-API` (bzw. `?clientApi=`). Liegt sie außerhalb `[minClientVersion, apiVersion]`,
  antworten Datenrouten mit **`426 Upgrade Required`**. `/api/health` und `/api/version`
  bleiben immer erreichbar (Preflight). Ohne Angabe wird normal bedient.

## Entwicklung
```
cd api
npm install
npm run dev        # tsx watch (Port 8787, Loopback)
npm test           # vitest (33 Tests)
npm run build      # tsc → dist/
npm start          # node dist/server.js
```
Bindet nur an `127.0.0.1` — nginx terminiert TLS und proxyt `/api/*` same-origin hierher.
Konfiguration über Env: `PORT` (8787), `HOST` (127.0.0.1).
