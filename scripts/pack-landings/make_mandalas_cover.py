"""Tapa del regalo de los Cuadernos TIAM, «Mandalas para pintar» (solo lectura sobre el original).

Lee `Proyecto Digitales/pack/bonus-mandalas/tapa/tapa-a-a4.png` (2480 x 3508, la tapa A4 del cuadernillo) y deja, con el mismo formato que las tapas de los cuadernos:

  pack/img/mandalas-tapa-<240|400>.webp          la tapa entera, sin recortar (proporción A4: 240 x 339 y 400 x 566)

Solo escribe archivos NUEVOS (nunca toca otra imagen de la landing). Usos: la miniatura de «Todo lo que recibís» (240), el bloque «De regalo con tu compra» (400).

Uso (el Python del sistema, el que trae Pillow):
    python scripts/pack-landings/make_mandalas_cover.py [--cover RUTA.png] [--out pack/img]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
DEFAULT_COVER = Path(r"C:\Users\Manu\OneDrive - UTN FRLP\Documentos\Proyecto Digitales\pack\bonus-mandalas\tapa\tapa-a-a4.png")
WIDTHS = (240, 400)
EXPECTED_SIZE = (2480, 3508)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cover", type=Path, default=DEFAULT_COVER)
    parser.add_argument("--out", type=Path, default=REPO / "pack" / "img")
    args = parser.parse_args()

    with Image.open(args.cover) as source:
        if source.size != EXPECTED_SIZE:
            raise SystemExit(f"la tapa mide {source.size}, esperaba {EXPECTED_SIZE}; ¿cambió el original?")
        cover = source.convert("RGB")

    args.out.mkdir(parents=True, exist_ok=True)
    for width in WIDTHS:
        height = round(cover.height * width / cover.width)
        target = args.out / f"mandalas-tapa-{width}.webp"
        cover.resize((width, height), Image.LANCZOS).save(target, "WEBP", quality=82, method=6)
        print(f"{target.name}: {width} x {height}, {target.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
