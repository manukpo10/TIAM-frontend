import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Eraser, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La pirámide de letras" — día 23, mes 5, lenguaje. A pyramid of three words in
 * which every row is the row above WITH ONE MORE LETTER (the letters may change
 * places): DO → DOS → SODA, MI → MIL → MIEL. Every row has a clue and its length
 * (the empty boxes plus "3 letras" in words); the letters of the word, scrambled,
 * wait in a small bank: tap them in order to build the word, tap a letter you
 * already put to take it back. The row above stays on screen the whole time, so
 * the player can see which letters are already there and which one is new. Same
 * family as Palabras desordenadas (día 19), with what makes this one its own: a
 * chain of words that grow, instead of a list of words of a category.
 *
 * The check runs when the last box fills, by comparing the SPELLED string with the
 * word (never tile identity, so a repeated letter can go in either of its tiles). A
 * wrong word keeps its letters in place (muted gray, never red), costs ONE mistake
 * and says so gently; from the second miss on the same row, the hint names the
 * letter that is added to the row above, and from the third it gives the first
 * letter. Some rows can be spelled with the same letters as ANOTHER real word
 * (LOBA / BOLA, TEMA / META / MATE, and BOLAS, the plural of the row above BOLSA and
 * the first thing a player types there): those words are listed on the row (`alts`)
 * and answering one says that it IS a word but not the one the clue asks for. They
 * also count as the one mistake, and the scramble can never show one of them already
 * built. "Sacar las letras" empties the boxes. A right row turns green and, after a
 * short pause (the only timer in the game), the next one comes. Nothing is timed
 * otherwise.
 *
 * Every tile keeps its place in the bank (a used tile leaves a ghost behind), so
 * nothing slides under a finger; and a second tap on a box within a moment is a
 * double tap, not a second removal.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by
 * the click's own timeStamp) is ignored, so the second tap of a double tap on "Empezar",
 * "Siguiente nivel" or "Repetir" never puts a letter in the first box (the bank sits
 * right where that button was); while a right row shows its green letters every tile is
 * off, which swallows a double tap on the RIGHT one before the next row replaces it. A
 * new level opens at its top, and the solved card is scrolled into view, and so is its
 * button, on a short phone (the clue and the bank give their room to the card).
 *
 * Ramp: rows of 2-3-4 letters → 3-4-5 → 4-5-6 (three rows each, so the day stays
 * short). Each level has two authored pyramids and ONE is picked at mount (`epoch`),
 * together with EVERY SCRAMBLE, so "Repetir" replays exactly the same three
 * pyramids with exactly the same scrambled letters. Per-level state lives in
 * <LevelView>, keyed by run + level. A short "¿Cómo se juega?" screen (two steps and
 * a worked example, AL → SAL → SALA, its button pinned to the bottom edge) opens the
 * day; "Repetir" never brings it back. A
 * throwaway Node script (not committed) checks
 * every row (each one has exactly one more letter than the row above: a multiset
 * test, no word inside its own clue, the alts are real rearrangements of the word,
 * no word repeats anywhere in the day) and draws the scrambler thousands of times
 * per row: never the word itself, never an alt, always the same letters.
 *
 * totalAttempts = mistakes + every row of the day (TOTAL_ROWS, derived).
 */

// ── data:start ──
interface RowDef {
  /** Plain A-Z, no accent: these are the tiles. */
  word: string
  /** One sentence, never containing the word. */
  clue: string
  /** Other real words that use exactly the same letters (never the word itself), written like the tiles, with no accent. */
  alts?: string[]
}
interface PyramidDef {
  /** Three rows, each one letter longer than the one above and containing all of its letters. */
  rows: RowDef[]
}
interface LevelDef {
  name: string
  pyramids: PyramidDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    pyramids: [
      {
        rows: [
          { word: 'DO', clue: 'La primera nota musical, la que viene antes del «re».' },
          { word: 'DOS', clue: 'El número que viene justo después del uno.' },
          { word: 'SODA', clue: 'Agua con burbujas que sale del sifón.', alts: ['ODAS'] },
        ],
      },
      {
        rows: [
          { word: 'MI', clue: 'La nota musical que viene justo después del «re».' },
          { word: 'MIL', clue: 'Diez veces cien.' },
          { word: 'MIEL', clue: 'Dulce y espesa, la hacen las abejas.' },
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    pyramids: [
      {
        rows: [
          { word: 'PAN', clue: 'Alimento que se hornea; se come con manteca o dulce de leche.' },
          { word: 'PLAN', clue: 'Lo que armás antes de salir de paseo: qué hacer y a qué hora.' },
          { word: 'PLANO', clue: 'El dibujo de una casa, hecho a escala, que sigue el albañil.', alts: ['NOPAL', 'LAPON'] },
        ],
      },
      {
        rows: [
          { word: 'OLA', clue: 'Sube y baja en el mar y rompe en la orilla.', alts: ['LOA'] },
          { word: 'BOLA', clue: 'Una cosa redonda, como la de billar o la de nieve.', alts: ['LOBA', 'ALBO'] },
          { word: 'BOLSA', clue: 'La llevás al mercado para meter las compras.', alts: ['LOBAS', 'BALSO', 'BOLAS', 'ALBOS'] },
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    pyramids: [
      {
        rows: [
          { word: 'CARA', clue: 'La parte de adelante de la cabeza, con ojos, nariz y boca.', alts: ['ARCA'] },
          { word: 'CARTA', clue: 'Se escribe en una hoja, va en un sobre y llega por correo.', alts: ['CATAR', 'TRACA'] },
          { word: 'CARETA', clue: 'Se usa en carnaval para taparse el rostro.', alts: ['CATEAR', 'CARATE'] },
        ],
      },
      {
        rows: [
          { word: 'MATE', clue: 'Infusión que se toma en rueda, con bombilla y yerba.', alts: ['META', 'TEMA'] },
          { word: 'MARTE', clue: 'El planeta rojo.', alts: ['TREMA', 'TERMA'] },
          { word: 'MARTES', clue: 'El día de la semana que viene después del lunes.', alts: ['TERMAS', 'TREMAS', 'MASTER'] },
        ],
      },
    ],
  },
]

// Every pyramid of a level has three rows, so TOTAL_ROWS never depends on which one is drawn.
const TOTAL_ROWS = LEVELS.reduce((sum, lvl) => sum + lvl.pyramids[0].rows.length, 0)

interface Tile {
  id: number
  value: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** How many letters of a scramble may still sit where they belong (so it never looks half solved). */
const maxInPlace = (length: number) => Math.floor(length / 3)

/** The letters of a word in a random order: never the word or one of its alts, and at most a third of them in place. */
function scrambleToTiles(row: RowDef): Tile[] {
  const { word } = row
  const avoid = [word, ...(row.alts ?? [])]
  const letters = word.split('')
  const inPlace = (arr: string[]) => arr.filter((ch, i) => ch === word[i]).length
  const unusable = (arr: string[]) => avoid.includes(arr.join(''))
  let best = shuffle(letters)
  for (let tries = 0; tries < 300 && (unusable(best) || inPlace(best) > maxInPlace(word.length)); tries++) best = shuffle(letters)
  // A rotation by one only reproduces the word when every letter is the same.
  if (unusable(best)) best = [...letters.slice(1), letters[0]]
  return best.map((value, id) => ({ id, value }))
}

/** Index, inside `word`, of the letter that `word` has and the row above `prev` does not (the first one found left to right). */
function newLetterIndex(prev: string, word: string): number {
  const available: Record<string, number> = {}
  for (const ch of prev) available[ch] = (available[ch] ?? 0) + 1
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]
    if (available[ch]) available[ch]--
    else return i
  }
  return -1
}
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface PreparedRow extends RowDef {
  /** The scramble, frozen for the whole mount. */
  tiles: Tile[]
  /** Index of the new letter inside the word (-1 for the first row). */
  newIndex: number
}
interface PreparedLevel {
  rows: PreparedRow[]
}

function buildEpoch(): PreparedLevel[] {
  return LEVELS.map((lvl) => {
    const pyramid = pickOne(lvl.pyramids)
    return {
      rows: pyramid.rows.map((row, i) => ({
        ...row,
        tiles: scrambleToTiles(row),
        newIndex: i === 0 ? -1 : newLetterIndex(pyramid.rows[i - 1].word, row.word),
      })),
    }
  })
}

const PRAISE_ROW = ['¡Esa es!', '¡Muy bien!', '¡Exacto!', '¡Así se hace!']
const PRAISE_LEVEL = ['¡Excelente trabajo!', '¡Qué buen manejo de las palabras!', '¡Subiste toda la pirámide!']
const NUDGES = [
  'Todavía no. Mirá la pista y probá con otro orden.',
  'Casi. Tocá una letra de arriba para sacarla y cambiarla.',
  'Esa no es. Fijate bien en la pista y volvé a intentar.',
]
const START_HINT = 'Tocá las letras de abajo, en orden. Para sacar una, tocala arriba.'
/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel", "Repetir") is the
 * second tap of a double tap and it must not act on what sits where that button was; the same window keeps a
 * second tap on the same box from being a second removal. Long enough to swallow a double tap, short enough
 * that nobody who means it notices. */
const SETTLE_MS = 400
/** The pause after a right row before the next one; taps are ignored while it runs. */
const ADVANCE_MS = 1300

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a small worked example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'Cada fila es una palabra: la de arriba con UNA letra más.',
    'Leé la pista y tocá las letras de abajo, en orden, para armarla.',
  ]
  // AL → SAL → SALA, with the letter each row adds marked (a different example from the ones of the game).
  const example = [
    { word: 'AL', added: -1 },
    { word: 'SAL', added: 0 },
    { word: 'SALA', added: 3 },
  ]
  return (
    <div className="mt-4 rounded-3xl border border-green-700/20 bg-tiam-green/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <div className="flex flex-col items-center gap-1" aria-hidden="true">
          {example.map((row) => (
            <div key={row.word} className="flex justify-center gap-1">
              {row.word.split('').map((letter, b) => (
                <span
                  key={b}
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-md border-2 text-base font-bold text-slate-900',
                    b === row.added ? 'border-amber-400 bg-amber-100' : 'border-tiam-green/60 bg-tiam-green/10',
                  ].join(' ')}
                >
                  {letter}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-base text-slate-700">Cada fila suma una letra, la que queda marcada.</p>
      </div>
      {/* Pinned to the bottom edge when the screen is too short to show it in place (320x640). */}
      <div className="sticky bottom-3 z-10 mt-4 text-center">
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

interface LevelViewProps {
  levelIdx: number
  content: PreparedLevel
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

  const [rowIdx, setRowIdx] = useState(0)
  // Tile ids in the order they sit in the boxes.
  const [placed, setPlaced] = useState<number[]>([])
  const [rowMisses, setRowMisses] = useState(0)
  const [outcome, setOutcome] = useState<'idle' | 'wrong' | 'right'>('idle')
  const [hint, setHint] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE_LEVEL[0])
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const lastBoxRef = useRef<{ index: number; at: number }>({ index: -1, at: -999999 })
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

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

  // On a 320px phone a six-letter row wraps both its boxes and its tiles, and the hint plus "Sacar las
  // letras" end up below the fold: when a full row is judged, scroll the least needed to show them.
  // (nearest: nothing moves when they are already visible, which is the case on every wider phone.)
  // It waits out SETTLE_MS so that the second tap of a double tap on the last letter still finds the
  // screen where it was, and it gives up if the player takes a letter out first.
  useEffect(() => {
    if (outcome === 'idle') return
    const id = window.setTimeout(() => feedbackRef.current?.scrollIntoView({ block: 'nearest' }), SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [outcome, rowMisses])

  const current = rows[rowIdx]
  const above = rowIdx > 0 ? rows[rowIdx - 1].word : null
  const tileById = (id: number) => current.tiles.find((t) => t.id === id) as Tile
  const placedIds = new Set(placed)
  const solved = outcome === 'right'
  const full = placed.length === current.word.length

  function placeTile(tile: Tile, at: number) {
    // The second tap of a double tap on the button that brought the level puts nothing in the first box.
    if (solved || full || placedIds.has(tile.id) || at - since < SETTLE_MS) return
    const next = [...placed, tile.id]
    setPlaced(next)
    if (next.length < current.word.length) {
      setOutcome('idle')
      setHint(null)
      return
    }
    const attempt = next.map((id) => tileById(id).value).join('')
    if (attempt === current.word) {
      setOutcome('right')
      setHint(null)
      advanceTimerRef.current = window.setTimeout(() => {
        if (rowIdx < rows.length - 1) {
          setRowIdx((i) => i + 1)
          setPlaced([])
          setOutcome('idle')
          setRowMisses(0)
          setHint(null)
        } else {
          setPraise(pickOne(PRAISE_LEVEL))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    // Wrong word: the letters STAY, so the player can see the attempt and fix the one that is off.
    const misses = rowMisses + 1
    setRowMisses(misses)
    setOutcome('wrong')
    if (current.alts?.includes(attempt)) {
      setHint(`«${attempt}» también es una palabra, pero la pista habla de otra. Probá con otro orden.`)
    } else if (misses >= 3) {
      setHint(`Casi. Esta palabra empieza con la letra ${current.word[0]}.`)
    } else if (misses === 2 && above !== null) {
      setHint(`Casi. La letra que se suma a «${above}» es la ${current.word[current.newIndex]}.`)
    } else if (misses === 2) {
      setHint(`Casi. Esta palabra empieza con la letra ${current.word[0]}.`)
    } else {
      setHint(pickOne(NUDGES))
    }
    onMistake()
  }

  function removeAt(index: number, at: number) {
    if (solved) return
    const last = lastBoxRef.current
    lastBoxRef.current = { index, at }
    if (last.index === index && at - last.at < SETTLE_MS) return
    setPlaced((p) => p.filter((_, i) => i !== index))
    setOutcome('idle')
    setHint(null)
  }

  function clearAll() {
    if (solved) return
    setPlaced([])
    setOutcome('idle')
    setHint(null)
  }

  /** One row of the pyramid: done rows in green (the new letter marked), the current one with its boxes, the rest still empty. */
  function renderRow(row: PreparedRow, i: number) {
    const letters = row.word.split('')
    const isCurrent = i === rowIdx && !done
    const isDone = i < rowIdx || done || (i === rowIdx && solved)
    if (isCurrent && !solved) {
      return (
        <div
          key={i}
          className="flex flex-wrap justify-center gap-1"
          role="group"
          aria-label={`Fila de ${letters.length} letras, la que estás armando`}
        >
          {letters.map((_, b) => {
            const id = placed[b]
            if (id === undefined) {
              return (
                <span
                  key={b}
                  aria-hidden="true"
                  className="h-11 w-11 rounded-lg border-2 border-green-700/30 bg-white"
                />
              )
            }
            const letter = tileById(id).value
            return (
              <button
                key={b}
                type="button"
                onClick={(e) => removeAt(b, e.timeStamp)}
                aria-label={`Letra ${letter}, tocá para sacarla`}
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-lg border-2 text-xl font-bold transition',
                  'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  outcome === 'wrong'
                    ? 'border-slate-300 bg-slate-100 text-slate-500'
                    : 'border-amber-300 bg-amber-50 text-slate-900 hover:-translate-y-0.5',
                ].join(' ')}
              >
                {letter}
              </button>
            )
          })}
        </div>
      )
    }
    return (
      <div
        key={i}
        className="flex justify-center gap-1"
        role="group"
        aria-label={isDone ? `Fila resuelta: ${row.word}` : `Fila de ${letters.length} letras, todavía vacía`}
      >
        {letters.map((letter, b) =>
          isDone ? (
            <span
              key={b}
              className={[
                'flex h-9 w-9 items-center justify-center rounded-md border-2 text-lg font-bold',
                b === row.newIndex
                  ? 'border-amber-400 bg-amber-100 text-slate-900'
                  : 'border-tiam-green/60 bg-tiam-green/10 text-slate-900',
              ].join(' ')}
            >
              {letter}
            </span>
          ) : (
            <span key={b} aria-hidden="true" className="h-9 w-9 rounded-md border-2 border-dashed border-slate-200 bg-slate-50" />
          ),
        )}
      </div>
    )
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Fila {rowIdx + 1} de {rows.length}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* Clue + length: what a row needs */}
          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-green-700/20 bg-tiam-green/5 px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">Pista</p>
            <p className="mt-0.5 text-lg font-semibold leading-snug text-slate-800">{current.clue}</p>
            <p className="mt-1 text-base font-bold text-slate-600">
              {current.word.length} letras
              {above !== null && (
                <span className="font-semibold text-slate-500">
                  {' '}
                  · es «{above}» con una letra más
                </span>
              )}
            </p>
          </div>
        </>
      )}

      {/* The pyramid: it grows by one letter per floor, and stays on screen once solved */}
      <div className="mt-3 flex flex-col items-center gap-1.5" role="group" aria-label="Pirámide de palabras">
        {rows.map((row, i) => renderRow(row, i))}
      </div>

      {!done && (
        <>
          {/* The scrambled letters: every tile keeps its place, a used one leaves a ghost */}
          <div className="mt-4 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Letras desordenadas">
            {current.tiles.map((tile) => {
              const used = placedIds.has(tile.id)
              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={used || solved || full}
                  onClick={(e) => placeTile(tile, e.timeStamp)}
                  aria-label={used ? `Letra ${tile.value}, ya puesta` : `Letra ${tile.value}`}
                  className={[
                    'flex h-11 w-11 items-center justify-center rounded-lg border-2 text-xl font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    used
                      ? 'border-dashed border-slate-200 text-transparent'
                      : 'border-amber-300 bg-amber-50 text-slate-900 shadow-[0_3px_0_0_#fcd34d] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none',
                  ].join(' ')}
                >
                  {tile.value}
                </button>
              )
            })}
          </div>

          <p
            role="status"
            className={`mt-3 min-h-[3rem] text-center text-base font-medium ${solved ? 'text-green-700' : 'text-slate-500'}`}
          >
            {solved
              ? above === null
                ? `${PRAISE_ROW[rowIdx % PRAISE_ROW.length]} Es ${current.word}.`
                : `${PRAISE_ROW[rowIdx % PRAISE_ROW.length]} «${current.word}» es «${above}» con una ${current.word[current.newIndex]} más.`
              : (hint ?? START_HINT)}
          </p>

          <div ref={feedbackRef} className="flex min-h-[44px] scroll-mb-5 justify-center">
            {placed.length > 0 && !solved && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold text-tiam-blue transition hover:bg-tiam-blue/10 focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40"
              >
                <Eraser className="h-4 w-4" />
                Sacar las letras
              </button>
            )}
          </div>
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
            Armaste las {rows.length} filas: {rows.map((r) => r.word).join(' → ')}. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
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

export function LaPiramideDeLetras({ onComplete }: GameProps) {
  // Which pyramid each level plays and every scramble — decided once, at mount, so
  // "Repetir" plays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never
  // brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROWS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Subí la pirámide</h2>
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
