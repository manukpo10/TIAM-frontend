"""Maqueta de los Cuadernos TIAM: las cuatro tapas REALES (render_cuadernos / make_cuadernos_images.py las deja en _cache/covers) compuestas sobre
la misma foto de un cuadernillo A4 engrapado y la misma mesa de madera que usa make_mockup.py (plates/, FLUX local). Nunca personas.

Reutiliza TODA la técnica de make_mockup.py (homografía, luz multiplicada, recorte, sombras) y solo cambia la composición: cuatro cuadernos
en abanico, del 1 (adelante, a la izquierda) al 4, de modo que el número de cada tapa (arriba a la derecha) queda a la vista.

Salidas (todas NUEVAS; nunca pisa las imágenes del Pack):
  pack/img/cuadernos-hero-<480|800|1200>.webp   hero 4:3 (el de 480 px es el LCP del celular)
  public/pack/og-cuadernos.jpg                   imagen para compartir, 1200 x 630
  public/email/cuadernos.jpg                     imagen del mail de entrega (nombre estable), 3:2

Honestidad: lo que se vende es un PDF para imprimir en casa; la maqueta muestra lo que la persona termina teniendo (hojas A4 impresas y engrapadas)
con las tapas verdaderas. Va siempre con el cartel «Producto digital: PDF para imprimir en casa» (HTML en la página; dentro de la imagen para compartir).

Requiere numpy, Pillow, SciPy y OpenCV: el Python del venv de ComfyUI (`C:\\Users\\Manu\\ComfyUI\\venv\\Scripts\\python.exe`; no se instala nada).

Uso, desde la raíz del repo:
    <python con numpy> scripts/pack-landings/make_mockup_cuadernos.py [--que prueba,hero,og,email]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import make_mockup as mm

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FONTS = Path(r"C:\Users\Manu\OneDrive - UTN FRLP\Documentos\TIAM\TIAM-pack\assets\fonts")
LABEL = mm.LABEL

# Las siete áreas, en el orden de la clave de las tapas (los mismos colores que AREA_COLOR de TIAM-pack): franja inferior de la imagen para compartir.
AREA_COLORS = ["#8F6B00", "#1B6FC4", "#CC4610", "#2C801C", "#5B3C9E", "#0F766E", "#A3225C"]

# Cuadrícula de 2 x 2 apenas desprolija (el 1 y el 2 arriba, el 3 y el 4 abajo, en orden de lectura), apoyada sobre la mesa del lienzo de 1344 x 1344.
# Los de abajo se dibujan al final y tapan un poco el pie de los de arriba: de cada tapa queda a la vista su título y su número.
FORMAT = mm.Format(crop=(0, 168, 1344, 1176), back_y=672, back_scale=0.58, back_gap=250, pack_y=0, pack_scale=0, min_margin=14)
# número: (desplazamiento horizontal desde el centro, centro vertical, ángulo en grados (positivo = antihorario))
POSES = {1: (-292, 518, 2.5), 2: (292, 500, -2.0), 3: (-282, 798, -1.5), 4: (304, 810, 2.0)}


def layout(fmt: mm.Format, _edicion: str) -> list[mm.Booklet]:
    return [mm.Booklet(f"cuadernos-{n}", fmt.cx + POSES[n][0], POSES[n][1], POSES[n][2], fmt.back_scale) for n in (1, 2, 3, 4)]


mm.layout = layout  # make_mockup.fit() y render() llaman a layout() del módulo: se lo cambiamos por el de los cuadernos
mm.FORMATS["cuadernos"] = FORMAT


def font(name: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTS / name), size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:  # sin soporte de fuentes variables: queda el peso por defecto
        pass
    return f


def hero_image(table: np.ndarray, still: mm.Still) -> Image.Image:
    return mm.render(table, still, "cuadernos", "cuadernos")


def hex_rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def og_image(hero: Image.Image) -> Image.Image:
    """1200 x 630, mismo diseño que las del Pack: logo, etiqueta, titular, bajada y dominio a la izquierda, la maqueta a la derecha con su cartel y la franja de color abajo
    (acá, las siete áreas)."""
    w, h = 1200, 630
    # fondo: degradado suave de blanco azulado a blanco
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.clip((xx / w) * 0.55 + (yy / h) * 0.45, 0, 1)[..., None]
    top, bottom = np.array([244, 248, 253], np.float32), np.array([252, 253, 255], np.float32)
    canvas = Image.fromarray(np.clip(top + (bottom - top) * t, 0, 255).astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(canvas)

    logo = Image.open(REPO / "src" / "assets" / "logogrande-sinfondo.png").convert("RGBA")
    lw = 132
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    canvas.alpha_composite(logo, (72, 52))

    # etiqueta
    f_tag = font("PlusJakartaSans-Variable.ttf", 21, 600)
    tag = "Cuadernos TIAM · Para hacer solo/a"
    l, t_, r, b = d.textbbox((0, 0), tag, font=f_tag)
    tw, th = r - l + 44, b - t_ + 24
    d.rounded_rectangle((72, 160, 72 + tw, 160 + th), radius=th // 2, fill=(222, 236, 250, 255), outline=(190, 214, 240, 255), width=1)
    d.text((72 + 22 - l, 160 + 12 - t_), tag, font=f_tag, fill=(21, 67, 111, 255))

    # titular: «120 ejercicios» en azul y el resto en navy (Sora)
    navy, blue = (22, 38, 63), (27, 111, 196)
    lines = [[("120 ejercicios", blue)], [("para hacer solo/a,", navy)], [("a tu ritmo", navy)]]
    size = 66
    while size > 40 and max(sum(font("Sora-Variable.ttf", size, 750).getlength(t) for t, _ in line) for line in lines) > 548:
        size -= 2  # que ninguna línea llegue hasta la imagen de la derecha
    f_h = font("Sora-Variable.ttf", size, 750)
    y = 222
    for line in lines:
        x = 72
        for text, color in line:
            d.text((x, y), text, font=f_h, fill=color)
            x += d.textlength(text, font=f_h)
        y += round(size * 1.18)
    f_sub = font("PlusJakartaSans-Variable.ttf", 28, 400)
    d.text((72, y + 14), "4 cuadernos que suben de nivel, con", font=f_sub, fill=(71, 85, 105))
    d.text((72, y + 14 + 38), "las soluciones al final.", font=f_sub, fill=(71, 85, 105))
    f_dom = font("PlusJakartaSans-Variable.ttf", 24, 600)
    d.text((72, 566), "tiamdigital.com", font=f_dom, fill=(100, 116, 139))

    # maqueta a la derecha, con esquinas redondeadas y sombra
    pw = 504
    ph = round(hero.height * pw / hero.width)
    pic = hero.resize((pw, ph), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", pic.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=20, fill=255)
    x0, y0 = 636, 104
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 10, x0 + pw, y0 + ph + 10), radius=20, fill=(22, 38, 63, 70))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.paste(pic, (x0, y0), mask)
    d = ImageDraw.Draw(canvas)
    f_lab = font("PlusJakartaSans-Variable.ttf", 17, 700)
    l, t_, r, b = d.textbbox((0, 0), LABEL, font=f_lab)
    lw_, lh = r - l + 36, b - t_ + 22
    lx, ly = x0 + (pw - lw_) // 2, y0 + ph + 26
    d.rounded_rectangle((lx, ly, lx + lw_, ly + lh), radius=lh // 2, fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=1)
    d.text((lx + 18 - l, ly + 11 - t_), LABEL, font=f_lab, fill=(22, 38, 63, 255))

    # franja de las siete áreas
    seg = w / 7
    for i, c in enumerate(AREA_COLORS):
        d.rectangle((round(i * seg), h - 14, round((i + 1) * seg), h), fill=hex_rgb(c))
    return canvas.convert("RGB")


def save_webp(img: Image.Image, path: Path, quality: int) -> None:
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"  {path.name}  {img.width}x{img.height}  {path.stat().st_size / 1024:.1f} KB")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--que", default="prueba", help="prueba, hero, og, email (separados por coma)")
    ap.add_argument("--calidad", type=int, default=76)
    args = ap.parse_args()
    wanted = set(args.que.split(","))
    still = mm.Still()
    table = mm.prepare_table(mm.load(mm.TABLE["file"]))
    hero = hero_image(table, still)

    if "prueba" in wanted:
        out = HERE / "_cache" / "mockup"
        out.mkdir(parents=True, exist_ok=True)
        hero.save(out / "cuadernos-hero.png")
        og_image(hero).save(out / "cuadernos-og.png")
        print("  prueba en", out)
    if "hero" in wanted:
        out = REPO / "pack" / "img"
        for width in (480, 800, 1200):
            save_webp(hero.resize((width, round(hero.height * width / hero.width)), Image.LANCZOS), out / f"cuadernos-hero-{width}.webp", args.calidad)
    if "og" in wanted:
        target = REPO / "public" / "pack" / "og-cuadernos.jpg"
        og_image(hero).save(target, quality=90, optimize=True, progressive=True)
        print(f"  {target.name}  1200x630  {target.stat().st_size / 1024:.0f} KB")
    if "email" in wanted:
        # Los clientes de correo no leen WebP: JPEG común (línea de base). 3:2, 1200 x 800 (se muestra a 600 de ancho, 2x).
        target = REPO / "public" / "email" / "cuadernos.jpg"
        crop_h = round(hero.width * 2 / 3)
        top = (hero.height - crop_h) // 2
        mail = hero.crop((0, max(0, top), hero.width, max(0, top) + min(crop_h, hero.height))).resize((1200, 800), Image.LANCZOS)
        mail.save(target, "JPEG", quality=70, optimize=True, progressive=False, subsampling="4:2:0")
        print(f"  {target.name}  1200x800  {target.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
