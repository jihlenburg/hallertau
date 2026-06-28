# Water Balance v2 (FAO-56 Tipping Bucket, client-side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace DoldenBlick's storage-less climatic irrigation index with a real FAO-56 root-zone soil-water-balance ("tipping bucket") that carries soil moisture day-to-day and yields an actionable "irrigate X mm / wait" signal — all client-side.

**Architecture:** New pure domain modules `soil.ts` (soil-type → nFK → TAW) and `kc.ts` (FAO-56 hop Kc curve by calendar stage), and a rewritten `waterBalance.ts` exposing `computeSoilWaterBalance(...)` with the FAO-56 daily recurrence incl. the **Ks** water-stress reduction. Per-field soil + depletion state persists in `FieldProps` (localStorage v1). The overview warms the bucket up over Open-Meteo `past_days=60` and renders status + deficit + recommended mm. The shared-package extraction (spec Step 1) and any server worker are **deferred/gated**.

**Tech Stack:** Vite 5 + TypeScript 5 (strict), Vitest 2, maplibre-gl, @turf/* — existing `app/` workspace. No new runtime deps.

## Global Constraints

- All new domain logic lives in `app/src/domain/` as **pure functions** (no DOM/network/storage; injectable `now`) — TDD with Vitest. Copied verbatim from spec §4.
- Canonical parameters (spec/`docs/hops/README.md`, SSoT): Kc ini **0.30** / mid **1.05** / end **0.85**; effective root depth Zr default **1.0 m** (range 1.0–1.2); depletion fraction **p = 0.5** → RAW = p·TAW; nFK loam **~180 mm/m**; GDD base ~5 °C (cap ~30) — not needed in this plan.
- Units: **nFK in mm/m, Zr in m, everything else in mm.** `TAW = nFK[mm/m] · Zr[m]`.
- FAO-56 (Allen et al. 1998): when `Dr > RAW`, `ETc_adj = Ks·Kc·ET0` with `Ks = (TAW−Dr)/(TAW−RAW)`. v1 assumes `RO = 0` and `I = 0` (rain counted fully effective; irrigation not logged).
- Language: German UI copy; code identifiers English; commit messages German + the repo's `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- Run tests from `app/`: `npx vitest run <path>`. Build gate: `cd app && npm run build` (tsc --noEmit + vite build). Deploy: `./infra/deploy.sh`.
- **Out of scope (gated/later):** shared `packages/domain` extraction; server worker/ingest; RADOLAN/Sentinel/LfL; NDVI-Kc; GDD-driven stages; `p_adj`.

---

### Task 1: Soil model — `domain/soil.ts`

**Files:**
- Create: `app/src/domain/soil.ts`
- Test: `app/src/domain/soil.test.ts`

**Interfaces:**
- Produces: `SOIL_TYPES` (readonly list), `type SoilType`, `nfkForSoilType(t: SoilType): number` (mm/m), `taw(nfkMmPerM: number, rootDepthM: number): number` (mm), `DEFAULT_SOIL: SoilType = 'lehm'`, `DEFAULT_ROOT_DEPTH_M = 1.0`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { nfkForSoilType, taw, DEFAULT_SOIL, DEFAULT_ROOT_DEPTH_M, SOIL_TYPES } from './soil'

describe('soil', () => {
  it('liefert nFK je Bodenart (mm/m), Lehm ~180', () => {
    expect(nfkForSoilType('lehm')).toBe(180)
    expect(nfkForSoilType('sand')).toBeLessThan(nfkForSoilType('lehm'))
    expect(nfkForSoilType('lehmiger sand')).toBeGreaterThan(nfkForSoilType('sand'))
  })
  it('TAW = nFK[mm/m] · Zr[m] in mm', () => {
    expect(taw(180, 1.0)).toBe(180)
    expect(taw(180, 1.2)).toBeCloseTo(216, 5)
  })
  it('Defaults: Lehm, 1.0 m; alle Bodenarten haben nFK', () => {
    expect(DEFAULT_SOIL).toBe('lehm')
    expect(DEFAULT_ROOT_DEPTH_M).toBe(1.0)
    for (const t of SOIL_TYPES) expect(nfkForSoilType(t)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/domain/soil.test.ts`
Expected: FAIL — module `./soil` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/domain/soil.ts
// Bodenart → nutzbare Feldkapazität (nFK) in mm Wasser je m Boden.
// Richtwerte (KA5/FAO-56-Größenordnung); bewusst grob, da v1-Auswahl/Override.
export const SOIL_TYPES = ['sand', 'lehmiger sand', 'lehm', 'toniger lehm', 'ton'] as const
export type SoilType = (typeof SOIL_TYPES)[number]

const NFK_MM_PER_M: Record<SoilType, number> = {
  sand: 90,
  'lehmiger sand': 140,
  lehm: 180,
  'toniger lehm': 200,
  ton: 160, // hohe Gesamt-, aber geringere nutzbare Kapazität als toniger Lehm
}

export const DEFAULT_SOIL: SoilType = 'lehm'
export const DEFAULT_ROOT_DEPTH_M = 1.0

export function nfkForSoilType(t: SoilType): number {
  return NFK_MM_PER_M[t]
}

/** Total Available Water im Wurzelraum (mm) = nFK[mm/m] · Zr[m]. */
export function taw(nfkMmPerM: number, rootDepthM: number): number {
  return nfkMmPerM * rootDepthM
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/domain/soil.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/soil.ts app/src/domain/soil.test.ts
git commit -m "feat(domain): Bodenmodell soil.ts (nFK je Bodenart, TAW)"
```

---

### Task 2: Hop Kc curve — `domain/kc.ts`

**Files:**
- Create: `app/src/domain/kc.ts`
- Test: `app/src/domain/kc.test.ts`

**Interfaces:**
- Produces: `KC = { INI: 0.3, MID: 1.05, END: 0.85 }`, `kcForDate(d: Date): number` — FAO-56 hop Kc by Hallertau calendar stage (initial → linear development → mid → linear late → post-harvest), linearly interpolated.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { kcForDate, KC } from './kc'

const d = (m: number, day: number) => new Date(2026, m - 1, day)

describe('kcForDate (Hallertau-Kalenderphänologie)', () => {
  it('Anker: Initial 0.30, Hochsommer 1.05, Spät 0.85', () => {
    expect(kcForDate(d(4, 15))).toBeCloseTo(KC.INI, 2) // Initialphase
    expect(kcForDate(d(7, 20))).toBeCloseTo(KC.MID, 2) // Hauptwachstum
    expect(kcForDate(d(9, 25))).toBeCloseTo(KC.END, 2) // Spät/Ernte
  })
  it('interpoliert in der Entwicklungsphase zwischen INI und MID', () => {
    const k = kcForDate(d(6, 7)) // Mitte Entwicklung
    expect(k).toBeGreaterThan(KC.INI)
    expect(k).toBeLessThan(KC.MID)
  })
  it('Winter/vegetationslos ~ Initialwert (kein Vollbedarf)', () => {
    expect(kcForDate(d(1, 15))).toBeLessThanOrEqual(KC.INI + 0.001)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/domain/kc.test.ts`
Expected: FAIL — module `./kc` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/domain/kc.ts
// FAO-56-Kc-Kurve für Hopfen, v1 KALENDERbasiert (Hallertau). Später GTS/NDVI-gestützt.
export const KC = { INI: 0.3, MID: 1.05, END: 0.85 } as const

// Phasengrenzen als Tag-im-Jahr (DOY). Hallertau: Austrieb ~April, Gerüst Ende Juni,
// Hauptwachstum Juli–Aug, Ernte Ende Aug–Sep.
const doy = (d: Date) => {
  const start = Date.UTC(d.getFullYear(), 0, 0)
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))

export function kcForDate(d: Date): number {
  const n = doy(d)
  const EMERGE = doy(new Date(d.getFullYear(), 3, 1)) // 1. Apr
  const DEV_END = doy(new Date(d.getFullYear(), 6, 1)) // 1. Jul (Voll-Laubwand)
  const MID_END = doy(new Date(d.getFullYear(), 7, 25)) // 25. Aug
  const HARVEST = doy(new Date(d.getFullYear(), 8, 20)) // 20. Sep
  if (n < EMERGE || n > HARVEST) return KC.INI
  if (n <= DEV_END) return lerp(KC.INI, KC.MID, (n - EMERGE) / (DEV_END - EMERGE))
  if (n <= MID_END) return KC.MID
  return lerp(KC.MID, KC.END, (n - MID_END) / (HARVEST - MID_END))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/domain/kc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/kc.ts app/src/domain/kc.test.ts
git commit -m "feat(domain): Hopfen-Kc-Kurve kc.ts (FAO-56, Kalenderphänologie)"
```

---

### Task 3: Water balance v2 — rewrite `domain/waterBalance.ts`

**Files:**
- Modify (rewrite): `app/src/domain/waterBalance.ts`
- Modify (replace tests): `app/src/domain/waterBalance.test.ts`

**Interfaces:**
- Consumes: `Status` from `../types`.
- Produces: `interface SoilWaterBalance { dr; ks; deficit; status; recommendMm; taw; raw }`; `computeSoilWaterBalance(et0: number[], precip: number[], kc: number[], soil: { taw: number; raw: number }, init?: { dr0: number }): SoilWaterBalance`; constants `WB_P = 0.5`. (Removes the old `computeWaterBalance`/`KC_HOPS`/`WB` exports.)

- [ ] **Step 1: Write the failing test (replace file contents)**

```ts
import { describe, it, expect } from 'vitest'
import { computeSoilWaterBalance } from './waterBalance'

const arr = (v: number, n: number) => Array.from({ length: n }, () => v)
const SOIL = { taw: 180, raw: 90 } // Lehm, Zr 1.0 m, p 0.5

describe('computeSoilWaterBalance (FAO-56 Tipping-Bucket)', () => {
  it('Carry-over: 40 mm Regen Tag 0 hält den Eimer 8 Tage trocken danach voll genug (good)', () => {
    const et0 = arr(4, 9), precip = [40, 0, 0, 0, 0, 0, 0, 0, 0], kc = arr(1, 9)
    const r = computeSoilWaterBalance(et0, precip, kc, SOIL, { dr0: 0 })
    // Tag0: dr=clamp(0+4-40)=0 (Überlauf=Perkolation); danach +4/Tag → ~32 mm < raw
    expect(r.dr).toBeCloseTo(32, 0)
    expect(r.status).toBe('good')
  })
  it('Ks bremst die Verarmung, sobald Dr > RAW', () => {
    // dr0=90 (=raw); et0=10, kc=1, kein Regen, 2 Tage
    const r = computeSoilWaterBalance(arr(10, 2), arr(0, 2), arr(1, 2), SOIL, { dr0: 90 })
    // Tag0: dr=90 nicht>raw → ks=1 → dr=100; Tag1: dr=100>90 → ks=(180-100)/90≈0.889 → +8.9 → ~108.9
    expect(r.ks).toBeLessThan(1)
    expect(r.dr).toBeCloseTo(108.9, 0)
  })
  it('Überlauf wird zu Perkolation: Dr nie negativ', () => {
    const r = computeSoilWaterBalance([2], [50], [1], SOIL, { dr0: 10 })
    expect(r.dr).toBe(0)
  })
  it('Status-Bänder good/warn/alert + Empfehlung', () => {
    expect(computeSoilWaterBalance([0], [0], [0], SOIL, { dr0: 30 }).status).toBe('good')   // <0.5*raw=45
    expect(computeSoilWaterBalance([0], [0], [0], SOIL, { dr0: 60 }).status).toBe('warn')   // 45..90
    const alert = computeSoilWaterBalance([0], [0], [0], SOIL, { dr0: 120 })
    expect(alert.status).toBe('alert')
    expect(alert.recommendMm).toBeCloseTo(120, 0) // Auffüllen auf Feldkapazität
  })
  it('clamp auf TAW (Eimer kann nicht über Welkepunkt hinaus leeren)', () => {
    const r = computeSoilWaterBalance(arr(20, 20), arr(0, 20), arr(1, 20), SOIL, { dr0: 0 })
    expect(r.dr).toBeLessThanOrEqual(SOIL.taw)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/domain/waterBalance.test.ts`
Expected: FAIL — `computeSoilWaterBalance` not exported.

- [ ] **Step 3: Write the implementation (replace file contents)**

```ts
// app/src/domain/waterBalance.ts
import type { Status } from '../types'

/** Verarmungsschwelle: bei p der TAW wird bewässert (FAO-56). */
export const WB_P = 0.5

export interface SoilWaterBalance {
  /** Wurzelraum-Verarmung Dr (mm), 0 = Feldkapazität, TAW = Welkepunkt. */
  dr: number
  /** Wasserstress-Koeffizient Ks (0..1) am letzten Tag. */
  ks: number
  /** Defizit (= Dr, mm). */
  deficit: number
  status: Status
  /** Empfohlene Netto-Gabe (mm) zum Auffüllen auf Feldkapazität, 0 wenn nicht nötig. */
  recommendMm: number
  taw: number
  raw: number
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100

/**
 * FAO-56 Wurzelraum-Wasserbilanz (Tipping-Bucket) über aligned Tagesreihen.
 * Dr_i = clamp( Dr_{i-1} + Ks·Kc·ET0 − (P − RO) − I , 0, TAW );  v1: RO=0, I=0.
 * Ks = (TAW−Dr)/(TAW−RAW) wenn Dr>RAW, sonst 1.
 */
export function computeSoilWaterBalance(
  et0: number[],
  precip: number[],
  kc: number[],
  soil: { taw: number; raw: number },
  init: { dr0: number } = { dr0: 0 },
): SoilWaterBalance {
  const taw = soil.taw
  const raw = Math.min(soil.raw, taw)
  let dr = clamp(init.dr0, 0, taw)
  let ks = 1
  const n = Math.min(et0.length, precip.length, kc.length)
  for (let i = 0; i < n; i++) {
    ks = dr > raw && taw > raw ? clamp((taw - dr) / (taw - raw), 0, 1) : 1
    const etc = ks * (kc[i] || 0) * (isFinite(et0[i]) ? et0[i] : 0)
    const p = isFinite(precip[i]) ? precip[i] : 0
    dr = clamp(dr + etc - p, 0, taw) // Überlauf < 0 = Tiefenperkolation; > TAW unmöglich
  }
  const status: Status = dr >= raw ? 'alert' : dr >= 0.5 * raw ? 'warn' : 'good'
  return {
    dr: r1(dr),
    ks: r2(ks),
    deficit: r1(dr),
    status,
    recommendMm: dr >= raw ? r1(dr) : 0,
    taw: r1(taw),
    raw: r1(raw),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/domain/waterBalance.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/waterBalance.ts app/src/domain/waterBalance.test.ts
git commit -m "feat(domain): Wasserbilanz v2 (FAO-56 Tipping-Bucket mit Ks, ersetzt klimatische Bilanz)"
```

---

### Task 4: Field soil/state props — `types.ts`

**Files:**
- Modify: `app/src/types.ts`

**Interfaces:**
- Produces: `FieldProps` gains optional `soilType?: SoilType`, `rootDepthM?: number`, `nfkMmPerM?: number`, `drMm?: number`, `drAsOf?: string` (ISO date).

- [ ] **Step 1: Add the fields**

Edit `app/src/types.ts` — add the import and extend `FieldProps`:
```ts
import type { SoilType } from './domain/soil'
// ...existing imports...

export interface FieldProps {
  id: string
  name: string
  sorte: string
  flaeche_ha: number
  flaeche_calc_ha?: number
  // Wasserbilanz v2:
  soilType?: SoilType        // Bodenart (Onboarding/Override); Default 'lehm'
  rootDepthM?: number        // effektive Wurzeltiefe Zr (m); Default 1.0
  nfkMmPerM?: number         // nutzbare Feldkapazität (mm/m); aus soilType abgeleitet oder Override
  drMm?: number              // persistente Wurzelraum-Verarmung (mm)
  drAsOf?: string            // ISO-Datum des persistierten Dr
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add app/src/types.ts
git commit -m "feat(types): Boden-/Verarmungsfelder in FieldProps (Wasserbilanz v2)"
```

---

### Task 5: Widen Open-Meteo warm-up window — `api/openMeteo.ts`

**Files:**
- Modify: `app/src/api/openMeteo.ts:39` (the `past_days` param)

**Interfaces:**
- Produces: forecast call now requests `past_days: '60'` so the bucket can warm up; `lastNDaysIndices` unchanged.

- [ ] **Step 1: Change the parameter**

In `app/src/api/openMeteo.ts`, change `past_days: '7'` to `past_days: '60'` in the `URLSearchParams`. (daily already returns `et0_fao_evapotranspiration` + `precipitation_sum`.)

- [ ] **Step 2: Verify build**

Run: `cd app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/api/openMeteo.ts
git commit -m "feat(api): past_days=60 für Wasserbilanz-Warm-up"
```

---

### Task 6: Bucket warm-up helper — `domain/waterBalanceSeries.ts`

**Files:**
- Create: `app/src/domain/waterBalanceSeries.ts`
- Test: `app/src/domain/waterBalanceSeries.test.ts`

**Interfaces:**
- Consumes: `computeSoilWaterBalance` (Task 3), `kcForDate` (Task 2), `taw`/`WB_P`.
- Produces: `runFieldWaterBalance(daily: { time: string[]; et0: number[]; precip: number[] }, soil: { nfkMmPerM: number; rootDepthM: number }, now?: Date): SoilWaterBalance` — slices the daily series to [Saisonstart..heute], builds the per-day Kc array, computes the balance. Saisonstart = 1. April des aktuellen Jahres (init Dr=0 = Feldkapazität).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { runFieldWaterBalance } from './waterBalanceSeries'

function days(from: string, n: number) {
  const t: string[] = []
  const d = new Date(from + 'T00:00:00')
  for (let i = 0; i < n; i++) { t.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
  return t
}

describe('runFieldWaterBalance', () => {
  it('rechnet ab Saisonstart (1. April) bis heute, trockener Sommer → Defizit', () => {
    const now = new Date('2026-07-15T12:00:00')
    const time = days('2026-04-01', 120)            // deckt 1.4.–heute ab
    const et0 = time.map(() => 5)                    // trocken
    const precip = time.map(() => 0)
    const r = runFieldWaterBalance({ time, et0, precip }, { nfkMmPerM: 180, rootDepthM: 1.0 }, now)
    expect(r.taw).toBeCloseTo(180, 0)
    expect(r.raw).toBeCloseTo(90, 0)
    expect(r.status).toBe('alert')                   // langer Trockenlauf
    expect(r.recommendMm).toBeGreaterThan(0)
  })
  it('feuchter Verlauf → ausgeglichen (good)', () => {
    const now = new Date('2026-07-15T12:00:00')
    const time = days('2026-04-01', 120)
    const et0 = time.map(() => 3)
    const precip = time.map(() => 5)                 // mehr als ETc
    const r = runFieldWaterBalance({ time, et0, precip }, { nfkMmPerM: 180, rootDepthM: 1.0 }, now)
    expect(r.status).toBe('good')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/domain/waterBalanceSeries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// app/src/domain/waterBalanceSeries.ts
import { computeSoilWaterBalance, WB_P, type SoilWaterBalance } from './waterBalance'
import { kcForDate } from './kc'
import { taw as computeTaw } from './soil'

/** Slice [1. April des Jahres .. heute] und rechne die FAO-56-Bilanz mit tagesgenauem Kc. */
export function runFieldWaterBalance(
  daily: { time: string[]; et0: number[]; precip: number[] },
  soil: { nfkMmPerM: number; rootDepthM: number },
  now: Date = new Date(),
): SoilWaterBalance {
  const seasonStart = new Date(now.getFullYear(), 3, 1) // 1. April
  const et0: number[] = []
  const precip: number[] = []
  const kc: number[] = []
  for (let i = 0; i < daily.time.length; i++) {
    const d = new Date(daily.time[i] + 'T12:00:00')
    if (d < seasonStart || d > now) continue
    et0.push(daily.et0[i])
    precip.push(daily.precip[i])
    kc.push(kcForDate(d))
  }
  const tawMm = computeTaw(soil.nfkMmPerM, soil.rootDepthM)
  return computeSoilWaterBalance(et0, precip, kc, { taw: tawMm, raw: WB_P * tawMm }, { dr0: 0 })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/domain/waterBalanceSeries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/waterBalanceSeries.ts app/src/domain/waterBalanceSeries.test.ts
git commit -m "feat(domain): Warm-up-Helfer runFieldWaterBalance (Saison ab 1. April, Kc je Tag)"
```

---

### Task 7: Onboarding soil selection + demo soil values

**Files:**
- Modify: `app/src/onboarding/index.ts` (review table: add Bodenart-Select; default nFK)
- Modify: `app/src/domain/fields.ts` (`normalizeField`: seed `soilType`/`rootDepthM`/`nfkMmPerM`)
- Modify: `app/data/demo-fields.geojson` (per-field `soilType`)

**Interfaces:**
- Consumes: `SOIL_TYPES`, `nfkForSoilType`, `DEFAULT_SOIL`, `DEFAULT_ROOT_DEPTH_M` (Task 1).
- Produces: every onboarded field carries `soilType`, `rootDepthM`, `nfkMmPerM`.

- [ ] **Step 1: Seed soil defaults in `normalizeField`**

In `app/src/domain/fields.ts`, import soil helpers and set defaults on the produced `FieldProps`:
```ts
import { DEFAULT_SOIL, DEFAULT_ROOT_DEPTH_M, nfkForSoilType, type SoilType, SOIL_TYPES } from './soil'
// inside normalizeField, when building props:
const soilType = (pickString(p, ['soilType', 'bodenart']) as SoilType | undefined)
  && SOIL_TYPES.includes(pickString(p, ['soilType', 'bodenart']) as SoilType)
  ? (pickString(p, ['soilType', 'bodenart']) as SoilType)
  : DEFAULT_SOIL
const props: FieldProps = {
  id: makeFieldId(name),
  name, sorte,
  flaeche_ha: reported ?? calc,
  flaeche_calc_ha: calc,
  soilType,
  rootDepthM: DEFAULT_ROOT_DEPTH_M,
  nfkMmPerM: nfkForSoilType(soilType),
}
return { type: 'Feature', geometry: feature.geometry, properties: props }
```

- [ ] **Step 2: Add per-field soil to the demo data**

In `app/data/demo-fields.geojson`, add `"soilType"` to each feature's `properties` — all `"lehm"` except `"Sandlinse"` → `"lehmiger sand"` (shows real cross-field variation):
e.g. Sandlinse: `"properties": { "name": "Sandlinse", "sorte": "Perle", "flaeche_ha": 1.9, "soilType": "lehmiger sand" }`; the others get `"soilType": "lehm"`.

- [ ] **Step 3: Add the Bodenart select to the review table**

In `app/src/onboarding/index.ts` `renderReview()`: add a column header `<th>Boden</th>` and per row a `<select data-i="${i}" data-k="soilType">` populated from `SOIL_TYPES` (selected = `f.properties.soilType`). In the `input` listener, handle `k === 'soilType'`: set `draft[i].properties.soilType = el.value` **and** `draft[i].properties.nfkMmPerM = nfkForSoilType(el.value)`. Import `SOIL_TYPES, nfkForSoilType` from `../domain/soil`.

- [ ] **Step 4: Verify build + run the full suite**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: PASS (all domain tests green; tsc clean).

- [ ] **Step 5: Commit**

```bash
git add app/src/onboarding/index.ts app/src/domain/fields.ts app/data/demo-fields.geojson
git commit -m "feat(onboarding): Bodenart-Auswahl + Demo-Bodenwerte (nFK je Schlag)"
```

---

### Task 8: Overview wiring — compute bucket + render + persist `Dr`

**Files:**
- Modify: `app/src/overview/index.ts` (replace the old water-balance card computation)
- Modify: `app/src/overview/cards.ts` (`meterViz` label: show Dr/TAW + recommend; keep `balanceLabel`)
- Modify: `app/src/state.ts` (add `updateFieldDr(id, drMm, drAsOf)` to persist depletion)

**Interfaces:**
- Consumes: `runFieldWaterBalance` (Task 6), `balanceLabel`/`meterViz` (existing `cards.ts`), `FieldProps` soil fields (Task 4), `nfkForSoilType`/`DEFAULT_SOIL`/`DEFAULT_ROOT_DEPTH_M` (Task 1).
- Produces: the Bewässerung card driven by the FAO-56 bucket; persisted `drMm`/`drAsOf` on the field.

- [ ] **Step 1: Add `updateFieldDr` to `state.ts`**

```ts
export function updateFieldDr(id: string, drMm: number, drAsOf: string): void {
  const f = state.fields.find((x) => x.properties.id === id)
  if (!f) return
  f.properties.drMm = drMm
  f.properties.drAsOf = drAsOf
  persist()
}
```

- [ ] **Step 2: Replace the water-balance computation in `overview/index.ts` `renderCards`**

Replace the existing `lastNDaysIndices`/`computeWaterBalance` block with the bucket run over the full daily series, and the water card spec to use it:
```ts
import { runFieldWaterBalance } from '../domain/waterBalanceSeries'
import { nfkForSoilType, DEFAULT_SOIL, DEFAULT_ROOT_DEPTH_M } from '../domain/soil'
import { updateFieldDr } from '../state'
// ...
const sp = sel.properties
const nfk = sp.nfkMmPerM ?? nfkForSoilType(sp.soilType ?? DEFAULT_SOIL)
const rootDepth = sp.rootDepthM ?? DEFAULT_ROOT_DEPTH_M
const wb = runFieldWaterBalance(
  { time: data.daily.time, et0: data.daily.et0_fao_evapotranspiration, precip: data.daily.precipitation_sum },
  { nfkMmPerM: nfk, rootDepthM: rootDepth },
  now,
)
updateFieldDr(sp.id, wb.dr, now.toISOString().slice(0, 10))
```
And the water `CardSpec` becomes:
```ts
{
  status: wb.status,
  eyebrow: 'Bewässerung · Wasserbilanz',
  icon: icons.water(),
  stat: balanceLabel(wb.status),
  rec: `FAO-56 Bodenwasser-Bilanz · Verarmung ${wb.deficit.toFixed(0)}/${wb.taw.toFixed(0)} mm` +
    (wb.recommendMm > 0 ? ` · ~${wb.recommendMm.toFixed(0)} mm bewässern` : ' · abwarten') +
    ` <span class="cardnote">Boden: ${sp.soilType ?? DEFAULT_SOIL}, Zr ${rootDepth} m · 250-m-nFK, kein Innen-Feld-Detail — Orientierung.</span>`,
  viz: meterViz(wb.deficit, wb.taw, wb.raw),
  src: 'Open-Meteo · ET₀ (FAO-56) · SoilGrids/Bodenart',
}
```

- [ ] **Step 3: Update `meterViz` in `cards.ts` to a depletion bar**

```ts
/** Verarmungs-Balken: Dr relativ zu TAW; RAW als Bewässerungsschwelle markiert. */
export function meterViz(dr: number, taw: number, raw: number): string {
  const pct = taw > 0 ? Math.min(100, Math.max(0, (dr / taw) * 100)) : 0
  const color = dr >= raw ? 'var(--alert)' : dr >= 0.5 * raw ? 'var(--warn)' : 'var(--good)'
  return `
    <div class="meter"><span style="width:${pct.toFixed(0)}%;background:${color}"></span></div>
    <div class="barlabel">Verarmung ${dr.toFixed(0)} mm · Schwelle (RAW) ${raw.toFixed(0)} mm · TAW ${taw.toFixed(0)} mm</div>`
}
```
(Remove the old `meterViz(deficit, etc, precip)` signature; update the loading-card placeholder text if it referenced ETc.)

- [ ] **Step 4: Verify build + full suite + manual reasoning**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: PASS — all green, no unused-import/type errors (old `lastNDaysIndices`/`computeWaterBalance`/`KC_HOPS` imports removed from `overview/index.ts`).

- [ ] **Step 5: Commit**

```bash
git add app/src/overview/index.ts app/src/overview/cards.ts app/src/state.ts
git commit -m "feat(overview): Bewässerungskarte auf FAO-56-Bucket umgestellt (+ persistente Verarmung)"
```

---

### Task 9: Build, doc-sync, deploy

**Files:**
- Modify: `REFERENCE.md` §6.3 (water balance → FAO-56 bucket); `app/README.md` (Bewässerung); `LOGBOOK.md`; `TODO.md`

- [ ] **Step 1: Production build + full test suite**

Run: `cd app && npm run build && npm test`
Expected: build OK; all tests green.

- [ ] **Step 2: Doc-sync**

Update `REFERENCE.md` §6.3 (replace climatic-balance text with the FAO-56 bucket: TAW=nFK·Zr, RAW=p·TAW, Ks, persistent Dr, status bands, soil source). Update `app/README.md` "Was funktioniert" (Bewässerung now FAO-56 bucket) + "Bewusste Vereinfachungen" (RO=0/I=0, 250 m nFK, Zr assumption). Add a dated `LOGBOOK.md` entry; tick the relevant `TODO.md` items (Kc staging / soil model partially addressed).

- [ ] **Step 3: Deploy**

Run: `./infra/deploy.sh`
Expected: `Fertig → https://doldenblick.de`; then `curl -s -o /dev/null -w "%{http_code}\n" https://doldenblick.de/` → 200.

- [ ] **Step 4: Commit + push**

```bash
git add REFERENCE.md app/README.md LOGBOOK.md TODO.md
git commit -m "docs: Wasserbilanz v2 (FAO-56) in REFERENCE/README/LOGBOOK/TODO nachgezogen"
git push origin main
```

---

## Self-Review

**Spec coverage (§8 of the design spec):** §8.1 model (TAW/RAW/Ks/Dr recurrence, RO=0/I=0, status bands) → Tasks 3, 6. §8.2 soil (presets + override + demo) → Tasks 1, 7. §8.3 persistence + warm-up (`past_days=60`, season-start init) → Tasks 5, 6, 8. §8.4 field props → Task 4. §8.5 modules + client data flow → Tasks 6, 8. §8.6 tests → Tasks 1–3, 6. §8.7 honest limits → Task 8 (card caveat) + Task 9 (README). **Deferred per spec (gated):** shared `packages/domain` extraction, server worker/ingest, RADOLAN/Sentinel/LfL, NDVI-Kc, GDD-driven Kc stages, `p_adj` — explicitly out of scope (Global Constraints).

**Placeholder scan:** none — every code step has full code; commands have expected output.

**Type consistency:** `computeSoilWaterBalance(et0[], precip[], kc[], {taw,raw}, {dr0})` defined Task 3, consumed Task 6. `runFieldWaterBalance(daily, {nfkMmPerM, rootDepthM}, now)` defined Task 6, consumed Task 8. `SoilType`/`nfkForSoilType`/`taw` defined Task 1, used Tasks 4, 6, 7, 8. `FieldProps` soil fields defined Task 4, used Tasks 7, 8. `meterViz(dr, taw, raw)` redefined Task 8 Step 3 and its only caller updated in the same task. Old exports `computeWaterBalance`/`KC_HOPS`/`WB` removed in Task 3 and their imports removed in Task 8 (overview) — no dangling references.
