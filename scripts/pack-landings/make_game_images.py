"""Imágenes de las pantallas reales del Desafío para las landings del pack.

Entrada: los PNG con transparencia que deja capture_games.mjs en scripts/pack-landings/_cache/juegos/.
Salida: pack/img/juego-<nombre>-400.webp (la tarjeta de cada juego) y pack/img/desafio-grilla-400.webp
(los 30 días). No dibuja nada: solo achica y comprime las capturas.

Uso, desde la raíz del repo:  python scripts/pack-landings/make_game_images.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "pack-landings" / "_cache" / "juegos"
OUT = ROOT / "pack" / "img"
WIDTH = 400

for png in sorted(SRC.glob("*.png")):
    name = "desafio-grilla" if png.stem == "grilla" else png.stem
    im = Image.open(png)
    if png.stem == "grilla":
        im = im.convert("RGB")
    height = round(im.height * WIDTH / im.width)
    im = im.resize((WIDTH, height), Image.LANCZOS)
    dest = OUT / f"{name}-{WIDTH}.webp"
    im.save(dest, "WEBP", quality=82, method=6)
    print(f"{dest.name}: {WIDTH}x{height}, {dest.stat().st_size / 1024:.1f} KB")
