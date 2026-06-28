# Qualitäts-Analytik & Standards — Hopfen

Diese Referenz beschreibt, wie Hopfenqualität nach Stand der Technik **gemessen, quantifiziert
und zertifiziert** wird: die genormten Analyseverfahren (EBC/ASBC/MEBAK), ihre Kennzahlen
und Grenzen sowie das deutsche System der Herkunfts- und Qualitätssicherung. Sie ergänzt die
sortenbezogenen Inhaltsstoff-Spannen aus `sorten.md`, die physiologische Reifegrundlage aus
`physiologie-morphologie.md` und `lebenszyklus-phaenologie-bbch.md` sowie die qualitätswirksamen
Stressfaktoren aus `wasser-bewaesserung-stress.md`.

> **Hinweis zur Verlässlichkeit:** Methoden-Bezeichnungen und Kennzahlen sind webverifiziert
> (Analytica-EBC, ASBC, MEBAK, LfL/Hopfenring, BarthHaas, Fachliteratur). Wo Zahlen sorten-,
> jahrgangs- oder laborabhängig schwanken, ist dies gekennzeichnet. Volltexte der EBC-Methoden
> sind kostenpflichtig; einige Detailparameter (z. B. exakte r/R-Werte) stammen daher aus
> begleitender Fachliteratur und sind als solche markiert.

---

## Überblick: Welche Qualitätsgrößen werden gemessen?

| Größe | Was sie aussagt | Leitverfahren | Typische Spanne (sortenabhängig) |
|---|---|---|---|
| Alpha-Säuren (α) | Bitterpotenzial (Humulone) | HPLC (EBC 7.7), Leitwert (EBC 7.4) | ca. 2–4 % (Feinaroma) bis 14–19 % (Bitter-/Hochalpha) |
| Beta-Säuren (β) | Lagerstabilität, Bittermodifikation (Lupulone) | HPLC (EBC 7.7) | ca. 3–8 % |
| Cohumulon-Anteil | Bitterqualität (Anteil an α) | HPLC (EBC 7.7) | ca. 18–35 % der α |
| Ätherisches Öl | Aromapotenzial | Wasserdampfdestillation (EBC 7.10) + GC/GC-MS (EBC 7.12) | ca. 0,4–2,5 mL/100 g, Hochalpha/Spezial bis >3 |
| Feuchte (Wassergehalt) | Lagerfähigkeit, Handelsgewicht | Trocknung (EBC 7.2), NIR | ~8–10 % ab Darre → ~10–12 % nach Konditionierung/Handel |
| Hop Storage Index (HSI) | Alterung/Oxidationsgrad | Spektralphotometrie A275/A325 (EBC 7.13, ASBC Hops-6/12) | frisch ~0,25–0,30 |
| Bonitur (visuell/sensorisch) | Doldenfarbe, Lupulin, Befall, Blatt/Stängel, Geruch, Sortenreinheit | Augenschein/Sensorik (LfL-Richtlinie) | Notensystem |
| Polyphenole / Xanthohumol | Geschmack, Funktionalstoff | HPLC (EBC 7.14 / 7.15) | XN ca. 0,2–1,1 % |

---

## EBC- und ASBC-Methodik im Überblick

Zwei große Methodensammlungen dominieren die Hopfenanalytik:

- **Analytica-EBC** (European Brewery Convention, herausgegeben über Brewers of Europe/BrewUp) —
  in Europa und Deutschland maßgeblich. Hopfen-Methoden tragen die Nummern **7.x**.
- **ASBC Methods of Analysis** (American Society of Brewing Chemists) — in Nordamerika maßgeblich;
  Hopfen-Methoden heißen **Hops-1 … Hops-14** (z. B. Hops-6/Hops-12 für HSI, Hops-14 für α/β per HPLC).
- **MEBAK** (Mitteleuropäische Brautechnische Analysenkommission) — praxisnahe deutschsprachige
  Methodensammlung, weitgehend mit EBC harmonisiert (z. B. R-300.12.110 für HSI).

EBC und ASBC sind über internationale Ringversuche **weitgehend abgeglichen**, aber nicht identisch:
Unterschiede bestehen in Extraktionsmittel, Probenvorbereitung, Geräteparametern und in den
ausgewiesenen Präzisionsdaten. Für Vergleichbarkeit ist entscheidend, dass HPLC-Verfahren denselben
**Internationalen Kalibrierextrakt (ICE)** verwenden.

### Verzeichnis der wichtigsten Analytica-EBC-Hopfenmethoden (7.x)

| Nr. | Titel | Zweck |
|---|---|---|
| 7.1 | Sampling of Hops and Hop Products | Probenahme/Repräsentativität |
| 7.2 | Moisture Content | Feuchte/Wassergehalt |
| 7.3 | Seed Content | Samengehalt |
| **7.4** | **Lead Conductance Value** of Hops, Powders, Pellets | α via konduktometrische Bleizahl |
| 7.5 | Bitter Substances (Lead Conductance, Total/Soft/Hard Resin) | Hartharze/Weichharze |
| 7.6 | Bitter Substances in Hop Extracts | Extrakt-Bitterstoffe |
| **7.7** | **α- und β-Säuren in Hopfen und Hopfenprodukten** (HPLC) | Referenzmethode α/β |
| 7.8 / 7.9 / 7.11 | Iso-α- / reduzierte Iso-α-Säuren (HPLC) | isomerisierte Produkte |
| **7.10** | **Hop Oil Content** (Wasserdampfdestillation) | Gesamtölgehalt |
| **7.12** | **Hop Essential Oils** by Gas Chromatography | Ölspektrum (GC/GC-MS) |
| **7.13** | **Hop Storage Index (HSI)** | Alterungsindikator |
| 7.14 | Total Polyphenols | Gesamtpolyphenole |
| 7.15 | Xanthohumol (HPLC) | Funktionalstoff |

---

## α- und β-Säuren per HPLC — Analytica-EBC 7.7 (Referenzmethode)

**Prinzip.** Reversed-Phase-HPLC trennt die einzelnen Bitterstoffe und detektiert sie im UV
(typisch **um 314 nm**, in der Literatur auch 270/314 nm). Quantifiziert wird gegen den
zertifizierten **International Calibration Extract (ICE)**. Unter RP-Bedingungen eluiert zuerst
**Cohumulon**, dann coeluierend **Ad-/Humulon**, danach **Colupulon** und zuletzt coeluierend
**Ad-/Lupulon**.

**Was geliefert wird.** Einzel- und Summenwerte für α (Co-, n-, Adhumulon) und β (Co-, n-, Adlupulon)
sowie das daraus berechnete **Cohumulon/α-Verhältnis** — ein Qualitätsmerkmal (niedriges Cohumulon
gilt traditionell als „feinere" Bittere). Anwendbar auf Rohhopfen, Pulver/Pellets und konventionelle
Extrakte (für Extrakte ergänzend EBC 7.6).

**Kalibrierstandard ICE.** Die ICE-Generationen tragen reportierte Gehalte; z. B. **ICE-3** mit ca.
**44,65 % α-Säuren** (Cohumulon 13,88 %; Humulon/Adhumulon 30,76 %) und **24,26 % β-Säuren**
(Colupulon 13,44 %; Lupulon/Adlupulon 10,84 %). *Hinweis: Jede ICE-Charge hat eigene zertifizierte
Werte; immer den chargenspezifischen Zertifikatswert verwenden.*

**Präzision (aus Begleitliteratur/Ringversuch).** Eine modifizierte 7.7-Version wurde 2004/2005 im
internationalen Ringversuch (EBC, ASBC, BCOJ, AHA) validiert; Wiederhol- (r95) und Vergleichbarkeits-
werte (R95) wurden als akzeptabel eingestuft. Die reine **Injektionsvariabilität** lag in einer Studie
bei ~0,30 % (Standardabweichung 0,26 %). *Exakte r/R-Zahlen pro Analyt nur im kostenpflichtigen
Volltext.*

**Stärken/Grenzen.** HPLC ist **substanzspezifisch** (echte α/β statt Summenparameter), liefert das
Cohumulon-Verhältnis und ist daher die Schiedsmethode. Nachteile: Geräte-/Personalaufwand, Laufzeit,
Standardabhängigkeit, Lösungsmittel.

---

## Konduktometrische Titration / Bleizahl — Analytica-EBC 7.4 & 7.5

**Prinzip.** Der Hopfen wird mit **Toluol** extrahiert; ein Aliquot wird in Methanol/Eisessig
**konduktometrisch mit standardisierter Bleiacetat-Lösung titriert**. Die Bitterstoffe fallen als
Blei-Salze aus; aus dem Leitfähigkeitsverlauf wird der **Lead Conductance Value (LCV, „Bleizahl")**
bestimmt. EBC 7.5 erweitert dies um die Harzfraktionierung (Gesamt-/Weich-/Hartharz).

**Bezug zu α.** Der LCV ist ein **Summenparameter** und korreliert eng mit dem α-Gehalt; er liefert
historisch den „konduktometrischen α-Wert". Er unterscheidet jedoch **nicht** zwischen den Einzel-
homologen und überschätzt α tendenziell bei oxidiertem (gealtertem) Material, weil Abbauprodukte
mit-titriert werden. Deshalb gilt **HPLC (7.7) als Schiedsmethode**.

**Präzision (Geräteanwendung).** Automatisierte Konduktometrie ist robust; eine Metrohm-Applikation
(Solero-Pellets) berichtet eine relative Standardabweichung von ~**2,7 % RSD**. *Anwendungs-, nicht
Ringversuchswert.* Die Methode 7.4 wurde 2019 überarbeitet und mit 7.5 harmonisiert (Extraktion,
Titrationsschritt).

**Status.** Wegen des giftigen **Bleiacetats** und der HPLC-Verfügbarkeit ist die Bleizahl in vielen
Laboren rückläufig, bleibt aber eine genormte, vergleichbare Routinegröße.

---

## Hop Storage Index (HSI) — Spektralphotometrie (EBC 7.13 / ASBC Hops-6+12 / MEBAK R-300.12.110)

**Prinzip.** Lösungsmittelextrakt des Hopfens, UV-Absorptionsmessung. **HSI = A275 / A325** (dimensionslos):

- **325 nm** = Absorptionsmaximum der **frischen** α-/β-Säuren,
- **275 nm** = Maximum der **oxidierten** Abbauprodukte.

Bei Alterung steigt A275 und sinkt A325 → **HSI steigt**. HSI ist damit ein **schneller, billiger
Alterungs-/Oxidationsindikator**, aber kein direkter α-Wert.

**Richtwerte.** Sehr frisch ≈ **0,25**; „frisch geerntet" ≤ ~0,30–0,31; gut lagernde Ware ~0,30–0,40;
gealtert 0,40–0,50; stark gealtert >0,50–0,60.

| HSI | grobe Einordnung | geschätzter α-Verlust* |
|---|---|---|
| ~0,25 | sehr frisch | ~0 % |
| ≤0,30–0,31 | frisch geerntet | bis ~10 % |
| 0,30–0,40 | normale Lagerung | ~10–20 % |
| ~0,42–0,43 | gealtert | ~15–16 % α-Verlust (Brauversuch) |
| 0,40–0,50 | deutlich gealtert | ~20–30 % |
| ~0,61–0,63 | stark gealtert | ~38–47 % α-Verlust (Brauversuch) |

\* Schätzung; **sortenabhängig**. BarthHaas-Brauversuche zeigen unterschiedliche Start-HSI je Sorte:
Hallertauer Mittelfrüh, Hersbrucker, Tettnang starten ≤ ~0,275; Aurora/Celeia eher >0,300. HSI-Schwellen
sind daher **sortenspezifisch** zu interpretieren.

**α-Verlustformel.** Nach Nickerson & Likens (1979) lässt sich der prozentuale Verlust näherungsweise
über `% (α+β)-Verlust = Steigung × log(HSI/Konstante)` abschätzen, mit jahrgangsabhängigen Steigungen
(~101,8 bis ~114,6). Im Hobbybereich verbreitet ist der „Freshness Factor"
`= 1,0 − 1,10 × log₁₀(HSI × 4,0)`. *Beide sind Näherungen ohne Sortenkorrektur.*

**Grenzen.** HSI ist **unspezifisch** (keine Einzelsubstanzen), stark sorten- und
lösungsmittelabhängig; absolute α-Verluste sollten gegen HPLC und Sensorik abgeglichen werden.

---

## Ätherische Öle — Wasserdampfdestillation + GC/GC-MS (EBC 7.10 & 7.12)

**Gesamtölgehalt (EBC 7.10).** Bestimmung per **Wasserdampfdestillation**, Ergebnis in **mL Öl/100 g**.
Typische Spannen (sortenabhängig): Feinaromasorten ~0,5–1,5 mL/100 g, Hochalpha-/Spezialaroma
deutlich höher (bis >3 mL/100 g; siehe `sorten.md`).

**Ölspektrum (EBC 7.12 per GC, oft GC-MS).** Auftrennung in Einzelkomponenten. Leitsubstanzen:

| Komponente | Klasse | typischer Anteil am Öl |
|---|---|---|
| β-Myrcen | Monoterpen | ~20–50 % (frisch dominierend) |
| α-Humulen | Sesquiterpen | ~20–40 % (Edelhopfensorten am oberen Rand) |
| β-Caryophyllen | Sesquiterpen | ~8–14 % |
| Farnesen | Sesquiterpen | sortenabhängig 0–>10 % |
| Linalool, Geraniol u. a. | sauerstoffhaltig | Spuren–wenige %, aromaprägend |

**Grenzen.** Die **Wasserdampfdestillation** ist für **thermolabile** Komponenten (z. B.
Caryophyllenoxid) ungeeignet, weil diese beim Kochen entstehen/zerfallen; außerdem kann es zu
Isomerisierung/Oxidation von Terpenalkoholen kommen. Alternativ liefern **Headspace-Trap-GC/MS**
oder **SPME** schonendere Profile; für die meisten Komponenten korrelieren beide stark mit der
EBC-Methode. Verhältnisse wie **Humulen/Caryophyllen** oder der **sauerstoffhaltige Anteil** dienen
als Sorten- und Reifekennzahlen.

---

## NIR/NIRS — Schnellbestimmung von α & Feuchte

**Prinzip.** Nahinfrarot-Reflexions-/Transmissionsspektroskopie an frischem Hopfen oder gemahlenen
Pellets, ausgewertet über **chemometrische Kalibriermodelle**, die gegen die Referenzmethoden
(EBC 7.4/7.5/7.7) trainiert werden.

**Was geliefert wird.** Rasche, **chemikalienfreie, zerstörungsarme** Mehrparameter-Bestimmung von
**α- und β-Säuren, Cohumulon, Gesamtöl, HSI und Feuchte** in Sekunden bis Minuten — ideal für
Wareneingang, Annahme und Erntefenster-Entscheidungen.

**Genauigkeit/Grenzen.** NIRS ist **nur so gut wie die Referenzkalibrierung**; eng gefasste
Konzentrationsmodelle halbieren den Vorhersagefehler gegenüber Breitbandmodellen. NIRS ist eine
**Sekundärmethode** (relativ, modellgebunden), die regelmäßig gegen HPLC/Leitwert validiert werden
muss; für Schiedszwecke bleibt die Primärmethode maßgeblich.

---

## Feuchte / Wassergehalt (EBC 7.2)

Die Zielfeuchte ist **zweistufig**: direkt **ab der Darre ~8–10 %**, nach der **Konditionierung**
(Feuchteausgleich) bzw. im **Handel ~10–12 %** Wassergehalt. Zu trocken (<8 %) → Bröseln,
Lupulinverlust; zu feucht (>12–13 %) → Schimmel-/Selbsterhitzungsgefahr und Wertminderung.
Bestimmung per Trocknung (EBC 7.2) oder schnell per NIR. Die richtige **Konditionierung nach der
Darre** ist entscheidend für Lagerqualität (LfL).

---

## Probenahme & Repräsentativität (EBC 7.1)

Jede Analytik ist nur so gut wie die Probe. EBC 7.1 regelt das Ziehen repräsentativer Proben aus
Partien/Ballen (Mehrfacheinstiche, Mischprobe, Teilung). In Deutschland zieht der **Hopfenring**
die Proben **neutral** am Siegelort nach festgelegtem Stichprobenverfahren; tägliche Kurierlogistik
bringt sie während der Ernte ins neutrale Labor. Unrepräsentative Probenahme ist die häufigste
Fehlerquelle vor der eigentlichen Messunsicherheit der Methode.

---

## Deutsches Qualitäts- und Herkunftssystem

### Herkunftssicherung & Deutsches Hopfensiegel
Im Mai meldet der Pflanzer Fläche und Sorten an (**Anbaumeldung**) und erhält Erzeugerbescheinigung
und Siegel vom Pflanzerverband. Nach der Ernte werden die Ballen **versiegelt und gekennzeichnet**;
der vom Verband bestellte Hopfenfachmann bestätigt die **Herkunft** (Anbaugebiet, Sorte, Erntejahr).
Das System sichert die **lückenlose Rückverfolgbarkeit** und die EU-rechtlichen Mindest-
Qualitätsanforderungen für „Deutschen Siegelhopfen". Beim Öffnen für die Verarbeitung wird das
Siegel gebrochen; eine **Zweitzertifizierung** unter amtlicher Aufsicht sichert die Pellet-/Extrakt-
Produktion lückenlos weiter.

### Neutrale Qualitätsfeststellung (NQF) & Bonitierung
Die **NQF** stellt zentrale Qualitätsparameter der gesamten deutschen Ernte neutral fest. Der
Hopfenring betreut **Probenahme, -transport und Auswertung für rund 10.000 Partien/Jahr** und deckt
ca. **99 %** der bayerischen Zertifizierung mit ab. Geprüft werden:

- **Bonitur der Dolden** auf **Krankheits-/Schädlingsbefall, Farbe, Geruch und Sortenreinheit**
  (visuell/sensorisch nach **LfL-Richtlinie** zur Bonitur getrockneter Dolden),
- **Wassergehalt**,
- **Blatt-/Stängelanteil**, lose Doldenblätter, Hopfenabfall,
- **Rückstandsmonitoring** gegen ~570 Wirkstoffe (anonym, jede 25. NQF-Probe).

### Neutralhopfen
„Neutralhopfen" bezeichnet **neutral gezogene/geprüfte** Ware außerhalb von Liefer-/Eigeninteressen —
Grundlage für objektive Qualitätsfeststellung und faire Abrechnung.

### Relevante Labore & Institutionen
- **LfL** (Bayerische Landesanstalt für Landwirtschaft), **Hopfenforschungszentrum Hüll** —
  Forschung, Methoden, Sortenzüchtung, Bonitur-Richtlinien.
- **Hopfenring e. V.** — neutrale Probenahme, NQF, QM-Hopfen.
- **HVG** (Hopfenverwertungsgenossenschaft) und **HRI** (Hop Research / BarthHaas-nahe Labore) —
  Verarbeitung, Analytik, Qualitätssiegel.

---

## Genauigkeit & Grenzen der Verfahren (Zusammenfassung)

| Verfahren | spezifisch? | Schnelligkeit | Hauptgrenze |
|---|---|---|---|
| HPLC (EBC 7.7) | ja (Einzel-α/β, Cohumulon) | mittel | Aufwand, Standardabhängigkeit; Schiedsmethode |
| Leitwert/Bleizahl (EBC 7.4/7.5) | nein (Summe) | mittel | Bleiacetat-Toxizität, α-Überschätzung bei Alterung |
| HSI (A275/A325) | nein (Alterung) | schnell | sorten-/lösungsmittelabhängig, kein absoluter α-Wert |
| GC/GC-MS Öl (EBC 7.12) | ja (Komponenten) | mittel–langsam | thermolabile Stoffe, Destillationsartefakte |
| NIRS | sekundär (modellgebunden) | sehr schnell | nur so gut wie Kalibrierung; keine Schiedsmethode |
| Bonitur | sensorisch/visuell | schnell | subjektiv; durch Algorithmen ergänzt (seit ~2020) |

---

## Bezug zu DoldenBlick

- **Erntefenster-Optimierung:** α-, Öl- und Cohumulon-Verläufe (HPLC/NIR) liefern die Datenbasis,
  um das DoldenBlick-Erntefenster aus `lebenszyklus-phaenologie-bbch.md` mit echter
  Inhaltsstoffreife zu verknüpfen — nicht nur BBCH/Optik. NIR-Schnellwerte am Feld/Wareneingang
  eignen sich besonders für eine künftige „Reife-/Erntereife"-Karte.
- **Qualitätskarten/Sortenfunktion:** α/β-Spannen, Cohumulon und Öl je Sorte (`sorten.md`) können
  als Soll-Korridore hinterlegt werden; gemessene NQF-/Laborwerte werden gegen diese Korridore
  eingefärbt (Über-/Unterschreitung).
- **Lager-/HSI-Tracking:** HSI als einfache, kostengünstige Kennzahl eignet sich für ein
  Alterungs-/Lager-Modul (Frische-Ampel), sortenspezifisch kalibriert.
- **Bewässerung/Stress → Qualität:** Trocken-/Hitzestress (`wasser-bewaesserung-stress.md`) wirkt auf
  α-, Öl- und Cohumulon-Ausbildung; DoldenBlick kann Bewässerungsentscheidungen mit erwarteten
  Qualitätsfolgen koppeln.
- **Herkunft/Zertifizierung:** Das Siegel-/NQF-System (Hopfenring, LfL, HVG) bietet strukturierte,
  partiebezogene Datenfelder (Anbaugebiet, Sorte, Erntejahr, Wassergehalt, Bonitur), die sich als
  Stammdaten/Metadaten in DoldenBlick-Partien integrieren lassen.

---

## Quellen

- Analytica-EBC, Hopfen-Methodenübersicht (7.x): https://brewup.eu/ebc-analytica/category/chemical-physical/hops-and-hop-products
- Analytica-EBC 7.7 (α-/β-Säuren per HPLC): https://brewup.eu/ebc-analytica/hops-and-hop-products/and-acids-in-hops-and-hop-products-by-hplc7/7.7
- Analytica-EBC 7.4 (Lead Conductance Value): https://brewup.eu/ebc-analytica/hops-and-hop-products/lead-conductance-value-of-hops-powders-and-pellets/7.4
- BrewUp News, Update Methode 7.4 (2019): https://dev.brewup.brewersofeurope.eu/news/updated-analytica-ebc-method-7-4-lead-conductance-value-of-hops-powers-and-pellets
- Modification of Analytica-EBC 7.7 (J. Inst. Brew. 2005): https://onlinelibrary.wiley.com/doi/pdf/10.1002/j.2050-0416.2005.tb00651.x
- Metrohm, α-Säuren nach EBC 7.4 (Konduktometrie, RSD): https://www.metrohm.com/en/applications/application-notes/aa-t-001-100/an-t-154.html
- Metrohm, NIRS-Mehrparameteranalyse Hopfen: https://www.metrohm.com/en/applications/application-notes/nahinfrarotspektroskopieannir/an-nir-130.html
- MEBAK R-300.12.110 (HSI): https://www.mebak.org/en/methode/r-300-12-110/hop-storage-index-hsi-in-whole-hops-and-hop-products/2619
- ASBC, Hop Storage Index (Nickerson & Likens, 1979): https://www.asbcnet.org/publications/journal/vol/abstracts/37-28.htm
- BarthHaas, „Hops don't like to get old, either" (HSI-Schwellen): https://www.barthhaas.com/ressources/blog/blog-article/hops-dont-like-to-get-old-either
- BarthHaas, HSI sortenspezifisch bewerten: https://www.barthhaas.com/ressources/blog/blog-article/how-can-the-hsi-be-correctly-assessed-for-brewing-purposes
- Virginia Tech, HSI-Interpretation (% Verlust = Steigung × log): https://www.hops.fst.vt.edu/Understanding.htm
- Hopsteiner, Einfluss des Pflücktermins auf den Initial-HSI: https://cdn.hopsteiner.de/assets/cdn/service/technical_information_and_support/technical-publications/2013-06_influence-of-picking-date-on-the-initial-hop-storage-index-of-freshly-harvested-hops_cocuzza-et-al_mbaa.pdf
- Headspace-Trap-GC/MS vs. EBC-Öl-Methode (J. Agric. Food Chem.): https://pubs.acs.org/doi/10.1021/jf205002p
- Quantification of α-Acids by RP-HPLC (ACS Omega): https://pubs.acs.org/doi/10.1021/acsomega.9b00016
- Verband Deutscher Hopfenpflanzer, Hopfenzertifizierung: https://www.deutscher-hopfen.de/contentserv/hopfenpflanzerverband.de/index.php?StoryID=2113
- Hopfenring e. V., Qualitätssicherung/NQF: https://www.hopfenring.de/leistung/qualitaetssicherung/
- LfL, Richtlinien für die Bonitur getrockneter Hopfendolden (PDF): https://www.lfl.bayern.de/mam/cms07/publikationen/daten/informationen/p_38992.pdf
- LfL, Institut für Pflanzenbau/Pflanzenzüchtung – Hopfen (Hüll): https://www.lfl.bayern.de/ipz/hopfen/
- LfL, Sicherung der Hopfenqualität durch optimale Konditionierung (PDF): https://www.lfl.bayern.de/mam/cms07/ipz/dateien/hopfen_optimale_konditionierung.pdf
