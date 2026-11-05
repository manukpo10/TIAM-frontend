import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La agenda de la semana" — día 27, mes 6, memoria. A study → recall game on a page of a notebook agenda. First the
 * week's agenda is shown for as long as the player wants, until "Ya la miré" (no clock: looking speed varies a lot in this
 * audience); then it disappears and three questions are asked one at a time, with 3 or 4 options to tap. Level 1: three
 * entries, a day and an activity. Level 2: four entries with day, hour and activity (hours in Argentine style, "10 h",
 * "15.30 h"). Level 3: five entries with an hour and a person or a place, and questions that combine facts: which thing
 * you have the day AFTER another one, which of four starts earliest in the day regardless of the day (the day order and
 * the hour order disagree on purpose), and how many things fall between two hours.
 *
 * It does not come from a worksheet: the day replaces a worksheet that repeated an earlier month, and every agenda, name
 * and question here is written for this game, for adult life (a podiatrist, a hairdresser, a dinner at a friend's).
 *
 * EVERYTHING ASKED IS ON THE STUDY SCREEN (a memory game never depends on what the player already knows), and every
 * wrong option is another real entry of the same agenda (another day, another hour, another activity), so nothing can be
 * ruled out for being unfamiliar; the one exception is the count question of level 3, whose options are the numbers
 * Una to Cuatro. Each level has its own agenda and no activity repeats in the day. A throwaway script (not
 * committed) rebuilds every answer from the agenda with its own code and compares it with `answerOf`, checks that every
 * question has exactly one right option and that the options are different, that the questions are different, that the
 * texts say what their `spec` computes, and the level ramp. Known weakness of level 1: with only three entries the last
 * question can be reached by elimination from the first two.
 *
 * NO DEAD END, NOTHING RED. A wrong option is greyed (muted gray, struck through, never red) and costs ONE mistake; the
 * message is plain and a visible "Volver a mirar la agenda" button shows the agenda again and returns to the SAME question
 * without counting anything. The question stays until it is answered, and since every wrong option is greyed for good
 * there is always a way out. A right answer says why in one line and, after a short pause (the only timer), the next
 * question comes; every tap in the first 400 ms of a question or of a screen is ignored so a double tap never answers it.
 *
 * Whatever has to be read is 16 px or more. The study screen and its button fit a 320 x 568 phone without scrolling (they
 * were measured in the browser at 375 x 667 and 320 x 568).
 *
 * The order of the options of every question is chosen ONCE at mount (`epoch`), so "Repetir" replays exactly the same
 * agendas, questions and option order. A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back.
 * Per-level state lives in <LevelView>, keyed by run + level.
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived).
 */

// ── data:start ──
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const COUNT_WORDS = ['Ninguna', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco']

interface Entry {
  day: string
  /** [hour, minutes]; levels 2 and 3 only. */
  time?: [number, number]
  what: string
}
type Spec =
  | { kind: 'dayOf'; e: number }
  | { kind: 'whatOn'; day: string }
  | { kind: 'hourOf'; e: number }
  | { kind: 'whatAt'; time: [number, number] }
  | { kind: 'dayHourOf'; e: number }
  | { kind: 'afterOf'; e: number }
  | { kind: 'earliestOf'; among: number[] }
  | { kind: 'countBetween'; from: number; to: number }
interface Question {
  prompt: string
  spec: Spec
  /** One line, shown after a right answer. */
  why: string
}
interface LevelDef {
  name: string
  agenda: Entry[]
  questions: Question[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    agenda: [
      { day: 'Martes', what: 'Ir al dentista' },
      { day: 'Jueves', what: 'Ir al banco' },
      { day: 'Sábado', what: 'Almuerzo con los nietos' },
    ],
    questions: [
      { prompt: '¿Qué tenés el jueves?', spec: { kind: 'whatOn', day: 'Jueves' }, why: 'El jueves tenés que ir al banco.' },
      { prompt: '¿Qué día vas al dentista?', spec: { kind: 'dayOf', e: 0 }, why: 'Al dentista vas el martes.' },
      { prompt: '¿Qué tenés el sábado?', spec: { kind: 'whatOn', day: 'Sábado' }, why: 'El sábado almorzás con tus nietos.' },
    ],
  },
  {
    name: 'Nivel 2',
    agenda: [
      { day: 'Lunes', time: [10, 0], what: 'Kinesiología' },
      { day: 'Miércoles', time: [16, 0], what: 'Clase de cerámica' },
      { day: 'Jueves', time: [9, 0], what: 'Feria del barrio' },
      { day: 'Viernes', time: [19, 0], what: 'Cine con Marta' },
    ],
    questions: [
      { prompt: '¿A qué hora es la kinesiología?', spec: { kind: 'hourOf', e: 0 }, why: 'La kinesiología es el lunes a las 10\u00a0h.' },
      { prompt: '¿Qué tenés a las 9\u00a0h?', spec: { kind: 'whatAt', time: [9, 0] }, why: 'A las 9\u00a0h, el jueves, vas a la feria del barrio.' },
      {
        prompt: '¿Qué día y a qué hora es la clase de cerámica?',
        spec: { kind: 'dayHourOf', e: 1 },
        why: 'La clase de cerámica es el miércoles a las 16\u00a0h.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    agenda: [
      { day: 'Lunes', time: [8, 0], what: 'Podólogo en la clínica' },
      { day: 'Martes', time: [15, 30], what: 'Peluquería con Nélida' },
      { day: 'Miércoles', time: [10, 0], what: 'Yoga con Silvia' },
      { day: 'Viernes', time: [17, 0], what: 'Té con Mirta' },
      { day: 'Sábado', time: [20, 30], what: 'Cena en lo de Beto' },
    ],
    questions: [
      {
        prompt: '¿Qué tenés el día después del té con Mirta?',
        spec: { kind: 'afterOf', e: 3 },
        why: 'El té con Mirta es el viernes; el sábado cenás en lo de Beto.',
      },
      {
        prompt: 'Sin importar el día, solo por la hora: ¿cuál de estas empieza más temprano?',
        spec: { kind: 'earliestOf', among: [1, 2, 3, 4] },
        why: 'El yoga es a las 10\u00a0h: es la más temprana de las cuatro.',
      },
      {
        prompt: '¿Cuántas cosas tenés a la tarde, entre las 12\u00a0h y las 20\u00a0h?',
        spec: { kind: 'countBetween', from: 12 * 60, to: 20 * 60 },
        why: 'Dos: la peluquería (15.30\u00a0h) y el té con Mirta (17\u00a0h).',
      },
    ],
  },
]
const TOTAL_QUESTIONS = LEVELS.reduce((sum, lvl) => sum + lvl.questions.length, 0)

/** [15, 30] -> "15.30 h"; [10, 0] -> "10 h" (Argentine style); the space before the h does not break the line. */
function fmtTime(t: [number, number]): string {
  return t[1] === 0 ? `${t[0]}\u00a0h` : `${t[0]}.${String(t[1]).padStart(2, '0')}\u00a0h`
}
function minutes(t: [number, number]): number {
  return t[0] * 60 + t[1]
}
function dayHour(e: Entry): string {
  return `${e.day} a las ${fmtTime(e.time as [number, number])}`
}
/** The options of a question, all taken from the agenda itself (in the agenda's order; the game shuffles them at mount). */
function optionsOf(agenda: Entry[], spec: Spec): string[] {
  switch (spec.kind) {
    case 'dayOf':
      return agenda.map((e) => e.day)
    case 'whatOn':
    case 'whatAt':
      return agenda.map((e) => e.what)
    case 'hourOf':
      return agenda.map((e) => fmtTime(e.time as [number, number]))
    case 'dayHourOf':
      return agenda.map(dayHour)
    case 'afterOf':
      return agenda.filter((_, i) => i !== spec.e).map((e) => e.what)
    case 'earliestOf':
      return spec.among.map((i) => agenda[i].what)
    case 'countBetween':
      return COUNT_WORDS.slice(1, 5)
  }
}
/** The one right option, worked out from the agenda. */
function answerOf(agenda: Entry[], spec: Spec): string {
  switch (spec.kind) {
    case 'dayOf':
      return agenda[spec.e].day
    case 'whatOn':
      return (agenda.find((e) => e.day === spec.day) as Entry).what
    case 'hourOf':
      return fmtTime(agenda[spec.e].time as [number, number])
    case 'whatAt':
      return (agenda.find((e) => e.time && minutes(e.time) === minutes(spec.time)) as Entry).what
    case 'dayHourOf':
      return dayHour(agenda[spec.e])
    case 'afterOf':
      return (agenda.find((e) => DAYS.indexOf(e.day) === DAYS.indexOf(agenda[spec.e].day) + 1) as Entry).what
    case 'earliestOf': {
      const best = spec.among.reduce((a, b) => (minutes(agenda[b].time as [number, number]) < minutes(agenda[a].time as [number, number]) ? b : a))
      return agenda[best].what
    }
    case 'countBetween':
      return COUNT_WORDS[agenda.filter((e) => e.time && minutes(e.time) >= spec.from && minutes(e.time) < spec.to).length]
  }
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

/** The order of the options of every question of every level: decided once, at mount. */
function buildEpoch(): string[][][] {
  return LEVELS.map((lvl) => lvl.questions.map((q) => shuffle(optionsOf(lvl.agenda, q.spec))))
}

const PRAISE = ['¡Qué buena memoria!', '¡Excelente!', '¡Así se hace!', '¡Muy bien!', '¡Lo recordaste!']
/** The pause after a right answer, with its explanation on screen, before the next question. */
const ADVANCE_MS = 1600
/** A tap this soon after a screen or a question appears is the second tap of a double tap and is ignored. */
const SETTLE_MS = 400

const PRIMARY_BUTTON =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2'

/** The notebook page. */
function Agenda({ entries, compact = false }: { entries: Entry[]; compact?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border-2 border-amber-300 bg-amber-50">
      <div className="relative flex items-center justify-center border-b-2 border-amber-300 bg-amber-100 py-0.5">
        <span aria-hidden="true" className="absolute left-4 h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span aria-hidden="true" className="absolute right-4 h-2.5 w-2.5 rounded-full bg-amber-400" />
        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-slate-900">Mi semana</h3>
      </div>
      <ul aria-label="Agenda de la semana" className="divide-y divide-amber-200">
        {entries.map((e) => (
          <li key={e.day} className={`flex items-baseline gap-2 px-3 text-base leading-tight ${compact ? 'py-1' : 'py-1.5'}`}>
            <span className="w-[5.5rem] shrink-0 font-bold text-slate-900">{e.day}</span>
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-slate-800">
              {e.time && <span className="mr-1.5 font-bold text-tiam-blue-dark">{fmtTime(e.time)}</span>}
              {e.what}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá la agenda de la semana todo el tiempo que quieras y tocá «Ya la miré».',
    'La agenda desaparece y te hacemos 3 preguntas. Si te equivocás, podés volver a mirarla.',
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
      <div className="mt-4 text-center">
        <button type="button" onClick={(e) => onStart(e.timeStamp)} className={PRIMARY_BUTTON}>
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface LevelViewProps {
  levelIdx: number
  /** The order of the options of each question of this level. */
  options: string[][]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when the day just opened). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, options, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.questions.length

  // 'study' is the first look; 'recall' the questions; 'review' a new look in the middle of a question.
  const [phase, setPhase] = useState<'study' | 'recall' | 'review' | 'done'>('study')
  const [qIdx, setQIdx] = useState(0)
  // Options already tried wrong for the current question.
  const [tried, setTried] = useState<string[]>([])
  const [right, setRight] = useState<string | null>(null)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // When the screen last changed (that tap's own timeStamp, or the moment a question appeared): every tap within
  // SETTLE_MS is ignored.
  const settleFromRef = useRef(since)
  const timerRef = useRef<number | undefined>(undefined)
  const topRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  // Every screen opens at the top, not wherever the previous button left the scroll.
  useEffect(() => {
    if (phase !== 'done') topRef.current?.scrollIntoView({ block: 'start' })
  }, [phase])
  useEffect(() => {
    const card = resultRef.current
    if (phase !== 'done' || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
    // ...but never with the title half under the dialog header: it is brought back if it was left above.
    titleRef.current?.scrollIntoView({ block: 'nearest' })
  }, [phase])

  const q = level.questions[qIdx]
  const answer = answerOf(level.agenda, q.spec)
  const opts = options[qIdx]

  function goRecall(at: number) {
    if (at - settleFromRef.current < SETTLE_MS) return
    settleFromRef.current = at
    setPhase('recall')
  }
  function lookAgain(at: number) {
    if (at - settleFromRef.current < SETTLE_MS) return
    settleFromRef.current = at
    setPhase('review')
  }

  function pick(opt: string, at: number) {
    if (phase !== 'recall' || right !== null || tried.includes(opt) || at - settleFromRef.current < SETTLE_MS) return
    if (opt === answer) {
      setRight(opt)
      setHint({ text: `¡Eso es! ${q.why}`, ok: true })
      timerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          settleFromRef.current = performance.now()
          setQIdx((i) => i + 1)
          setTried([])
          setRight(null)
          setHint(null)
        } else {
          setPraise(pickOne(PRAISE))
          setPhase('done')
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    setTried((t) => [...t, opt])
    setHint({ text: 'No es esa. Probá con otra, o volvé a mirar la agenda.', ok: false })
    onMistake()
  }

  const pill = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
      {level.name}
    </span>
  )

  if (phase === 'study' || phase === 'review') {
    return (
      <div ref={topRef} className="px-4 pb-2 pt-2 sm:p-7">
        <div className="text-center">
          {pill}
          <h2 className="mt-1.5 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            {phase === 'study' ? 'Tu agenda de la semana' : 'Mirala de nuevo'}
          </h2>
          <p className="mt-0.5 text-base leading-snug text-slate-600">
            {phase === 'study' ? 'Mirala con calma: después desaparece.' : 'No cuenta como error.'}
          </p>
        </div>
        <div className="mt-2">
          <Agenda entries={level.agenda} compact={level.agenda.length > 4} />
        </div>
        <div className="mt-2 text-center">
          <button type="button" onClick={(e) => goRecall(e.timeStamp)} className={PRIMARY_BUTTON}>
            Ya la miré
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div ref={topRef} className="px-2 pb-3 pt-2 sm:p-7">
        <div className="text-center">
          {pill}
          <h2 ref={titleRef} className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">¡Completaste el {level.name.toLowerCase()}!</h2>
          <p className="mt-1 text-base font-semibold text-slate-500">{praise}</p>
        </div>
        <div ref={resultRef} className="mt-3 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-2 text-center sm:p-4">
          <div className="mx-auto flex h-10 w-10 [@media(max-height:600px)]:hidden items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-5 w-5 text-tiam-green" />
          </div>
          <p className="mt-2 text-slate-600 [@media(max-height:600px)]:hidden">La agenda de este nivel:</p>
          <div className="mt-2 text-left">
            <Agenda entries={level.agenda} compact />
          </div>
          <div className="mt-4 flex justify-center">
            {isLast ? (
              <button type="button" onClick={(e) => onRepeat(e.timeStamp)} className={PRIMARY_BUTTON}>
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button type="button" onClick={(e) => onNext(e.timeStamp)} className={PRIMARY_BUTTON}>
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Recall: one question at a time, the agenda is gone
  return (
    <div ref={topRef} className="px-4 pb-4 pt-3 sm:p-7 [@media(max-height:600px)]:pb-2 [@media(max-height:600px)]:pt-2">
      <div className="text-center">
        {pill}
        <span className="ml-3 align-middle text-base font-semibold text-slate-500">
          Pregunta {qIdx + 1} de {total}
        </span>
      </div>
      <p className="mx-auto mt-3 max-w-md text-center text-xl font-bold leading-snug text-slate-900 [@media(max-height:600px)]:mt-2 [@media(max-height:600px)]:text-lg">{q.prompt}</p>
      <div role="group" aria-label="Opciones" className="mx-auto mt-3 grid max-w-md gap-2 [@media(max-height:600px)]:mt-2 [@media(max-height:600px)]:gap-1.5">
        {opts.map((opt) => {
          const isTried = tried.includes(opt)
          const isRight = right === opt
          return (
            <button
              key={opt}
              type="button"
              disabled={right !== null || isTried}
              onClick={(e) => pick(opt, e.timeStamp)}
              className={[
                'flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-3 py-1 text-center text-lg font-bold leading-tight transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 [@media(max-height:700px)]:min-h-[48px] [@media(max-height:600px)]:min-h-[44px]!',
                isRight
                  ? 'border-tiam-green bg-tiam-green/15 text-slate-900'
                  : isTried
                    ? 'border-slate-200 bg-slate-100 text-slate-500 line-through'
                    : 'border-slate-300 bg-white text-slate-900 hover:border-tiam-blue/50',
              ].join(' ')}
            >
              {isRight && <Check className="h-5 w-5 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
              {opt}
            </button>
          )
        })}
      </div>
      <p
        role="status"
        className={`mx-auto mt-2 min-h-[3rem] max-w-md text-center text-base font-medium leading-snug [@media(max-height:600px)]:mt-1 [@media(max-height:600px)]:min-h-[2.75rem] ${hint?.ok ? 'text-green-700' : 'text-slate-600'}`}
      >
        {hint?.text}
      </p>
      {tried.length > 0 && right === null && (
        <div className="mt-1 text-center">
          <button
            type="button"
            onClick={(e) => lookAgain(e.timeStamp)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue transition hover:bg-tiam-blue/5 focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Volver a mirar la agenda
          </button>
        </div>
      )}
    </div>
  )
}

export function LaAgendaDeLaSemana({ onComplete }: GameProps) {
  // The order of the options of every question — decided once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [started, setStarted] = useState(false)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current screen on (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
  }
  function handleStart(at: number) {
    setSince(at)
    setStarted(true)
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

  if (!started) {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tu agenda de la semana</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      options={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
