import { cn } from '@/lib/utils'

const LINK_BUTTON = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
  secondary: 'border border-border bg-white text-text hover:bg-surface',
  whatsapp: 'bg-[#1a7f4b] text-white hover:bg-[#146b3e]',
} as const

/** className for an <a> or <Link> that should look like the site's Button (a button inside a link is not valid HTML). */
export function linkButton(variant: keyof typeof LINK_BUTTON = 'primary', extra?: string): string {
  return cn(
    'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    LINK_BUTTON[variant],
    extra,
  )
}
