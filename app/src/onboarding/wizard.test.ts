// @vitest-environment jsdom
/**
 * wizard.test.ts — TDD für den assistierten Onboarding-Wizard (4 Schritte, passwortlos)
 *
 * Testszenarien aus dem Task-Brief:
 *  1. Mounting mit ?token= ruft verifyToken auf
 *  2. Passkey-Schritt rendert den „Später"-Skip
 *  3. Skip → redirect zu /
 *  4. Import-Fehler fällt auf Zeichnen zurück (kein Dead End)
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mountWizard } from './wizard'

// ---------------------------------------------------------------------------
// Modul-Mocks (hoisted vor Imports)
// ---------------------------------------------------------------------------

vi.mock('../api/accounts', () => ({
  verifyToken: vi.fn(),
  saveFarm: vi.fn(),
  saveSchlaege: vi.fn(),
  registerPasskey: vi.fn(),
  getMe: vi.fn(),
}))

vi.mock('./fieldMap', () => ({
  createFieldMap: vi.fn(),
  importShapefile: vi.fn(),
}))

import { verifyToken, saveFarm, saveSchlaege, registerPasskey } from '../api/accounts'
import { createFieldMap, importShapefile } from './fieldMap'

const mockVerifyToken = vi.mocked(verifyToken)
const mockSaveFarm = vi.mocked(saveFarm)
const mockSaveSchlaege = vi.mocked(saveSchlaege)
const mockRegisterPasskey = vi.mocked(registerPasskey)
const mockCreateFieldMap = vi.mocked(createFieldMap)
const mockImportShapefile = vi.mocked(importShapefile)

// Mock FieldMapHandle
const mockHandle = {
  setFeatures: vi.fn(),
  finishCurrent: vi.fn(),
  cancelCurrent: vi.fn(),
  destroy: vi.fn(),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

/** Lässt alle laufenden Promises (Microtasks + einen Macrotask) abarbeiten. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Standard-Mock-Implementierungen: alles resolved ok
  mockCreateFieldMap.mockResolvedValue(mockHandle)
  mockSaveFarm.mockResolvedValue({ kind: 'ok', farm: { id: 'f1', name: 'Testbetrieb' } })
  mockSaveSchlaege.mockResolvedValue({ kind: 'ok' })
  mockRegisterPasskey.mockResolvedValue({ kind: 'ok' })
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// 1. verify step — Token-Verifizierung
// ---------------------------------------------------------------------------

describe('verify step', () => {
  it('ruft verifyToken mit dem übergebenen Token auf', async () => {
    mockVerifyToken.mockResolvedValue({
      kind: 'ok',
      user: { id: 'u1', email: 'bauer@example.de', createdAt: '2026-06-30' },
    })

    const container = makeContainer()
    mountWizard(container, { initialStep: 'verify', token: 'abc123' })

    await tick()

    expect(mockVerifyToken).toHaveBeenCalledOnce()
    expect(mockVerifyToken).toHaveBeenCalledWith('abc123')
  })

  it('zeigt freundliche Fehlermeldung bei ungültigem Token', async () => {
    mockVerifyToken.mockResolvedValue({ kind: 'error', message: 'Token abgelaufen' })

    const container = makeContainer()
    mountWizard(container, { initialStep: 'verify', token: 'bad-token' })

    await tick()

    // Fehlermeldung soll sichtbar sein (kein leerer DOM)
    expect(container.textContent).toMatch(/ungültig|abgelaufen|fehlgeschlagen|erneut/i)
  })

  it('wechselt nach erfolgreicher Verifizierung zum Felder-Schritt', async () => {
    mockVerifyToken.mockResolvedValue({
      kind: 'ok',
      user: { id: 'u1', email: 'bauer@example.de', createdAt: '2026-06-30' },
    })

    const container = makeContainer()
    mountWizard(container, { initialStep: 'verify', token: 'abc123' })

    // verify → fields benötigt zwei Ticks: einen für verifyToken, einen für createFieldMap
    await tick()
    await tick()

    expect(mockCreateFieldMap).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 2. passkey step — „Später" Skip
// ---------------------------------------------------------------------------

describe('passkey step', () => {
  it('rendert den „Später"-Button zum Überspringen', () => {
    const container = makeContainer()
    mountWizard(container, { initialStep: 'passkey' })

    const buttons = Array.from(container.querySelectorAll('button'))
    const skipBtn = buttons.find((b) => b.textContent?.includes('Später'))
    expect(skipBtn).toBeDefined()
  })

  it('Klick auf „Später" ruft onDone auf', () => {
    const onDone = vi.fn()
    const container = makeContainer()
    mountWizard(container, { initialStep: 'passkey', onDone })

    const buttons = Array.from(container.querySelectorAll('button'))
    const skipBtn = buttons.find((b) => b.textContent?.includes('Später')) as HTMLButtonElement
    expect(skipBtn).toBeDefined()
    skipBtn.click()

    expect(onDone).toHaveBeenCalledOnce()
  })

  it('onDone wird nicht vor dem Klick aufgerufen', () => {
    const onDone = vi.fn()
    const container = makeContainer()
    mountWizard(container, { initialStep: 'passkey', onDone })

    expect(onDone).not.toHaveBeenCalled()
  })

  it('ohne onDone navigiert Skip zu / via window.location.href', () => {
    // jsdom erlaubt das Setzen von location.href nicht direkt → assign stub
    const originalAssign = window.location.assign
    const mockAssign = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, assign: mockAssign, href: '' },
    })

    const container = makeContainer()
    mountWizard(container, { initialStep: 'passkey' })

    const buttons = Array.from(container.querySelectorAll('button'))
    const skipBtn = buttons.find((b) => b.textContent?.includes('Später')) as HTMLButtonElement
    skipBtn?.click()

    // Entweder href gesetzt oder assign('/') aufgerufen — Implementierung wählt selbst
    const navigated =
      (window.location as unknown as { href: string }).href === '/' || mockAssign.mock.calls.length > 0

    expect(navigated).toBe(true)

    // Restore
    Object.defineProperty(window, 'location', { writable: true, value: { ...window.location, assign: originalAssign } })
  })
})

// ---------------------------------------------------------------------------
// 3. fields step — Import-Fehler → kein Dead End
// ---------------------------------------------------------------------------

describe('fields step — Import-Fehler', () => {
  it('zeigt Fehlermeldung aber behält Kartencontainer (kein Dead End)', async () => {
    mockImportShapefile.mockRejectedValue(new Error('Ungültige ZIP-Datei'))

    const container = makeContainer()
    mountWizard(container, { initialStep: 'fields' })

    // Karte initialisieren lassen
    await tick()

    // Kartenelement muss vorhanden sein
    expect(container.querySelector('#wiz-map')).not.toBeNull()

    // Datei-Input finden
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).not.toBeNull()

    // Fake-File über files-Property simulieren
    const fakeFile = new File(['bad data'], 'bad.zip', { type: 'application/zip' })
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: { 0: fakeFile, length: 1, item: () => fakeFile },
    })
    fileInput.dispatchEvent(new Event('change'))

    await tick()

    // Fehlermeldung soll erscheinen
    expect(container.textContent).toMatch(/fehler|fehlgeschlagen|ungültig|problem/i)
    // Kartencontainer muss noch vorhanden sein — kein Dead End
    expect(container.querySelector('#wiz-map')).not.toBeNull()
  })

  it('nach erfolgreichem Import werden die Features in die Karte geladen', async () => {
    const fakeFeature = {
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [[[11.77, 48.42], [11.78, 48.42], [11.78, 48.43], [11.77, 48.42]]] },
      properties: { id: 'f1' },
    }
    mockImportShapefile.mockResolvedValue({
      type: 'FeatureCollection',
      features: [fakeFeature],
    })

    const container = makeContainer()
    mountWizard(container, { initialStep: 'fields' })
    await tick()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const fakeFile = new File(['zip'], 'test.zip', { type: 'application/zip' })
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: { 0: fakeFile, length: 1, item: () => fakeFile },
    })
    fileInput.dispatchEvent(new Event('change'))

    await tick()

    expect(mockHandle.setFeatures).toHaveBeenCalledWith([fakeFeature])
  })

  it('speichert Farm + Schläge wenn „Weiter" geklickt wird', async () => {
    const container = makeContainer()
    mountWizard(container, { initialStep: 'fields' })
    await tick()

    // „Weiter"-Button klicken
    const nextBtn = container.querySelector('#wiz-next') as HTMLButtonElement
    expect(nextBtn).not.toBeNull()
    nextBtn.click()

    await tick()

    expect(mockSaveFarm).toHaveBeenCalled()
    expect(mockSaveSchlaege).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 4. confirm step — Schläge-Liste
// ---------------------------------------------------------------------------

describe('confirm step', () => {
  it('rendert einen Bestätigen-Button', () => {
    const container = makeContainer()
    mountWizard(container, { initialStep: 'confirm', features: [] })

    const confirmBtn = container.querySelector('#wiz-confirm') as HTMLButtonElement
    expect(confirmBtn).not.toBeNull()
  })
})
