# Visuelle Zustände & Design-Review — DoldenBlick

Stehender Prozess: **nach jedem Feature und bei jedem Testlauf** Screenshots **aller** Client-Zustände
erzeugen und gegen die Frutiger-Rubrik prüfen; bei Bedarf mit der `frontend-design`-Skill nachschärfen.
Die PNGs sind **regenerierbare Artefakte** (gitignored) — versioniert wird nur diese Datei.

## Client-Zustände (alle erfassen)

| Datei | Zustand | So erreichbar |
|---|---|---|
| `onboarding-methods-*.png` | Onboarding — Methodenauswahl | `localStorage.clear()` → Reload (leerer Zustand leitet hierher) |
| `onboarding-review-*.png` | Onboarding — „Erkannte Schläge prüfen" | im Onboarding „Demo-Betrieb laden" (`#demo`) klicken |
| `overview-*.png` | Übersicht (Dashboard, Live-Daten) | Demo-Felder in `localStorage` setzen + Reload (Seed-Snippet s. u.) |
| `overview-loading-*.png` | Übersicht — Ladezustand | Übersicht direkt nach Feldwechsel (kurzes Fenster; Netzdrossel hilft) |
| `overview-error-*.png` | Übersicht — „Nicht abrufbar" | Open-Meteo blockieren (DevTools offline) → Karten zeigen Fehlerzustand |

Konvention: `*-before.png` / `*-after.png` für Vorher/Nachher einer Design-Iteration.

## So erfassen
1. `cd app && npm run dev` (Vite, http://localhost:5173).
2. Browser-Automation (Playwright-MCP) → je Zustand `fullPage`-Screenshot nach `docs/screenshots/`.
3. Übersicht braucht Felder — Seed in der Konsole/`browser_evaluate`:
   `localStorage.setItem('doldenblick.fields.v1', JSON.stringify(<FeatureCollection mit Schlägen>))`
   (6 Demo-Schläge: siehe `app/data/demo-fields.geojson`).

## Frutiger-Rubrik (Bewertungsmaßstab)
Adrian Frutiger — Legibilität zuerst, Typografie „verschwindet" in der Bedeutung, koordiniertes
System, Rhythmus, Ruhe. Ein Abend-Briefing ist ein **Wegeleit-Problem** (auf einen Blick lesbar).

- [ ] **Legibilität:** Liest sich jede Karte auf einen Blick (Abstand, Schlepperkabine)? Keine
      Sekundärtexte unter komfortablem Kontrast.
- [ ] **System statt Einzelgrößen:** koordinierte Typo-Skala; gleichmäßiges Versal-Tracking
      (`--track-label`); dichteres Tracking nur bei Display-Werten (`--track-tight`).
- [ ] **Ein Anker je Karte:** der Status-/Statwert führt; Eyebrow ruhig, Fließtext ruhig,
      Quelle flüsterleise aber lesbar. Keine konkurrierenden Gewichte.
- [ ] **Rhythmus & Weißraum:** gleichmäßige vertikale Abstände, großzügige, konsistente Luft.
- [ ] **Ruhe/Restraint:** die **Status-Farbe** ist die einzige laute Stimme; keine Deko ohne Funktion.
      Signatur = Spalier/Hopfendolde (einmalig, nicht überall).
- [ ] **Quality floor:** sichtbarer `:focus-visible`, `prefers-reduced-motion` respektiert,
      (Ziel) responsiv bis Mobil.

## Befund-Log
- **2026-06-28 (v1):** Erstbewertung. Typo war eine Sammlung von Einzelgrößen ohne System; mehrere
  fast gleichgewichtige Texte → kein klarer Anker; gedämpfte Texte unter Lesbarkeitsgrenze.
  Eingeführt: koordinierte Skala/Tracking-Tokens, `--faint` lesbarer (#74867b), straffes Display-
  Tracking + Zeilenhöhe, mehr Masthead-Luft, `:focus-visible` + Reduced-Motion. Layout unverändert.
  Offen: voll responsives Mobil-Layout (Viewport ist noch desktop-fix `width=1280`).
