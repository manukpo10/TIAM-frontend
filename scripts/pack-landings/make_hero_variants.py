"""Variantes de la imagen principal (hero) de las landings del pack, con las tapas y hojas REALES (nada de fotos de personas).

Contexto: la imagen actual (cuadernillos inclinados sobre una mesa de madera) no convence. La investigación de qué vende está en
`Proyecto Digitales/pack/hero-investigacion.md`: tapas de frente y grandes, fondo de color saturado, un número en una insignia, contenido real a
la vista. Cada variante sale en dos recortes: 4:3 (computadora y tablet, lo que usa hoy la página) y 1:1 (celular, más alto: vende más).

Requiere numpy y Pillow (en esta PC: el Python del venv de ComfyUI, `C:\\Users\\Manu\\ComfyUI\\venv\\Scripts\\python.exe`) y haber corrido antes
render_covers.py y render_hero_pages.py (PyMuPDF). No se instala nada. Solo escribe en `scripts/pack-landings/_cache/hero/variants`.

Uso, desde la raíz del repo:
    <python con numpy> scripts/pack-landings/make_hero_variants.py [--edicion familia|profesional] [--variantes a,b,c] [--recortes 4x3,1x1]

Todo texto dentro de la imagen es verdadero y sale del pack: "120 fichas", "12 cuadernillos", "4 áreas · 3 niveles", "A4 y Carta", "PDF". Sin
calificaciones, sin "más vendido", sin sellos inventados. El cartel "Producto digital: PDF para imprimir en casa" lo pone la página, pegado
abajo a la izquierda (por eso lo importante queda por encima de Ctx.safe_bottom).
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image

import hero_lib as L
from hero_lib import AREAS, Ctx

HERE = Path(__file__).resolve().parent
OUT = HERE / "_cache" / "hero" / "variants"
SIZES = {"4x3": (1200, 900), "1x1": (1000, 1000)}
NAMES12 = [f"{a}-n{n}" for a in AREAS for n in (1, 2, 3)]


# --- A. El valor de un vistazo: la tapa del Pack al frente y las 12 de cuadernillo en abanico (cuatro colores) sobre azul de marca ---
def variant_a(ctx: Ctx) -> None:
    W, H, ed, sq = ctx.w, ctx.h, ctx.edition, ctx.square
    L.radial(ctx, (W * 0.5, H * 0.42), [(0, (78, 168, 244)), (0.5, (36, 124, 216)), (1, (14, 64, 132))], radius=max(W, H) * 0.85)
    L.glow(ctx, (W / 2, H * 0.44), H * 0.36, L.WHITE, 0.20)
    pack_h = H * (0.72 if not sq else 0.62)
    top = H * (0.085 if not sq else 0.20)
    card_h = H * (0.56 if not sq else 0.50)
    span = 64 if not sq else 54
    pivot = (W / 2, top + pack_h * 0.90)
    R = card_h * 0.60
    order = list(range(0, 6)) + list(range(11, 5, -1))  # de afuera hacia el centro: cada una tapa un poco a la anterior, a los dos lados
    for i in order:
        area, level = AREAS[i // 3], i % 3 + 1
        th = -span + 2 * span * i / 11
        c = L.edge(L.cover(ed, f"{area}-n{level}", ctx.px(card_h)))
        cx, cy = pivot[0] + R * math.sin(math.radians(th)), pivot[1] - R * math.cos(math.radians(th))
        L.shadowed(ctx, c, (cx, cy), angle=-th, strength=0.75, lift=0.8)
    L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(pack_h))), (W / 2, top + pack_h / 2), 0, thickness=3, strength=1.2)
    if not sq:
        L.badge(ctx, (W * 0.875, H * 0.20), H * 0.28, "120", "fichas")
        L.pill(ctx, (W * 0.02, H * 0.045), "12 cuadernillos", 40, fg=L.WHITE, bg=L.NAVY, pad_x=22, pad_y=12)
        L.pill(ctx, (W * 0.02, H * 0.045 + 66), "4 áreas · 3 niveles", 34, fg=L.NAVY, bg=L.WHITE, pad_x=20, pad_y=10)
    else:
        L.badge(ctx, (W * 0.865, H * 0.20), H * 0.25, "120", "fichas")
        L.pill(ctx, (W * 0.035, H * 0.04), "12 cuadernillos", 42, fg=L.WHITE, bg=L.NAVY, pad_x=22, pad_y=12)
        L.pill(ctx, (W * 0.035, H * 0.04 + 70), "4 áreas · 3 niveles", 36, fg=L.NAVY, bg=L.WHITE, pad_x=20, pad_y=10)


# --- B. Lo que hay adentro: cuatro hojas reales (una por área) abiertas en abanico, con la tapa del Pack atrás ----------------------
def variant_b(ctx: Ctx) -> None:
    W, H, ed, sq = ctx.w, ctx.h, ctx.edition, ctx.square
    L.radial(ctx, (W * 0.5, H * 0.45), [(0, (255, 236, 150)), (0.55, (255, 208, 60)), (1, (236, 160, 18))], radius=max(W, H) * 0.85)
    L.glow(ctx, (W * 0.55, H * 0.45), H * 0.34, L.WHITE, 0.30)
    if not sq:
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.50))), (W * 0.15, H * 0.585), -5, thickness=3, strength=1.0)
        specs = [("sopa", 0.355, 0.50, -5), ("piramides", 0.545, 0.52, 1.5), ("cambio", 0.735, 0.50, 6)]
        ph = H * 0.68
        def late() -> None:
            L.badge(ctx, (W * 0.115, H * 0.17), H * 0.25, "120", "fichas", angle=-8, fill=L.NAVY, ink=L.YELLOW)
            L.pill(ctx, (W * 0.62, H * 0.045), ("Cada ficha, con su guía y su solucionario" if ed == "profesional" else "Así son las fichas por dentro"), 42 if ed != "profesional" else 38, fg=L.NAVY, bg=L.WHITE, pad_x=26, pad_y=13, align="center")
    else:
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.46))), (W * 0.17, H * 0.47), -6, thickness=3, strength=1.0)
        specs = [("sopa", 0.37, 0.55, -6), ("piramides", 0.565, 0.57, 2), ("cambio", 0.755, 0.55, 8)]
        ph = H * 0.60
        def late() -> None:
            L.badge(ctx, (W * 0.86, H * 0.14), H * 0.22, "120", "fichas", angle=8, fill=L.NAVY, ink=L.YELLOW)
            L.pill(ctx, (W * 0.035, H * 0.05), ("Cada ficha, con su guía y su solucionario" if ed == "profesional" else "Así son las fichas por dentro"), 40 if ed != "profesional" else 32, fg=L.NAVY, bg=L.WHITE, pad_x=24, pad_y=12)
    pro = ed == "profesional"  # la edición profesional vende la guía, el solucionario y el registro de la sesión: se muestran la ficha y sus guías
    if pro:
        specs = [(k, x, y, a) for (k, x, y, a) in zip(("sopa", "sopa-guia", "piramides-guia"), [t[1] for t in specs], [t[2] for t in specs], [t[3] for t in specs])]
    for key, x, y, ang in specs:
        L.shadowed(ctx, L.edge(L.page(ed, key, ctx.px(ph)), line=(205, 205, 205)), (W * x, H * y), -ang, strength=1.0)
    late()


# --- C. Para compartir: la ilustración en tinta de un adulto mayor con su acompañante, grande, y los cuadernillos reales ----------------
def framed(ctx: Ctx, im: Image.Image, border: float = 9, radius: float = 22) -> Image.Image:
    b, r = ctx.px(border), ctx.px(radius)
    out = Image.new("RGBA", (im.width + 2 * b, im.height + 2 * b), L.WHITE + (255,))
    out.paste(L.rounded(im, max(2, r - b)), (b, b))
    return L.rounded(out, r)


def variant_c(ctx: Ctx) -> None:
    W, H, ed, sq = ctx.w, ctx.h, ctx.edition, ctx.square
    L.linear(ctx, (255, 238, 200), (250, 184, 102))
    L.glow(ctx, (W * 0.35, H * 0.40), H * 0.40, L.WHITE, 0.35)
    art_name = "memoria" if ed == "familia" else "lenguaje"
    art = Image.open(L.ILUS / f"{art_name}-print-crema.png").convert("RGB")
    aw = W * (0.70 if not sq else 0.86)
    ah = aw * art.height / art.width
    pic = framed(ctx, art.resize((ctx.px(aw), ctx.px(ah)), Image.LANCZOS).convert("RGBA"))
    ax, ay = (W * 0.385, H * 0.45) if not sq else (W * 0.5, H * 0.34)
    L.shadowed(ctx, pic, (ax, ay), 2.5, strength=1.0, lift=1.2)
    if not sq:
        L.shadowed(ctx, L.edge(L.cover(ed, "atencion-n1", ctx.px(H * 0.46))), (W * 0.695, H * 0.55), -10, strength=0.9)
        L.shadowed(ctx, L.edge(L.cover(ed, "memoria-n1", ctx.px(H * 0.46))), (W * 0.745, H * 0.57), -2, strength=0.9)
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.64))), (W * 0.815, H * 0.52), 5, thickness=3, strength=1.1)
        L.badge(ctx, (W * 0.12, H * 0.16), H * 0.26, "120", "fichas", angle=-8, fill=L.BLUE, ink=L.WHITE)
    else:
        for i, area in enumerate(AREAS):  # los cuatro de área en hilera, cada uno tapado un poco por el siguiente, y el Pack al frente a la derecha
            L.shadowed(ctx, L.edge(L.cover(ed, f"{area}-n1", ctx.px(H * 0.285))), (W * (0.125 + 0.172 * i), H * (0.74 + 0.004 * i)), (-3.0, -1.0, 1.0, 3.0)[i], strength=0.9)
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.44))), (W * 0.84, H * 0.70), 4, thickness=3, strength=1.1)
        L.badge(ctx, (W * 0.14, H * 0.11), H * 0.23, "120", "fichas", angle=-8, fill=L.BLUE, ink=L.WHITE)


# --- F. Carpetas de colores: las cuatro áreas con sus tres niveles apilados detrás de la tapa del Pack, sobre un azul profundo --------
def variant_f(ctx: Ctx) -> None:
    W, H, ed, sq = ctx.w, ctx.h, ctx.edition, ctx.square
    L.radial(ctx, (W * 0.5, H * 0.45), [(0, (62, 96, 190)), (0.55, (34, 54, 130)), (1, (14, 22, 58))], radius=max(W, H) * 0.85)
    L.glow(ctx, (W / 2, H * 0.45), H * 0.34, (180, 205, 255), 0.18)
    if not sq:
        card_h, step, front_top, dy, pack_h, pack_top = H * 0.42, W * 0.232, H * 0.17, H * 0.032, H * 0.58, H * 0.31
    else:
        card_h, step, front_top, dy, pack_h, pack_top = H * 0.33, W * 0.222, H * 0.20, H * 0.030, H * 0.52, H * 0.35
    for gi, area in enumerate(AREAS):
        cx = W / 2 + (gi - 1.5) * step
        for j, level in enumerate((3, 2, 1)):
            top_y = front_top - dy * (2 - j) * 1.0
            x_off = (2 - j) * dy * 0.45
            c = L.edge(L.cover(ed, f"{area}-n{level}", ctx.px(card_h)))
            L.shadowed(ctx, c, (cx + x_off, top_y + card_h / 2), (gi - 1.5) * -1.2, strength=0.8, lift=0.8)
    L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(pack_h))), (W / 2, pack_top + pack_h / 2), 0, thickness=3, strength=1.3)
    L.badge(ctx, (W * 0.865, H * 0.69) if not sq else (W * 0.84, H * 0.72), H * (0.27 if not sq else 0.24), "120", "fichas")
    L.pill(ctx, (W * 0.5, H * 0.045), "12 cuadernillos · 4 áreas · 3 niveles", 38 if not sq else 34, fg=L.NAVY, bg=L.YELLOW, pad_x=26, pad_y=12, align="center")


# --- D. Mesa vista desde arriba: la tapa del Pack y las cuatro de área, rectas y legibles, sobre una mesa de madera con lápiz, taza y anteojos ---
SCENE_D = HERE / "_cache" / "hero" / "scenes" / "mesa-plana-s20271001.png"  # FLUX.2 klein 4B, semilla 20271001: solo la mesa y los objetos


def variant_d(ctx: Ctx) -> None:
    W, H, ed, sq = ctx.w, ctx.h, ctx.edition, ctx.square
    L.photo(ctx, SCENE_D, zoom=1.0, anchor=(0.45, 0.5))
    soft = dict(strength=0.9, lift=0.45)
    if not sq:
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.70))), (W * 0.30, H * 0.50), -2, thickness=2, **soft)
        grid = [("memoria-n1", 0.585, 0.385, -1.5), ("atencion-n1", 0.755, 0.40, 1.8), ("lenguaje-n1", 0.595, 0.725, 1.2), ("calculo-n1", 0.76, 0.735, -2)]
        bh = H * 0.31
    else:
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.52))), (W * 0.5, H * 0.30), -1.5, thickness=2, **soft)
        grid = [(f"{a}-n1", 0.5 + (i - 1.5) * 0.222, 0.715, (-2.0, 1.5, -1.0, 2.0)[i]) for i, a in enumerate(AREAS)]
        bh = H * 0.30
    for name, x, y, ang in grid:
        L.shadowed(ctx, L.edge(L.cover(ed, name, ctx.px(bh))), (W * x, H * y), ang, thickness=1, **soft)
    if not sq:
        L.badge(ctx, (W * 0.925, H * 0.50), H * 0.21, "120", "fichas", angle=8, fill=L.NAVY, ink=L.YELLOW)
    else:
        L.badge(ctx, (W * 0.82, H * 0.33), H * 0.23, "120", "fichas", angle=8, fill=L.NAVY, ink=L.YELLOW)


# --- E. Papel + pantalla: el pack impreso y, como opcional, el Desafío de 30 días en el celular (pantalla real del juego) ---------------
GAME = HERE / "_cache" / "juegos" / "juego-lista-mercado.png"


def variant_e(ctx: Ctx) -> None:
    W, H, ed, sq = ctx.w, ctx.h, ctx.edition, ctx.square
    L.radial(ctx, (W * 0.5, H * 0.45), [(0, (110, 200, 104)), (0.55, (52, 150, 60)), (1, (20, 84, 36))], radius=max(W, H) * 0.85)
    L.glow(ctx, (W * 0.45, H * 0.45), H * 0.36, L.WHITE, 0.22)
    if not sq:
        L.shadowed(ctx, L.edge(L.cover(ed, "lenguaje-n1", ctx.px(H * 0.50))), (W * 0.47, H * 0.46), 9, strength=0.8)
        L.shadowed(ctx, L.edge(L.cover(ed, "atencion-n1", ctx.px(H * 0.50))), (W * 0.40, H * 0.47), 4, strength=0.8)
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.68))), (W * 0.29, H * 0.54), -3, thickness=3, strength=1.2)
        L.phone(ctx, GAME, (W * 0.73, H * 0.50), H * 0.70, 3)
        L.badge(ctx, (W * 0.085, H * 0.125), H * 0.21, "120", "fichas", angle=-8, fill=L.NAVY, ink=L.YELLOW)
        L.pill(ctx, (W * 0.73, H * 0.745), "Opcional: juegos en el celular", 36, fg=L.NAVY, bg=L.YELLOW, pad_x=22, pad_y=11, align="center")
    else:
        L.shadowed(ctx, L.edge(L.cover(ed, "atencion-n1", ctx.px(H * 0.40))), (W * 0.36, H * 0.40), 6, strength=0.8)
        L.shadowed(ctx, L.edge(L.cover(ed, "pack", ctx.px(H * 0.55))), (W * 0.27, H * 0.50), -3, thickness=3, strength=1.2)
        L.phone(ctx, GAME, (W * 0.72, H * 0.50), H * 0.62, 3)
        L.badge(ctx, (W * 0.14, H * 0.14), H * 0.23, "120", "fichas", angle=-8, fill=L.NAVY, ink=L.YELLOW)
        L.pill(ctx, (W * 0.72, H * 0.70), "Opcional: juegos en el celular", 34, fg=L.NAVY, bg=L.YELLOW, pad_x=22, pad_y=10, align="center")


VARIANTS = {"a": variant_a, "b": variant_b, "c": variant_c, "d": variant_d, "e": variant_e, "f": variant_f}


def render(key: str, edition: str, ratio: str) -> Image.Image:
    w, h = SIZES[ratio]
    ctx = Ctx(w, h, edition)
    VARIANTS[key](ctx)
    return L.finish(ctx)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--edicion", default="familia")
    ap.add_argument("--variantes", default=",".join(VARIANTS))
    ap.add_argument("--recortes", default="4x3,1x1")
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()
    out = Path(args.out) / args.edicion
    out.mkdir(parents=True, exist_ok=True)
    for key in args.variantes.split(","):
        for ratio in args.recortes.split(","):
            img = render(key, args.edicion, ratio)
            target = out / f"hero-{key.upper()}-{ratio}.png"
            img.save(target)
            print(f"  {target.name} {img.width}x{img.height}")


if __name__ == "__main__":
    main()
