import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Radar, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Radar de sílabas" — día 13, orientación. A coordinate board in the same
 * spirit as Coordenadas.tsx (columns lettered A-…, rows numbered 1-…), but
 * cells hold SYLLABLES (2-4 characters) instead of loose letters, and the
 * player follows a "fórmula" — an ORDERED list of coordinates, e.g. "1A + 3D
 * + 5B" — that sums several syllable cells into one whole word, instead of
 * Coordenadas' one-coordinate-gives-one-letter model.
 *
 * The A-J×1-6 naming in the brief is a NAMING SCHEME, not a render mandate:
 * at 10 columns, 2-4-character syllable cells don't fit a 375px board
 * (Coordenadas' single LETTERS already needed nivel 3's board capped at
 * 320-340px for just 6 columns). Board here tops out at 5 columns × 5 rows
 * (nivel 3) — same lettered/numbered header style, smaller grid.
 *
 * Coordinate label order is NUMBER-then-LETTER ("5C", not Coordenadas' "C5")
 * — matches the brief's own formula example exactly. The grid headers stay
 * spreadsheet-conventional (letters across the top, numbers down the side,
 * same as Coordenadas); only the compact label used in the formula row and
 * aria-labels is reordered.
 *
 * Formula shown as a full row of chips up front (not revealed one-at-a-time
 * like Coordenadas' single target box) — this IS the "fórmula" the brief
 * describes, so hiding all but the current step would undersell the framing.
 * Each chip still tracks state (found/current/pending) so the player always
 * has ONE clear next step, keeping the same low-working-memory scaffolding
 * Coordenadas uses despite showing more up front.
 *
 * Wrong taps are a TEMPORARY flash only (mirrors Coordenadas' wrongKey,
 * auto-clearing on a timeout), never a permanent per-cell disable — a cell
 * wrong for the current step could be correct for a LATER step in the same
 * formula. Only cells already found this round are excluded from further
 * taps (silent no-op on re-tap). No timer, ever; wrong taps never turn red.
 *
 * Difficulty ramps board size AND formula length together: nivel 1 is a
 * 4×4 board with 2-cell formulas, nivel 2 is 5×4 with 3-cell formulas, nivel
 * 3 is 5×5 with 4-cell formulas. ROUNDS_PER_LEVEL is [2, 2, 2] — same
 * reasoning as Coordenadas: each round is already a multi-tap sequence, not
 * a single tap, so three rounds at the top levels would make one level
 * unreasonably long. Puzzle data (in-bounds, no duplicate cell within a
 * word) was verified by hand for every pool entry below, same discipline as
 * Encaminada/Coordenadas' own hand-authored pools.
 *
 * A one-time "¿Listo?" ready screen (same pattern as Encaminada/Coordenadas)
 * gates the START of the day. This board is smaller than Coordenadas' own
 * (max 5×5 body cells here vs Coordenadas' 6×6), and the formula-chips row
 * replaces Coordenadas' single big target box with a shorter row of small
 * chips, so nivel 3 fits with comfortable margin under the same 375×812
 * budget without needing any further nivel-3-only shrinking. `phase` flips
 * to 'playing' once and never resets — not on level-advance, not on
 * "Repetir".
 */

interface Cell {
  row: number
  col: number
}
interface FormulaWord {
  word: string
  /** Syllables in order; syllables.join('') === word. */
  syllables: string[]
  /** cells[i] holds syllables[i] — any distinct in-bounds cell, not
   * necessarily adjacent to its neighbours (same freedom as Coordenadas). */
  cells: Cell[]
}
interface Level {
  n: number
  name: string
  rows: number
  cols: number
  pool: FormulaWord[]
}

// Shorter than this app's usual [2, 3, 3] default — each round is already a
// multi-tap sequence, same reasoning as Coordenadas' own [2, 2, 2].
const ROUNDS_PER_LEVEL = [2, 2, 2]

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rows: 4,
    cols: 4, // columns A-D
    pool: [
      { word: 'VACA', syllables: ['VA', 'CA'], cells: [{ row: 0, col: 0 }, { row: 2, col: 3 }] },
      { word: 'SAPO', syllables: ['SA', 'PO'], cells: [{ row: 3, col: 1 }, { row: 0, col: 2 }] },
      { word: 'TAZA', syllables: ['TA', 'ZA'], cells: [{ row: 1, col: 3 }, { row: 3, col: 0 }] },
      { word: 'FOCA', syllables: ['FO', 'CA'], cells: [{ row: 2, col: 0 }, { row: 0, col: 3 }] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rows: 4,
    cols: 5, // columns A-E
    pool: [
      { word: 'CAMISA', syllables: ['CA', 'MI', 'SA'], cells: [{ row: 0, col: 0 }, { row: 2, col: 3 }, { row: 3, col: 4 }] },
      { word: 'ZAPATO', syllables: ['ZA', 'PA', 'TO'], cells: [{ row: 1, col: 4 }, { row: 3, col: 0 }, { row: 0, col: 2 }] },
      { word: 'VENTANA', syllables: ['VEN', 'TA', 'NA'], cells: [{ row: 2, col: 0 }, { row: 0, col: 4 }, { row: 3, col: 2 }] },
      { word: 'PALOMA', syllables: ['PA', 'LO', 'MA'], cells: [{ row: 0, col: 1 }, { row: 2, col: 4 }, { row: 1, col: 1 }] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rows: 5,
    cols: 5, // columns A-E
    pool: [
      { word: 'MARIPOSA', syllables: ['MA', 'RI', 'PO', 'SA'], cells: [{ row: 0, col: 0 }, { row: 2, col: 3 }, { row: 4, col: 1 }, { row: 1, col: 4 }] },
      { word: 'ELEFANTE', syllables: ['E', 'LE', 'FAN', 'TE'], cells: [{ row: 3, col: 0 }, { row: 0, col: 2 }, { row: 4, col: 4 }, { row: 1, col: 1 }] },
      { word: 'ZAPATERO', syllables: ['ZA', 'PA', 'TE', 'RO'], cells: [{ row: 2, col: 0 }, { row: 0, col: 4 }, { row: 3, col: 3 }, { row: 4, col: 2 }] },
      { word: 'CARACOLES', syllables: ['CA', 'RA', 'CO', 'LES'], cells: [{ row: 1, col: 0 }, { row: 4, col: 0 }, { row: 0, col: 1 }, { row: 3, col: 4 }] },
    ],
  },
]

const COLS_LETTERS = ['A', 'B', 'C', 'D', 'E']

function cellKey(c: Cell): string {
  return `${c.row}-${c.col}`
}
/** Compact "5C" (row-number then column-letter) label — matches the brief's
 * own formula example order, deliberately NOT Coordenadas' letter-then-number. */
function cellLabel(c: Cell): string {
  return `${c.row + 1}${COLS_LETTERS[c.col]}`
}

// Plain-frequency Spanish-friendly filler syllables (CV shape, skips rare
// combinations) — fillers carry no meaning, this just keeps the board
// looking like ordinary syllable text.
const FILLER_SYLLABLES = [
  'BA', 'BE', 'BI', 'BO', 'BU', 'CA', 'CE', 'CO', 'CU', 'DA', 'DE', 'DI', 'DO',
  'FA', 'FE', 'FI', 'GA', 'GO', 'JA', 'JO', 'LA', 'LE', 'LI', 'LO', 'MA', 'ME',
  'MI', 'MO', 'NA', 'NE', 'NO', 'PA', 'PE', 'PI', 'RA', 'RE', 'SA', 'SE', 'SI',
  'TA', 'TE', 'TI', 'TO', 'VA', 'VE', 'VI',
]

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

function buildBoard(entry: FormulaWord, rows: number, cols: number): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => FILLER_SYLLABLES[Math.floor(Math.random() * FILLER_SYLLABLES.length)]),
  )
  entry.cells.forEach((c, i) => {
    grid[c.row][c.col] = entry.syllables[i]
  })
  return grid
}

const HINTS = [
  'Esa celda no es — fijate qué paso de la fórmula toca ahora.',
  'Casi. Contá primero la fila y después buscá la columna de la letra.',
  'No es esa todavía. Mirá bien el número y la letra del paso actual.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente fórmula!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena puntería!']

export function RadarDeSilabas({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // `ROUNDS_PER_LEVEL[i]` words drawn at random from level i's own pool, for
  // EVERY level at once — decided once per "epoch" (a full 1→2→3 pass), at
  // mount, never re-rolled by revisiting a level,
  // so "Repetir" hands back the exact same formulas deterministically (same
  // pattern as Encaminada/Coordenadas' epochOrder).
  const [epochOrder] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= roundsForLevel
  const current = order[roundIdx] as FormulaWord | undefined

  const board = useMemo(
    () => (current ? buildBoard(current, level.rows, level.cols) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current],
  )

  // How many cells of `current`'s formula have been correctly found, IN
  // ORDER — single source of truth, mirrors Coordenadas' foundCount exactly.
  const [foundCount, setFoundCount] = useState(0)
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Mistakes + successful cell-finds, accumulated across levels 1→2→3 and
  // only zeroed on a genuine day restart — same policy as every other
  // multi-level game in this folder.
  const [mistakes, setMistakes] = useState(0)
  const [totalFound, setTotalFound] = useState(0)

  const wordComplete = current ? foundCount >= current.syllables.length : false
  const targetCell = current && !wordComplete ? current.cells[foundCount] : undefined

  const foundCellKeys = useMemo(
    () => new Set(current ? current.cells.slice(0, foundCount).map(cellKey) : []),
    [current, foundCount],
  )

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function handleTap(cell: Cell) {
    if (!current || done || wordComplete) return
    const key = cellKey(cell)
    if (foundCellKeys.has(key)) return // already found this round — silent no-op (mirrors Coordenadas)
    const target = current.cells[foundCount]
    if (target.row === cell.row && target.col === cell.col) {
      const nextCount = foundCount + 1
      setFoundCount(nextCount)
      setTotalFound((n) => n + 1)
      setWrongKey(null)
      setHint(null)
      if (nextCount >= current.syllables.length) {
        // Word complete — brief celebratory pause (word strip fully lit)
        // before moving to the next round, same timing convention as
        // Coordenadas/DondeEsta's advance().
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setFoundCount(0)
          setWrongKey(null)
          setHint(null)
        }, 1200)
      }
    } else {
      // Temporary flash ONLY — never a permanent per-cell disable (see file
      // header gotcha: this exact cell may be the correct answer for a
      // LATER step in this same formula).
      setWrongKey(key)
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
      window.setTimeout(() => {
        setWrongKey((w) => (w === key ? null : w))
        setHint(null)
      }, 900)
    }
  }

  // Synchronous resets happen HERE, in the same handler that changes
  // levelIdx/roundKey — not in a separate effect keyed on them, which would
  // let the onComplete effect below read a stale `done` on the render that
  // just arrived at the new level (same discipline as every other
  // multi-level game in this folder).

  // "Siguiente nivel" — advance within the SAME epoch. epochOrder is left
  // alone: level i+1's drawn words were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setFoundCount(0)
    setWrongKey(null)
    setHint(null)
  }
  // Runs on the "Repetir" button on the final level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — it
  // zeroes the mistake accumulator).
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setFoundCount(0)
    setWrongKey(null)
    setHint(null)
    setMistakes(0)
    setTotalFound(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same words, same order, as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }

  // Fires once per roundKey when level 3 is completed. A full day restart
  // (via restartEpoch, from either restart button) gets a new roundKey, so a
  // genuine replay of the whole day reports again; re-rendering while still
  // done on level 3 does not fire twice. totalAttempts uses totalFound
  // (every cell found across the whole day) rather than a fixed round count,
  // same fine-grained accuracy reasoning as Coordenadas.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + totalFound })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, totalFound])

  const levelName = `Nivel ${levelIdx + 1}`
  const rowIdxs = Array.from({ length: level.rows + 1 }, (_, i) => i - 1)
  const colIdxs = Array.from({ length: level.cols + 1 }, (_, i) => i - 1)

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
        {phase === 'playing' && !done && (
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
        )}
      </div>

      {/* Pantalla previa: única vez, al principio del día — mismo patrón que
          Encaminada/Coordenadas, no se repite en cada ronda. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Radar className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver una fórmula con celdas para tocar, en orden, y una grilla de sílabas. Seguí la fórmula
            tocando cada celda para armar la palabra completa.
          </p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && !done && current && (
        <>
          {/* Fórmula — full sequence shown up front, each step styled by
              state (found/current/pending) so there's still only ONE clear
              next tap despite showing the whole formula (see file header). */}
          <div className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-1">
            {current.cells.map((cell, i) => {
              const state = i < foundCount ? 'found' : i === foundCount ? 'current' : 'pending'
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-sm font-bold text-slate-300">+</span>}
                  <span
                    className={[
                      'flex h-9 min-w-[44px] items-center justify-center rounded-lg border-2 px-1.5 text-base font-extrabold',
                      state === 'found' ? 'border-tiam-green bg-tiam-green/10 text-tiam-green' : '',
                      state === 'current' ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue' : '',
                      state === 'pending' ? 'border-slate-200 bg-slate-50 text-slate-400' : '',
                    ].join(' ')}
                  >
                    {cellLabel(cell)}
                  </span>
                </span>
              )
            })}
          </div>
          {wordComplete && <p className="mt-2 text-center text-lg font-bold text-tiam-green">¡Formaste {current.word}!</p>}

          {/* Word-so-far strip — one box per syllable, mirrors Coordenadas'
              per-letter found strip. */}
          <div className="mx-auto mt-3 flex flex-wrap justify-center gap-1.5">
            {current.syllables.map((syl, i) => (
              <div
                key={i}
                className={[
                  'flex h-10 min-w-[40px] items-center justify-center rounded-lg border-2 px-1 text-base font-extrabold',
                  i < foundCount ? 'border-tiam-green bg-tiam-green/5 text-tiam-green' : 'border-slate-200 bg-slate-50 text-slate-300',
                ].join(' ')}
              >
                {i < foundCount ? syl : ''}
              </div>
            ))}
          </div>

          {/* Coordinate board — header row (column letters) + header column
              (row numbers) + body cells holding syllables, all in one CSS
              grid (same technique as Coordenadas). Not aspect-square: cells
              hold 2-4 characters, wider than tall reads better than forcing
              a square. Nivel 2/3's 5-column board gets the smaller mobile
              cap; nivel 1's 4-column board gets a touch more room. */}
          <div
            className={
              level.cols >= 5
                ? 'mx-auto mt-3 grid w-full max-w-[340px] gap-1 sm:max-w-[360px] sm:gap-1.5'
                : 'mx-auto mt-3 grid w-full max-w-[300px] gap-1 sm:max-w-[320px] sm:gap-1.5'
            }
            style={{ gridTemplateColumns: `repeat(${level.cols + 1}, minmax(0, 1fr))` }}
          >
            {rowIdxs.flatMap((r) =>
              colIdxs.map((c) => {
                if (r === -1 && c === -1) return <div key="corner" />
                if (r === -1) {
                  const isActive = targetCell?.col === c
                  return (
                    <div
                      key={`ch-${c}`}
                      className={`flex h-6 items-center justify-center text-sm font-bold ${isActive ? 'text-tiam-blue' : 'text-slate-400'}`}
                    >
                      {COLS_LETTERS[c]}
                    </div>
                  )
                }
                if (c === -1) {
                  const isActive = targetCell?.row === r
                  return (
                    <div
                      key={`rh-${r}`}
                      className={`flex h-10 items-center justify-center text-sm font-bold sm:h-11 ${isActive ? 'text-tiam-blue' : 'text-slate-400'}`}
                    >
                      {r + 1}
                    </div>
                  )
                }
                const key = cellKey({ row: r, col: c })
                const isFound = foundCellKeys.has(key)
                const isWrong = wrongKey === key
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={done || wordComplete}
                    onClick={() => handleTap({ row: r, col: c })}
                    aria-label={`Celda ${cellLabel({ row: r, col: c })}`}
                    className={[
                      'relative flex h-10 items-center justify-center rounded-lg border-2 bg-white px-1 text-base font-extrabold transition sm:h-11',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      isFound
                        ? 'border-tiam-green text-slate-700 ring-2 ring-tiam-green/30'
                        : isWrong
                          ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300 text-slate-700'
                          : 'border-slate-200 text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                    ].join(' ')}
                  >
                    {board[r][c]}
                    {isFound && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              }),
            )}
          </div>
        </>
      )}

      {hint && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Armaste las {roundsForLevel} fórmulas — completaste el {levelName.toLowerCase()}.
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
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
