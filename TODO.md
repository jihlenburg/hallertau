# TODO — HopfenBlick

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
- [ ] **Wachstum & Erntefenster**: Phänologie-/GTS-Modell je Sorte.
- [ ] 7-Tage-Vorhersagestreifen im Map-Panel (wie Mockup m1).
- [ ] Pro-Gitterzelle cachen (benachbarte Schläge → gleiche Open-Meteo-Zelle).
- [ ] Kc nach BBCH/Phase staffeln statt fixem 1.05.

### Technik / Qualität
- [ ] Bright Sky im **Prod-Build**: kleiner Proxy (Dev-Proxy gilt nur für `npm run dev`).
- [ ] Optional: MapTiler-Key per `.env` als höherwertige Basemap-Alternative.
- [ ] Bundle-Größe senken (Code-Splitting; maplibre/shpjs dynamisch importieren).
- [ ] Mehr Tests: `weather`-Bewertung, `fields.normalizeField`, Import-Parser.
- [ ] Optionaler Export der angelegten Schläge als GeoJSON (Backup ohne Backend).

## Produkt / Konzept
- [ ] Vom Prototyp zur kleinen API mit Caching (Open-Meteo / Bright Sky).
- [ ] Push-/E-Mail-Benachrichtigungen (abendliches Briefing).
- [ ] Lizenzen vor produktivem Einsatz klären (Open-Meteo/Bright Sky nicht-kommerziell;
      LfL-Weiterverbreitung ggf. abstimmen).

## Erledigt (Kurzliste, Details im LOGBOOK)
- [x] Repository initialisiert (Mockups, Report, Build). — 2026-06-27
- [x] App-Prototyp „Übersicht" + reales iBALIS-/GeoJSON-Onboarding. — 2026-06-27
