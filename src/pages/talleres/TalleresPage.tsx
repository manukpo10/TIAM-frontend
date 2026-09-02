import { useEffect, useState } from 'react'
import { Users, Heart, Brain, Puzzle, Lightbulb, X } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import tallerFoto1 from '@/assets/taller/taller-1.jpg'
import tallerFoto2 from '@/assets/taller/taller-2.jpg'
import tallerFoto3 from '@/assets/taller/taller-3.jpg'
import tallerFoto4 from '@/assets/taller/taller-4.jpg'
import tallerFoto5 from '@/assets/taller/taller-5.jpg'
import tallerFoto6 from '@/assets/taller/taller-6.jpg'

// Número real de inscripciones del taller (del flyer impreso), NO el de
// WhatsApp Business que usa el bot del Desafío — este lo atiende una persona.
const TALLER_WHATSAPP = '5492215226725'
const TALLER_INQUIRY_TEXT = '¡Hola! Quiero sacar un turno para el taller presencial de TIAM.'

// Fotos reales del Taller Interactivo para Adultos Mayores en La Plata — el
// espacio presencial que esta página narra. Distinct alt text per photo on
// purpose (not a repeated generic caption) since they show genuinely
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

// Los 4 bullets tal como están en el flyer impreso de inscripciones — copy
// ya probado, no reinventado acá.
const VALUES = [
  { icon: Brain, text: 'Ejercitamos la memoria y la atención' },
  { icon: Puzzle, text: 'Juegos y actividades cognitivas divertidas y desafiantes' },
  { icon: Users, text: 'Compartimos, nos escuchamos y hacemos nuevos amigos' },
  { icon: Lightbulb, text: 'Activamos nuestra mente y mejoramos nuestra calidad de vida' },
]

/** Lucide has no brand glyphs — WhatsApp's own mark, inlined (no new
 * dependency for one icon). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C22 6.45 17.56 2.01 12.04 2zm5.87 14.05c-.25.7-1.45 1.34-2 1.42-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.69-.62-2.97-1.28-4.91-4.28-5.06-4.48-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37.2 0 .4 0 .58.01.18.01.44-.07.68.53.25.6.85 2.07.92 2.22.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.31.4-.45.53-.15.15-.3.31-.13.6.17.3.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.35 1.44.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.68-.15.28.1 1.77.84 2.08.99.31.15.51.23.59.36.08.13.08.75-.17 1.45z" />
    </svg>
  )
}

function WhatsAppCta({ label }: { label: string }) {
  return (
    <a
      href={`https://wa.me/${TALLER_WHATSAPP}?text=${encodeURIComponent(TALLER_INQUIRY_TEXT)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button size="lg" className="min-h-[44px] px-8 bg-[#25D366] text-white hover:bg-[#1ebe5b]">
        <WhatsAppIcon className="h-4 w-4" />
        {label}
      </Button>
    </a>
  )
}

export function TalleresPage() {
  const [lightboxPhoto, setLightboxPhoto] = useState<(typeof TALLER_PHOTOS)[number] | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Talleres presenciales — TIAM Digital'
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
                <div className="inline-flex items-center gap-2 rounded-full border border-tiam-blue/20 bg-tiam-blue/5 px-4 py-1.5 mb-4">
                  <Heart className="h-3.5 w-3.5 text-tiam-blue" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-tiam-blue">
                    Talleres personalizados
                  </span>
                </div>
                <p className="font-semibold text-tiam-orange mb-2">Tu mente activa, tu vida plena.</p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
                  El taller presencial donde nació TIAM.
                </h1>
                <p className="mt-6 text-lg text-slate-700 leading-relaxed">
                  TIAM Digital nació en un lugar concreto: el Taller Interactivo para Adultos Mayores,
                  un espacio presencial de estimulación cognitiva que funciona en La Plata desde 2024.
                  Hoy seguimos coordinando esos mismos encuentros, cara a cara, semana a semana.
                </p>
                <div className="mt-8">
                  <WhatsAppCta label="Sacar turno por WhatsApp" />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                    <Users className="h-3.5 w-3.5 text-tiam-blue" />
                    Para adultos mayores
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                    <Heart className="h-3.5 w-3.5 text-tiam-orange" />
                    Espacio amigable y cálido
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                    <Brain className="h-3.5 w-3.5 text-tiam-green" />
                    Grupo reducido
                  </span>
                </div>
              </div>
              <div className="relative">
                <img
                  src={tallerFoto3}
                  alt="Seis personas escriben en cuadernos durante un encuentro del taller, con una consigna de lenguaje anotada en el pizarrón de fondo"
                  className="w-full rounded-2xl shadow-sm"
                />
                <div className="absolute -bottom-4 -left-4 -rotate-6 rounded-full bg-tiam-orange px-5 py-3 text-center shadow-lg">
                  <p className="text-sm font-bold text-white leading-tight">
                    ¡La pasamos
                    <br />
                    bárbaro!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Origin story */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-5">
              De dónde viene el taller
            </h2>
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                Todo arrancó en un taller real. Desde principios de 2024, una terapeuta ocupacional
                coordina encuentros de estimulación cognitiva para adultos mayores en La Plata: trabajo
                de memoria, atención, funciones ejecutivas y, sobre todo, integración social.
              </p>
              <p>
                Cada semana, un grupo se reúne para ejercitar la mente y, de paso, pasar un buen rato
                juntos. Con el tiempo, ese trabajo también dio origen a la plataforma digital que hoy
                usan otros profesionales — pero el taller presencial sigue siendo el corazón de TIAM.
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

        {/* Values — bullets del flyer */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Un espacio para aprender, compartir y disfrutar
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {VALUES.map(({ icon: Icon, text }, i) => {
                const isOrange = i % 2 === 1
                return (
                  <div key={text} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        isOrange ? 'bg-tiam-orange/10 text-tiam-orange' : 'bg-tiam-blue/10 text-tiam-blue'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-medium text-slate-800 leading-snug">{text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              ¡Te esperamos!
            </h2>
            <p className="mt-4 text-slate-600">
              Sacá tu turno por WhatsApp y te contamos cómo funciona, los horarios y el valor.
            </p>
            <div className="mt-8">
              <WhatsAppCta label="Sacar turno por WhatsApp" />
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />

      {lightboxPhoto && <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </div>
  )
}
