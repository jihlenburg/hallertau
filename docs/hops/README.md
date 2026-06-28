# Hopfen-Wissensbasis — DoldenBlick

Recherchierte, webverifizierte Fachreferenz zum Hopfenanbau (Humulus lupulus) in der Hallertau,
als Grundlage für die agronomische Mathematik von DoldenBlick (Wasserbilanz, Krankheitsdruck,
Phänologie/GTS, Qualität). Sprache Deutsch; lateinische Namen kursiv. Jede Datei hat einen
`## Quellen`-Block und einen `## Bezug zu DoldenBlick`-Abschnitt.

> **Stand:** 2026-06-28 · Erstellt durch eine Recherche-Schwarm-Auswertung (web-verifiziert),
> anschließend von Fach-Lektor-Agenten gegengeprüft. Offene Konsistenzpunkte siehe unten.

## Dateien

**Grundlagen**
- [`physiologie-morphologie.md`](physiologie-morphologie.md) — Botanik, Wurzelstock/Bines/Dolde, Lupulin, Alpha-/Beta-Säuren, Diözie.
- [`lebenszyklus-phaenologie-bbch.md`](lebenszyklus-phaenologie-bbch.md) — Jahreszyklus, Photoperiodik, BBCH-Skala, Gradtagsumme (GTS).
- [`anbau-kultur.md`](anbau-kultur.md) — Gerüst, Boden, Düngung, Anleiten, Ernte, Darrung.
- [`sorten.md`](sorten.md) — Hallertauer Sorten: Alpha, Aroma, Reifezeit, Resistenz.
- [`hallertau-region.md`](hallertau-region.md) — Region, Klima, Böden, Institutionen, Recht.

**Pflanzenschutz**
- [`krankheiten.md`](krankheiten.md) — Peronospora, Echter Mehltau, Verticillium, Viroide (CBCVd).
- [`schaedlinge.md`](schaedlinge.md) — Hopfenblattlaus, Spinnmilbe, IPS-Schwellen.

**Wasser**
- [`wasser-bewaesserung-stress.md`](wasser-bewaesserung-stress.md) — Wasserbedarf, FAO-56-Kc, nFK/TAW/RAW, Trocken-/Hitze-/Froststress. *(Kern der Wasserbilanz-Mathematik.)*

**Qualität**
- [`qualitaet-kennzahlen.md`](qualitaet-kennzahlen.md) — Parameter & Wertebereiche (Alpha/Beta, Öl, Thiole, Xanthohumol, HSI, Feuchte, Reinheit).
- [`qualitaet-analytik.md`](qualitaet-analytik.md) — Messverfahren & Normen (HPLC/EBC, Leitwert, HSI, GC-MS, NIRS, Siegel/NQF).
- [`qualitaet-anbau-ernte.md`](qualitaet-anbau-ernte.md) — Qualitätssteuerung über Anbau & Erntezeitpunkt.
- [`qualitaet-nachernte-verarbeitung.md`](qualitaet-nachernte-verarbeitung.md) — Darrung, Pelletierung/Cryo, Extrakte, Lagerung/Oxidation.
- [`qualitaet-zucht-digital.md`](qualitaet-zucht-digital.md) — Züchtung (Hüll), Präzision/Fernerkundung, digitale/KI-Verfahren.

## Kanonische Modell-Parameter (Single Source of Truth)

Für die App-Mathematik **gelten diese Werte**; bei Abweichungen in Einzeldateien hat diese Tabelle Vorrang.

| Parameter | Kanonischer Wert | Quelle (Datei) |
|---|---|---|
| Wasserbedarf Hauptsaison | ~100 mm/Monat (Jun–Aug); Spitzen-ETc ~5–6 mm/d | wasser-bewaesserung-stress |
| Kc (FAO-56) | ini **0,30** · mid **1,05** · end **0,85** | wasser-bewaesserung-stress |
| Effektive Wurzeltiefe Zr (für Bilanz) | **1,0–1,2 m** (Default 1,0 m, Nutzer-Override) — *nicht* die physiolog. Maximaltiefe (~2,5–4,5 m) | wasser / physiologie |
| Entzugsfraktion p / Trigger | **p ≈ 0,5** → RAW = 0,5·TAW (Bewässerung bei ~50 % nFK) | wasser-bewaesserung-stress |
| nFK (Beispiel Lehm) | ~180 mm/m; TAW = nFK · Zr | wasser-bewaesserung-stress |
| GTS-Basistemperatur | **~5 °C**, Deckelung ~30 °C (modell-/sortenabhängig) | lebenszyklus-phaenologie-bbch |
| Wuchsrate / bis Gerüst | bis ~30 cm/Tag · ~70 Tage bis ~7 m (Ende Juni) | physiologie / lebenszyklus |
| **Peronospora — Infektionsfenster** | Blattnässe ≥ **1,5–2 h** bei 15–29 °C (Optimum ~15–21 °C); bei ~5 °C erst > 24 h; Triebinfektion 3 h Wasser bei 19–23 °C | krankheiten |
| **Peronospora — Sporulationsoptimum** | ~**20–22 °C**, < 5 °C vernachlässigbar (anderer Prozess als Infektion!) | hallertau-region |
| Peronospora — Bekämpfungsschwelle | ~3 % befallene Stöcke | hallertau-region |
| Hopfenblattlaus — Schwelle | vor Blüte 50/Blatt (Mittel) bzw. 200 (Einzelblatt); Flug ab ≥ 13 °C | schaedlinge |
| Spinnmilbe | heiß/trocken; Schätzschwelle ~50–100/Blatt (nicht eindeutig validiert) | schaedlinge |
| Alpha-Säuren | Aroma 3–5,5 % · Bitter 10–15 % · Superalpha 12–18 % w/w | sorten / qualitaet-kennzahlen |
| Gesamtöl | ~0,5–3,0 mL/100 g | qualitaet-kennzahlen |
| HSI (Lagerindex) | frisch ≤ ~0,30 · 0,33–0,40 leicht · 0,41–0,50 · 0,51–0,60 · > 0,61 überaltert | qualitaet-analytik |
| Restfeuchte (zweistufig) | **~8–10 % ab Darre → ~10–12 % konditioniert/Handel** | qualitaet-anbau-ernte |
| Erntereife | Trockensubstanz ~22–24 % (Richtwert 23 %), **nach** Alpha-Maximum | qualitaet-anbau-ernte |
| Darrtemperatur | ~60–65 °C | anbau-kultur / qualitaet-nachernte |
| Alpha-Synthese ab Ausdoldung | 4–6 Wochen (Aroma +25 d · Hochalpha +30 d · Herkules ~42 d) | qualitaet-anbau-ernte |

## Offene Konsistenzpunkte (von den Lektor-Agenten markiert)

Kleinere, noch zu vereinheitlichende Stellen (Inhalt korrekt, nur Darstellung divergiert):
1. **Peronospora-Temperatur** — Infektionsfenster (~15–21 °C) vs. Sporulationsoptimum (~20–22 °C) in `krankheiten.md`/`hallertau-region.md` explizit als zwei Prozesse kennzeichnen.
2. **Wurzeltiefe** — effektive Zr (Bilanz, 1,0–1,2 m) vs. physiolog. Maximaltiefe (2,5–4,5 m) einheitlich benennen.
3. **Magnum-Reifezeit** — `sorten.md` nennt einmal „früh", sonst „mittel–spät" (= `lebenszyklus`); korrigieren.
4. **Restfeuchte** — als zweistufig (ab Darre / konditioniert) darstellen, nicht als ein Zielwert.
5. **Humulen-Ölanteil** — `qualitaet-kennzahlen.md` (30–55 %) vs. `qualitaet-analytik.md` (20–25 %) an Primärquelle angleichen.
6. **`Titan` β/α-Spalte** in `qualitaet-zucht-digital.md` mischt Verhältnis und Prozentwert — korrigieren.
7. Tertiärquelle (Grokipedia) in `physiologie-morphologie.md` durch LfL/peer-reviewte Quelle ersetzen.
