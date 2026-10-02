import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Frases al revés" — día 12, mes 5, lenguaje. A phrase in which every word is
 * written BACKWARDS, letters in reverse order but the words still in their
 * place: "IM ASAC SE ADNIL" is "Mi casa es linda". The player takes the words
 * one at a time (the current one is highlighted and shown big) and taps how it
 * really reads among three options; each right answer turns the word back
 * around inside the phrase, so the sentence rebuilds itself in front of them.
 *
 * Reading backwards is a language exercise with a visual-attention twist:
 * ADNIL has to be re-read from its last letter, and the options are chosen to
 * punish the lazy readings. EVERY option is a real Spanish word (never a string
 * of letters that gives itself away by not being one), so the only way to the
 * right one is to reverse the printed word: the word as it is printed when that
 * is a word too ("se" for ES, "los" for SOL), a real word that differs in a
 * single letter ("cosa" for CASA, "lindo" for LINDA), a look-alike ("saca",
 * "trapecio" for TRAPITOS). Some short words really are two words, one in each
 * direction ("es" / "se", "los" / "sol"), which is the best reason to go one
 * letter at a time. Only one of the three options is the reversal of the
 * printed word, so there is nothing to guess about the phrase itself: it is the
 * payoff, not the question. A throwaway Node script (not committed) confirmed
 * for every word that its two wrong options are different from the right one
 * and from each other, that exactly one option is the reversal of the printed
 * word, that no word is a palindrome or a single letter (it would read the
 * same), that nothing carries an accent (an accent cannot survive being turned
 * around), that the two phrases of a level have the same number of words, and
 * that none of the made-up strings the first version offered is left.
 *
 * A wrong option greys out for that word (the choices shrink instead of
 * repeating the same mistake), costs one mistake and says how to read it; the
 * option is disabled at once, so a double tap cannot count twice. No timer,
 * nothing red. The phrases are everyday sentences and traditional refranes.
 *
 * Double taps are judged by the click's own timeStamp: every tap within SETTLE_MS of the
 * tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is ignored, so the
 * second tap of a double tap never answers the first word (the options sit right where
 * that button was); and while the right option shows its check every option is off, which
 * swallows a double tap on the RIGHT one before the next word's options replace it.
 *
 * Ramp: a 4-word everyday phrase → a 5-word refrán → a 7-word refrán. ONE
 * phrase per level: each level has two authored ones and one is picked ONCE at
 * mount (`epoch`, together with the order of every word's options), so
 * "Repetir" replays exactly the same three. Per-level state lives in
 * <LevelView>, keyed by run + level. A "¿Cómo se juega?" screen with a worked
 * example opens the day; "Repetir" never brings it back.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface WordDef {
  /** The word as it reads: lower case, no accent. */
  word: string
  /** Two other readings, both real words — neither may be the word, and they must differ from each other. */
  wrong: [string, string]
}
interface PhraseDef {
  /** The phrase as it reads, with capital letter and punctuation. */
  display: string
  words: WordDef[]
}
interface LevelDef {
  name: string
  phrases: PhraseDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    phrases: [
      {
        display: 'Mi casa es linda.',
        words: [
          { word: 'mi', wrong: ['me', 'si'] },
          { word: 'casa', wrong: ['cosa', 'saca'] },
          { word: 'es', wrong: ['se', 'en'] },
          { word: 'linda', wrong: ['lindo', 'linde'] },
        ],
      },
      {
        display: 'Hoy hace mucho sol.',
        words: [
          { word: 'hoy', wrong: ['hay', 'voy'] },
          { word: 'hace', wrong: ['hice', 'haga'] },
          { word: 'mucho', wrong: ['mucha', 'macho'] },
          { word: 'sol', wrong: ['los', 'sal'] },
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    phrases: [
      {
        display: 'Perro que ladra, no muerde.',
        words: [
          { word: 'perro', wrong: ['pero', 'perra'] },
          { word: 'que', wrong: ['fue', 'ver'] },
          { word: 'ladra', wrong: ['ladro', 'ladre'] },
          { word: 'no', wrong: ['ni', 'si'] },
          { word: 'muerde', wrong: ['muerda', 'muerte'] },
        ],
      },
      {
        display: 'Quien tiene boca, se equivoca.',
        words: [
          { word: 'quien', wrong: ['queso', 'quena'] },
          { word: 'tiene', wrong: ['viene', 'tinte'] },
          { word: 'boca', wrong: ['boda', 'roca'] },
          { word: 'se', wrong: ['es', 'si'] },
          { word: 'equivoca', wrong: ['equivoco', 'equivale'] },
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    phrases: [
      {
        display: 'Los trapitos sucios se lavan en casa.',
        words: [
          { word: 'los', wrong: ['sol', 'las'] },
          { word: 'trapitos', wrong: ['trapecio', 'trapiche'] },
          { word: 'sucios', wrong: ['sucias', 'suelos'] },
          { word: 'se', wrong: ['es', 'si'] },
          { word: 'lavan', wrong: ['lavar', 'lavas'] },
          { word: 'en', wrong: ['el', 'un'] },
          { word: 'casa', wrong: ['cosa', 'saca'] },
        ],
      },
      {
        display: 'No hay mal que dure cien años.',
        words: [
          { word: 'no', wrong: ['ni', 'si'] },
          { word: 'hay', wrong: ['hoy', 'ley'] },
          { word: 'mal', wrong: ['mar', 'mil'] },
          { word: 'que', wrong: ['fue', 'ver'] },
          { word: 'dure', wrong: ['dura', 'duro'] },
          { word: 'cien', wrong: ['cine', 'sien'] },
          { word: 'años', wrong: ['aros', 'ajos'] },
        ],
      },
    ],
  },
]

/** How a word is printed in the game: letters in reverse order, in capitals. */
function reversed(word: string): string {
  return [...word].reverse().join('').toUpperCase()
}

const TOTAL_WORDS = LEVELS.reduce((sum, lvl) => sum + lvl.phrases[0].words.length, 0)
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

interface PreparedWord {
  /** The word as it is printed in the phrase (backwards). */
  shown: string
  correct: string
  /** Shuffled once, at mount — never re-shuffled, or the options would jump after a wrong tap. */
  options: string[]
}
interface LevelContent {
  display: string
  words: PreparedWord[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const phrase = pickOne(lvl.phrases)
    return {
      display: phrase.display,
      words: phrase.words.map((w) => ({
        shown: reversed(w.word),
        correct: w.word,
        options: shuffle([w.word, ...w.wrong]),
      })),
    }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente lectura!', '¡Así se lee!', '¡Perfecto!', '¡Qué buena vista!']
const NUDGES = [
  'Esa no es. Leela empezando por la última letra.',
  'Casi. Probá leerla desde el final hacia el principio.',
  'No es esa. Empezá por la última letra y volvé.',
]

/** A tap this soon after the tap that brought the level here ("Empezar", "Siguiente nivel", "Repetir") is the
 * second tap of a double tap, and it must not answer the first word (the options sit right where that button
 * was). Long enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Las letras de cada palabra están escritas al revés.',
    'Leé la palabra resaltada desde la última letra hasta la primera.',
    'Tocá cómo se lee de verdad.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-green/25 bg-tiam-green/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-2xl bg-white p-3 text-center">
        <p className="text-sm font-semibold text-slate-500">Por ejemplo</p>
        <p className="mt-1 text-2xl font-bold tracking-wide text-slate-900">YOS</p>
        <p className="text-base text-slate-500">de atrás para adelante: S - O - Y</p>
        <p className="mt-1 text-xl font-bold text-green-700">se lee «soy»</p>
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
  const { words, display } = content
  const total = words.length

  // How many words are turned back around: the word to read now is `filled`.
  const [filled, setFilled] = useState(0)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [wrongOptions, setWrongOptions] = useState<string[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const advanceTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const solved = filled >= total

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
  const current = solved ? null : words[filled]

  function handlePick(option: string, at: number) {
    // A wrong option is disabled the moment it is tapped, so a double tap on it
    // is ignored; a double tap on the right one must not skip the next word; and
    // one this soon after the button that brought the level ("Empezar", "Siguiente
    // nivel", "Repetir") must not answer the first word.
    if (!current || isAdvancing || wrongOptions.includes(option) || at - since < SETTLE_MS) return
    if (option === current.correct) {
      setIsAdvancing(true)
      // The only timer in the game: a short pause so the word is seen turning
      // around before the next one takes its place.
      advanceTimerRef.current = window.setTimeout(() => {
        const next = filled + 1
        setFilled(next)
        setWrongOptions([])
        setHint(null)
        setIsAdvancing(false)
        if (next >= total) {
          setPraise(pickOne(PRAISE))
          onSolved()
        }
      }, 600)
    } else {
      setWrongOptions((w) => [...w, option])
      setHint(pickOne(NUDGES))
      onMistake()
    }
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Leé cada palabra al revés</h2>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {filled} de {total}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(filled / total) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* The phrase: backwards words turn into real ones as they are solved */}
      <div
        role="group"
        aria-label={solved ? `Frase: ${display}` : 'Frase al revés'}
        className="mt-4 flex flex-wrap justify-center gap-2 rounded-2xl bg-slate-50 p-3"
      >
        {words.map((w, i) => {
          const isDone = i < filled
          const isCurrent = i === filled && !solved
          return (
            <span
              key={i}
              className={[
                'flex min-h-[36px] items-center rounded-lg border-2 px-2.5 text-lg font-bold',
                isDone
                  ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                  : isCurrent
                    ? 'border-green-700 bg-white text-slate-900 ring-2 ring-green-700/25'
                    : 'border-slate-200 bg-white text-slate-500',
              ].join(' ')}
            >
              {isDone ? w.correct : w.shown}
            </span>
          )
        })}
      </div>

      {!solved && current && (
        <>
          {/* The word to read, big */}
          <div className="mt-3 text-center">
            <p className="text-4xl font-bold tracking-wide text-slate-900">{current.shown}</p>
            <p className="mt-0.5 text-base text-slate-500">¿Cómo se lee?</p>
          </div>

          <div className="mx-auto mt-3 flex max-w-xs flex-col gap-2.5">
            {current.options.map((option) => {
              const isWrong = wrongOptions.includes(option)
              const isCorrectFound = isAdvancing && option === current.correct
              return (
                <button
                  key={option}
                  type="button"
                  disabled={isWrong || isAdvancing}
                  onClick={(e) => handlePick(option, e.timeStamp)}
                  className={[
                    'flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border-2 px-4 py-2 text-left text-xl font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectFound
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span>{option}</span>
                  {isCorrectFound && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-3 min-h-[3rem] text-center text-base font-medium text-slate-500">
            {!isAdvancing && hint}
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
            La frase decía: <span className="font-bold text-slate-800">«{display}»</span> ¡Completaste el{' '}
            {level.name.toLowerCase()}!
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

export function FrasesAlReves({ onComplete }: GameProps) {
  // Which phrase each level plays, and the order of every word's options —
  // decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Leé cada palabra al revés</h2>
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
