#!/usr/bin/env bash
# Baut alle Mockups (PNG) und den Bericht (PDF) nach deliverables/.
# Voraussetzungen: wkhtmltopdf (mit wkhtmltoimage), python3 + pymupdf + pillow, fontconfig, curl.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> 1/4  Schrift (Barlow) laden"
mkdir -p assets/fonts
BASE="https://raw.githubusercontent.com/google/fonts/main/ofl"
fetch() { [ -f "assets/fonts/$2" ] || curl -fsSL "$1" -o "assets/fonts/$2"; }
for w in Regular Medium SemiBold Bold; do fetch "$BASE/barlow/Barlow-$w.ttf" "Barlow-$w.ttf"; done
for w in Medium SemiBold Bold; do fetch "$BASE/barlowsemicondensed/BarlowSemiCondensed-$w.ttf" "BarlowSemiCondensed-$w.ttf"; done
mkdir -p "$HOME/.fonts"
cp -f assets/fonts/*.ttf "$HOME/.fonts/"
fc-cache -f "$HOME/.fonts" >/dev/null 2>&1 || true

echo "==> 2/4  Mockups -> PNG"
mkdir -p deliverables
render() { # <html-key> <output-name> <width>
  wkhtmltoimage --enable-local-file-access --disable-smart-width --width "$3" --quality 100 \
    "mockups/$1.html" "deliverables/$2.png" >/dev/null 2>&1
  echo "    $2.png"
}
render m1_overview   HopfenBlick_Mockup1_Uebersicht 1600
render m2_mobile     HopfenBlick_Mockup2_Mobil       820
render m3_map        HopfenBlick_Mockup3_Karte      1600
render m4_onboarding HopfenBlick_Mockup4_Onboarding 1600

echo "==> 3/4  Vorschau-JPGs für den Bericht"
mkdir -p report/img
python3 - <<'PY'
from PIL import Image
items = {
    "m1_overview":   ("HopfenBlick_Mockup1_Uebersicht", 1500),
    "m2_mobile":     ("HopfenBlick_Mockup2_Mobil",       820),
    "m3_map":        ("HopfenBlick_Mockup3_Karte",      1500),
    "m4_onboarding": ("HopfenBlick_Mockup4_Onboarding", 1500),
}
for key, (png, w) in items.items():
    im = Image.open(f"deliverables/{png}.png").convert("RGB")
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(f"report/img/{key}_doc.jpg", quality=92, optimize=True)
print("    report/img/*.jpg")
PY

echo "==> 4/4  Bericht -> PDF (+ Seitenzahlen)"
wkhtmltopdf --enable-local-file-access --page-size A4 \
  --margin-top 16 --margin-bottom 16 --margin-left 16 --margin-right 16 \
  report/report.html deliverables/_report_raw.pdf >/dev/null 2>&1
python3 scripts/stamp_pages.py deliverables/_report_raw.pdf deliverables/HopfenBlick_Report.pdf
rm -f deliverables/_report_raw.pdf

echo "Fertig. Ergebnisse in deliverables/"
