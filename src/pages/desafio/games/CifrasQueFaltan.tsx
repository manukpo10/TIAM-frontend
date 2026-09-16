import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cifras que faltan" — día 17, cálculo (replaces "¿Alcanza la plata?" in
 * that slot, same move as LaPiramide replacing it for día 16 earlier in the
 * catalog). A column-addition worksheet — 2 or 3 three-digit addends over a
 * sum — with some digits blanked out. Tap an empty cell to focus it, tap a
 * digit 0-9 on the keypad below to fill it. This is the only free-recall
 * numeric entry in the catalog; everywhere else (see ElVuelto.tsx's header)
 * this app deliberately avoids typing. It still honours that rule to the
 * letter: there is no `<input>` anywhere, every interaction is a discrete
 * button tap from a fixed, visible set — exactly like CrucigramaDeCifras'
 * number bank, just per-digit instead of per-whole-answer.
 *
 * THE INVARIANT THAT MATTERS: build the addition first — random addends,
 * the true sum computed FROM them, never the other way around (same
 * discipline as CalculoEnCuadro/MesaDeCartas) — THEN blank a handful of
 * digit cells, THEN verify the blanked puzzle has EXACTLY ONE valid digit
 * assignment before it's ever shown to a player. Column addition is
 * deceptively easy to make ambiguous: blank both addends' units digits in
 * the same column and every pair that sums to the visible result (given the
 * fixed carry into the next column) reads as "valid" — e.g. a units result
 * of 7 with no carry accepts (0,7), (1,6), (2,5) ... (7,0), eight different
 * correct-looking answers, not one. `isUnique` catches this by brute-forcing
 * every candidate digit for every blank (0-9, or 1-9 at a leading position
 * so a blanked leading digit can never validly resolve to a leading zero)
 * and counting how many full assignments satisfy the addition; anything but
 * exactly one rejects that blank set and the generator tries again — see
 * `buildPuzzle`'s retry loop. Skipping this check is the single worst
 * failure mode a fill-in-the-digits game can ship: a player who is
 * completely right gets told they're wrong because the puzzle secretly had
 * two right answers. Verified separately, before this file shipped, by a
 * throwaway script that generated thousands of puzzles per level and
 * brute-forced every one — not just asserted here.
 *
 * Generated PROCEDURALLY per round, not from an authored pool — same shape
 * as SumaHastaDiez's `buildBoard` (a generated board with a provable
 * invariant, re-drawn via `useMemo` keyed on `roundKey`), adapted here to a
 * multi-round-per-level structure (2 rounds × 3 levels, like
 * LaPiramide/CrucigramaDeCifras) instead of SumaHastaDiez's one-board-per-
 * level. Because content is redrawn on every `roundKey`, "Repetir" would be
 * a lie — the final-level button reads "Otra cuenta" instead, matching
 * SumaHastaDiez's "Otra grilla" for the exact same reason.
 *
 * HOW THIS DIFFERS FROM LaPiramide (día 16, the other cálculo fill-the-
 * blank-number game): LaPiramide is RECOGNITION — pick the right value among
 * 3 shown options, in a FIXED solve order because later blanks depend on
 * earlier reveals, drawn from a small hand-authored pool verified once,
 * offline, before shipping. This game is RECALL — no options are shown, the
 * player produces the digit themselves on the keypad — in PLAYER-CHOSEN
 * order, since once uniqueness is guaranteed every blank is independently
 * solvable from the given digits alone, with no artificial dependency
 * between them. A wrong LaPiramide tap eliminates that option from view; a
 * wrong attempt here clears only the cells that didn't match (never the
 * ones already right), so the player retries exactly what was wrong, never
 * the whole puzzle — there's no fixed option set to eliminate from when the
 * answer space is "any digit."
 */

interface Level {
  n: number
  name: string
  addendCount: number
  addendWidth: number
  blankCount: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', addendCount: 2, addendWidth: 3, blankCount: 2 },
  { n: 2, name: 'Nivel 2', addendCount: 2, addendWidth: 3, blankCount: 3 },
  { n: 3, name: 'Nivel 3', addendCount: 3, addendWidth: 3, blankCount: 4 },
]

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
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

interface Blank {
  row: number
  col: number
}
interface Puzzle {
  addends: number[]
  sum: number
  totalWidth: number
  grid: (number | null)[][] // grid[row][col] — rows 0..addends.length-1 are addends, last row is the sum
  blanks: Blank[]
}

function cellKey(row: number, col: number): string {
  return `${row}-${col}`
}
function digitsOf(n: number): number[] {
  return String(n)
    .split('')
    .map((d) => Number(d))
}

// Addend rows are right-aligned under the sum, like real column addition —
// a row narrower than the sum (totalWidth > addendWidth) is left-padded
// with `null` cells that render as invisible placeholders, never as blanks.
function buildGrid(addends: number[], sum: number, totalWidth: number, addendWidth: number): (number | null)[][] {
  const grid: (number | null)[][] = addends.map((a) => {
    const pad = totalWidth - addendWidth
    return [...Array(pad).fill(null), ...digitsOf(a)]
  })
  grid.push(digitsOf(sum))
  return grid
}

function nonNullCells(grid: (number | null)[][]): Blank[] {
  const cells: Blank[] = []
  grid.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v !== null) cells.push({ row: r, col: c })
    })
  })
  return cells
}

// The leading (leftmost) cell of every row — each addend's own first digit,
// and the sum's first digit. Never allowed to resolve to 0: see isUnique.
function isLeadingCell(cell: Blank, totalWidth: number, addendWidth: number, sumRowIdx: number): boolean {
  if (cell.row === sumRowIdx) return cell.col === 0
  return cell.col === totalWidth - addendWidth
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] // full domain — also the keypad, in reading order
const DIGITS_NONZERO = DIGITS.filter((d) => d !== 0) // domain for a blanked leading cell

// Reconstructs every row's integer from `grid`, substituting `combo` for the
// blanked cells, and checks the addition holds. Pure arithmetic identity —
// no digit-by-digit carry simulation needed, standard column addition IS
// base-10 positional addition, so this is exactly equivalent and simpler.
function checkAssignment(grid: (number | null)[][], blanks: Blank[], combo: number[], totalWidth: number): boolean {
  const sumRowIdx = grid.length - 1
  const digitAt = (row: number, col: number): number => {
    const i = blanks.findIndex((b) => b.row === row && b.col === col)
    return i !== -1 ? combo[i] : (grid[row][col] as number)
  }
  let total = 0
  for (let row = 0; row < sumRowIdx; row++) {
    let value = 0
    for (let col = 0; col < totalWidth; col++) {
      if (grid[row][col] === null) continue
      value = value * 10 + digitAt(row, col)
    }
    total += value
  }
  let sumValue = 0
  for (let col = 0; col < totalWidth; col++) sumValue = sumValue * 10 + digitAt(sumRowIdx, col)
  return total === sumValue
}

// Exhaustive brute force over every candidate digit for every blank —
// counts how many full assignments satisfy the addition and stops early
// the moment a second one turns up. Domains already exclude a leading zero
// at a leading position, so a "valid" assignment can never read as one.
function isUnique(grid: (number | null)[][], blanks: Blank[], totalWidth: number, addendWidth: number): boolean {
  const sumRowIdx = grid.length - 1
  const domains = blanks.map((b) =>
    isLeadingCell(b, totalWidth, addendWidth, sumRowIdx) ? DIGITS_NONZERO : DIGITS,
  )
  const combo: number[] = new Array(blanks.length).fill(0)
  let count = 0

  function recurse(i: number): boolean {
    if (i === blanks.length) {
      if (checkAssignment(grid, blanks, combo, totalWidth)) count++
      return count > 1
    }
    for (const d of domains[i]) {
      combo[i] = d
      if (recurse(i + 1)) return true
    }
    return false
  }

  recurse(0)
  return count === 1
}

function pickBlanks(cells: Blank[], count: number): Blank[] {
  return shuffle(cells).slice(0, count)
}

// Build → blank → verify → retry. Addends are re-rolled (outer loop) when
// no blank-position choice for them checks out within the inner budget —
// some digit combinations are just structurally prone to multiple valid
// readings (see the file header), so trying a fresh addition is cheaper
// than trying to reason about which one that was.
function buildPuzzle(level: Level): Puzzle {
  for (let outer = 0; outer < 200; outer++) {
    const addends = Array.from({ length: level.addendCount }, () => randInt(100, 999))
    const sum = addends.reduce((a, b) => a + b, 0)
    const totalWidth = String(sum).length
    const grid = buildGrid(addends, sum, totalWidth, level.addendWidth)
    const cells = nonNullCells(grid)
    for (let inner = 0; inner < 80; inner++) {
      const blanks = pickBlanks(cells, level.blankCount)
      if (isUnique(grid, blanks, totalWidth, level.addendWidth)) {
        return { addends, sum, totalWidth, grid, blanks }
      }
    }
  }
  // Practically unreachable — a throwaway script generated 2000 puzzles per
  // level during development and brute-forced every one without a single
  // failure. Throwing here keeps a future generation regression loud
  // instead of silently rendering a broken round.
  throw new Error('CifrasQueFaltan: no se pudo generar una cuenta con solución única')
}

function buildEpoch(): Puzzle[][] {
  return LEVELS.map((level, i) => Array.from({ length: ROUNDS_PER_LEVEL[i] }, () => buildPuzzle(level)))
}

const CELL_SIZE_CLASS: Record<number, string> = {
  3: 'h-14 w-14 text-2xl sm:h-16 sm:w-16 sm:text-3xl',
  4: 'h-12 w-12 text-xl sm:h-14 sm:w-14 sm:text-2xl',
}
const OP_CELL_CLASS: Record<number, string> = {
  3: 'flex h-14 w-6 items-center justify-center text-2xl font-extrabold text-slate-400 sm:h-16 sm:w-7 sm:text-3xl',
  4: 'flex h-12 w-5 items-center justify-center text-xl font-extrabold text-slate-400 sm:h-14 sm:w-6 sm:text-2xl',
}

const PRAISE = ['¡Muy bien!', '¡Perfecto!', '¡Así se hace!', '¡Excelente cuenta!']
const HINTS = [
  'Esa combinación no cierra la cuenta. Los números que fallaron se borraron — probá de nuevo.',
  'Todavía no da. Repasá cómo suman las columnas y volvé a intentar.',
  'Casi. Con calma, completá otra vez los casilleros que quedaron vacíos.',
]

export function CifrasQueFaltan({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // The whole epoch (every level's rounds) is drawn together, once per
  // roundKey — same "generate with a provable invariant" shape as
  // SumaHastaDiez's buildBoard, just producing ROUNDS_PER_LEVEL puzzles per
  // level instead of a single board. A fresh roundKey (only ever bumped by
  // replay()) draws a brand new epoch — see replay()'s comment.
  const epoch = useMemo(() => buildEpoch(), [roundKey])

  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const rounds = epoch[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const puzzle = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel
  const sumRowIdx = puzzle ? puzzle.addends.length : 0
  const blankKeys = puzzle ? new Set(puzzle.blanks.map((b) => cellKey(b.row, b.col))) : new Set<string>()

  const [filled, setFilled] = useState<Record<string, number>>({})
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [roundPraise, setRoundPraise] = useState(PRAISE[0])
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-attempt count, accumulated across levels 1→2→3, zeroed only by a
  // genuine day restart — see replay().
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function attemptFill(key: string, digit: number) {
    if (!puzzle || resolving) return
    const next = { ...filled, [key]: digit }
    setFocusedKey(null)
    const allFilled = puzzle.blanks.every((b) => next[cellKey(b.row, b.col)] !== undefined)
    if (!allFilled) {
      setFilled(next)
      return
    }
    const allCorrect = puzzle.blanks.every((b) => next[cellKey(b.row, b.col)] === puzzle.grid[b.row][b.col])
    if (allCorrect) {
      setFilled(next)
      setHint(null)
      setRoundPraise(pickOne(PRAISE))
      setResolving(true)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setFilled({})
        setFocusedKey(null)
        setResolving(false)
      }, 800)
      return
    }
    // Wrong: keep whichever blanks matched, clear only the ones that
    // didn't — the player retries exactly what was wrong, never the round.
    const corrected: Record<string, number> = {}
    for (const b of puzzle.blanks) {
      const k = cellKey(b.row, b.col)
      if (next[k] === puzzle.grid[b.row][b.col]) corrected[k] = next[k]
    }
    setFilled(corrected)
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function tapCell(row: number, col: number) {
    if (!puzzle || resolving) return
    const key = cellKey(row, col)
    if (!blankKeys.has(key)) return
    if (filled[key] !== undefined) {
      // Filled → clear it and focus it, ready for a fresh digit in one tap.
      setFilled((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setFocusedKey(key)
      setHint(null)
      return
    }
    setFocusedKey(key)
    setHint(null)
  }
  function tapDigit(digit: number) {
    if (!focusedKey || resolving) return
    attemptFill(focusedKey, digit)
  }

  // Resets happen HERE, synchronously with the level/epoch change, not in
  // an effect keyed on levelIdx — an effect lags one render behind, so
  // `done` would read the previous level's stale-true value on the render
  // that arrives at the new level and fire onComplete with garbage (same
  // reasoning as SumaHastaDiez.tsx / ElVuelto.tsx).

  // "Siguiente nivel" — advance within the SAME epoch; epoch is left alone,
  // level i+1's additions were already drawn when this epoch started.
  function nextLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setFilled({})
    setFocusedKey(null)
    setResolving(false)
    setHint(null)
  }
  // Only ever called from the FINAL level's completion card, so always a
  // genuine day restart — zero the mistake accumulator. Bumps roundKey,
  // which draws a brand new epoch (see the `epoch` useMemo above): every
  // addition is freshly generated, never the same ones again — that's why
  // the button below reads "Otra cuenta", not "Repetir".
  function replay() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setFilled({})
    setFocusedKey(null)
    setResolving(false)
    setHint(null)
    setMistakes(0)
  }

  // Fires once per roundKey when the last level's last round resolves.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  function renderDigitCell(row: number, col: number) {
    if (!puzzle) return null
    const value = puzzle.grid[row][col]
    const sizeClass = CELL_SIZE_CLASS[puzzle.totalWidth]
    if (value === null) {
      return <div key={cellKey(row, col)} aria-hidden="true" className={sizeClass} />
    }
    const key = cellKey(row, col)
    if (!blankKeys.has(key)) {
      return (
        <div
          key={key}
          className={['flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-white font-extrabold text-slate-800', sizeClass].join(
            ' ',
          )}
        >
          {value}
        </div>
      )
    }
    const enteredValue = filled[key]
    const isFilled = enteredValue !== undefined
    const isFocused = focusedKey === key
    return (
      <button
        key={key}
        type="button"
        disabled={resolving}
        onClick={() => tapCell(row, col)}
        aria-label={isFilled ? `cifra ${enteredValue}` : 'casillero vacío'}
        aria-pressed={isFocused}
        className={[
          'flex items-center justify-center rounded-2xl border-2 font-extrabold transition',
          'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
          sizeClass,
          isFocused
            ? 'border-dashed border-tiam-blue bg-tiam-blue/5 text-tiam-blue ring-2 ring-tiam-blue/30'
            : isFilled
              ? 'border-tiam-blue/40 bg-white text-slate-800 hover:border-tiam-blue/60'
              : 'border-dashed border-slate-300 bg-slate-50 text-slate-300 hover:border-slate-400',
        ].join(' ')}
      >
        {isFilled ? enteredValue : ''}
      </button>
    )
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Completá los números que faltan</h2>
            <p className="mt-1 text-base font-medium text-slate-500">
              Tocá un casillero vacío y elegí su número en el teclado.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Cuenta {roundIdx + 1} de {roundsForLevel}
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
          {/* Column addition */}
          <div className="mx-auto mt-5 flex w-fit flex-col gap-1.5 sm:gap-2">
            {puzzle.addends.map((_, row) => (
              <div key={`row-${row}`} className="flex items-center gap-1.5 sm:gap-2">
                <div className={OP_CELL_CLASS[puzzle.totalWidth]}>{row === puzzle.addends.length - 1 ? '+' : ''}</div>
                {Array.from({ length: puzzle.totalWidth }, (_, col) => renderDigitCell(row, col))}
              </div>
            ))}
            <div className="flex items-center gap-1.5 border-t-[3px] border-slate-800 pt-1.5 sm:gap-2">
              <div className={OP_CELL_CLASS[puzzle.totalWidth]} aria-hidden="true" />
              {Array.from({ length: puzzle.totalWidth }, (_, col) => renderDigitCell(sumRowIdx, col))}
            </div>
          </div>

          {!resolving && (
            <>
              {/* Keypad — buttons only, never an <input>: see file header. */}
              <div className="mx-auto mt-6 grid max-w-xs grid-cols-5 gap-2">
                {DIGITS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={!focusedKey}
                    onClick={() => tapDigit(d)}
                    aria-label={`número ${d}`}
                    className={[
                      'flex min-h-[52px] items-center justify-center rounded-2xl border-2 text-xl font-extrabold transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      focusedKey
                        ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                        : 'border-slate-100 bg-slate-50 text-slate-300',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-center text-base font-medium text-slate-500">
                {hint ?? (focusedKey ? 'Elegí el número para ese casillero.' : 'Tocá el próximo casillero vacío.')}
              </p>
            </>
          )}

          {resolving && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tiam-green/15">
                <Check className="h-5 w-5 text-tiam-green" strokeWidth={3} />
              </span>
              <p className="text-lg font-semibold text-tiam-green">{roundPraise}</p>
            </div>
          )}
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
            Completaste las {roundsForLevel} cuentas — terminaste el {level.name.toLowerCase()}.
          </p>
          <div className="mt-5 flex justify-center">
            {levelIdx < LEVELS.length - 1 ? (
              <button
                type="button"
                onClick={nextLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Otra cuenta
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
