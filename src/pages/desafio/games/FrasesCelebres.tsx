import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Frases célebres" — día 11, mes 6, atención. A famous phrase is hidden letter by letter. The alphabet is laid out
 * on a WHEEL and each letter of the phrase comes as a number: the number says how many letters to COUNT on the wheel
 * from the last letter found (the first one is counted from the start of the alphabet, where A is the 1). The player
 * counts, picks the letter on the wheel and confirms it; the letter falls into its box and the next number comes up.
 * The mechanic comes from a worksheet where a phrase is written as numbers under blank lines and an alphabet ring
 * explains how to count; here the phrase is found one letter at a time.
 *
 * ORIGINAL CONTENT. Only the idea (a numeric cryptogram counted on an alphabet ring) is borrowed. The phrases are
 * three well-known sayings that belong to nobody: a popular saying, an inscription of the temple of Apolo in Delfos
 * (ancient Greece) and the first words of "Don Quijote de la Mancha" (Cervantes, 1605). None of them is the phrase of
 * the worksheet. The numbers are NOT written by hand: they are derived from the phrase (`stepsOf`), and a throwaway
 * script (not committed) counts them again letter by letter, as a person would, and checks that the wheel gives back
 * exactly each phrase.
 *
 * THE WHEEL. 27 letters (A to Z with the Ñ after the N), clockwise from the top. 27 letters cannot be 44 px buttons on a
 * ring that fits a phone, so the wheel is ONE touch area: a tap picks the nearest letter, and the big buttons in its
 * centre (◀ ▶ to move the pick one letter, "Es esta" to confirm) are the 44 px+ targets. ▶ also works as a counting
 * aid: with nothing picked it goes to the letter that is the 1. Counting wraps around: after the Z comes the A.
 *
 * A WRONG LETTER costs ONE mistake (muted gray, never red), clears the pick and the hint grows with the misses on the
 * same letter: where to start counting, then the first stretch of the count is tinted, then the letter is ringed. A
 * double tap on "Es esta" cannot count twice: the first tap clears the pick and the button is off until a new pick.
 * Nothing is timed.
 *
 * ONE PHRASE A LEVEL, as the tallerista likes the days short. The ramp is the length: 13, 16 and 19 letters. The
 * "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back and replays the same three phrases (they are
 * fixed, there is nothing to draw). Per-level state lives in <LevelView>, keyed by run + level. Every tap within
 * SETTLE_MS of the tap that brought the level is ignored.
 *
 * totalAttempts = mistakes + every letter of the day (TOTAL_LETTERS, derived).
 */

// ── data:start ──
/** A to Z with the Ñ after the N: 27 letters, so counting 27 comes back to the same letter. */
const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'

interface PhraseDef {
  /** The phrase as it is written, with accents and spaces. */
  display: string
  /** Who said it, shown when the phrase is complete. */
  author: string
}
interface LevelDef {
  name: string
  phrase: PhraseDef
}

const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', phrase: { display: 'Querer es poder', author: 'Dicho popular' } },
  { name: 'Nivel 2', phrase: { display: 'Conócete a ti mismo', author: 'Inscripción del templo de Apolo, en Delfos' } },
  { name: 'Nivel 3', phrase: { display: 'En un lugar de la Mancha', author: 'Miguel de Cervantes, «Don Quijote de la Mancha» (1605)' } },
]

/** The letters of a phrase without accents, spaces or signs: what the wheel can give. */
function lettersOf(display: string): string[] {
  return [...display.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()].filter((c) => ALPHABET.includes(c))
}
/** Words of the phrase as lists of letters, for the boxes. */
function wordsOf(display: string): string[][] {
  return display.split(' ').map(lettersOf)
}
/** The numbers of a phrase: how many letters to count, from the last one found, to reach each letter (1 to 27). The first
 * one is counted from before the A, so the A is the 1. */
function stepsOf(letters: string[]): number[] {
  const steps: number[] = []
  let last = -1
  for (const ch of letters) {
    const at = ALPHABET.indexOf(ch)
    steps.push((((at - last) % 27) + 27) % 27 || 27)
    last = at
  }
  return steps
}
const TOTAL_LETTERS = LEVELS.reduce((sum, lvl) => sum + lettersOf(lvl.phrase.display).length, 0)
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena atención!', '¡Perfecto!']
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not pick a letter: the wheel sits where that button was. */
const SETTLE_MS = 400

const STEP_DEG = 360 / 27
/** Where a letter sits on the wheel: percent of the square, clockwise from the top, the A just after it. */
function pos(i: number, radius: number) {
  const a = ((i + 0.5) * STEP_DEG - 90) * (Math.PI / 180)
  return { left: `${50 + radius * Math.cos(a)}%`, top: `${50 + radius * Math.sin(a)}%` }
}
const RING_R = 41

/** What the player is told to count, in words. */
function countText(n: number, last: number): string {
  return last < 0 ? `Contá ${n} desde el principio: la A es la 1.` : `Contá ${n} desde la ${ALPHABET[last]}: la que sigue es la 1.`
}

/** The boxes of the phrase, grouped by word; the letters found so far are filled in. */
function PhraseBoxes({ words, found, current }: { words: string[][]; found: number; current: number }) {
  let k = 0
  return (
    <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1" aria-hidden="true">
      {words.map((w, wi) => (
        <div key={wi} className="flex gap-0.5">
          {w.map((ch) => {
            const i = k++
            const filled = i < found
            return (
              <span
                key={i}
                className={[
                  'flex h-8 w-[22px] items-center justify-center rounded-md border-2 text-base font-extrabold sm:w-7',
                  filled ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : i === current ? 'border-tiam-blue bg-white' : 'border-dashed border-slate-300 bg-white',
                ].join(' ')}
              >
                {filled ? ch : ''}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'La frase está escondida. Cada número te dice cuántas letras contar en la rueda del abecedario, empezando por la letra que sigue a la última que encontraste.',
    'La primera vez se cuenta desde el principio: la A es la 1. Tocá la rueda para elegir la letra, movela con las flechas si hace falta y apretá «Es esta».',
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
        <p className="text-base font-semibold text-slate-500">Por ejemplo:</p>
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">Si la última letra fue la C y el número es 3, contás D, E, F: la letra es la F.</p>
        <p className="mt-1 text-base text-slate-600">Al llegar a la Z se sigue con la A.</p>
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
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const letters = lettersOf(level.phrase.display)
  const words = wordsOf(level.phrase.display)
  const steps = stepsOf(letters)
  const total = letters.length

  // The letters found so far, the letter picked on the wheel and the wrong ones this letter has had.
  const [found, setFound] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [misses, setMisses] = useState(0)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const wheelRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const last = found === 0 ? -1 : ALPHABET.indexOf(letters[found - 1])
  const n = steps[Math.min(found, total - 1)]
  const target = ALPHABET.indexOf(letters[Math.min(found, total - 1)])
  // The first stretch of the count, tinted from the second miss on (the last three letters are left to the player).
  const tinted = new Set<number>()
  if (misses >= 2) for (let s = 1; s <= n - 3; s++) tinted.add((last + s + 27) % 27)

  function pickFromWheel(e: ReactMouseEvent<HTMLDivElement>) {
    if (done || e.timeStamp - since < SETTLE_MS) return
    const box = wheelRef.current?.getBoundingClientRect()
    if (!box) return
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    const r = Math.hypot(dx, dy)
    // Taps in the hole (where the buttons are) or well outside the ring do nothing.
    if (r < box.width * (RING_R / 100) * 0.72 || r > box.width * 0.56) return
    const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
    setPicked(Math.floor(deg / STEP_DEG) % 27)
    setHint(null)
  }
  function nudge(by: 1 | -1, at: number) {
    if (done || at - since < SETTLE_MS) return
    setPicked((p) => (p === null ? (by === 1 ? (last + 1 + 27) % 27 : null) : (p + by + 27) % 27))
    setHint(null)
  }
  function confirm(at: number) {
    if (done || picked === null || at - since < SETTLE_MS) return
    if (picked === target) {
      const next = found + 1
      setFound(next)
      setPicked(null)
      setMisses(0)
      if (next === total) {
        setHint(null)
        setPraise(pickOne(PRAISE))
        setDone(true)
        onSolved()
      } else {
        setHint({ text: `¡Eso es! La ${ALPHABET[picked]}. Seguí con el próximo número.`, ok: true })
      }
      return
    }
    const m = misses + 1
    setMisses(m)
    setPicked(null)
    setHint({
      text:
        m === 1
          ? `Esa no es. ${last < 0 ? 'Empezá a contar desde el principio: la A es la 1.' : `Empezá a contar desde la letra que sigue a la ${ALPHABET[last]}: esa es la 1.`}`
          : m === 2
            ? 'Esa tampoco. Te marcamos el comienzo del camino: seguí contando desde ahí.'
            : `Es la ${ALPHABET[target]}: tocala en la rueda y apretá «Es esta».`,
      ok: false,
    })
    onMistake()
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Letra {found + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          <div className="mx-auto mt-1.5 max-w-md">
            <PhraseBoxes words={words} found={found} current={found} />
          </div>

          {/* The number to count */}
          <div className="mx-auto mt-1.5 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-3 py-1 text-center">
            <p className="text-lg font-bold leading-snug text-slate-900">{countText(n, last)}</p>
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.5rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? 'Tocá la rueda en la letra que contaste.'}
          </p>

          {/* The wheel: one touch area; the buttons in the middle are the precise controls */}
          <div
            ref={wheelRef}
            role="group"
            aria-label="Rueda del abecedario"
            onClick={pickFromWheel}
            className="relative mx-auto aspect-square w-[min(100%,19rem,calc(100dvh-21rem))] touch-manipulation select-none rounded-full bg-slate-50"
          >
            {/* the start of the alphabet, where the first count begins */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-[1%] h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent border-t-slate-400"
            />
            {[...ALPHABET].map((ch, i) => {
              const isLast = i === last
              const isPicked = i === picked
              const isTarget = misses >= 3 && i === target
              return (
                <span
                  key={ch}
                  aria-hidden="true"
                  style={pos(i, RING_R)}
                  className={[
                    'pointer-events-none absolute flex h-[9.6%] w-[9.6%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-base font-bold',
                    isPicked
                      ? 'scale-125 border-2 border-tiam-blue bg-tiam-blue text-white shadow-md'
                      : isTarget
                        ? 'border-2 border-tiam-green bg-white text-slate-900 ring-2 ring-tiam-green/50'
                        : isLast
                          ? 'border-2 border-slate-700 bg-slate-700 text-white'
                          : tinted.has(i)
                            ? 'bg-sky-200 text-slate-900'
                            : 'bg-white text-slate-700',
                  ].join(' ')}
                >
                  {ch}
                </span>
              )
            })}
            {/* centre: the picked letter, the arrows and the confirm button */}
            <div className="absolute left-1/2 top-1/2 flex w-[60%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Letra anterior"
                  disabled={done || picked === null}
                  onClick={(e) => {
                    e.stopPropagation()
                    nudge(-1, e.timeStamp)
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 transition hover:border-tiam-blue/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:border-slate-200 disabled:text-slate-300"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <span className="flex h-11 w-11 items-center justify-center text-3xl font-extrabold text-slate-900" aria-live="polite">
                  {picked === null ? '' : ALPHABET[picked]}
                </span>
                <button
                  type="button"
                  aria-label="Letra siguiente"
                  disabled={done}
                  onClick={(e) => {
                    e.stopPropagation()
                    nudge(1, e.timeStamp)
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-700 transition hover:border-tiam-blue/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:border-slate-200 disabled:text-slate-300"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                disabled={done || picked === null}
                onClick={(e) => {
                  e.stopPropagation()
                  confirm(e.timeStamp)
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-tiam-blue px-2 text-base font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:bg-slate-200 disabled:text-slate-500"
              >
                Es esta
              </button>
            </div>
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
          <p className="mt-1 text-slate-600">Descubriste la frase. ¡Terminaste el {level.name.toLowerCase()}!</p>
          <div className="mt-3 rounded-2xl bg-white px-3 py-3">
            <p className="text-xl font-bold leading-snug text-slate-900">«{level.phrase.display}»</p>
            <p className="mt-1 text-base text-slate-500">{level.phrase.author}</p>
          </div>
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

export function FrasesCelebres({ onComplete }: GameProps) {
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_LETTERS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">La rueda del abecedario</h2>
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
