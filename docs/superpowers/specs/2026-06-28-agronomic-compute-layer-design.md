# Spec: Shared Domain Package & Water-Balance Card (v2) — DoldenBlick

**Datum:** 2026-06-28 · **Status:** Entwurf zur Review (überarbeitet nach adversariellem Review) ·
**Sprache:** Deutsch (Code/Terms en)

**Beziehung zu bestehenden Dokumenten:** Erweitert (supersediert NICHT) das
`2026-06-28-multi-tenant-backend-design.md`; dessen **Phase 1** (Auth, Schläge-CRUD, RLS,
Frontend-Cutover) bleibt unverändert die Grundlage. **Faktenbasis:** die Hopfen-Wissensbasis unter
`docs/hops/` (kanonische Parameter in `docs/hops/README.md`) und die GEE-Datenquellen-Recherche
(Workflow-Auswertung 2026-06-28; deren Kernzahlen sind hier und in der Kanontabelle gespiegelt).

> **Architektur-Update (2026-06-28, Nutzerentscheidung):** **Strong Separation of Concerns.**
> Der **Client** macht nur Präsentation + Kartenkacheln (Tiles bleiben client-seitig, direkt vom
> Tile-CDN mit Namensnennung). **Alle Datenquellen UND alle Berechnungen laufen im Backend** (BFF):
> der Client ruft ausschließlich same-origin `/api/*` und rendert. Damit ist die Compute-Schicht
> **nicht mehr gegated** — sie wird gebaut. **Erste Scheibe:** ein **zustandsloser** Wasserbilanz-
> Compute-Dienst (`api/`, Fastify) — holt Open-Meteo server-seitig, rechnet die FAO-56-Bilanz über
> das verfügbare `past_days`-Fenster (Init Feldkapazität am Fensteranfang; kein DB-State nötig).
> Multi-Tenant-Persistenz (Postgres/Auth/RLS) bleibt die separate Backend-Phase-1; der erste
> Compute-Dienst braucht sie nicht. Die Domänen-Mathematik lebt damit **server-seitig in `api/`**
> (nicht mehr im Client) — kein geteiltes Paket nötig, da der Client nicht mehr rechnet.

> **Revisions-Hinweis:** Diese Fassung folgt einem Vier-Linsen-Review (Konsistenz, Architektur-
> Devil's-Advocate, FAO-56-Korrektheit, Spec-Hygiene). Wesentliche Korrekturen: (a) die schwere
> Server-Compute-Schicht ist **gegated**, nicht „jetzt"; (b) „verbatim-Port" gilt nur für die
> unveränderten Module — die Wasserbilanz wird **neu** geschrieben; (c) FAO-56 **Ks** ergänzt;
> (d) RLS-Muster der neuen Tabellen präzisiert; (e) Scope dieses Plans hart auf Schritt 1+2 gezogen.

---

## 1. Entscheidungs-Zusammenfassung

**Zielarchitektur (Vision):** Das Backend wird mittelfristig zur **agronomischen Ingest- & Compute-
Schicht** (geplante Jobs ziehen offene Quellen, rechnen je Schlag vorab, SPA = dünner Presenter) —
so wie es der Konzeptbericht beschreibt. **Aber:** dieser Schwerbau ist **bewusst gegated** (siehe
unten), nicht Teil dieses Plans.

**Was dieser Plan tatsächlich umfasst (jetzt):**
1. **Geteiltes Domänen-Paket** extrahieren — die bereits reinen Funktionen aus `app/src/domain/` in
   ein von Client (und später Server) gemeinsam genutztes Paket heben. Billig, **verbatim**, reversibel.
2. **Wasserbilanz v2** — die heutige speicherlose klimatische Bilanz durch ein **FAO-56-Wurzelraum-
   Tipping-Bucket mit persistentem Zustand** ersetzen. Läuft **client-seitig** (reine Funktion +
   persistenter `Dr` in der Schlag-Zeile via Phase-1-API bzw. `localStorage`-Cache). Bodendaten aus
   SoilGrids (einmaliger Lookup) + Override; Niederschlag aus Open-Meteo (bereits im Browser).

**Drei Beobachtungen — und was sie WIRKLICH erzwingen:**
1. **Server-only-Datenquellen** (GEE/Sentinel, RADOLAN-Radar, LfL) brauchen einen Server — **aber alle
   sind in v1 nicht nötig**: Wasserbilanz v1 nutzt Open-Meteo (heute schon im Browser) + einen
   einmaligen SoilGrids-Lookup. Diese Quellen treiben spätere Karten → sie rechtfertigen den Server,
   wenn diese Karten gebaut werden, nicht jetzt.
2. **Persistenter Zustand** (`Dr`-Carry-over) ist der einzige harte Neubedarf der Wasserbilanz — er
   braucht eine **Zeile** (Phase-1-Postgres liefert sie bereits, ersatzweise `localStorage`), **keinen**
   nächtlichen Worker. Re-Compute läuft client-seitig beim App-Öffnen über `past_days`-Warm-up.
3. **Reine Mathematik** portiert verbatim — **gilt für** `wetbulb/sprayWindow/weather/wmo/fields/grid`.
   Die **Wasserbilanz ist KEIN Port**, sondern eine Neuimplementierung (`computeWaterBalance` →
   `computeSoilWaterBalance`); `kc/soil/gdd/disease/harvest` sind **neue** Module.

**Gegating (löst Backend-Spec DA#1 „Nachfrage ist der Engpass, ~0 Nutzer" echt, nicht kosmetisch):**
- **Schritt 1 (Domänen-Paket)** ist sofort verteidigbar: billig, reversibel, kein Backend.
- **Schritt 2 (Wasserbilanz v2, client-seitig)** ist sofort verteidigbar: liefert eine echte Karte
  ohne Schwerbau.
- Die **Server-Compute-Schicht** (Worker/Scheduler, RADOLAN-Ingest, Object-Storage-Caches,
  Indikator-Tabellen, Dedupe je Rasterzelle) startet **erst NACH** Erreichen der in Backend-Spec §13
  gesetzten Schwelle (**≥10–20 wiederkehrende Nutzer**) **und** sobald eine Karte eine echte
  Server-only-Quelle braucht. Bis dahin ist sie **YAGNI**.

---

## 2. Scope

**In (dieser Implementierungsplan):**
- **Schritt 1:** Domänen-Paket extrahieren (Monorepo-Workspace), Tests mitziehen.
- **Schritt 2:** Wasserbilanz v2 (§8) — FAO-56-Bucket (rein, getestet); `kc`/`soil`-Module;
  SoilGrids-Soil-Lookup (einmalig, über Phase-1-API-Endpunkt oder Build-Skript) + Override;
  `fields`-Bodenspalten; persistenter `Dr`; Presenter in `overview`.

**Out (spätere, gegatete Specs/Pläne):** Server-Worker/Scheduler, RADOLAN-/LfL-/Sentinel-Ingest,
Object-Storage-Caches, Indikator-/Cache-Tabellen, untertägige Neuberechnung, Dedupe je Rasterzelle
(§6/§3 beschreiben die **Zielarchitektur**, gehören aber NICHT in diesen Plan); GTS/Phänologie,
Spritzfenster-/Wetter-Upgrades, Krankheits- und Satellitenkarte (eigene Folge-Specs, §9). Durability-
Harness (Backend-Spec §7, Phase 2) und Analytics-Views (Phase 3) bleiben unverändert out.

---

## 3. Architektur

**Jetzt (für diesen Plan):** unverändert die Backend-Phase-1-Topologie (nginx → api → Postgres/PostGIS,
same-origin, RLS) **plus** das geteilte Domänen-Paket im Frontend-Build. Kein Worker, kein neuer
Container. Die Wasserbilanz rechnet im Browser; `Dr` und Bodenparameter persistieren über die
Phase-1-`fields`-Tabelle (bzw. `localStorage`-Cache offline).

**Später (gegatete Zielarchitektur — Referenz, nicht Teil dieses Plans):** zusätzlicher **worker**-
Container (Scheduler) für Ingest + pro-Schlag-Compute, Object Storage für Roh-/Kachel-Caches (bereits
in Backend-Spec **§4** als Komponente vorgesehen; Durability dort §7). Erst bei Erreichen des
Nachfrage-Gates + echter Server-only-Quelle.

---

## 4. Geteiltes Domänen-Paket (Schritt 1 — der „jetzt"-Kern)

Die reinen Funktionen ziehen aus `app/src/domain/` in ein **geteiltes Paket** (npm-Workspace, z. B.
`packages/domain/`, importiert von `app/` und künftig `api/`). Eigenschaften: keine DOM-/Netz-/Storage-
Zugriffe; deterministisch (injizierbares `now`); per Vitest getestet.
- **Verbatim portiert** (unverändert, nur verschoben): `wetbulb`, `sprayWindow`, `weather`, `wmo`,
  `fields`, `grid`.
- **Neu / ersetzt in diesem Plan:** `waterBalance` (neu: FAO-56-Bucket, ersetzt das alte
  `computeWaterBalance`), `kc` (Kc-Kurve nach Stadium/GTS), `soil` (Bodenart→nFK).
- **Später (Folge-Specs):** `gdd`, `disease`, `harvest`.
**Single Source of Truth** → kein Client/Server-Drift, wenn der Server später dieselben Funktionen ruft.

---

## 5. Datenquellen

| Quelle | Rolle | Ort | Status in v1 | Lizenz/Hinweis |
|---|---|---|---|---|
| Open-Meteo (ET0, Niederschlag, stündlich) | ET0 + Regen-Term | Client (heute) | **v1** | frei nicht-komm.; komm. ~30–100 €/Mon. |
| SoilGrids250m / HiHydroSoil v2 | nFK/AWC je Schlag | Server-Lookup, **einmalig** | **v1** | CC-BY-4.0 / frei m. Namensnennung |
| Bright Sky (DWD-Warnungen) | amtliche Warnungen | Browser-Proxy (vorhanden) | später | DWD frei m. Namensnennung |
| DWD RADOLAN (Radar-Niederschlag) | gemessener Regen-Term | Server (Ingest) | **gegatet** | DWD Open Data; Format RADOLAN-RW (Binär/ESRI-ASCII, nicht GRIB) — Aufwand vor Bau verifizieren |
| Open-Meteo **Ensemble** | Wahrscheinlichkeiten (Wetter) | Server/Client | später | s. o. |
| LfL Peronospora / ISIP | Krankheits-Anker | Server | gegatet | Weiterverbreitung **vorab mit LfL klären** (langer Pol) |
| Sentinel-2/-1 (GEE/openEO) | dyn. Kc, Vitalität | Server, geplant | gegatet | Copernicus frei |
| Bayern DOP40 / DGM1 | Luftbild / Relief | Client / Server | DOP40 v1 | Open Data m. Namensnennung |
| ERA5-Land | Eimer-Init (grob) | Server, optional | gegatet | nur Init/Cross-Check |

**Auflösungs-Ehrlichkeit (GEE-Recherche):** SoilGrids ist **250 m** (≈ 6,25 ha/Pixel) — ein Pixel deckt
einen ganzen 0,5–2-ha-Schlag (+ Nachbarn); langsam variierende statische Größe, daher tolerierbar,
aber **nicht als feldscharf** ausweisen. ET-/Bodenfeuchte-Produkte (500 m–11 km) sind regional →
für die Wasserbilanz **nicht** als Feldwahrheit nutzen. Einziger feldscharfer Bodenwert: bayerische
**Bodenschätzung nFKWe** (nicht offen/nicht GEE) → optionales Premium-Upgrade.

---

## 6. (Zielarchitektur, gegatet) Indikator- & Cache-Schicht — NICHT in diesem Plan

Wenn die Server-Compute-Schicht gebaut wird (Gate erreicht), kommen hinzu — hier als Referenz, damit
das spätere Schema-Design konsistent bleibt:
```sql
field_indicators   (field_id uuid fk, card text, computed_at, valid_until, status, headline,
                    detail, payload jsonb, source, confidence, primary key(field_id,card))
water_balance_state(field_id uuid fk, date date, dr_mm numeric, taw_mm numeric, primary key(field_id,date))
gdd_state          (field_id uuid fk, season int, gdd numeric, bbch int, updated_at)
weather_cell_cache (cell_key text primary key, fetched_at, payload jsonb)   -- SHARED / non-tenant
```
**RLS-Muster (präzise, da NICHT „analog §5"):**
- `field_indicators`, `water_balance_state`, `gdd_state` tragen nur `field_id` (kein `farm_id`) → die
  Policy braucht einen **zweistufigen Join**:
  `field_id IN (SELECT id FROM fields WHERE farm_id IN (SELECT farm_id FROM farm_members WHERE user_id = current_setting('app.user_id')::uuid))`.
- `weather_cell_cache` ist **bewusst mandantenübergreifend** (Dedupe je Rasterzelle) → **kein** `farm_id`,
  **vom RLS-Pauschalsatz ausgenommen**; nur Lesen für die App-Rolle, Schreiben nur durch den Worker.
- **Worker-DB-Rolle:** Der Worker schreibt schlagübergreifend und kann das per-Request-`SET LOCAL
  app.user_id`-Modell nicht nutzen. Auflösung (im gegateten Plan zu spezifizieren): **eigene Rolle**
  `doldenblick_worker` mit gezielten Tabellen-Grants und entweder (a) `set_config('app.user_id', <Eigentümer des Schlags>, true)` je Schlag-Transaktion, oder (b) explizite Worker-Policies, die auf
  `field_id`/`cell_key` keyen. **Nicht** `BYPASSRLS` (Footgun-Schutz der Backend-Spec §5 bleibt).

> Für **v1** entfällt all das: persistenter `Dr` lebt in der `fields`-Zeile (Phase-1-Tabelle) bzw. im
> `localStorage`-Cache; `valid_until`/Dedupe sind **YAGNI** bis > 1 Nutzer pro Rasterzelle.

---

## 7. Die sechs Karten (Überblick; nur Wasserbilanz ist dieser Plan)

| Karte | Modell | Status |
|---|---|---|
| **Wasserbilanz** | FAO-56 Tipping-Bucket, persistenter `Dr` (client-seitig v1) | **dieser Plan — §8** |
| Wachstum & Ernte | GTS/BBCH + Reife-/Alpha-Fenster | Folge-Spec (Schritt 3) |
| Spritzfenster | ΔT/Wind/Regen + Inversion (bewertet) | Folge-Spec (Schritt 4) |
| Wetter & Warnungen | amtl. → probabilistisch + Strahlungsfrost | Folge-Spec (Schritt 4) |
| Krankheitsdruck | LfL-Anker + Blattnässe×Temp-Infektionsmodell | Folge-Spec (Schritt 5, gegatet) |
| Feld-Check (Satellit) | NDRE-Anomalie | Folge-Spec (Schritt 6, gegatet) |

Schwellen/Parameter aller Karten: `docs/hops/README.md` (SSoT), inkl. GTS-Basis ~5 °C **mit Deckelung ~30 °C**.

---

## 8. Wasserbilanz v2 (detaillierte Auslegung — Kern dieses Plans)

> **Umsetzungsnotiz (2026-06-28):** Gemäß Architektur-Update läuft die Berechnung nun **zustandslos
> im Backend** (`api/`, Fastify), nicht client-seitig. Damit entfallen für die erste Scheibe der
> persistente `Dr`-Carry-over, die `fields`-Bodenspalten (§8.4) und der `localStorage`-Cache: `Dr`
> wird je Request über das `past_days`-Fenster (Init Feldkapazität am Fensteranfang) neu hergeleitet.
> Die FAO-56-Mathematik (§8.1, inkl. Ks), die Bodendaten-Logik (§8.2) und die Grenzen (§8.7) gelten
> unverändert. Umgesetzt in `api/src/{domain,sources,routes}` + `api/README.md`.

**Ziel:** Aus der speicherlosen klimatischen Bilanz wird ein echter Wurzelraum-Eimer mit Carry-over
und Signal „**X mm bewässern / abwarten**". (Ursprünglich client-seitig geplant — jetzt Backend, s. o.)

### 8.1 Modell (FAO-56 Wurzelraum-Wasserbilanz, Allen et al. 1998)
Einheiten: nFK in **mm/m**, Zr in **m**, alles übrige in **mm**.
```
TAW = nFK[mm/m] · Zr[m]                       (mm; nFK = nutzbare Feldkapazität = θ_FC − θ_WP, ×Tiefe)
RAW = p · TAW                                  (p ≈ 0,5; optional ETc-korrigiert, s. u.)
Ks  = (Dr_{i-1} > RAW) ? (TAW − Dr_{i-1}) / (TAW − RAW) : 1     (Wasserstress-Reduktion, 0..1)
ETc_i = Ks · Kc_i · ET0_i                      (FAO-56: bei Dr>RAW reduzierte Transpiration)
Dr_i  = clamp( Dr_{i-1} + ETc_i − (P_i − RO_i) − I_i , 0, TAW )  (Überlauf über 0 = Tiefenperkolation)
heute:  status aus Dr/RAW;  Defizit = Dr;  empfohlene Netto-Gabe = Dr (Auffüllen auf Feldkapazität), wenn Dr ≥ RAW
```
- **Ks ist Pflicht** (Review-Befund): ohne sie ent-leert der Eimer in Trockenphasen zu schnell →
  systematische Über-Empfehlung genau im kritischen Juli/August-Fenster.
- **v1-Annahmen explizit:** `RO = 0` (kein Oberflächenabfluss-Modell) und `I = 0` (Beregnung nicht
  geloggt) — daher wird Tagesregen voll als effektiv gezählt; in §8.7 als Grenze geführt.
- **Kc** aus `kc`-Modul: Ankerwerte ini 0,30 / mid 1,05 / end 0,85; **lineare FAO-56-Interpolation**
  über Entwicklungs-/Spätphase. Stadienlängen v1 GTS-/kalenderbasiert (Vertrag im `kc`-Modul:
  `kc(stageOrGdd) → number`); später NDVI-gestützt mit GTS-Fallback.
- **Status-Bänder:** `Dr < 0,5·RAW` good · `0,5·RAW ≤ Dr < RAW` warn · `Dr ≥ RAW` alert (bewässern).
- **Optional (Refinement):** `p_adj = p + 0,04·(5 − ETc_Tag)`, geklammert 0,1..0,8 (FAO-56 Tab. 22) —
  bei Spitzen-ETc 5–6 mm/d sinkt p leicht → früherer Auslöser. v1 darf festes p=0,5 nutzen; `p_adj`
  als markierte Erweiterung im `kc`/`waterBalance`-Vertrag.

### 8.2 Bodendaten (löst die „Soil-Input"-Frage)
- **Server-Lookup** SoilGrids250m/HiHydroSoil am Schlag-Standort **einmalig** bei Anlage/Änderung →
  nFK; Ergebnis in `fields`-Spalten persistiert. Same-origin über die Phase-1-API (kein Browser-CORS/
  EE-Problem). v1 darf dies auch als **Build-Skript**/manuellen Einmal-Extrakt umsetzen, falls der
  API-Endpunkt noch nicht steht.
- **Nutzer-Override:** Bodenart-Dropdown + Wurzeltiefe `Zr` im Onboarding (Default **Lehm ~180 mm/m**,
  `Zr` 1,0 m; Bereich 1,0–1,2 m laut Kanon).
- **Demo:** für die 6 Demo-Schläge nFK einmalig aus SoilGrids extrahiert hartkodiert.
- **Caveat:** 250 m grob (ein Pixel = ganzer Schlag); `Zr` ist in keinem Datensatz und dominiert TAW →
  bewusste Annahme/Override. nFKWe (Bodenschätzung) als späteres Premium-Upgrade.

### 8.3 Persistenter Zustand & Warm-up
- `Dr` (+ `taw`) persistiert **pro Schlag** in der `fields`-Zeile (Phase-1-Postgres) bzw. im
  `localStorage`-Cache offline. **Kein Worker/keine eigene State-Tabelle in v1.**
- **Re-Compute beim App-Öffnen:** über Open-Meteo `past_days` **= 60** (Default) warm-up bis „heute".
  Während des Warm-ups je vergangenem Tag das **historische** Kc-Stadium verwenden (nicht das heutige).
- **Init:** Saisonstart (April) auf Feldkapazität `Dr=0` (Hallertau: nasse Winter → plausibel; als
  Annahme dokumentiert). Nach Lücke **> 14 Tagen** ohne Persistenz: neu warm-up ab letztem `Dr`, sonst
  ab Saisonstart. (ERA5-Land-Prior erst in der gegateten Server-Phase.)

### 8.4 Schema-Ergänzung (`fields`, additiv zu Backend-Plan Task 2)
```sql
ALTER TABLE fields
  ADD COLUMN nfk_mm_per_m numeric,           -- aus SoilGrids/Override (nutzbare Feldkapazität)
  ADD COLUMN root_depth_m numeric DEFAULT 1.0,
  ADD COLUMN soil_source  text,              -- 'soilgrids'|'user'|'demo'
  ADD COLUMN dr_mm        numeric,           -- persistenter Verarmungszustand (v1; ohne Worker)
  ADD COLUMN dr_as_of     date;
```

### 8.5 Module & Datenfluss (alles client-seitig in v1)
- **rein, geteilt:** `domain/waterBalance.ts` → `computeSoilWaterBalance(et0[], precip[], kc[], {taw, raw, p}, init) → { dr, ks, deficit, status, recommendMm, taw, raw }` (Rückgabe enthält **`ks`**);
  `domain/kc.ts`; `domain/soil.ts`.
- **Client:** holt Open-Meteo (`past_days=60` + Vorhersage), liest nFK/Zr/`dr` aus dem Schlag, ruft die
  reine Funktion, rendert die Karte, schreibt `dr_mm`/`dr_as_of` zurück (API/localStorage).

### 8.6 Tests
- **Unit (TDD, Vitest):** Bucket-Rekurrenz inkl. **Ks** (Über-Verarmung gebremst bei Dr>RAW); Carry-over
  über > 7 Tage; Überlauf=Perkolation; Clamp 0..TAW; RAW-Auslöser; `RO=0/I=0`-Annahme im
  Regressionsfall (40 mm Regen vor 8 Tagen hält den Eimer voll); `kc`-Interpolation je Stadium;
  `soil`-Presets/Einheiten (nFK[mm/m]·Zr[m]=mm).
- **Integration (falls API-Soil-Lookup gebaut):** SoilGrids-Adapter (gemockt + 1 Live-Smoke); `dr`-
  Persistenz Round-Trip.

### 8.7 Bewusste Grenzen (Ehrlichkeit)
Klimatisch + Boden, aber: 250-m-nFK (keine Innen-Feld-Variabilität), `Zr`-Annahme, `RO=0`/`I=0`
(kein Abfluss-/Beregnungs-Logbuch), kein Kapillaraufstieg (CR=0; tiefes Grundwasser angenommen), keine
Hangneigung (DGM1 später). Empfehlung bleibt **Orientierung**, keine verbindliche Beregnungsanweisung;
Konfidenz wird ausgewiesen.

---

## 9. Roadmap (dieser Plan + gegatete Folge)

- **Schritt 1 — Domänen-Paket extrahieren** *(dieser Plan; sofort, billig, reversibel)*
- **Schritt 2 — Wasserbilanz v2, client-seitig** *(dieser Plan; §8)*
- **— Nachfrage-Gate (≥10–20 wiederkehrende Nutzer) + erste Server-only-Quelle —**
- Schritt 3 — GTS/Phänologie (`gdd`) → speist Kc + Wachstum/Ernte/Qualität *(Folge-Spec)*
- Schritt 4 — Spritzfenster + Wetter (atmosphärische Inputs, ggf. Ensemble) *(Folge-Spec)*
- Schritt 5 — Krankheitsdruck (LfL-Anker + Infektionsmodell) *(gegatet, Folge-Spec)*
- Schritt 6 — Feld-Check Satellit (Sentinel via GEE/openEO) *(gegatet, Folge-Spec)*
- Querschnitt ab dem Gate: Worker/Ingest/Indikator-Schicht (§6), Validierungs-/Backtest-Harness.

---

## 10. Testing-Strategie (für diesen Plan)
Reine Unit-Tests (TDD) im Domänen-Paket (Schwerpunkt Wasserbilanz inkl. Ks/Carry-over/Einheiten);
bestehende Vitest-Suite zieht ins Paket um und bleibt grün; optional 1 Live-Smoke des SoilGrids-Lookups.

## 11. Risiken & Devil's-Advocate (aufgelöst)
- **#1 Nachfrage vor Infrastruktur:** **echt gegated** — Schritt 1+2 brauchen keinen Schwerbau; Worker/
  Ingest/Caches erst nach Nutzer-Schwelle + Server-only-Quelle. Falsifizierung: wiederkehrende Nutzer.
- **#2 Persistenz ⇏ Worker:** persistenter `Dr` = eine Zeile + client-seitiger Re-Compute beim Öffnen;
  Worker nur sinnvoll bei Push (out-of-scope) oder > 1 Nutzer/Zelle.
- **#3 Grobe Daten als feldscharf:** 250 m–11 km NICHT als Feldwahrheit; Konfidenz/Rasterhinweis Pflicht.
- **#4 Math-Drift:** ein geteiltes Paket; Wasserbilanz wird **neu** geschrieben (kein Port) und voll getestet.
- **#5 LfL-Lizenz:** langer Pol der Krankheitskarte → Klärungs-Track parallel, aber erst Schritt 5.

## 12. Offene Punkte
**Vor `writing-plans` zu entscheiden (blockt Schritt 1+2):** (a) Monorepo-Layout des geteilten Pakets
(Default-Vorschlag: **npm-Workspaces**, `packages/domain/`); (b) ob der SoilGrids-Lookup in v1 als
API-Endpunkt **oder** als Einmal-Build-Skript kommt (Default: Build-Skript + hartkodierte Demo-Werte,
API-Endpunkt mit dem Backend). **Später (blockt Schritt 1+2 nicht):** RADOLAN-Ingest-Aufwand/-Format,
LfL-Lizenz, Open-Meteo Ensemble, Worker-Technik (node-cron/pg_cron).

## 13. Beziehung zum Backend-Plan
`backend-phase1.md` bleibt gültig/unverändert. Diese Spec ergänzt: die `fields`-Bodenspalten + `dr_*`
(§8.4, additiv) und das geteilte Domänen-Paket (§4). Die Implementierung folgt nach Freigabe als
eigener Plan (superpowers:writing-plans), **Umfang = Schritt 1 + Schritt 2**. Die gegatete
Server-Compute-Schicht (§3/§6, Schritte 3–6) erhält je eigene Specs/Pläne, wenn das Gate erreicht ist.
