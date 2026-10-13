"""Escenas de personas de la landing de profesionales, en el estilo "tinta firme" de las tapas del pack: de los candidatos de FLUX a los WebP de pack/img.

Uso, desde la raíz del repo (Python normal: solo Pillow):
    python scripts/pack-landings/make_escenas_pro.py --candidatos RUTA --elegidas sesion-profesional=SEMILLA,paso-registrar=SEMILLA
        [--calidad N] [--tolerancia N] [--out pack/img] [--sin-registrar]

Los candidatos salen de:
    node scripts/pack-landings/make_illustrations.mjs generar --out RUTA --solo=sesion-profesional,paso-registrar [--ronda=N]

Qué hace
- Toma el PNG elegido de cada escena y pasa a BLANCO PURO solo el papel del fondo (el crema liso de las tapas), para que la escena quede sobre la tarjeta blanca
  de la landing sin marco, igual que la de "nada que preparar" de familias. No toca ningún otro color: ni balance de blancos ni aclarado de sombras.
  (Se probó la limpieza de las versiones de impresión de TIAM-pack, `clean_background` de ilustraciones_impresion.py: pensada para tapas donde nada claro
  toca el borde. Acá una prenda clara que sí lo toca (el suéter crema de la profesional, el cárdigan gris) quedaba lavada o virada a azul, y el aclarado de
  sombras de la versión de impresión (pensado para fotocopia en blanco y negro) empalidecía las caras. Por eso este script es propio y no importa nada de allá.)
- El fondo es el papel del cuadro (color uniforme, ruido de ±1 nivel): se marca lo que está a menos de `--tolerancia` niveles por canal del papel y se inunda
  desde el borde, pero SOLO desde puntos del borde rodeados de fondo (un entorno de 11x11 px sin nada que no sea papel): así una prenda crema que toca el
  borde del cuadro no es semilla y no se blanquea.
- Guarda los WebP con los mismos nombres y anchos de siempre (sesion-profesional-480|800 en 3:2, paso-registrar-240|400 en 1:1): el HTML no cambia.
- Actualiza `ilustraciones.json` SOLO en esas escenas (el resto del archivo queda igual): el item nuevo lleva el estilo, la semilla, la consigna completa y el
  candidato; el item anterior (estilo plano) pasa a `retired` con su consigna y su semilla, para poder volver a generarlo. NO usar
  `make_images.py --solo ilustraciones` para esto: ese grupo reescribe `items` con solo lo que se le pasa.
- Antes de pisar nada hay que haber respaldado los WebP viejos (se hizo en pack/img/anteriores/); este script no los respalda.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

REPO = Path(__file__).resolve().parents[2]
WIDTHS = {"wide": (480, 800), "square": (240, 400)}
RETIRED_ON = "2026-10-11"
INK_STYLE = "tinta-firme"
# Claves que se conservan a mano en el item de una escena (por ejemplo las semillas probadas y por qué se descartaron las otras).
KEEP_KEYS = ("seedsTried", "rejected", "notes")

TOLERANCE = 7      # niveles por canal de diferencia con el papel para contarlo como fondo (el papel de FLUX varía ±1: sobra para el grano)
PAPER_ROWS = 12    # el papel se mide en las primeras filas: arriba nunca hay personas
SEED_RADIUS = 5    # una semilla del borde necesita un entorno de (2 * 5 + 1)² px que sea todo fondo
QUALITY = 62       # WebP: el arte con textura pesa más que el plano anterior; a 100 % no se distingue de 80 y mantiene la página cerca del peso de antes


def shown(path: Path) -> str:
    try:
        return str(path.relative_to(REPO))
    except ValueError:
        return str(path)


def paper_color(img: Image.Image) -> tuple[int, int, int]:
    """Color del papel: mediana por canal de las primeras filas, que tienen que ser claras y sin color (si no, el cuadro no tiene papel arriba)."""
    band = img.crop((0, 0, img.width, PAPER_ROWS))
    channels = [sorted(band.getchannel(c).tobytes()) for c in range(3)]
    paper = tuple(ch[len(ch) // 2] for ch in channels)
    if min(paper) < 200 or max(paper) - min(paper) > 40:
        raise SystemExit(f"El borde de arriba no parece papel claro (mediana {paper}): revisar la imagen")
    return paper  # type: ignore[return-value]


def flood(near: bytes, seeds: list[int], w: int, h: int) -> bytearray:
    """Región de `near` (máscara 0/255) conectada con las semillas (4 vecinos)."""
    out = bytearray(w * h)
    stack = []
    for i in seeds:
        if near[i] and not out[i]:
            out[i] = 255
            stack.append(i)
    while stack:
        i = stack.pop()
        x = i % w
        for j, ok in ((i - 1, x > 0), (i + 1, x < w - 1), (i - w, i >= w), (i + w, i < w * (h - 1))):
            if ok and near[j] and not out[j]:
                out[j] = 255
                stack.append(j)
    return out


def white_background(img: Image.Image, tolerance: int) -> tuple[Image.Image, dict]:
    """El papel del fondo a blanco puro; todo lo demás queda como salió de FLUX. Devuelve la imagen y lo que se registra."""
    w, h = img.size
    paper = paper_color(img)
    masks = [ch.point([255 if abs(v - p) <= tolerance else 0 for v in range(256)]) for ch, p in zip(img.split(), paper)]
    near = ImageChops.darker(ImageChops.darker(masks[0], masks[1]), masks[2])
    near = near.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))  # cierra los huecos de 1 a 2 px del grano
    deep = near.filter(ImageFilter.MinFilter(2 * SEED_RADIUS + 1)).tobytes()
    seeds = [x + y * w for y in (0, h - 1) for x in range(w)] + [x + y * w for x in (0, w - 1) for y in range(h)]
    region = flood(near.tobytes(), [i for i in seeds if deep[i]], w, h)
    mask = Image.frombytes("L", (w, h), bytes(region))
    out = Image.composite(Image.new("RGB", (w, h), (255, 255, 255)), img, mask)
    return out, {"paper": list(paper), "tolerance": tolerance, "whitePercent": round(100 * sum(1 for v in region if v) / (w * h), 1)}


def convert(candidates: Path, scene: str, seed: int, out: Path, quality: int, tolerance: int) -> dict:
    log = json.loads((candidates / "candidatos.json").read_text(encoding="utf-8"))
    item = next(i for i in log["items"] if i["id"] == scene and i["seed"] == seed)
    original = Image.open(candidates / item["file"]).convert("RGB")
    final, stats = white_background(original, tolerance)
    kind = "wide" if item["width"] > item["height"] else "square"
    files: list[str] = []
    sizes: list[int] = []
    out.mkdir(parents=True, exist_ok=True)
    for w in WIDTHS[kind]:
        small = final.resize((w, round(final.height * w / final.width)), Image.LANCZOS)
        name = f"{scene}-{w}.webp"
        small.save(out / name, "WEBP", quality=quality, method=6)
        size = (out / name).stat().st_size
        print(f"  {shown(out / name)}  {small.width}x{small.height}  {size / 1024:.1f} KB")
        files.append(name)
        sizes.append(size)
    return {
        "id": scene,
        "files": files,
        "style": INK_STYLE,
        "seed": seed,
        "round": item.get("round", 1),
        "size": f"{item['width']}x{item['height']}",
        "prompt": item["prompt"],
        "candidate": item["file"],
        "background": {"method": "papel del fondo a blanco puro (inundación desde el borde, solo semillas rodeadas de fondo); sin otro retoque de color", **stats},
        "webp": {"quality": quality, "method": 6, "bytes": sizes},
    }


def update_manifest(path: Path, scenes: list[dict]) -> None:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    retired = manifest.setdefault("retired", [])
    for new in scenes:
        index = next(i for i, item in enumerate(manifest["items"]) if item["id"] == new["id"])
        old = manifest["items"][index]
        if old.get("style") != INK_STYLE:
            # Primera vez: el item en estilo plano pasa a `retired`, con lo necesario para volver a generarlo.
            keep = {k: old[k] for k in ("id", "files", "seed", "size", "prompt", "candidate") if k in old}
            retired.append(
                {
                    **keep,
                    "retiredOn": RETIRED_ON,
                    "reason": "Estilo plano anterior (el de los objetos de 'cómo funciona'). Reemplazada por la escena en el estilo 'tinta firme' de las tapas (opción C2): "
                    f"ver el item {new['id']}.",
                    "how": f"Se puede volver a generar con la consigna y la semilla de acá (node scripts/pack-landings/make_illustrations.mjs generar --out <carpeta> --solo={new['id']}-plano; "
                    "misma consigna, tamaño y semilla dan la misma imagen). Los WebP anteriores están en pack/img/anteriores/ (respaldados antes de pisarlos).",
                }
            )
        else:
            for key in KEEP_KEYS:
                if key in old and key not in new:
                    new[key] = old[key]
        manifest["items"][index] = new
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {shown(path)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--candidatos", required=True, help="carpeta de make_illustrations.mjs (con candidatos.json)")
    ap.add_argument("--elegidas", required=True, help='escenas elegidas: "sesion-profesional=SEMILLA,paso-registrar=SEMILLA"')
    ap.add_argument("--calidad", type=int, default=QUALITY, help=f"calidad WebP (por defecto {QUALITY})")
    ap.add_argument("--tolerancia", type=int, default=TOLERANCE, help=f"niveles por canal que cuentan como papel (por defecto {TOLERANCE})")
    ap.add_argument("--out", default=str(REPO / "pack" / "img"))
    ap.add_argument("--sin-registrar", action="store_true", help="no toca ilustraciones.json (para probar calidades en otra carpeta)")
    args = ap.parse_args()

    out = Path(args.out)
    scenes = []
    for pair in [p for p in args.elegidas.split(",") if p]:
        scene, seed = pair.split("=")
        print(f"{scene} (semilla {seed})")
        scenes.append(convert(Path(args.candidatos), scene, int(seed), out, args.calidad, args.tolerancia))
    if not args.sin_registrar:
        print("manifiesto")
        update_manifest(out / "ilustraciones.json", scenes)


if __name__ == "__main__":
    main()
