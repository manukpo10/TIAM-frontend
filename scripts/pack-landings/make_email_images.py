"""Builds the images of the pack delivery email into public/email/.

Email clients do not render WebP (Outlook, older Gmail/Yahoo apps), so these are PNG and JPG. They are served from
a STABLE public URL (https://www.tiamdigital.com/email/<name>) because a sent email keeps pointing at it forever:
do not rename or hash them. The backend builds the URLs from EMAIL_ASSETS_BASE_URL (default
https://www.tiamdigital.com/email) and these exact names (see PackAccessEmailComposer).

  logo-tiam.png            TIAM logo on white, 286x160 (shown at 143x80, 2x), the 429:240 ratio of the landings
  pack-familias.jpg        hero of the Familias landing, 1200x900 (shown at 600x450, 2x)
  pack-profesionales.jpg   hero of the Profesionales landing, same size

Run from the repo root:  python scripts/pack-landings/make_email_images.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "email"
OUT.mkdir(parents=True, exist_ok=True)

# Logo: the real artwork the landings use (src/assets), flattened on white so it stays legible when a client
# darkens the page background, then reduced to a 256-colour PNG (~15 KB instead of ~450 KB).
logo = Image.open(ROOT / "src" / "assets" / "logogrande-sinfondo.png").convert("RGBA")
canvas = Image.new("RGBA", logo.size, (255, 255, 255, 255))
canvas.alpha_composite(logo)
canvas = canvas.convert("RGB").resize((286, 160), Image.LANCZOS)
canvas.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(
    OUT / "logo-tiam.png", optimize=True
)

# Product images: the landing heroes at 1200x900, baseline JPEG (the most compatible kind).
for edition in ("familias", "profesionales"):
    hero = Image.open(ROOT / "pack" / "img" / f"hero-{edition}-4x3-1200.webp").convert("RGB")
    hero.save(OUT / f"pack-{edition}.jpg", "JPEG", quality=72, optimize=True, progressive=False, subsampling="4:2:0")

for path in sorted(OUT.iterdir()):
    print(f"{path.name}: {path.stat().st_size / 1024:.0f} KB")
