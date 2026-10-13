"""Subconjuntos WOFF2 de Sora y Plus Jakarta Sans para las landings del pack.

Por qué existe: el sitio pide estas dos tipografías a Google Fonts, lo que suma dos dominios y
dos viajes de red antes de poder pintar texto. Las landings salen de anuncios en celular, a
veces con mala conexión, así que las servimos desde el mismo dominio, recortadas a latín y con
el eje de peso limitado a lo que se usa.

Uso, desde la raíz del repo:
    python scripts/pack-landings/make_fonts.py [--src RUTA_A_TIAM-pack/assets/fonts]

Entrada: las fuentes variables de TIAM-pack/assets/fonts (SIL Open Font License 1.1: permiten
incluirlas en un producto, ver OFL-*.txt en esa carpeta).
Salida: pack/fonts/sora-latin.woff2 y pack/fonts/jakarta-latin.woff2.

No hace falta el paquete `brotli` de Python: si falta, se usa el brotli de Node (zlib) mediante
un módulo de reemplazo que fontTools no distingue del original.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import types
from pathlib import Path


def install_brotli_shim() -> None:
    """Si no hay `brotli`, registra uno mínimo que comprime con zlib de Node."""
    try:
        import brotli  # noqa: F401

        return
    except ImportError:
        pass

    js = (
        "const z=require('zlib');const c=[];"
        "process.stdin.on('data',d=>c.push(d));"
        "process.stdin.on('end',()=>{const b=Buffer.concat(c);"
        "const r=z.brotliCompressSync(b,{params:{"
        "[z.constants.BROTLI_PARAM_MODE]:+process.argv[1],"
        "[z.constants.BROTLI_PARAM_QUALITY]:11,"
        "[z.constants.BROTLI_PARAM_LGWIN]:22,"
        "[z.constants.BROTLI_PARAM_SIZE_HINT]:b.length}});"
        "process.stdout.write(r)})"
    )
    js_dec = (
        "const z=require('zlib');const c=[];"
        "process.stdin.on('data',d=>c.push(d));"
        "process.stdin.on('end',()=>process.stdout.write(z.brotliDecompressSync(Buffer.concat(c))))"
    )

    mod = types.ModuleType("brotli")
    mod.MODE_GENERIC, mod.MODE_TEXT, mod.MODE_FONT = 0, 1, 2

    def compress(data, mode=0, quality=11, lgwin=22, lgblock=0):  # noqa: ARG001
        return subprocess.run(
            ["node", "-e", js, str(mode)], input=bytes(data), capture_output=True, check=True
        ).stdout

    def decompress(data):
        return subprocess.run(
            ["node", "-e", js_dec], input=bytes(data), capture_output=True, check=True
        ).stdout

    mod.compress = compress
    mod.decompress = decompress
    sys.modules["brotli"] = mod


install_brotli_shim()

from fontTools import subset  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib import instancer  # noqa: E402

# Latín como lo recorta Google Fonts, sin los combinantes ni lo que estas páginas no usan.
UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + [0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC]
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026]
    + [0x2039, 0x203A, 0x20AC, 0x2122, 0x2212]
)

# (archivo de origen, archivo de salida, rango del eje de peso)
JOBS = [
    ("Sora-Variable.ttf", "sora-latin.woff2", (600, 800)),
    ("PlusJakartaSans-Variable.ttf", "jakarta-latin.woff2", (400, 700)),
]


def build(src: Path, dst: Path, wght: tuple[int, int]) -> None:
    font = TTFont(src)

    # Primero recortar y después limitar el eje: al revés, fontTools pierde `.notdef` en gvar.
    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "case"]
    opts.hinting = False
    opts.glyph_names = False
    opts.notdef_outline = True
    opts.name_IDs = [1, 2, 3, 4, 6]
    opts.name_legacy = False
    opts.name_languages = [0x409]
    opts.drop_tables = list(opts.drop_tables) + ["STAT", "DSIG"]

    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)

    font = instancer.instantiateVariableFont(font, {"wght": wght})
    font.flavor = "woff2"
    dst.parent.mkdir(parents=True, exist_ok=True)
    font.save(dst)


def check(dst: Path) -> str:
    """Reabre el archivo para confirmar que es un WOFF2 válido y con el eje esperado."""
    f = TTFont(dst)
    axes = ", ".join(f"{a.axisTag} {a.minValue:g}-{a.maxValue:g} (def {a.defaultValue:g})" for a in f["fvar"].axes)
    return f"{f['maxp'].numGlyphs} glifos, eje {axes}"


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=str(repo.parent / "TIAM-pack" / "assets" / "fonts"))
    args = ap.parse_args()

    for name_in, name_out, wght in JOBS:
        src = Path(args.src) / name_in
        dst = repo / "pack" / "fonts" / name_out
        build(src, dst, wght)
        print(f"{name_out}: {dst.stat().st_size / 1024:.1f} KB; {check(dst)}")


if __name__ == "__main__":
    main()
