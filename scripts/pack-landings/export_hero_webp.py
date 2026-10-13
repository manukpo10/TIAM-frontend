"""Exporta las variantes del hero como WebP (480, 800 y 1200 px de ancho, como el srcset de las landings) y como PNG a tamaño completo.

Lee `_cache/hero/variants/<edicion>/hero-<X>-<recorte>.png` (make_hero_variants.py) y deja
  - `_cache/hero/webp/<edicion>/hero-<X>-<recorte>-<ancho>.webp`
  - (opcional, --png-out CARPETA) `hero-<X>.png` (4:3) y `hero-<X>-cuadrada.png` (1:1), tal cual salen del maestro.
Imprime el peso de cada WebP. Calidad 76 y method 6, igual que make_mockup.py.

Uso: <python con Pillow> scripts/pack-landings/export_hero_webp.py [--edicion familia] [--png-out RUTA] [--calidad 76]
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
CACHE = HERE / "_cache" / "hero"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--edicion", default="familia")
    ap.add_argument("--png-out", default="")
    ap.add_argument("--calidad", type=int, default=76)
    args = ap.parse_args()
    src = CACHE / "variants" / args.edicion
    out = CACHE / "webp" / args.edicion
    out.mkdir(parents=True, exist_ok=True)
    print(f"{'variante':<14}" + "".join(f"{w:>10}" for w in (480, 800, 1200)))
    for png in sorted(src.glob("hero-*.png")):
        stem = png.stem  # hero-A-4x3
        im = Image.open(png).convert("RGB")
        sizes = []
        for width in (480, 800, 1200):
            target = out / f"{stem}-{width}.webp"
            im.resize((width, round(im.height * width / im.width)), Image.LANCZOS).save(target, "WEBP", quality=args.calidad, method=6)
            sizes.append(target.stat().st_size / 1024)
        print(f"{stem:<14}" + "".join(f"{s:>8.1f}KB" for s in sizes))
        if args.png_out:
            dest = Path(args.png_out)
            dest.mkdir(parents=True, exist_ok=True)
            key, ratio = stem.split("-")[1], stem.split("-")[2]
            shutil.copyfile(png, dest / (f"hero-{key}.png" if ratio == "4x3" else f"hero-{key}-cuadrada.png"))


if __name__ == "__main__":
    main()
