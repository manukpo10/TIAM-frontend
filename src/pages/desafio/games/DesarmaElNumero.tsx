import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Flower2, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Desarmá el número" — día 8, mes 6, cálculo. A flower with a number in its centre and one petal per place of that
 * number (unidad de mil, centena, decena, unidad). The player takes a value from the row of chips below (4.000, 500,
 * 80, 1) and taps the petal it belongs to. The mechanic comes from a worksheet where each petal of a flower is filled
 * with the value of a figure of the number written in the middle; here nothing is written by hand: the values are chips
 * and a petal answers at once.
 *
 * ORIGINAL CONTENT. Only the idea (decomposing a number into the value of each of its figures, on a flower) is
 * borrowed. The numbers are TIAM's own, and a throwaway script (not committed) checks that none of the numbers of the
 * worksheet is here, that the petals of a flower add up to its number, that the number written in letters (level 3) is
 * exactly the one of the centre by reading the words back into a number, and that no number repeats in the day.
 *
 * THE RAMP is what a flower asks. Level 1: three-figure numbers (centena, decena, unidad), the number in figures and
 * no zero. Level 2: four-figure numbers (adds the unidad de mil), still in figures and no zero. Level 3: four-figure
 * numbers WITH zeros, and the number is WRITTEN IN LETTERS ("siete mil doscientos cinco") instead of in figures: the
 * player has to read it and notice that a place that is not named is worth 0 (the chip "0" is there, twice).
 *
 * A WRONG CHIP costs ONE mistake, goes back to the row (muted gray on the petal, never red) and the hint grows with
 * the misses on that petal: what the place is, then the figure that sits in it, then the right chip is ringed. The
 * chip is checked against the VALUE, so either of the two "0" chips fits a petal worth 0. Nothing is timed but a short
 * pause so the finished flower is seen.
 *
 * THREE FLOWERS A LEVEL, as the tallerista likes the days short. Each level has a pool of four numbers; three are picked
 * ONCE at mount (`epoch`, with the order of the chips), so "Repetir" replays exactly the same nine flowers.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored (the chips
 * sit where that button was), a second tap on a chosen chip is not "take it back".
 *
 * totalAttempts = mistakes + every petal of the day (TOTAL_PETALS, derived).
 */

// ── data:start ──
type PlaceId = 'um' | 'c' | 'd' | 'u'
interface PlaceDef {
  label: string
  /** What one of this place is worth. */
  unit: number
  /** What the place is, for the first hint. */
  tip: string
}
const PLACES: Record<PlaceId, PlaceDef> = {
  um: { label: 'Unidad de mil', unit: 1000, tip: 'La unidad de mil cuenta de mil en mil: 1.000, 2.000, 3.000…' },
  c: { label: 'Centena', unit: 100, tip: 'La centena cuenta de cien en cien: 100, 200, 300…' },
  d: { label: 'Decena', unit: 10, tip: 'La decena cuenta de diez en diez: 10, 20, 30…' },
  u: { label: 'Unidad', unit: 1, tip: 'La unidad cuenta de a uno: 1, 2, 3…' },
}

interface LevelDef {
  name: string
  /** The petals of the flower, in the order they are asked. */
  places: PlaceId[]
  /** How the number shows in the centre: in figures or written in letters. */
  mode: 'digits' | 'words'
  /** Pool of numbers; FLOWERS_PER_LEVEL of them are played. */
  pool: number[]
}

const FLOWERS_PER_LEVEL = 3

const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', places: ['c', 'd', 'u'], mode: 'digits', pool: [268, 593, 714, 436] },
  { name: 'Nivel 2', places: ['um', 'c', 'd', 'u'], mode: 'digits', pool: [5739, 2486, 8164, 6352] },
  { name: 'Nivel 3', places: ['um', 'c', 'd', 'u'], mode: 'words', pool: [3060, 7205, 5008, 8040] },
]
const TOTAL_PETALS = LEVELS.reduce((sum, lvl) => sum + lvl.places.length * FLOWERS_PER_LEVEL, 0)

/** The number written the way an Argentine reads it (100 to 9999). */
const UNITS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
const TENS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']
function underHundred(n: number): string {
  if (n < 10) return UNITS[n]
  if (n < 20) return TEENS[n - 10]
  if (n === 20) return 'veinte'
  if (n < 30) return ({ 22: 'veintidós', 23: 'veintitrés', 26: 'veintiséis' } as Record<number, string>)[n] ?? 'veinti' + UNITS[n - 20]
  const t = Math.floor(n / 10)
  const u = n % 10
  return u === 0 ? TENS[t] : `${TENS[t]} y ${UNITS[u]}`
}
function underThousand(n: number): string {
  if (n === 100) return 'cien'
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [HUNDREDS[h], rest ? underHundred(rest) : ''].filter(Boolean).join(' ')
}
function toWords(n: number): string {
  const th = Math.floor(n / 1000)
  const rest = n % 1000
  const head = th === 0 ? '' : th === 1 ? 'mil' : `${UNITS[th]} mil`
  return [head, rest ? underThousand(rest) : ''].filter(Boolean).join(' ')
}
/** 4.000 with the dot of an Argentine thousands separator, also for four figures. */
function fmt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
/** What the figure of a place is worth in a number: 3.060 in the centena is 0, in the decena is 60. */
function valueAt(n: number, place: PlaceId): number {
  const unit = PLACES[place].unit
  return (Math.floor(n / unit) % 10) * unit
}

/** The numbers of the how-to screen: it is not in the game. */
const EXAMPLE = { n: 931, text: 'la centena vale 900, la decena vale 30 y la unidad vale 1' }
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

interface Chip {
  id: number
  value: number
}
interface PreparedFlower {
  n: number
  /** The values of its petals, in the order they show in the row. */
  chips: Chip[]
}
function buildEpoch(): PreparedFlower[][] {
  return LEVELS.map((lvl) =>
    shuffle(lvl.pool)
      .slice(0, FLOWERS_PER_LEVEL)
      .map((n) => ({ n, chips: shuffle(lvl.places.map((p) => valueAt(n, p))).map((value, id) => ({ id, value })) })),
  )
}

/** The hint after a wrong chip: it grows with every miss on the same petal, and from the third one it says the value. */
function missHint(place: PlaceId, n: number, mode: LevelDef['mode'], misses: number): string {
  const label = PLACES[place].label
  const value = valueAt(n, place)
  if (misses === 1) return `Ese valor no va ahí. ${PLACES[place].tip}`
  if (misses === 2) {
    return mode === 'digits'
      ? `En el ${fmt(n)}, la cifra de la ${label.toLowerCase()} es el ${(value / PLACES[place].unit) % 10}. Fijate cuánto vale en ese lugar.`
      : 'Si un lugar no se nombra en el número, vale 0.'
  }
  return `Acá va el ${fmt(value)}: tocalo y después tocá el pétalo.`
}

/** Petals around the centre: where each one sits in the flower (4: the corners, 3: one above and two below). */
const PETAL_POS: Record<number, string[]> = {
  3: ['left-[26%] top-[1%]', 'bottom-[3%] left-[1%]', 'bottom-[3%] right-[1%]'],
  4: ['left-[1%] top-[3%]', 'right-[1%] top-[3%]', 'bottom-[3%] left-[1%]', 'bottom-[3%] right-[1%]'],
}
const PETAL_TINT: Record<PlaceId, string> = {
  um: 'bg-sky-100',
  c: 'bg-emerald-100',
  d: 'bg-amber-100',
  u: 'bg-rose-100',
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena cuenta!', '¡Perfecto!']
/** The pause after a finished flower, with it on screen, before the next one. */
const ADVANCE_MS = 1500
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a chip: the chips sit where that button was. Also the window in which a second tap
 * on the same chip is a double tap, not "choose it again to take it back". */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'En el centro de la flor está un número. Cada pétalo es una parte: unidad de mil, centena, decena o unidad.',
    'Tocá un valor de abajo y después tocá el pétalo al que le corresponde.',
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
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">
          En el {fmt(EXAMPLE.n)}, {EXAMPLE.text}.
        </p>
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
  flowers: PreparedFlower[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, flowers, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = flowers.length

  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  // The chip each petal holds (only right ones stay) and the wrong chips each petal has had.
  const [filled, setFilled] = useState<Partial<Record<PlaceId, number>>>({})
  const [misses, setMisses] = useState<Partial<Record<PlaceId, number>>>({})
  const [ringed, setRinged] = useState<number | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const lastChipTapRef = useRef({ id: -1, at: -Infinity })
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

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

  const current = flowers[qIdx]
  const busy = advancing || done
  const placedIds = new Set(Object.values(filled))
  const positions = PETAL_POS[level.places.length]

  function tapChip(id: number, at: number) {
    if (busy || at - since < SETTLE_MS || placedIds.has(id)) return
    const last = lastChipTapRef.current
    // The second tap of a double tap on the chosen chip is not "take it back".
    if (last.id === id && at - last.at < SETTLE_MS) return
    lastChipTapRef.current = { id, at }
    setSelected((cur) => (cur === id ? null : id))
    setHint(null)
  }

  function tapPetal(place: PlaceId, at: number) {
    if (busy || at - since < SETTLE_MS || filled[place] !== undefined) return
    if (selected === null) {
      setHint({ text: 'Primero tocá un valor de abajo.', ok: false })
      return
    }
    const chip = current.chips.find((c) => c.id === selected)
    if (!chip) return
    if (chip.value === valueAt(current.n, place)) {
      const next = { ...filled, [place]: chip.id }
      setFilled(next)
      setSelected(null)
      setRinged(null)
      if (Object.keys(next).length === level.places.length) {
        setAdvancing(true)
        setHint({ text: `¡Eso es! ${fmt(current.n)} = ${level.places.map((p) => fmt(valueAt(current.n, p))).join(' + ')}.`, ok: true })
        advanceTimerRef.current = window.setTimeout(() => {
          if (qIdx < total - 1) {
            setQIdx((i) => i + 1)
            setFilled({})
            setMisses({})
            setSelected(null)
            setRinged(null)
            setHint(null)
            setAdvancing(false)
          } else {
            setPraise(pickOne(PRAISE))
            setDone(true)
            onSolved()
          }
        }, ADVANCE_MS)
      } else {
        setHint({ text: '¡Bien! Seguí con otro pétalo.', ok: true })
      }
      return
    }
    const n = (misses[place] ?? 0) + 1
    setMisses((m) => ({ ...m, [place]: n }))
    setSelected(null)
    setHint({ text: missHint(place, current.n, level.mode, n), ok: false })
    // From the third miss on, the chip that fits is ringed.
    setRinged(n >= 3 ? (current.chips.find((c) => c.value === valueAt(current.n, place) && !placedIds.has(c.id))?.id ?? null) : null)
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
            Flor {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {level.mode === 'words' ? (
            <p className="mx-auto mt-2 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-2 text-center text-xl font-bold leading-snug text-slate-900">
              {toWords(current.n)}
            </p>
          ) : (
            <p className="mt-2 text-center text-base font-semibold text-slate-600">Desarmá el número de la flor.</p>
          )}

          {/* The flower: one petal per place, the number (or a flower, when it is written in letters) in the centre */}
          <div className="relative mx-auto mt-2 aspect-square w-full max-w-[17rem]">
            {level.places.map((place, i) => {
              const chipId = filled[place]
              const chip = chipId === undefined ? null : current.chips.find((c) => c.id === chipId)
              return (
                <button
                  key={place}
                  type="button"
                  disabled={busy || chip !== null}
                  aria-label={`${PLACES[place].label}${chip ? `: ${fmt(chip.value)}` : ''}`}
                  onClick={(e) => tapPetal(place, e.timeStamp)}
                  className={[
                    'absolute flex h-[44%] w-[47%] flex-col items-center justify-center rounded-[50%] border-2 px-2 text-center leading-tight transition',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                    positions[i],
                    chip
                      ? 'border-tiam-green bg-tiam-green/10'
                      : selected !== null
                        ? `${PETAL_TINT[place]} border-dashed border-tiam-blue`
                        : `${PETAL_TINT[place]} border-dashed border-slate-400`,
                  ].join(' ')}
                >
                  <span className="text-[13px] font-bold text-slate-700">{PLACES[place].label}</span>
                  <span className={`text-xl font-extrabold ${chip ? 'text-slate-900' : 'text-slate-400'}`}>{chip ? fmt(chip.value) : '?'}</span>
                </button>
              )
            })}
            <div
              className="absolute left-1/2 top-1/2 z-10 flex aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-100"
              aria-label={level.mode === 'digits' ? `Número: ${fmt(current.n)}` : 'Centro de la flor'}
            >
              {level.mode === 'digits' ? (
                <span className="text-xl font-extrabold text-slate-900">{fmt(current.n)}</span>
              ) : (
                <Flower2 className="h-8 w-8 text-amber-600" aria-hidden="true" />
              )}
            </div>
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[3rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? (selected !== null ? 'Ahora tocá el pétalo que le corresponde.' : 'Tocá un valor y después un pétalo.')}
          </p>

          {/* The values to place */}
          <div role="group" aria-label="Valores" className={`mx-auto grid max-w-md gap-2 ${level.places.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {current.chips.map((chip) => {
              const isPlaced = placedIds.has(chip.id)
              const isSelected = selected === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={busy || isPlaced}
                  aria-pressed={isSelected}
                  onClick={(e) => tapChip(chip.id, e.timeStamp)}
                  className={[
                    `flex min-h-[52px] items-center justify-center rounded-2xl border-2 px-1 font-extrabold transition ${level.places.length === 4 ? 'text-lg' : 'text-xl'}`,
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isPlaced
                      ? 'border-slate-100 bg-slate-50 text-slate-300'
                      : isSelected
                        ? 'border-tiam-blue bg-tiam-blue text-white shadow-md'
                        : ringed === chip.id
                          ? 'border-tiam-blue bg-white text-slate-800 ring-2 ring-tiam-blue/50'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md',
                  ].join(' ')}
                >
                  {fmt(chip.value)}
                </button>
              )
            })}
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
          <p className="mt-1 text-slate-600">Desarmaste las {total} flores. ¡Terminaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {flowers.map((f) => (
              <li key={f.n} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{fmt(f.n)}</span>
                  <span className="text-slate-500"> = {level.places.map((p) => fmt(valueAt(f.n, p))).join(' + ')}</span>
                </span>
              </li>
            ))}
          </ul>
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

export function DesarmaElNumero({ onComplete }: GameProps) {
  // Which numbers each level plays and the order of their chips — decided once, at mount, so "Repetir" replays exactly
  // the same content.
  const [epoch] = useState(buildEpoch)
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PETALS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Una flor, un número</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      flowers={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
