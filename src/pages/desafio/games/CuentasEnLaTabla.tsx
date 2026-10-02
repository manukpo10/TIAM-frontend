import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cuentas en la tabla" — día 28, mes 5, cálculo. A small table: every row starts
 * with a number and has four columns — "+100", "−50", "La mitad" and "El doble".
 * The cell in focus is highlighted (left to right, row by row), the line above
 * the table says the calculation in words ("Restale 50 a 480") and four numbers
 * below are the options; the right one fills the cell and the highlight moves on.
 * Same idea as month 4's Cálculo mental, with another look: a table you fill in,
 * the way a notebook or a price list is laid out, and four operations on the same
 * number instead of a single one.
 *
 * The options are near misses, never a row of random numbers: each column has a
 * pool of six wrong results people really reach — three under the right one and
 * three over it (the tens digit moved instead of the hundreds: 480 + 10; the
 * wrong direction, 480 + 50 for a subtraction, or 5 taken away instead of 50; a
 * step too big or too small: ±10, ±20, ±50, ±100) — and every cell takes three
 * neighbours in a row out of that pool. Where the run starts depends on the number and the column, so the
 * right answer is sometimes the smallest of the four, sometimes the largest and
 * most times in between: no rank gives it away. Their positions on screen are
 * shuffled ONCE at mount.
 *
 * "La mitad" is always exact: every number in the table is even. Ramp: round
 * numbers (200, 480…) → three-digit numbers with units (274, 436…) → four-digit
 * numbers (1.240, 3.680…), written with the Argentine thousands dot. After a miss
 * the line under the options says how to think that operation; a wrong option
 * greys out (muted, never red) and costs one mistake. No timer, except the short
 * pause after the very last cell so the table can be seen finished.
 *
 * ONE table per level: each level has two authored tables (two rows each) and one is
 * picked ONCE at mount (`epoch`, together with the order of every cell's options),
 * so "Repetir" replays exactly the same three. Per-level state lives in <LevelView>,
 * keyed by run + level. A throwaway Node script (not committed) recomputes every
 * cell, checks that the four options are distinct, positive and near the right
 * result, that every half is exact and every result in a row is different.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by
 * the click's own timeStamp) is ignored, so the second tap of a double tap on "Siguiente
 * nivel" or "Repetir" never answers the first cell (the options sit right where that
 * button was); the same window follows every accepted answer, because the options change
 * under the finger, and after the very last cell every option is off until the card
 * appears. The solved card is scrolled into view, and so is its button, on a short phone;
 * a new level opens at its top.
 *
 * totalAttempts = mistakes + every cell of the day (TOTAL_CELLS, derived).
 */

// ── data:start ──
type ColId = 'mas100' | 'menos50' | 'mitad' | 'doble'

interface Column {
  id: ColId
  /** Column header. */
  head: string
  /** The calculation in words, with the number already written. */
  ask: (n: string) => string
  /** How to think that operation: said after a miss. */
  tip: string
  /** The result for a number. */
  of: (n: number) => number
  /** Six wrong results people reach, in ascending order: three under the answer, three over it. */
  near: (n: number, answer: number) => number[]
}

/** A "big" slip: a hundred for big answers, fifty for small ones. */
const bigStep = (answer: number) => (answer >= 400 ? 100 : 50)

const COLUMNS: Column[] = [
  {
    id: 'mas100',
    head: '+100',
    ask: (n) => `Sumale 100 a ${n}`,
    tip: 'Sumar 100 cambia la cifra de las centenas.',
    of: (n) => n + 100,
    near: (n, a) => [n, n + 10, a - 10, a + 10, a + 20, a + 100],
  },
  {
    id: 'menos50',
    head: '−50',
    ask: (n) => `Restale 50 a ${n}`,
    tip: 'Restar 50 es restar 5 decenas: fijate en la cifra de las decenas.',
    of: (n) => n - 50,
    near: (n) => [n - 100, n - 70, n - 60, n - 40, n - 5, n + 50],
  },
  {
    id: 'mitad',
    head: 'La mitad',
    ask: (n) => `La mitad de ${n}`,
    tip: 'La mitad es repartir en dos partes iguales.',
    of: (n) => n / 2,
    near: (_n, a) => [a - bigStep(a), a - 20, a - 10, a + 10, a + 20, a + bigStep(a)],
  },
  {
    id: 'doble',
    head: 'El doble',
    ask: (n) => `El doble de ${n}`,
    tip: 'El doble es sumar el número consigo mismo.',
    of: (n) => n * 2,
    near: (_n, a) => [a - bigStep(a), a - 20, a - 10, a + 10, a + 20, a + bigStep(a)],
  },
]

interface LevelDef {
  name: string
  /** Two authored tables; one is picked at mount. Each number is the start of a row. */
  tables: number[][]
}

// Every table of a level has two rows, so TOTAL_CELLS never depends on which one is
// drawn. All the numbers are even (the half is exact).
const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', tables: [[200, 480], [240, 360]] },
  { name: 'Nivel 2', tables: [[274, 436], [318, 452]] },
  { name: 'Nivel 3', tables: [[1240, 3680], [1560, 2840]] },
]

const TOTAL_CELLS = LEVELS.reduce((sum, lvl) => sum + lvl.tables[0].length * COLUMNS.length, 0)

/** Argentine thousands dot: 1240 → "1.240", 743 → "743". */
function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** The four options of a cell, unsorted: the right result and three near misses. */
function optionsFor(n: number, col: Column, colIdx: number): number[] {
  const answer = col.of(n)
  const pool = col
    .near(n, answer)
    .filter((c, i, all) => Number.isInteger(c) && c > 0 && c !== answer && all.indexOf(c) === i)
  // Three neighbours in a row out of the six: the number and the column decide where the
  // run starts, so now all three are under the answer, now all over it, now mixed.
  const start = (Math.floor(n / 10) + colIdx) % pool.length
  return [answer, ...[0, 1, 2].map((k) => pool[(start + k) % pool.length])]
}
// ── data:end ──

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

interface CellPlan {
  answer: number
  /** The four options in their (frozen) display order. */
  options: number[]
}
interface RowPlan {
  base: number
  cells: CellPlan[]
}
interface LevelContent {
  rows: RowPlan[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({
    rows: pickOne(lvl.tables).map((base) => ({
      base,
      cells: COLUMNS.map((col, ci) => ({ answer: col.of(base), options: shuffle(optionsFor(base, col, ci)) })),
    })),
  }))
}

/** A tap this soon after the tap that brought the screen here ("Siguiente nivel", "Repetir"), or after an
 * accepted answer, is the second tap of a double tap: the options sit right where that button was (or are
 * about to be replaced by the next cell's) and it must not be judged against them. Long enough to swallow
 * a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400
/** The pause after the very last cell, so the finished table can be seen. */
const CLOSE_MS = 900

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!', '¡Buen cálculo!']
const HINTS = ['Casi. Hacé la cuenta de nuevo, con calma.', 'Todavía no. Fijate bien en las cifras.', 'No es ese. Probá con otro.']

// Full class strings, never interpolated: Tailwind only emits classes it can read
// literally in the source. Four-digit levels use smaller figures so "7.360" fits a
// cell on a 320px phone.
const CELL_TEXT = ['text-xl', 'text-xl', 'text-base']
const BASE_TEXT = ['text-xl', 'text-xl', 'text-lg']

interface LevelViewProps {
  levelIdx: number
  content: LevelContent
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, content, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { rows } = content
  const total = rows.length * COLUMNS.length

  // How many cells are filled: the cell in focus is `filled`, row by row, left to right.
  const [filled, setFilled] = useState(0)
  const [wrongOptions, setWrongOptions] = useState<number[]>([])
  const [closing, setClosing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Options already tapped for this cell: a second tap is ONE tap, even when both land
  // before React has repainted it as disabled.
  const tappedRef = useRef<Set<number>>(new Set())
  // When the last answer was accepted (the click's own timeStamp): the options have already
  // changed to the next cell's, so a double tap on that spot must not be judged against them.
  const acceptedAtRef = useRef(Number.NEGATIVE_INFINITY)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(closeTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  // The cell in focus (once the last one is filled it stays the last one, with its options greyed out).
  const focus = Math.min(filled, total - 1)
  const rowIdx = Math.floor(focus / COLUMNS.length)
  const colIdx = focus % COLUMNS.length
  const showingCell = !done && !closing
  const row = rows[rowIdx]
  const col = COLUMNS[colIdx]
  const cell = row.cells[colIdx]

  function handlePick(value: number, at: number) {
    if (!showingCell || tappedRef.current.has(value)) return
    // The second tap of a double tap on the button that brought the level, or on the answer that was just accepted.
    if (at - since < SETTLE_MS || at - acceptedAtRef.current < SETTLE_MS) return
    tappedRef.current.add(value)
    if (value === cell.answer) {
      acceptedAtRef.current = at
      tappedRef.current = new Set()
      setWrongOptions([])
      setFilled(filled + 1)
      if (filled + 1 >= total) {
        setHint({ text: '¡Eso es! La tabla quedó completa.', ok: true })
        setClosing(true)
        closeTimerRef.current = window.setTimeout(() => {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }, CLOSE_MS)
      } else {
        setHint(null)
      }
    } else {
      setWrongOptions((w) => [...w, value])
      // The first miss of a cell says how to think that operation; the next ones just encourage.
      setHint({ text: wrongOptions.length === 0 ? col.tip : HINTS[(wrongOptions.length - 1) % HINTS.length], ok: false })
      onMistake()
    }
  }

  const textSize = CELL_TEXT[levelIdx]
  const baseSize = BASE_TEXT[levelIdx]

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {showingCell && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Cuenta {filled + 1} de {total}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              {col.ask(formatNumber(row.base))}
            </h2>
          </>
        )}
      </div>

      {/* The table */}
      <div className="mt-3 max-[350px]:-mx-3">
        <table className="mx-auto w-full max-w-sm table-fixed border-separate border-spacing-[3px]">
          <caption className="sr-only">Tabla de cuentas: cada fila parte de un número</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] rounded-lg bg-slate-100 px-0.5 py-1">
                <span className="sr-only">Número</span>
              </th>
              {COLUMNS.map((c, ci) => (
                <th
                  key={c.id}
                  scope="col"
                  className={[
                    'rounded-lg px-0.5 py-1 text-sm font-bold leading-tight',
                    showingCell && ci === colIdx ? 'bg-tiam-blue/10 text-tiam-blue-dark' : 'bg-cyan-600/10 text-cyan-800',
                  ].join(' ')}
                >
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <th
                  scope="row"
                  className={`h-12 rounded-lg bg-slate-100 px-0.5 font-bold tabular-nums text-slate-900 ${baseSize}`}
                >
                  {formatNumber(r.base)}
                </th>
                {r.cells.map((c, ci) => {
                  const index = ri * COLUMNS.length + ci
                  const isDone = index < filled
                  const isCurrent = showingCell && index === filled
                  return (
                    <td
                      key={ci}
                      aria-label={isCurrent ? `Casilla a completar: ${COLUMNS[ci].ask(formatNumber(r.base)).toLowerCase()}` : undefined}
                      className={[
                        'h-12 rounded-lg border-2 text-center font-bold tabular-nums tracking-tight transition',
                        textSize,
                        isDone
                          ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                          : isCurrent
                            ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue-dark ring-2 ring-tiam-blue/30'
                            : 'border-slate-200 bg-white text-slate-400',
                      ].join(' ')}
                    >
                      {isDone ? formatNumber(c.answer) : isCurrent ? '?' : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Options for the cell in focus */}
      {!done && (
        <>
          <div className="mx-auto mt-3 grid max-w-sm grid-cols-2 gap-3" role="group" aria-label="Opciones">
            {cell.options.map((value) => {
              const isWrong = showingCell && wrongOptions.includes(value)
              const isRightShown = closing && value === cell.answer
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isWrong || closing}
                  onClick={(e) => handlePick(value, e.timeStamp)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 text-2xl font-bold tabular-nums transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRightShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : closing
                        ? 'border-slate-200 bg-slate-50 text-slate-300'
                        : isWrong
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                          : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {formatNumber(value)}
                  {isRightShown && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-3 min-h-[3rem] text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Resolviste las {total} cuentas de la tabla. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CuentasEnLaTabla({ onComplete }: GameProps) {
  // Which table each level plays, and the order of every cell's options — decided
  // once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_CELLS })
  }
  function handleNext(at: number) {
    setSince(at)
    setLevelIdx((i) => i + 1)
  }
  function handleRepeat(at: number) {
    setSince(at)
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
