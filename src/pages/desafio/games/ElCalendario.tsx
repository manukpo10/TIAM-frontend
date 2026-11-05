import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El calendario" — día 23, mes 6, cálculo. A page of a wall calendar (month name, seven columns, weeks that start on
 * Monday, "Lu Ma Mi Ju Vi Sa Do") and one situation at a time: "Dentro de 3 días tenés turno con la doctora". The player
 * counts from the cell marked "Hoy" and taps the day it falls on. Three situations per level, one month page and one
 * "Hoy" per level. Nothing is timed.
 *
 * ORIGINAL CONTENT. It does not come from a worksheet: the mechanic (count days on a calendar) is a plain everyday
 * skill and every situation, month and number is written for this game, in Argentine voseo and adult life (a gas fitter, a
 * boleta, a visit from cousins). The month pages are authored and fixed, independent of the real date, and show no year.
 *
 * THE RAMP. Level 1: 3 to 6 days forward inside the month (the neighbouring months' days only fill the grid and cannot
 * be tapped). Level 2: weeks plus days forward (a week and two days, two weeks and a day) and one situation backwards
 * ("hace 9 días"), so the player has to use "a week is 7 days" and go up a row. Level 3 is harder for real: "Hoy" is
 * at the end of the month, so every answer is in the NEXT month (those cells, shown muted, are tappable here), and two
 * of the three need two steps (walking with a friend every 3 days, three times; "hace 5 días... lista a los 12 días"). The month's
 * length is stated in the text where it matters.
 *
 * Every answer is computed, not typed: a situation is a list of `moves` (signed days, summed from "Hoy"), and the
 * answer is the cell at today's position plus that sum. A throwaway script (not committed) rebuilds every month page
 * with real `Date`s in a year where the month starts on the authored weekday and with the authored length, checks that
 * the weekdays of all the grid are consistent, computes each answer again from its own table (written from the text, not
 * from `moves`), and checks the ramp, that the answers of a level are different cells and that every answer is inside the
 * grid. The text of each situation was matched with its `moves` by hand.
 *
 * NO DEAD END, NOTHING RED. A wrong cell is greyed (muted gray, with the number struck through, never red) and costs ONE
 * mistake (once per cell). The message says what that cell is (its weekday and date and how far it is from "Hoy"); "Hoy"
 * gets its own message. The hint grows on the same situation: first how to count (a week is 7 days), then a narrower
 * clue (which weekday and which row), and from the third miss the right cell gets a ring and gently pulses. A right
 * answer says the full date with its weekday and, after a short pause (the only timer), the next situation comes; any tap
 * in the first 400 ms of a situation is ignored so a double tap never answers the next one.
 *
 * "Hoy" is marked by the word, a solid fill and a thicker border, never by colour alone; the neighbouring months'
 * days carry their month's abbreviation. Cells are 44 px tall and as wide as the screen allows (the card's side padding
 * is small on phones so seven columns get the most room); every number and text is 16 px or more.
 *
 * "Repetir" replays the same nine situations: everything is authored once, nothing is drawn at mount. A short
 * "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>, keyed by
 * run + level.
 *
 * totalAttempts = mistakes + every situation of the day (TOTAL_SITUATIONS, derived).
 */

// ── data:start ──
const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const ROW_WORDS = ['una', 'dos', 'tres', 'cuatro', 'cinco']

interface MonthPage {
  name: string
  prevName: string
  nextName: string
  /** Days of the month and of the previous one (the grid shows the tail of that one). */
  length: number
  prevLength: number
  /** Weekday of the 1st: 0 = lunes ... 6 = domingo. */
  firstDow: number
  /** The day of the month marked "Hoy". */
  today: number
  /** Can the neighbouring months' cells be tapped (an answer may fall in them)? */
  tappableNeighbours: boolean
}
interface Situation {
  text: string
  /** A short name for the recap. */
  short: string
  /** Signed days from "Hoy", added up: the answer is "Hoy" plus their sum. */
  moves: number[]
  /** Hint 1: how to count. */
  howToCount: string
}
interface LevelDef {
  name: string
  month: MonthPage
  situations: Situation[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    month: { name: 'Mayo', prevName: 'Abril', nextName: 'Junio', length: 31, prevLength: 30, firstDow: 3, today: 5, tappableNeighbours: false },
    situations: [
      {
        text: 'Dentro de 3 días viene el gasista a revisar la cocina. ¿Qué día viene?',
        short: 'Viene el gasista',
        moves: [3],
        howToCount: 'Empezá a contar desde mañana: mañana es 1, pasado mañana es 2, y así hasta llegar a 3.',
      },
      {
        text: 'La boleta del agua vence dentro de 4 días. ¿Qué día vence?',
        short: 'Vence la boleta del agua',
        moves: [4],
        howToCount: 'Contá casillero por casillero desde mañana, hasta llegar a 4.',
      },
      {
        text: 'Tu vecina Elena cumple años dentro de 6 días. ¿Qué día es?',
        short: 'Cumpleaños de Elena',
        moves: [6],
        howToCount: 'Contá desde mañana, que es 1, casillero por casillero, hasta llegar a 6.',
      },
    ],
  },
  {
    name: 'Nivel 2',
    month: { name: 'Junio', prevName: 'Mayo', nextName: 'Julio', length: 30, prevLength: 31, firstDow: 5, today: 12, tappableNeighbours: false },
    situations: [
      {
        text: 'Tus primos de Mendoza llegan dentro de una semana y dos días. ¿Qué día llegan?',
        short: 'Llegan tus primos de Mendoza',
        moves: [7, 2],
        howToCount: 'Una semana son 7 días: bajá una fila y quedás en el mismo día que Hoy. Después sumá 2 días.',
      },
      {
        text: 'La reunión del consorcio es dentro de dos semanas y un día. ¿Qué día es?',
        short: 'Reunión del consorcio',
        moves: [14, 1],
        howToCount: 'Dos semanas son 14 días: bajá dos filas y quedás en el mismo día que Hoy. Después sumá 1 día.',
      },
      {
        text: 'Hace 9 días le prestaste el taladro al vecino. ¿Qué día se lo prestaste?',
        short: 'Le prestaste el taladro',
        moves: [-9],
        howToCount: 'Ahora hacia atrás: subir una fila son 7 días. Después retrocedé 2 días más.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    month: { name: 'Abril', prevName: 'Marzo', nextName: 'Mayo', length: 30, prevLength: 31, firstDow: 0, today: 26, tappableNeighbours: true },
    situations: [
      {
        text: 'La cuota del gimnasio vence dentro de 6 días. Abril tiene 30 días. ¿Qué día vence?',
        short: 'Vence la cuota del gimnasio',
        moves: [6],
        howToCount: 'Contá desde mañana. Cuando termine abril (30 días), seguí con el 1 del mes que viene.',
      },
      {
        text: 'Salís a caminar con una amiga cada 3 días y hoy ya salieron. ¿Qué día salen por tercera vez a partir de hoy?',
        short: 'Caminata con tu amiga',
        moves: [3, 3, 3],
        howToCount: 'Sumá de a 3 días: 3 para la primera vez, 3 más para la segunda y otros 3 para la tercera.',
      },
      {
        text: 'Hace 5 días dejaste un pantalón en el arreglo y estará listo a los 12 días de haberlo dejado. ¿Qué día lo retirás?',
        short: 'Retirás el pantalón del arreglo',
        moves: [-5, 12],
        howToCount: 'Ya pasaron 5 de los 12 días: calculá cuántos faltan y contalos desde Hoy.',
      },
    ],
  },
]
const TOTAL_SITUATIONS = LEVELS.reduce((sum, lvl) => sum + lvl.situations.length, 0)

type CellKind = 'prev' | 'cur' | 'next'
interface Cell {
  day: number
  kind: CellKind
}

/** The cells of the page: whole weeks from Monday, the neighbouring months' days filling the first and last rows. */
function buildGrid(m: MonthPage): Cell[] {
  const total = Math.ceil((m.firstDow + m.length) / 7) * 7
  const cells: Cell[] = []
  for (let i = 0; i < total; i++) {
    if (i < m.firstDow) cells.push({ day: m.prevLength - (m.firstDow - 1 - i), kind: 'prev' })
    else if (i < m.firstDow + m.length) cells.push({ day: i - m.firstDow + 1, kind: 'cur' })
    else cells.push({ day: i - m.firstDow - m.length + 1, kind: 'next' })
  }
  return cells
}
function todayIndex(m: MonthPage): number {
  return m.firstDow + m.today - 1
}
function answerIndex(m: MonthPage, s: Situation): number {
  return todayIndex(m) + s.moves.reduce((a, b) => a + b, 0)
}
function monthOf(m: MonthPage, c: Cell): string {
  return c.kind === 'prev' ? m.prevName : c.kind === 'next' ? m.nextName : m.name
}
/** "jueves 8 de mayo" */
function dateLabel(m: MonthPage, grid: Cell[], i: number): string {
  return `${WEEKDAYS[i % 7]} ${grid[i].day} de ${monthOf(m, grid[i]).toLowerCase()}`
}
function distanceText(n: number): string {
  const a = Math.abs(n)
  return `${a} ${a === 1 ? 'día' : 'días'}`
}
/** Hint 2: the weekday and how many rows away from "Hoy" the answer is. */
function narrowClue(m: MonthPage, grid: Cell[], s: Situation): string {
  const ai = answerIndex(m, s)
  const rows = Math.floor(ai / 7) - Math.floor(todayIndex(m) / 7)
  const where =
    rows === 0
      ? 'en la misma fila que Hoy'
      : `${ROW_WORDS[Math.abs(rows) - 1]} ${Math.abs(rows) === 1 ? 'fila' : 'filas'} más ${rows > 0 ? 'abajo' : 'arriba'} que Hoy`
  return `Es un ${WEEKDAYS[ai % 7]}${grid[ai].kind === 'next' ? ' del mes que viene' : ''}, ${where}.`
}
// ── data:end ──

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena cabeza!', '¡Perfecto!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/** The pause after a right answer, with its date on screen, before the next situation. */
const ADVANCE_MS = 1700
/** A tap this soon after a screen or a situation appears is the second tap of a double tap and is ignored. */
const SETTLE_MS = 400
/** From this many wrong cells on, the right one gets a ring. */
const RING_AFTER = 3
const WEEK_HEAD = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const NEXT_BUTTON =
  'inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark'

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Leé la situación y tocá en el calendario el día que corresponde. Contá desde «Hoy».',
    'Una semana son 7 días. Si te equivocás, te damos una ayuda.',
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
  const level = LEVELS[levelIdx]
  const month = level.month
  const grid = buildGrid(month)
  const tIdx = todayIndex(month)
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.situations.length

  const [step, setStep] = useState(0)
  // Cells already tried wrong for the current situation.
  const [tried, setTried] = useState<number[]>([])
  const [solvedAt, setSolvedAt] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ what: string; hint: string; ok: boolean } | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const timerRef = useRef<number | undefined>(undefined)
  const bornRef = useRef(0)
  const topRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  // The moment the current situation appeared, for the double-tap shield.
  useEffect(() => {
    bornRef.current = performance.now()
  }, [step])
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const situation = level.situations[step]
  const aIdx = answerIndex(month, situation)
  const locked = solvedAt !== null || done
  const ringOn = !locked && tried.length >= RING_AFTER
  const ringRef = useRef<HTMLButtonElement>(null)
  // The ring may fall in a row that is below the fold of a short phone: bring it into view.
  useEffect(() => {
    if (ringOn) ringRef.current?.scrollIntoView({ block: 'nearest' })
  }, [ringOn])

  function tap(i: number, at: number) {
    if (locked || tried.includes(i) || at - bornRef.current < SETTLE_MS || at - since < SETTLE_MS) return
    if (i === aIdx) {
      setSolvedAt(i)
      setMsg({ what: `¡Eso es! ${cap(dateLabel(month, grid, i))}.`, hint: '', ok: true })
      timerRef.current = window.setTimeout(() => {
        if (step < total - 1) {
          setStep((s) => s + 1)
          setTried([])
          setSolvedAt(null)
          setMsg(null)
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    const n = tried.length + 1
    setTried((t) => [...t, i])
    onMistake()
    const diff = i - tIdx
    const what =
      i === tIdx
        ? 'Ese es Hoy: desde ahí empezás a contar.'
        : `Ese es el ${WEEKDAYS[i % 7]} ${grid[i].day}${grid[i].kind === 'cur' ? '' : ` de ${monthOf(month, grid[i]).toLowerCase()}`}: ${distanceText(diff)} ${diff > 0 ? 'después' : 'antes'} de Hoy.`
    const hint = n === 1 ? situation.howToCount : n < RING_AFTER ? narrowClue(month, grid, situation) : 'Mirá el casillero con aro: ahí es.'
    setMsg({ what, hint, ok: false })
  }

  return (
    <div ref={topRef} className="pb-5 pt-3 sm:p-7 [@media(max-height:700px)]:pb-3">
      <div className="px-3 text-center sm:px-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Situación {step + 1} de {total}
          </span>
        )}
        {done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¡Completaste el {level.name.toLowerCase()}!</h2>
            <p className="mt-1 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* The situation, what the tapped cell is and the hint: a band that stays at the top while the page scrolls under
              it (on a short phone the last row of the month is below the fold), so the message is never out of sight */}
          <div className="sticky top-0 z-20 bg-white px-3 pb-1 pt-1 sm:-mx-7 sm:px-7">
            <p className="mx-auto max-w-md text-center text-lg font-bold leading-snug text-slate-900">{situation.text}</p>
            <div role="status" className="mx-auto mt-1 min-h-[6rem] max-w-md text-center text-base leading-snug">
              {msg ? (
                <>
                  <p className={`font-semibold ${msg.ok ? 'text-green-700' : 'text-slate-700'}`}>{msg.what}</p>
                  {msg.hint && <p className="text-slate-600">{msg.hint}</p>}
                </>
              ) : (
                <p className="text-slate-500">Tocá en el calendario el día que corresponde.</p>
              )}
            </div>
          </div>

          {/* The month page */}
          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl bg-white ring-2 ring-slate-200">
            <div className="relative flex items-center justify-center bg-tiam-blue py-1.5">
              <span aria-hidden="true" className="absolute left-6 top-1 h-2 w-2 rounded-full bg-white/80" />
              <span aria-hidden="true" className="absolute right-6 top-1 h-2 w-2 rounded-full bg-white/80" />
              <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white">{month.name}</h3>
            </div>
            <div className="pb-1 pt-1" role="group" aria-label={`Calendario de ${month.name.toLowerCase()}`}>
              <div className="grid grid-cols-7 gap-px text-center" aria-hidden="true">
                {WEEK_HEAD.map((d) => (
                  <span key={d} className="text-base font-bold leading-6 text-slate-600">
                    {d}
                  </span>
                ))}
              </div>
              <div className="mt-px grid grid-cols-7 gap-px">
                {grid.map((c, i) => {
                  const isToday = i === tIdx
                  const isTried = tried.includes(i)
                  const isRight = solvedAt === i
                  const neighbour = c.kind !== 'cur'
                  const tappable = !neighbour || month.tappableNeighbours
                  const base = 'flex h-11 min-w-0 flex-col items-center justify-center rounded-lg text-base font-bold leading-none'
                  const abbr = neighbour ? (
                    <span className="text-base font-semibold leading-none">{monthOf(month, c).slice(0, 3).toLowerCase()}</span>
                  ) : null
                  if (!tappable) {
                    return (
                      <div key={i} aria-label={dateLabel(month, grid, i)} className={`${base} bg-slate-50 text-slate-500`}>
                        {c.day}
                        {abbr}
                      </div>
                    )
                  }
                  const style = isRight
                    ? 'border-2 border-tiam-green bg-tiam-green/15 text-slate-900'
                    : isTried
                      ? 'cursor-not-allowed border border-slate-200 bg-slate-200 text-slate-500 line-through'
                      : isToday
                        ? 'border-[3px] border-tiam-navy bg-tiam-blue text-white'
                        : neighbour
                          ? 'border border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-tiam-blue/50'
                          : 'border border-slate-200 bg-white text-slate-900 hover:border-tiam-blue/50'
                  const ring = ringOn && i === aIdx ? 'ring-4 ring-tiam-orange motion-safe:animate-pulse' : ''
                  return (
                    <button
                      key={i}
                      ref={i === aIdx ? ringRef : undefined}
                      type="button"
                      disabled={locked || isTried}
                      aria-label={`${dateLabel(month, grid, i)}${isToday ? ', Hoy' : ''}${isTried ? ', ya probaste este día' : ''}`}
                      onClick={(e) => tap(i, e.timeStamp)}
                      className={`${base} transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/60 ${style} ${ring}`}
                    >
                      {c.day}
                      {isToday && <span className="text-base font-bold leading-none">Hoy</span>}
                      {isRight && <Check className="h-4 w-4 text-tiam-green" strokeWidth={3.5} aria-hidden="true" />}
                      {!isToday && !isRight && abbr}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {done && (
        <div ref={resultRef} className="mx-auto mt-4 max-w-md rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-slate-600">Las fechas de este nivel:</p>
          <ul className="mt-2 space-y-1.5 text-left text-base text-slate-700">
            {level.situations.map((s) => (
              <li key={s.short} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{s.short}:</span> {dateLabel(month, grid, answerIndex(month, s))}
                </span>
              </li>
            ))}
          </ul>
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

export function ElCalendario({ onComplete }: GameProps) {
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current screen on (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_SITUATIONS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Contá los días</h2>
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
