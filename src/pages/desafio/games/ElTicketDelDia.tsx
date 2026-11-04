import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles, Ticket } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El ticket del día" — día 30, mes 6, cálculo: the closing day of the challenge. Three tickets, one per level, and each
 * ticket is five mini questions of five different kinds, always in the same order: SPELLING (which word is written
 * right), SYNONYMS (which word means the same), ORDER (tap the numbers from least to greatest, or the other way round),
 * MENTAL ARITHMETIC (one sum, subtraction or product, typed on a number pad) and a PROBLEM (a short everyday story with a
 * number to find, typed on the same pad). The mechanic, a "ticket of the day" that gathers one question of each kind,
 * comes from a printed worksheet of daily tickets; its questions, words, numbers and stories are not used: everything
 * here is TIAM's own, written for adults (a market, a bus fare, a rent) and in Argentine format (1.400, with a dot).
 *
 * THE RAMP. Ticket 1 is the plainest of each kind (three numbers to order, a two-digit sum, a one-step story); ticket 2
 * has four numbers to order from the greatest down, a product and a story with a change to give; ticket 3 has five
 * numbers that share most of their digits, a spelling with a diaeresis, a synonym whose options include its opposite, a
 * subtraction of thousands and a three-step story. A throwaway script (not committed) evaluates the `check` expression
 * of every arithmetic question and compares it with `answer`, and checks that every spelling and synonym question has one
 * right option, that no option repeats, that the numbers to order are all different and that no answer repeats in the day.
 * The spellings and synonyms were written by hand and are not machine-checked.
 *
 * NO BLIND GUESS, NO DEAD END, NOTHING RED. A wrong option is greyed for good and costs ONE mistake; in the order
 * question a tile that is not the next one costs one mistake (once per tile and position) and does not move; on the pad
 * a wrong number costs one mistake, clears the display and the hint grows: a tip on how to work it out, then the
 * answer itself ("escribilo para seguir") so nobody is stuck. A right answer says why in one line and, after a short
 * pause (the only timer), the next question comes; every tap in that pause, or in the first 400 ms of a question, is ignored
 * so a double tap never answers the next one. Text that has to be read is 16 px or more and the pad keys are 44 px or more.
 *
 * Finishing the third ticket reports the day (and the page then shows its "Desafío completo" badge if it was the player's
 * last exercise). "Repetir" replays exactly the same fifteen questions: they are authored once, nothing is drawn at mount
 * and the order is fixed.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level.
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived).
 */

// ── data:start ──
type Question =
  | {
      kind: 'choice'
      topic: 'Ortografía' | 'Sinónimos'
      prompt: string
      options: string[]
      /** Index of the right option. */
      answer: number
      /** Why, in one line (shown after a right answer). */
      why: string
    }
  | {
      kind: 'order'
      topic: 'Orden'
      prompt: string
      values: number[]
      dir: 'asc' | 'desc'
    }
  | {
      kind: 'number'
      topic: 'Cálculo mental' | 'Problema'
      prompt: string
      answer: number
      /** An expression that gives `answer`, for the check script. */
      check: string
      /** A tip on how to work it out (shown after the first miss). */
      tip: string
    }
interface TicketDef {
  name: string
  questions: Question[]
}

const TICKETS: TicketDef[] = [
  {
    name: 'Ticket 1',
    questions: [
      {
        kind: 'choice',
        topic: 'Ortografía',
        prompt: '¿Cuál de estas palabras está bien escrita?',
        options: ['aora', 'ahora', 'ahóra'],
        answer: 1,
        why: '«ahora» lleva H al comienzo y no lleva tilde.',
      },
      {
        kind: 'choice',
        topic: 'Sinónimos',
        prompt: '¿Qué palabra significa lo mismo que «arreglar»?',
        options: ['romper', 'reparar', 'ensuciar'],
        answer: 1,
        why: '«reparar» y «arreglar» dicen lo mismo.',
      },
      {
        kind: 'order',
        topic: 'Orden',
        prompt: 'Tocá los números de menor a mayor.',
        values: [807, 708, 780],
        dir: 'asc',
      },
      {
        kind: 'number',
        topic: 'Cálculo mental',
        prompt: '¿Cuánto es 35 + 47?',
        answer: 82,
        check: '35 + 47',
        tip: 'Sumá primero 35 + 40 y después agregá 7.',
      },
      {
        kind: 'number',
        topic: 'Problema',
        prompt: 'Un ramo lleva 8 flores. Elena arma 4 ramos. ¿Cuántas flores usa en total?',
        answer: 32,
        check: '8 * 4',
        tip: 'Son 4 ramos de 8 flores cada uno: 4 × 8.',
      },
    ],
  },
  {
    name: 'Ticket 2',
    questions: [
      {
        kind: 'choice',
        topic: 'Ortografía',
        prompt: '¿Cuál de estas palabras está bien escrita?',
        options: ['exajerar', 'esagerar', 'exagerar'],
        answer: 2,
        why: '«exagerar» se escribe con X y con G.',
      },
      {
        kind: 'choice',
        topic: 'Sinónimos',
        prompt: '¿Qué palabra significa lo mismo que «demorar»?',
        options: ['adelantar', 'empezar', 'tardar'],
        answer: 2,
        why: '«tardar» y «demorar» dicen lo mismo.',
      },
      {
        kind: 'order',
        topic: 'Orden',
        prompt: 'Tocá los números de mayor a menor.',
        values: [12304, 12430, 12043, 12340],
        dir: 'desc',
      },
      {
        kind: 'number',
        topic: 'Cálculo mental',
        prompt: '¿Cuánto es 4 × 26?',
        answer: 104,
        check: '4 * 26',
        tip: 'Pensá 4 × 20 y 4 × 6, y sumá los dos resultados.',
      },
      {
        kind: 'number',
        topic: 'Problema',
        prompt:
          'Rosa compra 3 kilos de manzanas a $1.200 el kilo y paga con un billete de $5.000. ¿Cuánto vuelto recibe? (en pesos)',
        answer: 1400,
        check: '5000 - 3 * 1200',
        tip: 'Primero calculá lo que cuestan las manzanas: 3 × 1.200. Después restalo de 5.000.',
      },
    ],
  },
  {
    name: 'Ticket 3',
    questions: [
      {
        kind: 'choice',
        topic: 'Ortografía',
        prompt: '¿Cuál de estas palabras está bien escrita?',
        options: ['vergüenza', 'verguenza', 'vergueza'],
        answer: 0,
        why: '«vergüenza» lleva diéresis sobre la U (ü) para que se pronuncie.',
      },
      {
        kind: 'choice',
        topic: 'Sinónimos',
        prompt: '¿Qué palabra significa lo mismo que «dichoso»?',
        options: ['afortunado', 'desdichado', 'orgulloso'],
        answer: 0,
        why: '«afortunado» y «dichoso» dicen lo mismo; «desdichado» es lo contrario.',
      },
      {
        kind: 'order',
        topic: 'Orden',
        prompt: 'Tocá los números de menor a mayor.',
        values: [1890, 1089, 1908, 1098, 1809],
        dir: 'asc',
      },
      {
        kind: 'number',
        topic: 'Cálculo mental',
        prompt: '¿Cuánto es 3.000 − 1.275?',
        answer: 1725,
        check: '3000 - 1275',
        tip: 'Restá primero 1.000 (quedan 2.000) y después los 275 que faltan.',
      },
      {
        kind: 'number',
        topic: 'Problema',
        prompt:
          'Un viaje en colectivo cuesta $650. Julio viaja 2 veces por día, de lunes a viernes. ¿Cuánto gasta en la semana? (en pesos)',
        answer: 6500,
        check: '650 * 2 * 5',
        tip: 'Primero contá los viajes de la semana: 2 por día, durante 5 días. Después multiplicá por 650.',
      },
    ],
  },
]
const TOTAL_QUESTIONS = TICKETS.reduce((n, t) => n + t.questions.length, 0)

/** 1400 -> "1.400" (Argentine format; the browser's es locale does not group four digits). */
function fmt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
/** The order a question asks for. */
function sortedValues(q: { values: number[]; dir: 'asc' | 'desc' }): number[] {
  return [...q.values].sort((a, b) => (q.dir === 'asc' ? a - b : b - a))
}
// ── data:end ──

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena cabeza!', '¡Perfecto!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
/** The pause after a right answer, with its explanation on screen, before the next question. */
const ADVANCE_MS = 1700
/** A tap this soon after a screen or a question appears is the second tap of a double tap and is ignored. */
const SETTLE_MS = 400
const MAX_DIGITS = 5

const NEXT_BUTTON =
  'inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark'

interface QProps<Q> {
  q: Q
  onMistake: () => void
  onSolved: (why: string) => void
  setHint: (h: { text: string; ok: boolean } | null) => void
  locked: boolean
  /** The timeStamp of the tap that brought the ticket on screen. */
  since: number
}

/** The moment a question appeared, for the double-tap shield (set once the question is on screen). */
function useBorn(): React.MutableRefObject<number> {
  const born = useRef(0)
  useEffect(() => {
    born.current = performance.now()
  }, [])
  return born
}

function ChoiceQuestion({ q, onMistake, onSolved, setHint, locked, since }: QProps<Extract<Question, { kind: 'choice' }>>) {
  const born = useBorn()
  const [gone, setGone] = useState<number[]>([])
  const [right, setRight] = useState<number | null>(null)
  function pick(i: number, at: number) {
    if (locked || right !== null || gone.includes(i) || at - born.current < SETTLE_MS || at - since < SETTLE_MS) return
    if (i === q.answer) {
      setRight(i)
      onSolved(q.why)
    } else {
      setGone((g) => [...g, i])
      onMistake()
      setHint({ text: 'No es. Probá con otra.', ok: false })
    }
  }
  return (
    <div role="group" aria-label="Opciones" className="mx-auto mt-3 grid max-w-md gap-2">
      {q.options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          disabled={locked || gone.includes(i) || right !== null}
          onClick={(e) => pick(i, e.timeStamp)}
          className={[
            'flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-3 text-xl font-bold transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 [@media(max-height:700px)]:min-h-[48px]',
            right === i
              ? 'border-tiam-green bg-tiam-green/15 text-slate-900'
              : gone.includes(i)
                ? 'border-slate-200 bg-slate-100 text-slate-500 line-through'
                : 'border-slate-300 bg-white text-slate-900 hover:border-tiam-blue/50',
          ].join(' ')}
        >
          {right === i && <Check className="h-5 w-5 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
          {opt}
        </button>
      ))}
    </div>
  )
}

function OrderQuestion({ q, onMistake, onSolved, setHint, locked, since }: QProps<Extract<Question, { kind: 'order' }>>) {
  const born = useBorn()
  const expected = sortedValues(q)
  const [picked, setPicked] = useState<number[]>([])
  // Tiles already tried wrongly at the current position (they cost one mistake, once).
  const [tried, setTried] = useState<number[]>([])
  function pick(i: number, at: number) {
    if (locked || picked.includes(i) || at - born.current < SETTLE_MS || at - since < SETTLE_MS) return
    if (q.values[i] === expected[picked.length]) {
      const next = [...picked, i]
      setPicked(next)
      setTried([])
      setHint(null)
      if (next.length === q.values.length) onSolved(`Quedaron en orden: ${expected.map(fmt).join(' · ')}.`)
    } else {
      if (!tried.includes(i)) {
        setTried((t) => [...t, i])
        onMistake()
      }
      setHint({ text: `Ese no es el ${q.dir === 'asc' ? 'menor' : 'mayor'} de los que quedan.`, ok: false })
    }
  }
  return (
    <div className="mx-auto mt-3 max-w-md">
      <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-500">Tu orden</p>
      <div aria-label="Números ya ordenados" className="mt-1 flex min-h-[48px] flex-wrap items-center justify-center gap-1.5">
        {expected.map((v, k) => (
          <span
            key={k}
            className={`flex h-11 min-w-[64px] items-center justify-center rounded-lg border-2 px-2 text-lg font-extrabold ${
              k < picked.length ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : 'border-dashed border-slate-300 text-transparent'
            }`}
          >
            {k < picked.length ? fmt(v) : '0'}
          </span>
        ))}
      </div>
      <div role="group" aria-label="Números" className="mt-3 flex flex-wrap justify-center gap-2">
        {q.values.map((v, i) => (
          <button
            key={v}
            type="button"
            disabled={locked || picked.includes(i)}
            onClick={(e) => pick(i, e.timeStamp)}
            className={`flex min-h-[52px] min-w-[84px] items-center justify-center rounded-xl border-2 px-3 text-xl font-bold transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 ${
              picked.includes(i)
                ? 'border-slate-200 bg-slate-100 text-slate-300'
                : 'border-slate-300 bg-white text-slate-900 hover:border-tiam-blue/50'
            }`}
          >
            {fmt(v)}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberQuestion({ q, onMistake, onSolved, setHint, locked, since }: QProps<Extract<Question, { kind: 'number' }>>) {
  const born = useBorn()
  const [digits, setDigits] = useState('')
  const [misses, setMisses] = useState(0)
  function press(d: string, at: number) {
    if (locked || at - born.current < SETTLE_MS || at - since < SETTLE_MS) return
    setDigits((cur) => (cur.length >= MAX_DIGITS ? cur : cur === '0' ? d : cur + d))
  }
  function erase(at: number) {
    if (locked || at - born.current < SETTLE_MS || at - since < SETTLE_MS) return
    setDigits((cur) => cur.slice(0, -1))
  }
  function submit(at: number) {
    if (locked || digits === '' || at - born.current < SETTLE_MS || at - since < SETTLE_MS) return
    if (Number(digits) === q.answer) {
      onSolved(`Así es: ${fmt(q.answer)}.`)
      return
    }
    const next = misses + 1
    setMisses(next)
    setDigits('')
    onMistake()
    setHint({
      text:
        next === 1
          ? 'No es. Revisá la cuenta con calma.'
          : next === 2
            ? `No es. ${q.tip}`
            : `Es ${fmt(q.answer)}: escribilo para seguir.`,
      ok: false,
    })
  }
  const keyClass =
    'flex min-h-[48px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-2xl font-bold text-slate-800 transition hover:border-tiam-blue/40 active:bg-tiam-blue/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:opacity-50 [@media(max-height:700px)]:min-h-[44px]'
  return (
    <div className="mx-auto mt-3 max-w-[340px]">
      <div
        role="img"
        aria-label={digits ? `Escribiste ${fmt(Number(digits))}` : 'Todavía no escribiste nada'}
        className="flex h-12 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-3xl font-extrabold tracking-wide text-slate-900"
      >
        {digits ? fmt(Number(digits)) : <span className="text-base font-medium text-slate-500">Escribí tu respuesta</span>}
      </div>
      <div role="group" aria-label="Teclado de números" className="mt-2 grid grid-cols-5 gap-1.5">
        {[...'1234567890'].map((d) => (
          <button key={d} type="button" disabled={locked} aria-label={`Número ${d}`} onClick={(e) => press(d, e.timeStamp)} className={keyClass}>
            {d}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          aria-label="Borrar el último número"
          disabled={locked || digits === ''}
          onClick={(e) => erase(e.timeStamp)}
          className={`${keyClass} w-16 shrink-0`}
        >
          <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={locked || digits === ''}
          onClick={(e) => submit(e.timeStamp)}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500 [@media(max-height:700px)]:min-h-[44px]"
        >
          Listo
        </button>
      </div>
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Cada ticket tiene cinco preguntas cortas: ortografía, sinónimos, ordenar números, una cuenta y un problema.',
    'Respondé de a una. Si te equivocás, te damos una ayuda. ¡Son tres tickets para cerrar el desafío!',
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
  const ticket = TICKETS[levelIdx]
  const isLast = levelIdx === TICKETS.length - 1
  const total = ticket.questions.length

  const [step, setStep] = useState(0)
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

  const q = ticket.questions[step]
  const locked = advancing || done

  function solved(why: string) {
    setAdvancing(true)
    setHint({ text: why, ok: true })
    timerRef.current = window.setTimeout(() => {
      if (step < total - 1) {
        setStep((s) => s + 1)
        setHint(null)
        setAdvancing(false)
      } else {
        setPraise(pickOne(PRAISE))
        setDone(true)
        setAdvancing(false)
        onSolved()
      }
    }, ADVANCE_MS)
  }
  const common = { onMistake, onSolved: solved, setHint, locked, since }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* The ticket */}
      <div className="mx-auto max-w-md rounded-3xl border-2 border-dashed border-tiam-blue/40 bg-white px-4 pb-4 pt-3 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-tiam-blue">
            <Ticket className="h-5 w-5" aria-hidden="true" />
            {ticket.name} de {TICKETS.length}
          </span>
          {!done && (
            <ol aria-label={`Pregunta ${step + 1} de ${total}`} className="flex items-center gap-1">
              {ticket.questions.map((_, k) => (
                <li
                  key={k}
                  aria-hidden="true"
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    k < step ? 'bg-tiam-green text-white' : k === step ? 'bg-tiam-blue text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {k < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : k + 1}
                </li>
              ))}
            </ol>
          )}
        </div>

        {!done && (
          <>
            <p className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              {step + 1} · {q.topic}
            </p>
            <p className="mt-0.5 text-xl font-bold leading-snug text-slate-900 [@media(max-height:700px)]:text-lg">{q.prompt}</p>
            {q.kind === 'choice' && <ChoiceQuestion key={`${step}`} q={q} {...common} />}
            {q.kind === 'order' && <OrderQuestion key={`${step}`} q={q} {...common} />}
            {q.kind === 'number' && <NumberQuestion key={`${step}`} q={q} {...common} />}
            <p
              role="status"
              className={`mx-auto mt-2 min-h-[3rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-600'}`}
            >
              {hint?.text}
            </p>
          </>
        )}

        {done && (
          <div ref={resultRef} className="mt-3 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
              <Sparkles className="h-6 w-6 text-tiam-green" />
            </div>
            <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
            <p className="mt-1 text-slate-600">
              ¡{ticket.name} sellado! Respondiste las {total} preguntas.
            </p>
            <div className="mt-5 flex justify-center">
              {isLast ? (
                <button type="button" onClick={(e) => onRepeat(e.timeStamp)} className={NEXT_BUTTON}>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </button>
              ) : (
                <button type="button" onClick={(e) => onNext(e.timeStamp)} className={NEXT_BUTTON}>
                  Siguiente ticket
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ElTicketDelDia({ onComplete }: GameProps) {
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== TICKETS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
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
            {TICKETS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tres tickets para cerrar</h2>
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
