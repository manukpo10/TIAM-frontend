"""Arma la hoja de opciones del hero: un PDF (una página por variante, con el celular y el escritorio) y un PNG con todos los celulares lado a lado.

Entradas (las deja render_hero_options.mjs): `--phones` con vista-actual.png, vista-A43.png, vista-A11.png ... (390 x 844 a escala 2) y `--desktop` con
vista-actual.png, vista-A.png ... (1440 x 900). Salidas en `--out`: hero-opciones.pdf y hero-opciones.png.

Uso: <python con Pillow> scripts/pack-landings/make_hero_sheet.py --phones CARPETA --desktop CARPETA --out CARPETA
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin  # noqa: F401  (el guardado a PDF necesita el plugin JPEG cargado)

HERE = Path(__file__).resolve().parent
PACK = HERE.parents[1].parent / "TIAM-pack"
SORA = PACK / "assets" / "fonts" / "Sora-Variable.ttf"
JAKARTA = PACK / "assets" / "fonts" / "PlusJakartaSans-Variable.ttf"
NAVY, PAPER = (22, 38, 63), (253, 249, 235)
COLOR = {"HOY": (110, 120, 140), "A": (27, 111, 196), "B": (214, 150, 0), "C": (204, 70, 16), "D": (140, 96, 50), "E": (44, 128, 28), "F": (91, 60, 158)}

# letra, título, una línea de por qué podría vender
ITEMS = [
    ("HOY", "Imagen actual", "Cuadernillos inclinados sobre madera clara: chicos, sin número ni contenido a la vista."),
    ("A", "Abanico de valor", "Se cuenta de un vistazo: 120 fichas, 12 cuadernillos en cuatro colores y la tapa del Pack, recta y legible, sobre azul de marca."),
    ("B", "Por dentro", "Muestra fichas reales en letra grande (sopa de letras, pirámides, qué cambió): el comprador ve el ejercicio que va a hacer."),
    ("C", "Para compartir", "El gancho emocional: la ilustración de una madre con su hija, grande, con las cuatro áreas legibles, el Pack y el número."),
    ("D", "Mesa desde arriba", "La más creíble: tapas de frente y legibles sobre una mesa real, con taza, lápiz y anteojos. Cálida, sin perspectiva."),
    ("E", "Papel + pantalla", "Suma el celular con una pantalla real del juego. Ojo: el Desafío es opcional y puede confundir qué incluye el Pack."),
    ("F", "Carpetas de colores", "Orden a la vista: las cuatro áreas, cada una con sus tres niveles apilados, detrás de la tapa del Pack."),
]


def f(path: Path, size: int, weight: int) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(path), size)
    try:
        font.set_variation_by_axes([weight])
    except Exception:
        pass
    return font


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    return lines + [cur]


def fit(im: Image.Image, h: int) -> Image.Image:
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def with_frame(im: Image.Image) -> Image.Image:
    out = Image.new("RGB", (im.width + 4, im.height + 4), (205, 208, 215))
    out.paste(im, (2, 2))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--phones", required=True)
    ap.add_argument("--desktop", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    phones, desktop, out = Path(args.phones), Path(args.desktop), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    def phone(key: str, crop: str) -> Image.Image:
        name = "actual" if key == "HOY" else f"{key}{crop}"
        return Image.open(phones / f"vista-{name}.png").convert("RGB")

    def desk(key: str) -> Image.Image:
        return Image.open(desktop / f"vista-{'actual' if key == 'HOY' else key}.png").convert("RGB")

    # --- PDF: una página por variante (A4 apaisado a 150 ppp) -----------------------------------------------------------------
    pages = []
    for key, title, why in ITEMS:
        pg = Image.new("RGB", (1754, 1240), PAPER)
        d = ImageDraw.Draw(pg)
        d.text((60, 40), "HOY" if key == "HOY" else key, font=f(SORA, 300 if key != "HOY" else 190, 800), fill=COLOR[key])
        tfont = f(JAKARTA, 38, 800)
        ty = 380 if key != "HOY" else 280
        for line in wrap(d, title, tfont, 310):
            d.text((64, ty), line, font=tfont, fill=NAVY)
            ty += 50
        body = f(JAKARTA, 30, 500)
        y = ty + 14
        for line in wrap(d, why, body, 300):
            d.text((64, y), line, font=body, fill=(60, 70, 90))
            y += 42
        h = 900
        x = 400
        crops = [("4:3 (como hoy)", "43")] if key == "HOY" else [("4:3 (como hoy)", "43"), ("1:1 (propuesta celular)", "11")]
        if key == "HOY":
            crops = [("Hoy: 4:3, 358 x 269 px", "43")]
        for label, crop in crops:
            im = with_frame(fit(phone(key, crop), h))
            pg.paste(im, (x, 120))
            d.text((x, 120 + h + 24), label, font=f(JAKARTA, 26, 700), fill=NAVY)
            x += im.width + 16
        dk = with_frame(desk(key).resize((506, 316), Image.LANCZOS))
        pg.paste(dk, (1210 if key != "HOY" else 820, 120))
        d.text((1210 if key != "HOY" else 820, 120 + 316 + 24), "Escritorio (1440 px): 498 x 373", font=f(JAKARTA, 26, 700), fill=NAVY)
        pages.append(pg)
    Image.init()
    pages[0].save(out / "hero-opciones.pdf", save_all=True, append_images=pages[1:], resolution=150.0, quality=92)

    # --- PNG: todos los celulares lado a lado, dos filas (4:3 como hoy y 1:1 propuesto) --------------------------------------
    pw = 330
    ph = round(1688 * pw / 780)
    gap, head = 18, 110
    W = len(ITEMS) * (pw + gap) + gap
    sheet = Image.new("RGB", (W, 2 * (ph + head) + 3 * gap + 60), (24, 32, 48))
    d = ImageDraw.Draw(sheet)
    d.text((gap, 14), "Fila de arriba: recorte 4:3, el que usa la página hoy.  Fila de abajo: recorte 1:1, propuesta para el celular.", font=f(JAKARTA, 26, 700), fill=(220, 226, 238))
    for r, crop in enumerate(("43", "11")):
        y0 = 60 + r * (ph + head + gap)
        for i, (key, title, _) in enumerate(ITEMS):
            x0 = gap + i * (pw + gap)
            d.text((x0, y0), key, font=f(SORA, 72, 800), fill=(255, 210, 63))
            d.text((x0 + (88 if key != "HOY" else 190), y0 + 8), "" if key == "HOY" else title, font=f(JAKARTA, 21, 700), fill=(220, 226, 238))
            sheet.paste(phone(key, crop).resize((pw, ph), Image.LANCZOS), (x0, y0 + head - 10))
    sheet.save(out / "hero-opciones.png")
    print(f"  {out / 'hero-opciones.pdf'}  ({len(pages)} páginas)\n  {out / 'hero-opciones.png'}  {sheet.width}x{sheet.height}")


if __name__ == "__main__":
    main()
