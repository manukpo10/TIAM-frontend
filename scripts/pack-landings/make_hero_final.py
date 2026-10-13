"""Genera de una vez la imagen principal (hero) elegida de cada landing del pack y la imagen para compartir (og) con el mismo dibujo.

Elegidas por el dueño (2026-10-13): familias = variante C ("Para compartir": la ilustración en tinta de una madre con su hija, los cuatro
cuadernillos de área y el Pack, con "120 fichas"); profesionales = variante A ("Abanico de valor": el Pack al frente y los 12 cuadernillos en abanico
sobre azul de marca, con "120 fichas", en su edición profesional). Las dos con tapas y hojas REALES (nada de fotos de personas).

Cada hero sale en dos recortes y tres anchos, para el `<picture>` de las landings:
    pack/img/hero-<slug>-1x1-{480,800,1200}.webp   recorte 1:1, hasta 1023 px de ancho de pantalla (el celular)
    pack/img/hero-<slug>-4x3-{480,800,1200}.webp   recorte 4:3, desde 1024 px (escritorio)
y la imagen para compartir 1200 x 630 (mitad izquierda con logo, etiqueta y titular de plates/og-<slug>-base.jpg; a la derecha el hero 4:3 y el
cartel "Producto digital: PDF para imprimir en casa" abajo):
    public/pack/og-<slug>.jpg

UN SOLO COMANDO, desde la raíz del repo (el Python del venv de ComfyUI trae numpy; no se instala nada ni se necesita ComfyUI andando):
    C:\\Users\\Manu\\ComfyUI\\venv\\Scripts\\python.exe scripts/pack-landings/make_hero_final.py

Opciones: --solo familias|profesionales, --que hero,og, --calidad 76 (480 px; 800 baja 2 y 1200 baja 8), --img RUTA, --og RUTA.
Requiere las tapas dibujadas en scripts/pack-landings/_cache/covers (python scripts/pack-landings/render_covers.py, con el Python que trae PyMuPDF;
volver a correrlo cuando cambien las tapas de TIAM-pack) y las ilustraciones de TIAM-pack/assets/ilustraciones/portadas (solo lectura).
Para ver las otras variantes (A a F) y sus recortes: make_hero_variants.py. Esto reemplaza al "hero" y al "og" de make_mockup.py (la maqueta con
fotos de FLUX): no volver a correr `make_mockup.py --que hero,og` o se pisarían estos.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import hero_lib as L
import make_hero_variants as V

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PLATES = HERE / "plates"
LABEL = "Producto digital: PDF para imprimir en casa"

# slug de la landing -> (edición, variante elegida)
CHOSEN = {"familias": ("familia", "c"), "profesionales": ("profesional", "a")}
WIDTHS = (480, 800, 1200)
# Los anchos grandes (pantallas de 3x) bajan algo la calidad: el de 1200 px del recorte 1:1 de familias pesaría 167 KB a 76.
QUALITY_DROP = {480: 0, 800: 2, 1200: 8}


def save_webp(img: Image.Image, path: Path, quality: int) -> None:
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"  {path.name}  {img.width}x{img.height}  {path.stat().st_size / 1024:.1f} KB")


def og_image(slug: str, hero43: Image.Image) -> Image.Image:
    """1200 x 630: se conserva la mitad izquierda de plates/og-<slug>-base.jpg y a la derecha va el hero 4:3 con el cartel de honestidad abajo."""
    base = Image.open(PLATES / f"og-{slug}-base.jpg").convert("RGB")
    w, h = base.size
    arr = np.asarray(base).astype(np.float64)
    # El fondo es un degradado suave: se ajusta un plano por canal con las franjas de arriba y abajo (sin contenido) y se repinta la derecha.
    rows = list(range(2, 36)) + list(range(566, 604))
    A, B = [], []
    for y in rows:
        for x in range(0, w, 12):
            A.append([1.0, x, y])
            B.append(arr[y, x])
    coef, *_ = np.linalg.lstsq(np.array(A), np.array(B), rcond=None)
    yy, xx = np.mgrid[0:h, 0:w]
    plane = np.stack([coef[0, c] + coef[1, c] * xx + coef[2, c] * yy for c in range(3)], axis=-1)
    split = 643  # el texto del titular y la bajada termina en x = 638 (profesionales)
    arr[:612, split:] = plane[:612, split:]  # lo de abajo (la barra de colores) no se toca
    canvas = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    pw = 504
    ph = round(hero43.height * pw / hero43.width)
    pic = hero43.convert("RGBA").resize((pw, ph), Image.LANCZOS)
    mask = Image.new("L", pic.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=20, fill=255)
    x0, y0 = 672, 104
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 10, x0 + pw, y0 + ph + 10), radius=20, fill=(22, 38, 63, 70))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.paste(pic, (x0, y0), mask)
    font = ImageFont.truetype(str(L.FONT_JAKARTA), 17)
    try:
        font.set_variation_by_axes([700])
    except Exception:
        pass
    draw = ImageDraw.Draw(canvas)
    left, top, right, bottom = draw.textbbox((0, 0), LABEL, font=font)
    lw, lh = right - left + 36, bottom - top + 22
    lx, ly = x0 + (pw - lw) // 2, y0 + ph + 26
    draw.rounded_rectangle((lx, ly, lx + lw, ly + lh), radius=lh // 2, fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=1)
    draw.text((lx + 18 - left, ly + 11 - top), LABEL, font=font, fill=(22, 38, 63, 255))
    return canvas.convert("RGB")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--solo", default="", help="familias o profesionales (por defecto, las dos)")
    ap.add_argument("--que", default="hero,og")
    ap.add_argument("--calidad", type=int, default=76)
    ap.add_argument("--img", default=str(REPO / "pack" / "img"), help="carpeta de los WebP del hero")
    ap.add_argument("--og", default=str(REPO / "public" / "pack"), help="carpeta de las imágenes para compartir (og-*.jpg)")
    args = ap.parse_args()
    wanted = set(args.que.split(","))
    for slug, (edition, key) in CHOSEN.items():
        if args.solo and args.solo != slug:
            continue
        print(f"{slug}: variante {key.upper()}, edición {edition}")
        masters = {ratio: V.render(key, edition, ratio) for ratio in ("4x3", "1x1")}
        if "hero" in wanted:
            out = Path(args.img)
            out.mkdir(parents=True, exist_ok=True)
            for ratio, master in masters.items():
                for width in WIDTHS:
                    save_webp(master.resize((width, round(master.height * width / master.width)), Image.LANCZOS), out / f"hero-{slug}-{ratio}-{width}.webp", args.calidad - QUALITY_DROP[width])
        if "og" in wanted:
            out = Path(args.og)
            out.mkdir(parents=True, exist_ok=True)
            target = out / f"og-{slug}.jpg"
            og_image(slug, masters["4x3"]).save(target, quality=90, optimize=True, progressive=True)
            print(f"  {target.name}  1200x630  {target.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
