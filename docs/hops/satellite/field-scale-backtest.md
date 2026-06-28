# Field-scale Pixel-Purity-Backtest — Sentinel-2 auf Hopfen-Schlägen

**Erzeugt von** `scripts/pixel-purity-backtest.mjs` (datenfrei, reproduzierbar via `node scripts/pixel-purity-backtest.mjs`).
**Datengrundlage:** die 6 Demo-Schläge (`app/data/demo-fields.geojson`, fiktiver Betrieb „Familie Huber",
Au i.d.Hallertau; realistische Größen 1.9–4.2 ha).

## Frage
Wie viele **kanten-reine** Sentinel-2-Pixel liegen tatsächlich in einem 0,5–2 ha Hopfen-Schlag — bei **10 m**
(NDVI/sichtbar+NIR) und **20 m** (NDRE/Red-Edge)? Das entscheidet, ob Satellit **feldscharf** oder nur
**regionales Screening** liefern kann.

## Methode
- Lokale metrische Projektion je Schlag (äquirektangulär um den Schwerpunkt; < 0,1 % Fehler auf ~200 m).
- Raster in Auflösungsschritten (10/20 m). **Rein** = alle vier Pixelecken im Schlag (keine Kantenmischung);
  **belegt** = Pixelmitte im Schlag.
- **Phasen-gemittelt** über ein 3×3-Gitter von Offsets (entfernt die willkürliche Gitterphase).

## Ergebnis (phasen-gemittelte reine Pixel je Schlag)

| Schlag | Fläche (ha) | reine 10 m-Pixel | rein-Fläche 10 m | reine 20 m-Pixel | rein-Fläche 20 m |
|---|---|---|---|---|---|
| Attenhofen West | 3.21 | 278 | 1 % | 64 | 1 % |
| Mitterfeld | 2.60 | 235 | 1 % | 54 | 1 % |
| Sandlinse | 1.90 | 160 | 1 % | 36 | 1 % |
| Auer Berg | 4.11 | 374 | 1 % | 87 | 1 % |
| Lange Wiese | 2.41 | 215 | 1 % | 44 | 1 % |
| Kirchfeld | 4.21 | 374 | 1 % | 87 | 1 % |

**Lesart:** „reine 20 m-Pixel" ist die Stichprobengröße, aus der ein **NDRE-Feldmittel** gebildet würde.
10 m-Pixel = 0,01 ha, 20 m-Pixel = 0,04 ha je Pixel.

## Befund
- **10 m (NDVI, sichtbar+NIR):** 160–374 reine Pixel je Schlag →
  ein **Feld-Aggregat (Mittel/Median) ist tragfähig**, und ein **grobes Teilflächen-Bild** ist möglich
  (10 m ≈ 0,01 ha/Pixel). Für die Hopfen-Reihenstruktur (Spalier) bleibt es dennoch eine Mischung aus
  Laubwand + Boden + Schatten (siehe Grenzen).
- **20 m (NDRE/Red-Edge):** nur **36–87 reine Pixel je Schlag** → ein NDRE-**Feldmittel**
  ist machbar, aber **stichprobenarm**; **teilflächengenaue** NDRE-Karten sind aus 20 m **nicht** seriös.
  Genau deshalb gilt: NDRE/Red-Edge aus Sentinel-2 = **regionales/Feld-Screening, nicht feldscharf**.
- Mittlere Schlaggröße hier: 3.1 ha. Bei realen, **kleineren und unregelmäßigen** Schlägen
  (0,5–1 ha, gekrümmte Ränder) sinkt die reine-Pixel-Zahl deutlich weiter (Rechtecke sind ein Best Case).

## Grenzen (Ehrlichkeit)
1. **Nur Kanten-Reinheit** — das ist eine **OBERE SCHRANKE**. Die **schlaginterne Mischung** der vertikalen
   Spalier-Laubwand (Reihen, Gassen, Boden, Schatten, Blickwinkel/BRDF) ist hier **nicht** erfasst und
   verschlechtert die effektive Reinheit zusätzlich. Das lässt sich nur an **echten Szenen** quantifizieren.
2. **Demo-Geometrie** = achsenparallele Rechtecke → optimistisch.
3. **Gitterphase** ist gemittelt, nicht an die echte S2-UTM-Kachel gebunden (±1 Pixel je Dimension).

## Konsequenz für DoldenBlick (Satelliten-„Feld-Check")
- **10 m-Indizes → Feld-Vigor-Aggregat + grobe Teilflächen-Tendenz** sind vertretbar (mit Raster-/Konfidenz-Hinweis).
- **20 m-NDRE → nur Feldmittel als Screening**; teilflächengenaue Aussagen brauchen **Fusion** (PlanetScope ~3 m,
  UAV) oder Super-Resolution.
- **Nächster Schritt (braucht Bilddaten):** echter NDRE-Zeitreihen-Backtest gegen Bodenwahrheit über eine Saison
  (CDSE/Sentinel Hub oder GEE/openEO) — misst die *schlaginterne* Mischung und die NDRE↔Vigor/Ertrag-Korrelation.
