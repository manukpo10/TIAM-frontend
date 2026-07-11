import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const HEADLINE: Record<1 | 2 | 3, string> = {
  1: '¡Completaste el día!',
  2: '¡Muy bien!',
  3: '¡Excelente trabajo!',
}

interface DayResultOverlayProps {
  stars: 1 | 2 | 3
  /** Optional tip shown under the headline — the onboarding explainer or an
   * "you beat your last score" note. Null on a routine replay with nothing
   * new to say. */
  message: string | null
  onDismiss: () => void
}

/** Full-card "level complete" reveal shown right after a day finishes, on
 * top of the game underneath (see DesafioPlayPage). Earned stars pop in one
 * at a time; unearned ones sit there dim from the start — nothing to reveal
 * about those. */
export function DayResultOverlay({ stars, message, onDismiss }: DayResultOverlayProps) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setRevealed(0)
    const timers = [1, 2, 3].map((n) => window.setTimeout(() => setRevealed(n), n * 180))
    return () => timers.forEach(window.clearTimeout)
  }, [stars])

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-white px-6 py-10 text-center">
      <div className="flex gap-2">
        {([1, 2, 3] as const).map((n) => {
          const earned = n <= stars
          const shown = !earned || n <= revealed
          return (
            <Star
              key={n}
              className={`h-14 w-14 transition-all duration-300 ease-out sm:h-16 sm:w-16 ${
                earned ? 'fill-tiam-orange text-tiam-orange' : 'text-slate-200'
              } ${shown ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
            />
          )
        })}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-900">{HEADLINE[stars]}</h3>
        {message && <p className="mt-2 max-w-xs text-sm text-slate-500">{message}</p>}
      </div>
      <Button size="lg" onClick={onDismiss} className="min-w-[160px]">
        Continuar
      </Button>
    </div>
  )
}
