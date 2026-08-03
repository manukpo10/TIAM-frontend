import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La pirámide" — día 16, cálculo (third slot in the area). A number pyramid:
 * every cell equals the sum of the two directly below it. Some cells are
 * blank; tap the correct value among 3 options to fill each one, in order.
 *
 * It replaces "¿Alcanza la plata?", which resolved in a single glance-and-tap
 * (compare two pre-summed numbers) — genuinely too light. This one requires
 * MULTIPLE deliberate steps per puzzle, matching the "several taps to reach
 * an answer" shape ElVuelto and ContadorMasMenos already established for
 * this area, while covering an operation neither of those two touch:
 * ElVuelto CONSTRUCTS exact change (subtraction via bill-picking),
 * ContadorMasMenos ADJUSTS a single counter toward a proportional target —
 * this one CHAINS additions and subtractions through a fixed numeric
 * structure, and level 3 genuinely requires solving one blank before the
 * next becomes solvable (sequential multi-step reasoning, not just more
 * rounds of the same single step).
 *
 * Solving direction depends on the cell's position, by construction of the
 * pyramid (parent = left-child + right-child):
 *   - a blank TOP is always addition (its two children are visible)
 *   - a blank in the BASE row is always subtraction (parent minus the one
 *     visible sibling)
 * L1 blanks the top (addition only). L2 blanks a base cell (introduces
 * subtraction). L3 blanks two cells in solve order — a base cell first
 * (subtraction), then a mid cell that depends on the just-revealed base
 * value (addition) — so the second choice is genuinely gated on the first.
 *
 * Every one of the 17 authored puzzles was verified by script (not by eye)
 * for internal consistency (mid = sum of its two children, top = sum of the
 * two mids) and for each blank having exactly one correct option among
 * three, with no duplicate or negative options — the same discipline the
 * deduction-game content got after an earlier ambiguity was caught there.
 *
 * Wrong taps eliminate that option (muted grey, never red) and nudge — the
 * same "keep trying among what's left" pattern as CadaCosaEnSuGrupo/
 * QueObjetoEs, appropriate here since each blank has 3 options, not 2.
 * No timer. Pool-and-shuffle content, like every other game.
 */

type CellKey = 'baseL' | 'baseM' | 'baseR' | 'midL' | 'midR' | 'top'

interface BlankSpec {
  key: CellKey
  options: number[] // includes the correct value; shuffled at render
}
interface Puzzle {
  values: Record<CellKey, number>
  blanks: BlankSpec[] // solve order — later blanks may depend on earlier ones
}
interface Level {
  n: number
  name: string
  pool: Puzzle[]
}

function pyramid(baseL: number, baseM: number, baseR: number, blanks: BlankSpec[]): Puzzle {
  const midL = baseL + baseM
  const midR = baseM + baseR
  const top = midL + midR
  return { values: { baseL, baseM, baseR, midL, midR, top }, blanks }
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    // Blank = top only. Solve by adding the two numbers directly below it.
    pool: [
      pyramid(3, 2, 4, [{ key: 'top', options: [11, 9, 14] }]),
      pyramid(4, 1, 3, [{ key: 'top', options: [9, 7, 12] }]),
      pyramid(2, 5, 3, [{ key: 'top', options: [15, 13, 18] }]),
      pyramid(6, 1, 2, [{ key: 'top', options: [10, 8, 13] }]),
      pyramid(3, 4, 1, [{ key: 'top', options: [12, 10, 15] }]),
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    // Blank = the middle base cell. Solve by subtracting a visible sibling
    // from the mid number above it — the first time subtraction is needed.
    pool: [
      pyramid(8, 5, 3, [{ key: 'baseM', options: [5, 3, 8] }]),
      pyramid(9, 4, 5, [{ key: 'baseM', options: [4, 2, 7] }]),
      pyramid(7, 6, 2, [{ key: 'baseM', options: [6, 4, 9] }]),
      pyramid(10, 3, 6, [{ key: 'baseM', options: [3, 1, 6] }]),
      pyramid(8, 7, 4, [{ key: 'baseM', options: [7, 5, 10] }]),
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    // Two blanks, in order: the middle base cell (subtraction, as in nivel
    // 2), THEN a mid cell that needs that just-solved value plus a visible
    // base cell (addition) — genuinely sequential, not two independent asks.
    pool: [
      pyramid(9, 6, 5, [
        { key: 'baseM', options: [6, 4, 9] },
        { key: 'midR', options: [11, 9, 14] },
      ]),
      pyramid(11, 4, 7, [
        { key: 'baseM', options: [4, 2, 7] },
        { key: 'midR', options: [11, 9, 14] },
      ]),
      pyramid(8, 5, 9, [
        { key: 'baseM', options: [5, 3, 8] },
        { key: 'midR', options: [14, 12, 17] },
      ]),
      pyramid(10, 7, 3, [
        { key: 'baseM', options: [7, 5, 10] },
        { key: 'midR', options: [10, 8, 13] },
      ]),
      pyramid(12, 3, 8, [
        { key: 'baseM', options: [3, 1, 6] },
        { key: 'midR', options: [11, 9, 14] },
      ]),
      pyramid(9, 8, 4, [
        { key: 'baseM', options: [8, 6, 11] },
        { key: 'midR', options: [12, 10, 15] },
      ]),
      pyramid(11, 6, 7, [
        { key: 'baseM', options: [6, 4, 9] },
        { key: 'midR', options: [13, 11, 16] },
      ]),
    ],
  },
]

// Uniform 2 rounds per level, same trim applied across the other days'
// exercises this pass.
const ROUNDS_PER_LEVEL = [2, 2, 2]
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

const HINTS = [
  'Ese no es — fijate qué falta para llegar al número de arriba.',
  'Casi. Revisá los números que ya tenés en la pirámide.',
  'No es ese. Probá con otro.',
]
const LEVEL_PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué bien calculás!']
const LEVEL_PRAISE_OK = ['¡Buen intento! Con cada ronda se entiende mejor.', '¡Bien ahí! Seguí practicando.']

const CELL_POSITIONS: { key: CellKey; row: 0 | 1 | 2 }[] = [
  { key: 'top', row: 0 },
  { key: 'midL', row: 1 },
  { key: 'midR', row: 1 },
  { key: 'baseL', row: 2 },
  { key: 'baseM', row: 2 },
  { key: 'baseR', row: 2 },
]

export function LaPiramide({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // `ROUNDS_PER_LEVEL[i]` puzzles drawn at random from level i's own pool,
  // for EVERY level at once — decided once per epoch (a full 1→2→3 pass), at
  // mount and again on "Hacer otro", never re-rolled by revisiting a level,
  // so "Repetir" hands back the exact same puzzles deterministically.
  const [epochPuzzles, setEpochPuzzles] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const order = epochPuzzles[levelIdx]

  const [roundIdx, setRoundIdx] = useState(0)
  const puzzle = order[roundIdx]
  const done = roundIdx >= roundsForLevel

  // Which blank (index into puzzle.blanks) is currently interactive, which
  // cells have their true value revealed, and the eliminated-wrong-option
  // set for the ACTIVE blank only (cleared when the active blank changes).
  const [activeBlankIdx, setActiveBlankIdx] = useState(0)
  const [revealed, setRevealed] = useState<Set<CellKey>>(new Set())
  const [eliminated, setEliminated] = useState<Set<number>>(new Set())
  const [resolving, setResolving] = useState(false) // true during the pause after a correct tap
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  const [correctCount, setCorrectCount] = useState(0)
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see restartEpoch below).
  const [mistakes, setMistakes] = useState(0)

  const activeBlank = puzzle?.blanks[activeBlankIdx]
  // La fila del blanco activo decide qué explicación mostrar: un blanco de la
  // fila de ABAJO se resuelve al revés que uno de arriba o del medio (sus
  // "hijos" no están los dos visibles — hay que restar desde el de arriba),
  // y eso es justamente lo que confundía sin esta aclaración dinámica.
  const activeBlankRow = activeBlank ? CELL_POSITIONS.find((c) => c.key === activeBlank.key)?.row : undefined
  const activeOptions = useMemo(
    () => (activeBlank ? shuffle(activeBlank.options) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzle, activeBlankIdx],
  )

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctCount / roundsForLevel >= 0.6 ? LEVEL_PRAISE_GOOD : LEVEL_PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function guess(value: number) {
    if (!puzzle || !activeBlank || resolving || eliminated.has(value)) return
    if (value === puzzle.values[activeBlank.key]) {
      setResolving(true)
      setHint(null)
      setRevealed((prev) => new Set(prev).add(activeBlank.key))
      const isLastBlank = activeBlankIdx + 1 >= puzzle.blanks.length
      window.setTimeout(
        () => {
          if (isLastBlank) {
            setCorrectCount((c) => c + 1)
            setRoundIdx((i) => i + 1)
            setActiveBlankIdx(0)
            setRevealed(new Set())
          } else {
            setActiveBlankIdx((i) => i + 1)
          }
          setEliminated(new Set())
          setResolving(false)
        },
        isLastBlank ? 1000 : 650,
      )
    } else {
      setEliminated((prev) => (prev.has(value) ? prev : new Set(prev).add(value)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level/round change — see
  // ElVuelto.tsx for why an effect-based reset would lag a render behind.

  // "Siguiente nivel" — advance within the SAME epoch. Only ever called
  // while levelIdx < LEVELS.length - 1; epochPuzzles is left alone — level
  // i+1's puzzles were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setActiveBlankIdx(0)
    setRevealed(new Set())
    setEliminated(new Set())
    setResolving(false)
    setHint(null)
    setCorrectCount(0)
  }

  // Shared by both restart buttons on the FINAL level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — zero
  // the mistake accumulator either way). roundKey always bumps here: it's
  // the "which attempt is this" generation counter the onComplete effect
  // uses to fire again on a replay, independent of whether the puzzles
  // themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setActiveBlankIdx(0)
    setRevealed(new Set())
    setEliminated(new Set())
    setResolving(false)
    setHint(null)
    setCorrectCount(0)
    setMistakes(0)
  }
  // "Repetir" — same puzzles as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random set of puzzles per level, same as before
  // this feature existed (the only option there used to be).
  function restartDifferent() {
    restartEpoch()
    setEpochPuzzles(LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])))
  }

  // Fires once per roundKey when level 3's last puzzle resolves.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  function cellState(key: CellKey): 'given' | 'revealed' | 'active' | 'locked' {
    if (!puzzle) return 'given'
    const blankIdx = puzzle.blanks.findIndex((b) => b.key === key)
    if (blankIdx === -1) return 'given'
    if (revealed.has(key)) return 'revealed'
    return blankIdx === activeBlankIdx ? 'active' : 'locked'
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base font-medium text-slate-500">
              Cada número es la suma de los dos que tiene abajo.
            </p>
            {activeBlankRow === 2 ? (
              <p className="mt-1 text-base font-semibold text-tiam-blue">
                Para este: al número de arriba, restale el que ya ves al lado.
              </p>
            ) : (
              <p className="mt-1 text-base font-semibold text-tiam-blue">
                Para este: sumá los dos números que tiene abajo.
              </p>
            )}
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && puzzle && (
        <>
          {/* Pyramid */}
          <div className="mt-6 flex flex-col items-center gap-2.5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-2.5">
                {CELL_POSITIONS.filter((c) => c.row === row).map(({ key }) => {
                  const state = cellState(key)
                  const value = puzzle.values[key]
                  return (
                    <div
                      key={key}
                      className={[
                        'flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-xl font-extrabold sm:h-16 sm:w-16 sm:text-2xl',
                        state === 'given' || state === 'revealed'
                          ? 'border-slate-200 bg-white text-slate-800'
                          : state === 'active'
                            ? 'border-dashed border-tiam-blue bg-tiam-blue/5 text-tiam-blue'
                            : 'border-slate-100 bg-slate-50 text-slate-300',
                      ].join(' ')}
                    >
                      {state === 'given' || state === 'revealed' ? value : '?'}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Options for the active blank — labeled so the three boxes don't
              read as another row of the pyramid. */}
          {activeBlank && (
            <>
              <p className="mt-6 text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
                Elegí el número que falta
              </p>
              <div className="mx-auto mt-2 grid max-w-xs grid-cols-3 gap-2.5">
                {activeOptions.map((opt) => {
                  const isEliminated = eliminated.has(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isEliminated || resolving}
                      onClick={() => guess(opt)}
                      className={[
                        'min-h-[56px] rounded-2xl border-2 text-xl font-extrabold transition',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                        isEliminated
                          ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                          : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {hint && !resolving && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
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
            Completaste las {roundsForLevel} pirámides — terminaste el nivel {levelIdx + 1}.
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Hacer otro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
