import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, BookOpen, Brain, CheckCircle2, ClipboardList, Compass, Gift,
  Hand, MessageCircle, Printer, Search, Target, TrendingUp, Zap, type LucideIcon,
} from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  iconClass: string
}

// What the full sales page (PlataformaPage) promises, in the order a
// professional meets it: find material, print it, plan and track sessions,
// extend practice to the patient's home.
const UPCOMING_FEATURES: Feature[] = [
  {
    icon: BookOpen,
    title: 'Biblioteca por área cognitiva',
    description: 'Ejercicios de memoria, atención, lenguaje y más, organizados por área y nivel de dificultad.',
    iconClass: 'bg-tiam-blue/10 text-tiam-blue',
  },
  {
    icon: Printer,
    title: 'Fichas A4 listas para imprimir',
    description: 'Material con formato profesional, directo a la impresora, sin diseñar ni editar nada.',
    iconClass: 'bg-tiam-orange/10 text-accent-hover',
  },
  {
    icon: ClipboardList,
    title: 'Sesiones y seguimiento',
    description: 'Armá cada sesión en minutos y registrá cómo evoluciona cada paciente.',
    iconClass: 'bg-tiam-navy/10 text-tiam-navy',
  },
  {
    icon: MessageCircle,
    title: 'Práctica en casa',
    description: 'Mandale ejercicios por WhatsApp a tu paciente para que siga entrenando entre sesión y sesión.',
    iconClass: 'bg-tiam-green/10 text-tiam-green',
  },
]

// A sample of the platform's cognitive areas for the decorative preview —
// not the full list, which lives in COGNITIVE_AREAS.
const PREVIEW_AREAS: { name: string; icon: LucideIcon; tileClass: string; iconClass: string }[] = [
  { name: 'Memoria', icon: Brain, tileClass: 'bg-tiam-blue/10', iconClass: 'text-tiam-blue' },
  { name: 'Atención', icon: Target, tileClass: 'bg-tiam-orange/10', iconClass: 'text-accent-hover' },
  { name: 'Lenguaje', icon: MessageCircle, tileClass: 'bg-tiam-green/10', iconClass: 'text-tiam-green' },
  { name: 'Orientación', icon: Compass, tileClass: 'bg-violet-100', iconClass: 'text-violet-700' },
  { name: 'Praxias', icon: Hand, tileClass: 'bg-slate-100', iconClass: 'text-tiam-navy' },
  { name: 'Funciones ejecutivas', icon: Zap, tileClass: 'bg-amber-100', iconClass: 'text-amber-700' },
]

/** Decorative peek at the platform's exercise library, so the page shows what
 * is coming instead of only describing it. aria-hidden: the feature list
 * below carries the same information as text. */
function LibraryPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[22rem] select-none">
      <div className="rotate-2 rounded-2xl bg-white p-4 shadow-2xl shadow-black/30 ring-1 ring-black/5">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="ml-2 text-xs font-semibold text-slate-600">Biblioteca de ejercicios</span>
          <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-3 w-3 text-slate-500" />
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {PREVIEW_AREAS.map(({ name, icon: Icon, tileClass, iconClass }) => (
            <li key={name} className={`flex h-12 items-center gap-2 rounded-xl px-2.5 ${tileClass}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white">
                <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
              </span>
              <span className="text-xs font-semibold leading-tight text-slate-700">{name}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2 rounded-xl border border-slate-100 p-3">
          <div className="h-2 w-3/4 rounded-full bg-slate-100" />
          <div className="h-2 w-1/2 rounded-full bg-slate-100" />
        </div>
      </div>
      <div className="absolute -right-4 -top-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg">
        <TrendingUp className="h-4 w-4 text-tiam-green" />
        <span className="text-xs font-semibold text-slate-700">Evolución del paciente</span>
      </div>
      <div className="absolute -bottom-5 -left-6 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg">
        <Printer className="h-4 w-4 text-accent-hover" />
        <span className="text-xs font-semibold text-slate-700">Ficha lista para imprimir</span>
      </div>
    </div>
  )
}

/** /plataforma while the professionals platform isn't launched (see
 * PLATFORM_LAUNCHED): one "Próximamente" card that says what's coming,
 * collects emails to announce the launch, and points to the free fichas in
 * the meantime. */
export function PlataformaComingSoonPage() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  // `field` marks which control the message belongs to (aria-invalid goes on
  // that one only); null for a failed request, which no field can fix.
  const [error, setError] = useState<{ field: 'email' | 'consent' | null; message: string } | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const consentRef = useRef<HTMLInputElement>(null)
  const successRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Próximamente: plataforma para profesionales — TIAM Digital'
  }, [])

  // The form (and the focused submit button) unmounts on success — move focus
  // to the confirmation so keyboard and screen reader users land on it.
  useEffect(() => {
    if (status === 'success') successRef.current?.focus()
  }, [status])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!EMAIL_RE.test(email.trim())) {
      setError({ field: 'email', message: 'Ingresá un email válido.' })
      emailRef.current?.focus()
      return
    }
    if (!consent) {
      setError({ field: 'consent', message: 'Necesitamos tu consentimiento para avisarte.' })
      consentRef.current?.focus()
      return
    }
    setStatus('submitting')
    try {
      // Same leads table as the free fichas on RecursosPage; `source` keeps
      // the two lists apart for the launch announcement.
      await api.post('/leads', { email: email.trim(), name: null, source: 'plataforma', consent })
      setStatus('success')
    } catch {
      // Own message instead of err.message: a network failure surfaces as
      // the browser's English "Failed to fetch".
      setStatus('idle')
      setError({ field: null, message: 'No pudimos guardar tu email. Probá de nuevo en unos minutos.' })
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-tiam-blue focus:shadow-md focus:ring-2 focus:ring-tiam-blue"
      >
        Ir al contenido principal
      </a>

      <PublicHeader />

      <main id="main-content" className="flex-1">
        <section
          aria-labelledby="coming-soon-heading"
          className="relative overflow-clip bg-gradient-to-br from-tiam-blue/[0.07] via-slate-50 to-white px-4 py-10 sm:px-6 sm:py-14 lg:py-20"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-tiam-blue/15 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-tiam-orange/10 blur-3xl" />

          <div className="relative mx-auto max-w-6xl overflow-clip rounded-3xl bg-white shadow-xl shadow-tiam-navy/10 ring-1 ring-slate-100 sm:rounded-[2rem]">
            {/* Announcement band. Dark blue → navy rather than tiam-blue: body
                text at white/80 only clears WCAG AA on the darker end (7.1:1
                on tiam-blue-dark, 3.9:1 on tiam-blue). */}
            <div className="relative overflow-clip bg-gradient-to-br from-tiam-blue-dark to-tiam-navy px-6 py-10 sm:px-10 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-14 lg:px-14 lg:py-16">
              <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-tiam-blue/50 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-tiam-orange/20 blur-3xl" />

              <div className="relative">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/20">
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-75 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-300" />
                  </span>
                  Próximamente
                </p>
                <h1
                  id="coming-soon-heading"
                  className="mt-5 text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl xl:text-5xl"
                >
                  La plataforma de TIAM para profesionales{' '}
                  <span className="text-orange-300">está en camino.</span>
                </h1>
                <p className="mt-4 max-w-xl text-pretty text-lg text-white/80">
                  Estamos preparando una herramienta para quienes trabajan con adultos mayores: todo el
                  material de estimulación cognitiva, organizado y listo para usar en cada sesión.
                </p>

                <div className="mt-8 max-w-xl">
                  {status === 'success' ? (
                    <div
                      ref={successRef}
                      tabIndex={-1}
                      role="status"
                      className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 focus:outline-hidden"
                    >
                      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-300" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-white">¡Listo! Te vamos a avisar.</p>
                        <p className="mt-1 text-sm text-white/80">
                          Cuando la plataforma esté disponible, te escribimos a {email.trim()}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} noValidate>
                      <label htmlFor="notify-email" className="block font-semibold text-white">
                        Dejanos tu email y te avisamos apenas esté lista
                      </label>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input
                          ref={emailRef}
                          id="notify-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            setError(null)
                          }}
                          placeholder="vos@ejemplo.com"
                          aria-required="true"
                          aria-invalid={error?.field === 'email' ? true : undefined}
                          aria-describedby={error?.field === 'email' ? 'notify-error' : undefined}
                          className="min-h-[48px] w-full min-w-0 flex-1 rounded-xl bg-white px-4 text-base text-slate-900 placeholder:text-slate-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-300"
                        />
                        <Button
                          type="submit"
                          size="lg"
                          loading={status === 'submitting'}
                          className="min-h-[48px] shrink-0 rounded-xl bg-accent-hover font-semibold hover:bg-orange-800 active:bg-orange-900 focus:outline-hidden focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-tiam-navy"
                        >
                          Avisame
                        </Button>
                      </div>
                      <label className="mt-4 flex min-h-[44px] items-start gap-3 text-sm text-white/80">
                        <input
                          ref={consentRef}
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => {
                            setConsent(e.target.checked)
                            setError(null)
                          }}
                          aria-required="true"
                          aria-invalid={error?.field === 'consent' ? true : undefined}
                          aria-describedby={error?.field === 'consent' ? 'notify-error' : undefined}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-tiam-orange"
                        />
                        <span>
                          Acepto que TIAM use mi email para avisarme cuando la plataforma esté disponible
                          y enviarme novedades, según la{' '}
                          <Link
                            to="/privacy"
                            className="font-semibold text-white underline underline-offset-2 hover:text-orange-200"
                          >
                            política de privacidad
                          </Link>
                          .
                        </span>
                      </label>
                      {error && (
                        <p id="notify-error" role="alert" className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-200">
                          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {error.message}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </div>

              <div className="relative hidden lg:block">
                <LibraryPreview />
              </div>
            </div>

            {/* What's coming */}
            <div className="px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Lo que vas a encontrar</h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                Pensada para que dediqués tu tiempo a tus pacientes, no a buscar material.
              </p>
              {/* role="list": Safari/VoiceOver drops list semantics once preflight
                  removes the markers. */}
              <ul role="list" className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {UPCOMING_FEATURES.map(({ icon: Icon, title, description, iconClass }) => (
                  <li key={title}>
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-4 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-tiam-blue shadow-sm">
                    <Gift className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">¿Querés empezar ya?</p>
                    <p className="text-sm text-slate-600">
                      Descargá 5 fichas de estimulación cognitiva gratis para tus sesiones.
                    </p>
                  </div>
                </div>
                <Link
                  to="/recursos"
                  className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-semibold text-tiam-blue transition-colors hover:bg-slate-100 hover:text-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Ver fichas gratis
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
