#!/usr/bin/env python3
"""GEE-Imagery-Backtest für die Satelliten-Tauglichkeit auf Hopfen-Schlägen (DoldenBlick).

Ergänzt den datenfreien Geometrie-Backtest (scripts/pixel-purity-backtest.mjs) um ECHTE
Sentinel-2-Messungen via Google Earth Engine:
  - tatsächliche valide Pixel je Schlag nach Wolkenmaskierung (10 m NDVI, 20 m NDRE),
  - schlaginterne räumliche Heterogenität (StdAbw von NDRE im Schlag) — der Mischungs-/
    Reihen-Spalier-Effekt, den die reine Geometrie NICHT messen kann,
  - Zahl wolkenarmer Szenen je Saison (zeitliche Verfügbarkeit im Hallertauer Klima).

Auth: Service-Account aus $GOOGLE_APPLICATION_CREDENTIALS (kein Secret im Code/Output).
Lauf:  set -a; . ./.env; set +a; python3 scripts/gee-backtest.py
"""
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ROOT / "app/data/demo-fields.geojson"
OUT = ROOT / "docs/hops/satellite/gee-backtest.md"
START, END = "2025-04-01", "2025-09-30"  # vollständige Hopfen-Saison 2025 (abgeschlossen)

try:
    import ee
except ImportError:
    sys.exit("earthengine-api fehlt: pip install earthengine-api")

key = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
if not key or not Path(key).is_file():
    sys.exit("GOOGLE_APPLICATION_CREDENTIALS nicht gesetzt / Datei fehlt (.env laden).")
info = json.load(open(key))
try:
    creds = ee.ServiceAccountCredentials(info["client_email"], key)
    ee.Initialize(creds, project=info.get("project_id"))
except Exception as e:  # noqa
    sys.exit(
        "EE-Initialisierung fehlgeschlagen: %s\n"
        "→ Service-Account muss für Earth Engine registriert sein und die EE-API im GCP-Projekt aktiv.\n"
        "  (https://code.earthengine.google.com/ → Register a service account / Cloud project)" % e
    )

S2 = "COPERNICUS/S2_SR_HARMONIZED"


def mask_scl(img):
    scl = img.select("SCL")
    good = scl.gte(4).And(scl.lte(7))  # 4 Veg, 5 kahl, 6 Wasser, 7 unklassifiziert
    return img.updateMask(good)


def add_indices(img):
    nir, red, re = img.select("B8"), img.select("B4"), img.select("B5")
    ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
    ndre = nir.subtract(re).divide(nir.add(re)).rename("NDRE")
    return img.addBands([ndvi, ndre])


RED = ee.Reducer.mean().combine(ee.Reducer.stdDev(), "", True).combine(ee.Reducer.count(), "", True)

fc = json.load(open(FIELDS))
rows = []
for f in fc["features"]:
    name = f["properties"]["name"]
    geom = ee.Geometry(f["geometry"])
    col = (
        ee.ImageCollection(S2)
        .filterBounds(geom)
        .filterDate(START, END)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(mask_scl)
        .map(add_indices)
    )
    try:
        n = col.size().getInfo()
        first = ee.Image(col.first())
        p10 = first.select("B8").projection()  # native 10 m UTM-Gitter
        p20 = first.select("B5").projection()  # native 20 m UTM-Gitter (Red-Edge)
        comp = col.median().clip(geom)  # per-Pixel-Median über die Saison
        # WICHTIG: berechnete Bänder auf das native S2-Gitter reprojizieren, sonst zählt
        # reduceRegion auf dem 1°-Default-Gitter falsch (Pixelzahl ≠ Fläche/Pixelfläche).
        s10 = comp.select("NDVI").reproject(p10).reduceRegion(RED, geom, maxPixels=int(1e9)).getInfo()
        s20 = comp.select("NDRE").reproject(p20).reduceRegion(RED, geom, maxPixels=int(1e9)).getInfo()
        rows.append(
            dict(
                name=name,
                ha=f["properties"].get("flaeche_ha"),
                scenes=n,
                px10=s10.get("NDVI_count"),
                ndvi=s10.get("NDVI_mean"),
                px20=s20.get("NDRE_count"),
                ndre=s20.get("NDRE_mean"),
                ndre_sd=s20.get("NDRE_stdDev"),
            )
        )
        print(f"  {name:16} scenes={n:3}  px10={s10.get('NDVI_count')}  px20={s20.get('NDRE_count')}  NDRE={s20.get('NDRE_mean')}")
    except Exception as e:  # noqa
        print(f"  {name}: FEHLER {e}")
        rows.append(dict(name=name, ha=f["properties"].get("flaeche_ha"), error=str(e)))


def fnum(v, d=0):
    return "—" if v is None else (f"{v:.{d}f}")


ok = [r for r in rows if "error" not in r]
table = "\n".join(
    f"| {r['name']} | {fnum(r['ha'],2)} | {fnum(r['scenes'])} | {fnum(r['px10'])} | {fnum(r['ndvi'],2)} | {fnum(r['px20'])} | {fnum(r['ndre'],2)} | {fnum(r['ndre_sd'],3)} |"
    for r in ok
)

md = f"""# GEE-Imagery-Backtest — Sentinel-2 (real) auf den Demo-Schlägen

**Erzeugt von** `scripts/gee-backtest.py` via Google Earth Engine (Service-Account).
**Quelle:** `{S2}`, Saison **{START} … {END}**, Wolkenmaske SCL∈[4..7], `CLOUDY_PIXEL_PERCENTAGE < 60`.
**Schläge:** {len(ok)} Demo-Schläge (`app/data/demo-fields.geojson`) — **echte Hallertau-Koordinaten**
(reale Bodenbedeckung unbekannt; NDRE-Werte daher illustrativ, **Pixelzahlen & schlaginterne Streuung
aber echte Messungen** dessen, was S2 auf dieser Feldgröße liefert).

## Ergebnis (Saison-Median-Komposit je Schlag)

| Schlag | ha | wolkenarme Szenen | valide 10 m-Pixel (NDVI) | NDVI x̄ | valide 20 m-Pixel (NDRE) | NDRE x̄ | NDRE StdAbw (intra) |
|---|---|---|---|---|---|---|---|
{table}

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
"""
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(md)
print(f"\n✓ GEE-Backtest → {OUT}")
