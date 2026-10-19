"""Imágenes de las landings del pack: vistas reales de las fichas, tapas de los cuadernillos y recortes.

Uso, desde la raíz del repo:
    python scripts/pack-landings/make_images.py [--venta RUTA] [--out pack/img] [--solo grupo]
    python scripts/pack-landings/make_images.py --borrador [--muestras RUTA]    (la versión de antes: muestras con etiqueta «Borrador», retocada)

Qué hace
- Lee los PDF FINALES de la entrega (Proyecto Digitales/pack/venta, que arma `npm run entrega` en TIAM-pack; ver final_pdfs.py) por el mismo nombre de muestra que usaba
  antes. Son las mismas fichas y las mismas páginas, ya sin la etiqueta «Borrador» ni la cuenta provisoria del pie: NO se retoca nada. Con `--borrador` vuelve a leer los PDF de
  muestra de TIAM-pack/muestras y les tapa el cartelito, como antes. Se cargan en memoria: no se guarda nada en esas carpetas.
- Renderiza páginas reales con PyMuPDF: las hojas sueltas (hoja de trabajo y guía), la galería
  (la parte de arriba de ocho hojas de trabajo, con su margen blanco de verdad) y las TAPAS REALES
  de los cuadernillos (de `portadas-a4-<edicion>.pdf`, que sale de
  `npm run portadas -- --papel=A4 --edicion=familia|profesional` en TIAM-pack): para cada área, la
  tapa del nivel 1 en la edición de cada landing (los tres niveles se distinguen por los chips de
  la tarjeta, no repitiendo la tapa).
- Solo con `--borrador`: retoca en memoria el cartelito "Borrador" del pie de cada página interior, para que la vista sea la del pack terminado. Con los PDF finales ya no hace
  falta. Las tapas no llevan pie ni "Borrador": no se retocan.
- Recorta, sin caras, detalles de las fotos del taller que ya están en src/assets/taller.
- Convierte a WebP las ilustraciones elegidas de make_illustrations.mjs y escribe su manifiesto.
- `--solo compartir`: la ilustración del bloque "Con este pack no hay nada que preparar" (familias) es la escena aprobada de la portada de
  Memoria (madre mayor e hija con el álbum, estilo "tinta firme"), en su versión de impresión de TIAM-pack (solo lectura).
- Convierte el logo a un WebP chico.

El hero (cuadernillos impresos sobre una mesa, con las tapas reales) ya no sale de acá: lo hace
`make_mockup.py` (ver su encabezado) a partir de fotos hechas con `make_mockup_stills.mjs`.

Cuando el pack esté terminado: volver a correr este script con los PDF finales. Si cambia el
orden o el contenido de las páginas, ajustar PAGES (cada entrada verifica por texto que la
página elegida sea la esperada y avisa si no). Las muestras ahora llevan la tapa (1) y la contratapa
interior (2) antes del índice (3): las fichas empiezan en la página 4. Con el pack completo (120 fichas,
cuadernillos de 10) cada ficha ocupa 2 páginas (hoja de trabajo y guía) o 3 (estudio, recuerdo y guía),
según su tipo: la página de cada ficha se lee en el índice (página 3) de cada muestra.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image, ImageDraw

import final_pdfs

REPO = Path(__file__).resolve().parents[2]

EDGE = (203, 213, 225)  # borde de hoja
FOOT_LINE = (0.7647, 0.8078, 0.8627)  # color de la línea del pie de las fichas

# --- Qué página de qué PDF -------------------------------------------------------------
# clave -> (archivo, página 1-based, textos que deben estar en esa página)
# ("FICHA DE TRABAJO" es el rótulo de la hoja de la persona: la guía no lo lleva, así que la guarda distingue la hoja de su guía, que es la página siguiente.)
PAGES: dict[str, tuple[str, int, list[str]]] = {
    # hoja de trabajo (la persona)
    "sopa-cocina": ("cuadernillo-atencion-n2-a4-profesional.pdf", 4, ["FICHA DE TRABAJO", "Sopa de letras", "cocina"]),
    "piramides": ("cuadernillo-calculo-n2-a4-profesional.pdf", 6, ["FICHA DE TRABAJO", "Pirámides", "sumas"]),
    "cuentas": ("cuadernillo-calculo-n2-a4-profesional.pdf", 4, ["FICHA DE TRABAJO", "Cuentas con cifras"]),
    "lista-estudio": ("cuadernillo-memoria-n2-a4-profesional.pdf", 4, ["ESTUDIO", "oficios"]),
    # ME-RECUERDOS ("Charlas sobre recuerdos"): hoja de trabajo (p.12; la guía es la 13). Nivel 2: tres preguntas con "Prefiero pasar".
    "recuerdos": ("cuadernillo-memoria-n2-a4-profesional.pdf", 12, ["FICHA DE TRABAJO", "Recuerdos de las fiestas", "Cuente lo que recuerde", "Prefiero pasar"]),
    "diferencias": ("cuadernillo-atencion-n2-a4-profesional.pdf", 10, ["FICHA DE TRABAJO", "Encontrar las diferencias"]),
    "anagramas": ("cuadernillo-lenguaje-n2-a4-profesional.pdf", 4, ["FICHA DE TRABAJO", "Palabras desordenadas"]),
    # LE-COMPLETAR ("Completar expresiones y dichos"): hoja de trabajo (p.12; la guía es la 13), con el banco de palabras.
    "completar": ("cuadernillo-lenguaje-n2-a4-profesional.pdf", 12, ["FICHA DE TRABAJO", "Completar expresiones", "Palabras para completar"]),
    # guía de la edición profesional (A4)
    "guia-pro-sopa": ("cuadernillo-atencion-n2-a4-profesional.pdf", 5, ["PROFESIONAL", "Solucionario", "cocina"]),
    # edición familia (Carta): hoja de trabajo y guía "para acompañar"
    "sopa-paises": ("cuadernillo-atencion-n3-letter-familia.pdf", 4, ["FICHA DE TRABAJO", "Sopa de letras", "América"]),
    "guia-familia-sopa": ("cuadernillo-atencion-n3-letter-familia.pdf", 5, ["ACOMPAÑAR", "Solucionario", "América"]),
}

def norm(s: str) -> str:
    return "".join(s.split()).lower()


class Library:
    """PDF cargados desde bytes: no se toca el archivo original. Con `final`, los PDF finales de la entrega (por el nombre de muestra); si no, los de muestra."""

    def __init__(self, folder: Path, final: Path | None = None) -> None:
        self.folder = folder
        self.final = final
        self.docs: dict[str, fitz.Document] = {}

    def pdf(self, name: str) -> fitz.Document:
        if name not in self.docs:
            self.docs[name] = final_pdfs.open_sample(self.final, name) if self.final else fitz.open(stream=(self.folder / name).read_bytes(), filetype="pdf")
        return self.docs[name]

    def page(self, key: str) -> fitz.Page:
        name, number, needles = PAGES[key]
        page = self.pdf(name)[number - 1]
        text = norm(page.get_text())
        missing = [n for n in needles if norm(n) not in text]
        if missing:
            raise SystemExit(
                f"[{key}] {name} p.{number} no contiene {missing}. "
                f"Las muestras cambiaron: actualizar PAGES en make_images.py.\nTexto de la página: {text[:200]}"
            )
        return page


def retouch(page: fitz.Page) -> None:
    """Retoca el pie de la página, solo para la vista previa.

    - Tapa el cartelito "Borrador" y restituye la línea del pie que quedaba debajo.
    - Quita "Página N de M": la cuenta de las muestras no es la del cuadernillo terminado.
    """
    h, w = page.rect.height, page.rect.width
    words = page.get_text("words")

    def union(rects: list[fitz.Rect]) -> fitz.Rect:
        box = rects[0]
        for r in rects[1:]:
            box |= r
        return box

    # cartelito: la línea de texto que empieza con "Borrador:" en la banda del pie
    anchor = next((fitz.Rect(t[:4]) for t in words if t[4].startswith("Borrador") and t[1] > h * 0.91), None)
    if anchor is not None:
        row = [fitz.Rect(t[:4]) for t in words if abs(t[1] - anchor.y0) < 3 and t[0] >= anchor.x0 - 2]
        box = union(row)
        box = fitz.Rect(box.x0 - 8, box.y0 - 5, box.x1 + 9, box.y1 + 5)  # incluye el borde del cartel
        # el cartelito tapaba un tramo de la línea del pie (barra fina): se restituye
        line = next((d["rect"] for d in page.get_drawings() if d["rect"].height < 1.6 and d["rect"].width > w * 0.7 and d["rect"].y0 > h * 0.85), None)
        page.draw_rect(box, color=None, fill=(1, 1, 1), overlay=True)
        if line is not None:
            page.draw_rect(fitz.Rect(max(box.x0 - 4, line.x0), line.y0, min(box.x1 + 4, line.x1), line.y1), color=None, fill=FOOT_LINE, overlay=True)

    # "Página N de M": debajo del cartelito, a la derecha
    folio = [fitz.Rect(t[:4]) for t in words if t[1] > h * 0.938 and t[0] > w * 0.78]
    if folio:
        box = union(folio)
        page.draw_rect(fitz.Rect(box.x0 - 3, box.y0 - 2, box.x1 + 3, box.y1 + 2), color=None, fill=(1, 1, 1), overlay=True)


RETOUCH = False  # solo con --borrador: los PDF finales no llevan etiqueta ni cuenta provisoria


def render(page: fitz.Page, width_px: int, clip: fitz.Rect | None = None) -> Image.Image:
    if RETOUCH:
        retouch(page)
    rect = clip or page.rect
    scale = width_px / rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def with_edge(img: Image.Image, px: int) -> Image.Image:
    img = img.copy()
    ImageDraw.Draw(img).rectangle([0, 0, img.width - 1, img.height - 1], outline=EDGE, width=px)
    return img


def shown(path: Path) -> str:
    try:
        return str(path.relative_to(REPO))
    except ValueError:
        return str(path)


def save_webp(img: Image.Image, path: Path, quality: int = 82, alpha_quality: int = 100) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    kw = {"alpha_quality": alpha_quality} if img.mode == "RGBA" else {}
    img.save(path, "WEBP", quality=quality, method=6, **kw)
    print(f"  {shown(path)}  {img.width}x{img.height}  {path.stat().st_size / 1024:.1f} KB")


# --- Tapas reales: la del nivel 1 de cada área, en la edición de cada landing ------------------------------
AREAS = ("memoria", "atencion", "lenguaje", "calculo")
EDITIONS = {"familia": "familias", "profesional": "profesionales"}
COVER_LEVEL = 1  # los tres niveles de un área tienen casi la misma tapa (cambian los puntos de "Nivel N"): se muestra una y los niveles van en los chips
# Se muestra a 112 px de ancho (celular) o 170 px (tablet y escritorio), en pantallas de 1x a 3x
COVER_WIDTHS = (240, 400)


def cover_page_number(area: str, level: int) -> int:
    """Página (desde 1) de la tapa de un área y nivel en portadas-a4-<edicion>.pdf: la 1 es la tapa del Pack y después van 4 áreas x 3 niveles."""
    return 2 + AREAS.index(area) * 3 + (level - 1)


def cover_image(pdf: fitz.Document, area: str, level: int = COVER_LEVEL, ss: int = 2) -> Image.Image:
    """La tapa real completa (A4, con su margen blanco de impresión), opaca y sin borde ni sombra: el borde fino, las esquinas y la sombra de
    papel impreso los pone el CSS (igual que en las hojas de "Cada ficha son dos hojas"), así la imagen conserva su proporción y no se recorta."""
    return cover_page_image(pdf[cover_page_number(area, level) - 1], ss)  # las tapas no llevan pie: sin retoque


def cover_page_image(page: fitz.Page, ss: int = 2) -> Image.Image:
    scale = max(COVER_WIDTHS) * ss / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def scaled(img: Image.Image, width: int) -> Image.Image:
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


# --- Fotos del taller: solo detalles sin rostros ---------------------------------------
# recorte (izq, arriba, der, abajo) en píxeles de la foto original
TALLER_CROPS = {
    "taller-mesa": ("taller-4.jpg", (330, 1000, 1370, 1780)),
    "taller-cafe": ("taller-1.jpg", (480, 520, 1500, 1285)),
}


def taller_detail(key: str, name: str, box: tuple[int, int, int, int], out: Path) -> None:
    img = Image.open(REPO / "src" / "assets" / "taller" / name).convert("RGB").crop(box)
    # Se muestran a 175-250 px de ancho (dos columnas): 480 px alcanza hasta para pantallas 2x y ahorra ~25 KB de carga inicial.
    save_webp(scaled(img, 480), out / f"{key}-480.webp", quality=72)


# --- Galería: la parte de arriba de hojas de trabajo reales, con su margen blanco ---------------------
# clave de PAGES -> nombre del archivo de salida. Las hojas de trabajo son idénticas en las dos ediciones (se comprobó píxel a píxel
# generando los cuadernillos de familia con la misma semilla; además la edición solo entra en la guía: ver `templates/frame.ts` de
# TIAM-pack), así que un solo juego de imágenes sirve a las dos landings. Dos hojas por área, en este orden (Memoria, Atención, Lenguaje,
# Cálculo); desde el pack completo, Memoria muestra una charla sobre recuerdos (ME-RECUERDOS) y Lenguaje completar expresiones (LE-COMPLETAR),
# que las landings nombran ("charlas sobre recuerdos", "completar frases y dichos").
GALLERY = {
    "lista-estudio": "g-lista",
    "recuerdos": "g-recuerdos",
    "sopa-cocina": "g-sopa",
    "diferencias": "g-diferencias",
    "anagramas": "g-anagramas",
    "completar": "g-completar",
    "cuentas": "g-cuentas",
    "piramides": "g-piramides",
}
# Puntos PDF, A4 (595 x 842). La hoja de lado a lado y desde el borde de arriba: queda su margen blanco real (37 pt a la izquierda y a la
# derecha, unos 30 pt arriba) y se ve como la parte de arriba de una hoja impresa: encabezado, título, consigna y el comienzo del ejercicio.
# El mismo recorte en las ocho, así que todas miden igual de alto (proporción 595:640).
GALLERY_CLIP = fitz.Rect(0, 0, 594.96, 640)
# Desde el punto 572 hasta el 640 la hoja se funde con el blanco del papel: un borde de abajo limpio e igual en las ocho. Donde el ejercicio
# termina antes (sopa de letras, diferencias, cuentas, pirámides) la parte desvanecida ya está en blanco y no se nota.
GALLERY_FADE_FROM = 572
# Ancho de los WebP: se muestran a 213 a 256 px de ancho (celular, tablet y escritorio), en pantallas de 1x y 2x.
GALLERY_WIDTHS = (300, 520)


def fade_to_paper(img: Image.Image, clip: fitz.Rect, start_pt: float) -> Image.Image:
    """Funde el borde de abajo del recorte con el blanco del papel, desde `start_pt` (punto PDF) hasta la última fila de píxeles."""
    y0 = round((start_pt - clip.y0) * img.height / clip.height)
    span = max(img.height - 1 - y0, 1)
    ramp = Image.new("L", (1, img.height), 0)
    px = ramp.load()
    for y in range(y0, img.height):
        t = min((y - y0) / span, 1.0)
        px[0, y] = round(255 * t * t * (3 - 2 * t))  # smoothstep: sin escalón ni al empezar ni al terminar
    return Image.composite(Image.new("RGB", img.size, (255, 255, 255)), img, ramp.resize(img.size))


# --- Ilustraciones de FLUX: WebP con variantes y manifiesto -------------------------------
ILLUSTRATION_WIDTHS = {"wide": (480, 800), "square": (240, 400)}

# --- Ilustración de "Con este pack no hay nada que preparar" (familias) -----------------------------------------------
# Desde el estilo nuevo de las tapas (opción C2, "tinta firme") ya no es una escena aparte: es la escena aprobada de la portada de Memoria, sin
# recortar (ya es de 3:2), en la versión de impresión de TIAM-pack (fondo en blanco puro, con el tratamiento de tinta). Mismas medidas que la
# anterior (480 y 800 px de ancho): el HTML no cambia. La consigna y la semilla salen del manifiesto de TIAM-pack, para que quede escrito de dónde viene.
SHARING_SUBJECT = "portada-memoria"


def sharing_illustration(out: Path) -> None:
    import json

    pack = REPO.parent / "TIAM-pack" / "assets" / "ilustraciones"
    subject = next(s for s in json.loads((pack / "manifest.json").read_text(encoding="utf-8"))["subjects"] if s["id"] == SHARING_SUBJECT)
    record = next(r for r in subject["rounds"] if r["round"] == subject["chosenRound"])
    source = pack / subject["print"]["file"]
    img = Image.open(source).convert("RGB")
    files = []
    for w in ILLUSTRATION_WIDTHS["wide"]:
        # La textura del arte nuevo pesa más que el arte plano anterior: con calidad 66 los dos WebP pesan un 25 % menos (22 y 54 KB) y a 100 % no se
        # distinguen de la calidad 80 (se comparó el recorte de las dos caras). Sin esto la página de familias sumaba +25 KB.
        save_webp(scaled(img, w), out / f"compartir-familia-{w}.webp", quality=66)
        files.append(f"compartir-familia-{w}.webp")
    manifest_path = out / "ilustraciones.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    item = {
        "id": "compartir-familia",
        "files": files,
        "style": record.get("style", ""),
        "seed": subject["chosenSeed"],
        "size": f"{img.width}x{img.height}",
        "prompt": record["prompt"],
        "source": f"TIAM-pack/assets/ilustraciones/{subject['print']['file']} (portada de Memoria: la misma imagen, sin recortar)",
    }
    manifest["items"] = [item if i["id"] == "compartir-familia" else i for i in manifest["items"]]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {shown(manifest_path)}")


def paper_white(img: Image.Image) -> Image.Image:
    """Lleva el fondo claro de la ilustración a blanco puro (se estima con las esquinas)."""
    corners = [img.getpixel(xy) for xy in ((2, 2), (img.width - 3, 2), (2, img.height - 3), (img.width - 3, img.height - 3))]
    bg = [sorted(c[i] for c in corners)[len(corners) // 2] for i in range(3)]
    if min(bg) < 200:  # el fondo no es claro: no tocar
        return img
    lut = [[min(255, round(v * 255 / max(bg[ch], 1))) for v in range(256)] for ch in range(3)]
    return Image.merge("RGB", [img.getchannel(ch).point(lut[ch]) for ch in range(3)])


def illustrations(candidates: Path, chosen: dict[str, int], out: Path) -> None:
    import json

    log = json.loads((candidates / "candidatos.json").read_text(encoding="utf-8"))
    manifest_path = out / "ilustraciones.json"
    # Se conservan las otras secciones del archivo (por ejemplo `mockups`, que escribe a mano make_mockup.py/README): solo se reescriben estas cuatro.
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    manifest.update({"note": "Ilustraciones hechas en local con FLUX.2 klein 4B fp8 (ComfyUI). Solo decorativas y explicativas: no reemplazan fotos reales, testimonios ni vistas del producto.", "generation": log["generation"], "style": log["style"], "items": []})
    for ident, seed in chosen.items():
        item = next(i for i in log["items"] if i["id"] == ident and i["seed"] == seed)
        img = paper_white(Image.open(candidates / item["file"]).convert("RGB"))
        kind = "wide" if item["width"] > item["height"] else "square"
        files = []
        for w in ILLUSTRATION_WIDTHS[kind]:
            save_webp(scaled(img, w), out / f"{ident}-{w}.webp", quality=80)
            files.append(f"{ident}-{w}.webp")
        manifest["items"].append({"id": ident, "files": files, "seed": seed, "size": f"{item['width']}x{item['height']}", "prompt": item["prompt"], "candidate": item["file"]})
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {shown(manifest_path)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--venta", default=str(final_pdfs.VENTA), help="carpeta de la entrega final (pack/venta)")
    ap.add_argument("--borrador", action="store_true", help="usar los PDF de muestra con etiqueta de borrador (y retocarlos), como antes")
    ap.add_argument("--muestras", default=str(REPO.parent / "TIAM-pack" / "muestras"))
    ap.add_argument("--out", default=str(REPO / "pack" / "img"))
    ap.add_argument("--solo", default="", help="grupo: hojas, portadas, extra, galeria, compartir, taller, logo, ilustraciones")
    ap.add_argument("--candidatos", default="", help="carpeta de make_illustrations.mjs (con candidatos.json)")
    ap.add_argument("--elegidas", default="", help='ilustraciones elegidas: "id=semilla,id=semilla"')
    args = ap.parse_args()

    out = Path(args.out)
    global RETOUCH
    RETOUCH = args.borrador
    lib = Library(Path(args.muestras), None if args.borrador else Path(args.venta))
    want = lambda p: (not args.solo and p != 'ilustraciones') or args.solo == p  # noqa: E731

    if want("hero"):
        print("hero: lo arma make_mockup.py (cuadernillos impresos sobre una mesa, con las tapas reales); ver su encabezado")

    if want("hojas"):
        print("hojas sueltas")
        for key, name in (
            ("sopa-paises", "hoja-trabajo-familia"),
            ("guia-familia-sopa", "hoja-guia-familia"),
            ("sopa-cocina", "hoja-trabajo-pro"),
            ("guia-pro-sopa", "hoja-guia-pro"),
        ):
            img = with_edge(render(lib.page(key), 900), 2)
            for w in (480, 720):
                save_webp(scaled(img, w), out / f"{name}-{w}.webp", quality=78)

    if want("portadas"):
        print(f"tapas reales de los cuadernillos (nivel {COVER_LEVEL} de cada área, en la edición de cada landing)")
        for edition, slug in EDITIONS.items():
            pdf = lib.pdf(f"portadas-a4-{edition}.pdf")
            for area in AREAS:
                cover = cover_image(pdf, area)
                for w in COVER_WIDTHS:
                    # Calidad 72: el arte "tinta firme" tiene textura y a 82 las tarjetas pesaban un 25 % más que con el arte plano (13,6 y 28,7 KB contra
                    # 10,9 y 22,4 KB); a 112 o 170 px de ancho no se nota.
                    save_webp(scaled(cover, w), out / f"cuadernillo-{area}-{slug}-{w}.webp", quality=72)

    if want("extra"):
        # La tapa del Cuadernillo extra (página 1 de cuadernillo-extra-1-<edicion>-a4.pdf, que sale de `npm run muestras` o `npm run extra` en TIAM-pack), en la edición de cada landing.
        # Misma regla que las tapas de área: la página completa, sin borde ni sombra (los pone el CSS), a 240 y 400 px.
        print("tapa real del Cuadernillo extra (en la edición de cada landing)")
        for edition, slug in EDITIONS.items():
            cover = cover_page_image(lib.pdf(f"cuadernillo-extra-1-{edition}-a4.pdf")[0])
            for w in COVER_WIDTHS:
                save_webp(scaled(cover, w), out / f"cuadernillo-extra-{slug}-{w}.webp", quality=72)

    if want("galeria"):
        print("galería (la parte de arriba de ocho hojas de trabajo, con su margen blanco)")
        for key, name in GALLERY.items():
            img = fade_to_paper(render(lib.page(key), max(GALLERY_WIDTHS) * 2, clip=GALLERY_CLIP), GALLERY_CLIP, GALLERY_FADE_FROM)
            for w in GALLERY_WIDTHS:
                save_webp(scaled(img, w), out / f"{name}-{w}.webp", quality=70)

    if args.solo == "ilustraciones":
        print("ilustraciones")
        pairs = dict(p.split("=") for p in args.elegidas.split(",") if p)
        illustrations(Path(args.candidatos), {k: int(v) for k, v in pairs.items()}, out)

    if want("compartir"):
        print("ilustración de 'Con este pack no hay nada que preparar' (la escena de la portada de Memoria)")
        sharing_illustration(out)

    if want("taller"):
        print("taller (detalles sin rostros)")
        for key, (name, box) in TALLER_CROPS.items():
            taller_detail(key, name, box, out)

    if want("logo"):
        print("logo")
        logo = Image.open(REPO / "src" / "assets" / "logogrande-sinfondo.png").convert("RGBA")
        small = logo.resize((144, round(144 * logo.height / logo.width)), Image.LANCZOS)
        path = out / "logo-144.webp"
        small.save(path, "WEBP", quality=88, alpha_quality=90, method=6)
        print(f"  {shown(path)}  {small.width}x{small.height}  {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
