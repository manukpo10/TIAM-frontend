"""Herramientas para componer las variantes de la imagen principal (hero) de las landings del pack con las tapas y hojas REALES.

Todo con numpy + Pillow, sin descargas. Las medidas se dan en "unidades de diseño" (el lienzo es de 1200 x 900 en 4:3 y de 1000 x 1000 en
1:1) y se dibujan al doble (S = 2) para que, al reducir al tamaño final, los bordes queden suaves.

Zona libre: la landing pega abajo a la izquierda el cartel blanco "Producto digital: PDF para imprimir en casa" (341 x 30 px sobre una imagen de
358 px de ancho en el celular). Tapa cerca del 15 % inferior: lo importante va por encima de `Ctx.safe_bottom`.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CACHE = HERE / "_cache"
COVERS = CACHE / "covers"
PAGES = CACHE / "hero" / "pages"
PACK = REPO.parent / "TIAM-pack"
FONT_SORA = PACK / "assets" / "fonts" / "Sora-Variable.ttf"  # SIL OFL 1.1
FONT_JAKARTA = PACK / "assets" / "fonts" / "PlusJakartaSans-Variable.ttf"  # SIL OFL 1.1
ILUS = PACK / "assets" / "ilustraciones" / "portadas"

NAVY = (22, 38, 63)
NIGHT = (13, 24, 40)
BLUE = (27, 111, 196)
ORANGE = (204, 70, 16)
GREEN = (44, 128, 28)
PURPLE = (91, 60, 158)
YELLOW = (255, 210, 63)
CREAM = (253, 249, 235)
WHITE = (255, 255, 255)
AREAS = ("memoria", "atencion", "lenguaje", "calculo")
AREA_COLOR = {"memoria": BLUE, "atencion": ORANGE, "lenguaje": GREEN, "calculo": PURPLE}
AREA_NAME = {"memoria": "Memoria", "atencion": "Atención", "lenguaje": "Lenguaje", "calculo": "Cálculo"}


class Ctx:
    """Un lienzo: tamaño de diseño (w, h), escala S y la edición (familia o profesional)."""

    def __init__(self, w: int, h: int, edition: str, S: int = 2) -> None:
        self.w, self.h, self.S, self.edition = w, h, S, edition
        self.square = abs(w - h) < 10
        self.safe_bottom = h * (0.87 if self.square else 0.84)  # lo importante, por encima de esta altura
        self.canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))

    def px(self, v: float) -> int:
        return int(round(v * self.S))


# --- fuentes ------------------------------------------------------------------------------------------------------
_fonts: dict = {}


def font(kind: str, size: float, weight: int) -> ImageFont.FreeTypeFont:
    key = (kind, round(size), weight)
    if key not in _fonts:
        f = ImageFont.truetype(str(FONT_SORA if kind == "sora" else FONT_JAKARTA), round(size))
        try:
            f.set_variation_by_axes([weight])
        except Exception:  # sin soporte de fuentes variables: queda el peso por defecto
            pass
        _fonts[key] = f
    return _fonts[key]


# --- fondos -------------------------------------------------------------------------------------------------------
def radial(ctx: Ctx, centre: tuple[float, float], stops: list[tuple[float, tuple[int, int, int]]], radius: float, grain: float = 1.2, seed: int = 3) -> None:
    """Fondo en degradado radial (centre y radius en unidades de diseño; stops = [(posición 0..1, color)]) con un grano finito que evita bandas."""
    S = ctx.S
    h, w = ctx.h * S, ctx.w * S
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot(xx - centre[0] * S, yy - centre[1] * S) / (radius * S)
    d = np.clip(d, 0, 1)
    out = np.zeros((h, w, 3), np.float32)
    pos = [p for p, _ in stops]
    for c in range(3):
        out[..., c] = np.interp(d, pos, [col[c] for _, col in stops])
    out += np.random.default_rng(seed).normal(0, grain, (h, w, 1)).astype(np.float32)
    ctx.canvas.alpha_composite(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert("RGBA"))


def linear(ctx: Ctx, top: tuple[int, int, int], bottom: tuple[int, int, int], grain: float = 1.2, seed: int = 4) -> None:
    S = ctx.S
    h, w = ctx.h * S, ctx.w * S
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    out = np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t
    out = np.broadcast_to(out, (h, w, 3)).copy()
    out += np.random.default_rng(seed).normal(0, grain, (h, w, 1)).astype(np.float32)
    ctx.canvas.alpha_composite(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert("RGBA"))


def glow(ctx: Ctx, centre: tuple[float, float], radius: float, colour: tuple[int, int, int], opacity: float) -> None:
    """Resplandor suave (un círculo difuminado) detrás del producto."""
    S = ctx.S
    layer = Image.new("RGBA", ctx.canvas.size, colour + (0,))
    d = ImageDraw.Draw(layer)
    d.ellipse((ctx.px(centre[0] - radius), ctx.px(centre[1] - radius), ctx.px(centre[0] + radius), ctx.px(centre[1] + radius)), fill=colour + (int(255 * opacity),))
    ctx.canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(ctx.px(radius * 0.45))))


# --- tapas y hojas ------------------------------------------------------------------------------------------------
_img_cache: dict = {}


def load_rgba(path: Path, height_px: int) -> Image.Image:
    key = (str(path), height_px)
    if key not in _img_cache:
        im = Image.open(path).convert("RGB")
        w = round(im.width * height_px / im.height)
        _img_cache[key] = im.resize((w, height_px), Image.LANCZOS).convert("RGBA")
    return _img_cache[key].copy()


def cover(edition: str, name: str, height_px: int) -> Image.Image:
    """La tapa real: name = 'pack' o '<area>-n<nivel>'."""
    return load_rgba(COVERS / f"{edition}-{name}.png", height_px)


def page(edition: str, key: str, height_px: int) -> Image.Image:
    return load_rgba(PAGES / f"{edition}-{key}.png", height_px)


def edge(im: Image.Image, line: tuple[int, int, int] = (214, 208, 190), width: int = 2) -> Image.Image:
    """Filo fino alrededor de la hoja: la separa del fondo y se parece al canto de un papel."""
    out = im.copy()
    ImageDraw.Draw(out).rectangle((0, 0, out.width - 1, out.height - 1), outline=line + (255,), width=width)
    return out


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=radius, fill=255)
    out = im.copy()
    out.putalpha(ImageChops.multiply(out.getchannel("A"), mask))
    return out


def shadowed(ctx: Ctx, card: Image.Image, centre: tuple[float, float], angle: float = 0.0, thickness: float = 0.0, strength: float = 1.0, lift: float = 1.0, light: tuple[float, float] = (0.35, 0.94)) -> tuple[float, float, float, float]:
    """Apoya `card` (RGBA al tamaño del lienzo maestro) con su centro en `centre` (unidades de diseño) y la gira `angle` grados
    (positivo = antihorario). Tres sombras (contacto, media y ancha) que caen hacia `light`, y un canto de hojas si `thickness` > 0.
    Devuelve el rectángulo que ocupa (x0, y0, x1, y1) en unidades de diseño."""
    S = ctx.S
    rot = card.rotate(angle, resample=Image.BICUBIC, expand=True) if angle else card
    alpha = rot.getchannel("A")
    cx, cy = centre[0] * S, centre[1] * S
    x0, y0 = int(round(cx - rot.width / 2)), int(round(cy - rot.height / 2))
    base = ctx.canvas
    for dist, sigma, opacity in ((3.0, 2.0, 0.40), (10.0, 7.0, 0.28), (28.0, 20.0, 0.20)):
        k = dist * lift
        sh = Image.new("RGBA", rot.size, (6, 14, 30, 0))
        sh.putalpha(alpha.point(lambda v, o=opacity * strength: int(v * o)))
        pad = int(sigma * S * 3)
        big = Image.new("RGBA", (rot.width + 2 * pad, rot.height + 2 * pad), (6, 14, 30, 0))
        big.paste(sh, (pad, pad))
        big = big.filter(ImageFilter.GaussianBlur(sigma * S))
        _paste_clipped(base, big, x0 - pad + int(light[0] * k * S), y0 - pad + int(light[1] * k * S))
    if thickness > 0:
        sheet = Image.new("RGBA", rot.size, (238, 234, 222, 0))
        sheet.putalpha(alpha)
        for i in range(int(thickness), 0, -1):
            _paste_clipped(base, sheet, x0 + int(i * 1.0 * S), y0 + int(i * 1.4 * S))
    _paste_clipped(base, rot, x0, y0)
    return (x0 / S, y0 / S, (x0 + rot.width) / S, (y0 + rot.height) / S)


def _paste_clipped(base: Image.Image, im: Image.Image, x: int, y: int) -> None:
    """alpha_composite con recorte: el recorte puede salirse del lienzo (las tapas del fondo se cortan en el borde a propósito)."""
    sx0, sy0 = max(0, -x), max(0, -y)
    dx0, dy0 = max(0, x), max(0, y)
    w = min(im.width - sx0, base.width - dx0)
    h = min(im.height - sy0, base.height - dy0)
    if w <= 0 or h <= 0:
        return
    base.alpha_composite(im.crop((sx0, sy0, sx0 + w, sy0 + h)), (dx0, dy0))


def photo(ctx: Ctx, path: Path, zoom: float = 1.0, anchor: tuple[float, float] = (0.5, 0.5)) -> None:
    """Foto de fondo que cubre el lienzo (como object-fit: cover), con zoom y punto de anclaje (0 = izquierda/arriba, 1 = derecha/abajo)."""
    im = Image.open(path).convert("RGB")
    k = max(ctx.canvas.width / im.width, ctx.canvas.height / im.height) * zoom
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x = round((ctx.canvas.width - im.width) * anchor[0])
    y = round((ctx.canvas.height - im.height) * anchor[1])
    _paste_clipped(ctx.canvas, im.convert("RGBA"), x, y)


def phone(ctx: Ctx, screen: Path, centre: tuple[float, float], height: float, angle: float = 0.0) -> None:
    """Celular dibujado (marco oscuro, esquinas redondas) con una pantalla REAL del juego adentro. `height` es el alto total en unidades de diseño."""
    scr = Image.open(screen).convert("RGB")
    bez = 15
    sh = ctx.px(height - 2 * bez)
    sw = round(scr.width * sh / scr.height)
    scr = scr.resize((sw, sh), Image.LANCZOS).convert("RGBA")
    scr = rounded(scr, ctx.px(26))
    w, h = sw + 2 * ctx.px(bez), sh + 2 * ctx.px(bez)
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=ctx.px(44), fill=(20, 24, 33, 255))
    d.rounded_rectangle((ctx.px(2), ctx.px(2), w - ctx.px(3), h - ctx.px(3)), radius=ctx.px(42), outline=(70, 78, 96, 255), width=ctx.px(2))
    body.alpha_composite(scr, (ctx.px(bez), ctx.px(bez)))
    shadowed(ctx, body, centre, angle=angle, strength=1.1, lift=1.3)


# --- insignias y cartelitos -------------------------------------------------------------------------------------
def badge(ctx: Ctx, centre: tuple[float, float], diameter: float, big: str, small: str, angle: float = 8.0, fill=YELLOW, ink=NAVY, big_size: float | None = None, small_size: float | None = None) -> None:
    """Insignia redonda con una cifra grande y una palabra abajo ("120" / "fichas"): el número es lo primero que se lee en el celular."""
    S = ctx.S
    d = ctx.px(diameter)
    pad = ctx.px(diameter * 0.12)
    tile = Image.new("RGBA", (d + 2 * pad, d + 2 * pad), (0, 0, 0, 0))
    dr = ImageDraw.Draw(tile)
    ring = ctx.px(diameter * 0.045)
    dr.ellipse((pad, pad, pad + d, pad + d), fill=WHITE + (255,))
    dr.ellipse((pad + ring, pad + ring, pad + d - ring, pad + d - ring), fill=fill + (255,))
    fb = font("sora", ctx.px(big_size or diameter * 0.46), 800)
    fs = font("jakarta", ctx.px(small_size or diameter * 0.17), 800)
    bb = dr.textbbox((0, 0), big, font=fb)
    sb = dr.textbbox((0, 0), small, font=fs)
    gap = ctx.px(diameter * 0.03)
    total = (bb[3] - bb[1]) + gap + (sb[3] - sb[1])
    cy = pad + d / 2 - total / 2
    dr.text((pad + d / 2 - (bb[0] + bb[2]) / 2, cy - bb[1]), big, font=fb, fill=ink + (255,))
    dr.text((pad + d / 2 - (sb[0] + sb[2]) / 2, cy + (bb[3] - bb[1]) + gap - sb[1]), small, font=fs, fill=ink + (255,))
    shadowed(ctx, tile, centre, angle=angle, strength=0.9, lift=0.7)


def pill(ctx: Ctx, anchor: tuple[float, float], text: str, size: float, fg=WHITE, bg=NAVY, pad_x: float = 18, pad_y: float = 10, align: str = "left", angle: float = 0.0, dot: tuple[int, int, int] | None = None, weight: int = 800, strength: float = 0.8) -> tuple[float, float, float, float]:
    """Cartelito redondeado con texto. `anchor` es la esquina izquierda-arriba (align=left), el centro-arriba (center) o la derecha-arriba (right)."""
    f = font("jakarta", ctx.px(size), weight)
    probe = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    bb = probe.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    px_, py_ = ctx.px(pad_x), ctx.px(pad_y)
    dot_w = ctx.px(size * 0.9) if dot else 0
    w, h = tw + 2 * px_ + dot_w, th + 2 * py_
    margin = ctx.px(40)
    tile = Image.new("RGBA", (w + 2 * margin, h + 2 * margin), (0, 0, 0, 0))
    dr = ImageDraw.Draw(tile)
    dr.rounded_rectangle((margin, margin, margin + w, margin + h), radius=h // 2, fill=bg + (255,))
    if dot:
        r = ctx.px(size * 0.30)
        dr.ellipse((margin + px_ * 0.85, margin + h / 2 - r, margin + px_ * 0.85 + 2 * r, margin + h / 2 + r), fill=dot + (255,))
    dr.text((margin + px_ + dot_w - bb[0], margin + py_ - bb[1]), text, font=f, fill=fg + (255,))
    ax, ay = anchor
    cw, ch = w / ctx.S, h / ctx.S
    cx = ax + cw / 2 if align == "left" else ax if align == "center" else ax - cw / 2
    return shadowed(ctx, tile, (cx, ay + ch / 2), angle=angle, strength=strength, lift=0.5)


def finish(ctx: Ctx, vignette: float = 0.0) -> Image.Image:
    im = ctx.canvas.convert("RGB")
    if vignette:
        a = np.asarray(im).astype(np.float32)
        h, w = a.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
        a *= (1.0 - vignette * np.clip(r - 0.6, 0, 1) ** 2)[..., None]
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return im
