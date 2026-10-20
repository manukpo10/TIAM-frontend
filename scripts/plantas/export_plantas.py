"""Exporta las plantas de las 7 áreas cognitivas a archivos livianos para la web: public/plantas/<versión>/ (por defecto v1).

Las plantas son las del jardín de las tapas de los Cuadernos TIAM (TIAM-pack, `scripts/jardin_arte.py`, 2026-10-18): una planta de papel recortado por área, recoloreada
al color exacto de su área (AREA_COLOR). Este script NO modifica nada del motor del pack: importa `prepare()` (recorte + recoloreo, con su transparencia) y solo lee
las semillas elegidas de `assets/ilustraciones/jardin/manifest.json`.

Python con numpy, cv2 y Pillow (con WebP y AVIF): el del venv de ComfyUI.
  C:\\Users\\Manu\\ComfyUI\\venv\\Scripts\\python.exe scripts\\plantas\\export_plantas.py [--version=v1] [--pack=<carpeta de TIAM-pack>] [--vista=<carpeta de pruebas>]

Salida (todo con transparencia; el nombre lleva el slug del área: orientacion, memoria, atencion, lenguaje, calculo, razonamiento, visuoespacial):
  <slug>-48.webp, <slug>-96.webp   icono en 1x y 2x (caja de 4:5; se muestra de 24 a 48 px de alto). Cada archivo, menos de 4 KB.
  <slug>-g.webp                    la planta entera, para los brotes de la portada (240 px de alto: se muestra a 120 px en 2x).
  jardin-800.webp / jardin-1600.webp (+ .avif)   la franja del pie de página: las 7 plantas asomando. La de 1600 px, menos de 60 KB.

Las cuotas de peso las comprueba tests/plantas-assets.test.ts (npm test).

CUIDADO CON LA CACHÉ: vercel.json sirve public/plantas/v1/ con `Cache-Control: immutable` por un año. Si el arte cambia, NO se pisa v1: se exporta a una carpeta nueva
(`--version=v2`), se cambia PLANTS_DIR en src/lib/areaPlants.ts y la regla de vercel.json, y las pruebas marcan lo que quede apuntando a v1 (tests/plantas-assets.test.ts guarda
la huella de cada archivo de la versión vigente: si cambia, falla y dice esto mismo).
"""
from __future__ import annotations

import importlib.util
import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
PLANTS = REPO / "public" / "plantas"
DEFAULT_PACK = Path(r"C:\Users\Manu\OneDrive - UTN FRLP\Documentos\TIAM\TIAM-pack")

# Orden de la clave de colores de las tapas (COLOR_KEY) y su slug de archivo.
AREAS = ["orientacion", "memoria", "atencion", "lenguaje", "calculo", "razonamiento", "visuoespacial"]

ICON_BOX = (48, 60)  # 4:5, en 1x; la de 2x es el doble
ICON_PAD = 2
GROW_HEIGHT = 240

# La franja del pie: (área, centro como fracción del ancho, ancho de la planta en px sobre 1600, alto visible en px sobre el alto de la franja, plano).
BAND_W, BAND_H = 1600, 250
BAND = [
    ("orientacion", 0.085, 250, 196, 1),
    ("memoria", 0.215, 232, 226, 3),
    ("atencion", 0.355, 290, 238, 1),
    ("lenguaje", 0.495, 270, 200, 3),
    ("calculo", 0.635, 270, 232, 1),
    ("razonamiento", 0.765, 236, 212, 3),
    ("visuoespacial", 0.905, 290, 214, 2),
]


def args_of(argv: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for a in argv:
        if a.startswith("--"):
            k, _, v = a[2:].partition("=")
            out[k] = v or "true"
    return out


def load_engine(pack: Path):
    spec = importlib.util.spec_from_file_location("jardin_arte", pack / "scripts" / "jardin_arte.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def chosen_plants(engine) -> dict[str, dict]:
    """Las plantas con veredicto «elegida» en el manifiesto del pack (una por área)."""
    manifest = engine.read_manifest()
    picked: dict[str, dict] = {}
    for subject in manifest["subjects"]:
        if subject["id"].startswith("planta-"):
            for rnd in subject["rounds"]:
                for cand in rnd["candidates"]:
                    if cand["verdict"] == "elegida":
                        picked[subject["area"]] = cand
    missing = [a for a in AREAS if a not in picked]
    if missing:
        raise SystemExit(f"Faltan plantas elegidas en el manifiesto: {', '.join(missing)}")
    return picked


def to_rgba(prepared: dict) -> Image.Image:
    rgba = np.dstack([prepared["rgb"], prepared["alpha"] * 255.0]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def crop_to_ink(im: Image.Image) -> Image.Image:
    box = im.getchannel("A").point(lambda v: 255 if v > 5 else 0).getbbox()
    return im.crop(box)


def fit_in_box(im: Image.Image, width: int, height: int, pad: int) -> Image.Image:
    """La planta entera dentro de una caja transparente, apoyada abajo (como crece en la tapa)."""
    ink = crop_to_ink(im)
    scale = min((width - 2 * pad) / ink.width, (height - 2 * pad) / ink.height)
    small = ink.resize((max(1, round(ink.width * scale)), max(1, round(ink.height * scale))), Image.LANCZOS)
    box = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    box.alpha_composite(small, ((width - small.width) // 2, height - pad - small.height))
    return box


def encode(im: Image.Image, path: Path, **options) -> int:
    buffer = io.BytesIO()
    fmt = "AVIF" if path.suffix == ".avif" else "WEBP"
    im.save(buffer, fmt, **options)
    path.write_bytes(buffer.getvalue())
    return len(buffer.getvalue())


# ---- la franja del pie ---------------------------------------------------------------------------------------------------------------------------------------

def shift(a: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[dy:h, dx:w] = a[0 : h - dy, 0 : w - dx]
    return out


def compose_band(plants: dict[str, dict], scale: float = 1.0) -> Image.Image:
    """Las 7 plantas, de atrás hacia adelante, sobre un lienzo transparente. Cada una asoma con su copa y su tallo se corta en el borde de abajo (la franja apoya sobre el pie)."""
    w, h = round(BAND_W * scale), round(BAND_H * scale)
    rgb = np.zeros((h, w, 3), np.float32)  # color premultiplicado
    alpha = np.zeros((h, w), np.float32)
    for area, cx, plant_w, visible, _z in sorted(BAND, key=lambda it: it[4]):
        p = plants[area]
        # Se recorta al tinte: el ancho pedido fija la escala; el alto sale de la proporción de la planta.
        s = plant_w * scale / p["w"]
        nw, nh = max(round(p["w"] * s), 2), max(round(p["h"] * s), 2)
        interp = cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC
        prgb = cv2.resize(p["rgb"], (nw, nh), interpolation=interp) / 255.0
        pa = np.clip(cv2.resize(p["alpha"], (nw, nh), interpolation=interp), 0, 1)
        x0 = round(cx * w - nw / 2)
        y0 = round(h - visible * scale)  # la punta de la planta queda a `visible` px del borde de abajo
        cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x0 + nw, w), min(y0 + nh, h)
        if cx1 <= cx0 or cy1 <= cy0:
            continue
        sub_rgb = prgb[cy0 - y0 : cy1 - y0, cx0 - x0 : cx1 - x0]
        sub_a = pa[cy0 - y0 : cy1 - y0, cx0 - x0 : cx1 - x0]
        # sombra suave de papel pegado: corta, hacia abajo y a la derecha, sobre lo que hay debajo (y sobre el aire: queda un velo oscuro transparente)
        full = np.zeros((h, w), np.float32)
        full[cy0:cy1, cx0:cx1] = sub_a
        sh = cv2.GaussianBlur(shift(full, max(round(5 * scale), 1), max(round(8 * scale), 1)), (0, 0), 6 * scale) * 0.30
        rgb *= (1 - sh)[..., None]
        alpha = alpha + sh * (1 - alpha)
        region_rgb = rgb[cy0:cy1, cx0:cx1]
        region_a = alpha[cy0:cy1, cx0:cx1]
        rgb[cy0:cy1, cx0:cx1] = region_rgb * (1 - sub_a[..., None]) + sub_rgb * sub_a[..., None]
        alpha[cy0:cy1, cx0:cx1] = region_a * (1 - sub_a) + sub_a
    straight = np.where(alpha[..., None] > 1e-4, rgb / np.maximum(alpha[..., None], 1e-4), 0)
    out = np.dstack([straight * 255.0, alpha * 255.0]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main(argv: list[str]) -> None:
    args = args_of(argv)
    pack = Path(args.get("pack", str(DEFAULT_PACK)))
    engine = load_engine(pack)
    picked = chosen_plants(engine)
    version = args.get("version", "v1")
    out = PLANTS / version
    out.mkdir(parents=True, exist_ok=True)
    preview = Path(args["vista"]) if "vista" in args else None
    if preview:
        preview.mkdir(parents=True, exist_ok=True)

    plants = {area: engine.prepare(area, picked[area]["file"]) for area in AREAS}
    report: dict[str, dict] = {}

    for area in AREAS:
        cut = to_rgba(plants[area])
        sizes = {}
        for scale, quality, alpha_quality in ((1, 70, 70), (2, 55, 60)):
            icon = fit_in_box(cut, ICON_BOX[0] * scale, ICON_BOX[1] * scale, ICON_PAD * scale)
            sizes[f"{ICON_BOX[0] * scale}"] = encode(icon, out / f"{area}-{ICON_BOX[0] * scale}.webp", quality=quality, alpha_quality=alpha_quality, method=6)
        ink = crop_to_ink(cut)
        grow = ink.resize((round(ink.width * GROW_HEIGHT / ink.height), GROW_HEIGHT), Image.LANCZOS)
        sizes["g"] = encode(grow, out / f"{area}-g.webp", quality=62, alpha_quality=70, method=6)
        sizes["g_px"] = f"{grow.width}x{grow.height}"
        sizes["seed"] = picked[area]["seed"]
        report[area] = sizes

    for scale, name in ((0.5, "jardin-800"), (1.0, "jardin-1600")):
        band = compose_band(plants, scale)
        webp = encode(band, out / f"{name}.webp", quality=50, alpha_quality=55, method=6)
        avif = encode(band, out / f"{name}.avif", quality=45, speed=4)
        report[name] = {"px": f"{band.width}x{band.height}", "webp": webp, "avif": avif}
        if preview:
            for bg_name, bg in (("crema", (253, 249, 235, 255)), ("blanco", (255, 255, 255, 255)), ("pizarra", (245, 248, 252, 255))):
                base = Image.new("RGBA", band.size, bg)
                base.alpha_composite(band)
                base.convert("RGB").save(preview / f"{name}-{bg_name}.png")

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
