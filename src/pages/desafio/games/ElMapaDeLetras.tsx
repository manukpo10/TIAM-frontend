import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Compass, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El Mapa de Letras" — día 27, orientación. Same coordinate-decoding
 * mechanic as Coordenadas.tsx (día 27, Mes 2, this file's authoritative
 * template): a lettered-column / numbered-row grid — a map legend, a
 * spreadsheet, a bingo card — holds one letter per cell; the player is shown
 * ONE target coordinate at a time (e.g. "C4") and taps the matching cell.
 * The letters found, in order, spell a word. This file's grid dimensions and
 * word-length ramp (3→4→5 letters, 4×4→5×5→6×6 board) are copied 1:1 from
 * Coordenadas.tsx on purpose — that file already worked out the mobile-
 * layout budget for this exact board shape (see below) — but every word,
 * coordinate, and the "mapa" framing itself is new content, distinct from
 * Coordenadas' own pool (verified against it with a throwaway script, see
 * below).
 *
 * Reveal is ONE coordinate at a time (not a full list upfront) — lighter on
 * working memory per step, same reasoning as Coordenadas. Validation is a
 * plain exact-cell match; the built word is a celebratory payoff once the
 * round's coordinates are all found, not a separate graded step.
 *
 * IMPORTANT gotcha inherited from Coordenadas: a wrong tap is a TEMPORARY
 * flash only (auto-clearing on a timeout), never a permanent per-cell
 * disable — a cell that's wrong for the CURRENT target coordinate can easily
 * be the correct answer for a LATER coordinate in the same round. Only
 * cells already correctly found this round are excluded from further taps
 * (silent no-op on re-tap). No timer, ever; wrong taps never turn red.
 *
 * The active target's column and row headers highlight (blue) as a
 * scaffolding aid, same as Coordenadas — it points at the axes without
 * revealing the cell itself, teaching the row/column-intersection skill
 * directly instead of trivializing it.
 *
 * Difficulty ramps by board size AND word length together, identical to
 * Coordenadas: Nivel 1 is 4×4 (A-D × 1-4) spelling a 3-letter word, Nivel 2
 * is 5×5 (A-E × 1-5) with 4 letters, Nivel 3 is 6×6 (A-F × 1-6) with 5
 * letters. ROUNDS_PER_LEVEL is [2, 2, 2], matching Coordenadas — each
 * "round" here is already a 3-5 tap sequence, not a single tap, so 3 rounds
 * at the top levels would make one level unreasonably long. Each level's
 * pool has 5 words (only 2 drawn per playthrough, shuffled), leaving room
 * for "Hacer otro" to hand back a genuinely different pair. Puzzle data
 * (in-bounds, no duplicate coordinate within a word, no word reused from
 * Coordenadas' own pool) was verified with a throwaway Node script before
 * writing this component — same discipline Coordenadas/Encaminada/
 * DondeEsta/LaPiramide's own hand-authored pools describe using.
 *
 * Words are warm, everyday/nature/family nouns (PAN, HOGAR, MANOS, TARDE...)
 * — deliberately different territory from Coordenadas' own pool (SAL, VACA,
 * RADIO...), per the brief; nothing sad or patronizing.
 *
 * A one-time "¿Listo?" ready screen (same pattern as Coordenadas/Encaminada)
 * gates the START of the day, not every round — moving the "how to play"
 * sentence out of the persistent header reclaims the space Nivel 3 needs: a
 * 6×6 board PLUS a target-coordinate box AND a found-word strip, all
 * stacked, sits right at a 375×812 mobile budget. `phase` flips to
 * 'playing' once and never resets — not on level-advance, not on "Repetir"
 * or "Hacer otro" — a replayer already knows the rules. Every body cell is a
 * real tap target (handleTap), so Nivel 3's mobile grid cap (340px → 320px,
 * max-width only, gap left untouched) is copied from Coordenadas — the same
 * board shape needs the same fix, and shrinking the gap instead would have
 * pushed real `<button>` cells below the ~44px minimum tap target.
 *
 * NOTE for future maintainers: Coordenadas.tsx's own header comment
 * describes an epoch/"Hacer otro" design (re-roll the pool on demand so a
 * replay can differ from the attempt just finished) but its shipped code
 * only wires up "Repetir" — no "Hacer otro" button, no `setEpochOrder` call
 * (epochOrder there is a plain `useState` initializer, never updated). The
 * pool-of-5-draw-2 shape strongly suggests "Hacer otro" was the original
 * intent. This file implements both buttons, using Encaminada.tsx's
 * restartSame/restartDifferent split (which already demonstrates the exact
 * pattern Coordenadas' own comment describes) layered on Coordenadas'
 * epochOrder/restartEpoch machinery.
 */

interface Coord {
  row: number
  col: number
}
interface CoordWord {
  word: string
  /** coords[i] is the cell holding word[i] — any distinct cell, not
   * necessarily adjacent to its neighbours (unlike a path-following game). */
  coords: Coord[]
}
interface Level {
  n: number
  name: string
  rows: number
  cols: number
  pool: CoordWord[]
}

// Matches Coordenadas.tsx's own ramp — see file header for why.
const ROUNDS_PER_LEVEL = [2, 2, 2]

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rows: 4,
    cols: 4, // columnas A-D
    pool: [
      { word: 'PAN', coords: [{ row: 1, col: 0 }, { row: 0, col: 3 }, { row: 3, col: 2 }] },
      { word: 'SOL', coords: [{ row: 2, col: 1 }, { row: 0, col: 0 }, { row: 3, col: 3 }] },
      { word: 'MAR', coords: [{ row: 1, col: 3 }, { row: 3, col: 0 }, { row: 0, col: 2 }] },
      { word: 'AVE', coords: [{ row: 0, col: 1 }, { row: 2, col: 3 }, { row: 3, col: 1 }] },
      { word: 'ALA', coords: [{ row: 2, col: 0 }, { row: 1, col: 2 }, { row: 3, col: 3 }] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rows: 5,
    cols: 5, // columnas A-E
    pool: [
      { word: 'NIDO', coords: [{ row: 0, col: 0 }, { row: 2, col: 4 }, { row: 4, col: 1 }, { row: 1, col: 3 }] },
      { word: 'HOJA', coords: [{ row: 3, col: 0 }, { row: 0, col: 2 }, { row: 4, col: 4 }, { row: 1, col: 1 }] },
      { word: 'TAZA', coords: [{ row: 0, col: 4 }, { row: 3, col: 2 }, { row: 1, col: 0 }, { row: 4, col: 3 }] },
      { word: 'ROPA', coords: [{ row: 2, col: 0 }, { row: 4, col: 2 }, { row: 0, col: 3 }, { row: 3, col: 4 }] },
      { word: 'NUBE', coords: [{ row: 1, col: 2 }, { row: 4, col: 0 }, { row: 2, col: 3 }, { row: 0, col: 1 }] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rows: 6,
    cols: 6, // columnas A-F
    pool: [
      { word: 'HOGAR', coords: [{ row: 2, col: 0 }, { row: 0, col: 4 }, { row: 4, col: 2 }, { row: 1, col: 5 }, { row: 5, col: 1 }] },
      { word: 'MANTA', coords: [{ row: 0, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 0 }, { row: 1, col: 3 }, { row: 4, col: 4 }] },
      { word: 'MANOS', coords: [{ row: 5, col: 3 }, { row: 2, col: 1 }, { row: 0, col: 5 }, { row: 3, col: 0 }, { row: 4, col: 4 }] },
      { word: 'TARDE', coords: [{ row: 1, col: 0 }, { row: 4, col: 5 }, { row: 0, col: 2 }, { row: 5, col: 4 }, { row: 2, col: 3 }] },
      { word: 'RAMAS', coords: [{ row: 0, col: 0 }, { row: 3, col: 4 }, { row: 5, col: 2 }, { row: 1, col: 5 }, { row: 4, col: 1 }] },
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
  'Todavía no — mirá qué columna y qué fila están marcadas arriba.',
  'Esa celda no es. Contá los casilleros desde el borde: primero la columna, después la fila.',
  'Casi. Buscá dónde se cruzan la columna y la fila marcadas.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente trabajo!', '¡Así se hace!', '¡Qué buen ojo!', '¡Genial!']

export function ElMapaDeLetras({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which words (and in what order) are playing for level i THIS "epoch" (a
  // full 3-level pass). Decided once per epoch — at mount, and again on
  // "Hacer otro" (see restartDifferent) — never re-rolled just because the
  // player re-visits a level, so "Repetir" can hand back the exact same
  // words deterministically instead of re-randomizing.
  const [epochOrder, setEpochOrder] = useState(() =>
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
  // single source of truth, mirrors Coordenadas' foundCount exactly.
  const [foundCount, setFoundCount] = useState(0)
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  // Picked once per wrong tap and held in state (not re-rolled via pickOne()
  // inline in JSX, which would change the message on every unrelated
  // re-render for as long as wrongKey stays set).
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Mistakes + successful coordinate finds, accumulated across levels 1→2→3
  // and only zeroed on a genuine day restart ("Repetir"/"Hacer otro" on the
  // level-3 complete screen) — same policy as every other multi-level game
  // in this folder.
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
    if (foundCellKeys.has(key)) return // ya encontrada esta ronda — no-op silencioso
    const target = current.coords[foundCount]
    if (target.row === cell.row && target.col === cell.col) {
      const nextCount = foundCount + 1
      setFoundCount(nextCount)
      setTotalFound((n) => n + 1)
      setWrongKey(null)
      setHint(null)
      if (nextCount >= current.coords.length) {
        // Palabra completa — pausa breve celebratoria (tira de letras
        // totalmente iluminada) antes de pasar a la siguiente ronda, mismo
        // criterio de tiempos que Coordenadas.
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setFoundCount(0)
          setWrongKey(null)
          setHint(null)
        }, 1200)
      }
    } else {
      // Flash TEMPORAL únicamente — nunca deshabilita la celda de forma
      // permanente (ver gotcha en el encabezado del archivo: esta misma
      // celda puede ser la respuesta correcta de una coordenada POSTERIOR
      // de esta misma ronda).
      setWrongKey(key)
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
      window.setTimeout(() => {
        setWrongKey((w) => (w === key ? null : w))
        setHint(null)
      }, 900)
    }
  }

  // Los resets sincrónicos van ACÁ, en el mismo handler que cambia
  // levelIdx/roundKey — no en un efecto separado dependiente de ellos, lo
  // que dejaría al efecto de onComplete leer un `done` desactualizado justo
  // en el render que llega al nuevo nivel (mismo bug ya resuelto en
  // CaminoNumerico/CazadorDeLetras/ClaveDeSimbolos/Coordenadas).

  // "Siguiente nivel" — avanza dentro de LA MISMA epoch. epochOrder no se
  // toca: las palabras del nivel i+1 ya se decidieron al empezar esta epoch.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setFoundCount(0)
    setWrongKey(null)
    setHint(null)
  }

  // Compartido por ambos botones de reinicio de la tarjeta final de nivel 3.
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
  // "Repetir" — las mismas palabras, en el mismo orden, que el intento recién terminado.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — un nuevo sorteo de palabras por nivel (ver nota del
  // encabezado del archivo sobre por qué este botón sí está acá).
  function restartDifferent() {
    restartEpoch()
    setEpochOrder(LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])))
  }

  // Se dispara una vez por roundKey cuando se completa el nivel 3. Un
  // reinicio genuino del día (Repetir o Hacer otro) obtiene un roundKey
  // nuevo vía restartEpoch, así que una repetición real del día vuelve a
  // reportar; re-renderizar mientras se sigue "done" en nivel 3 no dispara
  // dos veces. totalAttempts usa totalFound (cada coordenada encontrada en
  // todo el día) en vez de una cuenta fija de rondas, mismo criterio de
  // precisión fina que Coordenadas.
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
          Coordenadas.tsx, no se repite en cada ronda. Ver el comentario del
          encabezado del archivo: esto es lo que libera el alto que nivel 3
          necesita. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Compass className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Tocá la celda que corresponde a cada coordenada del mapa, en el orden en que aparecen, para descubrir la
            palabra escondida.
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
          {/* Coordenada objetivo */}
          {targetCell && (
            <div className="mx-auto mt-3 flex flex-col items-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Tocá esta celda</p>
              <div className="mt-1 flex h-14 w-20 items-center justify-center rounded-2xl border-2 border-tiam-blue bg-tiam-blue/5 text-2xl font-black text-tiam-blue">
                {coordLabel(targetCell)}
              </div>
            </div>
          )}
          {wordComplete && <p className="mt-3 text-center text-lg font-bold text-tiam-green">¡Descubriste {current.word}!</p>}

          {/* Tira de la palabra encontrada hasta ahora */}
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

          {/* Mapa de coordenadas — fila de encabezado (letras de columna) +
              columna de encabezado (números de fila) + celdas, todo en una
              sola grilla CSS. Cada celda del cuerpo es un tap target real
              (handleTap), igual que Coordenadas.tsx — el cap móvil de nivel
              3 (6×6) es el mismo por diseño: sólo se achica el max-width
              (340px → 320px), el gap queda igual, para que las celdas se
              mantengan cerca de su tamaño real (~44px) en vez de sacrificar
              tap-target por espacio vertical. */}
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
            Encontraste las {roundsForLevel} palabras del mapa — completaste el {levelName.toLowerCase()}.
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
