import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Cuántos hay?" — día 27. Replaces the older "¿Qué se esconde?", which asked
 * you to NAME the overlapping figures. This asks you to COUNT each kind, which
 * is the Poppelreuter plate crossed with a cancellation task: you can't answer
 * by recognising one shape, you have to sweep the whole canvas systematically
 * and hold a tally per type while contours cross each other.
 *
 * Everything here depends on the art being unfilled CONTOUR line drawings.
 * A filled icon occludes whatever is behind it, so a hidden instance becomes
 * uncountable and the exercise is unanswerable rather than hard. That is why
 * the whole object set was redrawn as pen-and-ink outlines with transparent
 * interiors; `mix-blend-multiply` then just darkens where lines cross.
 *
 * Placements are PRE-AUTHORED, generated offline by a relaxation pass and then
 * eyeballed one by one — never computed at runtime. Same reasoning
 * CaminoNumerico.tsx states for its scattered circles: a layout that lands badly
 * would hand some player a knot nobody ever looked at. Three rules the offline
 * pass enforces, each learned by shipping the opposite into a test render:
 *   - every instance sits FULLY inside the canvas (a comb cut by the edge reads
 *     as two combs);
 *   - the plate is evenly covered (a plate that splits into two clumps with a
 *     hole between them isn't intermingled any more);
 *   - two instances OF THE SAME TYPE stay well apart. Two different objects
 *     overlapping is the exercise; two identical ones nearly coinciding fuse
 *     into one shape and make the count impossible instead of difficult.
 *
 * Object types are all UNIT objects — one drawing is unambiguously one thing.
 * 'llaves' (a ring of three keys) is deliberately absent from every composition:
 * nobody can say whether that counts as one or three.
 *
 * No timer, ever. A wrong count is never red and never ends anything — the
 * results view simply shows what the real number was, next to what you said.
 */

interface CompositionItem {
  objectId: string
  xPct: number
  yPct: number
  scale: number
  rotationDeg?: number
}
interface Composition {
  items: CompositionItem[]
}
interface Level {
  n: number
  name: string
  rounds: number
  compositions: Composition[]
}

const LABELS: Record<string, string> = {
  anteojos: 'anteojos',
  banana: 'bananas',
  botella: 'botellas',
  corazon: 'corazones',
  cuchara: 'cucharas',
  'manzana-roja': 'manzanas',
  mariposa: 'mariposas',
  martillo: 'martillos',
  pava: 'pavas',
  peine: 'peines',
  'reloj-pulsera': 'relojes',
  sombrero: 'sombreros',
  taza: 'tazas',
  tenedor: 'tenedores',
  termo: 'termos',
  tijera: 'tijeras',
  zanahoria: 'zanahorias',
  zapato: 'zapatos',
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 3,
    compositions: [
      // banana: 3, taza: 3, tijera: 3  (9 en total)
      { items: [
        { objectId: 'taza', xPct: 81.3, yPct: 31.1, scale: 0.468, rotationDeg: -25 },
        { objectId: 'taza', xPct: 81.8, yPct: 64.4, scale: 0.456, rotationDeg: 205 },
        { objectId: 'tijera', xPct: 19.6, yPct: 49.9, scale: 0.492, rotationDeg: -25 },
        { objectId: 'taza', xPct: 33.1, yPct: 53.9, scale: 0.494, rotationDeg: -130 },
        { objectId: 'banana', xPct: 20.9, yPct: 65.2, scale: 0.494, rotationDeg: -50 },
        { objectId: 'banana', xPct: 24.1, yPct: 40.2, scale: 0.57, rotationDeg: -130 },
        { objectId: 'banana', xPct: 61.8, yPct: 51.1, scale: 0.502 },
        { objectId: 'tijera', xPct: 70.8, yPct: 31.0, scale: 0.573, rotationDeg: 175 },
        { objectId: 'tijera', xPct: 35.5, yPct: 30.6, scale: 0.564, rotationDeg: 175 },
      ] },
      // cuchara: 4, pava: 2, sombrero: 3  (9 en total)
      { items: [
        { objectId: 'cuchara', xPct: 26.0, yPct: 43.3, scale: 0.615, rotationDeg: 130 },
        { objectId: 'pava', xPct: 46.2, yPct: 56.8, scale: 0.595, rotationDeg: 25 },
        { objectId: 'cuchara', xPct: 77.4, yPct: 37.7, scale: 0.535, rotationDeg: -50 },
        { objectId: 'cuchara', xPct: 40.7, yPct: 31.7, scale: 0.45, rotationDeg: -130 },
        { objectId: 'sombrero', xPct: 77.1, yPct: 60.9, scale: 0.574, rotationDeg: -25 },
        { objectId: 'sombrero', xPct: 20.5, yPct: 65.9, scale: 0.589, rotationDeg: -80 },
        { objectId: 'cuchara', xPct: 66.2, yPct: 54.1, scale: 0.512, rotationDeg: -130 },
        { objectId: 'sombrero', xPct: 60.6, yPct: 37.6, scale: 0.534, rotationDeg: -50 },
        { objectId: 'pava', xPct: 20.6, yPct: 44.3, scale: 0.517, rotationDeg: -25 },
      ] },
      // botella: 3, manzana-roja: 3, peine: 3  (9 en total)
      { items: [
        { objectId: 'botella', xPct: 38.4, yPct: 40.6, scale: 0.611, rotationDeg: -25 },
        { objectId: 'botella', xPct: 21.5, yPct: 64.1, scale: 0.54, rotationDeg: -25 },
        { objectId: 'peine', xPct: 83.7, yPct: 62.9, scale: 0.469, rotationDeg: 80 },
        { objectId: 'manzana-roja', xPct: 44.4, yPct: 46.5, scale: 0.61, rotationDeg: -80 },
        { objectId: 'manzana-roja', xPct: 18.4, yPct: 30.6, scale: 0.461, rotationDeg: 205 },
        { objectId: 'peine', xPct: 81.3, yPct: 31.1, scale: 0.575, rotationDeg: 175 },
        { objectId: 'botella', xPct: 64.4, yPct: 50.2, scale: 0.602, rotationDeg: 80 },
        { objectId: 'manzana-roja', xPct: 17.2, yPct: 60.4, scale: 0.572 },
        { objectId: 'peine', xPct: 61.2, yPct: 24.4, scale: 0.488 },
      ] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    compositions: [
      // anteojos: 3, taza: 3, tijera: 4, zanahoria: 3  (13 en total)
      { items: [
        { objectId: 'tijera', xPct: 48.5, yPct: 28.2, scale: 0.52, rotationDeg: 175 },
        { objectId: 'taza', xPct: 78.8, yPct: 59.3, scale: 0.531, rotationDeg: 205 },
        { objectId: 'tijera', xPct: 33.2, yPct: 48.1, scale: 0.457, rotationDeg: 80 },
        { objectId: 'taza', xPct: 84.5, yPct: 25.9, scale: 0.447, rotationDeg: -80 },
        { objectId: 'tijera', xPct: 32.8, yPct: 63.7, scale: 0.515, rotationDeg: -50 },
        { objectId: 'anteojos', xPct: 48.8, yPct: 70.4, scale: 0.546, rotationDeg: 175 },
        { objectId: 'anteojos', xPct: 70.5, yPct: 29.3, scale: 0.441, rotationDeg: -25 },
        { objectId: 'tijera', xPct: 22.6, yPct: 57.4, scale: 0.535, rotationDeg: -50 },
        { objectId: 'zanahoria', xPct: 16.3, yPct: 72.8, scale: 0.469, rotationDeg: 80 },
        { objectId: 'zanahoria', xPct: 16.5, yPct: 27.5, scale: 0.55 },
        { objectId: 'zanahoria', xPct: 31.4, yPct: 25.4, scale: 0.439, rotationDeg: -80 },
        { objectId: 'taza', xPct: 50.0, yPct: 48.8, scale: 0.461, rotationDeg: 205 },
        { objectId: 'anteojos', xPct: 69.1, yPct: 53.4, scale: 0.487 },
      ] },
      // banana: 3, cuchara: 4, martillo: 3, sombrero: 3  (13 en total)
      { items: [
        { objectId: 'sombrero', xPct: 19.1, yPct: 68.2, scale: 0.479, rotationDeg: 25 },
        { objectId: 'martillo', xPct: 54.9, yPct: 44.5, scale: 0.501 },
        { objectId: 'cuchara', xPct: 25.5, yPct: 20.9, scale: 0.418 },
        { objectId: 'banana', xPct: 11.8, yPct: 19.7, scale: 0.394 },
        { objectId: 'martillo', xPct: 12.9, yPct: 51.3, scale: 0.409 },
        { objectId: 'cuchara', xPct: 80.2, yPct: 56.0, scale: 0.497, rotationDeg: -25 },
        { objectId: 'banana', xPct: 67.7, yPct: 24.2, scale: 0.417, rotationDeg: -80 },
        { objectId: 'cuchara', xPct: 29.3, yPct: 61.1, scale: 0.506, rotationDeg: -25 },
        { objectId: 'sombrero', xPct: 71.4, yPct: 52.1, scale: 0.472, rotationDeg: 80 },
        { objectId: 'banana', xPct: 25.4, yPct: 72.4, scale: 0.509, rotationDeg: 175 },
        { objectId: 'cuchara', xPct: 54.6, yPct: 30.7, scale: 0.436, rotationDeg: 130 },
        { objectId: 'sombrero', xPct: 82.2, yPct: 29.6, scale: 0.511, rotationDeg: -80 },
        { objectId: 'martillo', xPct: 43.3, yPct: 70.8, scale: 0.44, rotationDeg: 25 },
      ] },
      // corazon: 4, pava: 3, peine: 3, zapato: 3  (13 en total)
      { items: [
        { objectId: 'peine', xPct: 83.7, yPct: 27.2, scale: 0.386, rotationDeg: -50 },
        { objectId: 'peine', xPct: 66.3, yPct: 31.5, scale: 0.447, rotationDeg: 50 },
        { objectId: 'zapato', xPct: 15.2, yPct: 51.8, scale: 0.437, rotationDeg: 80 },
        { objectId: 'corazon', xPct: 74.9, yPct: 50.4, scale: 0.415, rotationDeg: -80 },
        { objectId: 'corazon', xPct: 13.7, yPct: 77.1, scale: 0.422, rotationDeg: 175 },
        { objectId: 'pava', xPct: 29.0, yPct: 55.0, scale: 0.48, rotationDeg: 80 },
        { objectId: 'corazon', xPct: 49.6, yPct: 29.5, scale: 0.444, rotationDeg: 25 },
        { objectId: 'pava', xPct: 12.8, yPct: 21.3, scale: 0.427 },
        { objectId: 'zapato', xPct: 25.8, yPct: 73.6, scale: 0.455, rotationDeg: 80 },
        { objectId: 'pava', xPct: 33.0, yPct: 28.5, scale: 0.405, rotationDeg: -130 },
        { objectId: 'corazon', xPct: 45.6, yPct: 52.2, scale: 0.467, rotationDeg: 175 },
        { objectId: 'peine', xPct: 53.7, yPct: 64.4, scale: 0.505, rotationDeg: -130 },
        { objectId: 'zapato', xPct: 81.0, yPct: 49.5, scale: 0.548, rotationDeg: 80 },
      ] },
      // botella: 4, mariposa: 3, taza: 3, tenedor: 3  (13 en total)
      { items: [
        { objectId: 'tenedor', xPct: 45.4, yPct: 23.4, scale: 0.468 },
        { objectId: 'tenedor', xPct: 28.3, yPct: 71.3, scale: 0.407, rotationDeg: 50 },
        { objectId: 'mariposa', xPct: 75.9, yPct: 62.4, scale: 0.385 },
        { objectId: 'botella', xPct: 80.1, yPct: 33.2, scale: 0.5, rotationDeg: 205 },
        { objectId: 'botella', xPct: 59.7, yPct: 55.4, scale: 0.405 },
        { objectId: 'botella', xPct: 30.4, yPct: 51.5, scale: 0.559, rotationDeg: 80 },
        { objectId: 'taza', xPct: 16.7, yPct: 50.3, scale: 0.514, rotationDeg: 175 },
        { objectId: 'taza', xPct: 28.8, yPct: 29.8, scale: 0.551, rotationDeg: 175 },
        { objectId: 'botella', xPct: 13.3, yPct: 22.1, scale: 0.442 },
        { objectId: 'mariposa', xPct: 72.6, yPct: 35.5, scale: 0.535, rotationDeg: 205 },
        { objectId: 'mariposa', xPct: 20.2, yPct: 66.3, scale: 0.479, rotationDeg: 50 },
        { objectId: 'taza', xPct: 80.8, yPct: 44.0, scale: 0.454, rotationDeg: -50 },
        { objectId: 'tenedor', xPct: 57.6, yPct: 66.8, scale: 0.471, rotationDeg: 50 },
      ] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    compositions: [
      // botella: 3, cuchara: 4, peine: 3, taza: 4, tijera: 4  (18 en total)
      { items: [
        { objectId: 'cuchara', xPct: 52.7, yPct: 27.8, scale: 0.419, rotationDeg: 25 },
        { objectId: 'cuchara', xPct: 27.0, yPct: 24.7, scale: 0.372, rotationDeg: 205 },
        { objectId: 'peine', xPct: 16.9, yPct: 28.2, scale: 0.424, rotationDeg: 25 },
        { objectId: 'taza', xPct: 12.9, yPct: 78.5, scale: 0.372, rotationDeg: 80 },
        { objectId: 'tijera', xPct: 49.0, yPct: 31.8, scale: 0.451, rotationDeg: -50 },
        { objectId: 'taza', xPct: 89.6, yPct: 32.8, scale: 0.347 },
        { objectId: 'cuchara', xPct: 46.5, yPct: 76.5, scale: 0.471 },
        { objectId: 'peine', xPct: 72.6, yPct: 27.4, scale: 0.413, rotationDeg: 25 },
        { objectId: 'taza', xPct: 84.0, yPct: 73.1, scale: 0.461, rotationDeg: 80 },
        { objectId: 'botella', xPct: 13.6, yPct: 43.7, scale: 0.322, rotationDeg: -50 },
        { objectId: 'botella', xPct: 70.3, yPct: 35.2, scale: 0.5, rotationDeg: -50 },
        { objectId: 'peine', xPct: 26.2, yPct: 60.9, scale: 0.443 },
        { objectId: 'tijera', xPct: 55.1, yPct: 70.0, scale: 0.418, rotationDeg: 130 },
        { objectId: 'tijera', xPct: 84.0, yPct: 26.7, scale: 0.402, rotationDeg: 205 },
        { objectId: 'botella', xPct: 30.1, yPct: 36.4, scale: 0.429, rotationDeg: -80 },
        { objectId: 'cuchara', xPct: 67.4, yPct: 57.8, scale: 0.452, rotationDeg: 175 },
        { objectId: 'tijera', xPct: 15.6, yPct: 66.0, scale: 0.391, rotationDeg: 205 },
        { objectId: 'taza', xPct: 28.7, yPct: 71.6, scale: 0.427, rotationDeg: 205 },
      ] },
      // anteojos: 3, banana: 4, martillo: 4, sombrero: 3, zanahoria: 4  (18 en total)
      { items: [
        { objectId: 'martillo', xPct: 87.3, yPct: 21.1, scale: 0.365, rotationDeg: 80 },
        { objectId: 'martillo', xPct: 30.7, yPct: 67.2, scale: 0.472 },
        { objectId: 'sombrero', xPct: 73.5, yPct: 27.3, scale: 0.387, rotationDeg: 130 },
        { objectId: 'anteojos', xPct: 29.0, yPct: 29.4, scale: 0.442, rotationDeg: 25 },
        { objectId: 'sombrero', xPct: 49.0, yPct: 26.0, scale: 0.369, rotationDeg: -130 },
        { objectId: 'zanahoria', xPct: 66.6, yPct: 34.5, scale: 0.358, rotationDeg: 175 },
        { objectId: 'banana', xPct: 27.8, yPct: 82.3, scale: 0.326, rotationDeg: 175 },
        { objectId: 'martillo', xPct: 55.3, yPct: 59.5, scale: 0.322, rotationDeg: 50 },
        { objectId: 'anteojos', xPct: 18.7, yPct: 36.4, scale: 0.469, rotationDeg: 205 },
        { objectId: 'martillo', xPct: 11.6, yPct: 16.8, scale: 0.336 },
        { objectId: 'banana', xPct: 70.8, yPct: 57.2, scale: 0.488 },
        { objectId: 'zanahoria', xPct: 84.9, yPct: 25.7, scale: 0.357, rotationDeg: 50 },
        { objectId: 'zanahoria', xPct: 82.3, yPct: 67.2, scale: 0.443, rotationDeg: -25 },
        { objectId: 'anteojos', xPct: 33.0, yPct: 43.8, scale: 0.464, rotationDeg: 50 },
        { objectId: 'zanahoria', xPct: 16.7, yPct: 60.1, scale: 0.419, rotationDeg: 25 },
        { objectId: 'banana', xPct: 46.8, yPct: 37.6, scale: 0.479, rotationDeg: -50 },
        { objectId: 'banana', xPct: 52.0, yPct: 66.9, scale: 0.47, rotationDeg: -130 },
        { objectId: 'sombrero', xPct: 15.6, yPct: 74.1, scale: 0.448, rotationDeg: -80 },
      ] },
      // corazon: 4, pava: 3, peine: 4, tenedor: 4, zapato: 3  (18 en total)
      { items: [
        { objectId: 'pava', xPct: 89.5, yPct: 37.5, scale: 0.324, rotationDeg: 175 },
        { objectId: 'corazon', xPct: 46.7, yPct: 33.5, scale: 0.38, rotationDeg: 175 },
        { objectId: 'zapato', xPct: 16.1, yPct: 73.1, scale: 0.382, rotationDeg: -130 },
        { objectId: 'peine', xPct: 14.2, yPct: 61.6, scale: 0.437, rotationDeg: 175 },
        { objectId: 'peine', xPct: 38.4, yPct: 63.4, scale: 0.348, rotationDeg: 25 },
        { objectId: 'peine', xPct: 53.5, yPct: 81.5, scale: 0.342, rotationDeg: 175 },
        { objectId: 'tenedor', xPct: 86.3, yPct: 22.9, scale: 0.395, rotationDeg: -80 },
        { objectId: 'corazon', xPct: 86.2, yPct: 58.0, scale: 0.325, rotationDeg: -50 },
        { objectId: 'zapato', xPct: 66.0, yPct: 28.7, scale: 0.432, rotationDeg: -25 },
        { objectId: 'tenedor', xPct: 53.5, yPct: 21.5, scale: 0.324, rotationDeg: 205 },
        { objectId: 'peine', xPct: 26.6, yPct: 78.9, scale: 0.389, rotationDeg: 175 },
        { objectId: 'tenedor', xPct: 29.0, yPct: 30.3, scale: 0.456, rotationDeg: -25 },
        { objectId: 'pava', xPct: 14.4, yPct: 38.8, scale: 0.334 },
        { objectId: 'corazon', xPct: 55.3, yPct: 72.5, scale: 0.339, rotationDeg: 130 },
        { objectId: 'zapato', xPct: 69.9, yPct: 41.6, scale: 0.433, rotationDeg: 50 },
        { objectId: 'tenedor', xPct: 30.4, yPct: 43.7, scale: 0.415, rotationDeg: 25 },
        { objectId: 'pava', xPct: 68.9, yPct: 65.2, scale: 0.345, rotationDeg: -25 },
        { objectId: 'corazon', xPct: 14.2, yPct: 23.7, scale: 0.336, rotationDeg: -50 },
      ] },
      // cuchara: 3, manzana-roja: 4, taza: 4, termo: 4, tijera: 3  (18 en total)
      { items: [
        { objectId: 'tijera', xPct: 15.6, yPct: 26.0, scale: 0.449, rotationDeg: -80 },
        { objectId: 'termo', xPct: 52.5, yPct: 68.6, scale: 0.472, rotationDeg: 205 },
        { objectId: 'cuchara', xPct: 19.5, yPct: 32.8, scale: 0.461, rotationDeg: -130 },
        { objectId: 'taza', xPct: 46.7, yPct: 28.8, scale: 0.498, rotationDeg: 80 },
        { objectId: 'manzana-roja', xPct: 11.4, yPct: 53.8, scale: 0.327, rotationDeg: -80 },
        { objectId: 'taza', xPct: 83.8, yPct: 26.9, scale: 0.465, rotationDeg: -80 },
        { objectId: 'manzana-roja', xPct: 67.6, yPct: 67.0, scale: 0.497, rotationDeg: 205 },
        { objectId: 'tijera', xPct: 33.4, yPct: 66.2, scale: 0.408, rotationDeg: -25 },
        { objectId: 'termo', xPct: 53.5, yPct: 37.4, scale: 0.344, rotationDeg: -130 },
        { objectId: 'tijera', xPct: 81.0, yPct: 60.4, scale: 0.449, rotationDeg: -50 },
        { objectId: 'manzana-roja', xPct: 65.9, yPct: 31.0, scale: 0.44, rotationDeg: -130 },
        { objectId: 'taza', xPct: 48.0, yPct: 66.0, scale: 0.33, rotationDeg: -130 },
        { objectId: 'termo', xPct: 85.7, yPct: 33.9, scale: 0.359, rotationDeg: 80 },
        { objectId: 'cuchara', xPct: 28.2, yPct: 76.1, scale: 0.477 },
        { objectId: 'termo', xPct: 30.5, yPct: 23.8, scale: 0.411, rotationDeg: 80 },
        { objectId: 'taza', xPct: 71.1, yPct: 19.7, scale: 0.34, rotationDeg: -80 },
        { objectId: 'manzana-roja', xPct: 15.2, yPct: 74.7, scale: 0.381, rotationDeg: -25 },
        { objectId: 'cuchara', xPct: 27.8, yPct: 44.3, scale: 0.321, rotationDeg: -25 },
      ] },
      // botella: 3, mariposa: 4, reloj-pulsera: 3, sombrero: 4, tenedor: 4  (18 en total)
      { items: [
        { objectId: 'sombrero', xPct: 72.5, yPct: 46.4, scale: 0.404, rotationDeg: 130 },
        { objectId: 'sombrero', xPct: 30.2, yPct: 27.3, scale: 0.388, rotationDeg: 50 },
        { objectId: 'mariposa', xPct: 79.0, yPct: 41.7, scale: 0.498, rotationDeg: 130 },
        { objectId: 'tenedor', xPct: 67.1, yPct: 68.4, scale: 0.399, rotationDeg: 80 },
        { objectId: 'reloj-pulsera', xPct: 27.7, yPct: 57.1, scale: 0.44, rotationDeg: 205 },
        { objectId: 'tenedor', xPct: 86.7, yPct: 21.2, scale: 0.425 },
        { objectId: 'botella', xPct: 54.3, yPct: 66.1, scale: 0.481, rotationDeg: -130 },
        { objectId: 'sombrero', xPct: 47.9, yPct: 39.2, scale: 0.328, rotationDeg: 205 },
        { objectId: 'mariposa', xPct: 17.1, yPct: 71.6, scale: 0.491, rotationDeg: 80 },
        { objectId: 'tenedor', xPct: 16.1, yPct: 32.0, scale: 0.462, rotationDeg: -80 },
        { objectId: 'mariposa', xPct: 46.6, yPct: 62.8, scale: 0.436, rotationDeg: 50 },
        { objectId: 'botella', xPct: 18.9, yPct: 31.5, scale: 0.474, rotationDeg: 205 },
        { objectId: 'sombrero', xPct: 74.1, yPct: 26.8, scale: 0.403, rotationDeg: -25 },
        { objectId: 'reloj-pulsera', xPct: 48.3, yPct: 24.6, scale: 0.37, rotationDeg: -25 },
        { objectId: 'tenedor', xPct: 30.3, yPct: 33.7, scale: 0.328, rotationDeg: -50 },
        { objectId: 'botella', xPct: 83.9, yPct: 59.5, scale: 0.463, rotationDeg: 80 },
        { objectId: 'reloj-pulsera', xPct: 30.2, yPct: 72.6, scale: 0.413, rotationDeg: 25 },
        { objectId: 'mariposa', xPct: 16.7, yPct: 55.4, scale: 0.395, rotationDeg: 130 },
      ] },
    ],
  },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-se-esconde/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const PRAISE_GOOD = ['¡Excelente ojo!', '¡Muy bien contado!', '¡Así se hace!', '¡Qué buena percepción!']
const PRAISE_OK = [
  '¡Buen intento! Algunos estaban muy escondidos.',
  'Con la práctica vas a ir encontrando cada vez más.',
]

type Phase = 'play' | 'results'

export function CuantosHay({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` composiciones del pool del nivel, al azar y sin repetir dentro del
  // nivel — recalculadas una sola vez por nivel/roundKey.
  const rounds = useMemo(
    () => shuffle(level.compositions).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const composition = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  // Cuántos hay realmente de cada tipo, y en qué orden se muestran los
  // contadores (al azar por ronda, para que la posición no sea una pista).
  const truth = useMemo(() => {
    const m: Record<string, number> = {}
    if (composition) for (const it of composition.items) m[it.objectId] = (m[it.objectId] ?? 0) + 1
    return m
  }, [composition])
  const types = useMemo(() => shuffle(Object.keys(truth)), [truth])

  const [phase, setPhase] = useState<Phase>('play')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  // Acumulados a través de los niveles 1→2→3 y de las repeticiones del mismo
  // nivel; sólo se ponen en cero en un reinicio real del día (ver nextLevel).
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE_GOOD))
  }, [done])

  const countOf = (id: string) => counts[id] ?? 0
  function bump(id: string, delta: number) {
    if (phase !== 'play') return
    setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] ?? 0) + delta)) }))
  }

  const correctCount = types.filter((t) => countOf(t) === truth[t]).length

  function submit() {
    if (phase !== 'play') return
    setPhase('results')
    setPraise(pickOne(correctCount === types.length ? PRAISE_GOOD : PRAISE_OK))
    // Un "intento" por tipo a contar; un error por tipo con el número errado.
    setAccMistakes((m) => m + (types.length - correctCount))
    setAccAttempts((a) => a + types.length)
  }

  // El paso de ronda no es por timeout: la persona revisa qué contó de más o de
  // menos y avanza cuando quiere (mismo criterio que tenía "¿Qué se esconde?").
  function nextRound() {
    setRoundIdx((i) => i + 1)
    setCounts({})
    setPhase('play')
  }

  // Los reseteos van acá, sincrónicos con el cambio de nivel — nunca en un
  // useEffect con dependencia [levelIdx, roundKey]: un efecto llega un render
  // tarde y `done` leería el valor viejo justo al llegar al último nivel,
  // disparando onComplete con datos basura (ver ElVuelto.tsx).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setCounts({})
    setPhase('play')
    if (isWrap) {
      setAccMistakes(0)
      setAccAttempts(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setCounts({})
    setPhase('play')
    // NO se ponen en cero los acumulados: repetir un nivel no borra lo anterior.
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  // Columnas según cuántos tipos hay, para que siempre entren en dos filas: si
  // el nivel 3 sumara una fila más, se la comería a la lámina, que es justo lo
  // que este juego no puede permitirse.
  const chipCols = types.length <= 3 ? 'grid-cols-3' : types.length === 4 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {!done && (
          <>
            {phase === 'play' ? (
              <p className="mt-2 text-base text-slate-500">Contá cuántos hay de cada uno.</p>
            ) : (
              <p className="mt-2 text-base font-semibold text-slate-500">
                Acertaste {correctCount} de {types.length} — {praise}
              </p>
            )}
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {level.rounds}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-orange transition-[width] duration-300"
                  style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && composition && (
        <>
          {/* Lámina. Apaisada y a todo el ancho: un cuadrado de 160px tiraba la
              mitad del ancho del modal, y acá cada píxel es superficie donde
              buscar. */}
          <div className="relative isolate mx-auto mt-3 aspect-[5/3] w-full overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:mt-5">
            {composition.items.map((it, i) => {
              const img = imgFor(it.objectId)
              return (
                img && (
                  <img
                    key={`${it.objectId}-${i}`}
                    src={img}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute mix-blend-multiply"
                    style={{
                      left: `${it.xPct}%`,
                      top: `${it.yPct}%`,
                      // Escala sobre el ALTO del lienzo: el arte es cuadrada con el
                      // objeto centrado, así que en un lienzo apaisado una escala
                      // sobre el ancho haría cada objeto más alto que la caja.
                      height: `${it.scale * 100}%`,
                      width: 'auto',
                      transform: `translate(-50%, -50%) rotate(${it.rotationDeg ?? 0}deg)`,
                    }}
                  />
                )
              )
            })}
          </div>

          {/* Un contador por tipo */}
          <div className={`mt-3 grid gap-2 sm:mt-5 sm:gap-3 ${chipCols}`}>
            {types.map((id) => {
              const img = imgFor(id)
              const mine = countOf(id)
              const real = truth[id]
              const ok = phase === 'results' && mine === real
              const off = phase === 'results' && mine !== real
              return (
                <div
                  key={id}
                  className={[
                    'flex items-center gap-1 rounded-2xl border-2 bg-white px-1.5 py-1.5 transition',
                    ok ? 'border-tiam-green bg-tiam-green/5' : '',
                    // Nunca rojo: contar de más o de menos no es una falta, y el
                    // número real ya se muestra al lado.
                    off ? 'border-slate-300 bg-slate-50' : '',
                    phase === 'play' ? 'border-slate-200' : '',
                  ].join(' ')}
                >
                  {img && (
                    <img src={img} alt={LABELS[id] ?? id} className="h-8 w-8 shrink-0 object-contain" draggable={false} />
                  )}
                  {phase === 'play' ? (
                    <div className="flex flex-1 items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => bump(id, -1)}
                        disabled={mine === 0}
                        aria-label={`Menos ${LABELS[id] ?? id}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-95 disabled:opacity-30"
                      >
                        <Minus className="h-4 w-4" strokeWidth={3} />
                      </button>
                      <span className="min-w-[1.5ch] text-center text-lg font-extrabold text-slate-800">{mine}</span>
                      <button
                        type="button"
                        onClick={() => bump(id, 1)}
                        aria-label={`Más ${LABELS[id] ?? id}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tiam-blue text-white transition active:scale-95"
                      >
                        <Plus className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-end gap-1.5 pr-1">
                      {ok ? (
                        <>
                          <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                          <span className="text-lg font-extrabold text-tiam-green">{real}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-slate-400 line-through">{mine}</span>
                          <span className="text-lg font-extrabold text-slate-800">{real}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3 text-center sm:mt-4">
            {phase === 'play' ? (
              <button
                type="button"
                onClick={submit}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Listo
              </button>
            ) : (
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Contaste las {level.rounds} láminas — completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
