# DoldenBlick — Projektleitfaden für Claude Code

## Was ist das
Ein webbasiertes Feld-Dashboard für Hopfenbetriebe in der Hallertau (Bayern).
Angefangen als Konzeptstudie, inzwischen ein **laufendes Produkt**: Die App ist
unter **https://doldenblick.de** live, samt Backend und passwortlosem Onboarding.

Drei Schichten leben nebeneinander im Repo:
- **Produkt (live).** Ein Frontend (`app/`, Vite + TypeScript + MapLibre) mit drei
  schlanken Fastify-Diensten dahinter: Wasserbilanz (`api/`), Satelliten-Feld-Check
  (`rs/`) und passwortlose Identität + Onboarding (`accounts/`). Läuft auf einem
  gehärteten Hetzner-Server, Secrets aus selbstgehostetem Infisical, E-Mail über Postmark.
- **Konzept (Referenz).** Vier pixelgenaue HTML-Mockups (`mockups/`) und der deutsche
  Konzeptbericht (`report/` → PDF). Das ist die Gestaltungs- und Inhaltsgrundlage;
  **unverändert lassen** — es dient als visueller und inhaltlicher Nordstern.
- **Domänenwissen (`docs/hops/`).** Recherche zu Anbau, Phänologie, Krankheiten, Sorten,
  Qualität und Fernerkundung — die fachliche Basis hinter den Empfehlungen.

Leitidee des Produkts: ein **abendliches Briefing** statt eines Karten-Ebenen-Programms.
Oben wenige Statuskarten nach dem Ampelprinzip mit je einer konkreten Empfehlung,
darunter eine Karte zur Verortung.

## Schnellzugriff (Referenzdateien)
- `REFERENCE.md` — gebündelte Referenz: Design-Tokens (Farben/Schrift), App-Architektur,
  API-Endpunkte, Domänen-Formeln, Konventionen. **Erste Anlaufstelle.**
- `REPORT.md` — vollständige Markdown-Fassung des Konzeptberichts (Inhalt + Berichts-Design).
- `LOGBOOK.md` / `TODO.md` — Arbeitslog und offene Punkte (s. u.).

## Repo-Struktur
**Produkt (Code):**
- `app/` — Frontend-Prototyp (Vite + TS + MapLibre): Übersicht, Onboarding-Wizard. `app/README.md`.
- `api/` — Wasserbilanz-Dienst (Fastify, zustandslos, FAO-56), Loopback `:8787`. `api/README.md`.
- `rs/` — Satelliten-Feld-Check (Fastify, CDSE/Sentinel-2), Loopback `:8788`.
- `accounts/` — passwortlose Identität + Onboarding (Fastify + Postgres), Loopback `:8789`. `accounts/README.md`.
- `infra/` — Deploy-Skripte, systemd-Units, nginx-Snippet, cloud-init/Härtung, Infisical-Compose + Secrets-Sync.

**Konzept (Referenz, unverändert lassen):**
- `mockups/*.html` — die vier Ansichten: Übersicht (Desktop), Mobil, Karte, Onboarding.
- `report/report.html` — Quelle des Berichts; Bilder unter `report/img/` (relative Pfade).
- `scripts/stamp_pages.py` — stempelt Seitenzahlen ins PDF (PyMuPDF).
- `build.sh` — lädt Fonts, rendert Mockups → PNG und den Bericht → PDF, setzt Seitenzahlen.
- `deliverables/` — gerenderte Ausgaben (PNG/PDF), per `build.sh` reproduzierbar.
- `assets/fonts/` — Barlow (wird von `build.sh` geladen, nicht eingecheckt).

**Doku:** `REFERENCE.md` (SSOT), `docs/infrastructure.md` (Server/Netz/Secrets/Quirks),
`docs/hops/` (Domänenwissen), `docs/superpowers/` (Specs + Pläne der Feature-Arbeit).

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
Der Frontend-Prototyp, die Backend-Dienste und das passwortlose Onboarding sind deployt und
laufen live. Naheliegend als Nächstes (die laufende Liste steht in `TODO.md`):
- **Peronospora** (LfL-Warndienst Hüll) und ein **Wachstums-/Erntefenster-Modell** (Phänologie
  je Sorte) als eigene Live-Karten — heute noch Roadmap-Streifen.
- Onboarding vertiefen: „auf Gerüstfläche zuschneiden", InVeKoS-Feldstücke per WFS antippen,
  Polygone manuell zeichnen; die passwortlose Anmeldung fürs echte Betriebs-Onboarding polieren.
- **Push-/E-Mail-Briefing** (abendlicher Versand) — die E-Mail-Infrastruktur (Postmark) steht bereits.
