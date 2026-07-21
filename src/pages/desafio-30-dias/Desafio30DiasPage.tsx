import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import {
  Brain, MessageCircle, CalendarCheck, Check, ChevronRight,
  ShieldCheck, Heart, Clock, Smartphone, Send, Gift, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { api } from '@/lib/api'
import desafioHero from '@/assets/desafio-hero.webp'
import desafioAbuelo from '@/assets/desafio-abuelo.webp'
import mercadoPagoLogo from '@/assets/mercadopago-logo.svg'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import shotElReloj from '@/assets/desafio-screenshots/el-reloj.webp'
import shotLaBalanza from '@/assets/desafio-screenshots/la-balanza.webp'
import shotMemotest from '@/assets/desafio-screenshots/memotest.webp'
import shotCualNoVa from '@/assets/desafio-screenshots/cual-no-va.webp'
import shotQueOficioEs from '@/assets/desafio-screenshots/que-oficio-es.webp'
import shotLaRecetaDoble from '@/assets/desafio-screenshots/la-receta-doble.webp'

// ─── Static data (hoisted outside component) ────────────────────────────────

const PRICE_ARS = 15000

const formatPrice = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

// Buyer details collected BEFORE checkout — the phone is captured up front because
// Mercado Pago Checkout Pro navigates away and we can't rely on the user coming back.
const checkoutSchema = z.object({
  buyerName: z.string().min(2, 'Ingresá tu nombre'),
  phone: z.string().min(6, 'Ingresá tu número de WhatsApp'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
})

type CheckoutForm = z.infer<typeof checkoutSchema>

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Gift,
    title: 'Comprás una sola vez',
    description: 'Un pago único, sin suscripción ni renovaciones. El desafío queda tuyo para siempre.',
  },
  {
    step: '02',
    icon: MessageCircle,
    title: 'Lo activás por WhatsApp',
    description: 'Después de pagar, activás el desafío con un toque por WhatsApp y recibís tu primer ejercicio. Sin apps que instalar ni claves que recordar.',
  },
  {
    step: '03',
    icon: CalendarCheck,
    title: 'Un ejercicio nuevo cada día',
    description: 'Durante 30 días, cada día pedís tu actividad por WhatsApp con un simple mensaje. Para hacer en casa, a tu ritmo, en pocos minutos.',
  },
]

const INCLUDES = [
  {
    icon: Brain,
    title: '30 ejercicios, uno por día',
    description: 'Actividades pensadas para estimular la memoria, la atención y el lenguaje, sin repetirse.',
    stripClass: 'border-t-tiam-blue',
    iconClass: 'bg-tiam-blue/10 text-tiam-blue',
  },
  {
    icon: Smartphone,
    title: 'Simple para adultos mayores',
    description: 'Se hacen desde el celular o impresos. Letra grande, instrucciones claras, cero pantallas complicadas.',
    stripClass: 'border-t-tiam-orange',
    iconClass: 'bg-tiam-orange/10 text-tiam-orange',
  },
  {
    icon: Heart,
    title: 'Para hacer acompañado',
    description: 'Ideal para compartir un rato con quien querés. El desafío se disfruta más en familia.',
    stripClass: 'border-t-tiam-green',
    iconClass: 'bg-tiam-green/10 text-tiam-green',
  },
  {
    icon: Clock,
    title: 'Pocos minutos por día',
    description: 'Cada actividad lleva entre 10 y 15 minutos. Lo justo para sumar una rutina sin que pese.',
    stripClass: 'border-t-tiam-blue-dark',
    iconClass: 'bg-tiam-blue/10 text-tiam-blue-dark',
  },
]

const AUDIENCE = [
  'Querés ayudar a tu mamá, papá o abuelo a mantener la memoria activa',
  'Buscás una rutina simple para hacer en casa, sin depender de un turno',
  'Preferís algo que llegue por WhatsApp y no una app más para aprender',
  'Te gustaría acompañar los ejercicios y compartir un momento juntos',
]

// Recortes de solo la ilustración de cada juego (sin preguntas ni opciones a la vista,
// para no espoilear la mecánica) — uno por área cognitiva. Area label/color mirror
// AREA_META in DesafioPlayPage.tsx (single source of truth).
const GAME_SHOWCASE = [
  { image: shotElReloj, day: 9, title: 'El reloj', area: 'Dibujo', color: '#7C3AED' },
  { image: shotCualNoVa, day: 11, title: '¿Cuál no va?', area: 'Atención', color: '#E8531E' },
  { image: shotMemotest, day: 19, title: 'Memotest', area: 'Memoria', color: '#1B6FC4' },
  { image: shotQueOficioEs, day: 26, title: '¿Qué oficio es?', area: 'Lenguaje', color: '#4CA52E' },
  { image: shotLaRecetaDoble, day: 22, title: 'La receta doble', area: 'Cálculo', color: '#0891B2' },
  { image: shotLaBalanza, day: 29, title: 'La balanza', area: 'Razonamiento', color: '#4F46E5' },
]

const FAQS = [
  {
    q: '¿Cómo recibo los ejercicios?',
    a: 'Después de pagar, activás el desafío por WhatsApp con un toque y te llega el primer ejercicio al instante. Cada día le escribís “desafío” y te pasamos la actividad nueva, para hacer desde el celular o imprimir.',
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
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureCheck({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-tiam-green" />
      <span className="text-sm text-slate-600">{text}</span>
    </li>
  )
}

function SectionEyebrow({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-tiam-blue/20 bg-tiam-blue/5 px-4 py-1.5 mb-4 text-tiam-blue">
      <span className="text-xs font-semibold uppercase tracking-wide">{text}</span>
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
      window.location.href = res.checkoutUrl
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError('root', {
        message: apiErr.message ?? 'No pudimos iniciar el pago. Probá de nuevo en un momento.',
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl"
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
          <Input
            id="email"
            type="email"
            label="Email (opcional)"
            placeholder="tu@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
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

// ─── Page ────────────────────────────────────────────────────────────────────

export function Desafio30DiasPage() {
  const [showCheckout, setShowCheckout] = useState(false)

  function handleBuy() {
    setShowCheckout(true)
  }

  return (
    <div className="min-h-dvh bg-white overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-tiam-blue focus:shadow-md focus:ring-2 focus:ring-tiam-blue"
      >
        Ir al contenido principal
      </a>

      {/* ── 1. Sticky navbar (shared) ──────────────────────────────────────── */}
      <PublicHeader />

      <main id="main-content">
        {/* ── 2. Hero ──────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden bg-gradient-to-br from-tiam-blue/5 to-slate-50 min-h-[460px] sm:min-h-[540px] lg:min-h-[620px] flex items-center"
        >
          {/* Background image */}
          <img
            src={desafioHero}
            alt="Una hija acompaña a su mamá mientras resuelven juntas un ejercicio de estimulación cognitiva en la mesa de casa"
            className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
            fetchPriority="high"
          />
          {/* Readability wash — white from the left so the text reads over the photo */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/30 sm:via-white/80 sm:to-transparent lg:from-white/95 lg:via-white/65"
          />

          <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="max-w-xl text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 backdrop-blur px-4 py-1.5 mb-6">
                <span className="h-2 w-2 rounded-full bg-tiam-orange" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Desafío TIAM · 30 días
                </span>
              </div>

              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-slate-900 leading-tight tracking-tight"
              >
                30 días para cuidar la memoria de{' '}
                <span className="text-tiam-blue">quien más querés.</span>
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-slate-700 max-w-xl">
                Un ejercicio cognitivo por día, a través de WhatsApp. Simple, ameno y pensado para hacer en casa junto a tu ser querido.{' '}
                <strong className="font-semibold text-slate-900">Sin turnos, sin apps, sin complicaciones.</strong>
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="w-full sm:w-auto min-h-[44px]" onClick={handleBuy}>
                  Quiero empezar el desafío
                </Button>
                <a href="#como-funciona">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto min-h-[44px]">
                    Ver cómo funciona
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>

              {/* Trust signals */}
              <div className="mt-8 flex flex-wrap items-center gap-2">
                {[
                  { icon: CalendarCheck, text: 'Un ejercicio por día' },
                  { icon: MessageCircle, text: 'Por WhatsApp' },
                  { icon: ShieldCheck, text: 'Un solo pago' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="inline-flex items-center gap-1.5 rounded-full border border-tiam-blue/20 bg-white/80 backdrop-blur px-3 py-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-tiam-blue" />
                    <span className="text-xs font-semibold text-slate-700">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. How it works ──────────────────────────────────────────────── */}
        <section id="como-funciona" aria-labelledby="how-heading" className="py-16 md:py-24 bg-white scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Cómo funciona" />
              <h2 id="how-heading" className="text-3xl font-bold text-slate-900">
                Empezar es así de fácil
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                En tres pasos tenés el desafío andando. No hace falta saber de tecnología.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }) => (
                <article
                  key={step}
                  className="relative rounded-3xl border border-slate-100 bg-white px-6 pt-6 pb-7 shadow-sm"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-tiam-blue to-tiam-blue-dark text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="mb-1 text-[10px] font-bold tracking-widest text-slate-300 uppercase">Paso {step}</p>
                  <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. What's included ───────────────────────────────────────────── */}
        <section aria-labelledby="includes-heading" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Qué incluye" />
              <h2 id="includes-heading" className="text-3xl font-bold text-slate-900">
                Todo lo que tiene el desafío
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Pensado para que sea un hábito lindo de sostener, no una obligación más.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {INCLUDES.map(({ icon: Icon, title, description, stripClass, iconClass }, i) => (
                <article
                  key={title}
                  className={`rounded-3xl border border-slate-100 border-t-2 ${stripClass} bg-white px-6 pt-5 pb-6 shadow-sm hover:shadow-md transition-[box-shadow] duration-200`}
                >
                  <p className="mb-3 text-[10px] font-bold tracking-widest text-slate-300 uppercase">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4.5. See the real games ──────────────────────────────────────── */}
        <section aria-labelledby="games-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Así son los juegos" />
              <h2 id="games-heading" className="text-3xl font-bold text-slate-900">
                Mirá algunos ejemplos reales
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Cada día trabaja un área cognitiva distinta, con ilustraciones propias y letra grande.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
              {GAME_SHOWCASE.map(({ image, day, title, area, color }) => (
                <article
                  key={day}
                  className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"
                >
                  <div className="flex h-28 items-center justify-center bg-slate-50 p-4 sm:h-36">
                    <img
                      src={image}
                      alt={`Ilustración del juego "${title}"`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="border-t border-slate-100 p-4">
                    <span
                      className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase"
                      style={{ color, backgroundColor: `${color}1A` }}
                    >
                      Día {day} · {area}
                    </span>
                    <p className="mt-2 font-semibold text-slate-900">{title}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Who it's for ──────────────────────────────────────────────── */}
        <section aria-labelledby="audience-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionEyebrow text="Para vos" />
              <h2 id="audience-heading" className="text-3xl font-bold text-slate-900">
                El desafío es para vos si…
              </h2>
              <p className="mt-3 text-slate-600">
                No hace falta ser profesional de la salud ni experto en nada. Solo querer acompañar.
              </p>
              <ul className="mt-6 space-y-3">
                {AUDIENCE.map((text) => (
                  <FeatureCheck key={text} text={text} />
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-3xl border border-tiam-blue/15 bg-tiam-blue/5">
              <img
                src={desafioAbuelo}
                alt="Un adulto mayor sonríe mientras mira el celular en la mesa de su cocina, recibiendo el ejercicio del día"
                className="h-64 w-full object-cover sm:h-72"
              />
              <div className="p-8">
                <Sparkles className="h-6 w-6 text-tiam-orange" />
                <p className="mt-3 text-lg font-medium text-slate-800 leading-relaxed">
                  “Mantener la mente activa es uno de los mejores regalos que le podés hacer a un ser querido. El desafío lo vuelve una rutina simple y compartida.”
                </p>
                {/* TODO(social-proof): replace with a real testimonial once available. */}
                <p className="mt-4 text-sm font-semibold text-slate-500">Equipo TIAM Digital</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Pricing ───────────────────────────────────────────────────── */}
        <section id="precio" aria-labelledby="pricing-heading" className="py-16 md:py-24 bg-slate-50 scroll-mt-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <SectionEyebrow text="Precio" />
            <h2 id="pricing-heading" className="text-3xl font-bold text-slate-900">
              Un solo pago, el desafío completo
            </h2>

            <div className="mx-auto mt-10 max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl shadow-tiam-blue/10 ring-1 ring-slate-100">
              {/* Hero band — the price is the star */}
              <div className="bg-gradient-to-br from-tiam-blue to-tiam-blue-dark px-8 py-10 text-white">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  Desafío 30 días
                </span>
                <div className="mt-5 flex items-start justify-center">
                  <span className="mt-2.5 text-3xl font-bold text-white/75">$</span>
                  <span className="text-6xl font-extrabold leading-none tracking-tight sm:text-7xl">
                    {PRICE_ARS.toLocaleString('es-AR')}
                  </span>
                </div>
                <p className="mt-3 text-white/80">Un solo pago · acceso a los 30 ejercicios</p>
              </div>

              {/* Body — benefits + CTA */}
              <div className="px-8 py-8 text-left">
                <ul className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                  {[
                    'Los 30 ejercicios, uno por día',
                    'Todo por WhatsApp, sin apps',
                    'Para hacer en casa, a tu ritmo',
                    'Un pago, sin renovaciones',
                  ].map((text) => (
                    <li key={text} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tiam-green/10">
                        <Check className="h-3 w-3 text-tiam-green" strokeWidth={3} />
                      </span>
                      <span className="text-sm text-slate-600">{text}</span>
                    </li>
                  ))}
                </ul>

                <Button size="lg" className="mt-7 w-full min-h-[52px] text-base" onClick={handleBuy}>
                  <Send className="h-4 w-4" />
                  Empezar ahora
                </Button>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Pago único y seguro con
                  <img src={mercadoPagoLogo} alt="Mercado Pago" className="h-5 w-auto" />
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. FAQ ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Dudas frecuentes" />
              <h2 id="faq-heading" className="text-3xl font-bold text-slate-900">
                Preguntas que quizás tengas
              </h2>
            </div>
            <dl className="space-y-4">
              {FAQS.map(({ q, a }) => (
                <div key={q} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <dt className="font-semibold text-slate-900">{q}</dt>
                  <dd className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── 8. Final CTA band ────────────────────────────────────────────── */}
        <section aria-labelledby="cta-heading" className="py-16 md:py-20 bg-gradient-to-br from-tiam-blue to-tiam-blue-dark">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 id="cta-heading" className="text-3xl font-bold text-white">
              Empezá hoy a cuidar su memoria
            </h2>
            <p className="mt-3 text-lg text-white/85 max-w-xl mx-auto">
              30 días, un ejercicio por vez. Un hábito simple que hace la diferencia.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[44px] bg-white text-tiam-blue hover:bg-slate-100"
                onClick={handleBuy}
              >
                Quiero empezar el desafío
              </Button>
              <Link to="/preguntas-frecuentes">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto min-h-[44px] bg-transparent border-white/40 text-white hover:bg-white/10"
                >
                  Tengo más preguntas
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      {showCheckout && <CheckoutModal onClose={() => setShowCheckout(false)} />}
    </div>
  )
}
