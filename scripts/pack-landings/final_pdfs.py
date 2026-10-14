"""Dónde están los PDF FINALES del pack (los que se venden) y cómo los usan los scripts de imágenes de las landings.

TIAM-pack arma la entrega con `npm run entrega` en `Proyecto Digitales/pack/venta/`:

    pack-basico-<familias|profesionales>/<A4|Carta>/00-Empeza-aca.pdf, 01-Memoria-Nivel-1.pdf ... 12-Calculo-Nivel-3.pdf
    cuadernillo-extra-1/Cuadernillo-Extra-1-<Familias|Profesionales>-<A4|Carta>.pdf

Los scripts de imágenes (make_images.py, render_covers.py, render_hero_pages.py) leían los PDF de muestra y de revisión (con la etiqueta «Borrador» en el pie, que había que
tapar a mano). Con la versión final las páginas ya vienen limpias: acá se las busca por el mismo nombre de muestra que usaban (`cuadernillo-atencion-n2-a4-profesional.pdf`,
`portadas-a4-familia.pdf`...) para no tocar nada más. Son las mismas fichas (misma semilla) y las mismas páginas, salvo el pie y la página 4 de «Empezá acá».
"""

from __future__ import annotations

import re
from pathlib import Path

import fitz  # PyMuPDF

REPO = Path(__file__).resolve().parents[2]
VENTA = REPO.parents[1] / "Proyecto Digitales" / "pack" / "venta"

KIND = {"familia": "familias", "profesional": "profesionales"}
PAPER = {"a4": "A4", "letter": "Carta"}
AREA = {"memoria": "Memoria", "atencion": "Atencion", "lenguaje": "Lenguaje", "calculo": "Calculo"}
AREAS = list(AREA)


def booklet_path(venta: Path, edition: str, paper: str, area: str, level: int) -> Path:
    """`edition`: familia o profesional; `paper`: a4 o letter; `area`: memoria, atencion, lenguaje o calculo."""
    n = AREAS.index(area) * 3 + level
    return venta / f"pack-basico-{KIND[edition]}" / PAPER[paper] / f"{n:02d}-{AREA[area]}-Nivel-{level}.pdf"


def start_here_path(venta: Path, edition: str, paper: str) -> Path:
    return venta / f"pack-basico-{KIND[edition]}" / PAPER[paper] / "00-Empeza-aca.pdf"


def extra_path(venta: Path, edition: str, paper: str, volume: int = 1) -> Path:
    return venta / f"cuadernillo-extra-{volume}" / f"Cuadernillo-Extra-{volume}-{KIND[edition].capitalize()}-{PAPER[paper]}.pdf"


def covers_doc(venta: Path, edition: str, paper: str = "a4") -> fitz.Document:
    """Un PDF con la tapa del Pack (página 1) y las 12 tapas de cuadernillo (2 a 13, memoria, atención, lenguaje, cálculo y nivel 1, 2, 3): lo mismo que `portadas-a4-<edicion>.pdf`."""
    out = fitz.open()
    pages = [start_here_path(venta, edition, paper)] + [booklet_path(venta, edition, paper, area, level) for area in AREAS for level in (1, 2, 3)]
    for path in pages:
        with fitz.open(path) as src:
            out.insert_pdf(src, from_page=0, to_page=0)
    return out


def open_sample(venta: Path, name: str) -> fitz.Document:
    """Abre, desde la entrega final, el PDF que los scripts pedían con el nombre de una muestra (cuadernillo-<area>-n<nivel>-<papel>-<edicion>.pdf, portadas-a4-<edicion>.pdf o cuadernillo-extra-<n>-<edicion>-a4.pdf)."""
    if m := re.fullmatch(r"cuadernillo-(memoria|atencion|lenguaje|calculo)-n([123])-(a4|letter)-(familia|profesional)\.pdf", name):
        area, level, paper, edition = m.groups()
        path = booklet_path(venta, edition, paper, area, int(level))
    elif m := re.fullmatch(r"portadas-(a4|letter)-(familia|profesional)\.pdf", name):
        return covers_doc(venta, m.group(2), m.group(1))
    elif m := re.fullmatch(r"cuadernillo-extra-(\d+)-(familia|profesional)-(a4|letter)\.pdf", name):
        path = extra_path(venta, m.group(2), m.group(3), int(m.group(1)))
    else:
        raise SystemExit(f"No sé en qué archivo final está «{name}».")
    return fitz.open(stream=path.read_bytes(), filetype="pdf")  # desde bytes: no se bloquea ni se toca el archivo
