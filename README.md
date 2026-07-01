# DoldenBlick

**Ein webbasiertes Feld-Dashboard für den Hopfenbau der Hallertau.**
Offene Satelliten-, Wetter- und Geodaten, gebündelt zu einem täglichen Feld-Check,
der auch für nicht-technische Betriebe nutzbar ist.

> **Live unter [doldenblick.de](https://doldenblick.de).** Aus der Konzeptstudie ist ein
> laufendes Produkt geworden: ein MapLibre-Frontend mit drei schlanken Backend-Diensten und
> passwortlosem Onboarding. Die ursprünglichen **Mockups** und der **Konzeptbericht** (PDF)
> bleiben als Design- und Inhaltsgrundlage erhalten (`mockups/`, `report/`, `deliverables/`).

## Vorschau

| Übersicht (Desktop) | Karte / Ebenen |
|---|---|
| ![Übersicht](report/img/m1_overview_doc.jpg) | ![Karte](report/img/m3_map_doc.jpg) |

| Mobil | Onboarding (Felder anlegen) |
|---|---|
| ![Mobil](report/img/m2_mobile_doc.jpg) | ![Onboarding](report/img/m4_onboarding_doc.jpg) |

Der vollständige Bericht liegt unter [`deliverables/DoldenBlick_Report.pdf`](deliverables/DoldenBlick_Report.pdf).

## Aufbau
Das Produkt ist bewusst in kleine, unabhängige Teile geschnitten — der Browser zeigt an,
die Dienste rechnen und halten die Daten:

| Teil | Was | Stack |
|---|---|---|
| `app/` | Frontend: Übersicht + Onboarding-Wizard | Vite · TypeScript · MapLibre |
| `api/` | Wasserbilanz (FAO-56), zustandslos | Fastify · TypeScript |
| `rs/` | Satelliten-Feld-Check (Sentinel-2) | Fastify · CDSE |
| `accounts/` | Passwortlose Identität + Onboarding | Fastify · Postgres |
| `infra/` | Deploy, systemd, nginx, Härtung, Secrets-Sync | Bash · nginx · systemd |

Alle Dienste laufen auf einem gehärteten Hetzner-Server hinter nginx (same-origin `/api/*`);
Secrets kommen aus selbstgehostetem **Infisical**, transaktionale E-Mail aus **Postmark**.
Details in [`REFERENCE.md`](REFERENCE.md) und [`docs/infrastructure.md`](docs/infrastructure.md).

## Konzept-Grundlage
- `mockups/` — vier Bildschirm-Entwürfe als eigenständiges HTML (Übersicht, Mobil, Karte, Onboarding).
- `report/` — Quelle des Berichts (`report.html`) plus Bilder in `report/img/`.
- `deliverables/` — gerenderte Ausgaben (PNG der Mockups, PDF des Berichts).
- `scripts/stamp_pages.py` — setzt Seitenzahlen ins PDF.
- `build.sh` — baut Mockups + Bericht neu.

## Entwicklung
Die **App** lokal starten (`cd app && npm install && npm run dev`) — Details, Skripte und die
Backend-Dienste stehen in [`app/README.md`](app/README.md), [`api/README.md`](api/README.md)
und [`accounts/README.md`](accounts/README.md). Deployment: die Skripte unter `infra/`.

## Konzept bauen (Mockups + Bericht)
Voraussetzungen:
- `wkhtmltopdf` (bringt `wkhtmltoimage` mit) — siehe https://wkhtmltopdf.org
- `python3` mit `pymupdf` und `pillow`:  `pip install pymupdf pillow`
- `fontconfig` und `curl`

Dann:
```bash
./build.sh
```
Das Skript lädt die Schrift **Barlow** (SIL Open Font License), rendert die Mockups
nach `deliverables/*.png` und den Bericht nach `deliverables/DoldenBlick_Report.pdf`.

> Hinweis zur Engine: `wkhtmltoimage`/`wkhtmltopdf` nutzt eine ältere WebKit-Engine.
> Beim Bearbeiten der Mockups gelten daher CSS-Einschränkungen (kein Flexbox/Grid,
> absolute Positionierung, inline SVG). Details in [`CLAUDE.md`](CLAUDE.md).

## Datenquellen (Konzept)
Open-Meteo · DWD (über Bright Sky) · LfL Bayern (Agrarmeteorologie & Peronospora-Warndienst) ·
Copernicus/Sentinel · bayerische Geobasisdaten (DGM1, DOP40, ALKIS-Parzellarkarte) ·
iBALIS / InVeKoS-Feldstückkarte für den Feld-Import. Quellen und Lizenzhinweise stehen
im Bericht (Kapitel 3, 4 und Anhang).

## Status & nächste Schritte
Frontend, Backend-Dienste und passwortloses Onboarding laufen live. Als Nächstes:
Peronospora-Warndienst und ein Wachstums-/Erntefenster-Modell als eigene Live-Karten,
Onboarding vertiefen (Gerüstfläche zuschneiden, InVeKoS-Feldstücke antippen) und das
abendliche Push-/E-Mail-Briefing. Die laufende Liste steht in [`TODO.md`](TODO.md).

## Lizenz
Dieses Projekt steht unter der **GPL-3.0** (siehe [`LICENSE`](LICENSE)). Gesondert zu
beachten: Die Schrift **Barlow** steht unter der **SIL OFL**; die genannten
**Datenquellen** (DWD, Open-Meteo, LfL, Copernicus, bayerische Geobasisdaten, iBALIS/InVeKoS)
haben jeweils **eigene Nutzungsbedingungen**, die unabhängig von der Projektlizenz gelten.

---
*DoldenBlick ist ein Arbeitstitel; Gestaltung und Beispielwerte dienen der Veranschaulichung.*
