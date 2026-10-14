"""Dibuja a alta resolución las hojas REALES de adentro del pack que se muestran en las variantes del hero (make_hero_variants.py).

Lee los PDF FINALES de la entrega (`Proyecto Digitales/pack/venta/pack-basico-<edicion>/A4/`, solo lectura) y deja PNG en `_cache/hero/pages/<edicion>-<clave>.png`.
Las hojas llevan abajo un pie con el texto legal (en la versión de trabajo, además, la leyenda de borrador): para la imagen se blanquea esa franja (queda margen blanco), porque
a ese tamaño la letra del pie no se lee. Con `--borrador` lee los PDF de revisión de `pack/pdf/<edicion>-a4/`, como antes.

Uso (con el Python que trae PyMuPDF): python scripts/pack-landings/render_hero_pages.py [--ppp 170]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz  # PyMuPDF

import final_pdfs

REPO = Path(__file__).resolve().parents[2]
PDFS = REPO.parents[1] / "Proyecto Digitales" / "pack" / "pdf"
OUT = REPO / "scripts" / "pack-landings" / "_cache" / "hero" / "pages"

# clave -> (archivo del cuadernillo, página contando desde 0). Una hoja de trabajo por área.
PAGES = {
    "sopa": ("04-atencion-nivel-1.pdf", 3),  # Sopa de letras: meses y días
    "piramides": ("10-calculo-nivel-1.pdf", 5),  # Pirámides de sumas
    "cambio": ("01-memoria-nivel-1.pdf", 7),  # ¿Qué cambió? En el mercado
    "desordenadas": ("07-lenguaje-nivel-1.pdf", 3),  # Palabras desordenadas: colores
    "diferencias": ("04-atencion-nivel-1.pdf", 9),  # Encontrar las diferencias
    "ferreteria": ("10-calculo-nivel-1.pdf", 7),  # Compras en la ferretería
    "sopa-guia": ("04-atencion-nivel-1.pdf", 4),  # Guía de la sopa de letras: objetivo, cómo aplicarla, solucionario y registro ("Cómo nos fue hoy")
    "piramides-guia": ("10-calculo-nivel-1.pdf", 6),  # Guía de las pirámides de sumas
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ppp", type=int, default=170)
    ap.add_argument("--venta", default=str(final_pdfs.VENTA), help="carpeta de la entrega final (pack/venta)")
    ap.add_argument("--borrador", action="store_true", help="leer los PDF de revisión de pack/pdf, como antes")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for edition in ("familia", "profesional"):
        for key, (name, index) in PAGES.items():
            if args.borrador:
                pdf = PDFS / f"{edition}-a4" / name
            else:
                # "04-atencion-nivel-1.pdf" -> pack-basico-familias/A4/04-Atencion-Nivel-1.pdf
                n, area, _, level = name[:-4].split("-")
                pdf = final_pdfs.booklet_path(Path(args.venta), edition, "a4", area, int(level))
                assert pdf.name.startswith(n), f"{pdf.name} no es el cuadernillo {n}"
            with fitz.open(pdf) as doc:
                page = doc[index]
                # franja del pie: 8,8 % inferior de la hoja, en blanco
                foot = fitz.Rect(0, page.rect.height * 0.912, page.rect.width, page.rect.height)
                page.draw_rect(foot, color=None, fill=(1, 1, 1))
                pix = page.get_pixmap(dpi=args.ppp, alpha=False)
                target = OUT / f"{edition}-{key}.png"
                pix.save(target)
                print(f"  {target.name} {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
