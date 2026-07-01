/**
 * Statische Polygon-Daten der deutschen Hopfen-Anbaugebiete.
 * Vormals anbaugebiete.json — als TS-Const inlined, um Node-ESM-JSON-Import-Attribute
 * (ERR_IMPORT_ATTRIBUTE_MISSING) zu vermeiden.
 */

export const anbaugebiete = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Hallertau' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10.9, 48.1],
            [12.6, 48.1],
            [12.6, 48.95],
            [10.9, 48.95],
            [10.9, 48.1],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Spalt' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10.7, 49.0],
            [11.2, 49.0],
            [11.2, 49.35],
            [10.7, 49.35],
            [10.7, 49.0],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Tettnang' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [9.3, 47.5],
            [9.9, 47.5],
            [9.9, 47.85],
            [9.3, 47.85],
            [9.3, 47.5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Elbe-Saale' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [11.5, 51.0],
            [12.7, 51.0],
            [12.7, 51.85],
            [11.5, 51.85],
            [11.5, 51.0],
          ],
        ],
      },
    },
  ],
} as const
