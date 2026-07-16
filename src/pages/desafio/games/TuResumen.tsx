import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Minus, Plus, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Tu resumen" — día 30, cálculo, and the challenge's FINALE. Like
 * OrdenaTuSemana.tsx (día 28), its content is the player's OWN real
 * challenge history rather than authored scenarios — but where that game is
 * a 12-round drill, this one is deliberately short and ceremonial: just 3
 * questions, one per level, each confirmed with the same +/- stepper
 * mechanic as ContadorMasMenos.tsx (a running counter, tap +/- toward a
 * target, "Listo" to check, warm never-red hints on a miss).
 *
 * No rounds-within-a-level layer at all (unlike every other multi-round
 * game in this folder) — "done" for a level is just "this level's one
 * check succeeded." Reusing ContadorMasMenos's raw stepper mechanic only:
 *   - increment/decrement clamp to [0, 99] (plenty of headroom — even every
 *     playable day at 3 stars each stays well under 100).
 *   - check() is the same three-way comparison (exact / too high / too low)
 *     with the exact same hint copy, incrementing `mistakes` on a miss.
 *
 * Deliberate deviation from ContadorMasMenos: no `window.setTimeout(...900)`
 * auto-advance between questions. This is the closing day of a 30-day
 * journey and each number is genuinely personal (how many days, how many
 * stars, the longest streak) — an explicit "Siguiente" tap lets the player
 * sit with each answer instead of a clock whisking them along, matching
 * this app's house "no timer, ever" rule in spirit as well as letter.
 *
 * Targets are snapshotted ONCE, the first time `progress` is non-null (via
 * `targetsRef` below) — NOT read live from the `progress` prop on every
 * render. This isn't just style: `onComplete` fires the instant question 3
 * resolves, which makes `DesafioPlayPage` POST + refetch `progress` in the
 * background, and that refreshed `progress` already includes day 30's own
 * just-completed result. Reading targets live would make the finale text
 * cite numbers that silently grew to include the day the player is ON —
 * diverging from the exact numbers they were just quizzed on and confirmed
 * seconds earlier. The snapshot keeps the finale honest. `progress` being
 * null/sparse never breaks this game the way it could break OrdenaTuSemana:
 * every target has an honest fallback of 0, and 0 is a perfectly valid
 * number to confirm on the stepper — so there's no "not enough data" screen
 * here, unlike that file.
 */

interface SummaryStep {
  n: number
  name: string
  prompt: string
}

const STEPS: SummaryStep[] = [
  { n: 1, name: 'Nivel 1', prompt: '¿Cuántos días del desafío ya jugaste?' },
  { n: 2, name: 'Nivel 2', prompt: '¿Cuántas estrellas conseguiste en total?' },
  { n: 3, name: 'Nivel 3', prompt: '¿Cuál fue tu racha más larga de días seguidos?' },
]

// Per-question affirmation once the stepper matches the target — only ever
// indexed at 0 or 1 (question 3 renders the finale screen instead).
const AFFIRMATIONS = [
  (n: number) => `¡Exacto! Jugaste ${n} días del desafío.`,
  (n: number) => `¡Así es! Sumaste ${n} estrellas en total.`,
]

export function TuResumen({ day: _day, onComplete, progress }: GameProps) {
  // Snapshot the moment `progress` is first non-null, then never touch it
  // again — see the file header for why this must not track live updates.
  const targetsRef = useRef<{ totalDaysPlayed: number; totalStars: number; longestStreak: number } | null>(null)
  if (targetsRef.current === null && progress) {
    const days = progress.days ?? []
    targetsRef.current = {
      totalDaysPlayed: days.length,
      totalStars: days.reduce((sum, d) => sum + d.stars, 0),
      longestStreak: progress.streak?.longest ?? 0,
    }
  }
  const { totalDaysPlayed, totalStars, longestStreak } = targetsRef.current ?? {
    totalDaysPlayed: 0,
    totalStars: 0,
    longestStreak: 0,
  }
  const targets = [totalDaysPlayed, totalStars, longestStreak]

  const [levelIdx, setLevelIdx] = useState(0)
  const [counter, setCounter] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  // Failed-check count, accumulated across all 3 questions — same policy as
  // ContadorMasMenos.tsx. There's no natural per-tap wrong/right (the
  // stepper is always valid); only a "Listo" check that misses the target.
  const [mistakes, setMistakes] = useState(0)

  const step = STEPS[levelIdx]
  const target = targets[levelIdx]
  const isFinale = levelIdx === STEPS.length - 1

  function increment() {
    if (resolved) return
    setCounter((c) => Math.min(99, c + 1))
    setHint(null)
  }
  function decrement() {
    if (resolved) return
    setCounter((c) => Math.max(0, c - 1))
    setHint(null)
  }
  function check() {
    if (counter === target) {
      setResolved(true)
      setHint(null)
    } else if (counter > target) {
      setHint('Te pasaste un poco. Probá bajar con el −.')
      setMistakes((m) => m + 1)
    } else {
      setHint('Todavía te falta. Sumá un poco más con el +.')
      setMistakes((m) => m + 1)
    }
  }
  // Advance to the next question. Only reachable while `!isFinale` — the
  // button that calls this doesn't render on question 3.
  function next() {
    setLevelIdx((i) => i + 1)
    setCounter(0)
    setHint(null)
    setResolved(false)
  }

  // Fires exactly once, when the 3rd question resolves — no replay path
  // exists for this game (it's the challenge's closing screen), so a
  // one-shot boolean ref is enough; unlike the other games' `roundKey`-
  // guarded ref, there's no legitimate "restart" that should report again.
  const reportedRef = useRef(false)
  useEffect(() => {
    if (resolved && isFinale && !reportedRef.current) {
      reportedRef.current = true
      onComplete({ mistakes, totalAttempts: mistakes + STEPS.length })
    }
  }, [resolved, isFinale, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {step.name}
        </span>
        {!resolved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{step.prompt}</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Pregunta {levelIdx + 1} de {STEPS.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                style={{ width: `${(levelIdx / STEPS.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!resolved && (
        <>
          {/* Stepper */}
          <div className="mt-8 flex items-center justify-center gap-6">
            <button
              type="button"
              disabled={resolved || counter === 0}
              onClick={decrement}
              aria-label="Restar uno"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-tiam-blue text-white shadow transition hover:brightness-110 active:scale-95 disabled:opacity-30 sm:h-20 sm:w-20"
            >
              <Minus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={3} />
            </button>
            <span className="min-w-[4ch] text-center text-6xl font-extrabold leading-none tracking-tight text-tiam-blue sm:text-7xl">
              {counter}
            </span>
            <button
              type="button"
              disabled={resolved}
              onClick={increment}
              aria-label="Sumar uno"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-tiam-blue text-white shadow transition hover:brightness-110 active:scale-95 disabled:opacity-30 sm:h-20 sm:w-20"
            >
              <Plus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={3} />
            </button>
          </div>

          {hint && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={check}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Listo
            </button>
          </div>
        </>
      )}

      {/* Resolved: brief affirmation + explicit "Siguiente" for questions 1-2 */}
      {resolved && !isFinale && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{AFFIRMATIONS[levelIdx](target)}</p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Resolved on the 3rd question: the whole challenge's closing screen —
          bigger, warmer, no further action needed (onComplete already fired
          above; DesafioPlayPage takes it from here). */}
      {resolved && isFinale && (
        <div className="mt-8 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-10 w-10 text-tiam-green" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">¡Felicitaciones!</p>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Completaste los 30 días del desafío. Jugaste {totalDaysPlayed} días, sumaste {totalStars} estrellas en
            total, y tu racha más larga fue de {longestStreak} días seguidos.
          </p>
          <p className="mt-3 text-base font-semibold text-slate-700 sm:text-lg">
            Gracias por dedicarte este tiempo a vos. ¡Es un logro enorme!
          </p>
        </div>
      )}
    </div>
  )
}
