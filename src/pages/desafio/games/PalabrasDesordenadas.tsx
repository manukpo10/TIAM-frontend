import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Eraser, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Palabras desordenadas" — día 19, mes 5, lenguaje. One category per level
 * ("Instrumentos musicales", "Países", "Deportes"…) and three words of it, one
 * at a time. Each word comes with a CLUE (what it is, in one sentence) and its
 * LENGTH (the empty boxes, plus "5 letras" in words), and its letters arrive
 * scrambled: tap them in order to build the word, tap a letter you already put
 * to take it back. Same family as month 4's Anagramas por categoría (tap the
 * letters of a scrambled word), with what that game left out: a clue for every
 * word, so the player is never guessing a hidden word from the letters alone,
 * and ONE round per level.
 *
 * The check runs when the last box fills, by comparing the SPELLED string with
 * the word (never tile identity, so a repeated letter can go in either of its
 * tiles). A wrong word keeps its letters in place (muted gray, never red), costs
 * ONE mistake and says so gently; from the second miss on the same word, the
 * hint gives its first letter. "Sacar las letras" empties the boxes. A right word
 * turns green, shows itself with its accent (AVIÓN, NATACIÓN: the tiles are plain
 * A-Z, the accent only appears in the reveal) and moves on after a short pause
 * (the only timer in the game). Nothing is timed otherwise.
 *
 * Every tile keeps its place in the bank (a used tile leaves a ghost behind), so
 * nothing slides under a finger. The second tap of a double tap never counts
 * (SETTLE_MS, judged by the click's own timeStamp): a second tap on a box within a
 * moment is not a second removal, and no tile or box answers right after the tap
 * that brought the level ("Siguiente nivel", "Repetir"). A solved level shows only
 * its result card, scrolled into view on a short phone.
 *
 * Ramp: words of 4-5 letters → 6-7 → 8-9, one category each (new ones: none
 * repeats a category of month 4's game). Each level has two authored categories
 * and ONE is picked at mount (`epoch`), together with the order of its three
 * words and EVERY SCRAMBLE, so "Repetir" replays exactly the same words with
 * exactly the same scrambled letters. Per-level state lives in <LevelView>,
 * keyed by run + level. A throwaway Node script (not committed) checks every
 * word (letters, length band, no word inside its own clue) and draws the
 * scrambler ten thousand times per word: never the word itself, always the same
 * letters.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface WordDef {
  /** Plain A-Z, no accent: these are the tiles. */
  word: string
  /** How the word is written in full (with its accent) once it is solved. */
  shown?: string
  /** One sentence, never containing the word. */
  clue: string
}
interface CategoryDef {
  title: string
  words: WordDef[]
}
interface LevelDef {
  name: string
  /** Letters per word in this level. */
  minLen: number
  maxLen: number
  categories: CategoryDef[]
}

// Every category of a level has three words, so TOTAL_WORDS never depends on
// which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    minLen: 4,
    maxLen: 5,
    categories: [
      {
        title: 'Instrumentos musicales',
        words: [
          { word: 'PIANO', clue: 'Tiene teclas blancas y negras.' },
          { word: 'ARPA', clue: 'Tiene muchas cuerdas y se toca con los dedos.' },
          { word: 'BOMBO', clue: 'Es un tambor grande que se golpea con una maza.' },
        ],
      },
      {
        title: 'Medios de transporte',
        words: [
          { word: 'TREN', clue: 'Va sobre rieles y arrastra muchos vagones.' },
          { word: 'AVION', shown: 'AVIÓN', clue: 'Vuela por el cielo y aterriza en un aeropuerto.' },
          { word: 'BARCO', clue: 'Navega por el mar y por los ríos.' },
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    minLen: 6,
    maxLen: 7,
    categories: [
      {
        title: 'Países',
        words: [
          { word: 'BRASIL', clue: 'Es el país más grande de Sudamérica: ahí queda Río de Janeiro.' },
          { word: 'URUGUAY', clue: 'País vecino de Argentina, al otro lado del río. Su capital es Montevideo.' },
          { word: 'ITALIA', clue: 'País con forma de bota: ahí están Roma, Venecia y Florencia.' },
        ],
      },
      {
        title: 'Verduras',
        words: [
          { word: 'TOMATE', clue: 'Es redondo y rojo; se usa para la salsa y la ensalada.' },
          { word: 'LECHUGA', clue: 'Sus hojas verdes y frescas van en la ensalada.' },
          { word: 'ZAPALLO', clue: 'Es grande y de pulpa amarilla; sirve para el puré y la sopa.' },
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    minLen: 8,
    maxLen: 9,
    categories: [
      {
        title: 'Deportes',
        words: [
          { word: 'NATACION', shown: 'NATACIÓN', clue: 'Se practica en una pileta, moviendo brazos y piernas en el agua.' },
          { word: 'CICLISMO', clue: 'Se practica pedaleando sobre una bicicleta.' },
          { word: 'ATLETISMO', clue: 'Incluye carreras, saltos y lanzamientos.' },
        ],
      },
      {
        title: 'Árboles',
        words: [
          { word: 'EUCALIPTO', clue: 'Sus hojas largas tienen un aroma fuerte, bueno para los resfríos.' },
          { word: 'JACARANDA', shown: 'JACARANDÁ', clue: 'En primavera se llena de flores violetas.' },
          { word: 'ARAUCARIA', clue: 'Árbol del sur, de hojas en punta, que da piñones.' },
        ],
      },
    ],
  },
]

const TOTAL_WORDS = LEVELS.reduce((sum, lvl) => sum + lvl.categories[0].words.length, 0)

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

/** The letters of a word in a random order: never the word itself, and at most a third of them in place. */
function scrambleToTiles(word: string): Tile[] {
  const letters = word.split('')
  const inPlace = (arr: string[]) => arr.filter((ch, i) => ch === word[i]).length
  let best = shuffle(letters)
  for (let tries = 0; tries < 200 && inPlace(best) > maxInPlace(word.length); tries++) best = shuffle(letters)
  // A rotation by one only reproduces the word when every letter is the same.
  if (best.join('') === word) best = [...letters.slice(1), letters[0]]
  return best.map((value, id) => ({ id, value }))
}
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface PreparedWord {
  word: string
  shown: string
  clue: string
  /** The scramble, frozen for the whole mount. */
  tiles: Tile[]
}
interface PreparedLevel {
  title: string
  words: PreparedWord[]
}

function buildEpoch(): PreparedLevel[] {
  return LEVELS.map((lvl) => {
    const category = pickOne(lvl.categories)
    return {
      title: category.title,
      words: shuffle(category.words).map((w) => ({
        word: w.word,
        shown: w.shown ?? w.word,
        clue: w.clue,
        tiles: scrambleToTiles(w.word),
      })),
    }
  })
}

const PRAISE_WORD = ['¡Esa es!', '¡Muy bien!', '¡Exacto!', '¡Así se hace!']
const PRAISE_LEVEL = ['¡Excelente trabajo!', '¡Qué buen manejo de las palabras!', '¡Las armaste todas!']
const NUDGES = [
  'Todavía no. Mirá la pista y probá con otro orden.',
  'Casi. Tocá una letra de arriba para sacarla y cambiarla.',
  'Esa no es. Fijate bien en la pista y volvé a intentar.',
]
const START_HINT = 'Tocá las letras de abajo, en orden. Para sacar una, tocala arriba.'
/** A second tap on the same box, or on anything right after the tap that brought the level here,
 * this soon is a double tap, not a new move. Long enough to swallow a double tap, short enough
 * that nobody who means it notices. */
const SETTLE_MS = 400

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
  const { words } = content

  const [wordIdx, setWordIdx] = useState(0)
  // Tile ids in the order they sit in the boxes.
  const [placed, setPlaced] = useState<number[]>([])
  const [wordMisses, setWordMisses] = useState(0)
  const [outcome, setOutcome] = useState<'idle' | 'wrong' | 'right'>('idle')
  const [hint, setHint] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE_LEVEL[0])
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const lastBoxRef = useRef<{ index: number; at: number }>({ index: -1, at: -999999 })
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
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

  const current = words[wordIdx]
  const tileById = (id: number) => current.tiles.find((t) => t.id === id) as Tile
  const placedIds = new Set(placed)
  const solved = outcome === 'right'
  const full = placed.length === current.word.length

  function placeTile(tile: Tile, at: number) {
    // A used tile is a disabled ghost, which is what swallows a double tap on the tile just placed;
    // this swallows the one that follows the button that brought the level.
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
        if (wordIdx < words.length - 1) {
          setWordIdx((i) => i + 1)
          setPlaced([])
          setOutcome('idle')
          setWordMisses(0)
          setHint(null)
        } else {
          setPraise(pickOne(PRAISE_LEVEL))
          setDone(true)
          onSolved()
        }
      }, 1100)
      return
    }
    // Wrong word: the letters STAY, so the player can see the attempt and fix the one that is off.
    const misses = wordMisses + 1
    setWordMisses(misses)
    setOutcome('wrong')
    setHint(misses >= 2 ? `Casi. Esta palabra empieza con la letra ${current.word[0]}.` : pickOne(NUDGES))
    onMistake()
  }

  function removeAt(index: number, at: number) {
    if (solved || at - since < SETTLE_MS) return
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

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Palabra {wordIdx + 1} de {words.length}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* Category + clue + length: the three things a word needs */}
          <div className="mt-3 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Categoría</p>
            <h2 className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{content.title}</h2>
          </div>
          <div className="mx-auto mt-2 max-w-md rounded-2xl border-2 border-green-700/20 bg-tiam-green/5 px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">Pista</p>
            <p className="mt-0.5 text-lg font-semibold leading-snug text-slate-800">{current.clue}</p>
            <p className="mt-1 text-base font-bold text-slate-600">{current.word.length} letras</p>
          </div>

          {/* The boxes: one per letter of the word */}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label={`Palabra de ${current.word.length} letras`}>
            {current.word.split('').map((_, i) => {
              const id = placed[i]
              if (id === undefined) {
                return (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="h-11 w-11 rounded-lg border-2 border-slate-200 bg-slate-50"
                  />
                )
              }
              const letter = tileById(id).value
              return (
                <button
                  key={i}
                  type="button"
                  disabled={solved}
                  onClick={(e) => removeAt(i, e.timeStamp)}
                  aria-label={`Letra ${letter}, tocá para sacarla`}
                  className={[
                    'flex h-11 w-11 items-center justify-center rounded-lg border-2 text-xl font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    solved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : outcome === 'wrong'
                        ? 'border-slate-300 bg-slate-100 text-slate-500'
                        : 'border-amber-300 bg-amber-50 text-slate-900 hover:-translate-y-0.5',
                  ].join(' ')}
                >
                  {letter}
                </button>
              )
            })}
          </div>

          {/* The scrambled letters: every tile keeps its place, a used one leaves a ghost */}
          <div
            className="mt-4 flex flex-wrap justify-center gap-1.5"
            role="group"
            aria-label="Letras desordenadas"
          >
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
            {solved ? `${PRAISE_WORD[wordIdx % PRAISE_WORD.length]} Es ${current.shown}.` : (hint ?? START_HINT)}
          </p>

          <div className="flex min-h-[44px] justify-center">
            {placed.length > 0 && !solved && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold text-tiam-blue transition hover:bg-tiam-blue/5 focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40"
              >
                <Eraser className="h-4 w-4" />
                Sacar las letras
              </button>
            )}
          </div>

          {/* The words already built */}
          {wordIdx > 0 && (
            <ul className="mt-2 flex flex-wrap justify-center gap-2" aria-label="Palabras que ya armaste">
              {words.slice(0, wordIdx).map((w) => (
                <li
                  key={w.word}
                  className="flex items-center gap-1.5 rounded-xl border border-tiam-green/30 bg-tiam-green/5 py-1 pl-2 pr-3 text-base font-bold tracking-wide text-slate-800"
                >
                  <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                  {w.shown}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Armaste las {words.length} palabras de «{content.title}». ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {words.map((w) => (
              <li
                key={w.word}
                className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white py-1 pl-2 pr-3 text-base font-bold tracking-wide text-slate-800"
              >
                <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                {w.shown}
              </li>
            ))}
          </ul>
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

export function PalabrasDesordenadas({ onComplete }: GameProps) {
  // Which category each level plays, the order of its words and every scramble
  // — decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
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
