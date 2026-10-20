/**
 * «Cada área, su planta»: the cut-paper plants of the Cuadernos TIAM covers as the site's visual identity.
 *
 * There is one plant per cognitive area, in the exact colour of that area. They come from the covers' garden (TIAM-pack, `jardin_arte.py`) and are exported by
 * `scripts/plantas/export_plantas.py` into public/plantas/v1/ (so the SPA and the static landings share the same files, with no hashing and no inlining).
 *
 * The rules of use:
 * - A plant is decoration: it always goes with the area's written label, never instead of it, and the <img> is `alt=""` + `aria-hidden`.
 * - The icons are 4:5 boxes at 1x (48x60) and 2x (96x120), each under 4 KB. They are shown from 24 to 48 px tall.
 * - This file is pure on purpose (no React, no imports): it has its tests in tests/area-plants.test.ts (`npm test`).
 *
 * The Desafío 30 días also names an eighth area, "Reconocimiento", and spells the seventh one "Visuoespacial"; the plants are only the seven of the covers, so
 * `areaKeyOf('Reconocimiento')` is `undefined` and the caller keeps what it had.
 */

export const AREA_KEYS = ['orientacion', 'memoria', 'atencion', 'lenguaje', 'calculo', 'razonamiento', 'visuoespacial'] as const
export type AreaKey = (typeof AREA_KEYS)[number]

/** What the covers print (the colour key on every cover and the tab of every exercise). */
export const AREA_LABELS: Record<AreaKey, string> = {
  orientacion: 'Orientación',
  memoria: 'Memoria',
  atencion: 'Atención',
  lenguaje: 'Lenguaje',
  calculo: 'Cálculo',
  razonamiento: 'Razonamiento',
  visuoespacial: 'Visión y espacio',
}

/** AREA_COLOR of TIAM-pack: the colour of each plant. All of them reach AA with white text. pack/landing.css (.k-ori…) repeats them, and a test keeps both in step. */
export const AREA_COLORS: Record<AreaKey, string> = {
  orientacion: '#8F6B00',
  memoria: '#1B6FC4',
  atencion: '#CC4610',
  lenguaje: '#2C801C',
  calculo: '#5B3C9E',
  razonamiento: '#0F766E',
  visuoespacial: '#A3225C',
}

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const BY_NAME: Record<string, AreaKey> = {
  ...Object.fromEntries(AREA_KEYS.map((key) => [fold(AREA_LABELS[key]), key])),
  ...Object.fromEntries(AREA_KEYS.map((key) => [key, key])),
}

/** From the name an area has on a page ("Atención", "Visuoespacial", "Visión y espacio"…) to its plant, or `undefined` when it is not one of the seven. */
export function areaKeyOf(name: string): AreaKey | undefined {
  return BY_NAME[fold(name)]
}

/** Where the exported files live. The folder carries a version: when the art changes, bump it (vercel.json caches this folder for a year, `immutable`). */
export const PLANTS_DIR = '/plantas/v1'

/** The icons are 4:5 boxes (48x60 at 1x, 96x120 at 2x). */
const ICON_RATIO = 4 / 5

export interface PlantIcon {
  src: string
  srcSet: string
  /** CSS px: the box is reserved before the image arrives, so nothing shifts. */
  width: number
  height: number
}

/** The small plant that goes next to an area's label, `height` CSS px tall. */
export function plantIcon(area: AreaKey, height: number): PlantIcon {
  return {
    src: `${PLANTS_DIR}/${area}-48.webp`,
    srcSet: `${PLANTS_DIR}/${area}-48.webp 1x, ${PLANTS_DIR}/${area}-96.webp 2x`,
    width: Math.round(height * ICON_RATIO),
    height,
  }
}

/** Width of each whole plant (`<area>-g.webp`) at its native height of 240 px: they are the plants that sprout on the home page. */
const GROW_WIDTH_AT_240: Record<AreaKey, number> = {
  orientacion: 154,
  memoria: 127,
  atencion: 167,
  lenguaje: 176,
  calculo: 158,
  razonamiento: 133,
  visuoespacial: 182,
}

export interface PlantImage {
  src: string
  width: number
  height: number
}

/** The whole plant, `height` CSS px tall (the file is 240 px tall: sharp up to 2x at 120 px). */
export function plantGrow(area: AreaKey, height = 120): PlantImage {
  return { src: `${PLANTS_DIR}/${area}-g.webp`, width: Math.round((GROW_WIDTH_AT_240[area] / 240) * height), height }
}

/** The garden band at the top of every footer: the seven plants peeking up, as at the bottom of the covers. AVIF first, WebP as the fallback. */
export const GARDEN = {
  width: 1600,
  height: 250,
  src: `${PLANTS_DIR}/jardin-1600.webp`,
  webpSrcSet: `${PLANTS_DIR}/jardin-800.webp 800w, ${PLANTS_DIR}/jardin-1600.webp 1600w`,
  avifSrcSet: `${PLANTS_DIR}/jardin-800.avif 800w, ${PLANTS_DIR}/jardin-1600.avif 1600w`,
} as const
