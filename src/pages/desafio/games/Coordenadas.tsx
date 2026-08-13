import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Grid3x3, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Coordenadas" — día 27, Mes 2, orientación. A battleship-style coordinate
 * board (columns A-F, rows 1-N) full of letters; one target coordinate is
 * shown at a time (e.g. "B3") and the player taps the matching cell. Reading
 * a lettered-column/numbered-row grid is a genuinely useful, very concrete
 * orientation skill (a map, a spreadsheet, a bingo card, a battleship board),
 * distinct from Encaminada's directional-path-following.
 *
 * Coordinates are revealed ONE AT A TIME rather than as a full list upfront —
 * the simpler of the two interaction variants the brief allows, and lighter
 * on working memory per step (same one-thing-at-a-time philosophy as Clave
 * de símbolos' current-position highlight). Validation is a plain exact-cell
 * match, so — unlike Encaminada — there's no need for a multiple-choice
 * fallback: the built word is revealed as a celebratory payoff once every
 * coordinate is found, not as a separate graded step.
 *
 * IMPORTANT gotcha this component works around: a wrong tap must be a
 * TEMPORARY flash only (mirrors CaminoNumerico's wrongValue/wrongHint,
 * auto-clearing on a timeout), never a permanent per-cell disable. Every
 * coordinate in a round maps to a distinct cell, but a cell that's WRONG for
 * the coordinate you're on now could easily be the CORRECT answer for a
 * later coordinate in the same round — permanently locking a mis-tapped cell
 * would make that later step unsolvable. Only cells already correctly FOUND
 * this round are excluded from further taps (silent no-op on re-tap, exactly
 * like CaminoNumerico's already-found circles), since each is used once.
 *
 * The active target's column and row headers highlight (blue) as a
 * scaffolding aid — it points at the axes without revealing the cell itself,
 * teaching the row/column-intersection skill directly instead of trivializing
 * it. No timer, ever; wrong taps never turn red.
 *
 * Difficulty ramps by board size AND coordinate-list length together: Nivel 1
 * is a 4×4 board (A-D × 1-4) spelling a 3-letter word, Nivel 2 is 5×5 with 4
 * letters, Nivel 3 is 6×6 (A-F × 1-6) with 5 letters. ROUNDS_PER_LEVEL is
 * deliberately [2, 2, 2] — shorter than this app's usual [2, 3, 3] default —
 * because each "round" here is already a 3-5 tap sequence, not a single tap;
 * three rounds at the top levels would make one level unreasonably long.
 * Puzzle data (in-bounds, no duplicate coordinate within a word) was verified
 * with a throwaway Node script before writing this component, same
 * discipline as Encaminada/DondeEsta/LaPiramide's hand-authored pools.
 *
 * A one-time "¿Listo?" ready screen (same pattern as Encaminada) gates the
 * START of the day, not every round — moving the "how to play" sentence out
 * of the persistent header reclaims the space nivel 3 needs: a 6×6 board
 * PLUS a target-coordinate box AND a found-words strip, all stacked, pushed
 * mobile height at or over a 375×812 budget. `phase` flips to 'playing' once
 * and never resets — not on level-advance, not on "Repetir" — a replayer
 * already knows the rules. Unlike Encaminada's board, every cell here is a
 * real tap target (handleTap), so nivel 3's mobile grid cap is more
 * conservative than Encaminada's: only max-width shrinks (340px → 320px),
 * not the gap, keeping cells close to their un-shrunk ~44px instead of
 * trading away tap-target size for vertical space.
 */

interface Coord {
  row: number
  col: number
}
interface CoordWord {
  word: string
  /** coords[i] is the cell holding word[i] — any distinct cell, not
   * necessarily adjacent to its neighbours (unlike Encaminada's paths). */
  coords: Coord[]
}
interface Level {
  n: number
  name: string
  rows: number
  cols: number
  pool: CoordWord[]
}

// Shorter than the app-wide default [2, 3, 3] — see file header.
const ROUNDS_PER_LEVEL = [2, 2, 2]

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rows: 4,
    cols: 4, // columns A-D
    pool: [
      { word: 'SAL', coords: [{ row: 2, col: 1 }, { row: 0, col: 3 }, { row: 3, col: 0 }] },
      { word: 'LUZ', coords: [{ row: 1, col: 2 }, { row: 0, col: 0 }, { row: 3, col: 3 }] },
      { word: 'UVA', coords: [{ row: 0, col: 1 }, { row: 2, col: 3 }, { row: 3, col: 0 }] },
      { word: 'AJO', coords: [{ row: 3, col: 2 }, { row: 1, col: 0 }, { row: 0, col: 3 }] },
      { word: 'OSO', coords: [{ row: 3, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 0 }] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rows: 5,
    cols: 5, // columns A-E
    pool: [
      { word: 'VACA', coords: [{ row: 2, col: 0 }, { row: 0, col: 3 }, { row: 4, col: 1 }, { row: 1, col: 4 }] },
      { word: 'RANA', coords: [{ row: 0, col: 2 }, { row: 3, col: 0 }, { row: 4, col: 4 }, { row: 2, col: 2 }] },
      { word: 'LOBO', coords: [{ row: 1, col: 1 }, { row: 4, col: 0 }, { row: 0, col: 4 }, { row: 3, col: 3 }] },
      { word: 'PUMA', coords: [{ row: 4, col: 2 }, { row: 1, col: 0 }, { row: 3, col: 4 }, { row: 0, col: 1 }] },
      { word: 'SOPA', coords: [{ row: 2, col: 3 }, { row: 3, col: 1 }, { row: 2, col: 4 }, { row: 0, col: 0 }] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rows: 6,
    cols: 6, // columns A-F
    pool: [
      { word: 'RADIO', coords: [{ row: 3, col: 0 }, { row: 0, col: 5 }, { row: 5, col: 2 }, { row: 2, col: 4 }, { row: 4, col: 1 }] },
      { word: 'DULCE', coords: [{ row: 1, col: 3 }, { row: 5, col: 0 }, { row: 3, col: 5 }, { row: 0, col: 2 }, { row: 4, col: 4 }] },
      { word: 'FUEGO', coords: [{ row: 0, col: 1 }, { row: 5, col: 4 }, { row: 2, col: 0 }, { row: 4, col: 5 }, { row: 3, col: 2 }] },
      { word: 'MUNDO', coords: [{ row: 5, col: 3 }, { row: 2, col: 1 }, { row: 1, col: 5 }, { row: 0, col: 0 }, { row: 3, col: 4 }] },
      { word: 'NIETA', coords: [{ row: 2, col: 2 }, { row: 5, col: 5 }, { row: 5, col: 1 }, { row: 0, col: 4 }, { row: 4, col: 0 }] },
    ],
  },
]

const COLS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function coordKey(c: Coord): string {
  return `${c.row}-${c.col}`
}
function coordLabel(c: Coord): string {
  return `${COLS_LETTERS[c.col]}${c.row + 1}`
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

function buildBoard(entry: CoordWord, rows: number, cols: number): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => FILLER_LETTERS[Math.floor(Math.random() * FILLER_LETTERS.length)]),
  )
  entry.coords.forEach((c, i) => {
    grid[c.row][c.col] = entry.word[i]
  })
  return grid
}

const HINTS = [
  'Esa celda no es — mirá la columna y la fila marcadas arriba y al costado.',
  'Casi. Contá la columna y después la fila, y buscá donde se cruzan.',
  'No es esa. Fijate bien en la letra de la columna y el número de la fila.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente ubicación!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena orientación!']

export function Coordenadas({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which words (and in what order) are playing for level i THIS "epoch" (a
  // full 3-level pass). Decided once per epoch — at mount, and again on
  // "Hacer otro" — never re-rolled just because the player re-visits a
  // level, so "Repetir" can hand back the exact same words deterministically
  // instead of re-randomizing.
  const [epochOrder] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= roundsForLevel
  const current = order[roundIdx] as CoordWord | undefined

  const board = useMemo(
    () => (current ? buildBoard(current, level.rows, level.cols) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current],
  )

  // How many coordinates of `current` have been correctly found, IN ORDER —
  // single source of truth, mirrors CaminoNumerico's foundCount exactly.
  const [foundCount, setFoundCount] = useState(0)
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  // Picked once per wrong tap and held in state (not re-rolled via pickOne()
  // inline in JSX, which would change the message on every unrelated
  // re-render for as long as wrongKey stays set).
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Mistakes + successful coordinate finds, accumulated across levels 1→2→3
  // and only zeroed on a genuine day restart (wrap from level 3 back to
  // level 1) — same policy as every other multi-level game in this folder.
  const [mistakes, setMistakes] = useState(0)
  const [totalFound, setTotalFound] = useState(0)

  const wordComplete = current ? foundCount >= current.coords.length : false
  const targetCell = current && !wordComplete ? current.coords[foundCount] : undefined

  const foundCellKeys = useMemo(
    () => new Set(current ? current.coords.slice(0, foundCount).map(coordKey) : []),
    [current, foundCount],
  )

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function handleTap(cell: Coord) {
    if (!current || done || wordComplete) return
    const key = coordKey(cell)
    if (foundCellKeys.has(key)) return // already found this round — silent no-op (mirrors CaminoNumerico)
    const target = current.coords[foundCount]
    if (target.row === cell.row && target.col === cell.col) {
      const nextCount = foundCount + 1
      setFoundCount(nextCount)
      setTotalFound((n) => n + 1)
      setWrongKey(null)
      setHint(null)
      if (nextCount >= current.coords.length) {
        // Word complete — brief celebratory pause (word strip fully lit)
        // before moving to the next round, same timing convention as
        // DondeEsta/ClaveDeSimbolos's advance().
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
      // LATER coordinate in this same round).
      setWrongKey(key)
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
      // wrongKey only clears if it's still THIS tap's key (a newer wrong tap
      // may have replaced it); hint clears unconditionally on a timeout —
      // same asymmetry CaminoNumerico's wrongValue/wrongHint pair uses.
      window.setTimeout(() => {
        setWrongKey((w) => (w === key ? null : w))
        setHint(null)
      }, 900)
    }
  }

  // Synchronous resets happen HERE, in the same handler that changes
  // levelIdx/roundKey — not in a separate effect keyed on them, which would
  // let the onComplete effect below read a stale `done` on the render that
  // just arrived at the new level (the bug already fixed in CaminoNumerico/
  // CazadorDeLetras/ClaveDeSimbolos).

  // "Siguiente nivel" — advance within the SAME epoch. epochOrder is left
  // alone: level i+1's drawn words were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setFoundCount(0)
    setWrongKey(null)
    setHint(null)
  }

  // Shared by both restart buttons on the final level's complete card.
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
  // (the wrap to level 1) gets a new roundKey via restartEpoch, so a genuine
  // replay of the whole day reports again; re-rendering while still done on
  // level 3 does not fire twice. totalAttempts uses totalFound (every
  // coordinate found across the whole day) rather than a fixed round count,
  // for the same fine-grained accuracy reasoning as CazadorDeLetras/
  // ClaveDeSimbolos.
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
          Encaminada, no se repite en cada ronda (a diferencia del gate
          por-ronda de RepetiLaSerie). Ver el comentario del encabezado del
          archivo: esto es lo que libera el alto que nivel 3 necesita. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Grid3x3 className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Tocá la celda que corresponde a cada coordenada, en orden.
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
          {/* Target coordinate */}
          {targetCell && (
            <div className="mx-auto mt-3 flex flex-col items-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Tocá la celda</p>
              <div className="mt-1 flex h-14 w-20 items-center justify-center rounded-2xl border-2 border-tiam-blue bg-tiam-blue/5 text-2xl font-black text-tiam-blue">
                {coordLabel(targetCell)}
              </div>
            </div>
          )}
          {wordComplete && <p className="mt-3 text-center text-lg font-bold text-tiam-green">¡Formaste {current.word}!</p>}

          {/* Found-so-far word strip */}
          <div className="mx-auto mt-3 flex justify-center gap-1.5">
            {current.word.split('').map((letter, i) => (
              <div
                key={i}
                className={[
                  'flex h-10 w-9 items-center justify-center rounded-lg border-2 text-lg font-extrabold',
                  i < foundCount ? 'border-tiam-green bg-tiam-green/5 text-tiam-green' : 'border-slate-200 bg-slate-50 text-slate-300',
                ].join(' ')}
              >
                {i < foundCount ? letter : ''}
              </div>
            ))}
          </div>

          {/* Coordinate board — header row (column letters) + header column
              (row numbers) + body cells, all in one CSS grid. Unlike
              Encaminada's board, every body cell here is a real tap target
              (handleTap) — same technique as Encaminada (level-aware mobile
              cap), but more conservative: only max-width shrinks for nivel
              3's 6×6 grid (340px → 320px), the gap stays put, so cells go
              from ~44px to ~42px instead of being squeezed further. */}
          <div
            className={
              level.cols >= 6
                ? 'mx-auto mt-3 grid aspect-square w-full max-w-[320px] gap-1 sm:max-w-[340px] sm:gap-1.5'
                : 'mx-auto mt-3 grid aspect-square w-full max-w-[340px] gap-1 sm:max-w-[340px] sm:gap-1.5'
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
                      className={`flex items-center justify-center text-sm font-bold sm:text-base ${isActive ? 'text-tiam-blue' : 'text-slate-400'}`}
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
                      className={`flex items-center justify-center text-sm font-bold sm:text-base ${isActive ? 'text-tiam-blue' : 'text-slate-400'}`}
                    >
                      {r + 1}
                    </div>
                  )
                }
                const key = coordKey({ row: r, col: c })
                const isFound = foundCellKeys.has(key)
                const isWrong = wrongKey === key
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={done || wordComplete}
                    onClick={() => handleTap({ row: r, col: c })}
                    aria-label={`Celda ${coordLabel({ row: r, col: c })}`}
                    className={[
                      'relative flex items-center justify-center rounded-lg border-2 bg-white text-base font-extrabold transition',
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
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                        <Check className="h-3 w-3" strokeWidth={3} />
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
            Encontraste las {roundsForLevel} palabras — completaste el {levelName.toLowerCase()}.
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
