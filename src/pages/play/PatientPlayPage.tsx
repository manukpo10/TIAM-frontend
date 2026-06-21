import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Sun, Home, PawPrint, Flower2, Car, Star, Clock, Coffee, Heart, TreePine,
  CheckCircle2, RotateCcw, Check, type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { PatientPlaySession, MemoryCard } from '@/types'
import logoImg from '@/assets/logo-sinfondo.png'
import { useToast } from '@/components/ui/Toast'

// ── Icon map (hoisted outside component — static data) ─────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Sun,
  Home,
  PawPrint,
  Flower2,
  Car,
  Star,
  Clock,
  Coffee,
  Heart,
  TreePine,
}

// ── Fisher-Yates shuffle (safe at runtime inside useState initializer) ──────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Subscription gate — shown to the family member when no active sub exists ─

// Static benefit list — hoisted to avoid re-creating on every render
const SUBSCRIPTION_BENEFITS = [
  'Un ejercicio nuevo por día',
  'Pensado para adultos mayores: simple y sin complicaciones',
  'Acompaña el trabajo del profesional',
  'Cancelás cuando quieras',
] as const

interface SubscriptionGateProps {
  patientFirstName: string
  token: string
  onSubscribed: () => void
}

function SubscriptionGate({ patientFirstName, token, onSubscribed }: SubscriptionGateProps) {
  const { toast } = useToast()
  const [isPending, setIsPending] = useState(false)

  const handleSubscribe = useCallback(async () => {
    setIsPending(true)
    try {
      await api.post(`/play/${token}/subscribe`, {})
      toast.success('¡Suscripción activada!')
      onSubscribed()
    } catch {
      toast.error('No pudimos activar la suscripción. Intentá de nuevo.')
    } finally {
      setIsPending(false)
    }
  }, [token, toast, onSubscribed])

  return (
    <div className="min-h-dvh bg-gradient-to-b from-tiam-blue/5 to-white flex flex-col">
      <div className="flex flex-col items-center gap-8 px-5 py-12 max-w-md mx-auto w-full">
        {/* Logo */}
        <img src={logoImg} alt="TIAM" className="h-12 w-auto" />

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-800 leading-tight">
            Ejercicios diarios para{' '}
            <span className="text-tiam-blue">{patientFirstName}</span>
          </h1>
          <p className="text-base text-gray-500 leading-relaxed">
            TIAM le envía a {patientFirstName} un ejercicio de estimulación cognitiva
            por día para hacer desde casa, pensado para adultos mayores.
            Acompañá su tratamiento entre sesiones.
          </p>
        </div>

        {/* Price card */}
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 px-6 py-7 w-full space-y-5">
          {/* Price */}
          <div className="text-center">
            <span className="text-4xl font-bold text-tiam-blue">$12.000</span>
            <span className="text-lg text-gray-400 ml-1">/ mes</span>
          </div>

          {/* Divider */}
          <hr className="border-gray-100" />

          {/* Benefits */}
          <ul className="space-y-3" aria-label="Beneficios incluidos">
            {SUBSCRIPTION_BENEFITS.map(benefit => (
              <li key={benefit} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-tiam-green/15 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Check size={12} className="text-tiam-green" strokeWidth={3} />
                </span>
                <span className="text-base text-gray-700 leading-snug">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Reassurance for the family member */}
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          Tu familiar solo abre el enlace y juega.{' '}
          <strong className="text-gray-500 font-medium">Vos gestionás la suscripción.</strong>
        </p>

        {/* CTA */}
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={isPending}
          className={[
            'w-full rounded-3xl px-8 py-4 min-h-[56px]',
            'text-lg font-bold text-white',
            'bg-tiam-blue shadow-lg shadow-tiam-blue/20',
            'hover:bg-tiam-blue-dark active:scale-95',
            'transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tiam-blue focus-visible:ring-offset-2',
            'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
          ].join(' ')}
          aria-busy={isPending}
        >
          {isPending ? 'Activando...' : 'Suscribirse'}
        </button>

        {/* MP note */}
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          El pago se procesa de forma segura con Mercado Pago. Próximamente.
        </p>
      </div>
    </div>
  )
}

// ── Page phases ─────────────────────────────────────────────────────────────
type Phase = 'loading' | 'error' | 'gate' | 'welcome' | 'playing' | 'success'

// ── Card state ──────────────────────────────────────────────────────────────
interface CardState {
  card: MemoryCard
  isFlipped: boolean
  isMatched: boolean
}

// ── MemoryCard subcomponent (defined at module level — not inside component) ─
interface MemoryCardProps {
  state: CardState
  onTap: () => void
  disabled: boolean
}

function MemoryCardTile({ state, onTap, disabled }: MemoryCardProps) {
  const { card, isFlipped, isMatched } = state
  const Icon = ICON_MAP[card.icon] ?? Star
  const isActive = isFlipped || isMatched

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled || isMatched}
      aria-label={isActive ? card.label : 'Tarjeta'}
      aria-pressed={isActive}
      className={[
        // Base layout
        'relative w-full aspect-square rounded-2xl',
        'flex flex-col items-center justify-center gap-1',
        'transition-all duration-300 select-none',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
        // Touch target minimum (cards are large by design)
        'min-h-[80px]',
        // State styles
        isMatched
          ? 'bg-tiam-green/15 border-2 border-tiam-green shadow-md shadow-tiam-green/20 cursor-default scale-95'
          : isFlipped
            ? 'bg-white border-2 border-tiam-blue shadow-lg scale-105 focus-visible:ring-tiam-blue'
            : 'bg-tiam-blue border-2 border-tiam-blue-dark shadow-md hover:brightness-110 active:scale-95 focus-visible:ring-tiam-blue',
        // Disabled when two are being compared and this one isn't involved
        !isActive && disabled ? 'opacity-70' : '',
        // Reduced motion: skip scale transforms
        'motion-reduce:scale-100 motion-reduce:transition-none',
      ].join(' ')}
    >
      {isActive ? (
        <>
          {isMatched ? (
            <CheckCircle2
              className="text-tiam-green"
              size={32}
              strokeWidth={2}
              aria-hidden="true"
            />
          ) : (
            <Icon
              className="text-tiam-blue"
              size={36}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          )}
          <span
            className={[
              'text-xs font-semibold leading-tight text-center px-1',
              isMatched ? 'text-tiam-green' : 'text-tiam-blue',
            ].join(' ')}
          >
            {card.label}
          </span>
        </>
      ) : (
        <span
          className="text-2xl font-bold text-white/60 select-none"
          aria-hidden="true"
        >
          ?
        </span>
      )}
    </button>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export function PatientPlayPage() {
  const { token } = useParams<{ token: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<PatientPlaySession | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Game state
  const [cards, setCards] = useState<CardState[]>([])
  const [flippedIds, setFlippedIds] = useState<string[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [moves, setMoves] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const TOTAL_PAIRS = 6

  // ── Load (or re-load) session — called on mount and after subscribe ────────
  const fetchSession = useCallback(() => {
    if (!token) return
    setPhase('loading')
    api.get<PatientPlaySession>(`/play/${token}`)
      .then(data => {
        setSession(data)
        // If the subscription just became active, land on welcome; otherwise show gate
        setPhase(data.subscriptionActive ? 'welcome' : 'gate')
      })
      .catch(() => {
        setErrorMsg('No pudimos cargar tu ejercicio. Pedile a tu profesional que te envíe el link de nuevo.')
        setPhase('error')
      })
  }, [token])

  // ── Load session on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // ── Initialize cards when transitioning to playing ────────────────────────
  const initGame = useCallback(() => {
    if (!session) return
    const shuffled = shuffle(session.exercise.cards)
    setCards(shuffled.map(c => ({ card: c, isFlipped: false, isMatched: false })))
    setFlippedIds([])
    setMatchedPairs(0)
    setMoves(0)
    setIsLocked(false)
    setElapsedSeconds(0)
    startTimeRef.current = Date.now()
    setPhase('playing')
  }, [session])

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // ── Card tap handler — PURE: only flips the card and appends the id ────────
  const handleCardTap = useCallback((id: string) => {
    if (isLocked) return

    setCards(prev => {
      const idx = prev.findIndex(c => c.card.id === id)
      if (idx === -1 || prev[idx].isFlipped || prev[idx].isMatched) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], isFlipped: true }
      return next
    })

    setFlippedIds(prev => {
      // Ignore the tap if the card is already tracked (e.g. fast double-tap)
      if (prev.includes(id)) return prev
      // Never accumulate more than 2 (guard against rapid taps while locking)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }, [isLocked])

  // ── Match comparison effect — runs whenever flippedIds changes ───────────
  useEffect(() => {
    if (flippedIds.length !== 2) return

    const [idA, idB] = flippedIds

    // Resolve pairKeys from the current cards snapshot (synchronous — safe here)
    const cardA = cards.find(c => c.card.id === idA)
    const cardB = cards.find(c => c.card.id === idB)
    if (!cardA || !cardB) return

    const isMatch = cardA.card.pairKey === cardB.card.pairKey

    setIsLocked(true)
    setMoves(m => m + 1)

    const timer = setTimeout(() => {
      // Update card visual state (pure updater — no side effects inside)
      setCards(current =>
        current.map(c => {
          if (c.card.id === idA || c.card.id === idB) {
            return isMatch
              ? { ...c, isFlipped: true, isMatched: true }
              : { ...c, isFlipped: false }
          }
          return c
        })
      )

      if (isMatch) {
        setMatchedPairs(mp => {
          const newMp = mp + 1
          if (newMp === TOTAL_PAIRS) {
            const duration = startTimeRef.current
              ? Math.floor((Date.now() - startTimeRef.current) / 1000)
              : 0
            setMoves(finalMoves => {
              api.post(`/play/${token}/complete`, { moves: finalMoves, durationSeconds: duration })
                .catch(() => { /* ignore */ })
              return finalMoves
            })
            setTimeout(() => setPhase('success'), 400)
          }
          return newMp
        })
      }

      setFlippedIds([])
      setIsLocked(false)
    }, 900)

    return () => clearTimeout(timer)
  }, [flippedIds, cards, token])

  // ── Format elapsed time ───────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Loading
  if (phase === 'loading') {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-tiam-blue/5 to-white flex flex-col items-center justify-center gap-6 px-6">
        <img src={logoImg} alt="TIAM" className="h-14 w-auto opacity-80" />
        <div
          className="w-14 h-14 rounded-full border-4 border-tiam-blue/20 border-t-tiam-blue animate-spin"
          role="status"
          aria-label="Cargando"
        />
        <p className="text-xl text-gray-500 text-center">Cargando tu ejercicio...</p>
      </div>
    )
  }

  // Error
  if (phase === 'error') {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-tiam-blue/5 to-white flex flex-col items-center justify-center gap-6 px-6 text-center">
        <img src={logoImg} alt="TIAM" className="h-14 w-auto opacity-80" />
        <p className="text-3xl font-bold text-gray-700">Algo salió mal</p>
        <p className="text-xl text-gray-500 max-w-sm">{errorMsg}</p>
      </div>
    )
  }

  const firstName = session?.patientFirstName ?? ''
  const exercise = session?.exercise

  // Subscription gate (no active home subscription)
  if (phase === 'gate') {
    return (
      <SubscriptionGate
        patientFirstName={firstName}
        token={token!}
        onSubscribed={fetchSession}
      />
    )
  }

  // Welcome
  if (phase === 'welcome') {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-tiam-blue/5 to-white flex flex-col">
        <div className="flex flex-col items-center justify-center flex-1 gap-8 px-6 py-12 text-center">
          <img src={logoImg} alt="TIAM" className="h-14 w-auto" />

          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-tiam-blue leading-tight">
              ¡Hola, {firstName}!
            </h1>
            <p className="text-xl text-gray-500">Tu ejercicio de hoy</p>
            <p className="text-3xl font-bold text-gray-800">{exercise?.title}</p>
          </div>

          <div className="bg-white rounded-3xl shadow-md px-6 py-5 max-w-sm w-full border border-gray-100">
            <p className="text-xl text-gray-600 leading-relaxed">
              {exercise?.instructions}
            </p>
          </div>

          <button
            type="button"
            onClick={initGame}
            className="bg-tiam-blue text-white text-2xl font-bold rounded-3xl px-12 py-5 min-h-[64px] shadow-lg shadow-tiam-blue/20 hover:bg-tiam-blue-dark active:scale-95 transition-all duration-150 w-full max-w-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tiam-blue focus-visible:ring-offset-2"
          >
            Empezar
          </button>

          <p className="text-base text-gray-400">Sin límite de tiempo — jugá tranquila</p>
        </div>
      </div>
    )
  }

  // Playing
  if (phase === 'playing') {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-tiam-blue/5 to-white flex flex-col">
        {/* Top status bar */}
        <header className="w-full px-4 pt-5 pb-3 flex items-center justify-between max-w-lg mx-auto">
          <div className="text-xl font-bold text-tiam-blue">
            Parejas: {matchedPairs} de {TOTAL_PAIRS}
          </div>
          <div className="text-lg text-gray-400 tabular-nums">
            {formatTime(elapsedSeconds)}
          </div>
        </header>

        {/* Instructions */}
        <p className="text-center text-lg text-gray-500 px-6 pb-4 max-w-lg mx-auto">
          {exercise?.instructions}
        </p>

        {/* Card grid
            Mobile  (< 640px): 3 cols × 4 rows
            Tablet+ (≥ 640px): 4 cols × 3 rows */}
        <main className="flex-1 px-4 pb-8 max-w-lg mx-auto w-full">
          <div
            className="grid grid-cols-3 sm:grid-cols-4 gap-3"
            role="group"
            aria-label="Tablero de memoria"
          >
            {cards.map(cs => (
              <MemoryCardTile
                key={cs.card.id}
                state={cs}
                onTap={() => handleCardTap(cs.card.id)}
                disabled={
                  isLocked &&
                  !flippedIds.includes(cs.card.id) &&
                  !cs.isMatched
                }
              />
            ))}
          </div>
        </main>
      </div>
    )
  }

  // Success
  if (phase === 'success') {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-tiam-green/10 to-white flex flex-col">
        <div className="flex flex-col items-center justify-center flex-1 gap-8 px-6 py-12 text-center">
          <img src={logoImg} alt="TIAM" className="h-14 w-auto" />

          {/* Celebration */}
          <div
            className="w-24 h-24 rounded-full bg-tiam-green/15 border-4 border-tiam-green flex items-center justify-center animate-bounce motion-reduce:animate-none"
            aria-hidden="true"
          >
            <CheckCircle2 className="text-tiam-green" size={48} strokeWidth={2} />
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-tiam-green leading-tight">
              ¡Muy bien, {firstName}!
            </h1>
            <p className="text-2xl text-gray-600">Completaste tu ejercicio de hoy.</p>
          </div>

          {/* Summary — light, non-judgmental */}
          <div className="bg-white rounded-3xl shadow-md px-8 py-6 max-w-sm w-full border border-gray-100 space-y-3">
            <div className="flex justify-between text-xl text-gray-600">
              <span>Parejas encontradas</span>
              <span className="font-bold text-tiam-green">{matchedPairs} / {TOTAL_PAIRS}</span>
            </div>
            <div className="flex justify-between text-xl text-gray-600">
              <span>Intentos</span>
              <span className="font-bold text-tiam-blue">{moves}</span>
            </div>
            <div className="flex justify-between text-xl text-gray-600">
              <span>Tiempo</span>
              <span className="font-bold text-gray-500 tabular-nums">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>

          <p className="text-lg text-gray-400 max-w-xs">
            Tu profesional va a poder ver tu progreso.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button
              type="button"
              onClick={initGame}
              className="flex items-center justify-center gap-3 bg-tiam-blue text-white text-xl font-bold rounded-3xl px-10 py-4 min-h-[64px] shadow-lg shadow-tiam-blue/20 hover:bg-tiam-blue-dark active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tiam-blue focus-visible:ring-offset-2"
            >
              <RotateCcw size={22} aria-hidden="true" />
              Jugar de nuevo
            </button>

            <button
              type="button"
              onClick={() => setPhase('welcome')}
              className="text-xl font-semibold text-gray-400 rounded-3xl px-10 py-4 min-h-[64px] border-2 border-gray-200 hover:border-gray-300 hover:text-gray-500 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
