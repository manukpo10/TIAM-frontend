import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cuadrados mágicos" — día 16, mes 5, cálculo. A 3×3 square with some numbers
 * already in place and a few empty squares; below it, a bank with exactly the
 * numbers that are missing. Tap a number (it lights up), then tap an empty
 * square to put it there; tap a number you already placed to take it back. The
 * goal: EVERY ROW and EVERY COLUMN adds up to the same total (the diagonals do
 * not count, and the instructions say so). Knowing what a line still needs
 * (total minus what is there) and which of the two numbers goes where is the
 * calculation.
 *
 * Validated by the SUMS, never against a stored answer: the square is solved
 * when every row and every column is full and adds up to the total, so any
 * arrangement that does is accepted. At the end of every row and under every
 * column, a chip shows what that line adds up to right now ("7/10") and turns
 * green with a check when it is right. A line that is full but wrong shows muted
 * gray (never red), the hint says by how much it is off, and that placement
 * costs ONE mistake; taking a number back costs nothing, and nothing is timed.
 * One wrong number costs ONE mistake in total: it sits in a row AND in a column,
 * which can fill up on different taps, so a line that is off only because of a
 * number that was already reported gets the same hint but is not billed again
 * (every number of a reported line is remembered until it is taken back or
 * replaced). A throwaway Node script (not committed) played 20 000 random walks
 * of placing, swapping and taking back on every puzzle: never more mistakes
 * than wrong placements, and a finished wrong square has always been billed.
 *
 * Ramp: total 10 with 2 empty squares → 15 with 3 → 20 with 4. At level 1 each
 * empty square is the only one missing in its row, so the chips alone point at
 * it; at level 2 two empty squares share a row; at level 3 EVERY line (row or
 * column) has either no empty square or exactly two, so no square can be read
 * off a single line and the player has to reason about pairs. A throwaway Node
 * script (not committed) tried every way of putting each bank on its empty
 * squares: every puzzle has exactly one valid arrangement (the numbers of a
 * bank are all different), every row and column of the finished square adds up
 * to the total, the bank has one number per empty square, and the line rule of
 * each level above holds for both puzzles.
 *
 * ONE square per level: each level has two authored puzzles and one is picked
 * ONCE at mount (`epoch`, together with the order of the bank), so "Repetir"
 * replays exactly the same three. Per-level state lives in <LevelView>, keyed by
 * run + level. A "¿Cómo se juega?" screen opens the day; "Repetir" never brings
 * it back. Guards for the double tap older hands make, all of SETTLE_MS and all
 * judged by the click's own timeStamp: the number that was just placed ignores a
 * second tap (or it would come straight back out), so does a bank number that
 * was just picked (or it would unpick), and so does the whole screen right after
 * the tap that brought it ("Empezar", "Siguiente nivel", "Repetir"), so the second
 * tap of that double tap does not pick a number. Once the square is solved only
 * the result card is added: it is scrolled into view on a short phone.
 *
 * totalAttempts = mistakes + every number to place (TOTAL_NUMBERS, derived).
 */

// ── data:start ──
/** A square of the grid: a number, or null when it starts empty. */
type Slot = number | null

interface PuzzleDef {
  /** What every row and every column must add up to. */
  total: number
  /** Row by row; null marks an empty square. */
  rows: Slot[][]
  /** The numbers to place: exactly one per empty square. */
  bank: number[]
}
interface LevelDef {
  name: string
  puzzles: PuzzleDef[]
}

// Every puzzle of a level has the same number of numbers to place, so
// TOTAL_NUMBERS never depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    puzzles: [
      {
        total: 10,
        rows: [
          [2, 3, null],
          [null, 5, 1],
          [4, 2, 4],
        ],
        bank: [5, 4],
      },
      {
        total: 10,
        rows: [
          [1, null, 3],
          [5, 2, 3],
          [4, 2, null],
        ],
        bank: [6, 4],
      },
    ],
  },
  {
    name: 'Nivel 2',
    puzzles: [
      {
        total: 15,
        rows: [
          [null, 1, null],
          [3, 5, 7],
          [4, null, 2],
        ],
        bank: [8, 6, 9],
      },
      {
        total: 15,
        rows: [
          [1, null, null],
          [6, 7, 2],
          [null, 3, 4],
        ],
        bank: [5, 9, 8],
      },
    ],
  },
  {
    name: 'Nivel 3',
    puzzles: [
      {
        total: 20,
        rows: [
          [null, 7, null],
          [6, 9, 5],
          [null, 4, null],
        ],
        bank: [5, 8, 9, 7],
      },
      {
        total: 20,
        rows: [
          [null, 4, null],
          [5, 7, 8],
          [null, 9, null],
        ],
        bank: [7, 9, 8, 3],
      },
    ],
  },
]

const TOTAL_NUMBERS = LEVELS.reduce((sum, lvl) => sum + lvl.puzzles[0].bank.length, 0)

/** What a line adds up to with the squares that are filled so far. */
function lineSum(line: Slot[]): { sum: number; full: boolean } {
  let sum = 0
  let full = true
  for (const v of line) {
    if (v === null) full = false
    else sum += v
  }
  return { sum, full }
}
function rowOf(values: Slot[][], r: number): Slot[] {
  return values[r]
}
function colOf(values: Slot[][], c: number): Slot[] {
  return values.map((row) => row[c])
}

/** Solved when every row and every column is full and adds up to the total — any arrangement that does. */
function isSolved(total: number, values: Slot[][]): boolean {
  const lines = [0, 1, 2].flatMap((i) => [rowOf(values, i), colOf(values, i)])
  return lines.every((line) => {
    const { sum, full } = lineSum(line)
    return full && sum === total
  })
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

interface LevelContent {
  puzzle: PuzzleDef
  /** The bank in its (frozen) display order: slot i always holds the same number. */
  bank: number[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const puzzle = pickOne(lvl.puzzles)
    return { puzzle, bank: shuffle(puzzle.bank) }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena cabeza para los números!']
/** A second tap on the same square, or on anything right after the tap that brought the screen
 * here, this soon is a double tap, not a new move. Long enough to swallow a double tap, short
 * enough that nobody who means it notices. */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Tocá un número de abajo: queda marcado.',
    'Después tocá un casillero vacío para ponerlo. Si te equivocás, tocá el número puesto y ese número vuelve abajo.',
    'Cada fila y cada columna tiene que sumar el mismo total. Las diagonales no cuentan.',
  ]
  const box = 'flex h-11 w-11 items-center justify-center rounded-xl border-2 text-xl font-bold'
  return (
    <div className="mt-4 rounded-3xl border border-cyan-600/20 bg-cyan-600/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-2xl bg-white p-3 text-center">
        <p className="text-sm font-semibold text-slate-500">Esta fila tiene que sumar 10</p>
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className={`${box} border-slate-700 bg-slate-700 text-white`}>4</span>
          <span className={`${box} border-slate-700 bg-slate-700 text-white`}>3</span>
          <span className={`${box} border-dashed border-cyan-600 bg-cyan-50 text-cyan-800`}>?</span>
          <span className="ml-1 flex min-h-[40px] items-center rounded-xl border-2 border-slate-200 px-2 text-base font-bold tabular-nums text-slate-700">
            7/10
          </span>
        </div>
        <p className="mt-2 text-base text-slate-700">
          4 + 3 + <span className="font-bold text-cyan-800">3</span> = 10: va el 3.
        </p>
      </div>
      {/* Pinned to the bottom edge when the screen is too short to show it in place (320x640). */}
      <div className="sticky bottom-3 z-10 mt-5 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface SumChipProps {
  label: string
  sum: number
  total: number
  full: boolean
}

/** What one row or column adds up to right now: gray while it fills, green when right, muted gray when full but off. */
function SumChip({ label, sum, total, full }: SumChipProps) {
  const ok = full && sum === total
  const off = full && !ok
  return (
    <span
      className={[
        'relative flex min-h-[40px] items-center justify-center rounded-xl border-2 px-1 text-base font-bold tabular-nums',
        ok
          ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
          : off
            ? 'border-slate-300 bg-slate-100 text-slate-500'
            : 'border-slate-200 bg-white text-slate-700',
      ].join(' ')}
    >
      <span className="sr-only">
        {label}: {sum} de {total}
        {ok ? ', bien' : ''}
      </span>
      <span aria-hidden="true">
        {sum}/{total}
      </span>
      {ok && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white ring-2 ring-white"
          aria-hidden="true"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={4} />
        </span>
      )}
    </span>
  )
}

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
  const { puzzle, bank } = content
  const { total } = puzzle

  // Which bank slot sits in each square (only squares the player filled), by index 0-8.
  const [placed, setPlaced] = useState<Record<number, number>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [flashCell, setFlashCell] = useState<number | null>(null)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  const lastCellRef = useRef<{ cell: number; at: number }>({ cell: -1, at: 0 })
  const lastBankRef = useRef<{ slot: number; at: number }>({ slot: -1, at: 0 })
  // Squares whose number was already reported as making a line add up wrong (see the header comment).
  const reportedRef = useRef<Set<number>>(new Set())
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

  const isGiven = (cell: number) => puzzle.rows[Math.floor(cell / 3)][cell % 3] !== null
  const valuesOf = (assign: Record<number, number>): Slot[][] =>
    puzzle.rows.map((row, r) =>
      row.map((given, c) => {
        if (given !== null) return given
        const slot = assign[r * 3 + c]
        return slot === undefined ? null : bank[slot]
      }),
    )
  const values = valuesOf(placed)
  const usedSlots = new Set(Object.values(placed))
  const solved = isSolved(total, values)
  const filledCount = Object.keys(placed).length

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!solved || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [solved])

  function place(cell: number, slot: number, at: number) {
    const next = { ...placed, [cell]: slot }
    setPlaced(next)
    setSelected(null)
    lastCellRef.current = { cell, at }
    // A swap sends the old number back to the bank, and whatever was said about it goes with it.
    reportedRef.current.delete(cell)
    const nextValues = valuesOf(next)

    if (isSolved(total, nextValues)) {
      setHint(null)
      setPraise(pickOne(PRAISE))
      onSolved()
      return
    }
    const r = Math.floor(cell / 3)
    const c = cell % 3
    const lines = [
      { name: `la fila ${r + 1}`, cells: [r * 3, r * 3 + 1, r * 3 + 2], ...lineSum(rowOf(nextValues, r)) },
      { name: `la columna ${c + 1}`, cells: [c, c + 3, c + 6], ...lineSum(colOf(nextValues, c)) },
    ]
    const offLines = lines.filter((l) => l.full && l.sum !== total)
    if (offLines.length > 0) {
      const off = offLines[0]
      setFlashCell(cell)
      const missing = total - off.sum
      setHint({
        text:
          off.sum > total
            ? `${capital(off.name)} suma ${off.sum}: se pasa por ${off.sum - total}. Probá con otros números.`
            : `${capital(off.name)} suma ${off.sum}: le ${missing === 1 ? 'falta' : 'faltan'} ${missing}. Probá con otros números.`,
        ok: false,
      })
      // Billed once per wrong number: a line that is off only because of a number that was already
      // reported (and is still on the board) is explained again, but not billed again.
      const reported = reportedRef.current
      if (offLines.some((l) => !l.cells.some((k) => k !== cell && reported.has(k)))) onMistake()
      for (const l of offLines) for (const k of l.cells) if (!isGiven(k)) reported.add(k)
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setFlashCell(null), 600)
      return
    }
    const right = lines.find((l) => l.full && l.sum === total)
    setHint(right ? { text: `¡${capital(right.name)} suma ${total}!`, ok: true } : null)
  }

  // `at` is the event's own timestamp (event.timeStamp), so the double-tap guard
  // never has to read the clock itself.
  function handleBankTap(slot: number, at: number) {
    if (solved || usedSlots.has(slot)) return
    // The second tap of a double tap on the button that brought this screen.
    if (at - since < SETTLE_MS) return
    const last = lastBankRef.current
    lastBankRef.current = { slot, at }
    // A second tap on the number just picked is a double tap: keep it picked.
    if (last.slot === slot && at - last.at < SETTLE_MS) return
    if (selected === slot) {
      setSelected(null)
      setHint(null)
      return
    }
    setSelected(slot)
    setHint({ text: 'Ahora tocá un casillero vacío.', ok: false })
  }

  function handleCellTap(cell: number, at: number) {
    // A tap on the square that is still flashing as wrong, or that was just
    // filled, is a double tap, not a second move: it must not take the number
    // straight back out.
    if (solved || flashCell === cell) return
    if (at - since < SETTLE_MS) return
    if (lastCellRef.current.cell === cell && at - lastCellRef.current.at < SETTLE_MS) return
    if (isGiven(cell)) {
      setHint({ text: 'Ese número ya viene fijo. Probá con un casillero vacío.', ok: false })
      return
    }
    if (cell in placed) {
      if (selected !== null) {
        // Swap: the number picked from the bank takes the square, the old one goes back down.
        place(cell, selected, at)
        return
      }
      const next = { ...placed }
      delete next[cell]
      reportedRef.current.delete(cell)
      setPlaced(next)
      setHint(null)
      return
    }
    if (selected === null) {
      setHint({ text: 'Primero tocá un número de abajo.', ok: false })
      return
    }
    place(cell, selected, at)
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Pusiste {filledCount} de {bank.length}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              Cada fila y cada columna tiene que sumar {total}
            </h2>
          </>
        )}
      </div>

      {/* The square: 3×3 squares, one chip per row at its end and one per column under it */}
      <div
        role="group"
        aria-label="Cuadrado"
        className="mx-auto mt-3 grid w-full max-w-[330px] gap-1.5"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) 3.5rem' }}
      >
        {[0, 1, 2].map((r) => (
          <div key={r} className="contents">
            {[0, 1, 2].map((c) => {
              const cell = r * 3 + c
              const given = isGiven(cell)
              const value = values[r][c]
              const isFlash = flashCell === cell
              const canDrop = selected !== null && value === null
              return (
                <button
                  key={c}
                  type="button"
                  disabled={solved}
                  aria-disabled={given}
                  onClick={(e) => handleCellTap(cell, e.timeStamp)}
                  aria-label={
                    given
                      ? `Fila ${r + 1}, columna ${c + 1}: número fijo, el ${value}`
                      : value === null
                        ? `Fila ${r + 1}, columna ${c + 1}: casillero vacío`
                        : `Fila ${r + 1}, columna ${c + 1}: el ${value}, tocá para sacarlo`
                  }
                  className={[
                    'flex aspect-square items-center justify-center rounded-2xl border-2 text-2xl font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    given
                      ? 'border-slate-700 bg-slate-700 text-white'
                      : solved
                        ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                        : isFlash
                          ? 'border-slate-300 bg-slate-100 text-slate-500 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                          : value !== null
                            ? 'border-cyan-600 bg-cyan-50 text-slate-900 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                            : canDrop
                              ? 'border-dashed border-cyan-600 bg-cyan-50 text-transparent ring-2 ring-cyan-600/30'
                              : 'border-dashed border-slate-400 bg-white text-transparent',
                  ].join(' ')}
                >
                  {value}
                </button>
              )
            })}
            <SumChip label={`Fila ${r + 1}`} {...lineSum(rowOf(values, r))} total={total} />
          </div>
        ))}
        {[0, 1, 2].map((c) => (
          <SumChip key={c} label={`Columna ${c + 1}`} {...lineSum(colOf(values, c))} total={total} />
        ))}
        <div aria-hidden="true" />
      </div>

      {!solved && (
        <>
          {/* The bank: every number keeps its own slot, so nothing shifts when one is placed */}
          <div className="mt-3 flex justify-center gap-2 max-[350px]:gap-1.5" aria-label="Números para poner" role="group">
            {bank.map((n, slot) => {
              const used = usedSlots.has(slot)
              const isSelected = selected === slot
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={used}
                  onClick={(e) => handleBankTap(slot, e.timeStamp)}
                  aria-pressed={isSelected}
                  aria-label={used ? `El ${n} ya está puesto` : `Número ${n}`}
                  className={[
                    'flex h-14 w-14 items-center justify-center rounded-xl border-2 text-2xl font-bold transition max-[350px]:h-12 max-[350px]:w-12',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    used
                      ? 'border-dashed border-slate-200 text-transparent'
                      : isSelected
                        ? '-translate-y-0.5 border-cyan-600 bg-cyan-50 text-slate-900 ring-2 ring-cyan-600/30'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-cyan-600/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-2 min-h-[2.5rem] text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Las 3 filas y las 3 columnas suman {total}. ¡Completaste el {level.name.toLowerCase()}!
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

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function CuadradosMagicos({ onComplete }: GameProps) {
  // Which puzzle each level plays, and the order of the bank — decided once, at
  // mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never
  // brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current screen on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_NUMBERS })
  }
  function handleStart(at: number) {
    setSince(at)
    setPhase('playing')
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

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Completá el cuadrado</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
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
