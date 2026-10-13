import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// Número real de inscripciones del taller (del flyer impreso), NO el de
// WhatsApp Business que usa el bot del Desafío — este lo atiende una persona.
const TALLER_WHATSAPP = '5492215226725'

/** Lucide has no brand glyphs — WhatsApp's own mark, inlined (no new
 * dependency for one icon). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C22 6.45 17.56 2.01 12.04 2zm5.87 14.05c-.25.7-1.45 1.34-2 1.42-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.69-.62-2.97-1.28-4.91-4.28-5.06-4.48-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37.2 0 .4 0 .58.01.18.01.44-.07.68.53.25.6.85 2.07.92 2.22.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.45.53-.15.15-.3.31-.13.6.17.3.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.35 1.44.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.68-.15.28.1 1.77.84 2.08.99.31.15.51.23.59.36.08.13.08.75-.17 1.45z" />
    </svg>
  )
}

interface WhatsAppCtaProps {
  label: string
  /** The message the chat opens with, so the person on the other end knows what the inquiry is about. */
  text: string
  /** Stretch to the width of its container (cards); the default hugs the label. */
  fullWidth?: boolean
}

export function WhatsAppCta({ label, text, fullWidth = false }: WhatsAppCtaProps) {
  return (
    <a
      href={`https://wa.me/${TALLER_WHATSAPP}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={fullWidth ? 'block' : undefined}
    >
      <Button
        size="lg"
        className={cn('min-h-[44px] px-5 sm:px-8 bg-[#25D366] text-white hover:bg-[#1ebe5b]', fullWidth && 'w-full')}
      >
        <WhatsAppIcon className="h-4 w-4 shrink-0" />
        {label}
      </Button>
    </a>
  )
}
