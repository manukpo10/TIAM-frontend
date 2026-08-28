import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Clock, ShieldCheck, MapPin, Sparkles, X } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import nosotrosHero from '@/assets/nosotros-hero.jpg'
import tallerFoto1 from '@/assets/taller/taller-1.jpg'
import tallerFoto2 from '@/assets/taller/taller-2.jpg'
import tallerFoto3 from '@/assets/taller/taller-3.jpg'
import tallerFoto4 from '@/assets/taller/taller-4.jpg'
import tallerFoto5 from '@/assets/taller/taller-5.jpg'
import tallerFoto6 from '@/assets/taller/taller-6.jpg'

// Fotos reales del Taller Interactivo para Adultos Mayores en La Plata — el
// espacio presencial que la sección de arriba narra. Distinct alt text per
// photo on purpose (not a repeated generic caption) since they show genuinely
// different moments/exercises.
const TALLER_PHOTOS = [
  { src: tallerFoto1, alt: 'Dos personas completan ejercicios de estimulación cognitiva en cuadernos, con café y galletitas sobre la mesa' },
  { src: tallerFoto2, alt: 'Cuatro participantes del taller resuelven ejercicios en cuadernos alrededor de una mesa compartida' },
  { src: tallerFoto3, alt: 'Seis personas escriben en cuadernos durante un encuentro del taller, con una consigna de lenguaje anotada en el pizarrón de fondo' },
  { src: tallerFoto4, alt: 'Participantes del taller completan fichas de estimulación cognitiva sentados a la mesa' },
  { src: tallerFoto5, alt: 'Grupo de participantes trabaja con tableros de fichas de colores para armar secuencias, en el espacio del taller en La Plata' },
  { src: tallerFoto6, alt: 'Grupo de participantes resuelve un ejercicio de secuencia numérica anotado en el pizarrón, durante un encuentro del taller' },
]

/** Full-size view of one taller photo — same modal pattern (backdrop,
 * role="dialog", Escape/backdrop-click to close, body scroll lock) as
 * CheckoutModal on Desafio30DiasPage and the day-card modal on
 * DesafioPlayPage. */
function PhotoLightbox({ photo, onClose }: { photo: { src: string; alt: string }; onClose: () => void }) {
  useBodyScrollLock(true)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={photo.src}
        alt={photo.alt}
        className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

const VALUES = [
  {
    icon: Clock,
    title: 'Tu tiempo es clínico',
    description:
      'Cada hora que un profesional pierde buscando o armando material es una hora que no está con su paciente. TIAM existe para devolver ese tiempo.',
  },
  {
    icon: Sparkles,
    title: 'Curaduría, no cantidad',
    description:
      'No medimos el valor en miles de ejercicios sueltos. Preferimos material curado por área cognitiva, listo para usar con adultos mayores.',
  },
  {
    icon: MapPin,
    title: 'Pensado en Argentina',
    description:
      'Hecho para el contexto local: lenguaje cercano, precios en pesos y pago con Mercado Pago, sin tarjetas internacionales de por medio.',
  },
  {
    icon: ShieldCheck,
    title: 'Los datos de tus pacientes importan',
    description:
      'Tratamos la información clínica con el cuidado que merece. Podés revisar cómo la protegemos en nuestra Política de Privacidad.',
  },
]

export function AboutPage() {
  const [lightboxPhoto, setLightboxPhoto] = useState<(typeof TALLER_PHOTOS)[number] | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Sobre TIAM — Estimulación cognitiva profesional en Argentina'
  }, [])

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-slate-50 py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-tiam-blue/20 bg-tiam-blue/5 px-4 py-1.5 mb-6">
                  <Heart className="h-3.5 w-3.5 text-tiam-blue" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-tiam-blue">
                    Sobre nosotros
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
                  Le devolvemos horas a quienes cuidan la cognición de los adultos mayores.
                </h1>
                <p className="mt-6 text-lg text-slate-700 leading-relaxed">
                  TIAM Digital nació en un lugar concreto: el Taller Interactivo para Adultos Mayores,
                  un espacio presencial de estimulación cognitiva que funciona en La Plata desde 2024.
                  Lo que empezó como material hecho a mano para acompañar a adultos mayores se convirtió
                  en la herramienta que hoy ponemos en manos de otros profesionales.
                </p>
              </div>
              <img
                src={nosotrosHero}
                alt="Una profesional de la salud acompaña a un adulto mayor mientras completan juntos una ficha de estimulación cognitiva, junto a una ventana con luz natural"
                className="w-full rounded-2xl shadow-sm"
                width={1024}
                height={572}
                fetchPriority="high"
              />
            </div>
          </div>
        </section>

        {/* Mission / why */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-5">
              Por qué existe TIAM
            </h2>
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                Todo arrancó en un taller real. Desde principios de 2024, una terapeuta ocupacional
                coordina encuentros de estimulación cognitiva para adultos mayores en La Plata: trabajo
                de memoria, atención, funciones ejecutivas y, sobre todo, integración social.
              </p>
              <p>
                Cada encuentro exigía horas previas de preparación: buscar ejercicios, adaptarlos,
                imprimirlos y registrar a mano qué se trabajó con cada persona. Ese trabajo invisible
                era el que más tiempo se llevaba — y el que menos se notaba.
              </p>
              <p>
                Así nació TIAM Digital: para reunir todo en un solo lugar. Una biblioteca curada por
                área cognitiva, fichas A4 listas para imprimir, armado de sesiones en minutos y
                seguimiento de la evolución de cada paciente. La herramienta que el taller necesitaba,
                ahora al alcance de cualquier profesional.
              </p>
              <p>
                La construimos en Argentina, para el contexto argentino: con lenguaje cercano, foco en
                adultos mayores y un modelo de precios en pesos que no depende del dólar.
              </p>
            </div>
          </div>
        </section>

        {/* Fotos del taller — bg-white on purpose: reads as a continuation of
            the origin-story section right above (also bg-white) rather than
            a new beat, since these photos ARE that story, not a new topic.
            Values right after provides the actual section break (bg-slate-50). */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Así es el taller
              </h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Encuentros reales, semana a semana, en La Plata.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {TALLER_PHOTOS.map((photo) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => setLightboxPhoto(photo)}
                  className="group relative overflow-hidden rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-tiam-blue/50"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                En qué creemos
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {VALUES.map(({ icon: Icon, title, description }, i) => {
                const isOrange = i % 2 === 1
                return (
                  <article
                    key={title}
                    className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex gap-4 items-start"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        isOrange ? 'bg-tiam-orange/10 text-tiam-orange' : 'bg-tiam-blue/10 text-tiam-blue'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              Probá TIAM con tus pacientes
            </h2>
            <p className="mt-4 text-slate-600">
              7 días gratis, sin tarjeta. Armá tu primera sesión y comprobá cuánto tiempo recuperás.
            </p>
            <div className="mt-8">
              <Link to="/register">
                <Button size="lg" className="min-h-[44px] px-8">
                  Armá tu primera sesión gratis
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      {lightboxPhoto && <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </div>
  )
}
