// Sentinel-Hub-Evalscripts (v3). Zwei native Auflösungen für EHRLICHE Pixelzählung:
//  - 10 m: NDVI, SAVI (B04/B08)
//  - 20 m: NDRE, CIre, NDMI (B05 Red-Edge / B11 SWIR sind nativ 20 m)
// `dataMask` = SCL-Wolkenmaske (gültig: 4 Veg, 5 kahl, 6 Wasser, 7 unklassifiziert).
// Getrennte Requests je Auflösung → valider Pixel-Count entspricht der echten Sensor-Auflösung.

export const EVALSCRIPT_10 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04","B08","SCL","dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "savi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var valid = (s.dataMask === 1 && s.SCL >= 4 && s.SCL <= 7) ? 1 : 0;
  var ndvi = (s.B08 + s.B04) > 0 ? (s.B08 - s.B04) / (s.B08 + s.B04) : 0;
  var savi = ((s.B08 - s.B04) / (s.B08 + s.B04 + 0.5)) * 1.5;
  return { ndvi: [ndvi], savi: [savi], dataMask: [valid] };
}`

export const EVALSCRIPT_20 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B05","B08","B11","SCL","dataMask"] }],
    output: [
      { id: "ndre", bands: 1, sampleType: "FLOAT32" },
      { id: "cire", bands: 1, sampleType: "FLOAT32" },
      { id: "ndmi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var valid = (s.dataMask === 1 && s.SCL >= 4 && s.SCL <= 7) ? 1 : 0;
  var ndre = (s.B08 + s.B05) > 0 ? (s.B08 - s.B05) / (s.B08 + s.B05) : 0;
  var cire = s.B05 > 0 ? (s.B08 / s.B05) - 1 : 0;
  var ndmi = (s.B08 + s.B11) > 0 ? (s.B08 - s.B11) / (s.B08 + s.B11) : 0;
  return { ndre: [ndre], cire: [cire], ndmi: [ndmi], dataMask: [valid] };
}`

/** Index → native Sentinel-2-Auflösung (für Request-Wahl + Konfidenz-Bewertung). */
export const INDEX_RES: Record<string, 10 | 20> = {
  ndvi: 10,
  savi: 10,
  ndre: 20,
  cire: 20,
  ndmi: 20,
}
