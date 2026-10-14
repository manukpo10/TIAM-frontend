import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Gift, Printer } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { SectionEyebrow } from '@/components/ui/SectionEyebrow'
import { cn } from '@/lib/utils'
import materialMesa from '@/assets/material-digital/material-mesa.webp'
import edicionFamilias from '@/assets/material-digital/edicion-familias.webp'
import edicionProfesionales from '@/assets/material-digital/edicion-profesionales.webp'

/**
 * "Material digital" — the library of TIAM's printable products: one card per
 * product with its picture, description and price, and a link to the product's
 * own landing page (the landings are built elsewhere; this page is only the shelf).
 *
 * To add a product, add an entry to PRODUCTS. A product without a `landing` has no
 * page to send people to yet, so its card shows "Próximamente" instead of a link.
 *
 * The pictures are TIAM's flat illustrations on purpose (the site's look); the real
 * covers and pages of each product live on its landing.
 */

// ── data:start ──
interface Product {
  id: string
  /** Who it is for, shown over the picture. */
  audience: string
  name: string
  description: string
  /** Short lines under the description. */
  highlights: string[]
  image: string
  alt: string
  /** Final price in Argentine pesos. */
  price: number
  /** What the price covers, under it. */
  priceNote: string
  /**
   * The product's landing: a path served outside this app (a full page load, so it is
   * rendered with <a>, not <Link>) or a full URL. Absent = not ready yet.
   */
  landing?: string
  cta: string
}

// The Pack's landings are online as a PREVIEW (the owner published them before billing exists, and
// they show "Vista previa: datos provisorios"). The price here is the same provisional one they carry
// ($14.990, "pago único"), so the shelf says so too while PREVIEW is true. Both live in two places:
// when the prices are final, change them here AND in the landings' build config (VITE_PACK_PRICE, and
// VITE_PACK_PREVIEW for the ribbon), and set PREVIEW to false. The landing paths are final
// (tiamdigital.com/pack/familias and /pack/profesionales, confirmed by the owner on 2026-10-13):
// static pages served outside this app.
const PREVIEW = true

const PRODUCTS: Product[] = [
  {
    id: 'pack-basico-familias',
    audience: 'Para familias',
    name: 'Pack Básico para familias',
    description:
      '120 fichas listas para imprimir, con letra grande, una guía paso a paso y las respuestas. Elegís una, la imprimís y se sientan juntos.',
    highlights: [
      '4 áreas (Memoria, Atención, Lenguaje y Cálculo) en 3 niveles',
      'Guía para acompañar y registro «Cómo nos fue hoy»',
      'PDF para imprimir en casa',
    ],
    image: edicionFamilias,
    alt: 'Ilustración de una hija y su mamá sentadas a la mesa de la cocina, que resuelven juntas una ficha impresa con lápiz y té',
    price: 14990,
    priceNote: 'pago único',
    landing: '/pack/familias',
    cta: 'Ver el pack',
  },
  {
    id: 'pack-basico-profesionales',
    audience: 'Para profesionales y talleristas',
    name: 'Pack Básico para profesionales y talleristas',
    description:
      '120 fichas imprimibles en 3 niveles, cada una con su guía, su solucionario y su registro de la sesión. Elegís, imprimís y trabajás, sin improvisar.',
    highlights: [
      '4 áreas (Memoria, Atención, Lenguaje y Cálculo) en 3 niveles',
      'Guía para el profesional y registro de la sesión',
      'PDF para imprimir',
    ],
    image: edicionProfesionales,
    alt: 'Ilustración de una tallerista que reparte fichas impresas a tres personas mayores sentadas a una mesa, en un salón luminoso',
    price: 14990,
    priceNote: 'pago único',
    landing: '/pack/profesionales',
    cta: 'Ver el pack',
  },
]
// ── data:end ──

function formatPrice(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

const isExternal = (url: string) => /^https?:\/\//.test(url)

function ProductCard({ product }: { product: Product }) {
  const { landing } = product
  const external = landing ? isExternal(landing) : false
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200',
        // A card with no landing is not a link: no hover shadow, like the home's coming-soon card.
        landing && 'transition-shadow duration-200 hover:shadow-xl',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={product.image}
          alt={product.alt}
          width={1152}
          height={864}
          loading="lazy"
          decoding="async"
          className={cn(
            'h-full w-full object-cover',
            landing && 'motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105',
          )}
        />
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue shadow-sm ring-1 ring-slate-200">
          {product.audience}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-bold leading-snug text-slate-900">{product.name}</h3>
        <p className="mt-2 leading-relaxed text-slate-600">{product.description}</p>
        <ul role="list" className="mt-4 space-y-2">
          {product.highlights.map((line) => (
            <li key={line} className="flex items-start gap-2 text-slate-700">
              <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          {/* flex-wrap: in a narrow card (a 320px phone, the 1024px breakpoint, 200% zoom) the price
              and the button don't fit side by side, and overflow-hidden would clip the button. */}
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-4 border-t border-slate-100 pt-5">
            <div>
              <p className="text-3xl font-bold text-slate-900">{formatPrice(product.price)}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-600">{product.priceNote}</p>
            </div>
            {landing ? (
              // The ::after overlay stretches the link across the whole card: one big tap
              // target and a single tab stop.
              <a
                href={landing}
                // Same visible text on every card: the name tells links apart for screen readers
                // and voice control (the label starts with the visible text, WCAG 2.5.3).
                aria-label={`${product.cta}: ${product.name}`}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-semibold text-white transition-colors after:absolute after:inset-0 hover:bg-primary-hover focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {product.cta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <p className="inline-flex min-h-[48px] shrink-0 items-center rounded-xl bg-slate-50 px-5 py-3 text-base font-semibold text-slate-600">
                Próximamente
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function MaterialDigitalPage() {
  useEffect(() => {
    document.title = 'Material digital para imprimir — TIAM Digital'
    // A shared link such as /material-digital#productos lands on that section ('instant':
    // the site sets `scroll-behavior: smooth`, which would animate the whole page past).
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null
    if (target) target.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo(0, 0)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PublicHeader />

      <main className="flex-1">
        {PREVIEW && (
          <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
            Vista previa: datos provisorios
          </div>
        )}

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-clip bg-gradient-to-br from-tiam-blue/[0.07] via-slate-50 to-white pb-20 pt-12 md:pb-24 md:pt-16"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-tiam-orange/15 blur-3xl" />
            <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-tiam-blue/10 blur-3xl" />
            <div className="absolute bottom-0 right-1/3 h-64 w-64 rounded-full bg-tiam-green/10 blur-3xl" />
          </div>

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
            <div className="text-left">
              <span
                data-enter="1"
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 backdrop-blur"
              >
                <Printer className="h-3.5 w-3.5 text-tiam-blue" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Material digital</span>
              </span>
              <h1
                id="hero-heading"
                data-enter="2"
                className="text-balance text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-[2.5rem] xl:text-5xl"
              >
                Fichas para imprimir y <span className="text-tiam-blue">mantener activa la mente.</span>
              </h1>
              <p data-enter="3" className="mt-6 max-w-xl text-lg leading-relaxed text-slate-700 sm:text-xl">
                Material de estimulación cognitiva en PDF, con una guía paso a paso y las respuestas. Elegí el que
                necesitás y entrá a su página para ver todo el detalle.
              </p>
              <a
                href="#productos"
                data-enter="4"
                className="mt-8 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent-hover px-6 py-3 text-base font-semibold text-white transition-[color,background-color,scale] hover:bg-orange-800 motion-safe:active:scale-[0.98] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-orange focus-visible:ring-offset-2"
              >
                Ver los productos
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <img
                src={materialMesa}
                alt="Ilustración de una mesa con cuatro cuadernillos de colores, una hoja impresa con una grilla, lápices, anteojos y una taza de té"
                width={1152}
                height={658}
                fetchPriority="high"
                className="aspect-[1152/658] w-full rounded-3xl object-cover shadow-2xl shadow-tiam-blue/15 ring-1 ring-slate-200"
              />
              {/* Always next to the picture: it says what is being sold. Over the picture from
                  sm up; under it on a phone, where it would cover a third of the illustration. */}
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 sm:absolute sm:bottom-4 sm:left-4 sm:mt-0 sm:bg-white/95">
                <Printer className="h-4 w-4 text-tiam-blue" aria-hidden="true" />
                Productos digitales: PDF para imprimir en casa
              </p>
            </div>
          </div>

          <svg
            aria-hidden="true"
            viewBox="0 0 1440 64"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 block h-8 w-full fill-white sm:h-12 md:h-16"
          >
            <path d="M0 40 C240 72 480 8 720 32 C960 56 1200 12 1440 40 L1440 64 L0 64 Z" />
          </svg>
        </section>

        {/* ── Productos ────────────────────────────────────────────────────── */}
        <section id="productos" aria-labelledby="productos-title" className="scroll-mt-20 bg-white py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow text="La biblioteca" />
              <h2
                id="productos-title"
                className="text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
              >
                Elegí tu material
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                {PRODUCTS.length === 1
                  ? '1 producto, en PDF para imprimir.'
                  : `${PRODUCTS.length} productos, todos en PDF para imprimir.`}
              </p>
            </div>

            {/* Flex + justify-center rather than a grid: with two or three products the row
                stays centred and every card keeps the same width. */}
            <ul role="list" data-stagger className="mt-12 flex flex-wrap justify-center gap-6">
              {PRODUCTS.map((product) => (
                <li key={product.id} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>

            <div className="mx-auto mt-12 flex max-w-xl items-start gap-3 rounded-2xl bg-slate-50 p-5">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
              <p className="text-slate-700">
                ¿Querés probar antes? Descargá 5 fichas gratis de muestra.{' '}
                <Link to="/recursos" className="font-semibold text-tiam-blue underline hover:text-tiam-blue-dark">
                  Ver las fichas gratis
                </Link>
                .
              </p>
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-600">
              Son productos digitales: no se envía nada impreso. Material de estimulación cognitiva: no reemplaza la
              evaluación ni el tratamiento de un profesional de la salud.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
