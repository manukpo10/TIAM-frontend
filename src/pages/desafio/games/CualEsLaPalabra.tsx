import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, HelpCircle, RotateCcw, Sparkles, X } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Cuál es?" — día 25, mes 6, ejecutivas (razonamiento). A board of words and a list of clues that come out ONE AT A
 * TIME. Each new clue is a rule ("Tiene tres sílabas", "No termina en A"): the player crosses out, by tapping them, every
 * word that does not meet it; when all of them are crossed the next clue arrives, and when the last clue has been
 * applied exactly one word is left. The mechanic comes from a worksheet where a word is sought among many by a list of
 * its features; here the board, the clues and their order are TIAM's own, and the clues are revealed gradually.
 *
 * WHAT MAKES IT A DIFFERENT ACTIVITY FROM "Palabras con condiciones" (mes 5), which also checks words against a rule:
 * there each question has four words, ONE rule (or two or three at once) and the player taps the single word that
 * meets it. Here the board is bigger (8 to 10 words), the clues are cumulative and arrive one by one, the player's
 * action is to DISCARD (cross out what fails, not pick what fits) and what stays on the board after each clue is the
 * input of the next one. None of its words is used here (the check script rejects them).
 *
 * THE RULES ARE DATA AND THE CHECK IS THE RULE. A clue is a small object (`syllables`, `starts`, `ends`, `length`,
 * `atLeast`, `has`, or a `not` of the last three) that `describe` turns into the sentence the player reads and `meets`
 * evaluates, so the sentence on screen and the words that are accepted cannot drift apart. Syllables come from a table
 * written and checked BY HAND (WORDS: only words with no diphthong or hiatus, and none with CH, LL or RR, so a player who
 * counts letters under the old alphabet or splits a vowel pair reaches the same answer). A throwaway Node script (not
 * committed) checks for every board that EVERY clue crosses out at least one word, that exactly ONE word is left at the
 * end, that the board has no repeated word and that no word is an answer elsewhere in the month.
 *
 * LIVE FEEDBACK, NOTHING RED. A tap on a word that fails the clue crosses it out (a line through it and an X, so the
 * colour is never the only signal) and says why in one line; a tap on a word that DOES meet it costs ONE mistake (once
 * per word and clue: tapping it again is free), the word is ringed and the line says why it stays. Nothing is timed but
 * a short pause when a clue is finished, during which the board is off. A visible "Ayuda" button crosses out one word
 * that fails, for one mistake, so nobody is stuck on a clue they cannot decide.
 *
 * THREE LEVELS, ONE BOARD EACH (the tallerista asked for short days; the three boards are 3, 4 and 4 clues). The ramp:
 * level 1 is plain features (syllables and a letter inside); level 2 mixes syllables, letters and length;
 * level 3 has 8 words of eight to ten letters, four clues and two negations ("No termina en A", "No empieza con C") on top of counting four syllables, and no clue asks to count letters (counting nine of them was too heavy). There is nothing to choose at
 * mount (each level has one authored board and the words keep their order), so "Repetir" replays the same content.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. A tap within SETTLE_MS of the tap that brought the level is ignored.
 *
 * totalAttempts = mistakes + every word the player has to cross out in the day (TOTAL_CROSSES, derived).
 */

// ── data:start ──
type Base =
  | { kind: 'starts'; letter: string }
  | { kind: 'ends'; letter: string }
  | { kind: 'has'; letter: string }
type Rule =
  | Base
  | { kind: 'syllables'; n: number }
  | { kind: 'length'; n: number }
  | { kind: 'atLeast'; n: number }
  | { kind: 'not'; rule: Base }

/** Every word with its syllables written by hand (plain key -> how it is written and split). */
const WORDS: Record<string, string> = {
  melon: 'me-lón',
  pomelo: 'po-me-lo',
  cereza: 'ce-re-za',
  anana: 'a-na-ná',
  palta: 'pal-ta',
  manteca: 'man-te-ca',
  pepino: 'pe-pi-no',
  lenteja: 'len-te-ja',
  cortina: 'cor-ti-na',
  florero: 'flo-re-ro',
  estufa: 'es-tu-fa',
  candado: 'can-da-do',
  campera: 'cam-pe-ra',
  cafetera: 'ca-fe-te-ra',
  termo: 'ter-mo',
  zocalo: 'zó-ca-lo',
  lavabo: 'la-va-bo',
  batidora: 'ba-ti-do-ra',
  tostadora: 'tos-ta-do-ra',
  albahaca: 'al-ba-ha-ca',
  lavandina: 'la-van-di-na',
  picaporte: 'pi-ca-por-te',
  calefactor: 'ca-le-fac-tor',
  abrelatas: 'a-bre-la-tas',
  pantufla: 'pan-tu-fla',
}

interface LevelDef {
  name: string
  /** Plain keys of WORDS, in the order they are shown. */
  board: string[]
  /** The clues, in the order they come out. */
  rules: Rule[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    board: ['melon', 'pomelo', 'cereza', 'anana', 'palta', 'manteca', 'pepino', 'lenteja'],
    rules: [{ kind: 'syllables', n: 3 }, { kind: 'has', letter: 'P' }, { kind: 'has', letter: 'M' }],
  },
  {
    name: 'Nivel 2',
    board: ['cortina', 'florero', 'estufa', 'candado', 'campera', 'cafetera', 'termo', 'zocalo', 'lavabo'],
    rules: [
      { kind: 'syllables', n: 3 },
      { kind: 'has', letter: 'O' },
      { kind: 'length', n: 7 },
      { kind: 'ends', letter: 'A' },
    ],
  },
  {
    name: 'Nivel 3',
    board: [
      'batidora',
      'tostadora',
      'albahaca',
      'lavandina',
      'picaporte',
      'calefactor',
      'abrelatas',
      'pantufla',
    ],
    rules: [
      { kind: 'syllables', n: 4 },
      { kind: 'not', rule: { kind: 'ends', letter: 'A' } },
      { kind: 'has', letter: 'L' },
      { kind: 'not', rule: { kind: 'starts', letter: 'C' } },
    ],
  },
]

const NUMBER_WORDS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once']

/** How a word is written, with its accent and without the hyphens. */
function shown(key: string): string {
  return WORDS[key].replace(/-/g, '')
}
function syllableCount(key: string): number {
  return WORDS[key].split('-').length
}

function meets(key: string, rule: Rule): boolean {
  switch (rule.kind) {
    case 'syllables':
      return syllableCount(key) === rule.n
    case 'length':
      return key.length === rule.n
    case 'atLeast':
      return key.length >= rule.n
    case 'starts':
      return key[0] === rule.letter.toLowerCase()
    case 'ends':
      return key[key.length - 1] === rule.letter.toLowerCase()
    case 'has':
      return key.includes(rule.letter.toLowerCase())
    case 'not':
      return !meets(key, rule.rule)
  }
}

function describe(rule: Rule): string {
  switch (rule.kind) {
    case 'syllables':
      return `Tiene ${NUMBER_WORDS[rule.n]} sílabas.`
    case 'length':
      return `Tiene ${NUMBER_WORDS[rule.n]} letras.`
    case 'atLeast':
      return `Tiene ${NUMBER_WORDS[rule.n]} letras o más.`
    case 'starts':
      return `Empieza con la letra ${rule.letter}.`
    case 'ends':
      return `Termina en ${rule.letter}.`
    case 'has':
      return `Tiene la letra ${rule.letter}.`
    case 'not':
      return `No ${describe(rule.rule).charAt(0).toLowerCase()}${describe(rule.rule).slice(1)}`
  }
}

/** The fact about a word that decides a clue, in a few words ("se separa jar-dín: 2 sílabas"). */
function reason(key: string, rule: Rule): string {
  const w = shown(key).toUpperCase()
  switch (rule.kind) {
    case 'syllables': {
      const n = syllableCount(key)
      return `se separa ${WORDS[key]}: ${n} ${n === 1 ? 'sílaba' : 'sílabas'}`
    }
    case 'length':
    case 'atLeast':
      return `tiene ${key.length} letras`
    case 'starts':
      return `empieza con ${w[0]}`
    case 'ends':
      return `termina en ${w[w.length - 1]}`
    case 'has':
      return meets(key, rule) ? `tiene la letra ${rule.letter}` : `no tiene la letra ${rule.letter}`
    case 'not':
      return reason(key, rule.rule)
  }
}

/** How many words each clue crosses out, in order (computed from the data). */
function crossesPerStep(level: LevelDef): number[] {
  let alive = [...level.board]
  return level.rules.map((rule) => {
    const out = alive.filter((k) => !meets(k, rule))
    alive = alive.filter((k) => meets(k, rule))
    return out.length
  })
}
const TOTAL_CROSSES = LEVELS.reduce((n, l) => n + crossesPerStep(l).reduce((a, b) => a + b, 0), 0)

/** The how-to example: its words are not in the game. */
const EXAMPLE = {
  board: ['canasta', 'tambor', 'raqueta'],
  rule: 'Tiene la letra Q.',
  answer: 'raqueta',
}
// ── data:end ──

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen razonamiento!', '¡Perfecto!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
/** The pause when a clue is finished, with its last word crossed, before the next clue arrives. */
const ADVANCE_MS = 1300
/** A tap this soon after the tap that brought the level is the second tap of a double tap and must not cross a word. */
const SETTLE_MS = 400

const NEXT_BUTTON =
  'inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark'

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Te damos una lista de palabras y una pista. Tachá, tocándolas, las palabras que NO cumplen la pista.',
    'Cuando tachás todas, llega otra pista. Al final queda una sola palabra: esa es.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-base font-semibold text-slate-500">Por ejemplo, con la pista «{EXAMPLE.rule}»:</p>
        <p className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-lg font-bold uppercase text-slate-900">
          {EXAMPLE.board.map((w) =>
            w === EXAMPLE.answer ? (
              <span key={w}>{w}</span>
            ) : (
              <span key={w} className="text-slate-400 line-through">
                {w}
              </span>
            ),
          )}
        </p>
        <p className="mt-1 text-base text-slate-600">Se tachan las que no la tienen y queda «{EXAMPLE.answer}».</p>
      </div>
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
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1

  const [step, setStep] = useState(0)
  const [crossed, setCrossed] = useState<string[]>([])
  // Words that meet the current clue and were tapped (they cost one mistake, once), and which clue that was for.
  const [stays, setStays] = useState<string[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const timerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const rule = level.rules[step]
  const alive = level.board.filter((k) => !crossed.includes(k))
  const winner = done ? alive[0] : undefined

  function cross(key: string) {
    const next = [...crossed, key]
    setCrossed(next)
    const left = level.board.filter((k) => !next.includes(k))
    if (left.some((k) => !meets(k, rule))) return
    // This clue is finished.
    setAdvancing(true)
    if (step === level.rules.length - 1) {
      setHint({ text: `¡Quedó una sola! «${shown(left[0])}».`, ok: true })
      timerRef.current = window.setTimeout(() => {
        setPraise(pickOne(PRAISE))
        setDone(true)
        setAdvancing(false)
        onSolved()
      }, ADVANCE_MS)
    } else {
      timerRef.current = window.setTimeout(() => {
        setStep((s) => s + 1)
        setStays([])
        setHint(null)
        setAdvancing(false)
      }, ADVANCE_MS)
    }
  }

  function tap(key: string, at: number) {
    if (advancing || done || at - since < SETTLE_MS || crossed.includes(key)) return
    if (!meets(key, rule)) {
      setHint({ text: `¡Bien! «${shown(key)}» ${reason(key, rule)}. Se tacha.`, ok: true })
      cross(key)
      return
    }
    const id = `${step}:${key}`
    if (!stays.includes(id)) {
      setStays((s) => [...s, id])
      onMistake()
    }
    setHint({ text: `«${shown(key)}» ${reason(key, rule)}: cumple la pista y se queda. Buscá una que NO la cumpla.`, ok: false })
  }

  function help(at: number) {
    if (advancing || done || at - since < SETTLE_MS) return
    const key = alive.find((k) => !meets(k, rule))
    if (!key) return
    onMistake()
    setHint({ text: `Una que no cumple: «${shown(key)}» ${reason(key, rule)}. Se tacha.`, ok: false })
    cross(key)
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Pista {step + 1} de {level.rules.length}
          </span>
        )}
      </div>

      {/* The clues: the ones already applied, then the current one. */}
      <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 [@media(max-height:700px)]:py-2">
        <ul className="space-y-0.5">
          {level.rules.slice(0, done ? level.rules.length : step).map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-base leading-snug text-slate-600">
              <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
              {describe(r)}
            </li>
          ))}
        </ul>
        {!done && (
          <p className="mt-1 text-xl font-bold leading-snug text-slate-900 [@media(max-height:700px)]:text-lg" aria-live="polite">
            <span className="text-sm font-bold uppercase tracking-wide text-tiam-blue">Pista nueva · </span>
            {describe(rule)}
          </p>
        )}
      </div>

      {/* The board */}
      <div role="group" aria-label="Palabras" className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-2">
        {level.board.map((key) => {
          const isCrossed = crossed.includes(key)
          const isWinner = winner === key
          const stays_ = stays.includes(`${step}:${key}`) && !done
          return (
            <button
              key={key}
              type="button"
              disabled={isCrossed || advancing || done}
              aria-label={isCrossed ? `${shown(key)}, tachada` : shown(key)}
              onClick={(e) => tap(key, e.timeStamp)}
              className={[
                'flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-2 px-1 text-base font-bold uppercase transition sm:text-lg sm:tracking-wide focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 [@media(max-height:700px)]:min-h-[44px]',
                isCrossed
                  ? 'border-slate-200 bg-slate-100 text-slate-500 line-through'
                  : isWinner
                    ? 'border-tiam-green bg-tiam-green/15 text-slate-900'
                    : stays_
                      ? 'border-tiam-blue bg-white text-slate-900 ring-2 ring-tiam-blue/40'
                      : 'border-slate-300 bg-white text-slate-900 hover:border-tiam-blue/50',
              ].join(' ')}
            >
              {isCrossed && <X className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" />}
              {isWinner && <Check className="h-5 w-5 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
              {shown(key)}
            </button>
          )
        })}
      </div>

      {!done && (
        <div className="sticky bottom-0 z-10 mx-auto mt-2 flex max-w-md items-center gap-2 bg-white/95 pb-1 pt-1">
          <p
            role="status"
            className={`min-h-[3.5rem] flex-1 text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-600'}`}
          >
            {hint?.text}
          </p>
          <button
            type="button"
            aria-label="Ayuda: tachar una palabra"
            disabled={advancing}
            onClick={(e) => help(e.timeStamp)}
            className="inline-flex min-h-[48px] shrink-0 flex-col items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold leading-tight text-slate-700 transition hover:border-tiam-blue/50 disabled:opacity-50"
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
            Ayuda
          </button>
        </div>
      )}

      {done && (
        <div ref={resultRef} className="mt-3 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Era «{winner && shown(winner)}». ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button type="button" onClick={(e) => onRepeat(e.timeStamp)} className={NEXT_BUTTON}>
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button type="button" onClick={(e) => onNext(e.timeStamp)} className={NEXT_BUTTON}>
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

export function CualEsLaPalabra({ onComplete }: GameProps) {
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_CROSSES })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuál es la palabra?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
