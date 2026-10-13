"""Maqueta del cuadernillo impreso para las landings del pack: las tapas REALES compuestas sobre fotos fotorrealistas (FLUX local) de un
cuadernillo A4 en blanco, engrapado, sobre una mesa de madera. Nunca personas.

Honestidad: el producto es un PDF para imprimir en casa. La maqueta muestra lo que la persona termina teniendo (hojas A4 impresas y engrapadas),
con la tapa de verdad del PDF de TIAM-pack. No es un libro de tapa dura de librería.

Requiere numpy, Pillow, SciPy y OpenCV (en esta PC: el Python del venv de ComfyUI, `C:\\Users\\Manu\\ComfyUI\\venv\\Scripts\\python.exe`; no se instala nada).
Las tapas se dibujan antes con render_covers.py (PyMuPDF).

Uso, desde la raíz del repo:
    <python con numpy> scripts/pack-landings/make_mockup.py [--edicion familia|profesional] [--que hero,anuncios,prueba] [--out CARPETA]

Qué hace (ver mockup_lib.py para los detalles):
  1. Halla la tapa en blanco de la foto del cuadernillo (zona clara y poco saturada) y afina sus 4 esquinas a sub-píxel.
  2. Resuelve la homografía con numpy y la aplica con Image.transform(PERSPECTIVE), con supersampling.
  3. Multiplica la tapa real con la luminancia de la tapa en blanco (en luz lineal): quedan la luz, las sombras y las grapas de la foto.
  4. Recorta el cuadernillo, lo gira y lo escala, y lo apoya con sombras sobre una foto de la mesa vacía: así se arma el hero con varios
     cuadernillos (el del Pack adelante y los de las áreas atrás).
"""

from __future__ import annotations

import argparse
import dataclasses
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import mockup_lib as m

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PLATES = HERE / "plates"
COVERS = HERE / "_cache" / "covers"

# La foto del cuadernillo en blanco y la mesa vacía (FLUX.2 klein 4B, ver make_mockup_stills.mjs y pack/img/ilustraciones.json).
STILL = {"file": "still-grapas-s20265503.png", "tl_hint": (200.0, 465.0), "hidden_left_mm": 0.0, "blur": (0.5, 1.5)}
TABLE = {"file": "table-s20265903.png"}
FONT = REPO.parent / "TIAM-pack" / "assets" / "fonts" / "PlusJakartaSans-Variable.ttf"  # SIL OFL 1.1
LABEL = "Producto digital: PDF para imprimir en casa"


@dataclass
class Booklet:
    cover: str  # nombre de la tapa: "<edicion>-pack" o "<edicion>-<area>-n<nivel>"
    cx: float  # centro de la tapa en el lienzo
    cy: float
    angle: float  # grados, positivo = antihorario
    scale: float
    soft: float = 0.0  # desenfoque extra (px): lo que queda más lejos está apenas más fuera de foco


def load(name: str) -> np.ndarray:
    return np.asarray(Image.open(PLATES / name).convert("RGB"))


class Still:
    """La foto del cuadernillo en blanco, con su cuadrilátero, su luz y su recorte, lista para ponerle cualquier tapa."""

    def __init__(self) -> None:
        self.rgb = load(STILL["file"])
        self.h, self.w = self.rgb.shape[:2]
        lum = m.luminance(self.rgb)
        self.quad = m.refine_quad(lum, m.find_cover_quad(self.rgb, STILL["tl_hint"]))
        self.s, self.keep, self.tone = m.shading_map(self.rgb, self.quad)
        self.matte = m.booklet_matte(self.rgb, self.quad)
        self._cache: dict[str, np.ndarray] = {}

    def with_cover(self, name: str) -> np.ndarray:
        if name not in self._cache:
            cover = Image.open(COVERS / f"{name}.png")
            width, height = cover.size
            hidden = round(STILL["hidden_left_mm"] / 210.0 * width)
            visible = cover.crop((hidden, 0, width, height))
            rgb, alpha = m.warp_cover(visible, self.quad, (self.w, self.h))
            rgb, alpha = m.defocus(rgb, alpha, self.quad, *STILL["blur"])
            composite = m.multiply_composite(self.rgb, rgb, alpha, self.s, self.keep, self.tone, tint=0.45)
            # El canto de las hojas (lo que no es la tapa) sale frío en la foto; se lo lleva un poco hacia el cálido de la mesa.
            side = np.clip(self.matte - m.quad_mask(self.quad, (self.w, self.h)), 0.0, 1.0)[..., None]
            warm = np.array([1.025, 1.0, 0.945], dtype=np.float32)
            composite = np.clip(composite.astype(np.float32) * (1.0 + side * (warm - 1.0)), 0, 255).astype(np.uint8)
            self._cache[name] = composite
        return self._cache[name]


def build_scene(table: np.ndarray, still: Still, booklets: list[Booklet], track: np.ndarray | None = None) -> np.ndarray:
    canvas = table.copy()
    for b in booklets:  # de atrás hacia adelante
        photo = still.with_cover(b.cover)
        rgb = m.decontaminate(photo.astype(np.float32), still.matte)
        cut_rgb, cut_alpha, centre = m.pose_cutout(rgb, still.matte, still.quad, b.angle, b.scale)
        if b.soft > 0:
            cut_rgb, cut_alpha = m.soften(cut_rgb, cut_alpha, b.soft)
        canvas = m.paste_with_shadow(canvas, cut_rgb, cut_alpha, centre, (b.cx, b.cy), track=track)
    return canvas


def prepare_table(rgb: np.ndarray, blur: float = 1.1) -> np.ndarray:
    """La mesa, apenas desenfocada: es lo que queda detrás del plano de foco (los cuadernillos), y además la madera sin tanto detalle
    pesa bastante menos en WebP."""
    from scipy import ndimage as ndi

    return np.clip(np.stack([ndi.gaussian_filter(rgb[..., c].astype(np.float32), blur) for c in range(3)], axis=-1), 0, 255).astype(np.uint8)


def finish(scene: np.ndarray, seed: int = 7, grain: float = 1.1, vignette: float = 0.10) -> np.ndarray:
    """Toque final común a toda la escena: grano fino (iguala la mesa y los cuadernillos) y una viñeta muy leve."""
    rng = np.random.default_rng(seed)
    h, w = scene.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    v = 1.0 - vignette * np.clip(r - 0.55, 0, 1) ** 2
    noise = rng.normal(0.0, grain, (h, w, 1)).astype(np.float32)
    out = scene.astype(np.float32) * v[..., None] + noise
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


# Niveles que se muestran en cada edición (los tres niveles a la vista: así se lee que cada área tiene tres).
LEVELS_SHOWN = {
    "familia": {"memoria": 1, "atencion": 2, "lenguaje": 3, "calculo": 1},
    "profesional": {"memoria": 2, "atencion": 1, "lenguaje": 3, "calculo": 2},
}
AREAS = ("memoria", "atencion", "lenguaje", "calculo")


@dataclass
class Format:
    """Un formato de salida: dónde se apoyan los cuadernillos en el lienzo de 1344 x 1344 y qué parte se recorta."""

    crop: tuple[int, int, int, int]  # izquierda, arriba, derecha, abajo
    back_y: float  # altura del centro de los cuadernillos de las áreas (atrás)
    back_scale: float
    back_gap: float  # separación entre centros
    pack_y: float
    pack_scale: float
    fan: float = 8.0  # inclinación de los de las puntas (grados)
    cx: float = 672.0  # centro horizontal del conjunto (se recentra solo, ver fit)
    min_margin: int = 24  # margen libre mínimo (px del lienzo de 1344) entre los cuadernillos y cada borde


FORMATS = {
    "hero": Format(crop=(0, 168, 1344, 1176), back_y=452, back_scale=0.44, back_gap=282, pack_y=830, pack_scale=0.655, min_margin=14),
    "1x1": Format(crop=(0, 0, 1344, 1344), back_y=420, back_scale=0.45, back_gap=272, pack_y=865, pack_scale=0.70),
    "4x5": Format(crop=(134, 0, 1210, 1344), back_y=365, back_scale=0.355, back_gap=212, pack_y=832, pack_scale=0.74, fan=6.0),
}


def layout(fmt: Format, edicion: str) -> list[Booklet]:
    """El del Pack adelante y los cuatro de las áreas atrás, en abanico: las puntas se inclinan hacia afuera."""
    levels = LEVELS_SHOWN[edicion]
    centre = fmt.cx
    offsets = (-1.5, -0.5, 0.5, 1.5)
    angles = (fmt.fan, fmt.fan / 3, -fmt.fan / 3, -fmt.fan)
    items = []
    for area, off, angle in zip(AREAS, offsets, angles):
        # las puntas bajan un poco: el abanico se curva alrededor del Pack
        y = fmt.back_y + 16 * abs(off) ** 1.4
        items.append(Booklet(f"{edicion}-{area}-n{levels[area]}", centre + off * fmt.back_gap, y, angle, fmt.back_scale, soft=0.45))
    items.append(Booklet(f"{edicion}-pack", centre, fmt.pack_y, -1.0, fmt.pack_scale))
    return items


def fit(table: np.ndarray, still: Still, edicion: str, fmt: Format) -> list[Booklet]:
    """Arma la composición y la centra en horizontal (mismo margen a izquierda y derecha del recorte de salida)."""
    for _ in range(2):
        items = layout(fmt, edicion)
        occupied = np.zeros(table.shape[:2], np.float32)
        build_scene(table, still, items, track=occupied)
        x0, _, x1, _ = fmt.crop
        xs = np.nonzero(occupied[:, x0:x1].max(axis=0) > 0.05)[0]
        left, right = int(xs.min()), int((x1 - x0) - 1 - xs.max())
        fmt = dataclasses.replace(fmt, cx=fmt.cx + (right - left) / 2.0)
    return layout(fmt, edicion)


def render(table: np.ndarray, still: Still, edicion: str, fmt_name: str) -> Image.Image:
    fmt = FORMATS[fmt_name]
    items = fit(table, still, edicion, fmt)
    occupied = np.zeros(table.shape[:2], np.float32)
    scene = finish(build_scene(table, still, items, track=occupied))
    x0, y0, x1, y1 = fmt.crop
    ys, xs = np.nonzero(occupied[y0:y1, x0:x1] > 0.05)
    free = {"izquierda": int(xs.min()), "arriba": int(ys.min()), "derecha": int(x1 - x0 - 1 - xs.max()), "abajo": int(y1 - y0 - 1 - ys.max())}
    tight = {k: v for k, v in free.items() if k != "arriba" and v < fmt.min_margin}
    if tight:
        raise SystemExit(f"{edicion} {fmt_name}: los cuadernillos quedan muy pegados al borde (margen libre {free}, mínimo {fmt.min_margin}): ajustar FORMATS")
    print(f"    {edicion} {fmt_name}: margen libre {free}")
    return Image.fromarray(scene).crop(fmt.crop)


def add_label(img: Image.Image, text: str = LABEL) -> Image.Image:
    """Cartel de honestidad para los anuncios: lo que se vende es un PDF para imprimir en casa, no un libro. Arriba a la izquierda, en un
    óvalo blanco con letra navy (Plus Jakarta Sans), con una sombra suave."""
    out = img.convert("RGBA")
    scale = out.width / 1080.0
    font = ImageFont.truetype(str(FONT), round(27 * scale))
    try:
        font.set_variation_by_axes([700])
    except Exception:  # sin soporte de fuentes variables: queda el peso por defecto
        pass
    probe = ImageDraw.Draw(out)
    left, top, right, bottom = probe.textbbox((0, 0), text, font=font)
    pad_x, pad_y, margin = round(26 * scale), round(15 * scale), round(36 * scale)
    w, h = (right - left) + 2 * pad_x, (bottom - top) + 2 * pad_y
    shadow = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((margin, margin + round(4 * scale), margin + w, margin + h + round(4 * scale)), radius=h // 2, fill=(22, 38, 63, 90))
    out = Image.alpha_composite(out, shadow.filter(ImageFilter.GaussianBlur(round(8 * scale))))
    draw = ImageDraw.Draw(out)
    draw.rounded_rectangle((margin, margin, margin + w, margin + h), radius=h // 2, fill=(255, 255, 255, 238))
    draw.text((margin + pad_x - left, margin + pad_y - top), text, font=font, fill=(22, 38, 63, 255))
    return out.convert("RGB")


def save_webp(img: Image.Image, path: Path, quality: int) -> None:
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"  {path.name}  {img.width}x{img.height}  {path.stat().st_size / 1024:.1f} KB")


def og_image(table: np.ndarray, still: Still, edicion: str) -> Image.Image:
    """Imagen para compartir (1200 x 630): se conserva la mitad izquierda de la que ya había (logo, etiqueta, titular y dominio; salen de
    plates/og-<slug>-base.jpg) y a la derecha, en lugar de las tres hojas sueltas en abanico, va la maqueta con las tapas reales y el
    cartel "Producto digital: PDF para imprimir en casa" abajo."""
    base = Image.open(PLATES / f"og-{ {'familia': 'familias', 'profesional': 'profesionales'}[edicion] }-base.jpg").convert("RGB")
    w, h = base.size
    arr = np.asarray(base).astype(np.float64)
    # El fondo es un degradado suave: se ajusta un plano por canal con las franjas de arriba y abajo (sin contenido) y se repinta la derecha.
    ys = list(range(2, 36)) + list(range(566, 604))
    A, B = [], []
    for y in ys:
        for x in range(0, w, 12):
            A.append([1.0, x, y]); B.append(arr[y, x])
    coef, *_ = np.linalg.lstsq(np.array(A), np.array(B), rcond=None)
    yy, xx = np.mgrid[0:h, 0:w]
    plane = np.stack([coef[0, c] + coef[1, c] * xx + coef[2, c] * yy for c in range(3)], axis=-1)
    split = 643  # el texto del titular y la bajada termina en x = 638 (profesionales); el abanico viejo empezaba en x = 647
    arr[:612, split:] = plane[:612, split:]  # lo de abajo (la barra de colores) no se toca
    canvas = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    hero = render(table, still, edicion, "hero").convert("RGBA")
    pw = 504
    ph = round(hero.height * pw / hero.width)
    pic = hero.resize((pw, ph), Image.LANCZOS)
    mask = Image.new("L", pic.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=20, fill=255)
    x0, y0 = 672, 104
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 10, x0 + pw, y0 + ph + 10), radius=20, fill=(22, 38, 63, 70))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.paste(pic, (x0, y0), mask)
    # cartel de honestidad debajo de la imagen
    font = ImageFont.truetype(str(FONT), 17)
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
    ap.add_argument("--edicion", default="", help="familia o profesional (por defecto, las dos)")
    ap.add_argument("--que", default="prueba", help="prueba, hero, og, anuncios (separados por coma)")
    ap.add_argument("--out", default=str(REPO / "pack" / "img"), help="carpeta de los WebP del hero")
    ap.add_argument("--anuncios", default=str(REPO.parent.parent / "Proyecto Digitales" / "pack" / "vistas"), help="carpeta de los PNG de anuncios")
    ap.add_argument("--prueba", default=str(HERE / "_cache" / "mockup"), help="carpeta de las pruebas")
    ap.add_argument("--og", default=str(REPO / "public" / "pack"), help="carpeta de las imágenes para compartir (og-*.jpg)")
    ap.add_argument("--mesa", default="")
    ap.add_argument("--calidad", type=int, default=76)
    args = ap.parse_args()
    if args.mesa:
        TABLE["file"] = args.mesa
    wanted = set(args.que.split(","))
    editions = [args.edicion] if args.edicion else ["familia", "profesional"]
    still = Still()
    print("cuadrilátero de la tapa en blanco:", still.quad.round(2).tolist())
    table = prepare_table(load(TABLE["file"]))
    slug = {"familia": "familias", "profesional": "profesionales"}

    if "prueba" in wanted:
        out = Path(args.prueba)
        out.mkdir(parents=True, exist_ok=True)
        for ed in editions:
            for name in FORMATS:
                target = out / f"{ed}-{name}.png"
                render(table, still, ed, name).save(target)
                print(" ", target.name)
    if "hero" in wanted:
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        for ed in editions:
            hero = render(table, still, ed, "hero")
            for width in (480, 800, 1200):
                save_webp(hero.resize((width, round(hero.height * width / hero.width)), Image.LANCZOS), out / f"hero-{slug[ed]}-{width}.webp", args.calidad)
    if "og" in wanted:
        out = Path(args.og)
        out.mkdir(parents=True, exist_ok=True)
        for ed in editions:
            target = out / f"og-{slug[ed]}.jpg"
            og_image(table, still, ed).save(target, quality=90, optimize=True, progressive=True)
            print(f"  {target.name}  1200x630  {target.stat().st_size / 1024:.0f} KB")
    if "anuncios" in wanted:
        out = Path(args.anuncios)
        out.mkdir(parents=True, exist_ok=True)
        for ed in editions:
            suffix = "" if ed == "familia" else "-profesionales"
            for name, size in (("1x1", (1080, 1080)), ("4x5", (1080, 1350))):
                img = render(table, still, ed, name).resize(size, Image.LANCZOS)
                # El anuncio lleva el cartel adentro (un anuncio de un producto digital no puede parecer un libro físico); también sale sin cartel.
                for kind, final in (("", add_label(img)), ("-sin-cartel", img)):
                    target = out / f"mockup-pack-{name}{suffix}{kind}.png"
                    final.save(target, optimize=True)
                    print(f"  {target.name}  {final.width}x{final.height}  {target.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
