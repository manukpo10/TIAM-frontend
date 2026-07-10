import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Empecemos por hoy" — the only game in the app with no LEVELS[] ladder and
 * no visible score. It's a digitized Reality Orientation exercise: the device
 * clock (new Date(), frozen once at mount) is the ground truth, so questions
 * about TODAY have live, checkable answers with zero content to ever update.
 *
 * The content — today's real weekday/month/season/time-of-day — has exactly
 * one correct answer per calendar day and no natural difficulty tiers, so a
 * "Nivel 2" or a score would be manufactured, not honest. This is day 1, a
 * buyer's very first exercise; a wrong answer here is uniquely sensitive
 * (temporal disorientation is a real clinical signal), so it resolves on the
 * first tap with a warm factual reveal, never red, and completion is purely
 * celebratory — never a report card.
 */

const IMAGES = import.meta.glob('../../../assets/desafio/games/empecemos-por-hoy/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const SEASONS: Record<string, string> = {
  verano: 'Verano',
  otono: 'Otoño',
  invierno: 'Invierno',
  primavera: 'Primavera',
}
const MOMENTS: Record<string, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
}

interface Option {
  id: string
  label: string
  image?: string
}
type QuestionKind = 'weekday' | 'month' | 'season' | 'moment'
interface Question {
  kind: QuestionKind
  prompt: string
  options: Option[]
  correctIds: string[]
  cols: 1 | 2 | 3
}

/** Southern-Hemisphere calendar season for a given month (1–12) + day. */
function primarySeason(m: number, d: number): string {
  if ((m === 12 && d >= 21) || m === 1 || m === 2 || (m === 3 && d <= 20)) return 'verano'
  if ((m === 3 && d >= 21) || m === 4 || m === 5 || (m === 6 && d <= 20)) return 'otono'
  if ((m === 6 && d >= 21) || m === 7 || m === 8 || (m === 9 && d <= 20)) return 'invierno'
  return 'primavera'
}
/** Around each solstice/equinox (real dates drift the 19th–22nd), accept both neighbours. */
function validSeasons(m: number, d: number): string[] {
  const primary = primarySeason(m, d)
  if (d >= 18 && d <= 23) {
    if (m === 3) return ['verano', 'otono']
    if (m === 6) return ['otono', 'invierno']
    if (m === 9) return ['invierno', 'primavera']
    if (m === 12) return ['primavera', 'verano']
  }
  return [primary]
}

function momentOfDay(hour: number): string {
  if (hour >= 6 && hour <= 12) return 'manana'
  if (hour >= 13 && hour <= 19) return 'tarde'
  return 'noche'
}

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

function buildQuestions(today: Date): Question[] {
  const weekdayIdx = (today.getDay() + 6) % 7 // getDay() is 0=Sun; rotate to Monday-first
  const monthIdx = today.getMonth()
  const dayOfMonth = today.getDate()

  // Month: correct + 3 nearby decoys, sorted by signed offset around the current month.
  const offsets = shuffle([-3, -2, -1, 1, 2, 3]).slice(0, 3)
  const monthOffsets = [0, ...offsets].sort((a, b) => a - b)
  const monthOptions: Option[] = monthOffsets.map((off) => {
    const idx = (monthIdx + off + 12) % 12
    return { id: MONTHS[idx], label: MONTHS[idx] }
  })

  const season = validSeasons(monthIdx + 1, dayOfMonth)
  const moment = momentOfDay(today.getHours())

  return [
    {
      kind: 'weekday',
      prompt: '¿Qué día de la semana es hoy?',
      options: WEEKDAYS.map((w) => ({ id: w, label: w })),
      correctIds: [WEEKDAYS[weekdayIdx]],
      cols: 2,
    },
    {
      kind: 'month',
      prompt: '¿En qué mes estamos?',
      options: monthOptions,
      correctIds: [MONTHS[monthIdx]],
      cols: 2,
    },
    {
      kind: 'season',
      prompt: '¿En qué estación del año estamos?',
      options: Object.keys(SEASONS).map((id) => ({ id, label: SEASONS[id], image: imgFor(id) })),
      correctIds: season,
      cols: 2,
    },
    {
      kind: 'moment',
      prompt: '¿Qué momento del día es ahora?',
      options: Object.keys(MOMENTS).map((id) => ({ id, label: MOMENTS[id], image: imgFor(id) })),
      correctIds: [moment],
      cols: 3,
    },
  ]
}

const CORRECT_PRAISE = ['¡Exacto!', '¡Así es!', '¡Bien ubicado!', '¡Ahí está!']
const REVEAL_LEADIN = [
  'Mirá, hoy en realidad es',
  'Es normal no tenerlo tan presente — hoy es',
  'Hoy es',
]

export function EmpecemosPorHoy({ day: _day, onComplete }: GameProps) {
  const [today] = useState(() => new Date())
  const [roundKey, setRoundKey] = useState(0)
  const questions = useMemo(
    () => buildQuestions(today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, roundKey],
  )

  const [index, setIndex] = useState(0)
  const [answeredId, setAnsweredId] = useState<string | null>(null)
  const [praise, setPraise] = useState(CORRECT_PRAISE[0])
  const [reveal, setReveal] = useState('')

  const current = questions[index]
  const done = index >= questions.length
  const wasWrong = answeredId !== null && current ? !current.correctIds.includes(answeredId) : false

  // No LEVELS[] ladder here — the day is done after one pass through all 4
  // questions, so this reports once ever (unlike ElVuelto/QueSeEsconde, which
  // fire once per roundKey so a genuine full-day restart can report again).
  // "Repasar de nuevo" is a courtesy replay, not a second attempt at the day.
  // Every question resolves on the first tap with a factual reveal, never a
  // hard fail (see the file header) — so mistakes are always reported as 0.
  const reportedRef = useRef(false)
  useEffect(() => {
    if (!done || reportedRef.current) return
    reportedRef.current = true
    onComplete({ mistakes: 0, totalAttempts: questions.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function handleAnswer(id: string) {
    if (answeredId !== null || !current) return
    setAnsweredId(id)
    if (current.correctIds.includes(id)) {
      setPraise(pickOne(CORRECT_PRAISE))
    } else {
      const answerLabel = current.options.find((o) => o.id === current.correctIds[0])?.label ?? ''
      setReveal(`${pickOne(REVEAL_LEADIN)} ${answerLabel.toLowerCase()}.`)
    }
  }

  function handleNext() {
    setIndex((i) => i + 1)
    setAnsweredId(null)
  }
  function restart() {
    setRoundKey((k) => k + 1)
    setIndex(0)
    setAnsweredId(null)
  }

  const gridCols = current?.cols === 3 ? 'grid-cols-3' : 'grid-cols-2'

  // Completion recap: states weekday + full date + year + season + moment once more.
  const recap = useMemo(() => {
    const weekday = WEEKDAYS[(today.getDay() + 6) % 7].toLowerCase()
    const day = today.getDate()
    const month = MONTHS[today.getMonth()].toLowerCase()
    const year = today.getFullYear()
    const season = SEASONS[primarySeason(today.getMonth() + 1, today.getDate())].toLowerCase()
    const moment = MOMENTS[momentOfDay(today.getHours())].toLowerCase()
    return `Hoy es ${weekday} ${day} de ${month} de ${year}. Estamos en ${season} y es de ${moment}.`
  }, [today])

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          Orientación
        </span>
        {!done && current && (
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{current.prompt}</h2>
        )}
      </div>

      {!done && current && (
        <>
          {/* Options */}
          <div className={`mt-6 grid gap-3 ${gridCols}`}>
            {current.options.map((opt, i) => {
              const isCorrect = current.correctIds.includes(opt.id)
              const isResolved = answeredId !== null
              const showAsCorrect = isResolved && isCorrect
              const isLastOdd =
                current.kind === 'weekday' && i === current.options.length - 1 && current.options.length % 2 === 1
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isResolved}
                  onClick={() => handleAnswer(opt.id)}
                  aria-label={opt.label}
                  className={[
                    'relative flex flex-col items-center justify-center rounded-2xl border-2 p-3 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    opt.image ? 'min-h-[120px]' : 'min-h-[56px]',
                    isLastOdd ? 'col-span-2' : '',
                    showAsCorrect
                      ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                      : isResolved
                        ? 'border-slate-200 bg-white opacity-40'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt.image && (
                    <img src={opt.image} alt="" className="h-16 w-16 object-contain sm:h-20 sm:w-20" draggable={false} />
                  )}
                  <span className={`text-base font-bold text-slate-700 ${opt.image ? 'mt-1' : ''}`}>{opt.label}</span>
                  {showAsCorrect && (
                    <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Feedback */}
          {answeredId !== null && (
            <div
              className={[
                'mt-6 rounded-3xl border p-6 text-center',
                wasWrong ? 'border-tiam-blue/20 bg-tiam-blue/5' : 'border-tiam-green/20 bg-tiam-green/5',
              ].join(' ')}
            >
              <div
                className={[
                  'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
                  wasWrong ? 'bg-tiam-blue/15' : 'bg-tiam-green/15',
                ].join(' ')}
              >
                {wasWrong ? (
                  <Lightbulb className="h-6 w-6 text-tiam-blue" />
                ) : (
                  <Sparkles className="h-6 w-6 text-tiam-green" />
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{wasWrong ? reveal : praise}</p>
              <button
                type="button"
                onClick={handleNext}
                className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                {index < questions.length - 1 ? 'Siguiente' : 'Terminar'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¡Ya estás ubicado en el día de hoy!</p>
          <p className="mt-2 text-slate-600">{recap}</p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={restart}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Repasar de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
