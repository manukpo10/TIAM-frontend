import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Brain, Eye, MessageCircle, Hand, Calculator, Compass, Lightbulb,
  Lock, Check, X, type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  CHALLENGE_DAYS,
  CHALLENGE_TOTAL_DAYS,
  type ChallengeAccess,
  type ChallengeArea,
} from '@/lib/challengeContent'
import type { CompleteDayResponse, GameResult } from '@/lib/challengeProgress'
import logoImg from '@/assets/logo-sinfondo.png'
import { GAMES } from './games/registry'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

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
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

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
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  // Close the day card on Escape (matches the modal pattern used elsewhere)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedDay(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // An accidental drag/tap near the backdrop must not scroll the page behind
  // the card — otherwise the layout shifts and the next tap lands nowhere.
  useBodyScrollLock(selectedDay !== null)

  // Fire-and-forget: no UI consumes the response yet (that's the progress panel,
  // a later phase), so a failed save just logs — it must never block or interrupt
  // the completion screen the game itself already shows.
  function handleGameComplete(day: number, result: GameResult) {
    api.post<CompleteDayResponse>(`/challenge/${token}/days/${day}/complete`, result).catch((error) => {
      console.error('No se pudo guardar el resultado del día', error)
    })
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

        {/* 30-day grid */}
        <div className="mt-10 grid grid-cols-4 gap-3 sm:grid-cols-5 sm:gap-4">
          {CHALLENGE_DAYS.map((d) => {
            const meta = AREA_META[d.area]
            const locked = d.day > access.currentDay
            const isToday = d.day === access.currentDay
            const done = d.day < access.currentDay

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
                {done && (
                  <span className="absolute bottom-1 right-1">
                    <Check className="h-3.5 w-3.5 text-tiam-green" strokeWidth={3} />
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
          onClick={() => setSelectedDay(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-card-title"
        >
          <div
            className={[
              'w-full overflow-hidden rounded-3xl bg-white shadow-xl',
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
                    onClick={() => setSelectedDay(null)}
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
                      onClick={() => setSelectedDay(null)}
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
