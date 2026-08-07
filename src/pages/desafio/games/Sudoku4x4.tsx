import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Sudoku 4×4" — día 26 (mes 2), ejecutivas. Classic mini-sudoku: numbers
 * 1-4, no repeats per row, column or 2×2 box. Tap a blank cell, then tap a
 * number to fill it; the grid checks itself automatically the instant every
 * blank is filled — no manual "Revisar" tap to discover (same anti-confusion
 * fix as ArmaLasPalabras.tsx, día 1). A checkedRef keys off the exact
 * attempt (every filled value, in cell order) so changing one wrong cell and
 * refilling it re-triggers the check, while a React 18 double-invoke of the
 * same attempt can't double-count a mistake.
 *
 * Per the brief, this does NOT implement a sudoku solver/validator — it
 * pre-generates a small pool of already-SOLVED 4×4 grids and blanks a few
 * cells per difficulty level, then just compares the filled grid against
 * that one known solution (never a general row/col/box validity check).
 * The 4 base grids are hand-derived from a single solved grid via digit
 * relabeling and a band swap — both transformations that provably preserve
 * sudoku validity (relabeling is a bijection on {1,2,3,4}; swapping the two
 * rows within a band, or the two bands, only reorders values that were
 * already each row/column/box's full set) — so there's no runtime solver
 * and no risk of shipping a broken grid.
 *
 * Difficulty ramps by BLANK COUNT only (4 → 6 → 8), never by changing the
 * grids or the mechanic — same "same content, harder ask" ramp this
 * codebase already uses elsewhere (CadaCosaEnSuGrupo's finer L3 categories).
 * L1's 4 blanks are a "transversal" (one per row, column AND box), which
 * makes each one trivially derivable from its own row/column/box alone —
 * genuinely a warm-up. L3's 8 blanks follow a checkerboard pattern (exactly
 * 2 knowns + 2 unknowns in every row/column/box), which stays solvable by
 * simple elimination without ever requiring guesswork.
 *
 * A wrong check never clears anything (same warm contract as DosPistas:
 * "un error no barre todo lo puesto") — it only highlights which cells
 * don't match yet (muted slate, never red), so the player can fix just
 * those and check again. mistakes counts per failed check attempt (not per
 * wrong cell), same accounting DosPistas uses for its own place-then-check
 * mechanic.
 */

type Grid = number[][] // 4x4, values 1-4
type Coord = [number, number]

// One hand-verified solved grid, plus three more derived from it via
// validity-preserving transforms (digit relabeling / band swap) — see the
// header comment above.
const GRIDS: Grid[] = [
  [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
  [
    [2, 3, 4, 1],
    [4, 1, 2, 3],
    [3, 2, 1, 4],
    [1, 4, 3, 2],
  ],
  [
    [4, 3, 2, 1],
    [2, 1, 4, 3],
    [3, 4, 1, 2],
    [1, 2, 3, 4],
  ],
  [
    [2, 1, 4, 3],
    [4, 3, 2, 1],
    [1, 2, 3, 4],
    [3, 4, 1, 2],
  ],
]

// One blank per row, column AND 2×2 box — each is derivable on its own.
const L1_BLANKS: Coord[] = [
  [0, 1],
  [1, 3],
  [2, 0],
  [3, 2],
]
const L2_BLANKS: Coord[] = [
  [0, 1],
  [0, 3],
  [1, 0],
  [2, 2],
  [3, 1],
  [3, 3],
]
// Checkerboard — exactly 2 knowns + 2 unknowns in every row, column and box.
const L3_BLANKS: Coord[] = [
  [0, 0],
  [0, 2],
  [1, 1],
  [1, 3],
  [2, 0],
  [2, 2],
  [3, 1],
  [3, 3],
]

interface Level {
  n: number
  name: string
  blanks: Coord[]
  rounds: number
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', blanks: L1_BLANKS, rounds: 2 },
  { n: 2, name: 'Nivel 2', blanks: L2_BLANKS, rounds: 2 },
  { n: 3, name: 'Nivel 3', blanks: L3_BLANKS, rounds: 2 },
]
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

function key(r: number, c: number): string {
  return `${r}-${c}`
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

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se razona!', '¡Perfecto!', '¡Qué buena lógica!']

export function Sudoku4x4({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which 2 grids (of the shared 4-grid pool) are playing for level i THIS
  // "epoch" (a full 3-level pass). Decided once per epoch — at mount, and
  // again on "Hacer otro" — never re-rolled just because the player
  // re-visits a level, so "Repetir" can hand back the exact same grids
  // deterministically instead of re-randomizing.
  const [epochRoundGrids] = useState(() =>
    LEVELS.map((lvl) => shuffle(GRIDS).slice(0, lvl.rounds)),
  )
  const level = LEVELS[levelIdx]
  const roundGrids = epochRoundGrids[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const solution = roundGrids[roundIdx]
  const blankSet = useMemo(() => new Set(level.blanks.map(([r, c]) => key(r, c))), [level.blanks])

  // Only the USER's entries for blank cells — clue cells are read straight
  // from `solution` at render time, so resetting this to `{}` on a
  // round/level change never needs to know the next solution in advance
  // (the content itself is derived via useMemo above, same as
  // CaminoNumerico's `board`; only this progress map resets synchronously).
  const [userEntries, setUserEntries] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Coord | null>(null)
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (wrap)
  // — mistakes counted per FAILED check attempt, same accounting DosPistas
  // uses for its own place-then-check mechanic (totalAttempts = mistakes +
  // TOTAL_ROUNDS, since every round is eventually solved).
  const [mistakes, setMistakes] = useState(0)

  const allFilled = level.blanks.every(([r, c]) => userEntries[key(r, c)] != null)
  const done = solved && roundIdx >= level.rounds - 1

  useEffect(() => {
    if (solved) setPraise(pickOne(PRAISE))
  }, [solved])

  function displayValue(r: number, c: number): number | null {
    if (!blankSet.has(key(r, c))) return solution[r][c]
    return userEntries[key(r, c)] ?? null
  }

  function tapCell(r: number, c: number) {
    if (solved || !blankSet.has(key(r, c))) return
    setSelected([r, c])
  }
  function tapNumber(num: number) {
    if (solved || !selected) return
    const [r, c] = selected
    setUserEntries((prev) => ({ ...prev, [key(r, c)]: num }))
    setWrongCells(new Set()) // fresh guess — the last check no longer applies
    setSelected(null)
  }

  // Auto-revisa apenas se llenan todas las celdas — sin botón "Revisar" que
  // el jugador deba descubrir (mismo criterio anti-confusión de
  // ArmaLasPalabras.tsx, día 1). checkedRef guarda qué combinación exacta de
  // números ya se revisó, para que cambiar una celda y volver a completarla
  // dispare una revisión nueva, y para que un doble-invoke de React 18 no
  // cuente el mismo intento dos veces.
  const checkedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!allFilled) {
      checkedRef.current = null
      return
    }
    const attemptKey = level.blanks.map(([r, c]) => userEntries[key(r, c)]).join(',')
    if (checkedRef.current === attemptKey) return
    checkedRef.current = attemptKey

    const wrong = level.blanks.filter(([r, c]) => userEntries[key(r, c)] !== solution[r][c])
    if (wrong.length === 0) {
      setSolved(true)
      setWrongCells(new Set())
    } else {
      setWrongCells(new Set(wrong.map(([r, c]) => key(r, c))))
      setMistakes((m) => m + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilled, userEntries, level.blanks, solution])

  // Intra-level round advance (2 grids per level, drawn from the shared pool
  // at epoch-start) — a different, existing mid-level mechanic from the
  // whole-epoch restart below, so it's left untouched.
  function nextRound() {
    setSolved(false)
    setUserEntries({})
    setSelected(null)
    setWrongCells(new Set())
    setRoundIdx((i) => i + 1)
  }
  // Resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundKey — never in a separate effect keyed on them (the
  // stale-flag hazard fixed across this codebase's other games).

  // "Siguiente nivel" — advance within the SAME epoch. epochRoundGrids is
  // left alone: level i+1's drawn grids were already decided when this
  // epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setSolved(false)
    setUserEntries({})
    setSelected(null)
    setWrongCells(new Set())
  }

  // Shared by both restart buttons on the final level's complete card.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setSolved(false)
    setUserEntries({})
    setSelected(null)
    setWrongCells(new Set())
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same grids, same order, as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Completá la grilla</h2>
            <p className="mt-2 text-base text-slate-500">Sin repetir números en filas, columnas ni cuadrantes.</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {level.rounds}
            </p>
          </>
        )}
      </div>

      {!solved && (
        <>
          {/* Grilla 4x4 */}
          <div className="mx-auto mt-5 grid w-fit grid-cols-4 overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-300">
            {Array.from({ length: 4 }, (_, r) =>
              Array.from({ length: 4 }, (_, c) => {
                const isBlank = blankSet.has(key(r, c))
                const value = displayValue(r, c)
                const isSelected = selected?.[0] === r && selected?.[1] === c
                const isWrong = wrongCells.has(key(r, c))
                return (
                  <button
                    key={key(r, c)}
                    type="button"
                    disabled={!isBlank}
                    onClick={() => tapCell(r, c)}
                    className={[
                      'flex h-16 w-16 items-center justify-center text-2xl font-black transition sm:h-[72px] sm:w-[72px]',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-inset',
                      c === 1 ? 'border-r-[3px] border-r-slate-400' : c !== 3 ? 'border-r border-r-slate-200' : '',
                      r === 1 ? 'border-b-[3px] border-b-slate-400' : r !== 3 ? 'border-b border-b-slate-200' : '',
                      !isBlank ? 'bg-slate-50 text-slate-800' : '',
                      isBlank && isWrong ? 'bg-slate-100 text-slate-400' : '',
                      isBlank && !isWrong && isSelected ? 'bg-tiam-blue/10 text-slate-900 ring-2 ring-tiam-blue/40' : '',
                      isBlank && !isWrong && !isSelected ? 'bg-white text-slate-700 hover:bg-tiam-blue/5' : '',
                    ].join(' ')}
                  >
                    {value ?? ''}
                  </button>
                )
              }),
            )}
          </div>

          {/* Tarjeta "todavía no" — tan visible como la de acierto de más
              abajo. Nunca roja: naranja suave + ícono de reintentar. Las
              celdas en gris (arriba) marcan cuáles exactamente hay que
              cambiar; la tarjeta se queda hasta que el jugador las corrige y
              vuelve a llenar la grilla, sin timer. */}
          {wrongCells.size > 0 && (
            <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                <RotateCcw className="h-6 w-6 text-tiam-orange" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">Todavía no está</p>
              <p className="mt-1 text-slate-600">Los números marcados en gris no van ahí — tocalos para cambiarlos.</p>
            </div>
          )}

          {/* Teclado 1-4 */}
          <div className="mt-5 flex justify-center gap-2">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                disabled={!selected}
                onClick={() => tapNumber(num)}
                aria-label={`Número ${num}`}
                className={[
                  'flex h-14 w-14 items-center justify-center rounded-xl border-2 text-2xl font-extrabold transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  selected
                    ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                    : 'border-slate-100 bg-slate-50 text-slate-300',
                ].join(' ')}
              >
                {num}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-base text-slate-400">
            {selected ? 'Tocá el número que va en esa celda.' : 'Tocá primero una celda vacía.'}
          </p>
        </>
      )}

      {/* Ronda / nivel completo */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {done ? `¡Completaste la grilla — terminaste el ${level.name.toLowerCase()}!` : '¡Completaste la grilla de esta ronda!'}
          </p>
          {done ? (
            levelIdx < LEVELS.length - 1 ? (
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
              </div>
            )
          ) : (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente grilla
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
