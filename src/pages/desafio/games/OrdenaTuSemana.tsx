import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import { CHALLENGE_DAYS } from '@/lib/challengeContent'
import type { DayResult, GameProps } from '@/lib/challengeProgress'

/**
 * "Ordená tu semana" — día 28, orientación. The first game in this app whose
 * content is the PLAYER'S OWN real challenge history instead of authored
 * content: each round samples a random subset of days the player has
 * actually completed (from `progress.days`) and asks them to tap those days
 * back into chronological order — a genuine temporal/self-orientation task
 * ("what did I do, and in what order?"), not a generic sequencing puzzle.
 *
 * Reuses PlanificaLaManana.tsx's exact structure: `useSequencingPuzzle` for
 * the tap-to-place mechanic, the same LEVELS→rounds-per-level shape, and the
 * same accMistakes/accAttempts/reportedRoundKeyRef accounting. Two
 * deliberate simplifications vs. that file:
 *   1. No distractor — real played days are inherently varied enough
 *      content; this game is a pure ordering task. (Also means we can use
 *      useSequencingPuzzle's own `isComplete`/`isCorrect` directly instead
 *      of recomputing them locally.)
 *   2. `pool` isn't static hardcoded content but a random N-day sample of
 *      `progress.days`, re-drawn per round (N = 3/4/5 matching level 1/2/3),
 *      then sorted ascending by `day` — day numbers are always chronological
 *      in this app's linear-unlock model, so sorting by `day` IS sorting by
 *      when it was played; no need to compare `playedAt` timestamps.
 *
 * Defensive by necessity: `progress` can be null (still loading) or have
 * fewer real days than a level wants (fresh/edge-case tokens). Every level's
 * group size clamps to `min(desired, available)`, floored at 2 (need at
 * least 2 days to have an order to guess). Below that floor there's nothing
 * honest to ask, so the component renders a short friendly message instead
 * of the game, with a button that still resolves the day gracefully. All
 * hooks are still called unconditionally above that branch (React rules of
 * hooks) so a late-arriving `progress` can flip the component from the
 * fallback straight into the real game without breaking hook order.
 */

interface WeekLevel {
  n: number
  name: string
  /** Rounds this level plays. */
  rounds: number
  /** Real days sampled per round, before clamping to what's available. */
  groupSize: number
}

const LEVELS: WeekLevel[] = [
  { n: 1, name: 'Nivel 1', rounds: 3, groupSize: 3 },
  { n: 2, name: 'Nivel 2', rounds: 4, groupSize: 4 },
  { n: 3, name: 'Nivel 3', rounds: 5, groupSize: 5 },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Justo el orden en que los jugaste!', '¡Excelente memoria!', '¡Así fue tu semana!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo fue el orden real.',
  '¡Casi! Con la práctica te sale cada vez mejor.',
]

const TITLE_BY_DAY = new Map(CHALLENGE_DAYS.map((d) => [d.day, d.title]))

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
function dayLabel(d: DayResult): string {
  return `Día ${d.day}: ${TITLE_BY_DAY.get(d.day) ?? 'Ejercicio'}`
}

export function OrdenaTuSemana({ day: _day, onComplete, progress }: GameProps) {
  const availableDays = progress?.days ?? []
  const canPlay = availableDays.length >= 2

  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const effectiveGroupSize = Math.max(2, Math.min(level.groupSize, availableDays.length || 2))

  // `level.rounds` distinct random samples of `effectiveGroupSize` real
  // played days, each sorted chronologically (ascending `day`) — that sort
  // order IS the correct answer this round's puzzle checks against.
  const roundSets = useMemo(() => {
    if (!canPlay) return []
    return Array.from({ length: level.rounds }, () =>
      shuffle(availableDays).slice(0, effectiveGroupSize).sort((a, b) => a.day - b.day),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIdx, roundKey, canPlay, effectiveGroupSize, availableDays.length])

  const [roundIdx, setRoundIdx] = useState(0)
  const roundDays = roundSets[roundIdx] ?? []
  const pool = useMemo(() => roundDays.map(dayLabel), [roundDays])

  const { bank, placed, place, unplace, isComplete, isCorrect } = useSequencingPuzzle(
    pool,
    `${levelIdx}-${roundKey}-${roundIdx}`,
  )
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across any same-level replay —
  // every submission counts), only zeroed on a true day restart. Same model
  // as PlanificaLaManana.tsx.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const done = checked && roundIdx >= level.rounds - 1

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    const taskMistakes = placed.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + taskMistakes)
    setAccAttempts((a) => a + pool.length)
  }
  // Advance to the next round within the level. Only reachable while
  // `!done` — the button that calls this doesn't render once the level is
  // complete.
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }
  // Resets happen HERE, synchronously with the level/round change — same
  // reasoning as PlanificaLaManana.tsx: keeps the onComplete-reporting
  // effect from ever seeing a stale `checked`/`roundIdx` next to a fresh
  // `levelIdx` on the same render.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulator — a same-level replay must NOT.
    if (isWrap) {
      setAccMistakes(0)
      setAccAttempts(0)
    }
  }
  function replay() {
    setChecked(false)
    setRoundIdx(0)
    setRoundKey((k) => k + 1)
  }

  // Reports the SUM across levels 1→2→3. Fires once per roundKey so a
  // genuine full-day restart (wrap to level 1, new roundKey) can report
  // again, matching PlanificaLaManana.tsx exactly.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  if (!canPlay) {
    return (
      <div className="p-5 text-center sm:p-7">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          Orientación
        </span>
        <p className="mt-4 text-base text-slate-600">
          Todavía no tenés días jugados para repasar. ¡Seguí con el desafío y volvé más adelante!
        </p>
        <button
          type="button"
          onClick={() => onComplete({ mistakes: 0, totalAttempts: 1 })}
          className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
        >
          Continuar
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Ordená estos días del desafío</h2>
            <p className="mt-2 text-base text-slate-500">Tocalos del más antiguo al más nuevo.</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Sequence being built */}
          <div className="mt-6 min-h-[64px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {placed.length === 0 && (
              <p className="text-center text-sm text-slate-400">Tocá los días de abajo para empezar</p>
            )}
            <div className="flex flex-col gap-2">
              {placed.map((item, i) => {
                const isRight = checked && item.id === i
                const isWrong = checked && item.id !== i
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={checked}
                    onClick={() => unplace(item)}
                    className={[
                      'flex items-start gap-2 rounded-xl border-2 px-4 py-2.5 text-left text-base transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      isRight ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : '',
                      isWrong ? 'border-slate-300 bg-white text-slate-500' : '',
                      !checked ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10' : '',
                    ].join(' ')}
                  >
                    <span className="mt-0.5 shrink-0 font-bold text-slate-400">{i + 1}.</span>
                    <span>{item.value}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bank */}
          {!checked && (
            <div className="mt-4 flex flex-col gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => place(item)}
                  className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-left text-base text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {/* Check button */}
          {isComplete && !checked && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Result */}
      {checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <div className="mt-3 text-left text-sm text-slate-600">
              <p className="font-semibold text-slate-700">El orden real era:</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {roundDays.map((d) => (
                  <li key={d.day}>{dayLabel(d)}</li>
                ))}
              </ol>
            </div>
          )}
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {done ? (
              <>
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
                  Otro grupo
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente grupo
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
