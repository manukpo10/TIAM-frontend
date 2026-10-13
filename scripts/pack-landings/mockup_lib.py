"""Herramientas para componer las tapas REALES del pack sobre fotos de un cuadernillo en blanco (maqueta del hero de las landings).

Todo con numpy (más PIL para el warp en perspectiva y OpenCV solo para hallar contornos y rotar recortes). Sin descargas.

Pasos (ver make_mockup.py):
  1. find_cover_quad: halla la tapa en blanco (zona clara y poco saturada, la mayor) y sus cuatro vértices.
  2. refine_quad: afina cada esquina a sub-píxel (perfil de luminancia perpendicular a cada borde, recta por mínimos cuadrados con
     descarte de atípicos, intersección de rectas).
  3. homography / perspective_coeffs: homografía resuelta con numpy (DLT, 8 ecuaciones) en el formato de Image.transform(PERSPECTIVE).
  4. warp_cover: lleva la tapa real al cuadrilátero, con supersampling para que los bordes no queden dentados.
  5. shading_map + multiply_composite: la luz de la foto (la luminancia de la tapa en blanco) se MULTIPLICA con la tapa real, en luz lineal,
     de modo que quedan la iluminación, las sombras y la grapa de la foto.
  6. matte / pose / paste_with_shadow: recorta el cuadernillo, lo gira y lo escala, y lo apoya con sombras sobre otra foto de la mesa.
"""

from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import cv2

LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


# --- color -------------------------------------------------------------------------------------------------------
def to_linear(rgb8: np.ndarray) -> np.ndarray:
    c = rgb8.astype(np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb8(lin: np.ndarray) -> np.ndarray:
    c = np.clip(lin, 0.0, 1.0)
    s = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
    return np.clip(np.rint(s * 255.0), 0, 255).astype(np.uint8)


def luminance(rgb8: np.ndarray) -> np.ndarray:
    return rgb8.astype(np.float32) @ LUMA


# --- hallar y afinar la tapa -------------------------------------------------------------------------------------
def white_paper_mask(rgb8: np.ndarray, lum_min: float = 205.0, sat_max: float = 0.10) -> np.ndarray:
    """Papel blanco: claro y casi sin saturación (la madera clara es cálida: saturación > 0,2)."""
    f = rgb8.astype(np.float32)
    mx, mn = f.max(axis=2), f.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    return ((luminance(rgb8) > lum_min) & (sat < sat_max)).astype(np.uint8)


def order_clockwise(points: np.ndarray, tl_hint: tuple[float, float]) -> np.ndarray:
    """Ordena 4 vértices en sentido horario (en la imagen, con y hacia abajo) empezando por el más cercano a `tl_hint` (la grapa: esquina
    superior izquierda del documento)."""
    pts = np.asarray(points, dtype=np.float64).reshape(4, 2)
    c = pts.mean(axis=0)
    angles = np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0])
    pts = pts[np.argsort(angles)]  # ángulo creciente con y hacia abajo = horario en pantalla
    first = int(np.argmin(np.linalg.norm(pts - np.asarray(tl_hint), axis=1)))
    return np.roll(pts, -first, axis=0)


def find_cover_quad(rgb8: np.ndarray, tl_hint: tuple[float, float]) -> np.ndarray:
    mask = cv2.morphologyEx(white_paper_mask(rgb8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    cnts, _ = cv2.findContours((lab == biggest).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
    approx = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True).reshape(-1, 2)
    if len(approx) != 4:
        raise RuntimeError(f"la tapa no dio un cuadrilátero: {len(approx)} vértices")
    return order_clockwise(approx, tl_hint)


def _fit_line(points: np.ndarray, tolerance: float = 0.9) -> tuple[np.ndarray, np.ndarray]:
    """Recta por mínimos cuadrados totales con descarte de atípicos. Devuelve (punto, dirección unitaria)."""
    keep = np.ones(len(points), dtype=bool)
    for _ in range(4):
        p = points[keep]
        centroid = p.mean(axis=0)
        _, _, vt = np.linalg.svd(p - centroid, full_matrices=False)
        d = vt[0]
        normal = np.array([-d[1], d[0]])
        resid = np.abs((points - centroid) @ normal)
        limit = max(tolerance, 2.5 * float(np.median(resid[keep])))
        new_keep = resid <= limit
        if new_keep.sum() < 8 or (new_keep == keep).all():
            break
        keep = new_keep
    p = points[keep]
    centroid = p.mean(axis=0)
    _, _, vt = np.linalg.svd(p - centroid, full_matrices=False)
    return centroid, vt[0]


def refine_quad(lum: np.ndarray, quad: np.ndarray, reach: float = 14.0, samples: int = 90) -> np.ndarray:
    """Afina las 4 esquinas: en cada borde se busca, perpendicular y hacia afuera, la caída más brusca de luminancia (papel -> mesa)."""
    quad = np.asarray(quad, dtype=np.float64)
    centre = quad.mean(axis=0)
    lines = []
    for i in range(4):
        a, b = quad[i], quad[(i + 1) % 4]
        d = b - a
        length = float(np.linalg.norm(d))
        d = d / length
        n = np.array([d[1], -d[0]])
        if np.dot(n, (a + b) / 2 - centre) < 0:
            n = -n
        offsets = np.arange(-reach, reach + 1e-6, 0.25)
        pts = []
        for t in np.linspace(0.08, 0.92, samples):
            p = a + d * length * t
            ys, xs = p[1] + n[1] * offsets, p[0] + n[0] * offsets
            profile = ndi.gaussian_filter1d(ndi.map_coordinates(lum, [ys, xs], order=1, mode="nearest"), 3.0)
            grad = np.gradient(profile, offsets)
            k = int(np.argmin(grad))
            if 0 < k < len(offsets) - 1:  # parábola por los tres puntos: sub-muestra
                y0, y1, y2 = grad[k - 1], grad[k], grad[k + 1]
                denom = y0 - 2 * y1 + y2
                shift = 0.5 * (y0 - y2) / denom if abs(denom) > 1e-9 else 0.0
                pos = offsets[k] + shift * 0.25
            else:
                pos = offsets[k]
            pts.append(p + n * pos)
        lines.append(_fit_line(np.array(pts)))
    corners = []
    for i in range(4):
        p0, d0 = lines[i - 1]
        p1, d1 = lines[i]
        s, _ = np.linalg.solve(np.array([d0, -d1]).T, p1 - p0)
        corners.append(p0 + d0 * s)
    return np.array(corners)


# --- homografía --------------------------------------------------------------------------------------------------
def perspective_coeffs(dst_quad: np.ndarray, src_size: tuple[int, int]) -> tuple[float, ...]:
    """Coeficientes para Image.transform(..., Image.PERSPECTIVE): para cada píxel de SALIDA (x, y), la posición en la ENTRADA es
    ((a x + b y + c) / (g x + h y + 1), (d x + e y + f) / (g x + h y + 1)). `dst_quad`: TL, TR, BR, BL en la salida; la entrada es
    el rectángulo (0,0)-(ancho,alto) de la tapa. Se resuelve con numpy (DLT con 4 pares de puntos)."""
    w, h = src_size
    src = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float64)
    rows, rhs = [], []
    for (x, y), (X, Y) in zip(np.asarray(dst_quad, dtype=np.float64), src):
        rows.append([x, y, 1, 0, 0, 0, -x * X, -y * X])
        rhs.append(X)
        rows.append([0, 0, 0, x, y, 1, -x * Y, -y * Y])
        rhs.append(Y)
    return tuple(float(v) for v in np.linalg.solve(np.array(rows), np.array(rhs)))


def warp_cover(cover: Image.Image, dst_quad: np.ndarray, size: tuple[int, int], ss: int = 3) -> tuple[np.ndarray, np.ndarray]:
    """Lleva la tapa al cuadrilátero y devuelve (rgb uint8 HxWx3, alfa float HxW) del tamaño de la foto. Se dibuja con supersampling
    (ss x) y se reduce con LANCZOS: bordes sin dientes de sierra."""
    w, h = size
    quad = np.asarray(dst_quad, dtype=np.float64) * ss
    span = float(np.max(np.linalg.norm(quad - np.roll(quad, 1, axis=0), axis=1)))
    # La tapa se reduce antes a ~el tamaño con que va a salir (la reducción fuerte con el muestreo del warp solo daría aliasing).
    factor = min(1.0, 1.25 * span / max(cover.size))
    src = cover.convert("RGB").resize((max(2, round(cover.width * factor)), max(2, round(cover.height * factor))), Image.LANCZOS)
    coeffs = perspective_coeffs(quad, src.size)
    big = src.transform((w * ss, h * ss), Image.PERSPECTIVE, coeffs, resample=Image.BICUBIC)
    mask_src = Image.new("L", src.size, 255)
    mask = mask_src.transform((w * ss, h * ss), Image.PERSPECTIVE, coeffs, resample=Image.BILINEAR)
    rgb = np.asarray(big.resize((w, h), Image.LANCZOS))
    alpha = np.asarray(mask.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255.0
    return rgb, alpha


def quad_mask(quad: np.ndarray, size: tuple[int, int], ss: int = 4) -> np.ndarray:
    w, h = size
    m = np.zeros((h * ss, w * ss), np.uint8)
    cv2.fillPoly(m, [np.rint(np.asarray(quad) * ss).astype(np.int32)], 255)
    return np.asarray(Image.fromarray(m).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255.0


# --- iluminación y mezcla ------------------------------------------------------------------------------------------
def shading_map(plate8: np.ndarray, quad: np.ndarray, smooth: float = 1.4) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Luz de la foto sobre la tapa en blanco, en luz LINEAL y normalizada al blanco del papel: S (HxW), la máscara de lo que NO es papel
    liso dentro de la tapa (grapa, rayones del generador) y el tono del papel (RGB lineal normalizado, para teñir un poco).

    Los rayones sueltos que a veces deja el generador sobre la tapa en blanco se filtran con una mediana grande: se conserva el degradado
    de luz y se pierde el detalle fino."""
    h, w = plate8.shape[:2]
    inside = quad_mask(quad, (w, h)) > 0.98
    lin = to_linear(plate8)
    lum_lin = lin @ LUMA
    white = float(np.percentile(lum_lin[inside], 88))
    s_fine = np.clip(lum_lin / max(white, 1e-4), 0.0, 1.6)
    # Fuera de la tapa se repite el valor del píxel de papel más cercano: así la mediana no se contamina con la mesa en los bordes.
    nearest = ndi.distance_transform_edt(~inside, return_distances=False, return_indices=True)
    filled = s_fine[tuple(nearest)]
    s_low = cv2.medianBlur((np.clip(filled, 0, 1.6) / 1.6 * 255).astype(np.uint8), 31).astype(np.float32) / 255.0 * 1.6
    s_low = ndi.gaussian_filter(s_low, 6.0)
    # rayones y grapas: píxeles que se apartan de la luz de fondo (la mediana ya la estimó), más oscuros o más claros. Solo bien adentro de
    # la tapa: en el borde de la hoja el papel pasa a la mesa y ese escalón no es un rayón (dejaba una línea de puntos alrededor de la tapa).
    interior = ndi.binary_erosion(inside, iterations=3)
    odd = ((s_fine < 0.86 * s_low) | (s_fine > 1.14 * s_low)) & interior
    odd = ndi.binary_dilation(odd, iterations=2) & interior
    # S final: la luz suave + el grano fino de la foto (para que la tapa no quede "de plástico")
    detail = ndi.gaussian_filter(s_fine, smooth) - ndi.gaussian_filter(s_fine, 5.0)
    s = np.where(odd, s_low, s_low + 0.6 * detail)
    paper = np.array([float(np.median(lin[..., c][inside & ~odd])) for c in range(3)], dtype=np.float32)
    tone = paper / max(float(paper @ LUMA), 1e-5)
    return s.astype(np.float32), odd, tone


def multiply_composite(plate8: np.ndarray, cover_rgb8: np.ndarray, cover_alpha: np.ndarray, s: np.ndarray, keep: np.ndarray, tone: np.ndarray, tint: float = 0.35) -> np.ndarray:
    """plate8: la foto; cover_*: la tapa ya en perspectiva; s: luz (lineal); keep: píxeles de la foto que se conservan (grapa); tone: tono del
    papel. Todo en luz lineal: reflectancia de la tapa x iluminación de la foto."""
    plate_lin = to_linear(plate8)
    cover_lin = to_linear(cover_rgb8)
    tone_mix = (1.0 - tint) + tint * tone  # un poco del tono del papel de la foto (más cálido o más frío)
    lit = cover_lin * (s[..., None] * tone_mix[None, None, :])
    a = (cover_alpha * (1.0 - ndi.gaussian_filter(keep.astype(np.float32), 0.8)))[..., None]
    return to_srgb8(lit * a + plate_lin * (1.0 - a))


# --- recorte, pose y sombras -----------------------------------------------------------------------------------------
def booklet_matte(plate8: np.ndarray, quad: np.ndarray, grow: float = 22.0) -> np.ndarray:
    """Alfa del cuadernillo: la tapa más el canto de las hojas y la grapa (zonas claras y poco saturadas pegadas a la tapa)."""
    h, w = plate8.shape[:2]
    face = quad_mask(quad, (w, h), ss=4)
    near = ndi.binary_dilation(face > 0.5, iterations=int(grow))
    f = plate8.astype(np.float32)
    mx, mn = f.max(axis=2), f.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    paperish = (sat < 0.17) & (luminance(plate8) > 140) & near
    paperish = ndi.binary_opening(paperish, iterations=1)
    lab, n = ndi.label(paperish | (face > 0.5))
    face_label = np.bincount(lab[face > 0.9]).argmax()
    solid = lab == face_label
    solid = ndi.binary_fill_holes(solid)
    soft = ndi.gaussian_filter(solid.astype(np.float32), 0.8)
    return np.maximum(soft, face)


def pose_cutout(rgb8: np.ndarray, alpha: np.ndarray, quad: np.ndarray, angle: float, scale: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Recorta el cuadernillo, lo escala (INTER_AREA) y lo gira `angle` grados (positivo = antihorario en pantalla). Devuelve (rgb, alfa,
    centro de la tapa dentro del recorte). El recorte es un lienzo con margen para que no se corten ni el giro ni los bordes."""
    ys, xs = np.nonzero(alpha > 0.02)
    pad = 8
    x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad, rgb8.shape[1]), max(ys.min() - pad, 0), min(ys.max() + pad, rgb8.shape[0])
    rgb = rgb8[y0:y1, x0:x1].astype(np.float32)
    a = alpha[y0:y1, x0:x1].astype(np.float32)
    centre = quad.mean(axis=0) - np.array([x0, y0])
    pm = np.dstack([rgb * a[..., None], a[..., None] * 255.0])  # color premultiplicado y alfa
    if scale != 1.0:
        pm = cv2.resize(pm, (max(2, round(pm.shape[1] * scale)), max(2, round(pm.shape[0] * scale))), interpolation=cv2.INTER_AREA)
        centre = centre * scale
    hh, ww = pm.shape[:2]
    diag = int(np.ceil(np.hypot(hh, ww))) + 8
    canvas = np.zeros((diag, diag, 4), np.float32)
    ox, oy = (diag - ww) // 2, (diag - hh) // 2
    canvas[oy : oy + hh, ox : ox + ww] = pm
    centre = centre + np.array([ox, oy])
    m = cv2.getRotationMatrix2D((float(centre[0]), float(centre[1])), angle, 1.0)  # OpenCV: positivo = antihorario en pantalla
    rot = cv2.warpAffine(canvas, m, (diag, diag), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    alpha_out = np.clip(rot[..., 3] / 255.0, 0.0, 1.0)
    color = np.where(alpha_out[..., None] > 1e-4, rot[..., :3] / np.maximum(rot[..., 3:4] / 255.0, 1e-4), 0.0)
    return np.clip(color, 0, 255), alpha_out, centre


def paste_with_shadow(canvas8: np.ndarray, cut_rgb: np.ndarray, cut_alpha: np.ndarray, cut_centre: np.ndarray, at: tuple[float, float], light: tuple[float, float] = (0.55, 0.83), strength: float = 1.0, track: np.ndarray | None = None) -> np.ndarray:
    """Apoya el recorte con su centro en `at`, con tres sombras (de contacto, media y ancha) que caen hacia `light` (luz de la ventana
    arriba a la izquierda: la sombra cae hacia abajo y a la derecha). Las sombras se mezclan sobre lo que ya hay en el lienzo, incluidos
    otros cuadernillos: así el de adelante oscurece un poco al de atrás."""
    h, w = canvas8.shape[:2]
    ox, oy = int(round(at[0] - cut_centre[0])), int(round(at[1] - cut_centre[1]))
    full_a = np.zeros((h, w), np.float32)
    full_rgb = np.zeros((h, w, 3), np.float32)
    sy0, sx0 = max(0, -oy), max(0, -ox)
    dy0, dx0 = max(0, oy), max(0, ox)
    hh = min(cut_alpha.shape[0] - sy0, h - dy0)
    ww = min(cut_alpha.shape[1] - sx0, w - dx0)
    if hh <= 0 or ww <= 0:
        return canvas8
    full_a[dy0 : dy0 + hh, dx0 : dx0 + ww] = cut_alpha[sy0 : sy0 + hh, sx0 : sx0 + ww]
    full_rgb[dy0 : dy0 + hh, dx0 : dx0 + ww] = cut_rgb[sy0 : sy0 + hh, sx0 : sx0 + ww]
    if track is not None:  # unión de lo que ocupan los cuadernillos (sin las sombras), para medir los márgenes
        np.maximum(track, full_a, out=track)
    lin = to_linear(canvas8)
    for dist, sigma, opacity in ((4.0, 2.6, 0.42), (11.0, 8.0, 0.26), (30.0, 24.0, 0.16)):
        shadow = ndi.shift(full_a, (light[1] * dist, light[0] * dist), order=1, mode="constant")
        shadow = ndi.gaussian_filter(shadow, sigma) * (1.0 - full_a)  # la sombra no tapa al propio cuadernillo
        k = np.clip(shadow * opacity * strength, 0.0, 0.9)[..., None]
        lin = lin * (1.0 - k * np.array([0.90, 0.95, 1.0], dtype=np.float32))  # sombra apenas cálida
    base8 = to_srgb8(lin)
    a3 = full_a[..., None]
    out = base8.astype(np.float32) * (1.0 - a3) + full_rgb * a3
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


def defocus(rgb8: np.ndarray, alpha: np.ndarray, quad: np.ndarray, sigma_top: float, sigma_bottom: float) -> tuple[np.ndarray, np.ndarray]:
    """Desenfoque variable de la tapa (profundidad de campo): la foto está nítida arriba y se va suavizando hacia abajo, y una tapa
    perfectamente nítida pegada sobre ese fondo se nota. El sigma crece linealmente con y entre el borde alto y el bajo de la tapa."""
    y0, y1 = float(quad[:, 1].min()), float(quad[:, 1].max())
    h, w = alpha.shape
    ys = np.arange(h, dtype=np.float32)[:, None]
    t = np.clip((ys - y0) / max(y1 - y0, 1.0), 0.0, 1.0) * np.ones((1, w), np.float32)
    sigmas = np.linspace(sigma_top, sigma_bottom, 5)
    premult = np.dstack([rgb8.astype(np.float32) * alpha[..., None], alpha])
    layers = [np.dstack([ndi.gaussian_filter(premult[..., c], sg) for c in range(4)]) for sg in sigmas]
    pos = t * (len(sigmas) - 1)
    lo = np.clip(np.floor(pos).astype(int), 0, len(sigmas) - 2)
    frac = (pos - lo)[..., None]
    stack = np.stack(layers)  # 5 x H x W x 4
    rows, cols = np.mgrid[0:h, 0:w]
    mixed = stack[lo, rows, cols] * (1.0 - frac) + stack[lo + 1, rows, cols] * frac
    a = np.clip(mixed[..., 3], 0.0, 1.0)
    color = np.where(a[..., None] > 1e-4, mixed[..., :3] / np.maximum(a[..., None], 1e-4), 0.0)
    return np.clip(color, 0, 255).astype(np.uint8), a


def decontaminate(rgb: np.ndarray, alpha: np.ndarray, solid: float = 0.97, reach: int = 4) -> np.ndarray:
    """Quita el tono de la mesa original de los píxeles del borde (mezcla de papel y madera): en los que no son del todo opacos se
    repite el color del píxel opaco más cercano. Sin esto, al pegar el cuadernillo sobre otra mesa queda un hilo anaranjado en el contorno."""
    opaque = alpha >= solid
    dist, idx = ndi.distance_transform_edt(~opaque, return_indices=True)
    nearest = rgb[tuple(idx)]
    use = (~opaque) & (dist <= reach)
    out = rgb.copy()
    out[use] = nearest[use]
    return out


def soften(rgb: np.ndarray, alpha: np.ndarray, sigma: float) -> tuple[np.ndarray, np.ndarray]:
    """Desenfoque leve de un recorte (con el color premultiplicado, para que el borde no sangre)."""
    pre = [ndi.gaussian_filter(rgb[..., c] * alpha, sigma) for c in range(3)]
    a = np.clip(ndi.gaussian_filter(alpha, sigma), 0.0, 1.0)
    color = np.stack(pre, axis=-1) / np.maximum(a[..., None], 1e-4)
    return np.clip(color, 0, 255), a
