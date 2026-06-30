import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      // Teach Vite/vitest to load *.geojson files the same way it loads *.json
      name: 'geojson-loader',
      transform(code: string, id: string) {
        if (id.endsWith('.geojson')) {
          return { code: `export default ${code}`, map: null }
        }
      },
    },
  ],
})
