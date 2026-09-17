import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles, Pencil } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Telaraña matemática" — día 11, cálculo. Adapted from a paper exercise: a
 * web of numbers joined by operation links, where you start at one number
 * and walk the chain, doing each calculation as you go. The touch version
 * renders that walk as a single vertical chain that BUILDS downward: each
 * correct tap appends its value to the trail (highlighted node becomes
 * muted "done" green, matching SumaHastaDiez's claimed styling) and reveals
 * the next operation plus a fresh set of 4 candidates. Only the last two
 * values stay on screen, with a ⋮ above them once older ones drop off: the
 * full trail pushed the options below the fold on a phone from the fourth
 * step on.
 *
 * One web per level, 4/5/6 steps. Levels used to play two webs each (8, 10
 * and 12 calculations), which made the multiplication and division levels
 * too long. The day opens on a "¿Cómo se juega?" screen that also suggests
 * keeping pencil and paper at hand for the calculations.
 *
 * Generation walks strictly left-to-right — start value, then apply one
 * operation per step, current becomes the next step's input — never
 * generated backward from a target, so every value is correct by
 * construction (same criterion as CalculoEnCuadro/MesaDeCartas).
 *
 * The one invariant worth proving rather than assuming: for ANY current
 * value in [1,200], at least one of 'add'/'sub' always has a valid operand.
 * 'add' only runs out of room above `200 - operandRange[0]`; 'sub' only
 * runs out below `operandRange[0] + 1`. Those two dead zones can only
 * overlap when `operandRange[0] > 100` — every level here keeps it well
 * under that (max 10) — so they never do, and 'add'/'sub' sit in every
 * level's op list. That means `buildStep` can never fail to place a value:
 * no retry loop, no guard counter, no thrown "couldn't generate" escape
 * hatch anywhere in this file (the throw in buildStep exists only to
 * satisfy TypeScript's return type — see the 2000-run generator check that
 * shipped with this change, which never hit it). 'mul'/'div' are extra
 * options tried first (shuffled in with 'add'/'sub' each step), used only
 * when they fit the current value; 'add'/'sub' are the guaranteed fallback.
 *
 * 'div' never guesses: the candidate divisor comes from a small,
 * familiar-magnitude pool (2-10, real times-tables) INTERSECTED with the
 * current value's actual divisors, so the result is always an exact
 * integer — never rounded, never checked after the fact.
 *
 * Each step shows 4 options (1 correct + 3 decoys). Decoys are either the
 * result of applying the operation the WRONG way (added instead of
 * multiplied, current and operand swapped, etc.) or an off-by-a-little
 * value near the correct one — `fillDecoys` tops up with correct±1, ±2, …
 * until there are 3, deduped through a Set, so two options can never
 * collide and a round can never become unanswerable.
 */

type OpKind = 'add' | 'sub' | 'mul' | 'div'

interface Level {
  n: number
  name: string
  chainLength: number
  ops: OpKind[]
  startRange: [number, number]
  operandRange: [number, number]
  multipliers: number[]
  divisors: number[]
}

const MIN_VALUE = 1
const MAX_VALUE = 200

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    chainLength: 4,
    ops: ['add', 'sub'],
    startRange: [10, 40],
    operandRange: [2, 12],
    multipliers: [],
    divisors: [],
  },
  {
    n: 2,
    name: 'Nivel 2',
    chainLength: 5,
    ops: ['add', 'sub', 'mul'],
    startRange: [15, 60],
    operandRange: [5, 20],
    multipliers: [2, 3, 4],
    divisors: [],
  },
  {
    n: 3,
    name: 'Nivel 3',
    chainLength: 6,
    ops: ['add', 'sub', 'mul', 'div'],
    startRange: [20, 90],
    operandRange: [10, 30],
    multipliers: [2, 3, 4, 5],
    divisors: [2, 3, 4, 5, 6, 8, 10],
  },
]

const TOTAL_STEPS = LEVELS.reduce((sum, lvl) => sum + lvl.chainLength, 0)

// Full class strings, never interpolated — Tailwind only emits classes it
// can read literally in the source. Nodes shrink a touch as the chain gets
// longer (4 → 5 → 6 steps) so a fully-grown Nivel 3 trail stays reasonable.
// How many trail values stay on screen: the previous one and the current
// one. Three already pushed the options below the fold at 375×812.
const VISIBLE_NODES = 2

const NODE_CLASS: Record<number, string> = {
  1: 'h-14 w-14 text-xl',
  2: 'h-12 w-12 text-lg',
  3: 'h-11 w-11 text-base',
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
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

interface ChainStep {
  label: string
  correct: number
  options: number[]
}
interface ChainRound {
  start: number
  steps: ChainStep[]
}

// Tops up `seeds` with off-by-a-little values around `correct` until there
// are `need` distinct, positive, non-huge decoys — a Set means a seed that
// collides with another seed (or with a padding value) simply merges away
// instead of producing a duplicate option.
function fillDecoys(correct: number, seeds: number[], need: number): number[] {
  const set = new Set<number>()
  for (const s of seeds) {
    if (Number.isInteger(s) && s > 0 && s <= 300 && s !== correct) set.add(s)
  }
  let offset = 1
  while (set.size < need && offset < 500) {
    const up = correct + offset
    const down = correct - offset
    if (up <= 300 && set.size < need) set.add(up)
    if (down > 0 && set.size < need) set.add(down)
    offset++
  }
  return shuffle(Array.from(set)).slice(0, need)
}

// Plausible "wrong operation" results — the mistake someone actually makes
// with this kind of chain (adds instead of multiplies, divides the wrong
// way round, forgets to apply the step at all).
function decoySeeds(current: number, kind: OpKind, operand: number): number[] {
  if (kind === 'add') return [current - operand, operand, current]
  if (kind === 'sub') return [current + operand, operand]
  if (kind === 'mul') return [current + operand, current * (operand + 1), operand]
  return [current * operand, current - operand, current + operand] // 'div'
}

interface StepAttempt {
  operand: number
  label: string
  result: number
}

// Never blind: the valid operand range (or divisor pool) is computed from
// `current` FIRST, then one value is picked from what's actually valid —
// never picked at random and checked after the fact.
function tryStep(current: number, kind: OpKind, level: Level): StepAttempt | null {
  if (kind === 'add') {
    const [lo, hi] = level.operandRange
    const maxOperand = Math.min(hi, MAX_VALUE - current)
    if (maxOperand < lo) return null
    const operand = randInt(lo, maxOperand)
    return { operand, label: `+${operand}`, result: current + operand }
  }
  if (kind === 'sub') {
    const [lo, hi] = level.operandRange
    const maxOperand = Math.min(hi, current - MIN_VALUE)
    if (maxOperand < lo) return null
    const operand = randInt(lo, maxOperand)
    return { operand, label: `−${operand}`, result: current - operand }
  }
  if (kind === 'mul') {
    const candidates = level.multipliers.filter((m) => current * m <= MAX_VALUE)
    if (candidates.length === 0) return null
    const operand = pickOne(candidates)
    return { operand, label: `×${operand}`, result: current * operand }
  }
  // 'div' — operand is always one of current's actual divisors (see file header).
  const candidates = level.divisors.filter((d) => current % d === 0)
  if (candidates.length === 0) return null
  const operand = pickOne(candidates)
  return { operand, label: `÷${operand}`, result: current / operand }
}

function buildStep(current: number, level: Level): ChainStep {
  for (const kind of shuffle(level.ops)) {
    const attempt = tryStep(current, kind, level)
    if (!attempt) continue
    const decoys = fillDecoys(attempt.result, decoySeeds(current, kind, attempt.operand), 3)
    return { label: attempt.label, correct: attempt.result, options: shuffle([attempt.result, ...decoys]) }
  }
  // Unreachable — see file header: 'add'/'sub' sit in every level's op list
  // and one of them always has room for some operand, for any current value
  // in [1,200].
  throw new Error('No se pudo generar un paso de la telaraña')
}

function buildChain(level: Level): ChainRound {
  const start = randInt(level.startRange[0], level.startRange[1])
  let current = start
  const steps: ChainStep[] = []
  for (let i = 0; i < level.chainLength; i++) {
    const step = buildStep(current, level)
    steps.push(step)
    current = step.correct
  }
  return { start, steps }
}
function buildEpoch(): ChainRound[] {
  return LEVELS.map((level) => buildChain(level))
}

// Worked example for the how-to screen: a start value and two steps.
const HOW_TO_EXAMPLE = {
  start: 20,
  steps: [
    { label: '+5', value: 25 },
    { label: '−3', value: 22 },
  ],
}

function HowToPlay({ onStart }: { onStart: () => void }) {
  // Kept short on purpose: the whole screen, "Empezar" included, has to fit a
  // phone without scrolling.
  const steps = [
    'Arrancás en un número.',
    'Hacé la cuenta que aparece abajo y tocá el resultado.',
    'Ese resultado es tu nuevo número: seguís con la próxima cuenta.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-2xl bg-white p-3">
        <p className="text-center text-sm font-semibold text-slate-500">Por ejemplo:</p>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-tiam-green bg-tiam-green/10 text-base font-extrabold text-tiam-green">
            {HOW_TO_EXAMPLE.start}
          </span>
          {HOW_TO_EXAMPLE.steps.map((step) => (
            <div key={step.label} className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-tiam-blue">{step.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-tiam-green bg-tiam-green/10 text-base font-extrabold text-tiam-green">
                {step.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-tiam-blue/15 bg-white p-3">
        <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
        <p className="text-base leading-snug text-slate-700">Tené a mano lápiz y papel: podés anotar las cuentas si te ayuda.</p>
      </div>

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

const PRAISE = ['¡Excelente!', '¡Muy bien calculado!', '¡Así se resuelve una telaraña!', '¡Perfecto!']
const HINTS = [
  'Casi — volvé a hacer la cuenta con calma.',
  'Ese no es. Fijate bien el número y la operación.',
  'No es esa opción — probá con otra.',
]

export function TelaranaMatematica({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // How-to screen, once per opening of the day — "Repetir" never sets it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  // Every level's web, decided once — at mount — never re-rolled just
  // because the player re-visits a level or hits "Repetir", so a replay
  // always walks the exact same chain (same content-freezing convention as
  // SumaHastaDiez.tsx's `epoch`).
  const [epochRounds] = useState(() => buildEpoch())

  const level = LEVELS[levelIdx]
  const [stepIdx, setStepIdx] = useState(0)
  const done = stepIdx >= level.chainLength
  const round = epochRounds[levelIdx]
  const currentStep = done ? undefined : round.steps[stepIdx]
  const trail = [round.start, ...round.steps.slice(0, stepIdx).map((s) => s.correct)]
  const firstVisible = Math.max(0, trail.length - VISIBLE_NODES)

  const [eliminated, setEliminated] = useState<Set<number>>(new Set())
  const [justCorrect, setJustCorrect] = useState<number | null>(null)
  const [resolving, setResolving] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Both accumulate across levels 1→2→3 and only zero on a genuine day
  // restart (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  const stepsInLevel = level.chainLength
  const stepsDoneInLevel = Math.min(stepIdx, stepsInLevel)

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function tap(step: ChainStep, value: number) {
    if (resolving || eliminated.has(value)) return
    if (value === step.correct) {
      setResolving(true)
      setJustCorrect(value)
      setHint(null)
      const lastStep = stepIdx + 1 >= level.chainLength
      window.setTimeout(
        () => {
          setStepIdx((s) => s + 1)
          setEliminated(new Set())
          setJustCorrect(null)
          setResolving(false)
        },
        lastStep ? 800 : 600,
      )
    } else {
      setEliminated((prev) => new Set(prev).add(value))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level change, not in an
  // effect keyed on levelIdx — an effect lags one render, so `done` (derived
  // straight from stepIdx) would read the previous level's stale-true
  // value on the very render that arrives at the new level and fire
  // onComplete with garbage. Same reasoning as SumaHastaDiez/ElVuelto.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setStepIdx(0)
    setEliminated(new Set())
    setJustCorrect(null)
    setHint(null)
    setResolving(false)
    setRoundKey((k) => k + 1)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (the wrap back to level 1) gets a new roundKey, so it can report
  // again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_STEPS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
            {level.name}
          </span>
        </div>
        <HowToPlay onStart={() => setPhase('playing')} />
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Hacé cada cuenta y tocá el resultado</h2>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Llevás {stepsDoneInLevel} de {stepsInLevel}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${(stepsDoneInLevel / stepsInLevel) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chain */}
      {!done && currentStep && (
        <>
          <div className="mx-auto mt-6 flex max-w-[220px] flex-col items-center">
            {firstVisible > 0 && (
              <span className="text-xl font-bold leading-none text-slate-300" aria-hidden="true">
                ⋮
              </span>
            )}
            {trail.map((value, i) => i < firstVisible ? null : (
              <div key={i} className="flex flex-col items-center">
                {i > 0 && (
                  <div className="flex flex-col items-center py-0.5">
                    <div className="h-2.5 w-0.5 bg-slate-200" />
                    <span className="my-0.5 text-sm font-bold text-slate-400">{round.steps[i - 1].label}</span>
                    <div className="h-2.5 w-0.5 bg-slate-200" />
                  </div>
                )}
                <div
                  className={[
                    'flex items-center justify-center rounded-full border-2 font-extrabold transition',
                    NODE_CLASS[level.n],
                    i === trail.length - 1
                      ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue ring-2 ring-tiam-blue/30'
                      : 'border-tiam-green bg-tiam-green/10 text-tiam-green',
                  ].join(' ')}
                >
                  {value}
                </div>
              </div>
            ))}

            {/* Pending operation — leads down to the options below. */}
            <div className="flex flex-col items-center py-0.5">
              <div className="h-2.5 w-0.5 bg-tiam-blue/40" />
              <span className="my-0.5 text-base font-extrabold text-tiam-blue">{currentStep.label}</span>
              <div className="h-2.5 w-0.5 bg-tiam-blue/40" />
            </div>
          </div>

          {/* Options */}
          <div className="mx-auto mt-2 grid max-w-xs grid-cols-2 justify-items-center gap-4">
            {currentStep.options.map((opt) => {
              const isEliminated = eliminated.has(opt)
              const isJustCorrect = opt === justCorrect
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isEliminated || resolving}
                  onClick={() => tap(currentStep, opt)}
                  aria-label={`resultado ${opt}`}
                  className={[
                    'relative flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-extrabold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isJustCorrect
                      ? 'border-tiam-green bg-tiam-green/10 text-tiam-green ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt}
                  {isJustCorrect && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && !resolving && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Resolviste la telaraña — ¡completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
