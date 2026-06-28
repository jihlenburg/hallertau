// Erzeugt Screenshots ALLER Client-Zustände nach docs/screenshots/.
// Treibt das System-Chrome via puppeteer-core (kein Browser-Download, keine App-Änderung).
// Bedient den gebauten Build über server.mjs (statisch + /api/brightsky-Proxy).
//   npm run screenshots
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const APP = resolve(here, '..')
const OUT = resolve(APP, '../docs/screenshots')
const PORT = Number(process.env.SHOT_PORT) || 4178
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = `http://localhost:${PORT}`

// Demo-Schläge in localStorage (für Übersicht/Review). Wird im Browser ausgeführt.
function seedDemoFields() {
  const f = (id, name, sorte, ha, coords) => ({
    type: 'Feature',
    properties: { id, name, sorte, flaeche_ha: ha },
    geometry: { type: 'Polygon', coordinates: [coords] },
  })
  const fc = {
    type: 'FeatureCollection',
    features: [
      f('attenhofen-west-1', 'Attenhofen West', 'Herkules', 3.2, [[11.776, 48.4255],[11.778431, 48.4255],[11.778431, 48.427107],[11.776, 48.427107],[11.776, 48.4255]]),
      f('mitterfeld-2', 'Mitterfeld', 'Hallertauer Tradition', 2.6, [[11.782, 48.4262],[11.78419, 48.4262],[11.78419, 48.427648],[11.782, 48.427648],[11.782, 48.4262]]),
      f('sandlinse-3', 'Sandlinse', 'Perle', 1.9, [[11.7795, 48.4225],[11.781372, 48.4225],[11.781372, 48.423738],[11.7795, 48.423738],[11.7795, 48.4225]]),
      f('auer-berg-4', 'Auer Berg', 'Herkules', 4.1, [[11.787, 48.424],[11.789751, 48.424],[11.789751, 48.425819],[11.787, 48.425819],[11.787, 48.424]]),
      f('lange-wiese-5', 'Lange Wiese', 'Saphir', 2.4, [[11.79, 48.4288],[11.792105, 48.4288],[11.792105, 48.430192],[11.79, 48.430192],[11.79, 48.4288]]),
      f('kirchfeld-6', 'Kirchfeld', 'Hallertauer Tradition', 4.2, [[11.7835, 48.4305],[11.786284, 48.4305],[11.786284, 48.432341],[11.7835, 48.432341],[11.7835, 48.4305]]),
    ],
  }
  localStorage.setItem('doldenblick.fields.v1', JSON.stringify(fc))
  localStorage.setItem('doldenblick.selected.v1', 'attenhofen-west-1')
}

async function main() {
  if (!existsSync(resolve(APP, 'dist/index.html'))) {
    console.error('dist/ fehlt — bitte zuerst `npm run build`.')
    process.exit(2)
  }
  if (!existsSync(CHROME)) {
    console.error(`Chrome nicht gefunden: ${CHROME} (CHROME_PATH setzen).`)
    process.exit(2)
  }
  mkdirSync(OUT, { recursive: true })
  const server = spawn('node', ['server.mjs'], { cwd: APP, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
  await sleep(1200)

  // --enable-unsafe-swiftshader: WebGL im Headless für maplibre-gl (sonst leere Karte).
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })

    // 1) Onboarding — Methodenauswahl (leerer localStorage)
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.clear())
    await page.goto(BASE, { waitUntil: 'networkidle2' })
    await page.screenshot({ path: `${OUT}/onboarding-methods.png`, fullPage: true })

    // 2) Onboarding — Review (Demo-Betrieb laden)
    await page.click('#demo').catch(() => {})
    await sleep(700)
    await page.screenshot({ path: `${OUT}/onboarding-review.png`, fullPage: true })

    // 3) Übersicht (Demo-Felder seeden + reload, auf Live-Daten warten)
    await page.evaluate(seedDemoFields)
    await page.goto(BASE, { waitUntil: 'networkidle2' })
    // Auf befüllte Karten warten: Quelle sichtbar UND Lade-Hinweis verschwunden.
    await page
      .waitForFunction(
        () => {
          const t = document.body.innerText
          return t.includes('Quelle:') && !t.includes('Daten werden geladen')
        },
        { timeout: 30000 },
      )
      .catch(() => {})
    await sleep(2000) // Kartenkacheln + Render setteln lassen
    await page.screenshot({ path: `${OUT}/overview.png`, fullPage: true })

    console.log(`✓ Screenshots → ${OUT} (onboarding-methods, onboarding-review, overview)`)
  } finally {
    await browser.close().catch(() => {})
    server.kill()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
