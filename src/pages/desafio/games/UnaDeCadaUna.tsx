import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Una de cada una" — día 21, mes 6, memoria. Open requests about the player's OWN life, one at a time: "un lugar al
 * que fuiste esta semana". The player writes one answer and taps "Listo", or taps "La pensé" if it was only in the
 * head, and the next request comes. At the end of each level the list of what was answered is shown, and at the end
 * of the day the whole list. The mechanic comes from a worksheet that dictates categories ("something you eat for
 * breakfast: ___") to be filled in one by one; the requests here are TIAM's own, written for adult life.
 *
 * WHY THERE IS NO STUDY SCREEN. The house rule for a memory game (feedback: memory games must give the information
 * first and ask afterwards, never depending on what the player happens to know) is about games that CHECK an answer
 * against something. Here nothing is checked: every answer is the player's own memory of this week, this month or
 * their childhood, there is no right one, nothing can be wrong and nothing depends on general knowledge. What is
 * exercised is evoking an episode on demand, with more conditions each level, and the list at the end lets the
 * player see what they recalled.
 *
 * OPEN, NO ERROR: `mistakes: 0` and `totalAttempts` = the number of requests. Nothing is timed and an answer can be
 * as short as one word. Both buttons are always in view (they stick to the bottom of the card).
 * An answer can also be long and have no spaces (the box allows 80 characters, 80 "W" were tried): the list breaks the
 * line anywhere (`overflow-wrap:anywhere`), so it never pushes the card sideways.
 *
 * ORIGINAL CONTENT. Only the mechanic is borrowed. None of the worksheet's requests, nor its categories, is used:
 * the requests ask for places, people, shopping, food, music, holidays and gifts of adult life (a throwaway script,
 * not committed, rejects the worksheet's wording). THREE REQUESTS A LEVEL, as the tallerista likes the days short.
 * Ramp: level 1 asks for something recent with one condition (a place of this week, a person of today, what is
 * carried), level 2 adds a second condition ("hayas probado este mes y que te haya gustado") and level 3 asks for
 * older memories with three conditions. The requests have a fixed order, so "Repetir" replays exactly the same nine
 * (the answers start empty again).
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level; the answers of the day live in the parent for the final list. Double taps: every tap within
 * SETTLE_MS of the tap that changed the screen is ignored (the buttons of one request sit where the buttons of the
 * next one are). Text to read is 16 px or more, the input too.
 */

// ── data:start ──
interface AskDef {
  /** The request, as said to the player. */
  ask: string
  /** A short name for it, for the list at the end. */
  tag: string
}
interface LevelDef {
  name: string
  asks: AskDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    asks: [
      { ask: 'Un lugar al que fuiste esta semana.', tag: 'Lugar de esta semana' },
      { ask: 'Una persona con la que hablaste hoy.', tag: 'Persona de hoy' },
      { ask: 'Algo que llevás siempre en la cartera o en el bolsillo.', tag: 'Lo que llevás encima' },
    ],
  },
  {
    name: 'Nivel 2',
    asks: [
      { ask: 'Una comida que hayas probado este mes y que te haya gustado.', tag: 'Comida del mes que te gustó' },
      { ask: 'Algo que hayas comprado este mes y que no sea comida.', tag: 'Compra del mes' },
      { ask: 'Una canción que hayas escuchado hace poco y que te traiga un recuerdo.', tag: 'Canción con recuerdo' },
    ],
  },
  {
    name: 'Nivel 3',
    asks: [
      { ask: 'Un lugar donde hayas pasado unas vacaciones, que te haya gustado mucho y al que volverías.', tag: 'Vacaciones que repetirías' },
      { ask: 'Un plato que se cocinaba en tu casa cuando eras chico o chica y que hoy casi no se prepara.', tag: 'Plato de tu infancia' },
      { ask: 'Un regalo que hayas recibido, que todavía conserves y que te haga acordar de alguien.', tag: 'Regalo que conservás' },
    ],
  },
]
const TOTAL_ASKS = LEVELS.reduce((sum, lvl) => sum + lvl.asks.length, 0)

/** The request of the how-to screen: it is not in the game. */
const EXAMPLE_ASK = 'Un libro o una revista que hayas hojeado el último mes.'
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** What the player answered: the text, or null when it was only thought. */
type Answer = string | null

const PRAISE = ['¡Muy bien!', '¡Qué buena memoria!', '¡Así se hace!', '¡Excelente!', '¡Cuántos recuerdos!']
/** A tap this soon after the tap that changed the screen is the second tap of a double tap and must not land. */
const SETTLE_MS = 400

function AnswerList({ rows }: { rows: { tag: string; answer: Answer }[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
      {rows.map((r) => (
        <li key={r.tag} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
          <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="text-slate-500">{r.tag}: </span>
            <span className="font-bold text-slate-900">{r.answer ?? 'lo pensaste'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Te pedimos de a una cosas de tu vida, por ejemplo un lugar o una persona.',
    'Escribí tu respuesta y tocá «Listo», o tocá «La pensé» si la pensaste sin escribirla.',
    'Al final de cada nivel te mostramos tu lista. No hay respuestas equivocadas.',
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
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">{EXAMPLE_ASK}</p>
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
  /** Everything answered in the day so far, level by level (for the final list). */
  answers: Answer[][]
  onAnswer: (askIdx: number, answer: Answer) => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, since, answers, onAnswer, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.asks.length

  const [idx, setIdx] = useState(0)
  const [value, setValue] = useState('')
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const settleFromRef = useRef(since)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  // A finished level shows its list and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const ask = level.asks[idx]
  const ready = value.trim().length > 0

  function answer(text: Answer, at: number) {
    if (at - settleFromRef.current < SETTLE_MS) return
    if (text !== null && text.trim().length === 0) return
    settleFromRef.current = at
    onAnswer(idx, text === null ? null : text.trim())
    if (idx < total - 1) {
      setIdx((i) => i + 1)
      setValue('')
    } else {
      setPraise(pickOne(PRAISE))
      setDone(true)
      onSolved()
    }
  }

  // The list of the level that just ended, or of the whole day when it is the last one.
  const rows = (isLast ? LEVELS.flatMap((lvl, l) => lvl.asks.map((a, k) => ({ tag: a.tag, answer: answers[l]?.[k] ?? null }))) : level.asks.map((a, k) => ({ tag: a.tag, answer: answers[levelIdx]?.[k] ?? null })))

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Pedido {idx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <form
          className="mx-auto mt-3 max-w-md"
          onSubmit={(e) => {
            e.preventDefault()
            answer(value, e.timeStamp)
          }}
        >
          <div className="rounded-2xl border-2 border-tiam-blue bg-tiam-blue/5 px-4 py-4 text-center">
            <p className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{ask.ask}</p>
          </div>
          <label className="mt-3 block">
            <span className="block text-base font-semibold text-slate-600">Tu respuesta</span>
            <input
              type="text"
              value={value}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 min-h-[52px] w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-lg text-slate-900 focus:border-tiam-blue focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/30"
            />
          </label>

          {/* The buttons stick to the bottom of the card, so they are always in view on a short phone. */}
          <div className="sticky bottom-0 z-10 mt-3 flex gap-2 bg-white/95 pb-0.5 pt-1">
            <button
              type="button"
              onClick={(e) => answer(null, e.timeStamp)}
              className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white px-3 text-lg font-bold text-slate-700 transition hover:border-tiam-blue/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50"
            >
              La pensé
            </button>
            <button
              type="submit"
              disabled={!ready}
              className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-tiam-blue px-3 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
            >
              Listo
            </button>
          </div>
        </form>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {isLast ? 'Esta es tu lista de hoy.' : `Recordaste las ${total} cosas. ¡Completaste el ${level.name.toLowerCase()}!`}
          </p>
          <AnswerList rows={rows} />
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

export function UnaDeCadaUna({ onComplete }: GameProps) {
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  // What the player answered in the day, level by level.
  const [answers, setAnswers] = useState<Answer[][]>(() => LEVELS.map(() => []))
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    // Open game: there is no wrong answer, so nothing is a mistake.
    onComplete({ mistakes: 0, totalAttempts: TOTAL_ASKS })
  }
  function handleAnswer(askIdx: number, answer: Answer) {
    setAnswers((all) =>
      all.map((lvl, l) => {
        if (l !== levelIdx) return lvl
        const next = [...lvl]
        next[askIdx] = answer
        return next
      }),
    )
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
    setAnswers(LEVELS.map(() => []))
    setRunKey((k) => k + 1)
  }

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tu lista de recuerdos</h2>
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
      answers={answers}
      onAnswer={handleAnswer}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
