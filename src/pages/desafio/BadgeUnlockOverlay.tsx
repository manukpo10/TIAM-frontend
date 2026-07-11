import { useEffect, useState } from 'react'
import { BADGE_META, badgeIllustration, type BadgeId } from '@/lib/challengeProgress'
import { Button } from '@/components/ui/Button'

interface BadgeUnlockOverlayProps {
  code: BadgeId
  onDismiss: () => void
}

/** Shown once, right after DayResultOverlay is dismissed, the first time a
 * given badge is earned (see the `badgeQueue` diffing in DesafioPlayPage). */
export function BadgeUnlockOverlay({ code, onDismiss }: BadgeUnlockOverlayProps) {
  const [shown, setShown] = useState(false)
  const meta = BADGE_META[code]
  const illustration = badgeIllustration(code)

  useEffect(() => {
    setShown(false)
    const t = window.setTimeout(() => setShown(true), 60)
    return () => window.clearTimeout(t)
  }, [code])

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white px-6 py-10 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-tiam-blue">¡Nueva insignia!</p>
      {illustration && (
        <img
          src={illustration}
          alt={meta.label}
          className={`h-40 w-40 transition-all duration-300 ease-out sm:h-48 sm:w-48 ${
            shown ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        />
      )}
      <div>
        <h3 className="text-2xl font-bold text-slate-900">{meta.label}</h3>
        <p className="mt-2 max-w-xs text-sm text-slate-500">{meta.description}</p>
      </div>
      <Button size="lg" onClick={onDismiss} className="min-w-[160px]">
        Continuar
      </Button>
    </div>
  )
}
