# GEE-Imagery-Backtest — Sentinel-2 (real) auf den Demo-Schlägen

**Erzeugt von** `scripts/gee-backtest.py` via Google Earth Engine (Service-Account).
**Quelle:** `COPERNICUS/S2_SR_HARMONIZED`, Saison **2025-04-01 … 2025-09-30**, Wolkenmaske SCL∈[4..7], `CLOUDY_PIXEL_PERCENTAGE < 60`.
**Schläge:** 6 Demo-Schläge (`app/data/demo-fields.geojson`) — **echte Hallertau-Koordinaten**
(reale Bodenbedeckung unbekannt; NDRE-Werte daher illustrativ, **Pixelzahlen & schlaginterne Streuung
aber echte Messungen** dessen, was S2 auf dieser Feldgröße liefert).

## Ergebnis (Saison-Median-Komposit je Schlag)

| Schlag | ha | wolkenarme Szenen | valide 10 m-Pixel (NDVI) | NDVI x̄ | valide 20 m-Pixel (NDRE) | NDRE x̄ | NDRE StdAbw (intra) |
|---|---|---|---|---|---|---|---|
| Attenhofen West | 3.20 | 88 | 355 | 0.51 | 96 | 0.31 | 0.107 |
| Mitterfeld | 2.60 | 88 | 295 | 0.69 | 84 | 0.45 | 0.113 |
| Sandlinse | 1.90 | 88 | 225 | 0.56 | 64 | 0.35 | 0.128 |
| Auer Berg | 4.10 | 88 | 448 | 0.80 | 125 | 0.53 | 0.046 |
| Lange Wiese | 2.40 | 88 | 274 | 0.39 | 72 | 0.25 | 0.134 |
| Kirchfeld | 4.20 | 88 | 463 | 0.57 | 125 | 0.36 | 0.089 |

## Lesart & Befund
- **Valide Pixel (real, wolkenmaskiert)** bestätigen den Geometrie-Backtest: 10 m liefert je Schlag
  zig–hunderte Pixel (Feld-Aggregat tragfähig), **20 m NDRE nur einige Dutzend** → Feldmittel als
  Screening, nicht teilflächengenau.
- **NDRE-StdAbw (intra)** misst die **schlaginterne räumliche Streuung** — der von der reinen Geometrie
  NICHT erfassbare Misch-/Reihen-Spalier-Effekt. Eine hohe Streuung über einen vermeintlich einheitlichen
  Schlag zeigt: selbst „reine" Pixel mischen Laubwand/Boden/Schatten → das Feldmittel ist eine grobe
  Zusammenfassung, kein homogenes Pflanzensignal.
- **Wolkenarme Szenen/Saison** zeigen die zeitliche Verfügbarkeit im (oft bewölkten) Hallertauer Sommer
  → begründet die spätere S1-SAR-/HLS-Lückenfüllung.

## Grenzen
- Demo-Polygone liegen an realen Koordinaten, sind aber **fiktiv** (Bodenbedeckung evtl. kein Hopfen) →
  NDRE-Absolutwerte nicht agronomisch interpretieren; Aussagekraft = **Auflösung/Pixelzahl/Streuung**.
- Median-Komposit glättet die Zeitachse; eine echte Phänologie-Zeitreihe + NDRE↔Vigor/Ertrag gegen
  Bodenwahrheit ist der nächste Schritt (braucht reale Hopfen-Schläge + Ertragsdaten).
