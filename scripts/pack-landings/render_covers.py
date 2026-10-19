"""Dibuja las tapas REALES del pack a alta resolución, para componerlas sobre las fotos (make_mockup.py).

Lee los PDF FINALES de la entrega (Proyecto Digitales/pack/venta, que arma `npm run entrega` en TIAM-pack; solo lectura): la primera página de «Empezá acá» (la tapa del Pack) y la
primera de cada cuadernillo (las 12 tapas: memoria, atención, lenguaje y cálculo, niveles 1, 2 y 3), en A4. Son las mismas tapas que antes salían de `portadas-a4-<edicion>.pdf`.
Con `--borrador` vuelve a leer esos PDF de TIAM-pack/muestras (`npm run portadas -- --papel=A4 --edicion=familia`, y `--edicion=profesional`): las tapas no llevan marcas de borrador,
así que salen iguales.

Uso (con el Python que trae PyMuPDF):
    python scripts/pack-landings/render_covers.py [--venta RUTA] [--out scripts/pack-landings/_cache/covers] [--ppp 250]

Deja `<edicion>-pack.png` y `<edicion>-<area>-n<nivel>.png` (PNG sin pérdida; A4 a 250 ppp = 2067 x 2923 px).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz  # PyMuPDF

import final_pdfs

REPO = Path(__file__).resolve().parents[2]
AREAS = ("memoria", "atencion", "lenguaje", "calculo")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--venta", default=str(final_pdfs.VENTA), help="carpeta de la entrega final (pack/venta)")
    ap.add_argument("--borrador", action="store_true", help="leer portadas-a4-<edicion>.pdf de las muestras, como antes")
    ap.add_argument("--muestras", default=str(REPO.parent / "TIAM-pack" / "muestras"))
    ap.add_argument("--out", default=str(REPO / "scripts" / "pack-landings" / "_cache" / "covers"))
    ap.add_argument("--ppp", type=int, default=250)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for edition in ("familia", "profesional"):
        pdf = Path(args.muestras) / f"portadas-a4-{edition}.pdf"
        if args.borrador and not pdf.exists():
            print(f"  (falta {pdf.name}: npm run portadas -- --papel=A4 --edicion={edition})")
            continue
        with (fitz.open(pdf) if args.borrador else final_pdfs.covers_doc(Path(args.venta), edition)) as doc:
            assert len(doc) == 13, f"{pdf.name}: se esperaban 13 páginas y hay {len(doc)}"
            names = [f"{edition}-pack"] + [f"{edition}-{area}-n{level}" for area in AREAS for level in (1, 2, 3)]
            for page, name in zip(doc, names):
                pix = page.get_pixmap(dpi=args.ppp, alpha=False)
                target = out / f"{name}.png"
                pix.save(target)
                print(f"  {target.name}  {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
