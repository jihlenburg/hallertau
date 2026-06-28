# Disease, Water & Nutrient Stress Detection for Hops via Remote Sensing — Validated vs Aspirational (2023–2026)

> Teil der Satelliten-Recherche (Deep-Research-Schwarm, 2026-06-28, Workflow `satellite-hops-research`).
> Facette: `stress`. Übersicht & Empfehlung: `README.md`. Geometrie-Vorabbefund: `field-scale-backtest.md`.

**Zusammenfassung:** For hop downy mildew (Peronospora humuli) — the disease that actually drives spraying decisions in the Hallertau — there is currently NO validated remote-sensing detector at any scale; the operational, validated early-warning system remains the LfL/ISIP spore-trap + weather forecast model (zoosporangia counts vs susceptibility-dependent thresholds), not imagery. The best hop-specific RS work is drone hyperspectral for Verticillium wilt (and exploratory powdery mildew/spider mite work), explicitly because satellite 10 m pixels are useless on a ~4,000-plants/ha trellis. The strongest quantitative analogue is grapevine downy mildew from high-res satellite (Cornell/Gold lab): SkySat 50 cm and PlanetScope 3 m can map established disease (RF accuracy up to 0.92 PlanetScope / 0.85 SkySat for high-vs-low incidence) but CANNOT detect early/low-severity (<10% symptomatic leaf area) infection and cannot separate co-occurring diseases — i.e. it confirms outbreaks too late to act and carries real confusion/false-alarm risk. Water stress is the most tractable RS facet: thermal CWSI (drone) and red-edge/NDRE for nitrogen are validated in vineyards/orchards (the right trellis-geometry analogue), while Sentinel-1 SAR gives only field/regional soil-moisture context. For DoldenBlick the honest framing is: RS = regional screening + an anomaly/"go-scout" trigger that defers to LfL/ISIP for disease and to FAO-56/thermal for water — never a field-precise disease diagnosis.

**Feldskalen-Verdikt:** Mixed and facet-dependent — be honest in the UI. SATELLITE optical (Sentinel-2 10m, red-edge 20m) on 0.5–2 ha hop fields = REGIONAL SCREENING ONLY: each field is a handful of soil/shadow/canopy-mixed pixels, good for relative vigour anomalies and 'go-scout' triggers, not field-precise. Even sub-1m commercial (SkySat 0.5m) maps only ESTABLISHED disease and fails early/low-severity detection (proven in the grapevine downy-mildew analogue) and cannot tell diseases apart. FIELD-PRECISE disease/water/N work in hops is demonstrated only at DRONE scale (hyperspectral for Verticillium; thermal CWSI for water; red-edge for N) and is expert/partner-operated, not a satellite SaaS feature. For the decision that matters most — downy mildew — no RS detector is validated; the field-precise, validated, actionable signal is the LfL/ISIP spore-trap+weather forecast, which RS should defer to.

**Infrastruktur-Implikationen:** Build a tiered ingest + a strict 'screening vs field-precise' contract, never a disease-diagnosis API. (1) DISEASE: highest priority is a connector to LfL Peronospora-Warndienst + ISIP (likely scrape/bulletin parse; check API/licence) — daily zoosporangia/threshold/risk per region, cached and surfaced as the primary disease signal; treat any RS layer as a separate, clearly-labelled 'Vigour-Anomalie' flag, not a disease call. (2) SATELLITE: a Sentinel-2 L2A pipeline (Copernicus/openEO or AWS COGs) computing NDVI/NDRE/NDMI per field with cloud/shadow masking, multi-date temporal compositing, and per-field pixel-count + mixed-pixel confidence metadata; store as time series for anomaly detection (a field flags only on persistent, multi-scene deviation to suppress false alarms). (3) SAR: optional Sentinel-1 GRD VV/VH soil-moisture prior feeding the existing FAO-56 water-balance service as an independent wetness check. (4) HIGH-RES/DRONE: design as on-demand/partner jobs (SkySat/Pléiades Neo tasking; drone thermal-CWSI and hyperspectral upload) with object storage for large rasters and an orthomosaic/sunlit-pixel-mask processing step — not always-on. Cross-cutting: a provenance+confidence field on every layer (sensor, GSD, pixels-per-field, date, cloud%), a fusion/rules engine combining LfL risk + weather/leaf-wetness + FAO-56 + RS anomaly before any farmer-facing flag, and explicit UI metadata distinguishing 'regional screening' from 'field-precise'. Storage: raster tiles/COGs + per-field index time-series DB; compute: scheduled batch (Sentinel revisit ~5d S2 / ~6d S1) plus burst capacity for on-demand high-res scenes.

---

## Bottom line up front

For hops on a 7 m trellis (rows ~3 m apart, ~2,500–4,000 plants/ha, strong soil/shadow/canopy mixing), remote sensing is a **regional screening and triage layer**, not a field-precise disease diagnostic. The single most important honest statement: **the validated early-warning system for the disease that matters most in the Hallertau (Peronospora humuli) is not remote sensing at all — it is the LfL/ISIP spore-trap + weather forecast model.** RS should feed that, not pretend to replace it.

I separate three facets below by maturity: **VALIDATED** (peer-reviewed, accuracy numbers, ideally in hops or a tight trellis analogue), **EMERGING** (demonstrated in analogues/drone, not operational for hops), and **ASPIRATIONAL** (claimed in marketing or hoped-for, not validated for this geometry).

---

## 1. Disease detection

### 1a. Downy mildew (Peronospora humuli) — the decision-driving disease

**Validated operational tool = LfL Peronospora-Warndienst (NOT imagery).** The LfL working group in Wolnzach runs a long-standing forecast model fed by (a) **zoosporangia counts from spore traps** across Bavarian "spore-trap gardens" and (b) co-located **digital weather stations** (precipitation, leaf wetness, dispersal conditions). Daily warnings / spray recommendations are issued by variety susceptibility group, with explicit **action thresholds — ~30 zoosporangia for susceptible varieties, ~50 for tolerant, until flowering** — and a distinction between **primary infection** (overwintered systemic "Bubiköpfe"/basal spikes) and **secondary infection** (airborne zoosporangia driven by wet weather). Distributed nationally free-of-charge to Bavarian farms/advisors via **ISIP** (isip.de). This is the gold-standard signal; any DoldenBlick "Feld-Check" should ingest/surface it, not compete with it. (Sources: lfl.bayern.de Peronospora-Warndienst pages; ISIP.)

**Remote-sensing detection of hop downy mildew specifically: not validated. No published satellite or drone detector exists** that I can find for P. humuli. Reasons are physical: the pathogen's earliest, most actionable signs (basal primary spikes, abaxial sporulation, angular leaf lesions) are sub-canopy and sub-pixel; the vertical bine canopy + wide bare-soil rows means a 10 m Sentinel-2 pixel is mostly soil/shadow.

**Closest quantitative analogue — grapevine downy mildew (GDM, also a Plasmopara/Peronospora-class oomycete on a trellised row crop), Cornell/K. Gold lab, Geneva NY, 3 seasons (2020–2022), published in *Phytopathology* (PHYTO-11-23-0432-R) / bioRxiv 2023:**
- Platforms: **PlanetScope (~3 m, ~daily)** and **SkySat (~0.5 m)**. Random-forest on bands + VIs.
- **Established-disease mapping works:** max accuracy **0.92 (PlanetScope)** and **0.85 (SkySat)** for separating high-vs-low GDM incidence/severity.
- **Early detection FAILS:** they "were unable to differentiate healthy vines from low-severity infections"; VIs only separated **<10% vs >10% symptomatic leaf area**. By the time the satellite sees it, the epidemic is established — too late for the preventive action that defines downy-mildew management.
- **PlanetScope 3 m too coarse to resolve individual vines**; only SkySat 0.5 m approaches plant scale. Hop rows are wider/sparser than vine rows, so this is, if anything, an optimistic bound for hops.
- **Confusion risk is explicit:** neither sensor had enough spectral resolution to distinguish GDM damage from co-occurring diseases — i.e. a positive is "something is wrong here," not "this is downy mildew." That is the core false-alarm problem.

**Verdict (downy mildew RS):** regional screening / "stress anomaly here" at best, lagging and non-specific. **Do not surface it as a downy-mildew call.** Surface LfL/ISIP risk + an RS "vigour anomaly" flag that says *go scout*.

### 1b. Verticillium wilt (V. nonalbo-atrum / V. dahliae) — the best hop-specific RS work

This is where hop-specific remote sensing actually exists, and it is **drone hyperspectral, not satellite.** A Headwall Photonics application note documents airborne (UAV) hyperspectral imaging of hop yards for **Verticillium wilt early detection**, with the stated rationale that **satellite 10 m resolution is insufficient given ~4,000 plants/ha** — high-resolution drone imagery was required. Verticillium is high-stakes (lethal "progressive/fatal" strains are quarantine-relevant; infected plants must be rogued early to limit soil inoculum), so early detection has real value. Powdery mildew and spider-mite detection were flagged as **future/exploratory** extensions of the same approach, not yet validated. Broader (non-hop) Verticillium RS is more mature: cotton Verticillium hyperspectral classification reports ~85–95%+ accuracies (e.g. spectral+image fusion, MDPI/Plant Methods 2023–2025) and eggplant-leaf deep learning ~90%+ — but these are **leaf/plot-scale, controlled, single-disease** settings, not field-precise multi-disease operational maps.

**Verdict (Verticillium):** EMERGING and hop-relevant, but **drone hyperspectral, expert-operated, not a satellite/SaaS feature.** Realistically a partner/agronomist workflow, not something DoldenBlick resolves from Sentinel.

### 1c. Powdery mildew (Podosphaera macularis)

No validated hop RS detector. Analogues (wheat powdery mildew hyperspectral ~91% validation accuracy; cucumber HSI-terahertz; sugar-beet UAV) are leaf/plot scale. White colonies on cones/leaves are a contrast feature but spectrally easy to confuse with senescence, dust, sulphur residue, and sun-fleck. **Aspirational** for satellite; possibly EMERGING for proximal/drone hyperspectral. Operationally it remains scout-and-LfL-bulletin driven.

### General presymptomatic caveat
The 2024–2025 hyperspectral-disease literature is candid that **presymptomatic detection is largely unvalidated in the field**: preprocessing variability, poor generalization across class distributions, and unquantified false-positive rates in asymptomatic stages are repeatedly flagged as open gaps (Frontiers in Plant Science 2024/2025; J. Plant Dis. Prot. reviews). Lab "we detected it before symptoms" claims do not transfer to a 7 m mixed-pixel canopy under variable sun/wind.

---

## 2. Water stress detection — the most tractable RS facet

Here the trellis analogue (vineyards/orchards) is strong and directly transferable.

- **Thermal CWSI (canopy temperature) — VALIDATED in vineyards/orchards, drone-scale.** CWSI from UAV thermal-IR is the workhorse; it's directly sensitive to stomatal closure and correlates with stem/leaf water potential and ET ratios. **Critical caveat for hops:** sparse vertical canopy over hot bare soil means you MUST filter for **sunlit-canopy pixels only** — unmasked soil/shaded pixels wreck CWSI (well-documented coregistration/pixel-filtering work, e.g. Sensors PMC5856051; Precision Agriculture 2024 10179-0). This demands sub-0.5 m thermal pixels → **drone, not satellite.** Satellite thermal (Landsat 100 m, ECOSTRESS ~70 m, upcoming LSTM/TRISHNA) is far too coarse for a 1 ha hop yard and will be dominated by soil.
- **Sentinel-1 SAR (C-band, VV/VH, ~5–20 m, ~6-day) — regional soil-moisture context only.** VV is sensitive to surface soil moisture, VH to vegetation volume; assimilation into water-balance models (AquaCrop, JGR Biogeosciences 2024) and global 1 km SM products exist. Useful as a **soil-wetness prior** at field/regional scale but **not a per-field hop water-status sensor** (geometry + canopy volume confound it). Pairs naturally with your existing FAO-56 water-balance service as an independent wetness check.
- **Optical proxies (NDWI/NDMI, SWIR).** Sentinel-2 SWIR-based moisture indices give regional drought context; not field-precise on this geometry.

**Verdict (water):** This is the facet where RS adds the most. **Drone thermal CWSI = field-actionable; Sentinel-1/2 + FAO-56 = regional/field water-balance context.** Honest split: precise within-field water-stress maps need a thermal drone flight; the satellite/model layer is screening + irrigation-scheduling support.

---

## 3. Nitrogen / nutrient status — red-edge

- **Red-edge chlorophyll/N retrieval — VALIDATED in principle, field-scale caveats.** Sentinel-2's red-edge bands (B5 705 nm, B6 740 nm, B7 783 nm, B8A) drive **NDRE = (B8A−B5)/(B8A+B5)** and CIred-edge, well-established for canopy chlorophyll/N (Clevers & Gitelson; multiple Remote Sensing papers) and less saturation-prone than NDVI in dense canopy. Red-edge typically flags N/stress **1–2 weeks earlier than NDVI**.
- **Hop-geometry caveat:** Sentinel-2 red-edge bands are **20 m** — a single hop field is a handful of mixed pixels. So satellite NDRE gives **relative, regional N/vigour trends and within-yard zonation only for larger blocks**, not a fertiliser-prescription map. Field-precise N mapping again needs **drone multispectral (red-edge) at cm scale.** Confounders: chlorophyll ≠ N uniformly; water stress, disease and senescence all depress red-edge, so N must be disentangled from the other stressors (it cannot be, from spectra alone, reliably).

**Verdict (N):** EMERGING-to-VALIDATED as a *vigour/anomaly* layer; **not** a standalone N-diagnosis at satellite scale for fields this small.

---

## 4. Detection limits & false-alarm risk (the honest core)

1. **Sensor vs field arithmetic.** 0.5–2 ha hop fields on 7 m trellis with 3 m rows → Sentinel-2 (10 m optical / 20 m red-edge): a whole field is ~5–200 pixels, each mixing canopy+soil+shadow. **Satellite optical is regional screening, full stop.** Only sub-1 m commercial (SkySat 0.5 m, Pléiades Neo 0.3 m, drone cm) approaches plant scale — and even SkySat couldn't do *early* disease in vines.
2. **Disease specificity is the weak point.** Validated systems separate "stressed vs healthy," not "downy mildew vs powdery mildew vs Verticillium vs water/N stress vs spider mite." Every stressor depresses the same VIs. A vigour anomaly is a **scout trigger**, never a diagnosis. Presenting RS as a disease call to farmers = high false-alarm rate + lost trust + wasted/over-spraying (an agronomic and regulatory negative).
3. **Timing trap.** RS confirms disease *after* it's established (>10% symptomatic leaf area in the GDM study). Downy mildew is managed **preventively** off forecast risk — so RS is structurally late for the highest-value decision.
4. **Mitigation:** fuse RS anomalies with the LfL/ISIP forecast, weather/leaf-wetness, your FAO-56 water balance, and require temporal persistence (multi-date) before flagging, to suppress single-scene false positives.

---

## 5. What this means for the DoldenBlick "Feld-Check"

Frame it as an **anomaly/triage layer with explicit confidence and provenance**, consistent with your CLAUDE.md guardrail ("Satellit = regionales Screening, nicht teilflächengenau"):
- **Disease:** Surface **LfL Peronospora-Warndienst + ISIP risk** as the primary signal. Add a Sentinel-2 (+ optional SkySat/Pléiades on-demand) **"Vigour-Anomalie — bitte begehen"** flag, never labelled as a specific disease.
- **Water:** Lead with your FAO-56 service; add Sentinel-1 wetness as an independent prior; offer **drone thermal CWSI** as the field-precise upsell (partner/contract flight).
- **Nutrient:** Red-edge/NDRE **relative vigour zonation** at regional/within-yard scale; field-precise N = drone red-edge.
- **Be explicit in UI** about pixel-vs-field scale and that satellite = screening, drone = field-precise. That honesty is itself a product differentiator for a sceptical farmer audience.

## Quellen
- **LfL Bayern — Peronospora-Warndienst (Hopfen)** _(program)_ — Validated operational early-warning: spore-trap zoosporangia counts + co-located weather stations; thresholds ~30 (susceptible)/~50 (tolerant) zoosporangia until flowering; primary vs secondary infection. lfl.bayern.de/ipz/hopfen/030222. THE disease signal to ingest, not RS.
- **ISIP (isip.de) — weather-based forecast portal** _(platform)_ — Distributes LfL Peronospora/pest forecasts nationally; free for Bavarian farms/advisors. Integration target for DoldenBlick disease layer.
- **Gold lab (Cornell) — Grapevine downy mildew via SkySat/PlanetScope** _(paper)_ — Phytopathology PHYTO-11-23-0432-R / bioRxiv 2023.11.10.566469; IVES summary. RF accuracy 0.92 (PlanetScope 3m)/0.85 (SkySat 0.5m) for high-vs-low incidence; CANNOT detect <10% symptomatic / early disease; cannot separate co-occurring diseases. Best trellis-crop downy-mildew analogue.
- **Headwall Photonics — Airborne hyperspectral imaging of hops** _(analogue)_ — Hop-SPECIFIC: drone hyperspectral for Verticillium wilt early detection; satellite 10m explicitly insufficient at ~4,000 plants/ha; powdery mildew & spider mites flagged as future/exploratory.
- **Cotton Verticillium wilt hyperspectral (MDPI Agronomy 2025; Plant Methods 2023)** _(paper)_ — ~85–95%+ classification accuracy, leaf/plot scale, single-disease controlled — analogue for Verticillium spectral detectability, not field-precise multi-disease.
- **UAV thermal CWSI in vineyards (Sensors PMC5856051; Precision Agriculture 2024 s11119-024-10179-0; Irrigation Science 2024)** _(paper)_ — Validated water-status proxy; REQUIRES sunlit-canopy pixel filtering on sparse/row canopies → drone-scale thermal, not satellite. Direct trellis analogue.
- **Sentinel-2 red-edge for chlorophyll/N (Clevers & Gitelson; Remote Sensing)** _(dataset)_ — NDRE/CIred-edge from B5/B6/B7/B8A (red-edge bands at 20m). Validated N/chlorophyll proxy, earlier than NDVI; but 20m too coarse for field-precise N on 0.5–2ha fields.
- **Sentinel-1 SAR soil moisture / crop water (JGR Biogeosciences 2024 AquaCrop assimilation; Remote Sensing 2024/2025)** _(dataset)_ — C-band VV/VH ~5–20m, ~6-day; regional/field soil-moisture prior, not per-field hop water status. Pairs with FAO-56 balance.
- **Hyperspectral plant-disease reviews 2024–2025 (Frontiers Plant Sci; J. Plant Dis. Prot.)** _(paper)_ — Candid on unvalidated presymptomatic detection: preprocessing variability, poor cross-condition generalization, unquantified false-positive rates in asymptomatic stages.
- **High-res commercial satellites — SkySat (0.5m), PlanetScope (3m, ~daily), Pléiades Neo (0.3m)** _(platform)_ — Only sub-1m approaches hop-plant scale; commercial/on-demand cost & licensing; even 0.5m failed early-disease detection in vines.
