import type { ElementType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { cn } from '@/lib/utils'
import { supportLink } from '@/lib/whatsapp'
import logoImg from '@/assets/logogrande-sinfondo.png'

/**
 * Frame for the Pack's post-purchase pages (thank-you, downloads, resend access) and the regret form.
 *
 * Pages that carry or follow an order token must not leak it: `no-referrer` stops the browser from sending the
 * page address (which contains the token on /pack/descargas/:token) to anything it loads or links to, and
 * `noindex` keeps them out of search results. The same policy is also set as HTTP headers in vercel.json (the
 * only way to cover the stylesheet and fonts requested before React runs); the tags here are the second layer.
 * React 19 hoists <title> and <meta> into <head>.
 */

interface PackShellProps {
  title: string
  children: ReactNode
  /** The regret page is public information: let search engines have it. */
  indexable?: boolean
}

export function PackShell({ title, children, indexable = false }: PackShellProps) {
  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <title>{`${title} · TIAM Digital`}</title>
      <meta name="referrer" content="no-referrer" />
      {!indexable && <meta name="robots" content="noindex, nofollow" />}

      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2" aria-label="TIAM Digital: ir al inicio">
            <img src={logoImg} alt="TIAM Digital" width={72} height={40} className="h-10 w-auto object-contain" />
          </Link>
          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm font-medium text-tiam-blue underline decoration-tiam-blue/40 underline-offset-4 hover:decoration-tiam-blue"
          >
            ¿Necesitás ayuda?
          </a>
        </div>
      </header>

      <main className="flex-1 bg-gradient-to-b from-tiam-blue/5 to-white">
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      </main>

      <PublicFooter />
    </div>
  )
}

// ─── Small building blocks shared by the Pack pages ──────────────────────────

const TONES = {
  green: 'bg-tiam-green/10 text-tiam-green',
  orange: 'bg-tiam-orange/10 text-tiam-orange',
  blue: 'bg-tiam-blue/10 text-tiam-blue',
  red: 'bg-red-50 text-red-600',
} as const

interface StateHeroProps {
  tone: keyof typeof TONES
  icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  /** Spin the icon (loading states). */
  spin?: boolean
  children?: ReactNode
}

/** Round icon + headline + lead paragraph, the opening of every state page. */
export function StateHero({ tone, icon: Icon, title, spin = false, children }: StateHeroProps) {
  return (
    <div className="text-center">
      <div className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-full', TONES[tone])}>
        <Icon className={cn("h-9 w-9", spin && "animate-spin motion-reduce:animate-none")} aria-hidden />
      </div>
      <h1 className="mt-6 text-balance text-3xl font-bold text-slate-900">{title}</h1>
      {children && <div className="mt-3 text-lg leading-relaxed text-slate-600">{children}</div>}
    </div>
  )
}

/** White rounded card used for every block of content. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7', className)}>{children}</section>
}
