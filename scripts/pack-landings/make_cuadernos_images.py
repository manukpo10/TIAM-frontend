"""Imágenes de la landing de los Cuadernos TIAM (/cuadernos) que salen de los PDF FINALES (solo lectura).

Lee `Proyecto Digitales/pack/autoaplicable/salida-color/cuaderno-autoaplicable-N-a4.pdf` (los cuatro cuadernos, A4, a color) con PyMuPDF y deja, con los
MISMOS formatos que las imágenes equivalentes de la landing de familias:

  pack/img/cuadernos-tapa-<1..4>-<240|400>.webp      la tapa de cada cuaderno (240 x 340 y 400 x 566), como `cuadernillo-<area>-*.webp`
  pack/img/cuadernos-hoja-<clave>-<300|520>.webp     el tramo de arriba de una hoja real (300 x 323 y 520 x 560, borde de abajo fundido con el papel), como `g-*.webp`:
                                                       dos por cuaderno (8 en total), ver SHEETS
  pack/img/cuadernos-ejercicio-<480|720>.webp        una hoja entera con su ejemplo resuelto (cuaderno 1, p. 4, «Almanaque al día»), como `hoja-trabajo-*.webp`
  pack/img/cuadernos-soluciones-<480|720>.webp       la hoja de soluciones (cuaderno 1, p. 38), como `hoja-guia-*.webp`
  pack/img/cuadernos-tapas-<480|800|1200>.webp       la tira con las cuatro tapas, del cuaderno 1 al 4
  pack/img/cuadernos-paso-progreso-<240|400>.webp    el panel «Mi progreso» de la hoja «Cómo usar» (cuaderno 1, p. 2), cuadrado, como `paso-*.webp`
  scripts/pack-landings/_cache/covers/cuadernos-N.png las cuatro tapas a 250 ppp, para la maqueta (make_mockup_cuadernos.py; _cache no se versiona)

Solo escribe archivos NUEVOS (nunca toca las imágenes del Pack). Cada página se verifica por su texto antes de usarla: si el PDF cambia y la página ya no es la que se
espera, el script se detiene en lugar de publicar otra hoja.

Uso (el Python del sistema, el que trae PyMuPDF y Pillow):
    python scripts/pack-landings/make_cuadernos_images.py [--pdfs CARPETA] [--out pack/img]
"""

from __future__ import annotations

import argparse
import re
import unicodedata
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[2]
DEFAULT_PDFS = Path(r"C:\Users\Manu\OneDrive - UTN FRLP\Documentos\Proyecto Digitales\pack\autoaplicable\salida-color")

# Dos hojas de cada cuaderno para el abanico de «La colección»: (clave, cuaderno, número de ejercicio, título que tiene que figurar en la hoja)
SHEETS = [
    ("almanaque", 1, 1, "Almanaquealdía"),
    ("sopa", 1, 14, "Sopasobreruedas"),
    ("camino", 2, 24, "Caminodecuentas"),
    ("intruso", 2, 9, "Elcuadrointruso"),
    ("palabras", 3, 25, "Palabrascruzadas"),
    ("laberinto", 3, 26, "Devueltaacasa"),
    ("barras", 4, 19, "Barrasquecuentan"),
    ("trazo", 4, 12, "Uno,A,dos,B"),
]
SHEET_WIDTHS = (300, 520)
COVER_WIDTHS = (240, 400)
FULL_WIDTHS = (480, 720)
STRIP_WIDTHS = (480, 800, 1200)


def norm(text: str) -> str:
    """Texto de la página, normalizado (NFC) y SIN ningún espacio: la tapa deletrea sus letras y los espacios no son confiables."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", text))


def page_of_exercise(doc: fitz.Document, n: int, title: str) -> fitz.Page:
    """La primera página de «Ejercicio n de 30» (los de «mirar y recordar» ocupan dos hojas), comprobando que lleva el título esperado."""
    for page in doc:
        text = norm(page.get_text())
        if f"Ejercicio{n}de30" in text and "Soluciones" not in text[:80]:
            if title not in text:
                raise SystemExit(f"ejercicio {n}: la hoja no dice {title!r}; ¿cambió el PDF?")
            return page
    raise SystemExit(f"no encontré el ejercicio {n}")


def render(page: fitz.Page, width: int) -> Image.Image:
    zoom = width / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def save_webp(img: Image.Image, path: Path, quality: int) -> None:
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"  {path.name}  {img.width}x{img.height}  {path.stat().st_size / 1024:.1f} KB")


def top_of_sheet(page: fitz.Page, width: int) -> Image.Image:
    """El tramo de arriba de la hoja entera, de lado a lado (con su margen blanco real), de 300 x 323 (relación 0,929); el borde de abajo se funde con el blanco del papel."""
    full = render(page, width)
    height = round(width * 323 / 300)
    crop = full.crop((0, 0, width, height))
    fade = round(height * 0.16)
    mask = Image.new("L", crop.size, 0)
    for y in range(fade):
        mask.paste(round(255 * (y + 1) / fade), (0, height - fade + y, width, height - fade + y + 1))
    white = Image.new("RGB", crop.size, (255, 255, 255))
    return Image.composite(white, crop, mask)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdfs", default=str(DEFAULT_PDFS))
    ap.add_argument("--out", default=str(REPO / "pack" / "img"))
    ap.add_argument("--cache", default=str(REPO / "scripts" / "pack-landings" / "_cache" / "covers"))
    ap.add_argument("--calidad", type=int, default=74)
    args = ap.parse_args()
    out, cache, pdfs = Path(args.out), Path(args.cache), Path(args.pdfs)
    out.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)

    docs = {n: fitz.open(pdfs / f"cuaderno-autoaplicable-{n}-a4.pdf") for n in (1, 2, 3, 4)}
    for n, doc in docs.items():
        assert doc[0].rect.width < 600 and doc[0].rect.height > 800, f"cuaderno {n}: no es A4"

    print("tapas")
    covers = []
    for n, doc in docs.items():
        page = doc[0]
        assert f"CUADERNO{n}DE4" in norm(page.get_text()), f"cuaderno {n}: la primera página no es la tapa"
        pix = page.get_pixmap(dpi=250, alpha=False)
        pix.save(cache / f"cuadernos-{n}.png")
        cover = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        covers.append(cover)
        for width in COVER_WIDTHS:
            save_webp(cover.resize((width, round(cover.height * width / cover.width)), Image.LANCZOS), out / f"cuadernos-tapa-{n}-{width}.webp", args.calidad)

    print("hojas de adentro (tramo de arriba)")
    for key, n, number, title in SHEETS:
        page = page_of_exercise(docs[n], number, title)
        for width in SHEET_WIDTHS:
            save_webp(top_of_sheet(page, width), out / f"cuadernos-hoja-{key}-{width}.webp", args.calidad)

    print("hojas enteras")
    ex = page_of_exercise(docs[1], 1, "Almanaquealdía")
    assert "EJEMPLO" in norm(ex.get_text()), "la hoja del ejercicio 1 ya no trae su ejemplo resuelto"
    sol = docs[1][37]
    assert "Soluciones" in norm(sol.get_text()) and "Ejercicio1·Almanaquealdía" in norm(sol.get_text()), "cuaderno 1, p. 38: ya no es la hoja de soluciones"
    for name, page in (("ejercicio", ex), ("soluciones", sol)):
        for width in FULL_WIDTHS:
            save_webp(render(page, width), out / f"cuadernos-{name}-{width}.webp", args.calidad)

    print("panel «Mi progreso»")
    how = docs[1][1]
    assert "MiprogresoPinteelcírculo" in norm(how.get_text()), "cuaderno 1, p. 2: ya no es «Cómo usar»"
    hit = how.search_for("Mi progreso")
    assert hit, "no encontré el panel «Mi progreso»"
    top = hit[0].y0 - 14
    # Solo la parte de la izquierda del panel (el título, las filas con los círculos del 1 al 7 y del 16 al 22, y «Empecé el»), para que se lea en una imagen cuadrada chica.
    clip = fitz.Rect(36, top, 287, min(top + 152, how.rect.height - 70))
    pix = how.get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip, alpha=False)
    panel = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    for size in (240, 400):
        canvas = Image.new("RGB", (size, size), (234, 243, 252))
        pw = round(size * 0.92)
        p = panel.resize((pw, round(panel.height * pw / panel.width)), Image.LANCZOS)
        shadow = Image.new("RGB", (p.width, p.height), (22, 38, 63))
        sm = Image.new("L", canvas.size, 0)
        sm.paste(90, ((size - pw) // 2, (size - p.height) // 2 + 4, (size - pw) // 2 + pw, (size - p.height) // 2 + 4 + p.height))
        sm = sm.filter(ImageFilter.GaussianBlur(size / 40))
        canvas.paste(Image.new("RGB", canvas.size, (22, 38, 63)), (0, 0), sm)
        canvas.paste(p, ((size - pw) // 2, (size - p.height) // 2))
        save_webp(canvas, out / f"cuadernos-paso-progreso-{size}.webp", args.calidad)

    print("tira de las cuatro tapas")
    # Lienzo de 1200 px de ancho: cuatro tapas de izquierda a derecha, con una sombra de papel. Fondo blanco: va dentro de una tarjeta blanca.
    height, pad, gap = 380, 40, 24
    cw = round(covers[0].width * height / covers[0].height)
    scale_h = 1200 / (4 * cw + 3 * gap)  # se ajusta el ancho total a 1200
    canvas = Image.new("RGB", (1200, round((height + 2 * pad) * scale_h)), (255, 255, 255))
    shadow = Image.new("L", canvas.size, 0)
    x = 0.0
    tiles = []
    for cover in covers:
        w, h = round(cw * scale_h), round(height * scale_h)
        tile = cover.resize((w, h), Image.LANCZOS)
        tiles.append((round(x * scale_h), round(pad * scale_h), tile))
        shadow.paste(Image.new("L", (w, h), 120), (round(x * scale_h), round(pad * scale_h) + 8))
        x += cw + gap
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.paste(Image.new("RGB", canvas.size, (22, 38, 63)), (0, 0), shadow.point(lambda v: int(v * 0.45)))
    for px, py, tile in tiles:
        canvas.paste(tile, (px, py))
        # filo fino: la tapa es crema sobre blanco
        edge = Image.new("L", tile.size, 0)
        edge.paste(255, (0, 0, tile.width, 1))
        edge.paste(255, (0, tile.height - 1, tile.width, tile.height))
        edge.paste(255, (0, 0, 1, tile.height))
        edge.paste(255, (tile.width - 1, 0, tile.width, tile.height))
        canvas.paste(Image.new("RGB", tile.size, (222, 226, 232)), (px, py), edge)
    for width in STRIP_WIDTHS:
        save_webp(canvas.resize((width, round(canvas.height * width / canvas.width)), Image.LANCZOS), out / f"cuadernos-tapas-{width}.webp", args.calidad)


if __name__ == "__main__":
    main()
