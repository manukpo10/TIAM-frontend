import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Check, ChevronDown, CreditCard, Heart, Hourglass,
  MessageCircle, Search, Send, ShieldCheck, Smartphone, Sparkles, Star, X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { AreaPlantIcon } from '@/components/plants/AreaPlantIcon'
import { api } from '@/lib/api'
import { areaKeyOf } from '@/lib/areaPlants'
import { CHALLENGE_TOTAL_DAYS } from '@/lib/challengeContent'
import { cn } from '@/lib/utils'
import desafioAbuelo from '@/assets/desafio-abuelo.webp'
import desafioHero from '@/assets/desafio-hero.webp'
import mercadoPagoLogo from '@/assets/mercadopago-logo.svg'
import videoCompra from '@/assets/video-compra.mp4'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { AreasDeck } from '@/pages/desafio-30-dias/AreasDeck'
import { AREA_CARDS } from '@/pages/desafio-30-dias/deckCards'
import { PhoneMockups } from '@/pages/desafio-30-dias/PhoneMockups'

/**
 * The Desafío's sales page, built like the Pack's landings (pack/ at the repo root): a dark
 * hero with the hook, the price and the button on the first screen, the buyer's situation
 * answered with a remedy, the real app on screen, one offer card, an accordion FAQ and a
 * buy bar that follows you on a phone. Same honesty rules as those landings: nothing is
 * claimed that this page, the app or the backend doesn't already say; no countdowns, no
 * stars-of-reviews, no invented testimonials, no health claims.
 */

// ─── Static data (hoisted outside component) ────────────────────────────────

// Keep this declaration exactly as it is (name, `const`, a plain number): vite.config.ts reads this
// file as text to print the Desafío's list price on the Pack landings ("Suelto cuesta …").
const PRICE_ARS = 20000

// How many independent 30-day catalogs exist today (mirrors the backend's
// ChallengePurchaseService month allowlist). This is NOT a permanent ceiling
// — more months ship over time — so every "van N meses"-style line on this
// page reads from here instead of a hardcoded number, and bumping this one
// constant is the only change needed when a new month launches.
const CHALLENGE_MONTHS_AVAILABLE = 4

const formatPrice = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

// Manu's personal WhatsApp (international format, no "+") — deliberately NOT
// TIAM's business number (the one DesafioExitoPage.tsx uses for automated
// post-purchase activation): that number is API-only, so manual-transfer
// receipts need to land somewhere a person can actually read them.
const MANU_PERSONAL_WHATSAPP_NUMBER = '5492213080532'
const MANU_PERSONAL_WHATSAPP_DISPLAY = '+54 9 221 308-0532'
// Ends on "Mi nombre es:" so the buyer sends their name along with the
// receipt — the manual activation needs it.
const TRANSFER_RECEIPT_TEXT = '¡Hola! Ya transferí para el Desafío 30 días, te mando el comprobante. Mi nombre es:'
const HELP_REQUEST_TEXT = '¡Hola! Quiero el Desafío 30 días pero necesito ayuda para hacerlo.'

// Buyer details collected BEFORE checkout — the phone is captured up front because
// Mercado Pago Checkout Pro navigates away and we can't rely on the user coming back.
const checkoutSchema = z.object({
  buyerName: z.string().min(2, 'Ingresá tu nombre'),
  phone: z.string().min(6, 'Ingresá tu número de WhatsApp'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
})

type CheckoutForm = z.infer<typeof checkoutSchema>

// The orange every buy button shares. accent-hover (#CC4516), not tiam-orange: white on
// #E8531E is 3.69:1 and fails WCAG AA at body size; #CC4516 is 4.74:1. On the dark bands the
// focus ring is white (the blue one is only ~3:1 on navy).
const CTA_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[0.875rem] bg-accent-hover px-7 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.25),0_14px_26px_-10px_rgba(204,70,16,0.75)] transition-[background-color,scale] hover:bg-[#a8370b] motion-safe:active:scale-[0.98] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2'
const CTA_ON_DARK = `${CTA_BASE} focus-visible:ring-white focus-visible:ring-offset-tiam-navy`
const CTA_ON_LIGHT = `${CTA_BASE} focus-visible:ring-tiam-blue`

// Same type scale as the landings (h2: clamp(1.75rem, 1.3rem + 2vw, 2.75rem) / 1.12, 800).
const H2 =
  'text-balance font-display text-[clamp(1.75rem,1.3rem+2vw,2.75rem)] font-extrabold leading-[1.12] tracking-[-0.025em]'

// What is claimed here is already claimed, in the same words, further down this page
// (cómo funciona, qué recibís, FAQ) — the trust bar and the tiles only put it up front.
const TRUST = [
  { icon: CreditCard, text: 'Pago único con Mercado Pago' },
  { icon: MessageCircle, text: 'Se activa por WhatsApp' },
  { icon: Smartphone, text: 'Sin apps ni suscripción' },
]

const STATS = [
  { value: '30', label: 'ejercicios', className: 'bg-tiam-blue' },
  { value: '7', label: 'nuevos por semana', className: 'bg-[#cc4610]' },
  { value: '8', label: 'áreas cognitivas', className: 'bg-[#2c801c]' },
  { value: '10–15', label: 'minutos por ejercicio', className: 'bg-[#5b3c9e]' },
]

// The eight areas, in the colors the Desafío's own calendar uses. They paint the thin stripe
// that closes the hero and the pills of the "Así se juega" band.
const AREA_COLORS = AREA_CARDS.map((card) => ({ label: card.label, color: card.color }))

const PAIN = [
  {
    icon: Search,
    title: 'Buscás actividades y no sabés cuáles',
    text: 'Entre tantas opciones en internet, cuesta saber por dónde empezar y qué le va a gustar.',
  },
  {
    icon: Smartphone,
    title: 'No querés una app más',
    text: 'Instalar, crear usuarios y recordar claves es una barrera. Acá todo llega por WhatsApp.',
  },
  {
    icon: Hourglass,
    title: 'No hay tiempo de armar nada',
    text: 'Preparar algo nuevo cada semana es una tarea más. Con el Desafío llegan 7 ejercicios nuevos por semana, ya listos.',
  },
  {
    icon: Heart,
    title: 'Querés un rato juntos, no una tarea',
    text: 'Pocos minutos por ejercicio, para hacer acompañado y compartir un momento.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Comprás una sola vez',
    description: 'Un pago único por mes, sin suscripción. Los ejercicios de ese mes están disponibles durante 30 días: si te salteás un día, podés seguir con los demás. Pasado el mes, podés inscribirte para el siguiente.',
  },
  {
    step: '2',
    title: 'Lo activás por WhatsApp',
    description: 'Después de pagar, activás el desafío con un toque por WhatsApp y recibís tu primer ejercicio. Sin apps que instalar ni claves que recordar.',
  },
  {
    step: '3',
    title: '7 ejercicios nuevos por semana',
    description: 'Durante 30 días se desbloquean 7 ejercicios cognitivos nuevos cada semana, siempre en el mismo link que ya tenés. Podés hacer uno por día o varios juntos — a tu ritmo, en pocos minutos cada uno.',
  },
]

const PLAY_FEATURES = [
  {
    icon: Smartphone,
    title: 'Se juega desde el celular',
    text: 'Sin instalar nada: se activa por WhatsApp con un toque.',
  },
  {
    icon: Hourglass,
    title: '30 ejercicios, 7 nuevos por semana',
    text: 'Uno por día o varios juntos: de 10 a 15 minutos cada uno.',
  },
  {
    // computeStars (lib/challengeProgress.ts) is accuracy-based, never speed-based, and
    // floors at one star: this line, the "qué recibís" item and the FAQ answer say exactly that.
    icon: Star,
    title: 'Estrellas por la precisión',
    text: 'Miden qué tan preciso fuiste, no qué tan rápido.',
  },
]

// "Todo lo que recibís": the old "Qué incluye" items plus the facts the page already states
// elsewhere (the link, the stars).
const INCLUDES = [
  {
    title: '30 ejercicios, 7 nuevos por semana',
    description: 'Actividades pensadas para estimular la memoria, la atención y el lenguaje, sin repetirse.',
  },
  {
    title: 'Un link, sin cuentas ni apps',
    description: 'Se activa por WhatsApp con un toque y entrás siempre al mismo link. No hay apps que descargar ni usuarios que crear.',
  },
  {
    title: 'Simple para adultos mayores',
    description: 'Se hacen desde el celular o impresos. Letra grande, instrucciones claras, cero pantallas complicadas.',
  },
  {
    title: 'Estrellas por la precisión',
    description: 'Miden qué tan preciso fuiste, no qué tan rápido. Siempre ganás al menos una estrella.',
  },
  {
    title: 'Para hacer acompañado',
    description: 'Ideal para compartir un rato con quien querés. El desafío se disfruta más en familia.',
  },
  {
    title: 'Pocos minutos por día',
    description: 'Cada actividad lleva entre 10 y 15 minutos. Lo justo para sumar una rutina sin que pese.',
  },
]

const AUDIENCE = [
  'Querés ayudar a tu mamá, papá o abuelo a mantener la mente activa',
  'Buscás una rutina simple para hacer en casa, sin depender de un turno',
  'Preferís algo que llegue por WhatsApp y no una app más para aprender',
  'Te gustaría acompañar los ejercicios y compartir un momento juntos',
]

// The transfer steps sit in a closed <details> of the price section. Opening it before the
// in-page link scrolls there makes the FAQ's link land on the steps, not on a collapsed summary.
function openTransferSteps() {
  const steps = document.getElementById('transferencia')
  if (steps instanceof HTMLDetailsElement) steps.open = true
}

const FAQS = [
  {
    q: '¿Cómo recibo los ejercicios?',
    a: 'Después de pagar, activás el desafío por WhatsApp con un toque y te llega el primer mes al instante. Cada semana se desbloquean 7 actividades nuevas en ese mismo link — entrás cuando quieras y hacés una o varias, para hacer desde el celular o imprimir. Si dejaste tu email al comprar, el link también te llega por correo.',
  },
  {
    q: '¿Necesito instalar alguna aplicación?',
    a: 'No. Todo funciona desde WhatsApp y el navegador del celular. No hay apps que descargar ni usuarios que crear.',
  },
  {
    q: '¿Sirve si mi familiar no es de usar el celular?',
    a: 'Sí. Los ejercicios están pensados para hacerse acompañados y también se pueden imprimir en papel. La idea es que sea un momento compartido.',
  },
  {
    q: '¿Es un pago mensual?',
    a: 'No. Es un único pago por los 30 días del desafío. Sin suscripciones ni cobros automáticos.',
  },
  {
    q: '¿Qué miden las estrellas?',
    a: 'Qué tan preciso fuiste en cada juego, no qué tan rápido. Siempre ganás al menos una estrella: no es una competencia.',
  },
  {
    q: '¿Puedo pagar por transferencia?',
    a: (
      <>
        Sí. Transferís al alias de Mercado Pago, nos mandás el comprobante y tu nombre por WhatsApp, y te damos de alta a mano.{' '}
        <a
          href="#transferencia"
          onClick={openTransferSteps}
          className="font-semibold text-tiam-blue underline underline-offset-4 hover:text-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          Ver los pasos
        </a>
        .
      </>
    ),
  },
  {
    q: '¿Qué pasa cuando termino los 30 días?',
    a: 'Podés volver a comprar el desafío y arrancás automáticamente con el mes siguiente — actividades completamente nuevas, sin tener que elegir nada.',
  },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function Eyebrow({ text, tone = 'light' }: { text: string; tone?: 'light' | 'dark' }) {
  return (
    <div
      className={cn(
        'mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5',
        tone === 'dark' ? 'border-white/30 bg-white/10 text-white' : 'border-tiam-blue/20 bg-tiam-blue/[0.06] text-tiam-blue-dark',
      )}
    >
      <span className="text-[0.9375rem] font-bold">{text}</span>
    </div>
  )
}

/** Eight thin segments, one per cognitive area: the calendar's colors as a divider. */
function AreaStripe() {
  return (
    <div aria-hidden="true" className="flex h-2 w-full">
      {AREA_COLORS.map(({ label, color }) => (
        <span key={label} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  )
}

function CheckoutModal({ onClose }: { onClose: () => void }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutForm>({ resolver: zodResolver(checkoutSchema) })

  // This component only exists while the modal is open, so the lock is
  // always on — an accidental drag near the backdrop must not scroll the
  // sales page behind it.
  useBodyScrollLock(true)

  // Close on Escape — matches the modal pattern in PatientDetailPage.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function onSubmit(data: CheckoutForm) {
    try {
      const res = await api.post<{ checkoutUrl: string }>('/challenge/purchases', {
        buyerName: data.buyerName,
        phone: data.phone,
        email: data.email || null,
      })
      // Hand off to Mercado Pago Checkout Pro.
      window.location.assign(res.checkoutUrl)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError('root', {
        message: apiErr.message ?? 'No pudimos iniciar el pago. Probá de nuevo en un momento.',
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 motion-safe:animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl motion-safe:animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="checkout-title" className="text-xl font-bold text-slate-900">Empezá el desafío</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cargá los datos de la persona que va a hacer los ejercicios — puede ser para vos o para un ser querido.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
          <Input
            id="buyerName"
            label="Nombre"
            placeholder="María García"
            autoComplete="name"
            autoFocus
            error={errors.buyerName?.message}
            {...register('buyerName')}
          />
          <div>
            <Input
              id="phone"
              label="WhatsApp"
              placeholder="Ej: 11 2233 4455"
              inputMode="tel"
              autoComplete="tel"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Código de área y número, sin el 0 ni el 15 (como el ejemplo). A este WhatsApp le va a llegar el desafío.
            </p>
          </div>
          <div>
            <Input
              id="email"
              type="email"
              label="Email (opcional)"
              placeholder="tu@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Si lo cargás, te mandamos el link de tu desafío también por email.
            </p>
          </div>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tiam-green" />
            Después de pagar, activás el desafío por WhatsApp en un solo toque.
          </p>

          {errors.root && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errors.root.message}</p>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full min-h-[44px]">
            <Send className="h-4 w-4" />
            Ir al pago · {formatPrice(PRICE_ARS)}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            Pago único y seguro con
            <img src={mercadoPagoLogo} alt="Mercado Pago" className="h-5 w-auto" />
          </p>
        </form>
      </div>
    </div>
  )
}

/**
 * The buy button that follows you down the page on a phone: price on the left, button on
 * the right. It is on screen only while no other buy button is — i.e. not over the hero's,
 * the phones band's, the price card's, the closing band's or the footer — and while it is
 * off screen it is `invisible` (out of the tab order and the accessibility tree, and its
 * upward shadow isn't painted at the bottom edge) and `inert`. Phones only — hidden from
 * md up, like the Pack landings' bar.
 */
function StickyBuyBar({ visible, onBuy }: { visible: boolean; onBuy: () => void }) {
  return (
    <div
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 md:hidden',
        'border-t border-slate-100 bg-white shadow-[0_-10px_28px_-14px_rgba(22,38,63,0.35)]',
        // `visibility` rides the same transition, so it only turns to hidden once the bar has
        // finished sliding down, and turns to visible at once when it slides up.
        'transition-[translate,visibility] duration-[250ms] ease-out motion-reduce:transition-none',
        visible ? 'visible translate-y-0' : 'invisible translate-y-full',
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <p className="leading-tight">
          {/* "Desafío · " drops out below 360 px so the label never wraps next to the button. */}
          <span className="block whitespace-nowrap text-sm text-slate-600">
            <span className="hidden min-[360px]:inline">Desafío · </span>pago único
          </span>
          <span className="font-display text-xl font-extrabold text-slate-900">{formatPrice(PRICE_ARS)}</span>
        </p>
        <button
          type="button"
          onClick={onBuy}
          className={cn(CTA_ON_LIGHT, 'min-h-[44px] shrink-0 px-5 text-base')}
        >
          Quiero comprar
        </button>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Desafio30DiasPage() {
  const [showCheckout, setShowCheckout] = useState(false)
  const [showBar, setShowBar] = useState(false)

  function handleBuy() {
    setShowCheckout(true)
  }

  useEffect(() => {
    // Show the sticky bar only while none of the blocks that already carry a buy button is on
    // screen. IntersectionObserver reports each change once per block, so a Set of the ones
    // currently visible is enough.
    const targets = [
      document.getElementById('hero-cta'),
      document.getElementById('jugar-cta'),
      document.getElementById('precio-cta'),
      document.getElementById('cierre-cta'),
      document.querySelector('footer'),
    ].filter((el): el is HTMLElement => el !== null)
    const onScreen = new Set<Element>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target)
        else onScreen.delete(entry.target)
      }
      setShowBar(onScreen.size === 0)
    })
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-dvh bg-white overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-tiam-blue focus:shadow-md focus:ring-2 focus:ring-tiam-blue"
      >
        Ir al contenido principal
      </a>

      {/* ── 1. Navbar (shared) ─────────────────────────────────────────────── */}
      <PublicHeader />

      <main id="main-content">
        {/* ── 2. Hero — dark, like the Pack's landings: the hook, the price and the
             button all on the first screen. ────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-clip bg-tiam-navy bg-[radial-gradient(90%_60%_at_85%_0%,#1d4f86_0%,#16263f_70%)] text-white"
        >
          {/* Trust bar */}
          <div className="bg-[#0d1828]">
            <ul role="list" className="mx-auto grid max-w-6xl grid-cols-3 gap-2 px-3 py-2 text-center sm:px-6">
              {TRUST.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex flex-col items-center gap-1 text-sm font-bold leading-tight sm:flex-row sm:justify-center sm:gap-2.5 sm:text-[0.9375rem]"
                >
                  <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 text-[#ffd23f]" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12 lg:pb-20">
            <div className="max-w-xl text-left">
              <span
                data-enter="1"
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5"
              >
                <span className="h-2 w-2 rounded-full bg-tiam-orange" />
                <span className="text-[0.9375rem] font-bold">Desafío TIAM · 30 días</span>
              </span>

              <h1
                id="hero-heading"
                data-enter="2"
                className="text-balance font-display text-4xl font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-5xl lg:text-[2.5rem] xl:text-5xl"
              >
                <span className="rounded-[0.25em] bg-[#cc4610] px-[0.22em] [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
                  30 días
                </span>{' '}
                para mantener activa la mente de quien más querés.
              </h1>
              <p data-enter="3" className="mt-6 text-lg leading-relaxed text-slate-200 sm:text-xl">
                Ejercicios cognitivos por WhatsApp, con 7 nuevos cada semana.{' '}
                {/* Left out on a phone so the price and the button land higher on the first screen. */}
                <span className="hidden sm:inline">
                  Simple, ameno y pensado para hacer en casa junto a tu ser querido, a tu ritmo.{' '}
                </span>
                <strong className="font-semibold text-white">Sin turnos, sin apps, sin complicaciones.</strong>
              </p>

              <p
                data-enter="4"
                className="mt-7 font-display text-[2.5rem] font-extrabold leading-none tracking-[-0.03em]"
              >
                {formatPrice(PRICE_ARS)}
              </p>
              <p data-enter="4" className="mt-2 text-base font-semibold text-slate-200">
                Desafío 30 días · pago único, sin suscripción
              </p>

              {/* flex-wrap: between 1024 and ~1100 px the column is narrower than the button and the
                  link side by side, and the link drops to its own line instead of overflowing. */}
              <div
                data-enter="5"
                className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5"
              >
                <button
                  type="button"
                  id="hero-cta"
                  onClick={handleBuy}
                  className={cn(CTA_ON_DARK, 'min-h-[56px] w-full text-lg sm:w-auto')}
                >
                  Quiero comprar el desafío
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <a
                  href="#como-funciona"
                  className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-semibold text-white underline underline-offset-4 hover:text-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
                >
                  Ver cómo funciona
                </a>
              </div>
              <p data-enter="5" className="mt-4 text-base text-slate-200">
                Pagás con Mercado Pago. Después lo activás por WhatsApp con un toque.
              </p>
            </div>

            <AreasDeck />
          </div>

          <ul role="list" data-stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 pb-14 sm:px-6 md:grid-cols-4 md:pb-16">
            {STATS.map((stat) => (
              <li
                key={stat.label}
                className={cn('rounded-[1.25rem] p-4 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]', stat.className)}
              >
                <p className="font-display text-[2.75rem] font-extrabold leading-none tracking-[-0.03em]">{stat.value}</p>
                <p className="mt-2 text-base font-semibold leading-tight">{stat.label}</p>
              </li>
            ))}
          </ul>
          <AreaStripe />
        </section>

        {/* ── 3. The hook: what makes it hard today, and what changes ──────── */}
        <section aria-labelledby="pain-heading" className="bg-[#fdf9eb] py-14 md:py-22">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 id="pain-heading" className={cn(H2, 'mx-auto max-w-3xl text-center text-slate-900')}>
              Querés ayudar a mantener su mente activa. Lo difícil es hacerlo todos los días.
            </h2>

            <ul role="list" data-stagger className="mt-10 grid gap-4 sm:grid-cols-2 md:mt-12 md:gap-5">
              {PAIN.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex gap-4 rounded-3xl border border-slate-100 border-l-8 border-l-[#cc4610] bg-white p-5 shadow-[0_10px_24px_-16px_rgba(22,38,63,0.35)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(232,83,30,0.12)] text-[#a8370b]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[1.3125rem] font-extrabold leading-snug text-slate-900">{title}</h3>
                    <p className="mt-1.5 text-lg leading-relaxed text-slate-700">{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mx-auto mt-10 grid max-w-4xl overflow-hidden rounded-[1.75rem] bg-primary text-white shadow-[0_24px_40px_-24px_rgba(21,67,111,0.8)] md:grid-cols-[1.2fr_1fr]">
              <div className="p-7 sm:p-10">
                <h3 className="font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] sm:text-3xl">
                  Con el Desafío no hay nada que armar.
                </h3>
                <p className="mt-4 text-lg leading-relaxed">
                  Pagás una vez, lo activás por WhatsApp y cada semana tenés 7 ejercicios nuevos en el mismo link. Uno por día o varios juntos, a su ritmo.
                </p>
              </div>
              <img
                src={desafioHero}
                alt="Ilustración de una hija y su mamá sonriendo ante un celular, en el living de casa"
                width={2048}
                height={1170}
                loading="lazy"
                decoding="async"
                className="h-56 w-full object-cover [object-position:66%_40%] md:h-full"
              />
            </div>
          </div>
        </section>

        {/* ── 4. How it plays — real screens, in a dark band ──────────────── */}
        <section
          aria-labelledby="play-heading"
          className="bg-tiam-navy bg-[radial-gradient(80%_45%_at_50%_0%,#1d4f86_0%,#16263f_75%)] py-14 text-white md:py-22"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow text="Así se juega" tone="dark" />
              <h2 id="play-heading" className={H2}>
                Un ejercicio por día, desde el celular
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-200 sm:text-xl">
                Cada día es un ejercicio distinto: memoria, atención, lenguaje, cálculo y más. Se abre con un toque desde WhatsApp, sin instalar nada.
              </p>
            </div>

            <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
              <div>
                <PhoneMockups />
                <p className="mt-4 text-center text-base text-slate-300">Pantallas reales del Desafío de 30 días.</p>
              </div>

              <div>
                <ul role="list" data-stagger className="space-y-6">
                  {PLAY_FEATURES.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold">{title}</h3>
                        <p className="mt-0.5 text-base leading-relaxed text-slate-200">{text}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-8 text-base font-semibold text-slate-200">Cada día trabaja una de estas 8 áreas:</p>
                <ul role="list" data-stagger className="mt-3 flex flex-wrap gap-2">
                  {AREA_COLORS.map(({ label, color }) => {
                    // The plant of the area when it has one, on a small paper disc (this band is dark: the violet, teal and gold plants would vanish on it);
                    // "Reconocimiento" has no plant yet and keeps its coloured dot.
                    const areaKey = areaKeyOf(label)
                    return (
                      <li
                        key={label}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full bg-white/10 py-1.5 text-[0.9375rem] font-semibold',
                          areaKey ? 'py-1 pl-1.5 pr-3' : 'px-3',
                        )}
                      >
                        {areaKey ? (
                          <AreaPlantIcon area={areaKey} size={20} onPaper />
                        ) : (
                          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        )}
                        {label}
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-8 rounded-3xl bg-white p-5 text-slate-900 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.8)]">
                  <p className="text-lg font-bold">Desafío 30 días</p>
                  <p className="mt-1 font-display text-4xl font-extrabold tracking-[-0.03em] text-tiam-blue-dark">
                    {formatPrice(PRICE_ARS)}
                  </p>
                  <p className="text-base text-slate-600">pago único, sin suscripción</p>
                  <button
                    type="button"
                    id="jugar-cta"
                    onClick={handleBuy}
                    className={cn(CTA_ON_LIGHT, 'mt-4 min-h-[52px] w-full text-base')}
                  >
                    Quiero comprar el desafío
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. How it works ──────────────────────────────────────────────── */}
        <section id="como-funciona" aria-labelledby="how-heading" className="scroll-mt-4 bg-white py-14 md:py-22">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="mb-10 text-center md:mb-12">
              <Eyebrow text="Cómo funciona" />
              <h2 id="how-heading" className={cn(H2, 'text-slate-900')}>
                Empezar es así de fácil
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-700 sm:text-xl">
                En tres pasos tenés el desafío andando. No hace falta saber de tecnología.
              </p>
            </div>
            <ol role="list" data-stagger className="space-y-4">
              {HOW_IT_WORKS.map(({ step, title, description }) => (
                <li
                  key={step}
                  className="relative rounded-3xl border border-slate-100 bg-white p-5 pl-[4.25rem] shadow-[0_14px_30px_-16px_rgba(22,38,63,0.25)] sm:p-6 sm:pl-[5rem]"
                >
                  <span
                    className="absolute left-4 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary font-display text-xl font-extrabold text-white sm:left-5 sm:top-6"
                    aria-hidden="true"
                  >
                    {step}
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    <span className="sr-only">Paso {step}: </span>
                    {title}
                  </h3>
                  <p className="mt-1.5 text-lg leading-relaxed text-slate-700">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 6. Offer — right after the hook, the phones and the steps, so buying is
             reachable with little scrolling on mobile (explicit user request; the sticky
             buy bar covers the rest of the page). ──────────────────────────── */}
        <section
          id="precio"
          aria-labelledby="pricing-heading"
          className="scroll-mt-4 bg-gradient-to-b from-white to-[#e6f0fb] py-14 md:py-22"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow text="Tu desafío" />
              <h2 id="pricing-heading" className={cn(H2, 'text-slate-900')}>
                Un solo pago, todo adentro
              </h2>
            </div>

            <div className="mt-10 grid items-start gap-6 md:mt-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-8">
              <div className="rounded-[1.75rem] border border-slate-100 bg-white p-6 sm:p-8">
                <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-900">Todo lo que recibís</h3>
                <ul role="list" data-stagger className="mt-6 space-y-5">
                  {INCLUDES.map(({ title, description }) => (
                    <li key={title} className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-green/15">
                        <Check className="h-4 w-4 text-[#2c701a]" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <div>
                        <h4 className="text-lg font-bold leading-snug text-slate-900">{title}</h4>
                        <p className="mt-0.5 text-base leading-relaxed text-slate-700">{description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_0_0_3px_#1B6FC4,0_30px_50px_-24px_rgba(27,111,196,0.55)]">
                {/* Head — the price is the star */}
                <div className="bg-[linear-gradient(135deg,#1B6FC4,#15436F)] px-6 pb-6 pt-7 text-center text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-[0.9375rem] font-bold">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Desafío 30 días
                  </span>
                  <div className="mt-4 flex items-start justify-center font-display font-extrabold tracking-[-0.03em]">
                    <span className="mt-2 text-[1.75rem] text-white/80">$</span>
                    <span className="text-[clamp(3.25rem,2.2rem+5vw,4.75rem)] leading-none">
                      {PRICE_ARS.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold">Un solo pago · acceso a los 30 ejercicios</p>
                  <p className="mt-1 text-base text-white/90">
                    Son unos {formatPrice(Math.round(PRICE_ARS / CHALLENGE_TOTAL_DAYS))} por ejercicio.
                  </p>
                </div>

                <div className="p-6">
                  <button
                    type="button"
                    id="precio-cta"
                    onClick={handleBuy}
                    className={cn(CTA_ON_LIGHT, 'min-h-[56px] w-full text-lg')}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Empezar ahora
                  </button>

                  <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-base text-slate-600">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Pagás con
                    <img src={mercadoPagoLogo} alt="Mercado Pago" className="h-6 w-auto" />
                  </p>
                  <p className="mt-1 text-center text-base text-slate-600">TIAM no guarda los datos de tu tarjeta.</p>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-base text-slate-700">
              ¿Ya hiciste un mes? Comprá de nuevo y arrancás automáticamente con el siguiente —
              por ahora hay {CHALLENGE_MONTHS_AVAILABLE} meses distintos, y seguimos sumando más.
            </p>

            <div className="mx-auto mt-8 max-w-2xl space-y-4">
              <details id="transferencia" className="group scroll-mt-4 rounded-2xl border border-dashed border-slate-300 bg-white">
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-lg font-bold text-slate-900 marker:content-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                  ¿Preferís pagar por transferencia?
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-tiam-blue transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="px-5 pb-5">
                  <ol className="list-decimal space-y-2 pl-5 text-base leading-relaxed text-slate-700 marker:font-semibold marker:text-slate-900">
                    <li>
                      Transferí <strong className="text-slate-900">{formatPrice(PRICE_ARS)}</strong> al alias de
                      Mercado Pago <strong className="text-slate-900">manu.bata.it</strong>.
                    </li>
                    <li>
                      Mandá el comprobante y tu nombre por WhatsApp al{' '}
                      <strong className="whitespace-nowrap text-slate-900">{MANU_PERSONAL_WHATSAPP_DISPLAY}</strong>.
                    </li>
                    <li>
                      Te damos de alta a mano y te mandamos el link de los juegos a ese mismo WhatsApp, ni
                      bien lo recibimos.
                    </li>
                  </ol>
                  <a
                    href={`https://wa.me/${MANU_PERSONAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(TRANSFER_RECEIPT_TEXT)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-base font-semibold text-tiam-blue underline-offset-4 hover:underline"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Mandar comprobante y nombre por WhatsApp
                  </a>
                </div>
              </details>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <p className="text-lg font-bold text-slate-900">
                  ¿No podés hacerlo por tu cuenta? Lo hacemos por vos.
                </p>
                <p className="mt-1 text-base leading-relaxed text-slate-700">
                  Escribinos por WhatsApp y te acompañamos paso a paso hasta dejar el desafío andando.
                </p>
                <a
                  href={`https://wa.me/${MANU_PERSONAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(HELP_REQUEST_TEXT)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-base font-semibold text-tiam-blue underline-offset-4 hover:underline"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Pedir ayuda por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. Purchase walkthrough — a short video replaces the old
             hand-built mockup cards (this tool had no way to save a real
             browser capture as an image asset, so the mockups were a
             workaround; a real recording is strictly better). */}
        <section aria-labelledby="steps-heading" className="bg-white py-14 md:py-22">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div className="mb-10 text-center">
              <Eyebrow text="Cómo comprar" />
              <h2 id="steps-heading" className={cn(H2, 'text-slate-900')}>
                Así se compra, paso a paso
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-700 sm:text-xl">
                Mirá este video cortito y vas a saber exactamente qué hacer, de principio a fin.
              </p>
            </div>

            {/* video-compra.mp4 is a portrait phone-screen recording (720×1568,
                ~9:19.5) — matching that aspect ratio here (instead of a
                landscape aspect-video box) is what makes the actual footage
                fill the frame edge to edge rather than getting pillarboxed
                down to a narrow strip with dark bars on both sides, which is
                especially cramped on a phone screen. */}
            <div className="mx-auto max-w-xs overflow-hidden rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
              <video
                controls
                preload="metadata"
                className="aspect-[720/1568] w-full rounded-2xl bg-slate-900"
              >
                <source src={videoCompra} type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        {/* ── 8. Who it's for ──────────────────────────────────────────────── */}
        <section aria-labelledby="audience-heading" className="bg-[#fdf9eb] py-14 md:py-22">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow text="Para vos" />
              <h2 id="audience-heading" className={cn(H2, 'text-slate-900')}>
                El desafío es para vos si…
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-700 sm:text-xl">
                No hace falta ser profesional de la salud ni experto en nada. Solo querer acompañar.
              </p>
              <ul role="list" data-stagger className="mt-6 space-y-3.5">
                {AUDIENCE.map((text) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tiam-green/15">
                      <Check className="h-3.5 w-3.5 text-[#2c701a]" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="text-lg text-slate-700">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-3xl border border-tiam-blue/15 bg-white shadow-sm">
              <img
                src={desafioAbuelo}
                alt="Ilustración de un adulto mayor que sonríe mientras mira el celular en la mesa de su cocina, recibiendo el ejercicio del día"
                loading="lazy"
                className="h-64 w-full object-cover sm:h-72"
              />
              <div className="p-8">
                <Sparkles className="h-6 w-6 text-tiam-orange" aria-hidden="true" />
                <p className="mt-3 text-lg font-medium leading-relaxed text-slate-800">
                  “Mantener la mente activa es uno de los mejores regalos que le podés hacer a un ser querido. El desafío lo vuelve una rutina simple y compartida.”
                </p>
                {/* TODO(social-proof): replace with a real testimonial once available. */}
                <p className="mt-4 text-base font-semibold text-slate-600">Equipo TIAM Digital</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 9. FAQ — native accordion, one open at a time ───────────────── */}
        <section aria-labelledby="faq-heading" className="bg-slate-50 py-14 md:py-22">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="mb-10 text-center md:mb-12">
              <Eyebrow text="Dudas frecuentes" />
              <h2 id="faq-heading" className={cn(H2, 'text-slate-900')}>
                Lo que suelen preguntar
              </h2>
            </div>
            <div data-stagger className="space-y-3">
              {FAQS.map(({ q, a }) => (
                <details
                  key={q}
                  name="faq"
                  className="group rounded-2xl border border-slate-100 bg-white shadow-[0_1px_2px_rgba(22,38,63,0.04)]"
                >
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-3.5 text-left text-lg font-bold text-slate-900 marker:content-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-tiam-blue transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="px-5 pb-5 text-lg leading-relaxed text-slate-700">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 10. Closing band ─────────────────────────────────────────────── */}
        <section aria-labelledby="cta-heading" className="bg-[linear-gradient(135deg,#1B6FC4,#15436F)] text-white">
          <AreaStripe />
          <div className="mx-auto max-w-4xl px-4 pb-16 pt-14 text-center sm:px-6 md:pb-20 md:pt-16">
            <h2 id="cta-heading" className={H2}>
              Empezá hoy a mantener su mente activa
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed sm:text-xl">
              30 días, un ejercicio por vez. Un hábito simple que hace la diferencia.
            </p>
            <p className="mt-6 font-display text-5xl font-extrabold leading-none tracking-[-0.03em]">
              {formatPrice(PRICE_ARS)}
            </p>
            <p className="mt-2 text-base font-semibold">Desafío 30 días · pago único</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                id="cierre-cta"
                onClick={handleBuy}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[0.875rem] bg-white px-7 text-lg font-bold text-tiam-blue-dark shadow-[0_14px_26px_-10px_rgba(0,0,0,0.5)] transition-[background-color,scale] hover:bg-slate-50 motion-safe:active:scale-[0.98] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-tiam-blue-dark sm:w-auto"
              >
                Quiero comprar el desafío
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <Link
                to="/preguntas-frecuentes"
                className="inline-flex min-h-[56px] w-full items-center justify-center rounded-[0.875rem] border border-white/50 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
              >
                Tengo más preguntas
              </Link>
            </div>
            <p className="mt-5 text-base">Pagás con Mercado Pago. Después lo activás por WhatsApp con un toque.</p>
          </div>
        </section>
      </main>

      <PublicFooter />

      <StickyBuyBar visible={showBar && !showCheckout} onBuy={handleBuy} />

      {showCheckout && <CheckoutModal onClose={() => setShowCheckout(false)} />}
    </div>
  )
}
