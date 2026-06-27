import type { FieldCollection, FieldFeature } from './types'

const LS_FIELDS = 'hopfenblick.fields.v1'
const LS_SELECTED = 'hopfenblick.selected.v1'

type Listener = () => void

interface AppState {
  fields: FieldFeature[]
  selectedId: string | null
}

const listeners = new Set<Listener>()
const state: AppState = {
  fields: loadFields(),
  selectedId: localStorage.getItem(LS_SELECTED),
}

// Auswahl konsistent halten
if (state.fields.length && !state.fields.some((f) => f.properties.id === state.selectedId)) {
  state.selectedId = state.fields[0].properties.id
}

function loadFields(): FieldFeature[] {
  try {
    const raw = localStorage.getItem(LS_FIELDS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FieldCollection
    return parsed.features ?? []
  } catch {
    return []
  }
}

function persist(): void {
  const fc: FieldCollection = { type: 'FeatureCollection', features: state.fields }
  localStorage.setItem(LS_FIELDS, JSON.stringify(fc))
  if (state.selectedId) localStorage.setItem(LS_SELECTED, state.selectedId)
  else localStorage.removeItem(LS_SELECTED)
}

function emit(): void {
  for (const l of listeners) l()
}

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function getFields(): FieldFeature[] {
  return state.fields
}

export function hasFields(): boolean {
  return state.fields.length > 0
}

export function getSelected(): FieldFeature | null {
  return state.fields.find((f) => f.properties.id === state.selectedId) ?? null
}

export function getSelectedId(): string | null {
  return state.selectedId
}

export function selectField(id: string): void {
  if (state.selectedId === id) return
  state.selectedId = id
  persist()
  emit()
}

/** Ersetzt alle Schläge (z. B. nach Onboarding-Import). */
export function setFields(fields: FieldFeature[]): void {
  state.fields = fields
  state.selectedId = fields[0]?.properties.id ?? null
  persist()
  emit()
}

export function asCollection(): FieldCollection {
  return { type: 'FeatureCollection', features: state.fields }
}
