// Inline-SVGs, übernommen aus den HopfenBlick-Mockups (Dolde, Spalier, Karten-Chips).

export const logo = `
<svg class="logo" width="36" height="42" viewBox="0 0 40 46" aria-hidden="true">
  <g fill="#e3b24e"><path d="M20 2 C9 8 7 18 9 27 C11 36 16 42 20 44 C24 42 29 36 31 27 C33 18 31 8 20 2 Z"/></g>
  <g stroke="#234f37" stroke-width="1.6" opacity="0.8" fill="none"><path d="M11 16 H29 M10 23 H30 M11 30 H29 M14 37 H26"/><path d="M20 4 V44"/></g>
</svg>`

export const trellis = `
<svg class="trellis" width="640" height="88" viewBox="0 0 640 88" aria-hidden="true">
  <g stroke="#e3b24e" stroke-width="2">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${(i + 1) * 56}" y1="0" x2="${(i + 1) * 56}" y2="88"/>`).join('')}
  </g>
</svg>`

const wrap = (inner: string, stroke: string) =>
  `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><g fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`

export const icons = {
  weather: (c = '#a9701a') =>
    wrap(`<circle cx="10" cy="11" r="5"/><path d="M10 2v2M10 18v2M2 11h2M17 11h-1M4.5 5.5l1.4 1.4M15.5 5.5l-1.4 1.4"/><path d="M13 19h7M11 22h6"/>`, c),
  spray: (c = '#1f7d4c') =>
    wrap(`<path d="M9 3h5v4H9z"/><path d="M11.5 7v3M11.5 10c0 0-4 1-4 5v6h8v-6c0-4-4-5-4-5z"/><path d="M17 6l4-1M18 9l4 0M18 12l3 1"/>`, c),
  perono: (c = '#a9701a') =>
    wrap(`<path d="M13 4c-5 4-7 8-7 12a7 7 0 0 0 14 0c0-4-2-8-7-12z"/><path d="M13 9v9M9.5 13l3.5 2 3.5-2"/>`, c),
  water: (c = '#255d97') =>
    wrap(`<path d="M13 3c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z"/>`, c),
  sat: (c = '#a9701a') =>
    wrap(`<rect x="4" y="6" width="18" height="14" rx="2"/><path d="M4 11h18M10 6v14"/>`, c),
  growth: (c = '#255d97') =>
    wrap(`<path d="M13 22V9"/><path d="M13 13c-3 0-6-2-6-6 3 0 6 1 6 6zM13 11c2.5 0 5-1.5 5-5-2.5 0-5 1-5 5z"/>`, c),
  upload: (c = '#1f7d4c') =>
    `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><g fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20a5 5 0 0 1 1-9 7 7 0 0 1 13 1 4.5 4.5 0 0 1-1 9"/><path d="M15 14v9M11 18l4-4 4 4"/></g></svg>`,
  file: (c = '#3c5147') =>
    `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><g fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h8l5 5v17H9z"/><path d="M17 4v5h5"/><path d="M15 13v8M12 18l3 3 3-3"/></g></svg>`,
  pencil: (c = '#3c5147') =>
    `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><g fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 25l2-6 12-12 4 4-12 12-6 2z"/><path d="M16 9l4 4"/></g></svg>`,
}
