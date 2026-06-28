# Satelliten-„Feld-Check" für Hopfen — Synthese & Empfehlung

> Ergebnis des Deep-Research-Schwarms (2026-06-28, Workflow `satellite-hops-research`): 6 Facetten +
> Synthese + Vollständigkeits-Kritik, unter der Prämisse **„Infrastruktur vor Nachfrage"**.
> Facetten-Dokumente: `sensors.md`, `indices.md`, `literature.md`, `stress.md`, `infra.md`, `fieldscale.md`.
> Lücken/Kritik: `research-gaps.md`. Geometrie-Vorabbefund: `field-scale-backtest.md`.

## DoldenBlick Satelliten-"Feld-Check" — integrierte State-of-the-Art-Synthese

### Kernbefund (über alle sechs Facetten konsistent)
**Kein frei verfügbarer Satellit ist auf einem 0,5–2 ha Hopfen-Schlag teilflächengenau.** Ein ~7 m hohes vertikales Gerüst mit ~3 m breiten Reihen erzwingt, dass *jeder* Nadir-Pixel Reben-Laubwand, Schattenwurf und nackten Zwischenreihen-Boden mischt. Konkret:

- 0,5 ha ≈ 25 Sentinel-2-10-m-Pixel, davon nach 1-Pixel-Randpuffer nur eine Handvoll "innere", und selbst die sind nie reine Laubwand.
- Die diagnostisch wichtigsten **20-m-Red-Edge/SWIR-Bänder** kollabieren auf einem 0,5-ha-Schlag auf ~1 belastbaren Pixel; viele realen, langgestreckten Schläge effektiv null.
- HLS (30 m, ~1,4 d) ist nochmals gröber → Feldmittel, nicht Teilfläche.

Damit gilt die bestehende CLAUDE.md-Leitplanke "Satellit = regionales Screening, nicht teilflächengenau" als **forschungsbelegt** und muss in der UI wörtlich sichtbar bleiben.

### Was die Tiers tatsächlich leisten
| Tier | Auflösung / Revisit | Ehrliche Einstufung |
|---|---|---|
| Sentinel-2 L2A (frei) | 10/20 m, ~5 d, Red-Edge + SWIR | Regionales/Feldmittel-Screening: Phänologie, Vigor-Trend, Anomalie-Triage je Schlag |
| Sentinel-1 GRD SAR (frei) | 10 m, allwetter, ~6–12 d | Struktur-/Feuchte-Kanal + Wolkenlücken-Füller, Screening |
| HLS (frei) | 30 m, ~1,4 d | Kadenz-Verdichtung, Feldmittel |
| ECOSTRESS / Landsat-Thermal (frei) | ~70 m / 100 m | Grobe ET-/Wasserstress-Gegenprobe für FAO-56 |
| PlanetScope/SuperDove (kommerziell) | ~3 m, ~täglich, 8 Bänder | Feld-auflösend (Sub-Field-Delta), aber 3 m ≈ 1 Reihe + 1 Gasse, nicht reihenrein |
| VHR-Tasking Pléiades Neo 30 cm / WorldView / SkySat | sub-m, on-demand | Reihen auflösend, aber Tasking-Ökonomie schlecht für Mini-Schläge als dichte Schicht |
| **UAV Multispektral + Thermal** | cm GSD | **Einzige im Hopfen peer-reviewed validierte teilflächengenaue Quelle** |

### Was selbst der beste Sensor NICHT kann (Fähigkeitsdecke)
Die einzige hop-spezifische, peer-reviewte Quelle (Kumhálová/Štofaj et al., *Remote Sensing* 17(6):970, 2025; UAV über tschechische Žatec-Gärten, 4 Saisons) zeigt: VIs erklären **Ertrag bis ~R²≈0,61** (am besten spät in der Saison), aber **Alpha-Säure/Brauqualität nur ≤18 %**. Lehre: Vigor/Biomasse/N sind verfolgbar, **Brauqualität ist aus Indizes praktisch nicht vorhersagbar** — und das gilt sogar für UAV, erst recht für Satellit. Keine Qualitäts-/Alpha-Claims in der UI.

### Krankheit — die Entscheidung, die wirklich Spritzungen treibt
Für **Peronospora (Falscher Mehltau, *P. humuli*)** existiert **kein validierter Fernerkundungs-Detektor auf irgendeiner Skala**. Das operative, validierte Signal bleibt der **LfL/ISIP-Sporenfallen-+-Wetter-Warndienst** (Zoosporangien-Zählung vs. anfälligkeitsabhängige Schwellen ~30/50). Der beste Analog-Beleg (Cornell Gold-Lab, Weinrebe, *Phytopathology* 2024): SkySat 0,5 m / PlanetScope 3 m kartieren *etablierte* Krankheit (RF 0,85–0,92), versagen aber bei früher/geringer Befallsstärke (<10 % symptomatische Blattfläche) und können Krankheiten nicht trennen — also "zu spät zum Handeln". **RS-Krankheitsrolle = reiner "Vigor-Anomalie / Geh-Kontrollieren"-Trigger, der an LfL/ISIP deferiert — niemals eine Krankheits-Diagnose-API.**

### Wasserstress — die traktabelste Facette
Thermal-CWSI (UAV, sonnenpixel-gefiltert) und Red-Edge/NDRE für Stickstoff sind in Weinberg-/Obst-Analoga validiert; **Weltraum-Thermal (ECOSTRESS/Landsat-ET)** als grobe Gegenprobe und **Sentinel-1** als Bodenfeuchte-Prior gehören **in den bereits existierenden, zustandslosen FAO-56-Wasserbilanz-Dienst** (`api/`) — als Assimilations-/Validierungs-Input, nicht als Parallelsystem.

### Schichtung statt Einzelsensor
Best-in-class ist ein **gestaffelter Stack**: Sentinel-2 (+S1, +HLS) als immer-an freie Screening-Backbone → Weltraum-Thermal als ET-Gegenprobe → PlanetScope als bezahlte Feld-Delta-Brücke (Feature-Flag) → UAV (und gelegentliches VHR-Tasking) als echter teilflächengenauer Feld-Check. "Infrastruktur vor Nachfrage" heißt: **die freie Backbone + UAV-Upload-Pfad jetzt bauen**, die kommerziellen Tiers nur als auth-gegatete Adapter vorbereiten.

### Datenzugang: "Data-to-Compute" gewinnt
Für ein kostensensitives EU-Kleinbetrieb-SaaS ist die **Copernicus Data Space Ecosystem (CDSE)** der klare Default: 10.000 freie openEO-Credits/Monat, STAC-API und — entscheidend — die **Sentinel Hub Statistical API**, die *serverseitige* Per-Schlag-Zonalstatistik inkl. Wolkenmaskierung liefert, sodass fast kein Raster die eigene Infrastruktur berührt (~€0/Monat im Huber-Maßstab). ESA-L2A-BOA nutzen (keine eigene Atmosphärenkorrektur). **GEE vom kritischen Pfad fernhalten** ($2.000/Monat-Flatfee unwirtschaftlich; gut nur fürs Prototyping). Quell-agnostischer STAC-Adapter für Failover CDSE ↔ AWS Earth Search ↔ MS Planetary Computer.


## Empfohlene Sensoren
- Sentinel-2 L2A (frei, 10/20 m, ~5 d, 13 Bänder inkl. 3 Red-Edge + 2 SWIR) — immer-an Screening-Backbone; nur Feldmittel auf dem Hopfen-Gerüst
- Sentinel-1 GRD SAR (frei, C-Band VV+VH, ~10 m, allwetter, ~6–12 d) — Struktur-/Feuchte-Kanal und Wolkenlücken-Füller; VH/VV-Verhältnis
- Harmonized Landsat Sentinel-2 / HLS v2 (frei, 30 m, ~1,4 d) — optische Kadenz-Verdichtung; gröber als native S2, daher Feldmittel
- ECOSTRESS (frei, ~70 m Thermal) + Landsat 8/9 TIRS (100 m) — grobe ET-/Wasserstress-Gegenprobe, fließt in den FAO-56-Dienst
- PlanetScope / SuperDove (kommerziell, ~3 m, ~täglich, 8 Bänder inkl. Red-Edge; ARPS-harmonisiert) — bezahlte Feld-Delta-Brücke hinter Feature-Flag
- VHR-Tasking: Pléiades Neo (30 cm pan / 1,2 m MS), Maxar WorldView (~31 cm), Planet SkySat (~50 cm) — on-demand teilflächengenaue Einzelaufnahmen
- UAV Multispektral (MicaSense RedEdge/Altum, DJI Mavic 3M) + Thermal, ~5–8 cm GSD — einzige im Hopfen validierte teilflächengenaue Feld-Check-Quelle; Upload-Pfad

## Empfohlene Indizes
- NDRE (Normalized Difference Red Edge) — Primärindex: widersteht NDVI-Sättigung bei LAI>3 der vollen Bine-Laubwand; direktester Proxy für Canopy-Chlorophyll/Stickstoff
- CIre / Chlorophyll Index Red-Edge — Canopy-Chlorophyll/N, stark in dichten Beständen
- NDVI — Basis-Vigor/Trend; sättigt früh, nur als relativer Saisontrend interpretieren
- SAVI / OSAVI / EVI2 (bodenkorrigiert) — Pflicht für die breiten nackten Zwischenreihen; reduzieren Boden-Hintergrund-Bias
- NDWI / NDMI (SWIR-basiert) — Canopy-/Bodenfeuchte als Wasserstress-Hinweis
- GNDVI — frühsaisonale Vigor-/Chlorophyll-Sensitivität
- Sentinel-1 VH/VV-Backscatter-Verhältnis — Canopy-Struktur/Biomasse, wolkenunabhängig
- PROSAIL/SNAP-Biophysik: LAI, fAPAR, fCover, Canopy Chlorophyll Content (CCC) — mit gespeicherter Unsicherheit, nächtlicher Batch
- Thermal-CWSI (UAV/Weltraum-ET) — Wasserstatus-Proxy; erfordert Sonnenpixel-Filterung auf Reihenbeständen (UAV-Skala)

## Empfohlene Infrastruktur
## Empfohlener Ingest + Compute + Storage-Stack (konkret, baubar)

Erweitert das bestehende Strong-Separation-Muster des zustandslosen Fastify-5-`api/`-Dienstes auf doldenblick-01 (nginx Reverse-Proxy, systemd) um einen **neuen zustandslosen Remote-Sensing-Dienst** mit Versionsvertrag — kein Black-Box-"Satellitenlayer".

### Ingest (jetzt bauen, frei)
- **STAC-Adapter** (TS) gegen CDSE-STAC, mit Failover zu AWS Earth Search v1 (Element84) und MS Planetary Computer. Quell-agnostisch.
- **Primärpfad = CDSE Sentinel Hub Statistical API**: serverseitige Per-Schlag-Zonalstatistik (mean/median/Perzentile + valid-pixel-count) inkl. Wolkenmaskierung. Nutzt L2A-BOA → keine eigene Atmosphärenkorrektur. Fast kein Raster landet auf eigenen Servern. Token-gecachtes OAuth.
- AOIs aus den bereits importierten **iBALIS/InVeKoS-Schlag-Geometrien** (kein kostenpflichtiges ALKIS-Vektor).
- Separater **UAV-Orthomosaik-Ingest-Pfad**: GSD-bewusster Upload, Georeferenzierung auf den Schlag, Reflexionspanel/DLS-Kalibrierung, Zwischenreihen-Boden-Maskierung, Per-Reihe/Zone-Index- + Thermal-Verarbeitung. Das ist der einzige teilflächengenaue Kanal.

### Compute
- **Node/TS-Worker** (pg-boss auf dem vorhandenen Postgres, oder BullMQ) für den Normalpfad: HTTP+JSON-Aufrufe der Statistical API, Whittaker-/Savitzky-Golay-Glättung in JS, Anomalie-Erkennung.
- **Pflicht-Qualitätsstufe**: 1-Pixel-Inward-Edge-Buffer auf der Schlag-Maske + ein **Pixel-Purity / Clean-Pixel-Count-Score** pro Schlag; Felder mit <~9 inneren 10-m-Pixeln down-weighten/unterdrücken; **nie** einen reinen-20-m-Index für <1-ha-Schläge ausliefern.
- Optionaler **zustandsloser Python/FastAPI-Microservice** (stackstac/rasterio/odc-stac über Earth-Search-COGs) NUR für schwere Custom-Raster-Jobs, PROSAIL/SNAP-Biophysik, S1-Speckle-Filter + S1/S2-Fusion, Spatiotemporal-Fusion (ESTARFM/SSFIT) und optionale SR (DSen2 — nur Visualisierung/Edge-Recovery, native 10/20 m bleibt das Maß).
- **Weltraum-Thermal (ECOSTRESS/Landsat-ET)** und **S1-Bodenfeuchte-Prior** werden als Inputs IN den bestehenden FAO-56-Dienst verdrahtet, nicht als Parallelsystem.

### Storage
- **Postgres/PostGIS**: Schlag-Polygone + Per-Schlag-Index-Zeitreihen (pro Band, mit QA-Flags, Provenienz: Sensor, GSD, Pixel/Feld, Datum, Wolken-%, Sonnen-/Blickwinkel, Reihenorientierung) + abgeleiteter Ampel-Status. Das speist die "abendliche Briefing"-Statuskarte billig.
- **S3/MinIO (Objektspeicher)**: nur gelegentliche COG-Chips, UAV-Orthomosaike (cm-Raster) und gerenderte MapLibre-Tiles cachen. **Kein Spiegeln des Archivs.**

### Scheduler & Kosten
- Nächtlicher Per-Schlag-Cron passt zum Briefing-Modell und bleibt im Huber-Maßstab innerhalb der freien 10.000 CDSE-Credits/Monat (~€0). S1+S2 pro Revisit; Fusion/SR/VHR/UAV on-demand.
- Kommerzielle Tiers (Planet-API-Subscriptions, Airbus/Maxar-Tasking) als auth-gegatete Adapter hinter Feature-Flags — gebaut, aber nicht aktiv.

### Bewusst NICHT bauen
Eigene Atmosphärenkorrektur (L2A-BOA nutzen); GEE auf dem kritischen Pfad; ein lokales Raster-Archiv; eine Krankheits-Diagnose-API.

## Bau-Reihenfolge
1. **1. Freie Screening-Backbone (Sentinel-2 via CDSE Statistical API)** — STAC-Adapter (CDSE→AWS→MS-PC Failover) + Sentinel Hub Statistical API für serverseitige Per-Schlag-Zonalstatistik (NDVI/NDRE/CIre/SAVI/NDMI) mit Wolkenmaskierung. AOIs aus iBALIS/InVeKoS-Geometrien. Zeitreihen in PostGIS. Als neuer zustandsloser RS-Dienst im api/-Muster mit Versionsvertrag.
2. **2. Qualitäts-/Konfidenz-Schicht + ehrliche UI-Tier-Beschriftung** — 1-Pixel-Edge-Buffer + Pixel-Purity/Clean-Pixel-Count je Schlag; Down-Weighting <~9 innerer Pixel; kein 20-m-only-Index für <1 ha. Provenienz (Sensor, GSD, Pixel/Feld, Wolken-%, Sonnen-/Blickgeometrie) speichern. UI labelt strikt 'regionales Screening' vs. 'teilflächengenau'.
3. **3. Weltraum-Thermal + SAR in den FAO-56-Dienst** — ECOSTRESS/Landsat-ET als grobe Wasserstress-Gegenprobe und Sentinel-1 GRD VV/VH als Bodenfeuchte-Prior als Assimilations-/Validierungs-Inputs in den existierenden zustandslosen Wasserbilanz-Dienst verdrahten — kein Parallelsystem.
4. **4. LfL/ISIP-Krankheits-Konnektor + Fusions-Regelwerk** — LfL-Peronospora-Warndienst + ISIP (API/Lizenz prüfen, sonst Bulletin-Parse) als PRIMÄRES Krankheitssignal cachen. RS-Vigor-Anomalie nur als separater, klar gelabelter 'Geh-Kontrollieren'-Flag (persistente Multi-Szenen-Abweichung, um Fehlalarme zu dämpfen). Niemals RS-Krankheitsdiagnose.
5. **5. UAV-Orthomosaik-Ingest (der echte teilflächengenaue Feld-Check)** — GSD-bewusster Upload, Georeferenzierung auf den Schlag, Reflexionspanel/DLS-Kalibrierung, Zwischenreihen-Boden-Maskierung, Per-Reihe/Zone-NDRE/CIre/SAVI + Thermal-CWSI. Objektspeicher für cm-Raster. On-demand, nicht geplant. Wachstumsstadium-bewusste RF-Vigor/Ertrags-Modelle (spät-saisonal gewichtet, ohne Qualitäts-Claims).
6. **6. Optionale kommerzielle Tiers (Feature-Flags)** — Planet-API (PlanetScope-Subscription, ARPS-harmonisiert) als bezahlte Feld-Delta-Schicht; Spatiotemporal-Fusion S2+PlanetScope für tägliche ~3 m wo lizenziert; Airbus/Maxar/SkySat-VHR-Tasking als Einzelaufnahmen. Adapter gebaut, aber inaktiv.
7. **7. Anomalie-Erkennung + Backtest-Harness** — Persistente Multi-Szenen-Abweichungs-Erkennung pro Schlag, die gezielte UAV-Flüge triggern kann. Backtest gegen historische Erträge/Scouting/LfL-Befallsereignisse mit Hold-out je Saison und ehrlichen Konfidenzintervallen.

## Offene Fragen / Risiken
- FELD-SKALEN-EHRLICHKEIT (Hauptrisiko): Kein freier Satellit ist auf 0,5–2 ha Hopfen-Gerüst teilflächengenau — 10 m S2 = Feldmittel/regionales Screening, 20-m-Red-Edge auf 0,5 ha ~1 belastbarer Pixel. UI muss Tiers wörtlich trennen ('regionales Screening' vs. 'teilflächengenau'); jeder Sub-Field-Karten-Claim für Satellit wäre eine Falschaussage.
- BACKTEST-PLAN: Historische Per-Schlag-S2/S1-Zeitreihen (2017+) für Huber-Demo + möglichst viele reale Hallertau-Schläge sammeln; saisonintegriertes NDRE/Vigor gegen erfasste Erträge korrelieren (Zielmarke ~R²≈0,6 spät-saisonal aus der UAV-Studie — für Satellit NIEDRIGER erwarten); Anomalie-Flags gegen Scouting-/LfL-Befallsprotokolle validieren; FAO-56+Weltraum-ET gegen Sap-Flow/Lysimeter oder Fandiño-Kcb prüfen. Hold-out je Saison, Konfidenzintervalle berichten.
- Brauqualität (Alpha-Säure) ist aus Indizes praktisch nicht vorhersagbar (≤18 % Decke, sogar bei UAV) — keine Qualitäts-Claims in der UI; nur Vigor/Biomasse/N als 'verfolgbar' kommunizieren.
- Krankheits-Lücke: KEIN validierter RS-Detektor für Peronospora; Analoga (Weinrebe) erkennen nur etablierten Befall (RF 0,85–0,92), versagen früh/<10 % und trennen Krankheiten nicht. RS bleibt 'Geh-Kontrollieren'-Trigger, deferiert an LfL/ISIP — deren API/Lizenz-Verfügbarkeit ist offen (API vs. Bulletin-Scrape?).
- Kantenkontamination/Pixel-Reinheit auf kleinen, langgestreckten Schlägen; Schwellwert (<~9 innere Pixel) muss an realen Hallertau-Schlag-Formen kalibriert werden.
- Geometrie-Confounds: Reihenorientierung, Sonnenwinkel und BRDF verzerren NDVI auf dem vertikalen Gerüst (Weinberg-Analoga) — Aufnahmegeometrie speichern und Low-Confidence-Readings flaggen.
- PlanetScope-Inter-CubeSat-Radiometrie-Inkonsistenz (ARPS nötig); SR/Fusion kann Hochfrequenz-Detail halluzinieren und Reflexion verzerren — nur für Visualisierung, native 10/20 m als Maß.
- CDSE-Credit-Budget jenseits eines Einzelbetriebs (Skalierung über viele Betriebe könnte freie 10k/Monat überschreiten); kommerzielle Per-Hektar-Drittanbieter-Kosten (Planet/VHR) modellieren.
- Hop-spezifische Validierung für Krankheit/N/LiDAR-Struktur fehlt komplett — aktuelle Begründung stützt sich auf Weinberg/Obst-Analoga (explizit als Analogon flaggen, an Hopfen validieren).
- Ground-Truth-Beschaffung: Zugang zu Ertragsdaten, UAV-Flügen und Scouting-Logs realer Betriebe ist die Hauptvoraussetzung für jeden glaubwürdigen Backtest — Partnerschaften (Hopfenring/LfL/Betriebe) klären.
