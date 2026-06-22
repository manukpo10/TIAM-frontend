import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Clock, ShieldCheck, MapPin, Sparkles } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'

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
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
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
              TIAM nació de una frustración concreta: los profesionales que trabajan la estimulación
              cognitiva pierden horas cada semana buscando material entre PDFs sueltos, fotocopias y
              carpetas. Creímos que ese tiempo tenía que volver a donde importa — al paciente.
            </p>
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
                La estimulación cognitiva es un trabajo profundamente humano, pero gran parte del día
                se va en tareas que no lo son: buscar ejercicios, adaptarlos, imprimirlos, registrar a
                mano qué se trabajó y qué hay que ajustar para la próxima sesión.
              </p>
              <p>
                Reunimos todo eso en un solo lugar. Una biblioteca curada por área cognitiva, fichas
                A4 listas para imprimir, armado de sesiones en minutos y seguimiento de la evolución de
                cada paciente. Para que el profesional dedique su energía a lo que sabe hacer, no a la
                logística.
              </p>
              <p>
                Lo construimos en Argentina, para el contexto argentino: con lenguaje cercano, foco en
                adultos mayores y un modelo de precios en pesos que no depende del dólar.
              </p>
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
    </div>
  )
}
