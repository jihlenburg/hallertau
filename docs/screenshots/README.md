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
| `overview-mobile.png` | Übersicht — Telefon (390×844) | Capture-Skript erfasst den Mobil-Viewport automatisch |
| `onboarding-methods-mobile.png` | Onboarding — Telefon (390×844) | dito |

Konvention: `*-before.png` / `*-after.png` für Vorher/Nachher einer Design-Iteration.

## So erfassen
Automatisiert über ein Skript (kein manuelles Klicken, kein Browser-Download):

```
cd app && npm run screenshots
```

`scripts/capture-states.mjs` treibt via **puppeteer-core** das **System-Chrome**
(`--enable-unsafe-swiftshader` für Headless-WebGL/maplibre), startet `server.mjs` (gebauter Build +
`/api/brightsky`-Proxy), seedet die Demo-Schläge in `localStorage`, wartet auf Live-Daten und legt
`onboarding-methods.png`, `onboarding-review.png`, `overview.png` nach `docs/screenshots/` ab.

**Hook (automatischer Auslöser):** Ein Projekt-Hook in `.claude/settings.json`
(`PostToolUse` → `Bash`, `async`) ruft `npm run screenshots` selbsttätig auf, sobald ein **voller
Testlauf** (`npm test` / `npm run test`) erkannt wird — gezielte `vitest run <pfad>` und
`npm run build` lösen **nicht** aus. Der Hook feuert nur in Claude-Code-Sitzungen (nicht in CI).
Danach bewertet Claude die frischen PNGs gegen die Rubrik unten.

Noch offen (manuell): `overview-loading-*` und `overview-error-*` (Netz-Drossel/Offline nötig).

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
- **2026-06-28 (v2 · Client-Cutover):** Adversarielle Multi-Linsen-Review (Workflow, 4 Linsen ×
  Refute/Confirm) der Wasserbilanz-Karte nach dem Backend-Cutover. 23 Befunde, 17 bestätigt, 0 Blocker.
  Behoben: Farm-Header-Einfrieren bei Wetter-Fehler (defensiv); Schlagliste tastaturbedienbar; WB-Fehler
  ruhig (info statt Alarm); Disclaimer konsistent + RO=0/I=0 sichtbar; „Boden: Lehm"; „Netto ≈ X mm";
  Backend-Caveat provenienz-genau; AA-Kontrast (`--faint`/Summary/Fokus); RAW-Marke kräftiger; „61 Tage".
  Offen: responsives Mobil-Layout (Viewport `width=1280`).
- **2026-06-28 (v1):** Erstbewertung. Typo war eine Sammlung von Einzelgrößen ohne System; mehrere
  fast gleichgewichtige Texte → kein klarer Anker; gedämpfte Texte unter Lesbarkeitsgrenze.
  Eingeführt: koordinierte Skala/Tracking-Tokens, `--faint` lesbarer (#74867b), straffes Display-
  Tracking + Zeilenhöhe, mehr Masthead-Luft, `:focus-visible` + Reduced-Motion. Layout unverändert.
  Offen: voll responsives Mobil-Layout (Viewport ist noch desktop-fix `width=1280`).
