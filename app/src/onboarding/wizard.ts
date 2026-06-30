/**
 * wizard.ts — Assistierter Onboarding-Wizard (4 Schritte, passwortlos)
 *
 * Schritt-Maschine: verify → fields → confirm → passkey → done
 *
 *  verify   Verifiziert den Magic-Link-Token (GET /onboarding/verify?token=…)
 *  fields   Schläge zeichnen oder per iBALIS-ZIP importieren
 *  confirm  Erkannte Schläge prüfen und bestätigen
 *  passkey  Optionaler Passkey für schnellen künftigen Login; „Später" immer möglich
 *  done     Weiterleitung zur Übersicht
 *
 * Alle Labels in Deutsch (sachlich, nicht alarmierend).
 */

import type { Feature } from 'geojson'
import * as accounts from '../api/accounts'
import { createFieldMap, importShapefile } from './fieldMap'
import type { FieldMapHandle } from './fieldMap'

// ── Typen ─────────────────────────────────────────────────────────────────────

export type OnboardingStep = 'verify' | 'fields' | 'confirm' | 'passkey' | 'done'

export interface WizardOptions {
  /** Einstiegsschritt (Standard: 'verify'). */
  initialStep?: OnboardingStep
  /** Token aus dem Magic-Link (nur für Schritt 'verify'). */
  token?: string
  /** Callback wenn Onboarding abgeschlossen ist. Standard: window.location.href = '/' */
  onDone?: () => void
  /** Vorbefüllte Features (z. B. für direkten Einstieg in 'confirm'). */
  features?: Feature[]
}

// ── Interne Zustand-Typen ─────────────────────────────────────────────────────

interface WizardState {
  step: OnboardingStep
  token: string
  features: Feature[]
  farmName: string
  error: string | null
  importError: string | null
  saving: boolean
  fieldMapHandle: FieldMapHandle | null
}

// ── HTML-Helfer ───────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

function stepIndicator(current: 1 | 2 | 3 | 4): string {
  const labels = ['Token', 'Schläge', 'Prüfen', 'Passkey']
  return `
    <div class="wiz-stepper" aria-label="Schrittanzeige" style="
      display:flex; gap:0; align-items:center; margin-bottom:24px;
    ">
      ${labels
        .map((label, i) => {
          const n = i + 1
          const done = n < current
          const active = n === current
          const dotStyle = `
            width:28px; height:28px; border-radius:50%; display:inline-flex;
            align-items:center; justify-content:center;
            font-family:var(--font-disp,sans-serif); font-weight:700; font-size:14px;
            background:${done ? 'var(--brand,#2f6b4a)' : active ? 'var(--brand,#2f6b4a)' : 'var(--line,#e4e8e3)'};
            color:${done || active ? '#fff' : 'var(--muted,#6b7d72)'};
            flex:none;
          `
          const lineStyle = `
            height:2px; flex:1; min-width:16px;
            background:${done ? 'var(--brand,#2f6b4a)' : 'var(--line,#e4e8e3)'};
          `
          return `
            ${i > 0 ? `<span style="${lineStyle}" aria-hidden="true"></span>` : ''}
            <span style="${dotStyle}" title="${esc(label)}" aria-current="${active ? 'step' : 'false'}">${done ? '✓' : n}</span>
          `
        })
        .join('')}
    </div>`
}

// ── Hauptfunktion ──────────────────────────────────────────────────────────────

/**
 * Hängt den assistierten Onboarding-Wizard in `root` ein.
 * Navigiert selbstständig durch die Schritt-Maschine.
 */
export function mountWizard(root: HTMLElement, opts: WizardOptions = {}): void {
  const state: WizardState = {
    step: opts.initialStep ?? 'verify',
    token: opts.token ?? '',
    features: opts.features ?? [],
    farmName: 'Mein Hopfenbetrieb',
    error: null,
    importError: null,
    saving: false,
    fieldMapHandle: null,
  }

  const onDone: () => void =
    opts.onDone ??
    (() => {
      window.location.href = '/'
    })

  // -- Zustandsübergänge -------------------------------------------------------

  function goTo(step: OnboardingStep): void {
    // Karte freigeben wenn wir den Felder-Schritt verlassen
    if (state.step === 'fields' && state.fieldMapHandle) {
      state.fieldMapHandle.destroy()
      state.fieldMapHandle = null
    }
    state.step = step
    state.error = null
    state.importError = null
    render()
  }

  // -- Schritte ----------------------------------------------------------------

  function renderVerify(): void {
    root.innerHTML = `
      <div class="onb">
        ${stepIndicator(1)}
        <h1 class="disp" style="font-family:var(--font-disp,sans-serif);font-weight:700;font-size:34px;letter-spacing:-.012em;">
          Willkommen bei DoldenBlick
        </h1>
        <p class="lead" style="color:var(--ink-soft,#3c5147);font-size:19px;margin-top:6px;line-height:1.45;">
          Ihr Zugangslink wird geprüft …
        </p>
        <div id="wiz-verify-msg" style="display:none; margin-top:18px;" role="alert"></div>
      </div>`

    // Token sofort verifizieren
    accounts.verifyToken(state.token).then((result) => {
      if (result.kind === 'ok') {
        goTo('fields')
      } else {
        const msgEl = root.querySelector<HTMLElement>('#wiz-verify-msg')
        if (msgEl) {
          msgEl.style.display = 'block'
          msgEl.className = 'msg err'
          msgEl.innerHTML = `
            <strong>Link ungültig oder abgelaufen.</strong>
            Der Verifikations-Link ist nicht mehr gültig oder wurde bereits verwendet.
            <br><br>
            Bitte fordern Sie einen neuen Link an oder kontaktieren Sie den Support.
          `
        }
      }
    })
  }

  function renderFields(): void {
    // Alte Karte freigeben falls vorhanden
    if (state.fieldMapHandle) {
      state.fieldMapHandle.destroy()
      state.fieldMapHandle = null
    }
    state.importError = null

    root.innerHTML = `
      <div class="onb">
        ${stepIndicator(2)}
        <h1 class="disp" style="font-family:var(--font-disp,sans-serif);font-weight:700;font-size:34px;letter-spacing:-.012em;">
          Ihre Schläge anlegen
        </h1>
        <p class="lead" style="color:var(--ink-soft,#3c5147);font-size:19px;margin-top:6px;line-height:1.45;">
          Zeichnen Sie Ihre Hopfenschläge direkt auf der Karte oder laden Sie eine iBALIS-ZIP hoch.
        </p>

        <div style="margin-top:16px; display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
          <label style="font-weight:600;font-size:16px;display:flex;gap:8px;align-items:center;">
            Betriebsname:
            <input
              id="wiz-farm-name"
              type="text"
              value="${esc(state.farmName)}"
              style="font-family:var(--font-text,sans-serif);font-size:16px;padding:6px 10px;border:1px solid var(--line,#e4e8e3);border-radius:8px;min-width:200px;"
            />
          </label>
        </div>

        <div
          id="wiz-map"
          style="height:420px;margin-top:16px;border-radius:14px;overflow:hidden;border:1px solid var(--line,#e4e8e3);"
        ></div>

        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <button
            id="wiz-import-btn"
            class="btn-sec"
            style="border:1.5px solid var(--brand,#2f6b4a);background:#fff;color:var(--brand,#2f6b4a);cursor:pointer;height:44px;padding:0 20px;border-radius:22px;font-family:var(--font-disp,sans-serif);font-weight:700;font-size:16px;"
          >
            iBALIS-Export importieren
          </button>
          <input id="wiz-file" type="file" accept=".zip" style="display:none;" />
          <span style="color:var(--muted,#6b7d72);font-size:14px;">oder direkt auf der Karte zeichnen (Klick = Stützpunkt, Doppelklick = abschließen)</span>
        </div>

        <div
          id="wiz-import-err"
          role="alert"
          style="display:none; margin-top:10px;"
          class="msg err"
        ></div>

        <div class="rowbtns" style="display:flex;align-items:center;gap:16px;margin-top:20px;">
          <div style="flex:1;"></div>
          <button
            id="wiz-next"
            class="btn"
            style="border:0;cursor:pointer;height:48px;padding:0 24px;border-radius:24px;background:var(--brand,#2f6b4a);color:#fff;font-family:var(--font-disp,sans-serif);font-weight:700;font-size:18px;"
          >
            Weiter ›
          </button>
        </div>
      </div>`

    // Farm-Name-Input live übernehmen
    const farmNameInput = root.querySelector<HTMLInputElement>('#wiz-farm-name')
    farmNameInput?.addEventListener('input', () => {
      state.farmName = farmNameInput.value
    })

    // Karte asynchron initialisieren
    const mapEl = root.querySelector<HTMLElement>('#wiz-map')!
    void createFieldMap(mapEl, {
      onChange: (feats) => {
        state.features = feats
      },
    }).then((handle) => {
      state.fieldMapHandle = handle
    })

    // Import-Button → Datei-Dialog öffnen
    const importBtn = root.querySelector<HTMLButtonElement>('#wiz-import-btn')!
    const fileInput = root.querySelector<HTMLInputElement>('#wiz-file')!

    importBtn.addEventListener('click', () => fileInput.click())

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (!file) return
      handleImport(file)
    })

    // Weiter-Button
    const nextBtn = root.querySelector<HTMLButtonElement>('#wiz-next')!
    nextBtn.addEventListener('click', () => {
      void handleSaveAndNext()
    })
  }

  async function handleImport(file: File): Promise<void> {
    const errEl = root.querySelector<HTMLElement>('#wiz-import-err')!
    errEl.style.display = 'none'

    try {
      const fc = await importShapefile(file)
      // Auf Karte setzen (falls Karte noch nicht bereit, Features speichern für später)
      if (state.fieldMapHandle) {
        state.fieldMapHandle.setFeatures(fc.features)
      }
      state.features = fc.features
      state.importError = null
    } catch (err) {
      const msg = (err as Error).message ?? 'Unbekannter Fehler'
      state.importError = msg
      errEl.style.display = 'block'
      errEl.innerHTML = `
        <strong>Import fehlgeschlagen.</strong>
        ${esc(msg)}<br>
        <span style="font-size:14px;">Sie können Ihre Schläge weiterhin direkt auf der Karte einzeichnen.</span>
      `
    }
  }

  async function handleSaveAndNext(): Promise<void> {
    const nextBtn = root.querySelector<HTMLButtonElement>('#wiz-next')
    if (nextBtn) {
      nextBtn.disabled = true
      nextBtn.textContent = 'Wird gespeichert …'
    }

    // Betrieb speichern
    const farmResult = await accounts.saveFarm({ name: state.farmName || 'Mein Betrieb' })
    if (farmResult.kind === 'error') {
      if (nextBtn) {
        nextBtn.disabled = false
        nextBtn.textContent = 'Weiter ›'
      }
      const errEl = root.querySelector<HTMLElement>('#wiz-import-err')!
      errEl.style.display = 'block'
      errEl.innerHTML = `<strong>Speichern fehlgeschlagen:</strong> ${esc(farmResult.message)}`
      return
    }

    // Schläge speichern
    const schlaegeResult = await accounts.saveSchlaege(state.features)
    if (schlaegeResult.kind === 'error') {
      if (nextBtn) {
        nextBtn.disabled = false
        nextBtn.textContent = 'Weiter ›'
      }
      const errEl = root.querySelector<HTMLElement>('#wiz-import-err')!
      errEl.style.display = 'block'
      errEl.innerHTML = `<strong>Speichern fehlgeschlagen:</strong> ${esc(schlaegeResult.message)}`
      return
    }

    goTo('confirm')
  }

  function renderConfirm(): void {
    const count = state.features.length
    const listItems = count > 0
      ? state.features
          .map((f, i) => {
            const name = (f.properties?.name as string | undefined) ?? `Schlag ${i + 1}`
            return `<li style="padding:8px 10px;border-bottom:1px solid var(--line,#e4e8e3);font-size:16px;">${esc(name)}</li>`
          })
          .join('')
      : `<li style="padding:8px 10px;color:var(--muted,#6b7d72);">Keine Schläge eingezeichnet — Sie können jederzeit Schläge hinzufügen.</li>`

    root.innerHTML = `
      <div class="onb">
        ${stepIndicator(3)}
        <h1 class="disp" style="font-family:var(--font-disp,sans-serif);font-weight:700;font-size:34px;letter-spacing:-.012em;">
          Schläge prüfen
        </h1>
        <p class="lead" style="color:var(--ink-soft,#3c5147);font-size:19px;margin-top:6px;line-height:1.45;">
          ${count} ${count === 1 ? 'Schlag erkannt' : 'Schläge erkannt'} — bitte prüfen Sie die Auswahl.
        </p>

        <div class="review" style="background:#fff;border-radius:18px;box-shadow:0 7px 20px rgba(24,42,32,.09);padding:24px 26px;margin-top:20px;">
          <h2 style="font-family:var(--font-disp,sans-serif);font-weight:700;font-size:24px;letter-spacing:-.012em;">Ihre Schläge</h2>
          <ul style="list-style:none;margin-top:12px;">${listItems}</ul>
        </div>

        <div class="rowbtns" style="display:flex;align-items:center;gap:16px;margin-top:20px;">
          <button
            id="wiz-back"
            class="btn-ghost"
            style="border:0;background:transparent;color:var(--muted,#6b7d72);cursor:pointer;font-weight:600;font-size:16px;"
          >
            ‹ Zurück
          </button>
          <div style="flex:1;"></div>
          <button
            id="wiz-confirm"
            class="btn"
            style="border:0;cursor:pointer;height:48px;padding:0 24px;border-radius:24px;background:var(--brand,#2f6b4a);color:#fff;font-family:var(--font-disp,sans-serif);font-weight:700;font-size:18px;"
          >
            Bestätigen ›
          </button>
        </div>
      </div>`

    root.querySelector<HTMLButtonElement>('#wiz-back')!.addEventListener('click', () => goTo('fields'))
    root.querySelector<HTMLButtonElement>('#wiz-confirm')!.addEventListener('click', () => goTo('passkey'))
  }

  function renderPasskey(): void {
    root.innerHTML = `
      <div class="onb">
        ${stepIndicator(4)}
        <h1 class="disp" style="font-family:var(--font-disp,sans-serif);font-weight:700;font-size:34px;letter-spacing:-.012em;">
          Schneller anmelden
        </h1>
        <p class="lead" style="color:var(--ink-soft,#3c5147);font-size:19px;margin-top:6px;line-height:1.45;">
          Richten Sie einen Passkey ein — Fingerabdruck, Gesichtserkennung oder Geräte-PIN —,
          damit Sie sich künftig ohne E-Mail-Link anmelden können.
        </p>

        <div style="max-width:480px;margin-top:28px;background:#fff;border-radius:18px;box-shadow:0 7px 20px rgba(24,42,32,.09);padding:28px 30px;">
          <div style="display:flex;flex-direction:column;gap:14px;">
            <button
              id="wiz-passkey-btn"
              class="btn"
              style="border:0;cursor:pointer;height:52px;padding:0 24px;border-radius:26px;background:var(--brand,#2f6b4a);color:#fff;font-family:var(--font-disp,sans-serif);font-weight:700;font-size:18px;"
            >
              Passkey einrichten (Fingerabdruck / Gesicht)
            </button>

            <div id="wiz-passkey-msg" role="alert" style="display:none;" class="msg"></div>

            <button
              id="wiz-skip-btn"
              class="btn-ghost"
              style="border:0;background:transparent;color:var(--muted,#6b7d72);cursor:pointer;font-weight:600;font-size:16px;text-align:left;"
            >
              Später
            </button>
          </div>

          <p style="margin-top:16px;color:var(--muted,#6b7d72);font-size:14px;line-height:1.4;">
            Passkeys sind gerätegebunden und sicherer als Passwörter. Sie können jederzeit
            weitere Geräte in den Einstellungen hinzufügen.
          </p>
        </div>
      </div>`

    // Passkey registrieren
    root.querySelector<HTMLButtonElement>('#wiz-passkey-btn')!.addEventListener('click', () => {
      void handlePasskey()
    })

    // Überspringen → direkt zur Übersicht
    root.querySelector<HTMLButtonElement>('#wiz-skip-btn')!.addEventListener('click', () => {
      onDone()
    })
  }

  async function handlePasskey(): Promise<void> {
    const btn = root.querySelector<HTMLButtonElement>('#wiz-passkey-btn')!
    const msgEl = root.querySelector<HTMLElement>('#wiz-passkey-msg')!
    btn.disabled = true
    btn.textContent = 'Bitte Gerät bestätigen …'
    msgEl.style.display = 'none'

    const result = await accounts.registerPasskey()

    if (result.kind === 'ok') {
      goTo('done')
    } else if (result.kind === 'aborted') {
      // Nutzer hat die Browser-Zeremonie abgebrochen → kein Fehler, einfach wieder freigeben
      btn.disabled = false
      btn.textContent = 'Passkey einrichten (Fingerabdruck / Gesicht)'
    } else {
      btn.disabled = false
      btn.textContent = 'Passkey einrichten (Fingerabdruck / Gesicht)'
      msgEl.style.display = 'block'
      msgEl.className = 'msg err'
      msgEl.textContent = `Passkey konnte nicht registriert werden: ${result.message}`
    }
  }

  function renderDone(): void {
    onDone()
  }

  // -- Haupt-Render-Dispatcher -------------------------------------------------

  function render(): void {
    switch (state.step) {
      case 'verify':
        renderVerify()
        break
      case 'fields':
        renderFields()
        break
      case 'confirm':
        renderConfirm()
        break
      case 'passkey':
        renderPasskey()
        break
      case 'done':
        renderDone()
        break
    }
  }

  render()
}
