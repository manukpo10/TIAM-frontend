import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Mensaje cifrado" — día 10, mes 5, atención. A greeting or a refrán in which
 * some letters were swapped for numbers (4 = A, 3 = E, 0 = O…). The KEY with
 * every swap stays on screen the whole time; the number to decode is
 * highlighted, the player looks it up in the key and taps its letter on a
 * keypad, and the message turns back into words, left to right.
 *
 * Decoding per number (not per word) was chosen on purpose. Reading "M45" as
 * "MAS" is something anyone can do by eye ("leet" spelling), so a word-by-word
 * multiple choice would turn the key into decoration; looking each number up in
 * the key is the substitution-through-a-key demand this day is about. It also
 * keeps the week varied: día 7 asks for vowels by context and día 12 takes the
 * word-by-word route, so this is the one day that works from a key.
 *
 * Every letter of the message that appears in the key is swapped, wherever it
 * occurs (so "ESTÁS" with 3 = E and 4 = A reads "3ST4S"); accents and
 * punctuation are dropped from the coded text and come back, as written, on the
 * result card. The coded text and the answers are DERIVED from the plain
 * message (`layoutOf`), never authored twice. A throwaway Node script (not
 * committed) confirmed that the two messages of each level have the same number
 * of numbers to decode, that re-decoding with the key gives back the original,
 * that every key has distinct numbers and distinct letters, and that every row
 * of the key shown for a message appears in it.
 *
 * The key lists only the swaps THIS message uses (`usedKey`): a row nobody needs
 * would just send the player looking for a number that is not there. The keypad
 * shows the letters of that key, in alphabetical order, so it never gives the
 * numbers away. A wrong letter greys out for that number (the choices shrink
 * instead of repeating the same mistake), costs one mistake and lights up the
 * key entry to look at; no timer, nothing red. A one-line "Pista" names the kind
 * of text, never its words.
 *
 * Double taps are judged by the click's own timeStamp. A quick second tap on the letter
 * that was JUST accepted is not an answer for the next number (which usually wants
 * another letter and used to cost a false mistake, a greyed key and a "Casi…"): that
 * key is ignored for SETTLE_MS. So is every key within SETTLE_MS of the tap that
 * brought the level ("Empezar", "Siguiente nivel", "Repetir"), whose second tap would
 * land on the keypad of the new message, and so is the card's button within SETTLE_MS
 * of the letter that closed the message (the card takes the keypad's place). Once the
 * message is solved the key is no longer needed and gives its room to the result card,
 * which is also scrolled into view if the phone is short.
 *
 * Ramp: up to 3 swaps (A E O) and a 3-4 word greeting with 6 numbers to decode →
 * up to 5 swaps and a 5-word refrán with 9 → up to 6 swaps and a 6-7 word refrán
 * with 14. ONE message per level: each level has two authored ones and one is
 * picked ONCE at mount (`epoch`), so "Repetir" replays exactly the same three.
 * Per-level state lives in <LevelView>, keyed by run + level. A "¿Cómo se juega?"
 * screen opens the day; "Repetir" never brings it back.
 *
 * totalAttempts = mistakes + every number of the day (TOTAL_DIGITS, derived).
 */

// ── data:start ──
interface Substitution {
  digit: string
  letter: string
}
interface MessageSet {
  /** Completes "Pista: …" — the kind of text, never its words. */
  clue: string
  /** The message as it reads once decoded, with its accents and punctuation. */
  display: string
}
interface LevelDef {
  name: string
  /** Number → letter pairs, in the order the key shows them. */
  key: Substitution[]
  messages: MessageSet[]
}

const A: Substitution = { digit: '4', letter: 'A' }
const E: Substitution = { digit: '3', letter: 'E' }
const I: Substitution = { digit: '1', letter: 'I' }
const O: Substitution = { digit: '0', letter: 'O' }
const S: Substitution = { digit: '5', letter: 'S' }
const T: Substitution = { digit: '7', letter: 'T' }

// The key lists the numbers in ascending order (0, 1, 3, 4, 5, 7) so looking
// one up is a scan, not a search. Every message of a level has the same count
// of numbers to decode, so TOTAL_DIGITS never depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    key: [O, E, A],
    messages: [
      { clue: 'es un saludo', display: 'Hola, ¿cómo estás?' },
      { clue: 'es un saludo', display: 'Buenos días a todos' },
    ],
  },
  {
    name: 'Nivel 2',
    key: [O, I, E, A, S],
    messages: [
      { clue: 'es un refrán', display: 'Al mal tiempo, buena cara' },
      { clue: 'es un refrán', display: 'De tal palo, tal astilla' },
    ],
  },
  {
    name: 'Nivel 3',
    key: [O, I, E, A, S, T],
    messages: [
      { clue: 'es un refrán', display: 'En boca cerrada no entran moscas' },
      { clue: 'es un refrán', display: 'Dios los cría y ellos se juntan' },
    ],
  },
]

const ACCENTED: Record<string, string> = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U' }

interface Cell {
  /** What is printed: a number when the letter was swapped, the letter otherwise. */
  char: string
  /** The real letter underneath. */
  letter: string
  /** Index of the number to decode this cell stands for, or null for a plain letter. */
  blank: number | null
}

/** The message as rows of words made of cells, numbering the swapped letters in reading order. */
function layoutOf(display: string, key: Substitution[]): Cell[][] {
  let next = 0
  return display
    .replace(/[¿?¡!,.]/g, '')
    .toUpperCase()
    .split(' ')
    .map((word) =>
      word.split('').map((raw) => {
        const letter = ACCENTED[raw] ?? raw
        const swap = key.find((k) => k.letter === letter)
        return swap ? { char: swap.digit, letter, blank: next++ } : { char: letter, letter, blank: null }
      }),
    )
}

/** The letters the player has to give, in reading order. */
function answersOf(rows: Cell[][]): string[] {
  return rows.flat().flatMap((cell) => (cell.blank === null ? [] : [cell.letter]))
}

/** The swaps the message really contains, in the order of the level key. */
function usedKey(key: Substitution[], answers: string[]): Substitution[] {
  return key.filter((k) => answers.includes(k.letter))
}

const TOTAL_DIGITS = LEVELS.reduce(
  (sum, lvl) => sum + answersOf(layoutOf(lvl.messages[0].display, lvl.key)).length,
  0,
)
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface LevelContent {
  message: MessageSet
  rows: Cell[][]
  answers: string[]
  /** The key shown: only the swaps this message uses. */
  key: Substitution[]
  /** The keypad: the letters of that key, alphabetically. */
  keypad: string[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const message = pickOne(lvl.messages)
    const rows = layoutOf(message.display, lvl.key)
    const answers = answersOf(rows)
    const key = usedKey(lvl.key, answers)
    return {
      message,
      rows,
      answers,
      key,
      keypad: key.map((k) => k.letter).sort((a, b) => a.localeCompare(b)),
    }
  })
}

/** How long a double tap is swallowed: the key that was just accepted, every key right after the button
 * that brought the level, and the card's button right after the letter that closed the message. Long
 * enough to swallow a double tap, short enough that nobody who really needs the same letter twice in a
 * row, or taps the first key of a new message, notices. */
const SETTLE_MS = 400

const PRAISE = ['¡Muy bien!', '¡Excelente atención!', '¡Así se descifra!', '¡Perfecto!', '¡Qué buen ojo!']
const NUDGES = [
  'Esa letra no es. Buscá el número en la clave.',
  'Casi. Mirá en la clave qué letra le toca a ese número.',
  'No es esa. Fijate de nuevo en la clave.',
]

// Full class strings, never interpolated: Tailwind only emits classes it can
// read literally in the source. Sized so the longest word of each level stays
// inside the grey box on one line down to a 320px phone (240px inside it) and
// the whole level fits a 360×740 phone without scrolling: every word sits in a
// white chip (6px padding each side), so level 3's 7-letter word takes
// 7 × 22 + 12 = 166px and its message wraps into three or four rows. On a short
// phone (the modal leaves 100dvh - 95px) the cells are one step shorter, so the key,
// the message, ALL the keys and the hint are on screen when a level opens: a player
// who does not see that the keypad goes on below the fold simply cannot answer.
const CELL_CLASS = [
  'h-12 w-8 text-3xl [@media(max-height:700px)]:h-11',
  'h-10 w-6 text-2xl [@media(max-height:700px)]:h-8',
  'h-9 w-5 text-lg [@media(max-height:700px)]:h-8',
]

/** One row of keys, as many columns as keys (a message that does not use every swap of its level has fewer keys than
 * the level's key, and a fixed grid would leave the row packed to the left): the row is centred and a key is never wider
 * than 76px. At least 44px wide each: six keys borrow 16px of padding on each side below 350px. */
const KEY_MAX_WIDTH = 76
function keypadGap(count: number): number {
  return count <= 3 ? 8 : count <= 5 ? 6 : 4
}
function keypadClass(count: number): string {
  return count <= 3
    ? 'gap-2'
    : count <= 5
      ? 'gap-1.5'
      : 'gap-1 max-[349px]:-mx-4 max-[349px]:max-w-none'
}
function keypadStyle(count: number): CSSProperties {
  return {
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    '--kp': `${count * KEY_MAX_WIDTH + (count - 1) * keypadGap(count)}px`,
  } as CSSProperties
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'En este mensaje, algunas letras se cambiaron por números.',
    'La clave te dice qué letra es cada número. La vas a ver siempre arriba.',
    'Mirá el número que está resaltado, buscalo en la clave y tocá su letra.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-orange-600/20 bg-tiam-orange/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-2xl bg-white p-3 text-center">
        <p className="text-sm font-semibold text-slate-500">Por ejemplo, con esta clave:</p>
        <p className="mt-1 text-xl font-bold text-slate-900">
          <span className="text-orange-700">4</span> = A
        </p>
        <p className="mt-1 text-base text-slate-700">
          «C<span className="font-bold text-orange-700">4</span>S<span className="font-bold text-orange-700">4</span>» se
          lee «CASA».
        </p>
      </div>
      <div className="sticky bottom-3 z-10 mt-5 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
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
  const { message, rows, answers, key, keypad } = content
  const total = answers.length

  // How many numbers are decoded: the number to decode now is `filled`.
  const [filled, setFilled] = useState(0)
  const [wrongLetters, setWrongLetters] = useState<string[]>([])
  const [scaffold, setScaffold] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The key accepted last and when (the click's own timeStamp): a second tap on it
  // right after is a double tap.
  const acceptedRef = useRef<{ letter: string; at: number } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const solved = filled >= total
  const cellClass = CELL_CLASS[levelIdx]

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
  // The number on screen to decode, so its key entry can light up after a slip.
  const currentDigit = rows.flat().find((cell) => cell.blank === filled)?.char

  function handlePick(letter: string, at: number) {
    // A tap this soon after the button that brought the level ("Empezar", "Siguiente nivel", "Repetir")
    // is its double tap: the keypad sits right where that button was.
    if (solved || wrongLetters.includes(letter) || at - since < SETTLE_MS) return
    // The blank has already moved on to the next number: judging a double tap on the
    // letter just accepted against it would be a false mistake.
    const last = acceptedRef.current
    if (last !== null && last.letter === letter && at - last.at < SETTLE_MS) return
    if (letter === answers[filled]) {
      acceptedRef.current = { letter, at }
      setFilled(filled + 1)
      setWrongLetters([])
      setScaffold(false)
      setHint(null)
      if (filled + 1 >= total) {
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setWrongLetters((w) => [...w, letter])
      setScaffold(true)
      setHint(pickOne(NUDGES))
      onMistake()
    }
  }

  // The card takes the keypad's place, so its button can end up right under the finger that closed the
  // message (`acceptedRef` still holds that tap): the second tap of that double tap must not skip the result.
  function leave(go: (at: number) => void, at: number) {
    if (acceptedRef.current !== null && at - acceptedRef.current.at < SETTLE_MS) return
    go(at)
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl [@media(max-height:700px)]:mt-2">Descifrá el mensaje</h2>
            <div className="mx-auto mt-1.5 w-full max-w-xs [@media(max-height:700px)]:mt-1">
              <div className="flex items-baseline justify-between gap-3 text-base">
                <p className="text-slate-500">
                  Pista: <span className="font-bold text-orange-700">{message.clue}</span>
                </p>
                <p className="shrink-0 font-semibold text-slate-500">
                  {filled} de {total}
                </p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(filled / total) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* The key — on screen the whole time the message is being decoded */}
      {!solved && (
        <div className="mt-3 rounded-2xl border border-orange-600/20 bg-tiam-orange/5 px-3 py-2 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:py-1.5">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-slate-500">Clave</p>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {key.map((k) => {
              const lit = scaffold && k.digit === currentDigit
              return (
                <span
                  key={k.digit}
                  className={[
                    'flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 px-2.5 text-lg font-bold [@media(max-height:700px)]:min-h-[32px]',
                    lit
                      ? 'border-tiam-blue bg-tiam-blue/10 text-slate-900'
                      : 'border-transparent bg-white text-slate-800',
                  ].join(' ')}
                >
                  <span className="text-orange-700">{k.digit}</span>
                  <span className="text-slate-400">=</span>
                  {k.letter}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* The message — stays on screen, decoded, once solved */}
      <div
        role="group"
        aria-label={solved ? `Mensaje descifrado: ${message.display}` : 'Mensaje cifrado'}
        className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-2 rounded-2xl bg-slate-50 px-2 py-3 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:gap-y-1.5 [@media(max-height:700px)]:py-2"
      >
        {rows.map((cells, wi) => (
          <span key={wi} className="inline-flex gap-0.5 rounded-xl bg-white px-1.5 py-1 shadow-sm [@media(max-height:700px)]:py-0.5">
            {cells.map((cell, ci) => {
              const base = `flex items-center justify-center rounded-md font-bold ${cellClass}`
              if (cell.blank === null) {
                return (
                  <span key={ci} className={`${base} text-slate-800`}>
                    {cell.char}
                  </span>
                )
              }
              if (cell.blank < filled) {
                return (
                  <span key={ci} className={`${base} bg-tiam-green/10 text-green-700`}>
                    {cell.letter}
                  </span>
                )
              }
              const isCurrent = cell.blank === filled
              return (
                <span
                  key={ci}
                  aria-hidden="true"
                  className={[
                    base,
                    'border-b-4',
                    isCurrent
                      ? 'border-orange-600 bg-tiam-orange/10 text-slate-900 motion-safe:animate-pulse'
                      : 'border-slate-300 text-slate-600',
                  ].join(' ')}
                >
                  {cell.char}
                </span>
              )
            })}
          </span>
        ))}
      </div>

      {!solved && (
        <>
          {/* The keypad: letters only, never the numbers */}
          <div
            className={`mx-auto mt-3 grid max-w-(--kp) [@media(max-height:700px)]:mt-2 ${keypadClass(keypad.length)}`}
            style={keypadStyle(keypad.length)}
          >
            {keypad.map((letter) => {
              const isWrong = wrongLetters.includes(letter)
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={isWrong}
                  onClick={(e) => handlePick(letter, e.timeStamp)}
                  className={[
                    'min-h-[52px] rounded-xl border-2 text-2xl font-bold transition [@media(max-height:700px)]:min-h-[48px]',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40',
                    isWrong
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {letter}
                </button>
              )
            })}
          </div>
          {/* Two lines on a 320px phone: reserved, so the hint never makes the card jump under the finger. */}
          <p role="status" className="mt-2 min-h-[3rem] text-center text-base font-medium text-slate-500">
            {hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            El mensaje decía: <span className="font-bold text-slate-800">«{message.display}»</span>. ¡Completaste el{' '}
            {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => leave(onRepeat, e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => leave(onNext, e.timeStamp)}
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

export function MensajeCifrado({ onComplete }: GameProps) {
  // Which message each level plays — decided once, at mount, so "Repetir"
  // replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_DIGITS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Descifrá el mensaje</h2>
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
