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

// Día 27 rework: 3 niveles, UNA lámina por nivel (rounds: 1), las tres tan densas
// como el viejo nivel 3 — a pedido: "los tres tan complejos como el nivel 3, así
// de difícil". Cada nivel tiene un pool de 3 composiciones y muestra una al azar,
// para que repetir el día no dé siempre la misma. Escalada suave 18→19→20 objetos,
// todas por encima del viejo nivel 3. Generadas y verificadas offline, nunca en
// runtime (mismo criterio que CaminoNumerico).
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 1,
    compositions: [
      // anteojos: 3, banana: 4, cuchara: 3, taza: 4, tijera: 4  (18 en total)
      { items: [
        { objectId: 'banana', xPct: 54.6, yPct: 22.1, scale: 0.382, rotationDeg: 80 },
        { objectId: 'cuchara', xPct: 55.7, yPct: 68.9, scale: 0.468, rotationDeg: 205 },
        { objectId: 'taza', xPct: 88.3, yPct: 38.9, scale: 0.391 },
        { objectId: 'banana', xPct: 46.2, yPct: 40.0, scale: 0.507 },
        { objectId: 'cuchara', xPct: 26.3, yPct: 63.8, scale: 0.514, rotationDeg: -130 },
        { objectId: 'taza', xPct: 71.7, yPct: 63.9, scale: 0.354, rotationDeg: -25 },
        { objectId: 'tijera', xPct: 81.1, yPct: 59.5, scale: 0.475, rotationDeg: 25 },
        { objectId: 'anteojos', xPct: 26.5, yPct: 35.9, scale: 0.509, rotationDeg: -50 },
        { objectId: 'tijera', xPct: 65.8, yPct: 31.6, scale: 0.381, rotationDeg: 50 },
        { objectId: 'anteojos', xPct: 68.4, yPct: 25.1, scale: 0.377, rotationDeg: 205 },
        { objectId: 'taza', xPct: 17.2, yPct: 71.4, scale: 0.494, rotationDeg: 80 },
        { objectId: 'tijera', xPct: 16.0, yPct: 33.1, scale: 0.384, rotationDeg: 80 },
        { objectId: 'banana', xPct: 84.4, yPct: 26.0, scale: 0.449, rotationDeg: 80 },
        { objectId: 'taza', xPct: 20.3, yPct: 56.2, scale: 0.48, rotationDeg: 130 },
        { objectId: 'anteojos', xPct: 28.2, yPct: 63.3, scale: 0.358, rotationDeg: 50 },
        { objectId: 'cuchara', xPct: 32.2, yPct: 36.3, scale: 0.435, rotationDeg: 175 },
        { objectId: 'banana', xPct: 20.8, yPct: 34.6, scale: 0.491, rotationDeg: -50 },
        { objectId: 'tijera', xPct: 47.0, yPct: 63.7, scale: 0.373 }
      ] },
      // botella: 3, pava: 4, peine: 3, sombrero: 4, zapato: 4  (18 en total)
      { items: [
        { objectId: 'zapato', xPct: 15.4, yPct: 74.4, scale: 0.364, rotationDeg: 130 },
        { objectId: 'zapato', xPct: 30.9, yPct: 36.0, scale: 0.445 },
        { objectId: 'peine', xPct: 82.7, yPct: 58.6, scale: 0.497, rotationDeg: 80 },
        { objectId: 'pava', xPct: 12.2, yPct: 38.1, scale: 0.375, rotationDeg: 175 },
        { objectId: 'pava', xPct: 75.3, yPct: 61.5, scale: 0.379 },
        { objectId: 'botella', xPct: 52.4, yPct: 60.9, scale: 0.424, rotationDeg: -130 },
        { objectId: 'pava', xPct: 32.3, yPct: 59.6, scale: 0.432, rotationDeg: -25 },
        { objectId: 'sombrero', xPct: 33.0, yPct: 27.9, scale: 0.396, rotationDeg: 50 },
        { objectId: 'sombrero', xPct: 26.0, yPct: 70.6, scale: 0.417, rotationDeg: 50 },
        { objectId: 'botella', xPct: 84.9, yPct: 35.8, scale: 0.396 },
        { objectId: 'peine', xPct: 70.0, yPct: 31.6, scale: 0.358, rotationDeg: 80 },
        { objectId: 'sombrero', xPct: 57.7, yPct: 36.3, scale: 0.516, rotationDeg: -50 },
        { objectId: 'botella', xPct: 21.8, yPct: 62.8, scale: 0.515, rotationDeg: -130 },
        { objectId: 'pava', xPct: 51.3, yPct: 74.2, scale: 0.516 },
        { objectId: 'peine', xPct: 85.2, yPct: 24.6, scale: 0.454, rotationDeg: 175 },
        { objectId: 'zapato', xPct: 55.8, yPct: 35.1, scale: 0.416, rotationDeg: 175 },
        { objectId: 'zapato', xPct: 71.9, yPct: 25.2, scale: 0.358, rotationDeg: 130 },
        { objectId: 'sombrero', xPct: 15.0, yPct: 25.0, scale: 0.376, rotationDeg: 205 }
      ] },
      // corazon: 3, manzana-roja: 4, mariposa: 4, martillo: 4, tenedor: 3  (18 en total)
      { items: [
        { objectId: 'tenedor', xPct: 13.9, yPct: 17.4, scale: 0.348 },
        { objectId: 'mariposa', xPct: 81.0, yPct: 31.6, scale: 0.449, rotationDeg: -50 },
        { objectId: 'manzana-roja', xPct: 68.1, yPct: 75.6, scale: 0.387, rotationDeg: 80 },
        { objectId: 'mariposa', xPct: 14.9, yPct: 65.9, scale: 0.459, rotationDeg: 175 },
        { objectId: 'corazon', xPct: 24.4, yPct: 81.9, scale: 0.363 },
        { objectId: 'manzana-roja', xPct: 20.4, yPct: 34.0, scale: 0.482, rotationDeg: 130 },
        { objectId: 'martillo', xPct: 27.9, yPct: 44.8, scale: 0.391, rotationDeg: -80 },
        { objectId: 'mariposa', xPct: 48.2, yPct: 62.5, scale: 0.489, rotationDeg: 50 },
        { objectId: 'martillo', xPct: 14.9, yPct: 75.1, scale: 0.374, rotationDeg: 205 },
        { objectId: 'tenedor', xPct: 34.1, yPct: 66.2, scale: 0.402, rotationDeg: 175 },
        { objectId: 'corazon', xPct: 29.4, yPct: 24.7, scale: 0.351, rotationDeg: 50 },
        { objectId: 'manzana-roja', xPct: 85.0, yPct: 57.4, scale: 0.355, rotationDeg: -130 },
        { objectId: 'corazon', xPct: 88.8, yPct: 33.8, scale: 0.344, rotationDeg: 175 },
        { objectId: 'martillo', xPct: 51.8, yPct: 33.3, scale: 0.398 },
        { objectId: 'mariposa', xPct: 64.7, yPct: 26.0, scale: 0.392, rotationDeg: -25 },
        { objectId: 'tenedor', xPct: 50.1, yPct: 29.7, scale: 0.447, rotationDeg: 205 },
        { objectId: 'manzana-roja', xPct: 66.1, yPct: 34.2, scale: 0.361 },
        { objectId: 'martillo', xPct: 44.7, yPct: 75.9, scale: 0.444, rotationDeg: 175 }
      ] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 1,
    compositions: [
      // botella: 3, cuchara: 4, peine: 4, taza: 4, tijera: 4  (19 en total)
      { items: [
        { objectId: 'cuchara', xPct: 17.5, yPct: 39.2, scale: 0.44, rotationDeg: -25 },
        { objectId: 'taza', xPct: 17.4, yPct: 62.1, scale: 0.411, rotationDeg: 130 },
        { objectId: 'taza', xPct: 85.0, yPct: 25.1, scale: 0.356, rotationDeg: -50 },
        { objectId: 'peine', xPct: 89.2, yPct: 72.4, scale: 0.359 },
        { objectId: 'botella', xPct: 60.8, yPct: 22.1, scale: 0.441 },
        { objectId: 'peine', xPct: 72.8, yPct: 60.0, scale: 0.486, rotationDeg: -25 },
        { objectId: 'botella', xPct: 23.9, yPct: 66.1, scale: 0.353 },
        { objectId: 'taza', xPct: 60.6, yPct: 71.0, scale: 0.388, rotationDeg: 25 },
        { objectId: 'tijera', xPct: 24.3, yPct: 25.3, scale: 0.381, rotationDeg: 25 },
        { objectId: 'taza', xPct: 39.0, yPct: 22.1, scale: 0.333, rotationDeg: -25 },
        { objectId: 'peine', xPct: 81.4, yPct: 32.9, scale: 0.441, rotationDeg: 50 },
        { objectId: 'peine', xPct: 43.9, yPct: 39.4, scale: 0.387, rotationDeg: 80 },
        { objectId: 'tijera', xPct: 79.5, yPct: 25.1, scale: 0.357, rotationDeg: -50 },
        { objectId: 'cuchara', xPct: 43.7, yPct: 62.5, scale: 0.334, rotationDeg: 130 },
        { objectId: 'tijera', xPct: 58.9, yPct: 32.4, scale: 0.423, rotationDeg: 205 },
        { objectId: 'cuchara', xPct: 75.5, yPct: 33.4, scale: 0.426, rotationDeg: 50 },
        { objectId: 'cuchara', xPct: 20.8, yPct: 65.3, scale: 0.493, rotationDeg: -50 },
        { objectId: 'tijera', xPct: 25.6, yPct: 43.2, scale: 0.47, rotationDeg: 130 },
        { objectId: 'botella', xPct: 17.8, yPct: 29.7, scale: 0.422, rotationDeg: -50 }
      ] },
      // anteojos: 4, banana: 4, corazon: 3, sombrero: 4, zanahoria: 4  (19 en total)
      { items: [
        { objectId: 'sombrero', xPct: 88.7, yPct: 66.2, scale: 0.324, rotationDeg: 80 },
        { objectId: 'banana', xPct: 45.6, yPct: 65.1, scale: 0.481 },
        { objectId: 'sombrero', xPct: 46.8, yPct: 42.1, scale: 0.326 },
        { objectId: 'anteojos', xPct: 72.1, yPct: 26.3, scale: 0.374, rotationDeg: 50 },
        { objectId: 'sombrero', xPct: 22.7, yPct: 38.0, scale: 0.461, rotationDeg: 175 },
        { objectId: 'anteojos', xPct: 88.1, yPct: 19.8, scale: 0.396 },
        { objectId: 'banana', xPct: 86.6, yPct: 43.6, scale: 0.445 },
        { objectId: 'sombrero', xPct: 59.0, yPct: 31.2, scale: 0.47, rotationDeg: 25 },
        { objectId: 'anteojos', xPct: 15.7, yPct: 64.6, scale: 0.394, rotationDeg: 205 },
        { objectId: 'banana', xPct: 16.1, yPct: 41.5, scale: 0.464, rotationDeg: 80 },
        { objectId: 'zanahoria', xPct: 45.6, yPct: 28.9, scale: 0.435, rotationDeg: -25 },
        { objectId: 'corazon', xPct: 22.8, yPct: 61.2, scale: 0.331, rotationDeg: -25 },
        { objectId: 'corazon', xPct: 83.2, yPct: 28.3, scale: 0.401 },
        { objectId: 'zanahoria', xPct: 60.5, yPct: 56.8, scale: 0.484, rotationDeg: 80 },
        { objectId: 'zanahoria', xPct: 15.3, yPct: 25.5, scale: 0.471, rotationDeg: 175 },
        { objectId: 'banana', xPct: 26.4, yPct: 24.3, scale: 0.419, rotationDeg: -80 },
        { objectId: 'corazon', xPct: 59.0, yPct: 34.8, scale: 0.494, rotationDeg: -50 },
        { objectId: 'zanahoria', xPct: 20.6, yPct: 65.6, scale: 0.488, rotationDeg: 50 },
        { objectId: 'anteojos', xPct: 76.8, yPct: 63.6, scale: 0.378, rotationDeg: 130 }
      ] },
      // cuchara: 4, martillo: 4, pava: 4, reloj-pulsera: 3, termo: 4  (19 en total)
      { items: [
        { objectId: 'pava', xPct: 24.9, yPct: 25.5, scale: 0.471, rotationDeg: 175 },
        { objectId: 'reloj-pulsera', xPct: 79.1, yPct: 37.9, scale: 0.341 },
        { objectId: 'termo', xPct: 78.0, yPct: 29.2, scale: 0.414, rotationDeg: 50 },
        { objectId: 'pava', xPct: 43.1, yPct: 67.5, scale: 0.461, rotationDeg: 130 },
        { objectId: 'martillo', xPct: 60.5, yPct: 30.0, scale: 0.329, rotationDeg: 25 },
        { objectId: 'cuchara', xPct: 72.2, yPct: 60.2, scale: 0.406, rotationDeg: -50 },
        { objectId: 'martillo', xPct: 86.6, yPct: 22.3, scale: 0.385, rotationDeg: -80 },
        { objectId: 'termo', xPct: 15.7, yPct: 61.0, scale: 0.452, rotationDeg: -80 },
        { objectId: 'reloj-pulsera', xPct: 17.4, yPct: 37.8, scale: 0.437, rotationDeg: 205 },
        { objectId: 'cuchara', xPct: 20.0, yPct: 33.4, scale: 0.474, rotationDeg: 130 },
        { objectId: 'termo', xPct: 13.6, yPct: 22.7, scale: 0.322, rotationDeg: 50 },
        { objectId: 'martillo', xPct: 56.2, yPct: 69.8, scale: 0.414, rotationDeg: -25 },
        { objectId: 'pava', xPct: 42.3, yPct: 36.7, scale: 0.358, rotationDeg: 25 },
        { objectId: 'termo', xPct: 53.9, yPct: 28.0, scale: 0.398, rotationDeg: 130 },
        { objectId: 'pava', xPct: 85.7, yPct: 38.3, scale: 0.359, rotationDeg: 205 },
        { objectId: 'martillo', xPct: 88.0, yPct: 60.9, scale: 0.368, rotationDeg: 175 },
        { objectId: 'cuchara', xPct: 15.9, yPct: 73.4, scale: 0.4, rotationDeg: 205 },
        { objectId: 'cuchara', xPct: 30.1, yPct: 69.0, scale: 0.453, rotationDeg: -25 },
        { objectId: 'reloj-pulsera', xPct: 39.1, yPct: 24.6, scale: 0.424, rotationDeg: 80 }
      ] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 1,
    compositions: [
      // botella: 4, peine: 4, taza: 4, tenedor: 4, tijera: 4  (20 en total)
      { items: [
        { objectId: 'tijera', xPct: 59.8, yPct: 64.3, scale: 0.406, rotationDeg: -80 },
        { objectId: 'tenedor', xPct: 61.9, yPct: 19.9, scale: 0.344, rotationDeg: -80 },
        { objectId: 'peine', xPct: 84.7, yPct: 43.8, scale: 0.385, rotationDeg: 25 },
        { objectId: 'peine', xPct: 73.0, yPct: 69.5, scale: 0.41, rotationDeg: 205 },
        { objectId: 'tenedor', xPct: 89.2, yPct: 68.2, scale: 0.359 },
        { objectId: 'tijera', xPct: 21.5, yPct: 36.6, scale: 0.368, rotationDeg: -25 },
        { objectId: 'botella', xPct: 16.1, yPct: 45.3, scale: 0.403, rotationDeg: -25 },
        { objectId: 'taza', xPct: 46.4, yPct: 67.2, scale: 0.438, rotationDeg: 80 },
        { objectId: 'tijera', xPct: 45.1, yPct: 32.7, scale: 0.479, rotationDeg: -80 },
        { objectId: 'botella', xPct: 15.0, yPct: 24.9, scale: 0.375, rotationDeg: -25 },
        { objectId: 'tenedor', xPct: 57.3, yPct: 42.2, scale: 0.331, rotationDeg: 205 },
        { objectId: 'botella', xPct: 23.4, yPct: 74.9, scale: 0.378, rotationDeg: 205 },
        { objectId: 'taza', xPct: 22.6, yPct: 30.0, scale: 0.451, rotationDeg: -25 },
        { objectId: 'tenedor', xPct: 38.4, yPct: 20.9, scale: 0.315, rotationDeg: 25 },
        { objectId: 'taza', xPct: 23.1, yPct: 60.9, scale: 0.431, rotationDeg: -80 },
        { objectId: 'tijera', xPct: 71.9, yPct: 30.4, scale: 0.402, rotationDeg: 130 },
        { objectId: 'peine', xPct: 18.9, yPct: 67.7, scale: 0.475, rotationDeg: 25 },
        { objectId: 'taza', xPct: 13.9, yPct: 76.8, scale: 0.329, rotationDeg: -130 },
        { objectId: 'peine', xPct: 86.6, yPct: 22.4, scale: 0.318, rotationDeg: -130 },
        { objectId: 'botella', xPct: 75.1, yPct: 24.3, scale: 0.42, rotationDeg: -80 }
      ] },
      // banana: 4, mariposa: 4, sombrero: 4, zanahoria: 4, zapato: 4  (20 en total)
      { items: [
        { objectId: 'zapato', xPct: 36.1, yPct: 31.8, scale: 0.451, rotationDeg: -50 },
        { objectId: 'zanahoria', xPct: 28.6, yPct: 76.4, scale: 0.408, rotationDeg: 80 },
        { objectId: 'sombrero', xPct: 60.3, yPct: 36.6, scale: 0.341, rotationDeg: 50 },
        { objectId: 'zapato', xPct: 59.6, yPct: 21.4, scale: 0.395, rotationDeg: 175 },
        { objectId: 'zapato', xPct: 17.9, yPct: 70.2, scale: 0.423, rotationDeg: 130 },
        { objectId: 'sombrero', xPct: 22.8, yPct: 30.3, scale: 0.43, rotationDeg: 50 },
        { objectId: 'banana', xPct: 79.8, yPct: 23.7, scale: 0.336, rotationDeg: 130 },
        { objectId: 'mariposa', xPct: 25.7, yPct: 33.6, scale: 0.403, rotationDeg: 175 },
        { objectId: 'zanahoria', xPct: 58.1, yPct: 67.0, scale: 0.426, rotationDeg: 130 },
        { objectId: 'banana', xPct: 24.1, yPct: 64.9, scale: 0.331, rotationDeg: 80 },
        { objectId: 'zanahoria', xPct: 11.8, yPct: 66.2, scale: 0.363, rotationDeg: 175 },
        { objectId: 'sombrero', xPct: 87.0, yPct: 62.2, scale: 0.326, rotationDeg: 25 },
        { objectId: 'sombrero', xPct: 72.9, yPct: 70.0, scale: 0.381, rotationDeg: -50 },
        { objectId: 'mariposa', xPct: 84.6, yPct: 25.6, scale: 0.442, rotationDeg: 80 },
        { objectId: 'zapato', xPct: 76.1, yPct: 37.7, scale: 0.443, rotationDeg: 175 },
        { objectId: 'mariposa', xPct: 44.2, yPct: 61.0, scale: 0.446, rotationDeg: 80 },
        { objectId: 'mariposa', xPct: 80.5, yPct: 43.1, scale: 0.461, rotationDeg: -130 },
        { objectId: 'banana', xPct: 40.0, yPct: 35.6, scale: 0.457, rotationDeg: 130 },
        { objectId: 'banana', xPct: 11.9, yPct: 19.8, scale: 0.396 },
        { objectId: 'zanahoria', xPct: 15.0, yPct: 27.3, scale: 0.355, rotationDeg: 130 }
      ] },
      // anteojos: 4, corazon: 4, manzana-roja: 4, reloj-pulsera: 4, termo: 4  (20 en total)
      { items: [
        { objectId: 'manzana-roja', xPct: 71.2, yPct: 18.4, scale: 0.339, rotationDeg: 175 },
        { objectId: 'corazon', xPct: 23.4, yPct: 80.2, scale: 0.365, rotationDeg: 175 },
        { objectId: 'manzana-roja', xPct: 83.6, yPct: 27.3, scale: 0.471, rotationDeg: 80 },
        { objectId: 'termo', xPct: 18.4, yPct: 26.3, scale: 0.454, rotationDeg: -80 },
        { objectId: 'anteojos', xPct: 12.9, yPct: 37.3, scale: 0.305, rotationDeg: 50 },
        { objectId: 'corazon', xPct: 60.7, yPct: 26.1, scale: 0.393, rotationDeg: -25 },
        { objectId: 'anteojos', xPct: 24.5, yPct: 70.8, scale: 0.377, rotationDeg: 25 },
        { objectId: 'manzana-roja', xPct: 53.5, yPct: 33.4, scale: 0.407, rotationDeg: -50 },
        { objectId: 'reloj-pulsera', xPct: 40.0, yPct: 32.3, scale: 0.442, rotationDeg: 175 },
        { objectId: 'anteojos', xPct: 12.6, yPct: 21.0, scale: 0.363, rotationDeg: -80 },
        { objectId: 'reloj-pulsera', xPct: 83.6, yPct: 32.2, scale: 0.411, rotationDeg: 205 },
        { objectId: 'manzana-roja', xPct: 77.0, yPct: 38.6, scale: 0.412, rotationDeg: -130 },
        { objectId: 'termo', xPct: 13.9, yPct: 58.5, scale: 0.329, rotationDeg: 130 },
        { objectId: 'reloj-pulsera', xPct: 87.1, yPct: 70.6, scale: 0.371, rotationDeg: -80 },
        { objectId: 'corazon', xPct: 25.4, yPct: 34.4, scale: 0.421, rotationDeg: 25 },
        { objectId: 'corazon', xPct: 74.8, yPct: 62.3, scale: 0.301, rotationDeg: -25 },
        { objectId: 'termo', xPct: 13.6, yPct: 77.4, scale: 0.34, rotationDeg: 205 },
        { objectId: 'reloj-pulsera', xPct: 61.3, yPct: 62.6, scale: 0.355, rotationDeg: -80 },
        { objectId: 'termo', xPct: 41.9, yPct: 26.1, scale: 0.393, rotationDeg: 205 },
        { objectId: 'anteojos', xPct: 45.7, yPct: 53.2, scale: 0.341, rotationDeg: -25 }
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
            {/* Barra de avance de niveles (1→2→3), no de rondas: cada nivel es una
                sola lámina, así que "llevás 0 de 1" no diría nada. */}
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Lámina {levelIdx + 1} de {LEVELS.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-orange transition-[width] duration-300"
                  style={{ width: `${(levelIdx / LEVELS.length) * 100}%` }}
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
            {levelIdx < LEVELS.length - 1
              ? `¡Completaste la lámina ${levelIdx + 1}! Te espera una más difícil.`
              : '¡Completaste las tres láminas del día — el nivel más difícil incluido!'}
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
