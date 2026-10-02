import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué número es?" — día 11, mes 5, cálculo. The left column writes numbers
 * with WORDS ("setenta y ocho mil novecientos doce"), the right column writes
 * numbers with DIGITS ("78.912"); tap one of each to pair them. The same
 * two-tap pairing as month 4's "¿Cuánto suma?", but the skill is reading a
 * number properly: which part is the thousands, which the hundreds, where a
 * zero hides ("trescientos seis" is 306, not 36).
 *
 * THE DISTRACTORS ARE EACH OTHER. Every set is a family of near misses made
 * from the same few digits — 78.912, 78.192, 87.912, 79.812, 78.921 — so each
 * number on the right is a tempting wrong answer for the others, and the level
 * needs no extra decoys that would stay unmatched on screen. Reading only the
 * first words of "setenta y ocho mil novecientos doce" is not enough: 78.912
 * and 78.921 share the whole beginning.
 *
 * The words are NOT authored, they are computed by `toWords`, so a typo in a
 * hand-written "veintitrés" can never reach a player. It follows the RAE: the
 * accents of dieciséis / veintidós / veintitrés / veintiséis, "cien" alone and
 * "ciento" before anything, "mil" (never "un mil"), and the shortened "un"
 * before "mil" (treinta y un mil, veintiún mil). A throwaway Node script (not
 * committed) compared it with an independent rule-table implementation for
 * every number from 1 to 99,999, and with 87 hand-written expectations (the
 * tricky ones above plus every number used here). Digits use the Argentine
 * thousands dot, also for four digits (3.452), as in a price tag.
 *
 * A wrong pair flashes muted gray (never red), costs one mistake and names the
 * first place in which the two numbers tapped really differ ("Fijate en las
 * decenas"; `firstDifferingPlace`), so the nudge always points at the digit that
 * was misread; the pair is cleared and the numbers stay available. No timer.
 * Once the level is solved the two columns are no longer needed and give way to
 * the result card (which lists the numbers in the order they were paired); the
 * card is also scrolled into view if the phone is short.
 *
 * Double taps are judged by the click's own timeStamp: every tap within SETTLE_MS of
 * the tap that brought the level ("Siguiente nivel", "Repetir") is ignored, so the
 * second tap of a double tap never picks a number of the new level; a second tap on
 * the number that was JUST picked keeps it picked instead of putting it back down;
 * and the card's button ignores a tap within SETTLE_MS of the pair that closed the
 * level (the card takes the columns' place, so it can end up under that finger). A
 * number that flashes as wrong is skipped and a matched one is disabled, so a double
 * tap on the second number of a pair was already harmless.
 *
 * Ramp: 3 numbers of 3 digits → 4 of 4 digits → 5 of 5 digits. ONE set per
 * level: each level has two authored families and one is picked ONCE at mount
 * (`epoch`, together with the order of both columns), so "Repetir" replays
 * exactly the same three. Per-level state lives in <LevelView>, keyed by run +
 * level.
 *
 * totalAttempts = mistakes + every number of the day (TOTAL_PAIRS, derived).
 */

// ── data:start ──
const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve',
]
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos',
  'novecientos',
]

/** 0-99. `beforeMil` shortens the final "uno": "treinta y un mil", "veintiún mil". */
function underHundred(n: number, beforeMil: boolean): string {
  if (n < 30) {
    if (beforeMil && n === 1) return 'un'
    if (beforeMil && n === 21) return 'veintiún'
    return UNITS[n]
  }
  const tens = Math.floor(n / 10)
  const unit = n % 10
  if (unit === 0) return TENS[tens]
  return `${TENS[tens]} y ${beforeMil && unit === 1 ? 'un' : UNITS[unit]}`
}

/** 1-999. */
function underThousand(n: number, beforeMil: boolean): string {
  if (n === 100) return 'cien'
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds === 0) return underHundred(rest, beforeMil)
  return rest === 0 ? HUNDREDS[hundreds] : `${HUNDREDS[hundreds]} ${underHundred(rest, beforeMil)}`
}

/** 1-99,999 written out in Spanish: 78912 → "setenta y ocho mil novecientos doce". */
function toWords(n: number): string {
  if (n < 1000) return underThousand(n, false)
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  const head = thousands === 1 ? 'mil' : `${underThousand(thousands, true)} mil`
  return rest === 0 ? head : `${head} ${underThousand(rest, false)}`
}

/** Argentine thousands dot: 78912 → "78.912", 3452 → "3.452", 743 → "743". */
function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

interface LevelDef {
  name: string
  digits: 3 | 4 | 5
  /** Families of near misses (the same digits, moved around). All sets of a level have the same size. */
  sets: number[][]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    digits: 3,
    sets: [
      [743, 734, 347],
      [516, 561, 156],
    ],
  },
  {
    name: 'Nivel 2',
    digits: 4,
    sets: [
      [3452, 3425, 4352, 3542],
      [2718, 2781, 2178, 7218],
    ],
  },
  {
    name: 'Nivel 3',
    digits: 5,
    sets: [
      [78912, 78192, 87912, 79812, 78921],
      [45306, 45360, 54306, 43506, 45630],
    ],
  },
]

const TOTAL_PAIRS = LEVELS.reduce((sum, lvl) => sum + lvl.sets[0].length, 0)

/** What each digit of a number of that size is called, from the leftmost one. */
const PLACES: Record<3 | 4 | 5, string[]> = {
  3: ['centenas', 'decenas', 'unidades'],
  4: ['unidades de mil', 'centenas', 'decenas', 'unidades'],
  5: ['decenas de mil', 'unidades de mil', 'centenas', 'decenas', 'unidades'],
}

/** The place of the first digit in which two numbers of the same size differ: "decenas", "centenas"… */
function firstDifferingPlace(a: number, b: number, digits: 3 | 4 | 5): string {
  const x = String(a)
  const y = String(b)
  const i = [...x].findIndex((ch, k) => ch !== y[k])
  return PLACES[digits][i < 0 ? digits - 1 : i]
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** ['a', 'b', 'c'] → "a, b y c" */
function listWithY(items: string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

interface LevelContent {
  /** Left column, in its (frozen) display order. */
  written: number[]
  /** Right column, in its (frozen) display order — never the left one, so no row pairs with itself. */
  digits: number[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const set = pickOne(lvl.sets)
    const written = shuffle(set)
    let digits = shuffle(set)
    for (let guard = 0; guard < 30 && digits.every((n, i) => n === written[i]); guard++) digits = shuffle(set)
    return { written, digits }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente lectura!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo para los números!']

/** A tap this soon after the tap that brought the level here ("Siguiente nivel", "Repetir") is the second
 * tap of a double tap, and it must not pick a number of the new level (the columns sit right where that
 * button was). The same window covers the number that was just picked (its second tap would put it back
 * down) and the card's button right after the pair that closed the level (the card takes the columns'
 * place). Long enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

// Full class strings, never interpolated: Tailwind only emits classes it can
// read literally in the source. The digits column is the narrow one (4 of 11
// parts), so its text shrinks with the number of digits: "45.360" at 20px bold is
// ~70px, which fits the ~76px left inside the box on a 320px phone.
//
// On a short phone (the modal leaves 100dvh - 95px) the digits column is a fixed 80px
// and one step smaller ("45.360" at 18px bold is 61px, 68px of room), which gives the
// words column the width to write most numbers on two lines instead of three or four:
// level 3's five rows go from 486px to about 310px, so ALL the numbers and the hint are
// on screen when a level opens (a player who does not see that the columns go on below
// the fold simply cannot play). Every target stays 56px tall, the text 16px or more.
const DIGITS_TEXT: Record<3 | 4 | 5, string> = {
  3: 'text-2xl',
  4: 'text-2xl [@media(max-height:700px)]:text-xl',
  5: 'text-xl [@media(max-height:700px)]:text-lg',
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
  const { written, digits } = content
  const total = written.length

  const [matched, setMatched] = useState<number[]>([])
  const [pickedWritten, setPickedWritten] = useState<number | null>(null)
  const [pickedDigits, setPickedDigits] = useState<number | null>(null)
  // The two items of the last wrong pair, flashing for a moment.
  const [wrongWritten, setWrongWritten] = useState<number | null>(null)
  const [wrongDigits, setWrongDigits] = useState<number | null>(null)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])
  // When the number that is picked now was picked (the click's own timeStamp): a second tap on it
  // right after is a double tap. Only one number is ever picked at a time: a second one makes a pair.
  const pickedAtRef = useRef(-Infinity)
  // The tap that matched the last pair, which closed the level: the card takes the columns' place.
  const closedAtRef = useRef(-Infinity)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const solved = matched.length >= total

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

  function resolve(w: number, d: number, at: number) {
    setPickedWritten(null)
    setPickedDigits(null)
    if (w === d) {
      const next = [...matched, w]
      setMatched(next)
      setHint({ text: `¡Sí! Es el ${formatNumber(w)}.`, ok: true })
      if (next.length >= total) {
        closedAtRef.current = at
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setWrongWritten(w)
      setWrongDigits(d)
      setHint({ text: `No son el mismo número. Fijate en las ${firstDifferingPlace(w, d, level.digits)}.`, ok: false })
      onMistake()
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => {
        setWrongWritten(null)
        setWrongDigits(null)
      }, 600)
    }
  }

  function tapWritten(n: number, at: number) {
    // A second tap on an item that is still flashing as wrong is a double tap, not a second mistake;
    // so is one this soon after the button that brought the level ("Siguiente nivel", "Repetir"),
    // which would otherwise pick the item that sits where that button was.
    if (solved || matched.includes(n) || wrongWritten === n || at - since < SETTLE_MS) return
    if (pickedWritten === n) {
      // The second tap of a double tap on the item just picked would put it straight back down.
      if (at - pickedAtRef.current < SETTLE_MS) return
      setPickedWritten(null)
      return
    }
    pickedAtRef.current = at
    setPickedWritten(n)
    setHint(null)
    if (pickedDigits !== null) resolve(n, pickedDigits, at)
  }
  function tapDigits(n: number, at: number) {
    if (solved || matched.includes(n) || wrongDigits === n || at - since < SETTLE_MS) return
    if (pickedDigits === n) {
      if (at - pickedAtRef.current < SETTLE_MS) return
      setPickedDigits(null)
      return
    }
    pickedAtRef.current = at
    setPickedDigits(n)
    setHint(null)
    if (pickedWritten !== null) resolve(pickedWritten, n, at)
  }

  // The card takes the columns' place, so its button can end up right under the finger that closed the
  // level: the second tap of that double tap must not skip the result.
  function leave(go: (at: number) => void, at: number) {
    if (at - closedAtRef.current < SETTLE_MS) return
    go(at)
  }

  const pairClass = (isMatched: boolean, isPicked: boolean, isWrong: boolean) =>
    isMatched
      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
      : isWrong
        ? 'border-slate-300 bg-slate-100 text-slate-500 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
        : isPicked
          ? 'border-cyan-600 bg-white text-slate-900 ring-2 ring-cyan-600/30'
          : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-cyan-600/40 hover:shadow-md active:translate-y-0'

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-balance text-xl font-bold text-slate-900 sm:text-2xl [@media(max-height:700px)]:mt-2">
              Uní cada número con sus cifras
            </h2>
            {/* Level 1 explains the tap; from level 2 on, a short phone gives this line's room to the numbers. */}
            <p className={`mt-1.5 text-base text-slate-500${levelIdx === 0 ? '' : ' [@media(max-height:700px)]:hidden'}`}>
              Tocá uno de cada lado.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {matched.length} de {total}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(matched.length / total) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Two columns — once everything is paired they give way to the result card */}
      {!solved && (
        <div className="mt-4 grid grid-cols-[minmax(0,7fr)_minmax(0,4fr)] gap-3 max-[350px]:-mx-2 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:max-sm:grid-cols-[minmax(0,1fr)_5rem] [@media(max-height:700px)]:gap-2">
          <div className="flex flex-col gap-2 [@media(max-height:700px)]:gap-1.5">
            {written.map((n) => {
              const isMatched = matched.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  disabled={isMatched || solved}
                  onClick={(e) => tapWritten(n, e.timeStamp)}
                  aria-pressed={pickedWritten === n || isMatched}
                  className={[
                    'relative flex min-h-[60px] items-center rounded-2xl border-2 px-3 py-1.5 text-left text-base font-semibold leading-snug transition [@media(max-height:700px)]:min-h-[56px] [@media(max-height:700px)]:px-2.5 [@media(max-height:700px)]:py-1 [@media(max-height:700px)]:leading-[1.3]',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    pairClass(isMatched, pickedWritten === n, wrongWritten === n),
                  ].join(' ')}
                >
                  {capitalize(toWords(n))}
                  {isMatched && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 [@media(max-height:700px)]:gap-1.5">
            {digits.map((n) => {
              const isMatched = matched.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  disabled={isMatched || solved}
                  onClick={(e) => tapDigits(n, e.timeStamp)}
                  aria-label={`Número ${formatNumber(n)}`}
                  aria-pressed={pickedDigits === n || isMatched}
                  className={[
                    'relative flex min-h-[60px] items-center justify-center rounded-2xl border-2 px-1 py-1.5 font-bold tabular-nums transition [@media(max-height:700px)]:min-h-[56px] [@media(max-height:700px)]:py-1',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    DIGITS_TEXT[level.digits],
                    pairClass(isMatched, pickedDigits === n, wrongDigits === n),
                  ].join(' ')}
                >
                  {formatNumber(n)}
                  {isMatched && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!solved && (
        <p
          role="status"
          className={`mt-3 min-h-[3rem] text-center text-base font-medium [@media(max-height:700px)]:mt-2 ${hint?.ok ? 'text-cyan-700' : 'text-slate-500'}`}
        >
          {hint?.text}
        </p>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Uniste los {total} números con sus cifras: {listWithY(matched.map(formatNumber))}. ¡Completaste el{' '}
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

export function QueNumeroEs({ onComplete }: GameProps) {
  // Which set each level plays, and the order of both columns — decided once, at
  // mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PAIRS })
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
