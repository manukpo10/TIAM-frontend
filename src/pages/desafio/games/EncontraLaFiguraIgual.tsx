import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Encontrá la figura igual" — a mental-rotation / visuospatial-matching task,
 * TIAM's second praxias game after "El reloj" (día 9). A target shape is shown
 * and 4 options are tappable; only ONE option is the same shape purely ROTATED
 * — never mirrored. A mirror image can look deceptively close but is NOT
 * reachable by rotation alone, which is exactly why it's the hardest level's
 * decoy: telling a true rotation apart from its reflection takes genuinely
 * rotating the shape in your head, not just matching silhouettes.
 *
 * All 7 shapes are drawn live in SVG from a shared <polygon> per shape id —
 * the same precedent ElReloj set (a clock is pure geometry, so rendering it
 * live is crisper than any fixed image set and needs zero art assets). Every
 * shape was hand-picked to be fully ASYMMETRIC: no rotational or mirror
 * symmetry at ANY angle, not just at 45°-multiples — otherwise a "wrong"
 * decoy could be silently pixel-identical to the correct answer (the reason a
 * plain square would never work here). Each shape's points are centered on
 * (0,0) — and every point sits well inside radius 50 — so the wrapping <g>'s
 * `rotate(deg) scale(mirrored ? -1 : 1, 1)` pivots around the shape's own
 * center and never clips the equally-centered viewBox at any angle.
 *
 * Difficulty ramps via decoy TYPE, not just rotation count: L1 decoys are
 * just other shapes (silhouette alone already tells them apart — a warm-up).
 * L2 mixes in same-shape decoys at clearly-wrong angles (≥90° away). L3 is
 * all same shape, including one same-angle MIRRORED decoy (the classic hard
 * trap: same orientation, flipped chirality) plus two ±45° near-miss
 * rotations — genuine mental rotation required, not pattern matching. A
 * wrong tap eliminates that option (muted grey, never red — QueObjetoEs's
 * convention) and never ends the round.
 *
 * VARIAS rondas por nivel (mismo patrón que ElVuelto/QueObjetoEs/QueSera):
 * ROUNDS_PER_LEVEL = [3, 4, 5], 12 rondas en total. No hay contenido fijo
 * para craftear a mano acá — cada ronda es una figura + rotación + decoys
 * armados al azar por `makeRound`. Los 4 tuples (figura, rotación, espejado)
 * de cada ronda nunca pueden chocar entre sí: se arman por CONSTRUCCIÓN sin
 * reemplazo (L1 saca 3 figuras distintas del pool sin la del target; L2
 * filtra ángulos a ≥90° del target para sus 2 decoys de la misma figura; L3
 * usa offsets fijos target±45°/mismo-ángulo-espejado, siempre distintos entre
 * sí y del target) — no hace falta un reintento en runtime para garantizar
 * unicidad, a diferencia de un sorteo ciego con re-roll.
 */

type ShapeId = 'ele' | 'flecha' | 'bandera' | 'casa' | 'rayo' | 'bota' | 'llave'

const SHAPES: ShapeId[] = ['ele', 'flecha', 'bandera', 'casa', 'rayo', 'bota', 'llave']
const ROTATIONS: number[] = [0, 45, 90, 135, 180, 225, 270, 315]

// Flat single-color fills reusing the brand tokens from index.css's @theme
// block (hardcoded hex, same convention ElReloj/ElVuelto use for their own
// SVG/chip colors instead of referencing var(--color-*) inline).
const SHAPE_COLOR: Record<ShapeId, string> = {
  ele: '#1B6FC4', // tiam-blue
  flecha: '#E8531E', // tiam-orange
  bandera: '#4CA52E', // tiam-green
  casa: '#15436F', // tiam-blue-dark
  rayo: '#E8531E', // tiam-orange
  bota: '#4CA52E', // tiam-green
  llave: '#15436F', // tiam-blue-dark
}

// Each polygon is centered on (0,0) inside a -50..50 viewBox, and every point
// sits well within radius ~38 of the origin (checked per shape) — so rotating
// by any of the 8 angles below never clips the SVG canvas. Every shape below
// was verified to have NO exact rotational or mirror symmetry: comparing its
// point set against its own 180°-rotation and against its own mirror image
// never reproduces the same set, so no (shape, rotation, mirrored) tuple can
// ever be visually identical to a different tuple of the same shape.
const SHAPE_POINTS: Record<ShapeId, string> = {
  // L-tetromino — a vertical bar with one foot to the right at the bottom.
  ele: '-16,-24 0,-24 0,8 16,8 16,24 -16,24',
  // Arrow pointing right, shaft offset toward the bottom so the head's back
  // corners are asymmetric (y -22 / +26) — a symmetric arrow would mirror
  // into itself and couldn't be used as a rotation-only decoy trap.
  flecha: '30,-4 6,-22 6,-6 -26,-6 -26,10 6,10 6,26',
  // A pole with a single triangular flag near the top, jutting right only.
  bandera: '-3,-30 3,-30 26,-21 3,-12 3,30 -3,30',
  // House silhouette: base + peaked roof (symmetric on their own) broken by
  // a chimney on the LEFT slope only — the off-center chimney is what makes
  // the whole silhouette asymmetric (a plain house roof would mirror clean).
  casa: '-22,31 -22,1 -14,-8 -14,-31 -6,-31 -6,-16 0,-23 22,1 22,31',
  // Classic lightning-bolt zigzag — inherently chiral, like the letter Z.
  rayo: '4,-32 -16,4 -2,4 -8,32 16,-6 2,-6',
  // Boot: a vertical leg, a toe sticking out to the right, and a heel
  // sticking out to the left at a different height — asymmetric front/back.
  bota: '-15,-28 1,-28 1,14 21,14 21,28 -21,28 -21,10 -15,10',
  // Flat key icon: rectangular bow on the left, thin shaft, ONE tooth
  // notched below the shaft near the tip (nothing mirrored above it).
  llave: '-29,-12 -13,-12 -13,-6 29,-6 29,2 17,2 17,11 9,11 9,2 -13,2 -13,8 -29,8',
}

function Shape({ id, rotation, mirrored }: { id: ShapeId; rotation: number; mirrored: boolean }) {
  return (
    <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
      <g transform={`rotate(${rotation}) scale(${mirrored ? -1 : 1} 1)`}>
        <polygon points={SHAPE_POINTS[id]} fill={SHAPE_COLOR[id]} />
      </g>
    </svg>
  )
}

interface ShapeOption {
  key: string
  shapeId: ShapeId
  rotation: number
  mirrored: boolean
  correct: boolean
}
interface Round {
  targetShapeId: ShapeId
  targetRotation: number
  options: ShapeOption[]
}
interface Level {
  n: number
  name: string
  rounds: number
  hint?: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    // No `hint`: at level 1 there's nothing to add that the heading doesn't
    // already say, and a line that only restates the heading costs the same
    // vertical space as one that teaches something. Levels 2 and 3 earn theirs.
    name: 'Nivel 1',
    rounds: 3,
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    hint: 'Ahora hay opciones con la misma figura girada a otro ángulo.',
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    hint: 'Ojo: una opción está reflejada, como en un espejo. Esa no vale.',
  },
]

// Every round resolves via a genuine correct tap (no give-up path here), so
// totalAttempts = mistakes + this fixed total — same shape as ElVuelto/QueObjetoEs.
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

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

function tupleKey(shapeId: ShapeId, rotation: number, mirrored: boolean): string {
  return `${shapeId}:${rotation}:${mirrored}`
}
function makeOption(shapeId: ShapeId, rotation: number, mirrored: boolean, correct: boolean): ShapeOption {
  return { key: tupleKey(shapeId, rotation, mirrored), shapeId, rotation, mirrored, correct }
}
// Shortest angular distance between two headings, mod 360 (e.g. 350 and 10
// are 20° apart, not 340°).
function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function makeRound(levelIdx: number): Round {
  const targetShapeId = pickOne(SHAPES)
  const targetRotation = pickOne(ROTATIONS)
  const correct = makeOption(targetShapeId, targetRotation, false, true)

  let decoys: ShapeOption[]
  if (levelIdx === 0) {
    // L1: 3 other shapes — sampled without replacement, so always distinct
    // from the target AND from each other — any rotation, never mirrored.
    const otherShapes = shuffle(SHAPES.filter((s) => s !== targetShapeId)).slice(0, 3)
    decoys = otherShapes.map((shapeId) => makeOption(shapeId, pickOne(ROTATIONS), false, false))
  } else if (levelIdx === 1) {
    // L2: 1 different-shape decoy (any rotation) + 2 same-shape decoys at
    // least 90° away from the target — filtered, then sampled without
    // replacement, so always distinct from each other and from the target.
    const otherShape = pickOne(SHAPES.filter((s) => s !== targetShapeId))
    const farRotations = shuffle(ROTATIONS.filter((r) => angularDistance(r, targetRotation) >= 90)).slice(0, 2)
    decoys = [
      makeOption(otherShape, pickOne(ROTATIONS), false, false),
      ...farRotations.map((r) => makeOption(targetShapeId, r, false, false)),
    ]
  } else {
    // L3: all same shape as target. One mirrored decoy at the SAME rotation
    // (the classic hard trap), plus two non-mirrored decoys at target±45°.
    // These 3 tuples can never collide with each other or the target: the
    // mirrored one differs by its `mirrored` flag alone, and +45/-45 (mod
    // 360) are always two rotations distinct from the target and from each
    // other — no runtime retry needed.
    decoys = [
      makeOption(targetShapeId, targetRotation, true, false),
      makeOption(targetShapeId, (targetRotation + 45) % 360, false, false),
      makeOption(targetShapeId, (targetRotation - 45 + 360) % 360, false, false),
    ]
  }

  return { targetShapeId, targetRotation, options: shuffle([correct, ...decoys]) }
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa no es — probá con otra opción.',
  'Casi. Fijate bien en la forma completa, no solo en el ángulo.',
  'No es esa — imaginate cómo se vería la figura de arriba si la girás.',
]

export function EncontraLaFiguraIgual({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `level.rounds` rondas generadas al azar, una sola vez por nivel/roundKey
  // — no en cada avance de roundIdx (mismo patrón que QueObjetoEs/QueSera).
  const rounds = useMemo(
    () => Array.from({ length: level.rounds }, () => makeRound(levelIdx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(option: ShapeOption) {
    if (!round || resolved || eliminated.has(option.key)) return
    if (option.correct) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(option.key))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see ElVuelto.tsx for
  // why: an effect-based reset lags one render behind, letting `done` read
  // stale-true right as levelIdx reaches the last level and firing
  // onComplete with garbage data.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra ronda" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when level 3's last round resolves. A full day
  // restart (the wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(124, 58, 237, 0.1)', color: '#7C3AED' }}
        >
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Tocá la figura igual a la de arriba, aunque esté girada
            </h2>
            {level.hint && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Target shape, sized to MATCH an option tile rather than to fill the
              width. Two reasons: a phone has to fit both rows of options without
              scrolling, and comparing a large reference against small candidates
              adds a mental rescaling step on top of the rotation this game is
              actually testing. Padding is p-1, not p-4, because SHAPE_POINTS
              already keeps every point inside radius ~38 of a radius-50 viewBox —
              the artwork carries its own ~24% margin, so box padding just shrinks
              the shape twice. */}
          <div className="relative mx-auto mt-3 aspect-square w-24 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-1 sm:mt-6 sm:w-32 sm:p-2">
            <Shape id={round.targetShapeId} rotation={round.targetRotation} mirrored={false} />
          </div>

          {/* Options */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-6">
            {round.options.map((option, idx) => {
              const isEliminated = eliminated.has(option.key)
              const isCorrectShown = resolved && option.correct
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  aria-label={`Opción ${idx + 1}`}
                  className={[
                    // Capped height, not aspect-square: in a 2-column grid on a
                    // phone that made every tile ~155px tall, so the second row
                    // of options fell below the fold. <Shape>'s viewBox letterboxes
                    // to the shorter side, so the shape stays square and centered
                    // regardless — it just draws at the height instead of the width.
                    // p-1 for the same reason as the target box above: the viewBox
                    // already carries the shape's margin.
                    'relative flex h-24 items-center justify-center rounded-2xl border-2 bg-white p-1 transition sm:h-32 sm:p-2',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 grayscale' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  <Shape id={option.shapeId} rotation={option.rotation} mirrored={option.mirrored} />
                  {isCorrectShown && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste las {level.rounds} figuras — completaste el {level.name.toLowerCase()}!
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
