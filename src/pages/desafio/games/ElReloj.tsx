import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El reloj" — an analog clock-reading game, inspired by the classic
 * clock-reading visuospatial exercise: read the hour/minute hand positions
 * and pick the matching spoken time. All content (times, decoys, phrasing)
 * is original — nothing is derived from any third-party reference material.
 *
 * The clock face is drawn entirely in SVG from a {hour, minute} tuple, the
 * second game to draw its own stimulus instead of a Flux illustration (after
 * CaminoNumerico) — a clock is pure geometry, so rendering it live is crisper
 * than any fixed image set and needs zero art assets.
 *
 * Difficulty ramp (deliberately steep — the audience is training these areas,
 * not necessarily older): L1 already mixes o'clock/half/quarters; L2 covers
 * every 5-minute reading; L3 removes the NUMBERS from the face (ticks only, a
 * real clock-test variation) and uses adjacent-notch decoys. A wrong tap
 * eliminates that option (muted grey, never red) and re-examining the dial is
 * exactly the trained skill.
 */

interface ClockTime {
  hour: number // 1–12
  minute: number // multiple of 5
}
interface ClockRound {
  time: ClockTime
  decoys: ClockTime[]
}
interface Level {
  n: number
  name: string
  showNumbers: boolean
  hint?: string
  rounds: ClockRound[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    showNumbers: true,
    hint: 'La aguja corta y gruesa marca la hora; la aguja larga y fina, los minutos.',
    rounds: [
      { time: { hour: 3, minute: 0 }, decoys: [{ hour: 4, minute: 0 }, { hour: 3, minute: 30 }, { hour: 2, minute: 0 }] },
      { time: { hour: 6, minute: 30 }, decoys: [{ hour: 7, minute: 30 }, { hour: 6, minute: 0 }, { hour: 5, minute: 30 }] },
      { time: { hour: 4, minute: 15 }, decoys: [{ hour: 5, minute: 15 }, { hour: 4, minute: 45 }, { hour: 3, minute: 15 }] },
      { time: { hour: 9, minute: 45 }, decoys: [{ hour: 9, minute: 15 }, { hour: 8, minute: 45 }, { hour: 10, minute: 15 }] },
      { time: { hour: 1, minute: 0 }, decoys: [{ hour: 2, minute: 0 }, { hour: 1, minute: 30 }, { hour: 12, minute: 0 }] },
      { time: { hour: 11, minute: 30 }, decoys: [{ hour: 12, minute: 30 }, { hour: 11, minute: 0 }, { hour: 10, minute: 30 }] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    showNumbers: true,
    hint: 'Ahora los minutos son más variados. Fijate bien a qué marca apunta la aguja larga.',
    rounds: [
      { time: { hour: 7, minute: 25 }, decoys: [{ hour: 7, minute: 20 }, { hour: 8, minute: 25 }, { hour: 7, minute: 30 }] },
      { time: { hour: 2, minute: 40 }, decoys: [{ hour: 2, minute: 35 }, { hour: 1, minute: 40 }, { hour: 2, minute: 45 }] },
      { time: { hour: 10, minute: 10 }, decoys: [{ hour: 10, minute: 5 }, { hour: 11, minute: 10 }, { hour: 10, minute: 15 }] },
      { time: { hour: 4, minute: 50 }, decoys: [{ hour: 4, minute: 55 }, { hour: 3, minute: 50 }, { hour: 4, minute: 45 }] },
      { time: { hour: 8, minute: 5 }, decoys: [{ hour: 8, minute: 0 }, { hour: 9, minute: 5 }, { hour: 8, minute: 10 }] },
      { time: { hour: 1, minute: 35 }, decoys: [{ hour: 1, minute: 40 }, { hour: 1, minute: 30 }, { hour: 2, minute: 35 }] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    showNumbers: false,
    hint: 'Este reloj no tiene números — guiate por las marcas y por dónde apunta cada aguja.',
    rounds: [
      { time: { hour: 5, minute: 20 }, decoys: [{ hour: 5, minute: 25 }, { hour: 5, minute: 15 }, { hour: 6, minute: 20 }] },
      { time: { hour: 9, minute: 35 }, decoys: [{ hour: 9, minute: 40 }, { hour: 9, minute: 30 }, { hour: 10, minute: 35 }] },
      { time: { hour: 12, minute: 55 }, decoys: [{ hour: 12, minute: 50 }, { hour: 11, minute: 55 }, { hour: 12, minute: 45 }] },
      { time: { hour: 3, minute: 10 }, decoys: [{ hour: 3, minute: 5 }, { hour: 3, minute: 15 }, { hour: 4, minute: 10 }] },
      { time: { hour: 6, minute: 40 }, decoys: [{ hour: 6, minute: 35 }, { hour: 6, minute: 45 }, { hour: 5, minute: 40 }] },
      { time: { hour: 10, minute: 50 }, decoys: [{ hour: 10, minute: 55 }, { hour: 10, minute: 45 }, { hour: 9, minute: 50 }] },
    ],
  },
]

// Total clock-reading count across all 3 levels — every round resolves after
// its correct tap, so totalAttempts = mistakes + this.
const TOTAL_ROUNDS = LEVELS.reduce((sum, lvl) => sum + lvl.rounds.length, 0)

// ── Spanish (Rioplatense) time phrasing ──────────────────────────────────────
const HOUR_WORDS = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce']
const MINUTE_WORDS: Record<number, string> = { 5: 'cinco', 10: 'diez', 20: 'veinte', 25: 'veinticinco' }
const wrapHour = (h: number) => ((h - 1 + 12) % 12) + 1
const articulo = (h: number) => (h === 1 ? 'la una' : `las ${HOUR_WORDS[h]}`)

function spanishTime(hour: number, minute: number): string {
  if (minute === 0) return `${articulo(hour)} en punto`
  if (minute === 15) return `${articulo(hour)} y cuarto`
  if (minute === 30) return `${articulo(hour)} y media`
  if (minute === 45) return `${articulo(wrapHour(hour + 1))} menos cuarto`
  if (minute < 30) return `${articulo(hour)} y ${MINUTE_WORDS[minute]}`
  return `${articulo(wrapHour(hour + 1))} menos ${MINUTE_WORDS[60 - minute]}`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const sentenceFor = (h: number, m: number) => {
  const phrase = spanishTime(h, m)
  return `${phrase.startsWith('la una') ? 'Es' : 'Son'} ${phrase}.`
}

// ── SVG geometry ─────────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

function ClockFace({ hour, minute, showNumbers }: { hour: number; minute: number; showNumbers: boolean }) {
  const hourAngle = (hour % 12) * 30 + minute * 0.5
  const minuteAngle = minute * 6
  const hEnd = polar(50, 50, 22, hourAngle)
  const mEnd = polar(50, 50, 37, minuteAngle)
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#D4DEEA" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = i * 30
        const p1 = polar(50, 50, 38, a)
        const p2 = polar(50, 50, 43, a)
        return <line key={`t${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#B6C4D6" strokeWidth="1.5" strokeLinecap="round" />
      })}
      {showNumbers &&
        Array.from({ length: 12 }, (_, i) => {
          const n = i + 1
          const p = polar(50, 50, 31, (n % 12) * 30)
          return (
            <text key={`n${n}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill="#27384F">
              {n}
            </text>
          )
        })}
      <line x1="50" y1="50" x2={hEnd.x} y2={hEnd.y} stroke="#16263F" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2={mEnd.x} y2={mEnd.y} stroke="#16263F" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="3" fill="#16263F" />
    </svg>
  )
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

interface ClockOption {
  id: string
  label: string
}
function optionsFor(round: ClockRound): ClockOption[] {
  return shuffle(
    [round.time, ...round.decoys].map((t) => ({ id: `${t.hour}:${t.minute}`, label: cap(spanishTime(t.hour, t.minute)) })),
  )
}

const ROUND_PRAISE = ['¡Exacto!', '¡Muy bien!', '¡Así se hace!', '¡Perfecto!']
const WRONG_HINTS = [
  'Ese no es — fijate bien en las agujas.',
  'Casi. Mirá primero la aguja corta: ¿a qué número apunta?',
  'No es esa — repasá dónde está la aguja larga.',
  'Todavía no. Probá con otra opción.',
]
const LEVEL_PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena lectura del reloj!']

export function ElReloj({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(ROUND_PRAISE[0])
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (round ? optionsFor(round) : []), [round])
  const correctId = round ? `${round.time.hour}:${round.time.minute}` : ''

  useEffect(() => {
    if (done) setLevelPraise(pickOne(LEVEL_PRAISE))
  }, [done])

  function guess(id: string) {
    if (resolved || !round) return
    if (id === correctId) {
      setPraise(pickOne(ROUND_PRAISE))
      setResolved(true)
      setHint(null)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
      setHint(pickOne(WRONG_HINTS))
    }
  }
  function handleNext() {
    setCurrentIndex((i) => i + 1)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }
  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see ElVuelto.tsx for
  // why: an effect-based reset lags one render behind, letting `done` read
  // stale-true right as levelIdx reaches the last level and firing
  // onComplete with garbage data.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra ronda" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when level 3's last clock round resolves. A full
  // day restart (the wrap to level 1) gets a new roundKey, so a genuine
  // replay reports again; re-rendering while already done on level 3 does
  // not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          Praxias · {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué hora muestra el reloj?</h2>
            {level.hint && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(currentIndex / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Clock */}
          <div className="relative mx-auto mt-6 aspect-square w-56 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:w-64">
            <ClockFace hour={round.time.hour} minute={round.time.minute} showNumbers={level.showNumbers} />
          </div>

          {/* Options */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              const isCorrectShown = resolved && opt.id === correctId
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt.id)}
                  className={[
                    'relative min-h-[64px] rounded-2xl border-2 px-4 py-3 text-base font-bold transition sm:text-lg',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt.label}
                  {isCorrectShown && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}

          {resolved && (
            <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
                <Sparkles className="h-6 w-6 text-tiam-green" />
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{praise}</p>
              <p className="mt-1 text-slate-600">{sentenceFor(round.time.hour, round.time.minute)}</p>
              <button
                type="button"
                onClick={handleNext}
                className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                {currentIndex < order.length - 1 ? 'Siguiente' : 'Terminar'}
                <ArrowRight className="h-4 w-4" />
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
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Leíste los {order.length} relojes — completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
