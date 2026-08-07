import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Delete, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Repetí la serie" — día 2 (Mes 2), memoria. Classic digit-span task: a
 * sequence of digits appears one at a time (nothing stays on screen once
 * shown — this tests memory, not visual copying), then the player reproduces
 * it in the same order by tapping a numeric keypad. No typing/free text,
 * same house rule every other game follows.
 *
 * Sequence length is the difficulty lever, escalating 3 → 5 → 7 digits
 * (level 1 warm-up up to level 3's harder span), 2 rounds per level = 6
 * total (trimmed from 3/level after professional feedback that 3 was too
 * much for this task). A round is graded whole (matched exactly or not)
 * rather than per-digit — same coarse, forgiving grading DosPistas uses for
 * its words — so totalAttempts is the fixed 6 rounds, never inflated by
 * retries: there is no retry within a round (like QueHayEnLaMesa/CuantosHay's
 * "single hidden test", not DondeEsta's eliminate-and-retry) because letting
 * someone keep guessing digits would turn a memory test into trial and error.
 *
 * A wrong round is never shown in red: the correct sequence is revealed
 * alongside a calm, encouraging line, then the player moves on.
 */

interface Level {
  n: number
  name: string
  digits: number
  rounds: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', digits: 3, rounds: 2 },
  { n: 2, name: 'Nivel 2', digits: 5, rounds: 2 },
  { n: 3, name: 'Nivel 3', digits: 7, rounds: 2 },
]
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
const REVEAL_MS = 900

type Phase = 'show' | 'input' | 'feedback'

// No immediate repeat (e.g. 3-3) — a repeated digit back to back reads as
// "did it blink twice?" rather than a clean two-item memory step.
function randomSequence(length: number): number[] {
  const seq: number[] = []
  for (let i = 0; i < length; i++) {
    let d = Math.floor(Math.random() * 10)
    while (i > 0 && d === seq[i - 1]) d = Math.floor(Math.random() * 10)
    seq.push(d)
  }
  return seq
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const KEYPAD: Array<Array<number | 'delete' | null>> = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [null, 0, 'delete'],
]

const PRAISE = ['¡Muy bien!', '¡Excelente memoria!', '¡Así se hace!', '¡Perfecto!']
const NUDGE = [
  'Casi. Con la práctica la memoria de números se entrena.',
  '¡Buen intento! Fijate bien en la serie correcta.',
  'No era esa, pero cada vez vas a recordar más.',
]

export function RepetiLaSerie({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which digit-sequence is playing for each round of each level THIS
  // "epoch" (a full 3-level pass) — one array of sequences per level, one
  // sequence per round. Decided once per epoch — at mount, and again on
  // "Hacer otro" — never re-rolled just because the player re-visits a
  // round, so "Repetir" can hand back the exact same sequences
  // deterministically instead of re-generating and accidentally landing on
  // something new.
  const [epochSequences, setEpochSequences] = useState(() =>
    LEVELS.map((lvl) => Array.from({ length: lvl.rounds }, () => randomSequence(lvl.digits))),
  )
  const level = LEVELS[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const sequence = epochSequences[levelIdx][roundIdx]

  const [phase, setPhase] = useState<Phase>('show')
  const [revealIdx, setRevealIdx] = useState(0)
  const [entered, setEntered] = useState<number[]>([])
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const [nudge, setNudge] = useState(NUDGE[0])
  // Mistakes accumulate across levels 1→2→3, only zeroed on a genuine day
  // restart (restartEpoch below) — same policy as every sibling game.
  const [mistakes, setMistakes] = useState(0)

  const done = phase === 'feedback' && roundIdx >= level.rounds - 1

  // Reveals one digit at a time, nothing stays visible once shown. Cleared
  // whenever phase/round changes (including the moment phase flips away from
  // 'show' below), so no stray tick can leak into the next round.
  useEffect(() => {
    if (phase !== 'show') return
    setRevealIdx(0)
    const id = window.setInterval(() => setRevealIdx((i) => i + 1), REVEAL_MS)
    return () => window.clearInterval(id)
  }, [phase, levelIdx, roundKey, roundIdx])

  useEffect(() => {
    if (phase === 'show' && revealIdx >= sequence.length) setPhase('input')
  }, [phase, revealIdx, sequence.length])

  // Single hidden test: the moment the player has tapped as many digits as
  // the sequence has, grade the whole round at once — no "revisar" button,
  // no partial credit, no retry (see header for why).
  useEffect(() => {
    if (phase !== 'input' || entered.length < sequence.length) return
    const isCorrect = entered.every((d, i) => d === sequence[i])
    if (isCorrect) {
      setPraise(pickOne(PRAISE))
    } else {
      setNudge(pickOne(NUDGE))
      setMistakes((m) => m + 1)
    }
    setLastCorrect(isCorrect)
    setPhase('feedback')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, phase])

  function tapDigit(d: number) {
    if (phase !== 'input' || entered.length >= sequence.length) return
    setEntered((prev) => [...prev, d])
  }
  function tapDelete() {
    if (phase !== 'input' || entered.length === 0) return
    setEntered((prev) => prev.slice(0, -1))
  }

  // Resets happen HERE, synchronously with the round/level change — never in
  // a separate useEffect keyed on [levelIdx, roundKey]: an effect only catches
  // up one render late, so `done` (derived from `phase`) could read the
  // previous round's stale 'feedback' right as levelIdx reaches the last
  // level, firing onComplete with garbage (the ElVuelto.tsx lesson).
  // Mid-level advance: a plain index bump. The next round's sequence was
  // already generated when this epoch started — no need to touch roundKey.
  function nextRound() {
    setRoundIdx((i) => i + 1)
    setPhase('show')
    setRevealIdx(0)
    setEntered([])
    setLastCorrect(null)
  }
  // "Siguiente nivel" — advance within the SAME attempt. epochSequences is
  // left alone: level i+1's sequences were already generated when this
  // epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPhase('show')
    setRevealIdx(0)
    setEntered([])
    setLastCorrect(null)
  }
  // Shared by both restart buttons on the final level's complete card.
  // roundKey always bumps here: it's the "which attempt is this" generation
  // counter the onComplete effect uses to fire again on a replay,
  // independent of whether the digits themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setPhase('show')
    setRevealIdx(0)
    setEntered([])
    setLastCorrect(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same sequences as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random sequence per round/level.
  function restartDifferent() {
    restartEpoch()
    setEpochSequences(LEVELS.map((lvl) => Array.from({ length: lvl.rounds }, () => randomSequence(lvl.digits))))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const shownIdx = Math.min(revealIdx, sequence.length - 1)

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {phase !== 'feedback' && (
          <>
            <p className="mt-2 text-base text-slate-500">
              {phase === 'show' ? 'Memorizá el orden de los números.' : 'Repetilo tocando los números en el mismo orden.'}
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {level.rounds}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                  style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Show phase: one digit at a time, nothing stays on screen */}
      {phase === 'show' && (
        <>
          <div className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-tiam-blue/20 bg-tiam-blue/5 sm:mt-8 sm:h-32 sm:w-32">
            {revealIdx < sequence.length && (
              <span
                key={revealIdx}
                className="text-6xl font-extrabold text-tiam-blue motion-safe:animate-[pop_0.3s_ease-out] sm:text-7xl"
              >
                {sequence[revealIdx]}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            {sequence.map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i <= shownIdx ? 'bg-tiam-blue' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* Input phase: slots + numeric keypad */}
      {phase === 'input' && (
        <>
          <div className="mt-5 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3 sm:mt-7">
            {Array.from({ length: sequence.length }).map((_, i) => {
              const d = entered[i]
              return d === undefined ? (
                <span
                  key={i}
                  aria-hidden="true"
                  className="h-[48px] w-[38px] rounded-xl border-2 border-dashed border-slate-300 bg-white"
                />
              ) : (
                <span
                  key={i}
                  className="flex h-[48px] w-[38px] items-center justify-center rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 text-xl font-extrabold text-slate-900 motion-safe:animate-[pop_0.2s_ease-out]"
                >
                  {d}
                </span>
              )
            })}
          </div>

          <div className="mx-auto mt-5 flex max-w-[280px] flex-col gap-2 sm:max-w-xs">
            {KEYPAD.map((row, ri) => (
              <div key={ri} className="grid grid-cols-3 gap-2">
                {row.map((key, ki) => {
                  if (key === null) return <span key={ki} aria-hidden="true" />
                  if (key === 'delete') {
                    return (
                      <button
                        key={ki}
                        type="button"
                        onClick={tapDelete}
                        disabled={entered.length === 0}
                        aria-label="Borrar último número"
                        className="flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0 disabled:opacity-30 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                      >
                        <Delete className="h-5 w-5" strokeWidth={2.25} />
                      </button>
                    )
                  }
                  return (
                    <button
                      key={ki}
                      type="button"
                      onClick={() => tapDigit(key)}
                      aria-label={`Número ${key}`}
                      className="flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-2xl font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                    >
                      {key}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Feedback: per-round result, never red on a miss */}
      {phase === 'feedback' && !done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{lastCorrect ? praise : '¡Seguimos!'}</p>
          {!lastCorrect && <p className="mt-1 text-slate-600">{nudge}</p>}
          <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-base font-medium text-slate-500">La serie era</span>
            {sequence.map((d, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-tiam-green/10 text-base font-bold text-tiam-green"
              >
                {d}
              </span>
            ))}
          </p>
          <button
            type="button"
            onClick={nextRound}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Siguiente serie
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{lastCorrect ? praise : '¡Seguimos practicando!'}</p>
          <p className="mt-1 text-slate-600">
            {!lastCorrect && (
              <span className="mb-1 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-base font-medium text-slate-500">La serie era</span>
                {sequence.map((d, i) => (
                  <span
                    key={i}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-tiam-green/10 text-base font-bold text-tiam-green"
                  >
                    {d}
                  </span>
                ))}
              </span>
            )}
            Completaste las {level.rounds} series — terminaste el {level.name.toLowerCase()}.
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Hacer otro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
