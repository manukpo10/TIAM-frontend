import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MapPin, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Encaminada" — día 13, Mes 2, orientación. A directional-sequencing task in
 * the spirit of Trail Making Part A, reframed as spatial orientation: a small
 * letter grid has ONE marked starting cell; a row of arrow icons gives an
 * ordered sequence of moves (up/down/left/right). The player's job is to
 * compute, step by step, which cell the arrows land on — the letters visited
 * along that path spell a short word — then tap that word among 3-4 options.
 *
 * Deliberately NOT free-text or tap-the-path validation: per the brief this
 * is genuinely harder to grade reliably (an accidental extra tap, or the
 * player tracing a plausible-but-wrong path, would need fuzzy matching).
 * Multiple choice is a hard, unambiguous check — same reasoning DondeEsta and
 * CadaCosaEnSuGrupo already use for their own puzzles.
 *
 * ONLY the start cell is ever visually marked. Every other cell — including
 * the ones the correct path actually lands on — is styled identically to a
 * random filler cell; marking path cells would hand over the answer and
 * remove the entire exercise. Grid + arrows are shown in full upfront, no
 * timer, no hidden reveal (house style).
 *
 * Letters, not syllables: a single alphabet keeps grid-authoring arithmetic
 * (one path, one grid, no variable-width cells) identical across all three
 * levels, and Spanish syllable boundaries (diphthongs, etc.) would add
 * ambiguity with no real gain for a 3-5 step path. Puzzle data (paths,
 * bounds, no self-intersection) was verified with a throwaway Node script
 * before writing this component — same discipline DondeEsta/LaPiramide used
 * for their own hand-authored pools.
 *
 * Difficulty ramps by grid size AND path length together: Nivel 1 is a 3×3
 * grid with a 2-arrow/3-letter word and 3 options; Nivel 2 is 4×4 with 3
 * arrows/4 letters; Nivel 3 is 5×5 with 4 arrows/5 letters and 4 options
 * (one extra decoy, same "more options = harder" lever DondeEsta uses).
 *
 * Wrong guesses eliminate that option (greyed out, never removed-forever-
 * red) and show a rotating muted hint — the same "eliminate wrong, keep
 * trying" pattern as DondeEsta/CadaCosaEnSuGrupo. No timer, ever.
 */

type Dir = 'up' | 'down' | 'left' | 'right'
interface Cell {
  row: number
  col: number
}
interface PathWord {
  word: string
  /** path[0] is the marked start cell; path.length === word.length. Each
   * consecutive pair is a single orthogonal step (verified by script). */
  path: Cell[]
}
interface Level {
  n: number
  name: string
  rows: number
  cols: number
  numOptions: number
  pool: PathWord[]
}

// App-wide default rounds-per-level ([2, 3, 3], see DondeEsta's own comment
// on this convention) — no reason to deviate here.
const ROUNDS_PER_LEVEL = [2, 3, 3]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rows: 3,
    cols: 3,
    numOptions: 3,
    pool: [
      { word: 'SOL', path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }] },
      { word: 'PAN', path: [{ row: 2, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
      { word: 'MAR', path: [{ row: 0, col: 2 }, { row: 1, col: 2 }, { row: 1, col: 1 }] },
      { word: 'OJO', path: [{ row: 2, col: 2 }, { row: 2, col: 1 }, { row: 1, col: 1 }] },
      { word: 'PIE', path: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rows: 4,
    cols: 4,
    numOptions: 3,
    pool: [
      { word: 'CASA', path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 }] },
      { word: 'MESA', path: [{ row: 3, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 1, col: 1 }] },
      { word: 'PATO', path: [{ row: 0, col: 3 }, { row: 1, col: 3 }, { row: 1, col: 2 }, { row: 2, col: 2 }] },
      { word: 'GATO', path: [{ row: 3, col: 3 }, { row: 3, col: 2 }, { row: 2, col: 2 }, { row: 2, col: 1 }] },
      { word: 'LUNA', path: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }] },
      { word: 'ROSA', path: [{ row: 0, col: 2 }, { row: 0, col: 1 }, { row: 0, col: 0 }, { row: 1, col: 0 }] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rows: 5,
    cols: 5,
    numOptions: 4,
    pool: [
      { word: 'ARBOL', path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 2 }] },
      { word: 'PERRO', path: [{ row: 4, col: 0 }, { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 2 }] },
      { word: 'CIELO', path: [{ row: 0, col: 4 }, { row: 1, col: 4 }, { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 2, col: 4 }] },
      { word: 'NOCHE', path: [{ row: 4, col: 4 }, { row: 4, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 2, col: 4 }] },
      { word: 'VERDE', path: [{ row: 0, col: 2 }, { row: 0, col: 3 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 0, col: 4 }] },
      { word: 'PLATO', path: [{ row: 4, col: 2 }, { row: 4, col: 1 }, { row: 3, col: 1 }, { row: 3, col: 0 }, { row: 2, col: 0 }] },
      { word: 'CAMPO', path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 0 }] },
      { word: 'NIETO', path: [{ row: 4, col: 0 }, { row: 4, col: 1 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 4, col: 2 }] },
    ],
  },
]

const DIR_ICON: Record<Dir, typeof ArrowUp> = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }

function directionBetween(a: Cell, b: Cell): Dir {
  if (b.row === a.row - 1) return 'up'
  if (b.row === a.row + 1) return 'down'
  if (b.col === a.col - 1) return 'left'
  return 'right'
}

// Plain-frequency Spanish-friendly filler pool (skips rare Ñ/K/W/X — fillers
// carry no meaning, this just keeps the board looking like ordinary text).
const FILLER_LETTERS = 'ABCDEFGHIJLMNOPRSTUV'.split('')

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

function buildBoard(entry: PathWord, rows: number, cols: number): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => FILLER_LETTERS[Math.floor(Math.random() * FILLER_LETTERS.length)]),
  )
  entry.path.forEach((cell, i) => {
    grid[cell.row][cell.col] = entry.word[i]
  })
  return grid
}
function buildOptions(pool: PathWord[], current: PathWord, numOptions: number): string[] {
  const decoyPool = pool.filter((p) => p.word !== current.word).map((p) => p.word)
  const decoys = shuffle(decoyPool).slice(0, numOptions - 1)
  return shuffle([current.word, ...decoys])
}

const HINTS = [
  'Esa palabra no es — repasá el camino desde el inicio.',
  'Fijate bien: seguí cada flecha, una por una, desde la celda marcada.',
  'Casi. Volvé a contar los pasos desde la celda de inicio.',
]
const LEVEL_PRAISE_GOOD = ['¡Muy bien!', '¡Excelente orientación!', '¡Así se hace!', '¡Qué buen recorrido!']
const LEVEL_PRAISE_OK = ['¡Buen intento! Con la práctica el camino se hace más fácil.', '¡Bien ahí! Seguí practicando.']

export function Encaminada({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // `ROUNDS_PER_LEVEL[i]` path-words drawn at random from level i's own pool,
  // for EVERY level at once — decided once per epoch (a full 1→2→3 pass), at
  // mount and again on "Hacer otro", never re-rolled by revisiting a level,
  // so "Repetir" hands back the exact same paths deterministically.
  const [epochOrder, setEpochOrder] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= roundsForLevel
  const current = order[roundIdx] as PathWord | undefined

  const board = useMemo(
    () => (current ? buildBoard(current, level.rows, level.cols) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current],
  )
  const dirs = useMemo(
    () => (current ? current.path.slice(1).map((cell, i) => directionBetween(current.path[i], cell)) : []),
    [current],
  )
  const options = useMemo(
    () => (current ? buildOptions(level.pool, current, level.numOptions) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current],
  )

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3, only zeroed on a genuine day restart
  // (wrap from level 3 back to level 1) — same policy as every other
  // multi-level game in this folder.
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

  function guess(word: string) {
    if (!current || solved || eliminated.has(word)) return
    if (word === current.word) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      advance()
    } else {
      setEliminated((prev) => (prev.has(word) ? prev : new Set(prev).add(word)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Synchronous resets happen HERE, in the same handler that changes
  // levelIdx/roundKey — not in a separate effect keyed on them, which would
  // let the onComplete effect below read a stale `done` on the render that
  // just arrived at the new level (the bug already fixed in CaminoNumerico/
  // CazadorDeLetras/ClaveDeSimbolos).

  // "Siguiente nivel" — advance within the SAME epoch. Only ever called
  // while levelIdx < LEVELS.length - 1; epochOrder is left alone — level
  // i+1's paths were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
  }

  // Shared by both restart buttons on the FINAL level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — zero
  // the mistake accumulator either way). roundKey always bumps here: it's
  // the "which attempt is this" generation counter the onComplete effect
  // uses to fire again on a replay, independent of whether the paths
  // themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
    setMistakes(0)
  }
  // "Repetir" — same paths as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random set of paths per level, same as before
  // this feature existed (the only option there used to be).
  function restartDifferent() {
    restartEpoch()
    setEpochOrder(LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])))
  }

  // Fires once per roundKey when level 3 is completed. A full day restart
  // (via restartEpoch, from either restart button) gets a new roundKey, so a
  // genuine replay of the whole day reports again; re-rendering while still
  // done on level 3 does not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
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
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {levelName}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base font-medium text-slate-500">
              Seguí las flechas desde la celda marcada y elegí la palabra que se forma.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Ronda {roundIdx + 1} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && current && (
        <>
          {/* Grid — only the start cell is ever marked; every other cell,
              including the ones the real path lands on, looks identical to a
              filler cell (see file header). */}
          <div
            className="mx-auto mt-5 grid aspect-square w-full max-w-[320px] gap-1.5 sm:max-w-[360px] sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
          >
            {board.map((rowArr, r) =>
              rowArr.map((letter, c) => {
                const isStart = current.path[0].row === r && current.path[0].col === c
                return (
                  <div
                    key={`${r}-${c}`}
                    className={[
                      'relative flex items-center justify-center rounded-lg border-2 text-xl font-extrabold',
                      isStart
                        ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                        : 'border-slate-200 bg-white text-slate-700',
                    ].join(' ')}
                  >
                    {letter}
                    {isStart && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-blue text-white shadow">
                        <MapPin className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                )
              }),
            )}
          </div>

          {/* Arrow sequence */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {dirs.map((d, i) => {
              const Icon = DIR_ICON[d]
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Options */}
          <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5">
            {options.map((word) => {
              const isEliminated = eliminated.has(word)
              const showAsCorrect = solved && word === current.word
              return (
                <button
                  key={word}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(word)}
                  className={[
                    'min-h-[52px] rounded-2xl border-2 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    showAsCorrect
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-700 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {word}
                </button>
              )
            })}
          </div>
        </>
      )}

      {hint && !solved && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste el camino en las {roundsForLevel} rondas — completaste el {levelName.toLowerCase()}.
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
