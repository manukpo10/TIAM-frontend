import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Dónde está?" — día 20, praxias (visuoespacial). Replaces "¿Qué objeto
 * es?" (a lenguaje riddle game) — the área swap moves this slot into
 * praxias, which had only 2 exercises (día 6 motor-praxis, día 9 clock-
 * reading), tied lowest with cálculo before this.
 *
 * A synthesis of two competitor worksheet TYPES the user shared (content
 * entirely ours): one drilled spatial-relation vocabulary (dentro/encima/
 * a la izquierda/debajo/a la derecha, applied to a shape-and-box diagram);
 * the other was visual pattern-matching (find which of several targets
 * matches a reference arrangement). Bolting the two together as separate
 * mini-games would have been arbitrary — instead nivel 3 uses the SAME
 * vocabulary nivel 1/2 teach as the criterion for a matching task: find
 * which of several two-shape scenes has both shapes in the same relations
 * as the reference. Genuinely one skill applied twice, not two skills
 * stapled together.
 *
 *   Nivel 1 — a scene is shown; tap the WORD naming its relation
 *             (recognition: diagram → word).
 *   Nivel 2 — a word is given; tap the SCENE showing that relation among
 *             3 candidates, all same shape/colour so only position differs
 *             (production: word → diagram, the harder direction).
 *   Nivel 3 — a reference scene shows TWO shapes each in a relation; tap
 *             the one of 3 candidate scenes that matches BOTH exactly.
 *             Each decoy differs from the reference in exactly one field
 *             (one shape's relation, or one shape's colour) — never in a
 *             way that could make two candidates simultaneously valid, the
 *             same discipline LaPiramide's content got, verified by script
 *             before writing this component.
 *
 * Pure CSS shapes (no Flux photos) — the content is inherently abstract
 * (a colour/shape/position triple), so generated photos would add nothing
 * a plain circle/square/triangle doesn't already say clearly, and a
 * hand-drawn scene is trivially guaranteed correct (no risk of a bad
 * render), unlike every photo-based game in this app.
 *
 * Same "eliminate wrong, keep trying" pattern as CadaCosaEnSuGrupo/
 * QueObjetoEs (3 options, never red, no timer). Pool-and-shuffle content.
 */

type ShapeKind = 'circle' | 'square' | 'triangle'
type Relation = 'dentro' | 'encima' | 'debajo' | 'izquierda' | 'derecha'
type ColorKey = 'red' | 'blue' | 'green' | 'amber' | 'purple'

interface PlacedShape {
  shape: ShapeKind
  color: ColorKey
  relation: Relation
}

const RELATION_LABEL: Record<Relation, string> = {
  dentro: 'Dentro',
  encima: 'Encima',
  debajo: 'Debajo',
  izquierda: 'A la izquierda',
  derecha: 'A la derecha',
}
const COLOR_CLASS: Record<ColorKey, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  purple: 'bg-purple-500',
}
const COLOR_HEX: Record<ColorKey, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#fbbf24',
  purple: '#a855f7',
}

// ── Scene geometry — fixed pixel layout, computed once, no runtime DOM
// measurement needed. Every shape sits in a uniform 30×30 slot regardless
// of its own rendering (the triangle centers itself inside that slot), so
// position math never depends on which shape kind is placed there.
const SCENE_W = 200
const SCENE_H = 140
const BOX_W = 90
const BOX_H = 56
const BOX_LEFT = (SCENE_W - BOX_W) / 2
const BOX_TOP = (SCENE_H - BOX_H) / 2
const SLOT = 30
const GAP = 8

function slotPos(relation: Relation): { left: number; top: number } {
  const cx = BOX_LEFT + BOX_W / 2
  const cy = BOX_TOP + BOX_H / 2
  switch (relation) {
    case 'dentro':
      return { left: cx - SLOT / 2, top: cy - SLOT / 2 }
    case 'encima':
      return { left: cx - SLOT / 2, top: BOX_TOP - GAP - SLOT }
    case 'debajo':
      return { left: cx - SLOT / 2, top: BOX_TOP + BOX_H + GAP }
    case 'izquierda':
      return { left: BOX_LEFT - GAP - SLOT, top: cy - SLOT / 2 }
    case 'derecha':
      return { left: BOX_LEFT + BOX_W + GAP, top: cy - SLOT / 2 }
  }
}

function ShapeGlyph({ kind, color }: { kind: ShapeKind; color: ColorKey }) {
  if (kind === 'circle') return <div className={`h-full w-full rounded-full ${COLOR_CLASS[color]}`} />
  if (kind === 'square') return <div className={`h-full w-full rounded-md ${COLOR_CLASS[color]}`} />
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '13px solid transparent',
          borderRight: '13px solid transparent',
          borderBottom: `22px solid ${COLOR_HEX[color]}`,
        }}
      />
    </div>
  )
}

function Scene({ shapes, highlight }: { shapes: PlacedShape[]; highlight?: boolean }) {
  return (
    <div
      className={`relative mx-auto shrink-0 rounded-xl ${highlight ? 'bg-tiam-blue/5' : ''}`}
      style={{ width: SCENE_W, height: SCENE_H }}
    >
      <div
        className="absolute rounded-lg border-2 border-slate-300 bg-white"
        style={{ left: BOX_LEFT, top: BOX_TOP, width: BOX_W, height: BOX_H }}
      />
      {shapes.map((s, i) => {
        const pos = slotPos(s.relation)
        return (
          <div key={i} className="absolute" style={{ left: pos.left, top: pos.top, width: SLOT, height: SLOT }}>
            <ShapeGlyph kind={s.shape} color={s.color} />
          </div>
        )
      })}
    </div>
  )
}

// ── Level 1: scene shown, tap the naming word ───────────────────────────
interface L1Round {
  scene: PlacedShape
  options: Relation[] // includes the correct value
}
// ── Level 2: word given, tap the matching scene among candidates that
// differ ONLY in position (same shape/colour) ──────────────────────────
interface L2Round {
  target: Relation
  shape: ShapeKind
  color: ColorKey
  candidateRelations: Relation[] // includes `target`
}
// ── Level 3: two-shape reference; tap the candidate scene matching both
// shapes exactly (colour + relation) ────────────────────────────────────
interface L3Round {
  reference: [PlacedShape, PlacedShape]
  candidates: [PlacedShape, PlacedShape][] // includes `reference` as one entry
}

const L1_POOL: L1Round[] = [
  { scene: { shape: 'circle', color: 'red', relation: 'dentro' }, options: ['dentro', 'encima', 'izquierda'] },
  { scene: { shape: 'square', color: 'blue', relation: 'encima' }, options: ['encima', 'debajo', 'derecha'] },
  { scene: { shape: 'triangle', color: 'green', relation: 'izquierda' }, options: ['izquierda', 'derecha', 'dentro'] },
  { scene: { shape: 'circle', color: 'purple', relation: 'debajo' }, options: ['debajo', 'encima', 'izquierda'] },
  { scene: { shape: 'square', color: 'amber', relation: 'derecha' }, options: ['derecha', 'izquierda', 'dentro'] },
]

const L2_POOL: L2Round[] = [
  { target: 'encima', shape: 'circle', color: 'red', candidateRelations: ['encima', 'debajo', 'izquierda'] },
  { target: 'izquierda', shape: 'square', color: 'blue', candidateRelations: ['izquierda', 'derecha', 'dentro'] },
  { target: 'dentro', shape: 'triangle', color: 'green', candidateRelations: ['dentro', 'encima', 'derecha'] },
  { target: 'derecha', shape: 'circle', color: 'purple', candidateRelations: ['derecha', 'izquierda', 'debajo'] },
  { target: 'debajo', shape: 'square', color: 'amber', candidateRelations: ['debajo', 'dentro', 'encima'] },
]

// Every reference's two decoys each differ from it in exactly ONE field
// (verified by script — see the game's authoring notes): either the second
// shape's relation, or the first shape's colour.
const L3_POOL: L3Round[] = [
  {
    reference: [{ shape: 'circle', color: 'red', relation: 'encima' }, { shape: 'square', color: 'blue', relation: 'izquierda' }],
    candidates: [
      [{ shape: 'circle', color: 'red', relation: 'encima' }, { shape: 'square', color: 'blue', relation: 'izquierda' }],
      [{ shape: 'circle', color: 'red', relation: 'encima' }, { shape: 'square', color: 'blue', relation: 'derecha' }],
      [{ shape: 'circle', color: 'green', relation: 'encima' }, { shape: 'square', color: 'blue', relation: 'izquierda' }],
    ],
  },
  {
    reference: [{ shape: 'triangle', color: 'green', relation: 'dentro' }, { shape: 'circle', color: 'purple', relation: 'derecha' }],
    candidates: [
      [{ shape: 'triangle', color: 'green', relation: 'dentro' }, { shape: 'circle', color: 'purple', relation: 'derecha' }],
      [{ shape: 'triangle', color: 'green', relation: 'dentro' }, { shape: 'circle', color: 'purple', relation: 'debajo' }],
      [{ shape: 'triangle', color: 'amber', relation: 'dentro' }, { shape: 'circle', color: 'purple', relation: 'derecha' }],
    ],
  },
  {
    reference: [{ shape: 'square', color: 'amber', relation: 'debajo' }, { shape: 'triangle', color: 'red', relation: 'izquierda' }],
    candidates: [
      [{ shape: 'square', color: 'amber', relation: 'debajo' }, { shape: 'triangle', color: 'red', relation: 'izquierda' }],
      [{ shape: 'square', color: 'amber', relation: 'debajo' }, { shape: 'triangle', color: 'red', relation: 'encima' }],
      [{ shape: 'square', color: 'blue', relation: 'debajo' }, { shape: 'triangle', color: 'red', relation: 'izquierda' }],
    ],
  },
  {
    reference: [{ shape: 'circle', color: 'blue', relation: 'encima' }, { shape: 'square', color: 'green', relation: 'derecha' }],
    candidates: [
      [{ shape: 'circle', color: 'blue', relation: 'encima' }, { shape: 'square', color: 'green', relation: 'derecha' }],
      [{ shape: 'circle', color: 'blue', relation: 'encima' }, { shape: 'square', color: 'green', relation: 'izquierda' }],
      [{ shape: 'circle', color: 'purple', relation: 'encima' }, { shape: 'square', color: 'green', relation: 'derecha' }],
    ],
  },
  {
    reference: [{ shape: 'triangle', color: 'purple', relation: 'dentro' }, { shape: 'circle', color: 'amber', relation: 'izquierda' }],
    candidates: [
      [{ shape: 'triangle', color: 'purple', relation: 'dentro' }, { shape: 'circle', color: 'amber', relation: 'izquierda' }],
      [{ shape: 'triangle', color: 'purple', relation: 'dentro' }, { shape: 'circle', color: 'amber', relation: 'derecha' }],
      [{ shape: 'triangle', color: 'red', relation: 'dentro' }, { shape: 'circle', color: 'amber', relation: 'izquierda' }],
    ],
  },
  {
    reference: [{ shape: 'square', color: 'red', relation: 'derecha' }, { shape: 'triangle', color: 'blue', relation: 'debajo' }],
    candidates: [
      [{ shape: 'square', color: 'red', relation: 'derecha' }, { shape: 'triangle', color: 'blue', relation: 'debajo' }],
      [{ shape: 'square', color: 'red', relation: 'derecha' }, { shape: 'triangle', color: 'blue', relation: 'encima' }],
      [{ shape: 'square', color: 'green', relation: 'derecha' }, { shape: 'triangle', color: 'blue', relation: 'debajo' }],
    ],
  },
  {
    reference: [{ shape: 'circle', color: 'green', relation: 'izquierda' }, { shape: 'square', color: 'purple', relation: 'encima' }],
    candidates: [
      [{ shape: 'circle', color: 'green', relation: 'izquierda' }, { shape: 'square', color: 'purple', relation: 'encima' }],
      [{ shape: 'circle', color: 'green', relation: 'izquierda' }, { shape: 'square', color: 'purple', relation: 'debajo' }],
      [{ shape: 'circle', color: 'amber', relation: 'izquierda' }, { shape: 'square', color: 'purple', relation: 'encima' }],
    ],
  },
]

// Same 2/3/3 tuning used across the app's leveled games.
const ROUNDS_PER_LEVEL = [2, 3, 3]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

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
function sameShapes(a: PlacedShape, b: PlacedShape): boolean {
  return a.shape === b.shape && a.color === b.color && a.relation === b.relation
}
function samePair(a: [PlacedShape, PlacedShape], b: [PlacedShape, PlacedShape]): boolean {
  return sameShapes(a[0], b[0]) && sameShapes(a[1], b[1])
}

const HINTS = ['Ese no es — fijate bien dónde está.', 'Casi. Mirá con calma la posición.', 'No es ese. Probá con otro.']
const LEVEL_PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo espacial!']
const LEVEL_PRAISE_OK = ['¡Buen intento! Con la práctica se ve cada vez más fácil.', '¡Bien ahí! Seguí practicando.']

export function DondeEsta({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  const l1Order = useMemo(
    () => shuffle(L1_POOL).slice(0, ROUNDS_PER_LEVEL[0]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundKey, levelIdx],
  )
  const l2Order = useMemo(
    () => shuffle(L2_POOL).slice(0, ROUNDS_PER_LEVEL[1]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundKey, levelIdx],
  )
  const l3Order = useMemo(
    () => shuffle(L3_POOL).slice(0, ROUNDS_PER_LEVEL[2]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundKey, levelIdx],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= roundsForLevel

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctCount / roundsForLevel >= 0.6 ? LEVEL_PRAISE_GOOD : LEVEL_PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function advance() {
    window.setTimeout(() => {
      setRoundIdx((i) => i + 1)
      setEliminated(new Set())
      setSolved(false)
      setHint(null)
    }, 1000)
  }

  // ── Nivel 1: tap the correct word ───────────────────────────────────
  const l1Round = levelIdx === 0 ? (l1Order[roundIdx] as L1Round | undefined) : undefined
  const l1Options = useMemo(
    () => (l1Round ? shuffle(l1Round.options) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [l1Round],
  )
  function guessL1(relation: Relation) {
    if (!l1Round || solved || eliminated.has(relation)) return
    if (relation === l1Round.scene.relation) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      advance()
    } else {
      setEliminated((prev) => (prev.has(relation) ? prev : new Set(prev).add(relation)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // ── Nivel 2: tap the correct scene ──────────────────────────────────
  const l2Round = levelIdx === 1 ? (l2Order[roundIdx] as L2Round | undefined) : undefined
  const l2Candidates = useMemo(
    () => (l2Round ? shuffle(l2Round.candidateRelations) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [l2Round],
  )
  function guessL2(relation: Relation) {
    if (!l2Round || solved || eliminated.has(relation)) return
    if (relation === l2Round.target) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      advance()
    } else {
      setEliminated((prev) => (prev.has(relation) ? prev : new Set(prev).add(relation)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // ── Nivel 3: tap the candidate scene matching the reference ────────
  const l3Round = levelIdx === 2 ? (l3Order[roundIdx] as L3Round | undefined) : undefined
  const l3Candidates = useMemo(
    () => (l3Round ? shuffle(l3Round.candidates) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [l3Round],
  )
  function guessL3(idx: number) {
    if (!l3Round || solved || eliminated.has(String(idx))) return
    const candidate = l3Candidates[idx]
    if (samePair(candidate, l3Round.reference)) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      advance()
    } else {
      setEliminated((prev) => (prev.has(String(idx)) ? prev : new Set(prev).add(String(idx))))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  function nextLevel() {
    const isWrap = levelIdx === 2
    setLevelIdx((i) => (i < 2 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === 2 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const levelName = `Nivel ${levelIdx + 1}`

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-purple-700">
          {levelName}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {levelIdx === 0 && 'Mirá dónde está la figura y tocá cómo se llama esa posición.'}
              {levelIdx === 1 && 'Tocá el dibujo donde la figura está en la posición indicada.'}
              {levelIdx === 2 && 'Tocá el dibujo que tiene las dos figuras en el mismo lugar que el de arriba.'}
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-purple-600 transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Nivel 1 */}
      {!done && levelIdx === 0 && l1Round && (
        <>
          <Scene shapes={[l1Round.scene]} />
          <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5">
            {l1Options.map((rel) => {
              const isEliminated = eliminated.has(rel)
              return (
                <button
                  key={rel}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guessL1(rel)}
                  className={[
                    'min-h-[52px] rounded-2xl border-2 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {RELATION_LABEL[rel]}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Nivel 2 */}
      {!done && levelIdx === 1 && l2Round && (
        <>
          <p className="mt-4 text-center text-xl font-extrabold text-tiam-blue">{RELATION_LABEL[l2Round.target]}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {l2Candidates.map((rel, i) => {
              const isEliminated = eliminated.has(rel)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guessL2(rel)}
                  className={[
                    'rounded-2xl border-2 p-1 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 opacity-40'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <Scene shapes={[{ shape: l2Round.shape, color: l2Round.color, relation: rel }]} />
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Nivel 3 */}
      {!done && levelIdx === 2 && l3Round && (
        <>
          <p className="mt-3 text-center text-sm font-semibold text-slate-500">Modelo</p>
          <Scene shapes={l3Round.reference} highlight />
          <p className="mt-4 text-center text-sm font-semibold text-slate-500">¿Cuál es igual?</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {l3Candidates.map((cand, i) => {
              const isEliminated = eliminated.has(String(i))
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guessL3(i)}
                  className={[
                    'rounded-2xl border-2 p-1 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 opacity-40'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <Scene shapes={cand} />
                </button>
              )
            })}
          </div>
        </>
      )}

      {hint && !solved && !done && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Completaste las {roundsForLevel} rondas — terminaste el {levelName.toLowerCase()}.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < 2 ? 'Siguiente nivel' : 'Empezar de nuevo'}
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
