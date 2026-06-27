# HopfenBlick — Konzeptbericht (Markdown-Fassung)

> Vollständige Textfassung des Konzeptberichts aus `report/report.html` (Quelle der
> gerenderten PDF `deliverables/HopfenBlick_Report.pdf`). Diese Datei dient als leicht
> durchsuchbare Referenz; **maßgeblich** bleibt `report/report.html`. Bei inhaltlichen
> Änderungen dort bitte hier mitziehen. Abbildungen sind als Verweise notiert.

**Konzeptstudie · Juni 2026**
**HopfenBlick — Abendlicher Feld-Check für die Hallertau**
**Webbasiertes Feld-Dashboard für den Hopfenbau in der Hallertau**

Wie sich offene Satelliten-, Wetter- und Geodaten zu einem täglichen Feld-Check
bündeln lassen, der auch für nicht-technische Betriebe nutzbar ist – aufgesetzt auf
einer OpenMapTiles-Karte.

| | |
|---|---|
| **Region** | Hallertau (Bayern) – größtes Hopfenanbaugebiet der Welt, rund 17.000 ha |
| **Datengrundlage** | DWD, Open-Meteo, LfL Bayern, Copernicus/Sentinel, Bayer. Vermessungsverwaltung |
| **Kartenbasis** | OpenMapTiles / MapLibre, ergänzt um offene Fachebenen |

*Entwurf einer Konzeptstudie · enthält gestaltete Konzept-Mockups (keine Echtdaten) ·
vollständige Quellenübersicht im Anhang.*

---

## Zusammenfassung
*Worum es geht und was empfohlen wird – auf einer Seite.*

Ziel ist ein webbasiertes Dashboard, das einem Hopfenbetrieb in der Hallertau jeden
Abend in einfacher Sprache zeigt, was heute passiert ist und was morgen ansteht. Die
Leitidee ist bewusst kein „Kartenprogramm mit vielen Ebenen", sondern ein
**abendliches Briefing**: oben stehen wenige Statuskarten nach dem Ampelprinzip mit je
einer konkreten Empfehlung, darunter liegt die Karte zur Verortung.

Die Studie fasst drei Bausteine zusammen: (1) welche Datenebenen aus Google Earth
Engine (GEE) bzw. Satellitendaten im Hopfenbau sinnvoll sind – und wo ihre Grenzen
liegen; (2) den Aufbau des Abend-Dashboards mit sechs Entscheidungskarten; (3) einen
Stapel offener Datenquellen (Open-Meteo, DWD über Bright Sky, LfL Bayern, Sentinel,
bayerische Geobasisdaten), der den Betrieb ohne teure Lizenzen versorgt.

> **KERNEMPFEHLUNG**
> Vorhandene, lokal anerkannte Dienste bündeln statt sie nachzubauen: Der
> **Peronospora-Warndienst der LfL** und die amtlichen **DWD-Warnungen** sind die
> Vertrauensanker. Daten sollten in Entscheidungen übersetzt werden („morgen 06–10 Uhr
> gutes Spritzfenster"), nicht als Rohwerte. Satellitendaten eignen sich zum
> **regionalen Screening**; für teilflächengenaue Aussagen bleiben Drohnen und der Gang
> in den Bestand maßgeblich.

---

## 1. Kontext: Hopfenbau in der Hallertau
*Betriebsgrößen, Anbau und rechtlicher Rahmen prägen, welche Funktionen ein Dashboard braucht.*

### Anbau und Betriebsstruktur
Die Hallertau ist mit rund 17.000 ha das größte zusammenhängende Hopfenanbaugebiet der
Welt. Die Betriebe sind überwiegend Familienbetriebe; die mittlere Hopfenfläche liegt
grob bei 13–20 ha (2020 rund 19,5 ha), die Spanne einzelner Betriebe reicht von etwa 5
bis über 100 ha, meist auf mehrere Schläge rund um die Heimatgemeinde verteilt. Der
Hopfen wächst an rund **7 m hohen Gerüsten**; geerntet wird ab Ende August über etwa
drei Wochen (Größenordnung 1 ha pro Tag). Der Wasserbedarf in der Hauptwachstumszeit
liegt bei rund 100 mm pro Monat (Juni–August). Verbreitete Sorten sind u. a. Herkules,
Hallertau Mittelfrüh und Perle.

### Zentrale Risiken
Das größte Ertragsrisiko sind **Trockenheit und Hitze** (ausgeprägt etwa 2015, 2018,
2022). Besonders sensibel ist die **Doldenentwicklung im Juli/August**: Sie entscheidet
über Ertrag und über die Alpha-Säure-Qualität. Hinzu kommen Pilzkrankheiten – allen
voran die Peronospora (Falscher Mehltau) – sowie Wetterereignisse wie Spätfrost, Sturm
und Hagel. Daraus ergeben sich die Themen, die ein Abend-Dashboard abdecken sollte:
Wetter/Warnungen, Spritzfenster, Krankheitsdruck, Bewässerung, Bestandsauffälligkeiten
und Entwicklungsstand.

### Rechtlicher Rahmen (Auswahl)
Für Düngung, Pflanzenschutz und Bewässerung gelten u. a.:
- **Düngeverordnung (DüV):** betrieblicher Höchstwert von 170 kg N/ha aus organischer
  Düngung, Sperrfristen, keine Ausbringung auf wassergesättigten, gefrorenen oder
  schneebedeckten Böden, Dokumentation (Düngebedarfsermittlung).
- **Gewässerschutz:** Mindestabstände zu Gewässern (u. a. 3-m-Streifen nach
  GAP-Konditionalität), Bodenbedeckung (GLÖZ), Auflagen in Wasserschutzgebieten.
- **Aktuelle Rechtslage „rote Gebiete":** Das Bundesverwaltungsgericht hat am
  24.10.2025 die bayerische Ausführungsverordnung (AVDüV) für unwirksam erklärt; die
  verschärften Vorgaben in den ausgewiesenen Nitrat-Gebieten sind damit in Bayern
  derzeit ausgesetzt. Eine bundesrechtliche Neuregelung steht aus – die Lage ist im
  Fluss und sollte beobachtet werden.
- **Bewässerung:** Wasserentnahmen sind genehmigungspflichtig; verfügbare Mengen hängen
  von der wasserrechtlichen Erlaubnis ab.
- **Integrierter Pflanzenschutz (IPS):** gesetzlich vorgegeben – ein Argument für
  entscheidungsunterstützende Warndienste.

> **HINWEIS**
> Die rechtlichen Angaben dienen der Orientierung und ersetzen keine Rechtsberatung.
> Gerade die Nitrat-Gebietskulisse ist in Bayern aktuell in Veränderung; ein Dashboard
> sollte solche Ebenen als „Stand/Quelle" kennzeichnen und nicht als verbindliche
> Auskunft.

---

## 2. Teil 1 – Datenebenen aus Google Earth Engine
*Welche Satelliten- und Klimadaten zu welcher betrieblichen Frage passen – einschließlich ihrer Auflösungsgrenzen.*

> **EINORDNUNG VORAB**
> GEE eignet sich für **regionale, zeitliche und screening-artige** Auswertungen, nicht
> für teilflächengenaue Aussagen im Hopfen. Ein Sentinel-2-Pixel (10 m) mischt auf einem
> 7-m-Gerüst Laubwand, Fahrgassen und Schatten. Für Auffälligkeiten innerhalb eines
> Schlags sind **Drohnen** klar überlegen. GEE liefert die „große Linie", nicht den
> Einzelstock.

### Wasserhaushalt & Hitze
Für Trockenstress und Hitze eignen sich Klimareanalysen wie **ERA5-Land** (täglich,
~9 km), thermische **Landsat**-Daten (Oberflächentemperatur) sowie Trockenheitsindizes
(SPI/SPEI). Wichtig: Der populäre Verdunstungsdienst **OpenET ist auf die USA
beschränkt** und steht für Europa nicht zur Verfügung. Europäische
Verdunstungsprodukte (MODIS MOD16, PML_V2) liegen bei rund 500 m Auflösung – ein Pixel
entspricht damit grob einem ganzen Betrieb und ist für die schlagbezogene
Bewässerungssteuerung zu grob.

### Pflanzenvitalität & Phänologie
Für die Bestandsentwicklung ist **Sentinel-2** die Basis. Statt NDVI empfiehlt sich
**NDRE** (Red-Edge): Es sättigt in dichten Beständen weniger und differenziert dort
besser. Zur Wolkenmaskierung eignet sich „Cloud Score+". Da Bayern wolkenreich ist, ist
**Sentinel-1** (Radar, wetterunabhängig) eine wertvolle Ergänzung, um auch bei
Bewölkung Zeitreihen zu erhalten.

### Gelände & Boden
Zur Geländeanalyse (Hangneigung, Kaltluft, Vernässung) reicht in GEE das **Copernicus
DEM (30 m)**; deutlich besser ist das bayerische **1-m-LiDAR-Geländemodell DGM1**
(außerhalb GEE, siehe Teil 2). Globale Bodendaten (SoilGrids, 250 m) sind grob;
belastbarer sind nationale/bayerische Bodenkarten und betriebseigene
Bodenuntersuchungen.

### Auflagen & Landbedeckung
Für Kontext und Kontrolle bieten sich **Dynamic World** und **ESA WorldCover** an. Das
EU-Flächenmonitoring (AMS) nutzt ohnehin Sentinel-Daten zur Überprüfung von
GAP-Vorgaben – die gleiche Datengrundlage lässt sich für betriebliche
Plausibilitätschecks nutzen.

| Ziel | Empfohlene Datensätze (GEE) | Wichtige Einschränkung |
|---|---|---|
| Wasser/Hitze | ERA5-Land · Landsat (thermisch) · SPI/SPEI | OpenET nur USA; EU-ET ~500 m (zu grob für Schlagebene) |
| Vitalität | Sentinel-2 (NDRE) + Cloud Score+ · Sentinel-1 (Radar) | 10-m-Pixel mischt Laubwand/Gasse/Schatten |
| Gelände/Boden | Copernicus DEM 30 m · SoilGrids 250 m | DGM1 (1 m) und Bodenproben deutlich genauer |
| Auflagen | Dynamic World · ESA WorldCover | nur Kontext; ersetzt keine amtliche Kulisse |

> **ALTERNATIVEN ZU GEE**
> Für teilflächengenaue Beobachtung: **Drohnen**. Für punktgenaues Wetter am Standort:
> das **agrarmeteorologische Messnetz der LfL**. Für Gelände: **DGM1**. Für Boden:
> Bodenproben und amtliche Bodenkarten. Wer fully-open arbeiten will, kann Sentinel auch
> über die **Copernicus Data Space / openEO** verarbeiten statt über GEE.

---

## 3. Teil 2 – Das Dashboard-Konzept
*Ein Abend-Briefing für nicht-technische Betriebe: Ampelkarten mit klarer Empfehlung, darunter die Karte.*

### Leitidee: Abend-Briefing statt Ebenen-Programm
Ein nicht-technischer Betrieb möchte abends keine Indexwerte interpretieren. Er möchte
Antworten auf wenige Fragen: Ist der Bestand in Ordnung, kommt heute Nacht etwas, kann
ich morgen spritzen, muss ich bewässern, steigt der Krankheitsdruck, wie weit ist die
Entwicklung? Deshalb steht oben ein Stapel **Statuskarten nach dem Ampelprinzip**
(grün/gelb/rot) mit je einem Satz Empfehlung. Alle Auswertungen werden serverseitig
vorberechnet, sodass der Login sofort ein fertiges Bild zeigt. Die Karte dient der
Verortung, nicht der Analyse.

### Die sechs Entscheidungskarten
| Karte | Beantwortete Frage | Offene Datenquelle |
|---|---|---|
| Wetter & Warnungen | Frost, Hagel/Gewitter, Hitze, Wind heute Nacht / morgen? | Open-Meteo + amtliche DWD-Warnungen (Bright Sky) |
| Spritzfenster | Wann ist ein gutes Zeitfenster (Wind, Regen, ΔT)? | Open-Meteo (stündlich) |
| Krankheitsdruck | Wie hoch ist der Peronospora-Druck, Behandlung nötig? | LfL Peronospora-Warndienst (+ optionaler Zusatzindex) |
| Bewässerung | Wasserbilanz – bewässern oder nicht? | Open-Meteo ET₀×Kc − RADOLAN-Regen − Bodenfeuchte |
| Feld-Check | Gibt es auffällige Schläge im Satellitenbild? | Sentinel-1/2 (GEE oder Copernicus Data Space) |
| Wachstum & Ernte | Entwicklungsstand und Erntefenster? | Gradtage/Phänologie aus Open-Meteo + DWD |

> **Abbildung — Mockup 1 · Desktop** (`report/img/m1_overview_doc.jpg`)
> *Abend-Übersicht.* Begrüßung, Tageszusammenfassung („2 Hinweise für morgen") und sechs
> Statuskarten; rechts die Karte mit den eigenen Schlägen, einem auffälligen Schlag und
> der 7-Tage-Vorhersage. Jede Karte nennt ihre Datenquelle.

**Derselbe Check am Telefon** (Mockup 2 · Mobil, `report/img/m2_mobile_doc.jpg`)
Viele Betriebe schauen abends auf dem Hof oder vom Schlepper aufs Handy. Die mobile
Ansicht zeigt zuerst die wichtigste Zusammenfassung („2 Hinweise für morgen") und
darunter dieselben Ampelkarten in kompakter Form. Große Schaltflächen, einfache Sprache,
die eigenen Schläge bereits geladen.

Wichtig ist eine kleine Ergänzung zum reinen Abend-Login: Für Dinge, die nicht warten
können – Nachtfrost, Hagelwarnung, ein sich öffnendes Spritzfenster – sollte zusätzlich
eine **Push-/E-Mail-Benachrichtigung** möglich sein. Der tägliche Blick bleibt das
Ritual, die Warnung erreicht den Betrieb auch dazwischen.

Die Gestaltung übersetzt Fachwerte konsequent in Klartext: nicht „NDRE", sondern
„Vitalität: auffällig"; nicht „ET₀-Defizit", sondern „Boden trocknet ab – Schlag 3
prüfen".

### Die Karte: kombinierbare offene Ebenen
Als Basis dient OpenMapTiles/MapLibre. Die eigenen Schläge stammen aus dem
**iBALIS-/Mehrfachantrag-Export** oder der offenen InVeKoS-Feldstückkarte (wie der
Betrieb sie anlegt, behandelt Kapitel 4); die offene ALKIS-Parzellarkarte (Rasterbild)
dient als Hintergrund. Darüber lassen sich offene Fachebenen schalten: Geländerelief
(DGM1) für Drainage, Kaltluft und Erosion, das Niederschlagsradar (RADOLAN), Warn- und
Schutzgebietsflächen für die Einhaltung von Auflagen sowie die Satelliten-Vitalität
(Sentinel).

> **Abbildung — Mockup 3 · Kartenansicht** (`report/img/m3_map_doc.jpg`)
> *Kartenansicht.* Links die schaltbaren Ebenen mit benannter Datenquelle, in der Karte
> die Schläge (Reihen-Motiv), eine Wasserschutz-Fläche, das Niederschlagsradar und ein
> ausgewählter Schlag mit Detail-Karte (NDRE-Verlauf, Empfehlung). Unten der
> Radar-Zeitregler.

### Der offene Datenstapel
Der Betrieb lässt sich ohne teure Lizenzen versorgen. Zu beachten sind allerdings die
jeweiligen Nutzungsbedingungen – insbesondere die Unterscheidung zwischen freier
nicht-kommerzieller Nutzung und einem kommerziellen Produkt.

| Quelle | Inhalt / Nutzen | Lizenz & Zugang |
|---|---|---|
| Open-Meteo | Vorhersage, ET₀ (FAO-56), Bodenfeuchte mehrerer Tiefen, Ensemble/Wahrscheinlichkeiten; Modelle bis ~2 km (ICON-D2) | Open Source, frei & ohne Schlüssel für nicht-kommerzielle Nutzung; kommerziell kostenpflichtig oder selbst hosten |
| DWD über Bright Sky | Amtliche Warnungen, Niederschlagsradar (RADOLAN), Niederschlagswahrscheinlichkeiten – als bequeme JSON-API | Frei nutzbar; es gelten die Nutzungsbedingungen des DWD; selbst hostbar |
| LfL Bayern (wetter-by.de) | ~130 agrarmeteorologische Stationen; **Peronospora-Warndienst** (hopfenspezifisch, Sporenfallengärten); Bewässerungsservice; ISIP | Daten kostenfrei abrufbar; ISIP für bayerische Betriebe kostenlos; Weiterverbreitung in einer App ggf. mit LfL abzustimmen, teils iBALIS-Zugang |
| Bayer. Vermessungsverwaltung | DGM1 (1 m), DOP40-Orthofotos, ALKIS-Parzellarkarte (Rasterbild), tatsächliche Nutzung | Open Data seit Jan. 2023; auch kommerziell mit Namensnennung; Vektor-Flurstücke kostenpflichtig, Grenzen nicht veränderbar |
| Copernicus / Sentinel | Sentinel-1 (Radar) & Sentinel-2 (NDRE) für Bestands-Auffälligkeiten | Offene Copernicus-Daten; Verarbeitung über GEE oder Copernicus Data Space / openEO |

### Architektur in Kürze
Ein geplanter Job (nächtlich plus einige Aktualisierungen tagsüber) holt Open-Meteo,
Bright Sky, den LfL-Warndienst und die Sentinel-Auswertung in einen Cache bzw. eine
kleine API. Das Frontend ist MapLibre + OpenMapTiles; Kacheln werden über tileserver-gl
bzw. TiTiler bereitgestellt. Für nicht aufschiebbare Ereignisse gibt es Push-/E-Mail-
Benachrichtigungen. Da Open-Meteo und Bright Sky quelloffen sind, lassen sie sich für
einen kommerziellen Betrieb auch selbst hosten.

---

## 4. Felder anlegen: vom Mehrfachantrag ins Dashboard
*Das Anlegen der Schläge ist die größte Einstiegshürde – der Betrieb sollte daher nichts neu zeichnen müssen, sondern vorhandene Geometrien importieren.*

### Die richtige Datengrundlage – Agrar- statt Liegenschaftskataster
Vorab eine wichtige Klarstellung: Das **Liegenschaftskataster (ALKIS)** ist in Bayern
ein Sonderfall. Anders als in den meisten Bundesländern sind die Vektor-Flurstücke hier
**nicht** frei; als OpenData steht nur die ALKIS-Parzellarkarte als **Rasterbild ohne
Flurstücksnummern** bereit (zusammen mit DOP40-Luftbildern und DGM1, meist unter
CC BY 4.0). Als Auswahl- und Hintergrundebene ist das nützlich, als Datenquelle für
„meine Felder" jedoch nicht das Richtige.

Die passende Grundlage ist das **Agrar-**, nicht das Liegenschaftskataster: die
Feldstücke und Schläge aus dem Agrarförderantrag (InVeKoS). Diese werden von den
Bundesländern EU-rechtlich verpflichtend (VO (EU) 2021/2116, Art. 67 Abs. 3) als
OpenData veröffentlicht – anonymisiert und jährlich aktualisiert, u. a. als
„Feldstückskarte Bayern" über das Bundesportal der Agrar-Geodaten. Das sind echte
Bewirtschaftungsgrenzen, nicht Eigentumsparzellen.

### Empfohlener Weg (gestaffelt nach Aufwand)
| Methode | Für wen | Quelle / Format |
|---|---|---|
| **iBALIS-Export hochladen** · empfohlen | jeder bayerische Betrieb | eigene Feldstücke als Shape-ZIP aus iBALIS (UTM32) |
| Auf der Karte antippen | wer keine Datei mag | offene InVeKoS-Feldstückkarte über DOP40-Luftbild |
| Aus Schlagkartei importieren | Nutzer von Farm-Software | 365FarmNet, NEXT, FARMDOK … (Shape / ISO-XML) |
| Manuell zeichnen / GPS | Neuanlagen | im Luftbild zeichnen oder Fläche abfahren |

Der **iBALIS-Export** ist der Goldstandard: Jeder Betrieb pflegt seine Feldstücke
ohnehin für den Mehrfachantrag und kann sie selbst als Shape-ZIP herunterladen
(„Betriebsinformationen → Datenexport → Eigene Flächendaten exportieren"). Die
Geometrien sind exakt, aktuell und kommen mit den Namen/Nummern, die der Betrieb kennt –
und es ist datenschutzrechtlich sauber, weil der Landwirt *seine eigenen* Daten liefert;
ein Zugriff auf sein iBALIS-Konto ist nicht nötig. Genau diesen Weg nutzen auch gängige
Schlagkartei-Programme zur Anbindung.

> **Abbildung — Mockup 4 · Onboarding** (`report/img/m4_onboarding_doc.jpg`)
> *Felder anlegen.* Vier Wege zur Auswahl (iBALIS-Export empfohlen), rechts die
> bebilderte Schritt-für-Schritt-Anleitung für den Export, eine Ablagefläche für die
> Datei und die Vorschau der erkannten Schläge.

> **WICHTIGER FACHLICHER HINWEIS**
> Flurstück ≠ Feldstück ≠ berankte Hopfenfläche. Das Liegenschafts-Flurstück ist die
> Eigentumseinheit (oft mehrere je Schlag, zu kleinteilig); das iBALIS-/InVeKoS-Feldstück
> ist die richtige Ebene; doch selbst dieses enthält Vorgewende, Wege und Randstreifen,
> die eine Satellitenauswertung (NDRE) je Schlag verwässern. Empfehlung: **importieren
> und anschließend editierbar lassen** – Schlag benennen, Sorte zuordnen und für die
> Satellitenauswertung optional auf die eigentliche Gerüstfläche zuschneiden. iBALIS
> selbst erlaubt ebenfalls den Import externer Geometrien und die Prüfung gegen das
> aktuelle Luftbild – „Import und Nachbearbeiten" ist also der etablierte Arbeitsablauf.

---

## 5. Grenzen & offene Punkte
*Eine nüchterne Einordnung der Risiken und Annahmen – bewusst ohne Dramatisierung.*

### Lizenzen klären, bevor man baut
Open-Meteo und Bright Sky sind nicht-kommerziell frei; für ein kostenpflichtiges Produkt
braucht es die kommerzielle Stufe oder Selbst-Hosting. Bayerische Geobasisdaten sind
kommerziell nutzbar (mit Namensnennung), Flurstücksgrenzen aber nicht veränderbar.
LfL-Daten sind frei einsehbar; eine Weiterverbreitung in einer eigenen App kann eine
Abstimmung erfordern, und Teile des Angebots sind über iBALIS zugangsgeschützt. Eine
kurze Anfrage bei der LfL vor dem Aufbau ist sinnvoll.

### Vorhersagegüte realistisch darstellen
Lokale Gewitter, exakte Hagelorte und genaue Frostminima sind auch mit hochauflösenden
Modellen unsicher. Das Dashboard sollte **Wahrscheinlichkeiten** bzw. Ensemble-
Spannweiten zeigen und auf alarmierende Zuspitzungen verzichten – das schützt die
Glaubwürdigkeit.

### Krankheitsindex ist Ergänzung, nicht Ersatz
Ein selbst gerechneter Peronospora-Index aus offenen Wetterdaten kann zwischen den
amtlichen Aktualisierungen einen Hinweis geben. Entscheidungsgrundlage bleiben der
**LfL-Warndienst bzw. ISIP**. Eine Überhöhung des eigenen Index wäre fachlich riskant.

### Triage, kein Ersatz für den Bestand
Das Dashboard sagt, **wo man hinschauen** sollte – es ersetzt nicht den Gang in den
Hopfengarten. Diese Rahmung sollte im Produkt spürbar sein.

### Abhängigkeit von Schnittstellen
APIs ändern sich. Eine schlanke Cache-/Zwischenspeicher-Schicht macht das Dashboard
robuster gegen Ausfälle und Änderungen einzelner Dienste.

> **GRÖSSTES AKZEPTANZRISIKO**
> Nicht die Daten, sondern die Gewohnheit: Betriebe geben bewährte Werkzeuge (LfL,
> Hopfenring) nicht auf. Das Dashboard sollte daher **ergänzen statt konkurrieren**,
> Reibung minimieren (ein Bildschirm, deutsch, eigene Schläge vorgeladen) und durch
> sichtbare Quellenangaben (DWD, LfL) Vertrauen schaffen.

---

## Anhang · Datenquellen-Übersicht
*Einstiegspunkte zu den genannten offenen Diensten (Stand Juni 2026).*

| Dienst | Inhalt | Einstieg |
|---|---|---|
| Open-Meteo | Wetter, ET₀, Bodenfeuchte, Ensemble | open-meteo.com |
| Bright Sky | DWD-Daten als JSON (Warnungen, Radar) | brightsky.dev |
| DWD Open Data | ICON-D2, RADOLAN, Warnungen (Rohdaten) | opendata.dwd.de |
| LfL Agrarmeteorologie | Stationsnetz, Vorhersage, Bewässerungsservice | wetter-by.de |
| LfL Peronospora-Warndienst | Hopfenspezifischer Befallsdruck | lfl.bayern.de/ipz/hopfen |
| ISIP | Wetterbasierte Prognosemodelle (für bayer. Betriebe kostenlos) | isip.de |
| iBALIS (Bayern) | Mehrfachantrag; Export eigener Feldstücke als Shape | stmelf.bayern.de/ibalis |
| InVeKoS-Geodaten (offen) | Feldstückkarte / Agrarförderflächen der Länder | gdi.bmleh.de |
| Bayer. Vermessungsverwaltung | DGM1, DOP40, ALKIS-Parzellarkarte als Rasterbild (Open Data) | geodaten.bayern.de/opengeodata |
| Copernicus Data Space | Sentinel-Daten & Verarbeitung (openEO) | dataspace.copernicus.eu |
| Google Earth Engine | Cloud-Verarbeitung von Erdbeobachtungsdaten | earthengine.google.com |
| EuroCrops | Harmonisierte EU-Anbaudaten (Kontext) | eurocrops.tum.de |

> **ZU DEN MOCKUPS**
> Die abgebildeten Ansichten sind gestaltete Konzept-Entwürfe mit Beispielwerten
> (fiktiver Betrieb „Familie Huber", Au i.d.Hallertau). Sie zeigen Aufbau und
> Bedienlogik, nicht echte Messdaten. Produktname „HopfenBlick" und Gestaltung dienen
> ausschließlich der Veranschaulichung.

---

## Anhang B · Design-/Farbschema des Berichts

Aus dem `<style>`-Block von `report/report.html` (deckt sich weitgehend mit den globalen
HopfenBlick-Tokens in `REFERENCE.md` §3):

**Typografie**
- Fließtext: `Barlow`, 10,5 pt, Zeilenhöhe 1,5, Textfarbe `#1d2a22`.
- Display/Überschriften: `Barlow Semi Condensed` (600/700).
- Größen: Cover-Titel 33 pt · Section-`h1` 21 pt · `h2` 14,5 pt · `h3` 11 pt · Tabellen 9,5 pt.
- Links: `#255d97`.

**Farben (berichtsspezifisch)**
| Element | Farbe |
|---|---|
| Cover-Band-Gradient | `#1c3f2c` → `#2f6b4a` |
| Cover-Titel | `#1c3f2c` |
| Eyebrow / Kicker / Section-Nummer | Gold `#c8902a` |
| Section-`h1` | `#234f37` |
| `h3` / Meta-Labels | Marke grün `#2f6b4a` |
| Section-Lead / Sekundärtext | `#5d6f64` |
| Tabellenkopf-Hintergrund | `#eef3ee`, Text `#234f37`, Rahmen `#cdd9cd` |
| Tabellenzeilen-Rahmen | `#e9ede8` |
| Hinweis-Box (Standard) | Fläche `#eef3ee`, linke Kante `#2f6b4a`, Label `#2f6b4a` |
| Hinweis-Box „warn" | Fläche `#f9efd9`, linke Kante `#d9962a`, Label `#a9701a` |
| Abbildungs-Rahmen | `#e4e8e3`, Caption `#6b7d72` |

**Layout-Muster**
- Hinweis-Boxen (`.note` / `.note.warn`) = farbige linke Kante + getönte Fläche + Label.
- Abbildungen: Bild mit feinem Rahmen + kursive Caption (fett-grünes Stichwort).
- Tabellen (`.dt`): grün getönter Kopf, erste Spalte (`.k`) fett in `#234f37`.
- Render-Pipeline: `report/report.html` → wkhtmltopdf → Seitenzahlen via
  `scripts/stamp_pages.py` (PyMuPDF) → `deliverables/HopfenBlick_Report.pdf`.
