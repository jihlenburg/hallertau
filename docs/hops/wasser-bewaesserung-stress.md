# Wasser, Bewässerung & Stress — Hopfen

Fachreferenz für das DoldenBlick-Team zur Wasserbilanz-, Bewässerungs- und Stressmodellierung
beim Hopfen (*Humulus lupulus* L.) in der Hallertau. Alle quantitativen Angaben sind, soweit
möglich, webverifiziert; unsichere oder regional schwankende Werte sind ausdrücklich gekennzeichnet.

> **Lesehinweis für die App-Mathematik:** Die für die Wasserbilanz unmittelbar relevanten Größen
> (Kc je Stadium, Wurzeltiefe Zr, nutzbare Feldkapazität nFK/TAW, Entzugsfraktion p → RAW,
> Bewässerungsschwelle) sind fett bzw. in Tabellen hervorgehoben. Siehe Abschnitt
> [Bezug zu DoldenBlick](#bezug-zu-doldenblick).

---

## 1. Wasserbedarf des Hopfens — Größenordnung

Hopfen ist eine wüchsige, hochrankende Dauerkultur (Gerüsthöhe in der Hallertau ca. **7 m**), die in
wenigen Monaten eine sehr große Blattfläche aufbaut und entsprechend hohe Transpirationsraten
erreicht. Der Wasserbedarf konzentriert sich auf die Sommermonate (Mai–August/September).

| Größe | Wert | Bemerkung |
|---|---|---|
| Wasserbedarf Hauptsaison (Faustzahl) | **~100 mm/Monat** (Juni–August) | gängige Praxis-Faustzahl; entspricht ~3–4 mm/Tag ETc in der Spitze |
| Saisonale ETc (Mittel) | **~400–600 mm** | je nach Witterung, Sorte, Standort (Schätzbereich) |
| Tatsächliche Zusatzbewässerung Hallertau (Feldversuche) | **35–210 mm/Saison** | stark witterungs- und versuchsabhängig (LfL/HSWT) |
| Spitzen-ETc Mitte Saison | **~5–6 mm/Tag** | an heißen, trockenen Tagen im Juli/August |

Wichtig ist nicht nur die **absolute Wassermenge**, sondern die **zeitliche Verteilung**: In der
Hallertau fällt der Hauptbedarf in eine Phase (Juli/August), in der Niederschläge unsicher und
Verdunstung hoch sind. Wo Niederschlag nicht ausreicht, wird die Bewässerung idealerweise über eine
**klimatische Wasserbilanz** gesteuert (Niederschlag − ETc).

---

## 2. Durchwurzelung & Wasserentzug

- Hopfen verlangt **tiefgründige, gut durchwurzelbare Böden** mit guter Wasserführung und geringer
  Verdichtungsneigung. Der Wurzelstock (Rhizom) ist mehrjährig; aus ihm treiben jährlich die Reben
  und das jährliche Faserwurzelsystem aus.
- **Effektive Wurzeltiefe (Zr, FAO-56):** **1,0–1,2 m** für die Wasserbilanzrechnung. Der kleinere
  Wert wird für die Bewässerungssteuerung, der größere für die Modellierung von Trockenstress /
  Regenfeldbau empfohlen. *(FAO-56, Tab. 22 — Wert für „Hops".)*
- Als „effektive Wurzeltiefe" gilt der Bereich, aus dem ~70 % der Wasseraufnahme erfolgt.
- **Entzugsfraktion ohne Stress p (FAO-56):** **p ≈ 0,5** (50 % der TAW dürfen ohne Stressbeginn
  entzogen werden). Bei hoher ETc (>5 mm/Tag) ist p witterungsabhängig nach unten zu korrigieren
  (FAO-56-Korrektur: p ± 0,04·(5 − ETc)).

### Bodenwasser-Begriffe (FAO-56)

| Größe | Definition | Typische Hopfen-Anwendung |
|---|---|---|
| FK (Feldkapazität) | Wassergehalt nach Dränung | obere Grenze des pflanzennutzbaren Wassers |
| PWP (Welkepunkt) | unentziehbares „Totwasser" | untere Grenze |
| nFK (nutzbare Feldkapazität) | FK − PWP | von Wurzeln entziehbar |
| **TAW** | 1000·(θFK − θWP)·Zr [mm] | gesamtes pflanzenverfügbares Wasser in Zr |
| **RAW** | p·TAW [mm] | ohne Stress entziehbar → **Bewässerungsschwelle** |

**Rechenbeispiel (Lehmboden, nFK ≈ 180 mm/m, Zr = 1,0 m):**
TAW ≈ 180 mm; RAW = 0,5·180 = **90 mm**. Bewässert wird, wenn der Bodenwasservorrat ~90 mm unter FK
liegt (≈ 50 % nFK).

---

## 3. Kulturkoeffizient Kc nach Wachstumsstadium (FAO-56-Kc-Kurve)

Die ETc-Berechnung folgt **ETc = Kc · ET0**. Kc steigt vom Austrieb (initial) bis zum Vollwuchs
(mid-season, Mitte Juli–August) auf das Maximum und sinkt zur Ernte/Abreife (late) wieder ab.

### Standardwerte FAO-56 (Tabelle 12, „Hops")

| Stadium | Kc (single) | Bemerkung |
|---|---|---|
| **Kc ini** (Initial, Austrieb) | **0,3** | viel offener Boden, geringe Blattfläche |
| **Kc mid** (Mitte, Vollwuchs) | **1,05** | volle Blattfläche, Doldenbildung |
| **Kc end** (Spät, Abreife/Ernte) | **0,85** | beginnende Seneszenz |
| max. Bestandeshöhe h | 5 m | FAO-Tabellenwert |

### Feldabgeleitete Werte (irrigierter Hopfen cv. „Nugget", Galicien/Spanien)

Diese Werte aus einer Eddy-Kovarianz-/Wasserbilanz-Studie liegen nahe an den FAO-Standardwerten und
trennen Transpiration (basal Kcb) von Boden-Verdunstung:

| Stadium | **single Kc** (Transp. + Boden) | basal Kcb (nur Transp.) |
|---|---|---|
| initial | **0,69** | 0,16 |
| mid | **1,02** | 0,97 |
| end | **0,85** | 0,83 |

> **Hinweis:** Der hohe Kc-ini (0,69) der Feldstudie spiegelt feuchten, häufig bewässerten/beregneten
> Oberboden wider; der FAO-Standardwert (0,3) gilt für trockeneren Oberboden. Für die App-Bilanz ist
> der **FAO-Standardsatz (0,3 / 1,05 / 0,85)** der robustere Default, der Feldsatz dient als
> Plausibilitäts-Korridor.

### Stadien-Zeitachse (Hallertau, grobe Orientierung)

| Stadium | Zeitfenster | Phänologie |
|---|---|---|
| initial | April–Mai | Austrieb, Anleiten |
| crop development | Mai–Juni | rasches Höhenwachstum bis Gerüstoberkante |
| mid-season | (Ende Juni) Juli–August | Blüte → **Doldenentwicklung** (kritisch) |
| late season | (Ende August)–September | Doldenreife → Ernte |

---

## 4. Kritische Phasen — Doldenentwicklung (Juli–August)

Die wasserkritischste Phase ist die **Doldenentwicklung und -füllung im Juli und August**. Hier
fallen zusammen: maximaler Kc (≈1,05), höchste ET0 und größter Trockenstress-Effekt auf Ertrag und
Qualität.

- Wasserstress während der Doldenentwicklung mindert **Doldenertrag und -qualität** signifikant.
- Yakima-Valley-Defizitbewässerungsversuch (WA, USA): gegenüber 100 % Bewässerung verursachte
  **60 % Bewässerung** Ertragsrückgänge (2-Jahres-Mittel Trockendolden) von **30 % / 33 % / 25 % /
  19 %** für Mt. Hood, Willamette, Columbus und Chinook; **80 % Bewässerung** nur **14 % / 10 % /
  3 %** (Mt. Hood, Willamette, Chinook). Moderates Defizit ist also weit weniger schädlich als starkes.

---

## 5. Trockenstress-Wirkung auf Ertrag & Alpha-Gehalt

- **Ertrag:** klar negativ und überwiegend reversibel mit Bewässerung (s. Yakima oben). Starkes
  Defizit (60 %) kostet bei empfindlichen Sorten bis ~⅓ Ertrag.
- **Alpha-Säuren:** Reaktion ist **komplex und sortenabhängig.** In manchen Studien sind α-/β-Säuren
  über schwankende Bodenfeuchte relativ stabil; in anderen senkt ausgeprägte Trockenheit die
  α-Konzentration (z. B. Trockenjahr 2023 vs. nasses 2022 → niedrigere α-/β-Gehalte). **Tendenz:**
  starke Hitze/Trockenheit in der Reifephase drückt α; moderate Schwankungen weniger.
- **Physiologie:** unter Wassermangel sinken Transpirationsrate und Blattwasserpotenzial; bei
  Hitze + Trockenheit kombiniert kommt es zu **Wachstumsstillstand** (auch durch gehemmte
  Nährstoffaufnahme).

### Klimawandel-Signal Europa (D, CZ, SLO ≈ 90 % der Anbaufläche)

Langfristige Daten und Projektionen (Nature Communications 2023, Mozný et al.):

| Befund | Wert |
|---|---|
| Temperaturanstieg (1970→2050, Studienannahme) | **+1,4 °C** |
| Niederschlagsrückgang | **−24 mm** |
| Reifebeginn früher (vor/nach 1994) | **~20 Tage früher** |
| Ertragsrückgang (vor/nach 1994) | **~0,2 t/ha/Jahr** |
| α-Säure-Rückgang (vor/nach 1994) | **~0,6 %-Punkte** |
| Projektion bis 2050: Ertrag | **−4 bis −18 %** |
| Projektion bis 2050: α-Gehalt | **−20 bis −31 %** |

→ Die Studie untermauert, warum **Bewässerung** in der Hallertau zunehmend als Anpassungsmaßnahme
gilt (geplanter überregionaler Bewässerungsverband).

---

## 6. Hitzestress & Spätfrost

- **Hitzestress:** Hopfen zählt zu den hitzeempfindlichen Sonderkulturen. Hitze + Trockenheit →
  Wachstumsstillstand. Hitze begünstigt zudem **Spinnmilben** und (nach kühl-feuchten Perioden bei
  folgender Trockenheit/Hitze) die **Welkekrankheit** (*Verticillium*).
- **Spätfrost an jungen Reben:** Frühjahrsfröste schädigen frisch ausgetriebene, angeleitete
  Jungreben. Eine bewährte Schutzmaßnahme ist das **Zupflügen** (Bedecken der Jungpflanzen mit Erde),
  um die empfindlichen Triebe vor Strahlungsfrost zu schützen.
- *(Konkrete Schadschwellen-Temperaturen für Hopfentriebe sind in den geprüften Quellen nicht
  beziffert — als unsicher kennzeichnen; Frostschutz orientiert sich an < 0 °C an der Triebspitze.)*

---

## 7. Bewässerungsverfahren — Tropfbewässerung & Fertigation

- In der Hallertau ist die **Tropfbewässerung (Tröpfchenbewässerung)** das bevorzugte Verfahren:
  Sie hält gezielt die **optimale Bodenfeuchte im Hauptwurzelbereich** und sichert die Versorgung in
  witterungsbedingten Stresssituationen, bei minimaler Verdunstungs-/Abdriftverlust.
- **Fertigation** (Nährstoffe, v. a. N, über das Tropfwasser) verbessert Nährstoff-Effizienz und
  Ertragsstabilität (LfL/HSWT-Forschung).
- **Steuerung:** über klimatische Wasserbilanz (ET0/ETc) und/oder Bodenfeuchtesensoren (z. B.
  Tensiometer/Tension-Sensoren in mehreren Tiefen des Wurzelraums).
- *(Genaue Praxis-Tropfermengen [l/h], Tropferabstände und Schlauchabstände sind quellenseitig nicht
  belastbar beziffert — bei Bedarf aus LfL-Praxisblättern nachverifizieren.)*

---

## 8. ET0/ETc-Bezug (Rechenkern)

```
ET0   = Referenzverdunstung (Penman-Monteith, FAO-56) [mm/d]
ETc   = Kc · ET0                                        [mm/d]
TAW   = 1000 · (θFK − θWP) · Zr                         [mm]
RAW   = p · TAW                                          [mm]
Dr(t) = Dr(t−1) + ETc − (P − RO) − I + DP               [mm]   (Wurzelzonen-Defizit)
Bewässern, sobald Dr ≥ RAW   →   Stress, sobald Dr > RAW (Ks < 1)
Ks    = (TAW − Dr) / (TAW − RAW)   für Dr > RAW          (Stressfaktor 0..1)
ETc,adj = Ks · Kc · ET0
```

- **ET0**: tägliche Referenzverdunstung (Wetterdaten / DWD / Penman-Monteith).
- **ETc**: stadiengewichtetes Kc × ET0.
- **Dr**: laufendes Wurzelzonen-Defizit; Bilanz aus ETc, effektivem Niederschlag (P − Oberflächen-
  abfluss RO), Bewässerung I und Tiefenversickerung DP.
- **Bewässerungsschwelle**: Defizit erreicht **RAW = p·TAW** (≈ 50 % nFK).

---

## Bezug zu DoldenBlick

Diese Referenz fundiert direkt die **Wasserbilanz-Mathematik** des DoldenBlick-Dashboards:

1. **Kc-je-Stadium** — Default-Satz **0,3 / 1,05 / 0,85** (FAO-56), phänologiegesteuert über die
   Stadien initial → development → mid (Doldenentwicklung) → late. Feldsatz (0,69/1,02/0,85) als
   Plausibilitäts-Korridor; bei feucht gehaltenem Oberboden Kc-ini anheben.
2. **Wurzeltiefe Zr** — Default **1,0 m** für die Steuerung (bis 1,2 m für Stressmodellierung). Bei
   jungen Anlagen geringer ansetzen.
3. **nFK/TAW** — aus Bodenart × Zr; Beispiel Lehm ≈ 180 mm/m → TAW ≈ 180 mm.
4. **Entzugs-/Bewässerungsschwelle (RAW)** — **p = 0,5** → RAW = 0,5·TAW (≈ 90 mm im Beispiel);
   ETc-abhängige p-Korrektur bei Hitze (FAO-56). Auslöser für Bewässerungsempfehlung.
5. **Stressfaktor Ks** — linear unterhalb RAW; ETc,adj = Ks·Kc·ET0. Speist Warnungen
   („Trockenstress in Doldenphase") und Ertrags-/Qualitätsrisiko.
6. **Saison-Faustzahl ~100 mm/Monat** und Spitzen-ETc ~5–6 mm/d als Sanity-Check der Bilanz.
7. **Kritisches Fenster Juli–August** — App sollte Trockenstress in diesem Fenster höher gewichten
   (größter Ertrags-/α-Effekt) und mit der Phänologie/Gradtag-Logik koppeln.
8. **Klimawandel-Kontext** (−20 bis −31 % α bis 2050) begründet, warum die App Bewässerung als
   Anpassungs-Hebel betont.

**Empfohlene Default-Parameter (App-Konfig):**

| Parameter | Default | Quelle |
|---|---|---|
| Kc ini / mid / end | 0,3 / 1,05 / 0,85 | FAO-56 Tab. 12 |
| Zr (Steuerung) | 1,0 m (bis 1,2 m) | FAO-56 Tab. 22 |
| p (Entzugsfraktion) | 0,5 | FAO-56 Tab. 22 |
| nFK (Lehm, Beispiel) | ~180 mm/m | Bodenkundliche Faustzahl |
| Bewässerungsschwelle | Dr ≥ RAW (≈ 50 % nFK) | FAO-56 |

---

## Quellen

- FAO-56 — *Crop evapotranspiration (Single crop coefficient Kc)*, Tab. 12 (Hops: Kc 0,3/1,05/0,85; h=5 m): https://www.fao.org/4/x0490e/x0490e0b.htm
- FAO-56 — *ETc under soil water stress*, TAW/RAW/Ks, Tab. 22 (Zr, p): https://www.fao.org/4/X0490E/x0490e0e.htm
- FAO-56 — Volltext (Tab. 22 Rooting depth / depletion p): http://www.climasouth.eu/sites/default/files/FAO%2056.pdf
- Feldabgeleitete Kc/Kcb für irrigierten Hopfen (cv. Nugget, Galicien): https://www.sciencedirect.com/science/article/abs/pii/S0926669015303435
- Defizitbewässerung Hopfen, Ertragsrückgänge Yakima Valley (4 Sorten): https://www.sciencedirect.com/science/article/abs/pii/S0926669017300377
- Mozný et al. 2023, *Climate-induced decline in quality and quantity of European hops*, Nature Communications: https://www.nature.com/articles/s41467-023-41474-5 (Volltext PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC10564787/)
- Hop drought-stress Physiologie/Proteomik: https://www.sciencedirect.com/science/article/abs/pii/S0981942816300936
- LfL Bayern — *Bewässerung und Fertigation im Hopfenbau*: https://www.lfl.bayern.de/ipz/hopfen/022514/
- LfL — *Tropfbewässerung und Fertigation bei Hopfen* (Information, PDF): https://www.lfl.bayern.de/mam/cms07/publikationen/daten/informationen/tropfbewaesserung-fertigation-hopfen_lfl-information.pdf
- LfL — *Steuerung der Tröpfchenbewässerung* (Jahresbericht, PDF): https://www.lfl.bayern.de/mam/cms07/ipz/dateien/steuerung_der_tr__pfchenbew__sserung.pdf
- HSWT — Projekt *Bewässerungsmanagement Hopfenanbau*: https://www.hswt.de/forschung/projekt/81-bewaesserungsmanagement-hopfenanbau
- *A new approach for predicting the water balance of hops* (ResearchGate): https://www.researchgate.net/publication/332177201_A_new_approach_for_predicting_the_water_balance_of_hops
- LfL — Hopfen Krankheiten/Schädlinge (Hitze, Welke, Spinnmilbe): https://www.lfl.bayern.de/ipz/hopfen/108626/
- LW heute — *Zupflügen schützt Jungreben vor Frost*: https://www.lw-heute.de/zupfluegen-schuetzt-jungreben-vor-frost
- Pfaffenhofen Today — *Hopfen-Bewässerung Hallertau / Bewässerungsverband*: https://pfaffenhofen-today.de/103534-bewaesserungs-verband-hopfen-hallertau-2025
