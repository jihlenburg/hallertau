// Field-scale pixel-purity backtest für die Satelliten-Tauglichkeit (DoldenBlick).
//
// Frage: Wie viele KANTEN-REINE Sentinel-2-Pixel liegen tatsächlich in einem 0,5–2 ha
// Hopfen-Schlag — bei 10 m (NDVI/sichtbar) und 20 m (NDRE/Red-Edge)? Das ist die
// trag­ende Auflösungsfrage hinter „regionales Screening vs. feldscharf".
//
// Methode (bewusst datenfrei — keine Bildszene, keine Zugangsdaten nötig):
//   - lokale metrische Projektion je Schlag (Äquirektangulär um den Schwerpunkt;
//     <0,1 % Fehler auf ~200 m → für Pixelzählung mehr als ausreichend),
//   - Raster in Schritten der Auflösung (10/20 m); ein Pixel gilt als REIN, wenn ALLE
//     vier Ecken im Schlag liegen (keine Kantenmischung); „belegt" = Zellmitte im Schlag,
//   - phasen-gemittelt über 3×3 Gitter-Offsets (entfernt die willkürliche Gitterphase).
//
// Grenzen (Ehrlichkeit): zählt nur KANTEN-Reinheit → OBERE SCHRANKE der nutzbaren Pixel.
// Die schlaginterne Misch­ung (Reihen/Spalier/Schatten der vertikalen Laubwand) ist NICHT
// erfasst und verschlechtert die effektive Reinheit zusätzlich — das braucht echte Bilddaten
// (nächster Schritt). Die Demo-Schläge sind achsenparallele Rechtecke → optimistisch; reale,
// unregelmäßige Schläge liefern weniger reine Pixel.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const FIELDS = resolve(here, '../app/data/demo-fields.geojson')
const OUT_DIR = resolve(here, '../docs/hops/satellite')
const OUT = resolve(OUT_DIR, 'field-scale-backtest.md')
const RESOS = [10, 20] // Sentinel-2: 10 m (B2/3/4/8), 20 m (Red-Edge B5/6/7, B8A, SWIR)
const PHASES = [0, 1 / 3, 2 / 3]

const toMeters = (ring, lat0, lon0) => {
  const mLat = 111132.0
  const mLon = 111320.0 * Math.cos((lat0 * Math.PI) / 180)
  return ring.map(([lon, lat]) => [(lon - lon0) * mLon, (lat - lat0) * mLat])
}
const stripClose = (ring) => {
  const a = ring[0]
  const b = ring[ring.length - 1]
  return a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring
}
const centroid = (ring) => {
  const r = stripClose(ring)
  let x = 0
  let y = 0
  for (const [lon, lat] of r) {
    x += lon
    y += lat
  }
  return [x / r.length, y / r.length] // [lon0, lat0]
}
const shoelace = (poly) => {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]
  }
  return Math.abs(a / 2) // m²
}
const pointInPoly = (x, y, poly) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const bbox = (poly) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of poly) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

function countOnePhase(poly, res, ox, oy, bb) {
  let pure = 0
  let covered = 0
  const startX = Math.floor((bb.minX - ox) / res) * res + ox
  const startY = Math.floor((bb.minY - oy) / res) * res + oy
  for (let x = startX; x <= bb.maxX; x += res) {
    for (let y = startY; y <= bb.maxY; y += res) {
      if (pointInPoly(x + res / 2, y + res / 2, poly)) covered++
      if (
        pointInPoly(x, y, poly) &&
        pointInPoly(x + res, y, poly) &&
        pointInPoly(x + res, y + res, poly) &&
        pointInPoly(x, y + res, poly)
      )
        pure++
    }
  }
  return { pure, covered }
}

function analyze(poly, res) {
  const bb = bbox(poly)
  let pSum = 0
  let cSum = 0
  let n = 0
  for (const fx of PHASES)
    for (const fy of PHASES) {
      const { pure, covered } = countOnePhase(poly, res, fx * res, fy * res, bb)
      pSum += pure
      cSum += covered
      n++
    }
  return { pure: pSum / n, covered: cSum / n }
}

const fc = JSON.parse(readFileSync(FIELDS, 'utf8'))
const rows = []
for (const f of fc.features) {
  const ring = f.geometry.coordinates[0]
  const [lon0, lat0] = centroid(ring)
  const poly = stripClose(toMeters(ring, lat0, lon0))
  const areaM2 = shoelace(poly)
  const areaHa = areaM2 / 10000
  const r10 = analyze(poly, 10)
  const r20 = analyze(poly, 20)
  rows.push({
    name: f.properties.name,
    reportedHa: f.properties.flaeche_ha,
    areaHa,
    p10: r10.pure,
    pct10: (r10.pure * 100) / areaM2,
    p20: r20.pure,
    pct20: (r20.pure * 400) / areaM2,
  })
}

const fmt = (n, d = 0) => n.toFixed(d)
const meanArea = rows.reduce((s, r) => s + r.areaHa, 0) / rows.length
const minP20 = Math.min(...rows.map((r) => r.p20))
const maxP20 = Math.max(...rows.map((r) => r.p20))
const minP10 = Math.min(...rows.map((r) => r.p10))

const table = rows
  .map(
    (r) =>
      `| ${r.name} | ${fmt(r.areaHa, 2)} | ${fmt(r.p10)} | ${fmt(r.pct10)} % | ${fmt(r.p20)} | ${fmt(r.pct20)} % |`,
  )
  .join('\n')

const md = `# Field-scale Pixel-Purity-Backtest — Sentinel-2 auf Hopfen-Schlägen

**Erzeugt von** \`scripts/pixel-purity-backtest.mjs\` (datenfrei, reproduzierbar via \`node scripts/pixel-purity-backtest.mjs\`).
**Datengrundlage:** die ${rows.length} Demo-Schläge (\`app/data/demo-fields.geojson\`, fiktiver Betrieb „Familie Huber",
Au i.d.Hallertau; realistische Größen ${fmt(Math.min(...rows.map((r) => r.areaHa)), 1)}–${fmt(Math.max(...rows.map((r) => r.areaHa)), 1)} ha).

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
${table}

**Lesart:** „reine 20 m-Pixel" ist die Stichprobengröße, aus der ein **NDRE-Feldmittel** gebildet würde.
10 m-Pixel = 0,01 ha, 20 m-Pixel = 0,04 ha je Pixel.

## Befund
- **10 m (NDVI, sichtbar+NIR):** ${fmt(minP10)}–${fmt(Math.max(...rows.map((r) => r.p10)))} reine Pixel je Schlag →
  ein **Feld-Aggregat (Mittel/Median) ist tragfähig**, und ein **grobes Teilflächen-Bild** ist möglich
  (10 m ≈ 0,01 ha/Pixel). Für die Hopfen-Reihenstruktur (Spalier) bleibt es dennoch eine Mischung aus
  Laubwand + Boden + Schatten (siehe Grenzen).
- **20 m (NDRE/Red-Edge):** nur **${fmt(minP20)}–${fmt(maxP20)} reine Pixel je Schlag** → ein NDRE-**Feldmittel**
  ist machbar, aber **stichprobenarm**; **teilflächengenaue** NDRE-Karten sind aus 20 m **nicht** seriös.
  Genau deshalb gilt: NDRE/Red-Edge aus Sentinel-2 = **regionales/Feld-Screening, nicht feldscharf**.
- Mittlere Schlaggröße hier: ${fmt(meanArea, 1)} ha. Bei realen, **kleineren und unregelmäßigen** Schlägen
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
`

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, md)
console.log(`✓ Backtest → ${OUT}`)
console.log('\nKurzfassung (reine Pixel je Schlag, phasen-gemittelt):')
for (const r of rows) console.log(`  ${r.name.padEnd(16)} ${fmt(r.areaHa, 2)} ha · 10m ${fmt(r.p10).padStart(4)} · 20m ${fmt(r.p20).padStart(3)}`)
