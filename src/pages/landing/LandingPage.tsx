import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Brain, Target, MessageCircle, Compass, Zap, Hand, Eye, Music,
  BookOpen, Printer, MousePointerClick, TrendingUp, Check,
  ChevronRight, Search, ClipboardList,
  HeartPulse, Activity, Home, Sparkles, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import logoGrande from '@/assets/logogrande-sinfondo.png'
import heroBanner from '@/assets/hero-banner.webp'
import profNeuro from '@/assets/profesionales/neuropsicologia.webp'
import profTO from '@/assets/profesionales/terapia-ocupacional.webp'
import profGeriatria from '@/assets/profesionales/geriatria.webp'
import profFono from '@/assets/profesionales/fonoaudiologia.webp'
import claudiaImg from '@/assets/testimonial-claudia.webp'
import desafioAbuelo from '@/assets/desafio-abuelo.webp'
import { useAuthStore } from '@/store/auth'
import { COGNITIVE_AREAS } from '@/lib/utils'

// ─── Static data (hoisted outside component) ────────────────────────────────

const BENEFITS = [
  {
    icon: BookOpen,
    title: 'Biblioteca curada por área cognitiva',
    description:
      'Encontrá ejercicios organizados por las 8 áreas cognitivas. Filtrá por dificultad, tipo de material o nombre en segundos.',
    stripClass: 'border-t-tiam-blue',
    iconClass: 'bg-tiam-blue/10 text-tiam-blue',
  },
  {
    icon: Printer,
    title: 'Fichas A4 listas para imprimir',
    description:
      'Generá fichas con formato profesional al instante. Sin diseño, sin edición: directas a la impresora.',
    stripClass: 'border-t-tiam-orange',
    iconClass: 'bg-tiam-orange/10 text-tiam-orange',
  },
  {
    icon: MousePointerClick,
    title: 'Armá sesiones en un clic',
    description:
      'Seleccioná ejercicios, ordenalos y asignalos a tu paciente en minutos. Una sesión entera lista antes de empezar.',
    stripClass: 'border-t-tiam-blue-dark',
    iconClass: 'bg-tiam-blue/10 text-tiam-blue-dark',
  },
  {
    icon: TrendingUp,
    title: 'Seguí el progreso de cada paciente',
    description:
      'Registrá la evolución individual. Revisá qué trabajaste, qué mejoró y qué ajustar en la próxima sesión.',
    stripClass: 'border-t-tiam-green',
    iconClass: 'bg-tiam-green/10 text-tiam-green',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Search,
    title: 'Buscá ejercicios',
    description: 'Filtrá por área cognitiva, nivel de dificultad o nombre. Toda la biblioteca en un solo lugar.',
  },
  {
    step: '02',
    icon: ClipboardList,
    title: 'Armá la sesión',
    description: 'Seleccioná los ejercicios y asignalos al paciente. TIAM organiza todo por vos.',
  },
  {
    step: '03',
    icon: TrendingUp,
    title: 'Trabajá y seguí',
    description: 'Imprimí las fichas A4, trabajá la sesión y registrá la evolución de cada paciente para ajustar la próxima.',
  },
]

const STATS = [
  { value: '8', label: 'Áreas cognitivas' },
  { value: '40+', label: 'Ejercicios listos' },
  { value: '2-3 hs', label: 'Ahorradas por semana' },
  { value: 'A4', label: 'Fichas en 1 clic' },
]

const PRICING_PLANS = [
  {
    id: 'trial',
    badge: null,
    label: 'Prueba gratuita',
    price: 'Gratis',
    priceSub: '7 días de acceso completo',
    roiNote: null,
    features: [
      'Acceso completo a todas las funciones',
      'Sin tarjeta de crédito requerida',
      'Por tiempo limitado',
    ],
    ctaLabel: 'Empezar gratis',
    ctaVariant: 'secondary' as const,
    featured: false,
  },
  {
    id: 'pro',
    badge: 'Recomendado',
    label: 'Profesional',
    price: '$20.000',
    priceSub: 'por mes · o $200.000/año',
    roiNote: 'Ahorrás 2-3 hs por semana. Menos de lo que cobrás por una sesión.',
    features: [
      'Biblioteca completa de ejercicios TIAM',
      'Ejercicios propios ilimitados',
      'Pacientes ilimitados',
      'Armado de sesiones e impresión de fichas',
      'Seguimiento de evolución por paciente',
    ],
    ctaLabel: 'Empezar gratis 7 días',
    ctaVariant: 'primary' as const,
    featured: true,
  },
  {
    id: 'inst',
    badge: null,
    label: 'Institucional',
    price: 'A consultar',
    priceSub: 'Para geriátricos, centros de día e instituciones',
    roiNote: null,
    features: [
      'Todo lo del plan Profesional',
      'Múltiples profesionales',
      'Panel de administración institucional',
      'Facturación centralizada',
      'Soporte prioritario',
    ],
    ctaLabel: 'Contactanos',
    ctaVariant: 'secondary' as const,
    featured: false,
  },
]

const AREA_ICONS: Record<string, typeof Brain> = {
  memoria: Brain,
  atencion: Target,
  'fluencia-verbal': MessageCircle,
  'orientacion-espacial': Compass,
  'funciones-ejecutivas': Zap,
  praxias: Hand,
  agnosias: Eye,
  'estimulacion-sensorial': Music,
}

const AREA_STYLES: Record<string, { card: CSSProperties; icon: CSSProperties; color: string }> = {
  memoria:                  { card: { backgroundColor: '#EEF5FC', borderColor: '#B5D4F4' }, icon: { backgroundColor: '#1B6FC420' }, color: '#1B6FC4' },
  atencion:                 { card: { backgroundColor: '#FDF1EC', borderColor: '#F5C4B3' }, icon: { backgroundColor: '#E8531E20' }, color: '#E8531E' },
  'fluencia-verbal':        { card: { backgroundColor: '#EAF5F0', borderColor: '#9FE1CB' }, icon: { backgroundColor: '#0F6E5620' }, color: '#0F6E56' },
  'orientacion-espacial':   { card: { backgroundColor: '#F0EEFF', borderColor: '#AFA9EC' }, icon: { backgroundColor: '#534AB720' }, color: '#534AB7' },
  'funciones-ejecutivas':   { card: { backgroundColor: '#EEF7E9', borderColor: '#C0DD97' }, icon: { backgroundColor: '#4CA52E20' }, color: '#3B6D11' },
  praxias:                  { card: { backgroundColor: '#EDF0F4', borderColor: '#B6C4D6' }, icon: { backgroundColor: '#16263F20' }, color: '#16263F' },
  agnosias:                 { card: { backgroundColor: '#EEF1FB', borderColor: '#B5C5F0' }, icon: { backgroundColor: '#2B4DB820' }, color: '#2B4DB8' },
  'estimulacion-sensorial': { card: { backgroundColor: '#FEF5E7', borderColor: '#FAC775' }, icon: { backgroundColor: '#BA751720' }, color: '#854F0B' },
}

const PROFESSIONALS = [
  { img: profNeuro, label: 'Neuropsicólogos' },
  { img: profTO, label: 'Terapeutas ocupacionales' },
  { img: profGeriatria, label: 'Médicos geriatras' },
  { img: profFono, label: 'Fonoaudiólogos' },
]

const USE_CASES = [
  {
    icon: Brain,
    title: 'Deterioro cognitivo leve',
    description: 'Ejercicios graduales para mantener y estimular las funciones preservadas.',
  },
  {
    icon: HeartPulse,
    title: 'Alzheimer y demencias',
    description: 'Material adaptado a distintos niveles de avance de la enfermedad.',
  },
  {
    icon: Activity,
    title: 'ACV y daño cerebral',
    description: 'Actividades para la rehabilitación de funciones afectadas.',
  },
  {
    icon: Sparkles,
    title: 'Enfermedad de Parkinson',
    description: 'Estimulación cognitiva y motora complementaria.',
  },
  {
    icon: ShieldCheck,
    title: 'Envejecimiento saludable',
    description: 'Prevención y mantenimiento cognitivo en adultos mayores.',
  },
  {
    icon: Home,
    title: 'Rehabilitación en el hogar',
    description: 'Continuidad del tratamiento entre sesiones presenciales.',
  },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureCheck({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-tiam-blue" />
      <span className="text-sm text-slate-600">{text}</span>
    </li>
  )
}

function SectionEyebrow({ text, accent = 'blue' }: { text: string; accent?: 'blue' | 'orange' }) {
  // Orange text on white fails WCAG AA at small sizes; keep the orange chip
  // identity (bg + border) but use navy text for readability.
  const cls = accent === 'orange'
    ? 'border-tiam-orange/30 bg-tiam-orange/10 text-tiam-navy'
    : 'border-tiam-blue/20 bg-tiam-blue/5 text-tiam-blue'
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 mb-4 ${cls}`}>
      <span className="text-xs font-semibold uppercase tracking-wide">{text}</span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const primaryCta = user
    ? { label: 'Ir a la biblioteca', href: '/library' }
    : { label: 'Armá tu primera sesión gratis', href: '/register' }

  function handlePricingCta(planId: string) {
    if (planId === 'inst') {
      return
    }
    navigate(user ? '/subscription' : '/register')
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
            src={heroBanner}
            alt="Profesional de la salud acompañando a una adulta mayor mientras completan juntas una ficha de estimulación cognitiva de TIAM"
            className="absolute inset-0 h-full w-full object-cover object-[right_30%]"
            fetchPriority="high"
          />
          {/* Readability wash — white from the left so the text reads over the wall */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/30 sm:via-white/80 sm:to-transparent lg:from-white/95 lg:via-white/65"
          />

          {/* Text over the image (left side) */}
          <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="max-w-xl text-left">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 backdrop-blur px-4 py-1.5 mb-6">
                <span className="h-2 w-2 rounded-full bg-tiam-blue" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Estimulación cognitiva profesional
                </span>
              </div>

              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-slate-900 leading-tight tracking-tight"
              >
                La estimulación cognitiva que te{' '}
                <span className="text-tiam-blue">
                  devuelve 2 horas por semana.
                </span>
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-slate-700 max-w-xl">
                Encontrá ejercicios por área cognitiva, armá la sesión en minutos y seguí la evolución de tus pacientes adultos mayores.{' '}
                <strong className="font-semibold text-slate-900">Dejá de saltar entre PDFs sueltos.</strong>
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-start">
                <Link to={primaryCta.href}>
                  <Button size="lg" className="w-full sm:w-auto min-h-[44px]">
                    {primaryCta.label}
                  </Button>
                </Link>
                <Link to="/demo">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto min-h-[44px]">
                    Ver el recorrido
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Trust signals */}
              <div className="mt-8 flex flex-wrap items-center gap-2 justify-start">
                {[
                  { icon: ShieldCheck, text: 'Sin tarjeta requerida' },
                  { icon: Check, text: '7 días de acceso completo' },
                  { icon: TrendingUp, text: 'Cancelás cuando quieras' },
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

        {/* ── 3. Stats band ────────────────────────────────────────────────── */}
        <section
          aria-label="En números"
          className="relative py-12 bg-slate-50 overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              opacity: 0.5,
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map(({ value, label }, i) => (
                <div
                  key={label}
                  className="flex flex-col items-center text-center p-5 rounded-2xl bg-white shadow-sm border border-slate-100 border-t-2 border-t-tiam-blue"
                >
                  <dt className={`text-4xl font-extrabold tracking-tight ${i === 2 ? 'text-tiam-blue-dark' : 'text-tiam-blue'}`}>{value}</dt>
                  <dd className="mt-1 text-sm text-slate-500 font-medium">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── 4. Family bridge — for non-professional visitors ─────────────── */}
        <section aria-labelledby="familias-heading" className="py-12 md:py-16 bg-gradient-to-br from-tiam-orange/5 to-white border-y border-tiam-orange/10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 rounded-3xl bg-white border border-slate-100 shadow-sm p-6 sm:p-8">
              <img
                src={desafioAbuelo}
                alt="Un adulto mayor sonríe mientras recibe un ejercicio por WhatsApp en su celular"
                className="h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-2xl object-cover"
              />
              <div className="flex-1 text-center sm:text-left">
                <SectionEyebrow text="Para familias" accent="orange" />
                <h2 id="familias-heading" className="text-xl sm:text-2xl font-bold text-slate-900">
                  ¿Buscás algo para tu familia, no para tu consultorio?
                </h2>
                <p className="mt-2 text-slate-600 max-w-lg">
                  Conocé el Desafío 30 días: un ejercicio cognitivo por día que le llega a tu ser querido directo por WhatsApp. Pago único, sin suscripción.
                </p>
              </div>
              <Link to="/desafio-30-dias" className="w-full shrink-0 sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto min-h-[44px] bg-tiam-orange text-white hover:bg-tiam-orange/90 focus:ring-tiam-orange">
                  Conocer el desafío
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 5. Benefits ──────────────────────────────────────────────────── */}
        <section aria-labelledby="benefits-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Funcionalidades" />
              <h2 id="benefits-heading" className="text-3xl font-bold text-slate-900">
                Todo lo que necesitás para tus sesiones
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Diseñado para que dediqués tu tiempo a tus pacientes, no a buscar material.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {BENEFITS.map(({ icon: Icon, title, description, stripClass, iconClass }, i) => (
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

            {/* Upcoming feature — WhatsApp / at-home (in development) */}
            <div className="mt-6 rounded-3xl border border-dashed border-tiam-blue/30 bg-tiam-blue/5 p-6 sm:flex sm:items-center sm:gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-tiam-blue shadow-sm">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="mt-4 sm:mt-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900">
                    Enviá ejercicios por WhatsApp para practicar en casa
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Próximamente
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Tu paciente va a recibir un enlace por WhatsApp y va a hacer juegos interactivos
                  desde el celular, entre sesión y sesión. Lo estamos desarrollando.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. How it works ──────────────────────────────────────────────── */}
        <section
          id="como-funciona"
          aria-labelledby="how-heading"
          className="relative py-16 md:py-24 bg-slate-50 overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #e2e8f0 1.5px, transparent 1.5px)',
              backgroundSize: '32px 32px',
              opacity: 0.5,
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Proceso" />
              <h2 id="how-heading" className="text-3xl font-bold text-slate-900">
                Cómo funciona
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Tres pasos. Sin curva de aprendizaje.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connector line on desktop */}
              <div
                aria-hidden="true"
                className="hidden md:block absolute top-10 left-[calc(16.666%+2rem)] right-[calc(16.666%+2rem)] h-0.5 bg-tiam-blue/20"
              />
              {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }, i) => (
                <div key={step} className="flex flex-col items-center text-center">
                  <div className="relative z-10 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-tiam-blue to-tiam-blue-dark text-white shadow-lg shadow-tiam-blue/20">
                    <Icon className="h-8 w-8" />
                    <span className={`absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow border border-slate-100 text-[10px] font-black ${i === 1 ? 'text-tiam-orange' : 'text-tiam-blue'}`}>
                      {step}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">{title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed max-w-xs">{description}</p>
                </div>
              ))}
            </div>

            {/* Link to the deeper guided tour */}
            <div className="mt-12 text-center">
              <Link
                to="/demo"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-tiam-blue hover:underline"
              >
                ¿Querés ver cómo se ve por dentro? Ver el recorrido
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── 7. Who it's for ──────────────────────────────────────────────── */}
        <section aria-labelledby="usecases-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Para quién es" accent="orange" />
              <h2 id="usecases-heading" className="text-3xl font-bold text-slate-900">
                Pensado para tu práctica clínica
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                TIAM acompaña a los profesionales que trabajan la cognición de adultos mayores, sea cual sea su disciplina.
              </p>
            </div>

            {/* Professional types */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-14">
              {PROFESSIONALS.map((p) => (
                <figure key={p.label} className="text-center">
                  <img
                    src={p.img}
                    alt={p.label}
                    loading="lazy"
                    className="aspect-square w-full rounded-2xl object-cover shadow-sm"
                  />
                  <figcaption className="mt-3 text-sm font-semibold text-slate-900">{p.label}</figcaption>
                </figure>
              ))}
            </div>

            {/* Contexts sub-heading */}
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">
              Y en una amplia variedad de contextos y diagnósticos
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {USE_CASES.map(({ icon: Icon, title, description }, i) => {
                const isOrange = i % 2 === 1
                return (
                  <article
                    key={title}
                    className="rounded-2xl bg-white border border-slate-100 p-6 flex gap-4 items-start shadow-sm hover:shadow-md hover:border-tiam-blue/20 transition-[box-shadow,border-color] duration-200"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOrange ? 'bg-tiam-orange/10 text-tiam-orange' : 'bg-tiam-blue/10 text-tiam-blue'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm mb-1">{title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── 8. Cognitive areas ───────────────────────────────────────────── */}
        <section aria-labelledby="areas-heading" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Cobertura clínica" />
              <h2 id="areas-heading" className="text-3xl font-bold text-slate-900">
                Cubrí todas las áreas cognitivas
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Ejercicios curados para las 8 áreas clave de la estimulación cognitiva en adultos mayores.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {COGNITIVE_AREAS.map((area) => {
                const Icon = AREA_ICONS[area.slug] ?? Brain
                const s = AREA_STYLES[area.slug] ?? AREA_STYLES['memoria']
                return (
                  <div
                    key={area.id}
                    className="rounded-2xl border p-5 flex flex-col items-center gap-3 cursor-default"
                    style={s.card}
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ ...s.icon, color: s.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="font-semibold text-sm text-slate-800 text-center leading-tight">{area.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── 9. Testimonial ───────────────────────────────────────────────── */}
        <section aria-label="Testimonio" className="py-16 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <figure className="relative rounded-3xl bg-gradient-to-br from-tiam-blue/5 to-white border border-tiam-blue/20 p-8 md:p-12 text-center shadow-md shadow-tiam-blue/10 overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute top-4 left-6 text-8xl leading-none font-black text-tiam-orange/20 select-none"
              >
                "
              </div>
              <blockquote className="relative">
                <p className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed italic">
                  "Perdía 2-3 horas por semana buscando material. Ahora lo tengo todo en un solo lugar y mis pacientes notan la diferencia."
                </p>
              </blockquote>
              <figcaption className="mt-6 flex items-center justify-center gap-3">
                <img src={claudiaImg} alt="Claudia Romero" className="h-10 w-10 rounded-full object-cover object-top shrink-0" />
                <span className="text-sm text-slate-500 font-medium">
                  Claudia Romero, especialista en estimulación cognitiva, La Plata
                </span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── 10. Pricing ──────────────────────────────────────────────────── */}
        <section
          id="planes"
          aria-labelledby="pricing-heading"
          className="py-16 md:py-24 bg-slate-50"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <SectionEyebrow text="Planes" />
              <h2 id="pricing-heading" className="text-3xl font-bold text-slate-900">
                Empezá gratis, crecé cuando quieras
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Empezá gratis 7 días sin tarjeta. Después elegís el plan que mejor se adapte a tu práctica.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl bg-white overflow-hidden transition-[box-shadow,border-color] duration-200 ${
                    plan.featured
                      ? 'border-2 border-tiam-blue shadow-2xl shadow-tiam-blue/15 bg-gradient-to-b from-tiam-blue/5 to-white'
                      : 'border border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Top accent stripe */}
                  <div className={`h-1.5 w-full ${plan.featured ? 'bg-tiam-blue' : 'bg-slate-100'}`} />

                  {plan.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-block bg-tiam-blue text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col flex-1 p-6">
                    <div className="mb-5">
                      <p className={`text-xs font-bold uppercase tracking-wider ${plan.featured ? 'text-tiam-blue' : 'text-slate-500'}`}>
                        {plan.label}
                      </p>
                      <p className="mt-4 text-4xl font-extrabold text-slate-900">{plan.price}</p>
                      <p className="mt-1 text-sm text-slate-500">{plan.priceSub}</p>
                      {plan.roiNote && (
                        <p className="mt-3 rounded-lg bg-tiam-blue/5 px-3 py-2 text-sm font-medium text-tiam-blue">
                          {plan.roiNote}
                        </p>
                      )}
                    </div>

                    <ul className="mb-6 flex flex-1 flex-col gap-3">
                      {plan.features.map((f) => (
                        <FeatureCheck key={f} text={f} />
                      ))}
                    </ul>

                    <Button
                      variant={plan.ctaVariant}
                      className="w-full min-h-[44px]"
                      onClick={() => handlePricingCta(plan.id)}
                    >
                      {plan.ctaLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-slate-400">
              Los pagos se procesan de forma segura con Mercado Pago. Podés cancelar cuando quieras.
            </p>
          </div>
        </section>

        {/* ── 11. Final CTA band ───────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-band-heading"
          className="relative overflow-hidden bg-gradient-to-br from-tiam-blue to-tiam-blue-dark py-20 md:py-28"
        >
          {/* Very subtle white blobs — barely visible */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            {/* Large logo */}
            <div className="flex justify-center mb-8">
              <img
                src={logoGrande}
                alt=""
                aria-hidden="true"
                className="h-24 w-auto object-contain opacity-90"
                loading="lazy"
              />
            </div>

            <h2 id="cta-band-heading" className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Empezá a ahorrar horas esta semana.
            </h2>
            <p className="mt-5 text-white/80 text-lg max-w-xl mx-auto">
              Más tiempo con tus pacientes, menos tiempo buscando material.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={primaryCta.href}>
                <Button
                  size="lg"
                  className="bg-white text-tiam-blue hover:bg-slate-50 min-h-[44px] px-8 font-semibold shadow-lg"
                >
                  {primaryCta.label}
                </Button>
              </Link>
              <a href="#planes">
                <Button
                  size="lg"
                  className="bg-white/10 text-white border border-white/30 hover:bg-white/20 min-h-[44px] px-8 font-semibold"
                >
                  Ver planes
                </Button>
              </a>
            </div>

            {/* Mini stats */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
              {[
                { label: 'Sin tarjeta requerida', dot: 'bg-white/60' },
                { label: '7 días gratis', dot: 'bg-tiam-orange/80' },
                { label: 'Cancelás cuando quieras', dot: 'bg-white/60' },
              ].map(({ label, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="text-sm text-white/80">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer (shared) ──────────────────────────────────────────────────── */}
      <PublicFooter />
    </div>
  )
}
