# TODO — DoldenBlick

Offene Punkte und nächste Schritte. `[ ]` offen · `[x]` erledigt · `[~]` in Arbeit.
Erledigtes wandert mit Datum/Commit ins `LOGBOOK.md`.

## Prototyp-App (`app/`)

### Onboarding
- [ ] Mobile Onboarding-Variante (Touch, kleinere Viewports).
- [ ] „Auf Gerüstfläche zuschneiden"-Screen (Vorgewende/Wege ausnehmen) für die
      spätere Satelliten-Auswertung.
- [ ] „Auf der Karte antippen": offene **InVeKoS-Feldstücke** per WFS laden und wählen.
- [ ] „Manuell zeichnen / GPS": Polygone selbst zeichnen (z. B. terra-draw).
- [ ] DBF-Encoding robust behandeln (Umlaute, cp1252/.cpg) beim Shape-Import.
- [ ] Mehrere Schlagkartei-Formate testen (365FarmNet, NEXT, FARMDOK; ISO-XML).
- [ ] Sorten-Schritt der Ersteinrichtung (eigene Liste, Mapping aus Importdaten).

### Übersicht / Karten
- [ ] **Peronospora**: LfL-Warndienst (Hüll) anbinden (Quelle/Recht klären).
- [ ] **Feld-Check (Satellit)**: Sentinel-Vitalität (regionales Screening, NDRE).
      Vor Vermarktung als feldscharf: **NDRE-Backtest** auf typischen 0,5–2 ha Schlägen
      (Red-Edge 20 m nativ, wenige saubere Pixel je Schlag).
- [ ] **Wachstum & Erntefenster**: Phänologie-/GTS-Modell je Sorte.
- [ ] 7-Tage-Vorhersagestreifen im Map-Panel (wie Mockup m1).
- [~] Pro-Gitterzelle cachen — Whole-Farm-Kopf bündelt bereits je Rasterzelle
      (`gridCellKey`); per-Schlag-Abruf in `refresh()` noch nicht dedupliziert.
- [ ] Kc nach BBCH/Phase staffeln statt fixem 1.05.
- [ ] Inversionsvorsicht verfeinern: Bewölkung/Strahlung in die Stundenwerte einbeziehen
      (derzeit Proxy aus Schwachwind + Dämmerungsstunde).
- [ ] Optional: Tipping-Bucket/AWC-Bodenmodell als echte Bewässerungs-Stufe (über die
      jetzige klimatische Tendenz hinaus).

### Technik / Qualität
- [x] Bright Sky im **Prod-Build**: `server.mjs` (`npm run serve`) liefert `dist/` + Proxy;
      Cloudflare-Worker-Snippet im `app/README`. — 2026-06-27 (Deployment noch offen, s. u.)
- [ ] Prod-Proxy tatsächlich **deployen** (Cloudflare/Netlify/Vercel) — Scaffold vorhanden.
- [ ] Optional: MapTiler-Key per `.env` als höherwertige Basemap-Alternative.
- [ ] Bundle-Größe senken (Code-Splitting; maplibre/shpjs dynamisch importieren).
- [~] Mehr Tests: `weather` (Frost/Quelle) ✓, `grid` ✓, `cards`/`balanceLabel` ✓,
      Import-Bayern-Guard ✓; offen: `fields.normalizeField`, echte Shape-/GeoJSON-Parser.
- [ ] Optionaler Export der angelegten Schläge als GeoJSON (Backup ohne Backend).

## Name / Marke (s. `docs/naming.md`)
- [x] Arbeitsname festgelegt: **„DoldenBlick"** (`doldenblick.de` frei). — 2026-06-27
- [ ] Domain `doldenblick.de` registrieren/sichern (Momentaufnahme, keine Reservierung).
- [ ] **Amtliche Markenrecherche** vor kommerziellem Einsatz: DPMAregister + EUIPO/TMview,
      Nizza-Klassen 9 & 42 (Software) und 32 (Bier); Restrisiko „Dolden"-Biermarken
      (Riedenburger *Dolden Sud*, *Dolden Mädel*) bewusst akzeptiert für jetzt.
- [x] Rename „HopfenBlick" → „DoldenBlick" quer durchs Repo (CLAUDE.md, README,
      Mockups, Report, `deliverables/`-Dateinamen, app/, localStorage-Keys, npm-Paket);
      Deliverables mit lokalem wkhtml-Binary neu gerendert. — 2026-06-27

## Infrastruktur / Hosting (s. `docs/infrastructure.md`)
- [x] Cloud-Server `doldenblick-01` bei Hetzner (Projekt „Hallertau"), Ubuntu 24.04, nginx. — 2026-06-27
- [x] DNS-Zone `doldenblick.de` + A/AAAA/CAA, Delegation `.de` → Hetzner-NS. — 2026-06-27
- [x] HTTPS via Let's Encrypt (certbot, Auto-Renewal). — 2026-06-27
- [x] Basis-Härtung: SSH-Drop-in, fail2ban, unattended-upgrades, sysctl, ufw + Cloud Firewall,
      nginx Security-Header/HSTS. — 2026-06-27
- [ ] **Optional, schwerer/Workflow:** Non-root-Sudo-User + `PermitRootLogin no`; SSH-Port verschieben.
- [ ] **Optional:** HSTS-Preload-Submission (erst nach längerem Stabilbetrieb, bindend).
- [x] **Backups** des Servers aktiviert (Hetzner, täglich, 7 Slots, Fenster 18–22 UTC, +20%). — 2026-06-27
- [ ] **Monitoring/Alerting** (Uptime, Zertifikatsablauf, Plattenplatz).
- [ ] `doldenblick.info` registrieren (zurückgestellt) bzw. später Redirect auf `.de`.
- [ ] Deployment der echten App (`app/`) auf den Server statt Platzhalterseite;
      Prod-Proxy `/api/brightsky` hier betreiben (s. „Technik/Qualität").

## Produkt / Konzept
- [ ] Vom Prototyp zur kleinen API mit Caching (Open-Meteo / Bright Sky).
- [ ] Push-/E-Mail-Benachrichtigungen (abendliches Briefing) — die Übersicht flaggt
      Nachtfrost jetzt in-app und verweist auf die DWD-WarnWetterApp, ersetzt aber keinen
      Echtzeit-Alarm; einziger DoldenBlick-eigener Push-Kandidat ist das Spritzfenster.
- [ ] Primäre **Farmer-Research** (Hallertau) zur Validierung der Abend-Briefing-Kadenz
      und Whole-Farm-Synthese (Persona in REPORT.md §3 ist bislang unbelegt).
- [x] **Report-PDF + Mockups neu gebaut**: alle Deliverables mit lokalem
      wkhtmltopdf/-image-Binary (`~/.local/wkhtmltox/bin`) + pymupdf neu gerendert —
      neuer Name „DoldenBlick" in den Pixeln (4 PNG, 4 Vorschau-JPG, PDF 11 S.). — 2026-06-27
- [ ] Lizenzen vor produktivem Einsatz klären (Open-Meteo/Bright Sky nicht-kommerziell;
      LfL-Weiterverbreitung ggf. abstimmen).

## Erledigt (Kurzliste, Details im LOGBOOK)
- [x] Repository initialisiert (Mockups, Report, Build). — 2026-06-27
- [x] App-Prototyp „Übersicht" + reales iBALIS-/GeoJSON-Onboarding. — 2026-06-27
- [x] Devil's-Advocate-Fixes: Frost-Erkennung, Inversionsvorsicht, Wasserbilanz als Tendenz,
      Raster-Ehrlichkeitshinweis, Import-Plausibilitätscheck, Roadmap-Streifen,
      Whole-Farm-Tageskopf, Prod-Proxy, Report-Faktenkorrektur (alle test-first). — 2026-06-27
