# HopfenBlick — Projektleitfaden für Claude Code

## Was ist das
Konzeptstudie und gestaltete Mockups für ein webbasiertes Feld-Dashboard für
Hopfenbetriebe in der Hallertau (Bayern). **Aktueller Stand:** vier pixelgenaue
HTML-Mockups + ein deutscher Konzeptbericht (PDF). Es ist **noch kein lauffähiges
Produkt** — die Mockups sind statische Entwürfe, die zu Bildern gerendert werden.

Leitidee des Produkts: ein **abendliches Briefing** statt eines Karten-Ebenen-Programms.
Oben wenige Statuskarten nach dem Ampelprinzip mit je einer konkreten Empfehlung,
darunter eine Karte zur Verortung.

## Repo-Struktur
- `mockups/*.html` — die vier Ansichten: Übersicht (Desktop), Mobil, Karte, Onboarding.
- `report/report.html` — Quelle des Berichts; Bilder unter `report/img/` (relative Pfade).
- `scripts/stamp_pages.py` — stempelt Seitenzahlen ins PDF (PyMuPDF).
- `build.sh` — lädt Fonts, rendert Mockups → PNG und den Bericht → PDF, setzt Seitenzahlen.
- `deliverables/` — gerenderte Ausgaben (PNG/PDF), per `build.sh` reproduzierbar.
- `assets/fonts/` — Barlow (wird von `build.sh` geladen, nicht eingecheckt).

## Build
Voraussetzungen: `wkhtmltopdf` (enthält `wkhtmltoimage`), `python3` mit `pymupdf`
und `pillow`, `fontconfig`, `curl`.
```
./build.sh        # rendert alles nach deliverables/
```

## Rendering-Toolchain & WICHTIGE Einschränkungen
Die Mockups werden mit **wkhtmltoimage** gerendert — einer alten Qt-WebKit-Engine.
Daraus folgen harte Regeln (bitte strikt einhalten, sonst bricht das Layout):
- **Kein** Flexbox, **kein** CSS-Grid, **keine** CSS-Variablen/`calc()`, **keine** CSS-Counter.
- Layout über **absolute Positionierung** in einem Container fester Größe (px), pixelgenau.
  Mockups sind in **Endauflösung** authored (z. B. 1600 px breit). **Nicht** `--zoom`
  verwenden — das verzerrt die Höhe. Stattdessen direkt in Zielpixeln gestalten.
- `-webkit-`-Präfixe für `box-shadow` und `linear-gradient` mitschreiben.
- Diagramme, Icons und Karten als **inline SVG** (keine externen Bild-Assets in den Mockups).
- Schrift wird über **fontconfig** nach Familienname aufgelöst (`Barlow`,
  `Barlow Semi Condensed`) — kein `@font-face` nötig, sofern die Fonts installiert sind.

Der **Bericht** (`report/report.html`) ist dagegen normaler Fließtext (Block + Tabellen)
und wird mit **wkhtmltopdf** zu PDF gerendert. Dieser (unpatched) Build **ignoriert**
CLI-Header/-Footer und Footer-HTML — deshalb werden Seitenzahlen **nachträglich** per
`scripts/stamp_pages.py` aufgestempelt.

## Design-System (Tokens)
- Schrift: Display = **Barlow Semi Condensed** (Bold/SemiBold), Text = **Barlow**.
- Farben: ink `#182a20`, ink-soft `#3c5147`; Marke grün `#2f6b4a` / dunkel `#234f37`;
  Gold `#c8902a` / `#e3b24e`; Blau `#2f6fb0`; bg `#f4f6f3`, Fläche `#fff`, Linie `#e4e8e3`.
- Status: gut `#2e9e63` (Tint `#e4f3ea`), Achtung `#d9962a` (`#f9efd9`),
  Warnung `#cf4f3c` (`#f9e2dd`), Info `#2f6fb0` (`#e2edf6`).
- Signatur: vertikales **„Spalier"-Motiv** (Hopfenreihen), Hopfendolden-Logo,
  Statuskarten mit farbiger linker Kante.
- Beispielbetrieb (fiktiv): **„Familie Huber"**, Au i.d.Hallertau, 6 Schläge / 18,4 ha;
  Beispiel-Schlag **„Attenhofen West"** (Sorte Herkules).

## Inhaltliche Leitplanken
- Sprache **Deutsch**, sachlich, **nicht** alarmierend.
- Fachbegriffe sauber unterscheiden: **Schlag** (einheitlich bewirtschaftete Fläche)
  ≠ **Feldstück** (Bewirtschaftungsblock im InVeKoS) ≠ **Flurstück** (Eigentumseinheit, ALKIS).
- Datenquellen offen halten und in der UI nennen: Open-Meteo, DWD/Bright Sky,
  LfL Bayern (Agrarmeteorologie & Peronospora-Warndienst), Copernicus/Sentinel,
  bayerische Geobasisdaten (DGM1, DOP40, ALKIS-Parzellarkarte als Rasterbild).
- Satellit = **regionales Screening**, nicht teilflächengenau (10-m-Pixel auf 7-m-Gerüst).
- Felder anlegen: **Import aus iBALIS / Mehrfachantrag** bevorzugen (Goldstandard) bzw.
  offene **InVeKoS-Feldstückkarte**; **nicht** das Liegenschaftskataster
  (ALKIS-Vektor ist in Bayern kostenpflichtig).

## Projektpflege — LOGBOOK.md & TODO.md (bitte führen)
- `LOGBOOK.md` — chronologisches Arbeitslog (neueste Einträge oben): je Eintrag
  Datum · Was · Warum · Ergebnis/Commit. Nach jedem nennenswerten Schritt ergänzen.
- `TODO.md` — offene Punkte/nächste Schritte (`[ ]`/`[~]`/`[x]`). Erledigtes
  abhaken und mit Datum/Commit ins `LOGBOOK.md` übernehmen.

## Sinnvolle nächste Schritte (Ideen)
- Mobile Onboarding-Variante; „auf Gerüstfläche zuschneiden"-Screen.
- Vom Mockup zum Prototyp: echtes **MapLibre**-Frontend + kleine API, die
  Open-Meteo / Bright Sky cached.
- Sorten-Schritt der Ersteinrichtung; Push-/E-Mail-Benachrichtigungen.
