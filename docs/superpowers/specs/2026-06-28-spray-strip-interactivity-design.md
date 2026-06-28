# Spec: Interaktiver Spritzfenster-Streifen — DoldenBlick

**Datum:** 2026-06-28 · **Status:** freigegeben (Brainstorm) · **Sprache:** Deutsch (Code en)

**Ziel:** Den 24-h-Spritzfenster-Streifen (`barsViz`) interaktiv und selbsterklärend machen:
(1) das **gewählte Fenster im Streifen markieren** und (2) **je Stunde Detailinfos inkl. des
bindenden Grundes** zeigen (Hover/Tap/Tastatur). Behebt zugleich die Inkonsistenz „Streifen zeigt
nur eine grüne Stunde, Überschrift nennt aber 08–11 Uhr".

## Verhalten

**Detailzeile (Hover · Tap · Fokus).** Jeder Balken ist fokussierbar; unter dem Streifen steht eine
Detailzeile (`aria-live="polite"`), die bei `mouseenter`/`focus`/`tap` die inspizierte Stunde zeigt und
bei `mouseleave`/`blur` auf die Legende zurückfällt. Zwei Zeilen:
```
Di 14:00 · ΔT 13° · Wind 16 km/h · Böen 22
Regen 3 % · Wolke 18 % · ✗ ΔT zu hoch (>8) — zu trocken
```

**Bindender Grund (`sprayReason`, rein).** Priorität: Niederschlag (nass) → Nacht/außerhalb 05–21 →
Wind/Böen zu stark → ΔT zu hoch (>8) → ΔT zu niedrig (<2) → ✓ geeignet. Für eine geeignete
Schwachwind-Dämmerungsstunde bei klarem Himmel zusätzlich „· Inversionsvorsicht" (gleiche Logik wie
`evaluateSprayWindow`, cloud-aware).

**Fenster-Markierung.** Unterklammer/Unterstrich unter den Fenster-Balken + kleines Label
„Fenster HH–HH". Balken behalten grün/grau (Statusfarbe bleibt die einzige laute Stimme).

**Anzeige-Bereich (behebt die Truncation).** Der Streifen zeigt ab „jetzt" mindestens 24 h; endet das
gewählte Fenster später, wird bis zum Fensterende verlängert (Deckel ~36 h). Liegt das Fenster noch
weiter draußen (selten), markiert ein „→"-Caret am rechten Rand die Fortsetzung samt Uhrzeit.

## Komponenten & Datenfluss

- **`sprayWindow.ts`:** `SprayHour` um `gust` und `prob` erweitern (heute nur `wind/precip/dt/cloud`),
  damit der Grund Wind ↔ Böen ↔ Regen unterscheiden kann. `evaluateSprayWindow` füllt sie.
- **`cards.ts`:** generisches `barsViz` (nur hier benutzt) → `sprayStrip(assessment, now)`:
  rendert als **CSS-Grid** (eine Spalte je Stunde), damit die Klammer-Zeile exakt unter den Balken
  sitzt; Balken als fokussierbare Elemente mit `data-idx` + `aria-label`; plus reine `sprayReason(h)`
  und `sprayHourDetail(h)` (liefert die zwei Detailzeilen als Text/HTML). Resting-Zustand der
  Detailzeile = Legende.
- **`overview/index.ts`:** nach dem Render die Balken verdrahten (`mouseenter`/`focus`/`click` →
  Detailzeile aus `hours[idx]` aktualisieren; `mouseleave`/`blur` → Legende). Re-Wiring bei jedem
  `renderCards`.
- **`styles.css`:** Grid-Layout des Streifens, Klammer-/Label-Stil, Detailzeile, Fokus-Ring auf den
  Balken; responsive (≤760 px schmaler).

## Tests
- TDD `sprayReason(h)` — jeder Zweig (nass, Nacht, Wind/Böen, ΔT>8, ΔT<2, geeignet, Inversionsvorsicht).
- TDD `sprayHourDetail(h)` — enthält Uhrzeit, ΔT, Wind, Grund.
- Render-Test `sprayStrip` — Balkenzahl, Klammer vorhanden, Detailzeile/Legende vorhanden.
- Screenshot: Ruhezustand + ein gehoverter Balken (puppeteer `page.hover`) Desktop **und** Mobil.

## Out of scope (YAGNI)
Kein Detail-Panel, keine Diagramme, kein per-Stunde-Inversions-Panel — nur die eine Detailzeile + die
Fenster-Klammer. Keine Änderung an der Spritzfenster-Logik außer den additiven `SprayHour`-Feldern.
