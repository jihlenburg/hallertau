#!/usr/bin/env python3
"""Stempelt eine Fußzeile mit Seitenzahlen in ein PDF.

Aufruf:  python3 scripts/stamp_pages.py <eingabe.pdf> <ausgabe.pdf>

Hintergrund: Der hier verwendete (unpatched) wkhtmltopdf-Build ignoriert
CLI-Footer und Footer-HTML. Deshalb werden die Seitenzahlen nachträglich
mit PyMuPDF aufgestempelt.
"""
import sys
import fitz  # PyMuPDF

FOOTER_LEFT = "DoldenBlick · Konzeptstudie · Hopfen-Dashboard Hallertau"
GREY = (0.54, 0.60, 0.56)
LINE = (0.88, 0.90, 0.88)


def main(src: str, dst: str) -> None:
    doc = fitz.open(src)
    n = len(doc)
    for i, page in enumerate(doc):
        w, h = page.rect.width, page.rect.height
        page.draw_line((45, h - 36), (w - 45, h - 36), color=LINE, width=0.5)
        page.insert_text((45, h - 26), FOOTER_LEFT, fontsize=8, color=GREY, fontname="helv")
        label = f"Seite {i + 1} / {n}"
        tw = fitz.get_text_length(label, fontname="helv", fontsize=8)
        page.insert_text((w - 45 - tw, h - 26), label, fontsize=8, color=GREY, fontname="helv")
    doc.save(dst)
    print(f"    {n} Seiten gestempelt -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Aufruf: python3 scripts/stamp_pages.py <eingabe.pdf> <ausgabe.pdf>")
    main(sys.argv[1], sys.argv[2])
