// WMO-Wettercodes (Open-Meteo) → kurze deutsche Beschreibung + grobe Schwere.

export interface WmoInfo { text: string; severe: boolean; thunder: boolean }

/** Wetterklasse für ein kompaktes Glyph im Vorhersagestreifen. */
export type WmoCategory = 'clear' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'

export function wmoCategory(code: number): WmoCategory {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  return 'rain' // 51–67, 80–82
}

export function wmo(code: number): WmoInfo {
  const t = (text: string, severe = false, thunder = false): WmoInfo => ({ text, severe, thunder })
  switch (code) {
    case 0: return t('klar')
    case 1: return t('überwiegend klar')
    case 2: return t('wechselnd bewölkt')
    case 3: return t('bedeckt')
    case 45:
    case 48: return t('Nebel')
    case 51:
    case 53:
    case 55: return t('Niesel')
    case 56:
    case 57: return t('gefrierender Niesel')
    case 61: return t('leichter Regen')
    case 63: return t('Regen')
    case 65: return t('starker Regen', true)
    case 66:
    case 67: return t('gefrierender Regen', true)
    case 71: return t('leichter Schneefall')
    case 73: return t('Schneefall')
    case 75: return t('starker Schneefall', true)
    case 77: return t('Schneegriesel')
    case 80: return t('Regenschauer')
    case 81: return t('Schauer')
    case 82: return t('heftige Schauer', true)
    case 85:
    case 86: return t('Schneeschauer')
    case 95: return t('Gewitter', true, true)
    case 96:
    case 99: return t('Gewitter mit Hagel', true, true)
    default: return t('—')
  }
}
