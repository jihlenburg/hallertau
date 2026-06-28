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
