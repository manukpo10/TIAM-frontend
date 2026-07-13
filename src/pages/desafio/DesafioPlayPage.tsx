import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Brain, Eye, MessageCircle, Hand, Calculator, Compass, Lightbulb,
  Lock, Star, X, type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  CHALLENGE_DAYS,
  CHALLENGE_TOTAL_DAYS,
  type ChallengeAccess,
  type ChallengeArea,
} from '@/lib/challengeContent'
import { computeStars, type BadgeId, type ChallengeProgress, type CompleteDayResponse, type GameResult } from '@/lib/challengeProgress'
import logoImg from '@/assets/logo-sinfondo.png'
import { GAMES } from './games/registry'
import { ChallengeProgressPanel } from './ChallengeProgressPanel'
import { DayResultOverlay } from './DayResultOverlay'
import { BadgeUnlockOverlay } from './BadgeUnlockOverlay'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

// Shown only while the star system is still new to this buyer (the first
// few days played ever) or when a replay genuinely improves a day's already-
// recorded stars — never on every single completion, which would just turn
// into noise once someone already knows how it works.
const STAR_EXPLAINER_DAY_COUNT = 3

// ── Per-area color + icon (inline styles avoid Tailwind's dynamic-class safelist,
//    same approach LandingPage uses for cognitive areas) ─────────────────────────
const AREA_META: Record<ChallengeArea, { label: string; color: string; icon: LucideIcon }> = {
  memoria: { label: 'Memoria', color: '#1B6FC4', icon: Brain },
  atencion: { label: 'Atención', color: '#E8531E', icon: Eye },
  lenguaje: { label: 'Lenguaje', color: '#4CA52E', icon: MessageCircle },
  praxias: { label: 'Dibujo', color: '#7C3AED', icon: Hand },
  calculo: { label: 'Cálculo', color: '#0891B2', icon: Calculator },
  orientacion: { label: 'Orientación', color: '#D97706', icon: Compass },
  ejecutivas: { label: 'Razonamiento', color: '#4F46E5', icon: Lightbulb },
}

type Phase = 'loading' | 'error' | 'ready'

export function DesafioPlayPage() {
  const { token } = useParams<{ token: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [access, setAccess] = useState<ChallengeAccess | null>(null)
  const [progress, setProgress] = useState<ChallengeProgress | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dayResult, setDayResult] = useState<{ day: number; stars: 1 | 2 | 3; message: string | null } | null>(null)
  // Newly-earned badges, shown one at a time (rare, but more than one can
  // unlock off a single completion — e.g. first day played landing on 3
  // stars earns FIRST_DAY and PERFECT_DAY together).
  const [badgeQueue, setBadgeQueue] = useState<BadgeId[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api.get<ChallengeAccess>(`/challenge/${token}`)
        if (!cancelled) {
          setAccess(data)
          setPhase('ready')
        }
      } catch {
        if (!cancelled) setPhase('error')
      }
      // Progress is a pure enhancement (streak/badges/area stars) — its own
      // request fails independently of the access check above, and a
      // failure here must never block the day-grid from rendering.
      try {
        const data = await api.get<ChallengeProgress>(`/challenge/${token}/progress`)
        if (!cancelled) setProgress(data)
      } catch {
        // Silently leave `progress` null — ChallengeProgressPanel renders
        // nothing in that case, same graceful-degradation as a slow/failed
        // game-result save.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  // Close the day card on Escape (matches the modal pattern used elsewhere)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDayModal()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // An accidental drag/tap near the backdrop must not scroll the page behind
  // the card — otherwise the layout shifts and the next tap lands nowhere.
  useBodyScrollLock(selectedDay !== null)

  // The reward screen (stars) shows IMMEDIATELY on completion, computed
  // client-side — it must NEVER depend on the save POST succeeding. computeStars
  // mirrors the backend's exact formula, so the count shown here is the same one
  // that gets persisted; a failed/slow save (rejected token, offline, day not
  // yet unlocked on the real backend) must never swallow the player's reward.
  //
  // The tip line under the stars is not always the same — only while the buyer
  // is still new to the star system (their first few days played ever), or when
  // a replay genuinely improves a day's already-recorded stars, does it say
  // anything beyond the star count itself. `previousResult`/`daysPlayedSoFar`
  // are read from `progress` (state as of the last completed day, not this one).
  function handleGameComplete(day: number, result: GameResult) {
    const previousResult = progress?.days.find((d) => d.day === day)
    const daysPlayedSoFar = progress?.days.length ?? 0
    const previouslyEarned = new Set(progress?.badges.filter((b) => b.earned).map((b) => b.code) ?? [])

    const stars = computeStars(result.mistakes, result.totalAttempts)
    const isEarlyDay = daysPlayedSoFar < STAR_EXPLAINER_DAY_COUNT
    const improved = previousResult != null && stars > previousResult.stars
    const message = improved
      ? '¡Mejoraste tu resultado de este día!'
      : isEarlyDay
        ? 'Las estrellas miden qué tan preciso fuiste, no la velocidad.'
        : null
    setDayResult({ day, stars, message })

    // Persist in the background. On success, re-fetch progress so the day-grid's
    // stars and the panel reflect this result, and queue any newly-earned badge
    // (shown after the star screen is dismissed). A failed save just logs — the
    // reward screen already showed.
    api
      .post<CompleteDayResponse>(`/challenge/${token}/days/${day}/complete`, result)
      .then(() => api.get<ChallengeProgress>(`/challenge/${token}/progress`))
      .then((freshProgress) => {
        setProgress(freshProgress)
        const newlyEarned = freshProgress.badges.filter((b) => b.earned && !previouslyEarned.has(b.code))
        if (newlyEarned.length > 0) setBadgeQueue(newlyEarned.map((b) => b.code))
      })
      .catch((error) => {
        console.error('No se pudo guardar el resultado del día', error)
      })
  }

  function closeDayModal() {
    setSelectedDay(null)
    setDayResult(null)
    setBadgeQueue([])
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh grid place-items-center bg-gradient-to-b from-tiam-blue/5 to-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tiam-blue/20 border-t-tiam-blue" />
      </div>
    )
  }

  if (phase === 'error' || !access) {
    return (
      <div className="min-h-dvh grid place-items-center bg-gradient-to-b from-tiam-blue/5 to-white px-6">
        <div className="text-center max-w-sm">
          <img src={logoImg} alt="TIAM" className="mx-auto mb-6 h-12 w-auto" />
          <h1 className="text-2xl font-bold text-slate-800">No encontramos tu desafío</h1>
          <p className="mt-3 text-slate-500 leading-relaxed">
            El enlace puede estar vencido o ser incorrecto. Si ya compraste el Desafío,
            escribinos por WhatsApp y te ayudamos.
          </p>
        </div>
      </div>
    )
  }

  const selected = selectedDay
    ? CHALLENGE_DAYS.find((d) => d.day === selectedDay) ?? null
    : null
  const Game = selected?.type === 'game' ? GAMES[selected.day] : undefined

  return (
    <div className="min-h-dvh bg-gradient-to-b from-tiam-blue/5 to-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        {/* Header */}
        <header className="text-center">
          <img src={logoImg} alt="TIAM" className="mx-auto h-11 w-auto" />
          <h1 className="mt-6 text-3xl font-bold text-slate-800 sm:text-4xl">
            ¡Hola, <span className="text-tiam-blue">{access.buyerFirstName}</span>!
          </h1>
          <p className="mt-3 text-lg text-slate-500 leading-relaxed">
            Este es tu Desafío de 30 días. Tocá el día de hoy para ver tu ejercicio.
          </p>
          <p className="mt-4 inline-block rounded-full bg-tiam-blue/10 px-4 py-1.5 text-sm font-semibold text-tiam-blue">
            Vas por el día {access.currentDay} de {CHALLENGE_TOTAL_DAYS}
          </p>
        </header>

        <ChallengeProgressPanel progress={progress} />

        {/* 30-day grid */}
        <div className="mt-10 grid grid-cols-4 gap-3 sm:grid-cols-5 sm:gap-4">
          {CHALLENGE_DAYS.map((d) => {
            const meta = AREA_META[d.area]
            const locked = d.day > access.currentDay
            const isToday = d.day === access.currentDay
            // Real result, not a calendar guess: a day only shows stars once
            // it actually has a recorded playthrough. An unlocked-but-unplayed
            // 'game' day (or a 'card' day, which never has a result at all)
            // correctly shows nothing here instead of a checkmark that used
            // to just mean "the calendar moved on," not "you played this."
            const stars = progress?.days.find((r) => r.day === d.day)?.stars ?? 0

            return (
              <button
                key={d.day}
                type="button"
                disabled={locked}
                onClick={() => setSelectedDay(d.day)}
                aria-label={
                  locked
                    ? `Día ${d.day}, bloqueado`
                    : `Día ${d.day}${isToday ? ', hoy' : ''}: ${d.title}`
                }
                className={[
                  'relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition',
                  'min-h-[64px] focus:outline-none focus:ring-2 focus:ring-offset-2',
                  locked
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100'
                    : 'cursor-pointer bg-white hover:-translate-y-0.5 hover:shadow-md',
                ].join(' ')}
                style={
                  locked
                    ? undefined
                    : { borderColor: meta.color, ...(isToday ? { boxShadow: `0 0 0 3px ${meta.color}22` } : {}) }
                }
              >
                {isToday && (
                  <span
                    className="absolute -top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
                    style={{ backgroundColor: '#E8531E' }}
                  >
                    Hoy
                  </span>
                )}
                {locked ? (
                  <Lock className="h-5 w-5 text-slate-400" />
                ) : (
                  <span className="text-2xl font-extrabold" style={{ color: meta.color }}>
                    {d.day}
                  </span>
                )}
                {stars > 0 && (
                  <span className="absolute bottom-1 right-1 flex gap-px">
                    {Array.from({ length: stars }, (_, i) => (
                      <Star key={i} className="h-2.5 w-2.5 fill-tiam-orange text-tiam-orange" />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          Cada día se desbloquea uno nuevo. ¡Volvé mañana por el siguiente! 🌱
        </p>
      </div>

      {/* Day card modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
          onClick={closeDayModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-card-title"
        >
          <div
            className={[
              'relative w-full overflow-hidden rounded-3xl bg-white shadow-xl',
              Game ? 'max-w-2xl' : 'max-w-md',
            ].join(' ')}
            onClick={(e) => e.stopPropagation()}
          >
            {Game ? (
              <>
                {/* Interactive game — header + the game itself */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 sm:px-7">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: AREA_META[selected.area].color }}>
                      Día {selected.day} · {AREA_META[selected.area].label}
                    </p>
                    <h2 id="day-card-title" className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">
                      {selected.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeDayModal}
                    aria-label="Cerrar"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="max-h-[78vh] overflow-y-auto">
                  <Game
                    day={selected.day}
                    onComplete={(result) => handleGameComplete(selected.day, result)}
                  />
                </div>
                {dayResult && dayResult.day === selected.day && (
                  <DayResultOverlay
                    stars={dayResult.stars}
                    message={dayResult.message}
                    onDismiss={() => setDayResult(null)}
                  />
                )}
                {!dayResult && badgeQueue.length > 0 && (
                  <BadgeUnlockOverlay
                    code={badgeQueue[0]}
                    onDismiss={() => setBadgeQueue((q) => q.slice(1))}
                  />
                )}
              </>
            ) : (
              <>
                {/* Illustration — the Flux image if present, else a colored icon placeholder */}
                {selected.illustration ? (
                  <img
                    src={selected.illustration}
                    alt={selected.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-44 items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${AREA_META[selected.area].color}, ${AREA_META[selected.area].color}bb)` }}
                  >
                    {(() => {
                      const Icon = AREA_META[selected.area].icon
                      return <Icon className="h-16 w-16 text-white/90" strokeWidth={1.5} />
                    })()}
                  </div>
                )}

                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: AREA_META[selected.area].color }}>
                        Día {selected.day} · {AREA_META[selected.area].label}
                      </p>
                      <h2 id="day-card-title" className="mt-1 text-2xl font-bold text-slate-900">
                        {selected.title}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeDayModal}
                      aria-label="Cerrar"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <p className="mt-4 text-lg leading-relaxed text-slate-700">
                    {selected.instructions}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
