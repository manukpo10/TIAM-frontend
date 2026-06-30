import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'
import faqIllustration from '@/assets/faq.webp'

// ─── Educational, clinical FAQ — distinct from the commercial FAQ on the landing.
// Aimed at families and professionals researching cognitive stimulation. ──────────

interface QA {
  question: string
  answer: React.ReactNode
}

const FAQ: QA[] = [
  {
    question: '¿Qué es la estimulación cognitiva?',
    answer: (
      <>
        Es un conjunto de técnicas y actividades orientadas a mantener y potenciar las capacidades
        mentales —memoria, atención, lenguaje, razonamiento, orientación— a través de la
        neuroplasticidad: la capacidad del cerebro de fortalecer sus conexiones cuando se lo
        ejercita. Lo desarrollamos en detalle en{' '}
        <Link to="/blog/que-es-la-estimulacion-cognitiva" className="font-medium text-primary hover:underline">
          este artículo del blog
        </Link>.
      </>
    ),
  },
  {
    question: '¿Para qué sirve? ¿Qué beneficios tiene?',
    answer: (
      <>
        Trabaja sobre las capacidades que están preservadas para sostenerlas, retrasar el deterioro
        y mejorar la autonomía en la vida diaria. En personas con deterioro cognitivo o demencia, el
        objetivo es <strong>enlentecer el avance</strong> y alargar la calidad de vida, no curar. En
        personas sanas, ayuda a prevenir o ralentizar el declive propio del envejecimiento.
      </>
    ),
  },
  {
    question: '¿Es solo para personas con demencia o Alzheimer?',
    answer: (
      <>
        No. Se benefician un espectro amplio de personas: adultos mayores sin deterioro que quieren
        prevenir, personas con deterioro cognitivo leve, personas con demencia leve o moderada, y
        personas en recuperación de un daño cerebral adquirido (ACV, traumatismo). La clave no es el
        diagnóstico, sino partir de una valoración que indique qué trabajar y con qué nivel.
      </>
    ),
  },
  {
    question: '¿Es lo mismo que la rehabilitación cognitiva?',
    answer: (
      <>
        Son conceptos relacionados pero no idénticos. La <strong>estimulación</strong> busca
        mantener y potenciar capacidades de forma general. La <strong>rehabilitación</strong> apunta
        a recuperar o compensar funciones específicas afectadas tras una lesión. En la práctica
        suelen combinarse, y muchas actividades sirven para ambos objetivos.
      </>
    ),
  },
  {
    question: '¿Qué áreas cognitivas se trabajan?',
    answer: (
      <>
        Una intervención completa abarca ocho áreas: memoria, atención, fluencia verbal, orientación
        espacial, funciones ejecutivas, praxias (movimientos voluntarios), gnosias (reconocimiento
        sensorial) y estimulación sensorial. Cada una tiene sus propios ejercicios. Hablamos de dos
        de las menos conocidas en{' '}
        <Link to="/blog/praxias-y-gnosias-las-grandes-olvidadas" className="font-medium text-primary hover:underline">
          este artículo
        </Link>.
      </>
    ),
  },
  {
    question: '¿La estimulación cognitiva cura la demencia o el Alzheimer?',
    answer: (
      <>
        No. La demencia y el Alzheimer son procesos neurodegenerativos que hoy no tienen cura. Lo que
        la estimulación cognitiva puede hacer es <strong>enlentecer el deterioro</strong> y mejorar
        la calidad de vida y la autonomía mientras sea posible. Es una herramienta valiosa, pero no
        un tratamiento curativo.
      </>
    ),
  },
  {
    question: '¿Cada cuánto y por cuánto tiempo hay que hacerla?',
    answer: (
      <>
        El beneficio aparece con la <strong>práctica regular y sostenida</strong>, no con sesiones
        aisladas. La frecuencia y duración se ajustan a cada persona, pero la constancia en el tiempo
        es lo que marca la diferencia. Lo que se ejercita se mantiene; lo que no se ejercita, se
        pierde.
      </>
    ),
  },
  {
    question: '¿Se puede hacer en casa o necesita un profesional?',
    answer: (
      <>
        Idealmente, ambas cosas. El profesional aporta la valoración, el criterio y el seguimiento;
        la familia sostiene la práctica en lo cotidiano. Muchas actividades pueden realizarse en
        casa con acompañamiento. Dejamos pautas concretas para familias en{' '}
        <Link to="/blog/el-rol-de-la-familia-en-casa" className="font-medium text-primary hover:underline">
          este artículo
        </Link>.
      </>
    ),
  },
  {
    question: '¿A qué edad conviene empezar?',
    answer: (
      <>
        No hay una edad única. La estimulación cognitiva tiene sentido como prevención mucho antes de
        que aparezca cualquier dificultad, y es especialmente valiosa ante las primeras señales de
        deterioro, cuando la intervención temprana es más efectiva.
      </>
    ),
  },
  {
    question: '¿Cómo sé si yo o un familiar deberíamos consultar?',
    answer: (
      <>
        Si notás olvidos que interfieren con la vida diaria, desorientación, dificultad con tareas
        conocidas o repetición de preguntas de forma sostenida, vale la pena consultar. Podés empezar
        por nuestra{' '}
        <Link to="/autoevaluacion" className="font-medium text-primary hover:underline">
          autoevaluación orientativa
        </Link>
        : son 8 preguntas rápidas. <strong>No es un diagnóstico</strong> —solo un profesional puede
        darlo— pero ayuda a decidir si conviene consultar.
      </>
    ),
  },
]

// Commercial questions about the service (moved from the landing).
const FAQ_SERVICIO: QA[] = [
  {
    question: '¿Necesito tarjeta de crédito para la prueba gratuita?',
    answer: 'No. Probás TIAM 7 días sin tarjeta y sin compromiso. Solo creás tu cuenta y empezás.',
  },
  {
    question: '¿Puedo cancelar cuando quiera?',
    answer: 'Sí, cancelás cuando quieras desde tu cuenta, sin penalidades ni trámites complicados.',
  },
  {
    question: '¿Los ejercicios se imprimen?',
    answer: 'Sí. Generás fichas A4 listas para imprimir en segundos y trabajar en la sesión presencial.',
  },
  {
    question: '¿Puedo subir mis propios ejercicios?',
    answer: 'Sí. Además de la biblioteca de TIAM, podés crear y guardar tus propios ejercicios, visibles solo para vos.',
  },
  {
    question: '¿Sirve para distintas patologías?',
    answer: 'Sí. Los ejercicios están clasificados por área cognitiva y nivel de dificultad, para adaptarse a cada paciente y diagnóstico.',
  },
  {
    question: '¿Cómo accede el paciente a los ejercicios en casa?',
    answer: 'Próximamente vas a poder enviarle ejercicios para que los haga desde casa con un enlace simple. Por ahora podés imprimirlos o mostrarlos en pantalla durante la sesión.',
  },
  {
    question: '¿Mis datos y los de mis pacientes están protegidos?',
    answer: 'Sí. La privacidad de la información clínica es una prioridad. Tus datos y los de tus pacientes están resguardados y no se comparten con terceros.',
  },
]

function FaqAccordionItem({ item }: { item: QA }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-tiam-blue/20 transition-[box-shadow,border-color] duration-200">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-base font-semibold text-slate-900 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 rounded-xl"
      >
        <span>{item.question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-tiam-blue transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div hidden={!open} className="border-t border-slate-100 px-5 pt-4 pb-5 text-[17px] leading-relaxed text-slate-600 max-w-2xl">
        {item.answer}
      </div>
    </div>
  )
}

export function ClinicalFaqPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Preguntas frecuentes sobre estimulación cognitiva — TIAM Digital'
  }, [])

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Intro */}
        <section className="border-b border-slate-100 bg-gradient-to-br from-tiam-blue/5 to-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 md:py-20">
            <img
              src={faqIllustration}
              alt=""
              className="mb-6 w-full rounded-2xl border border-slate-100"
            />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              Preguntas frecuentes sobre estimulación cognitiva
            </h1>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Respuestas claras para familias y profesionales que quieren entender qué es la
              estimulación cognitiva, para qué sirve y en quién tiene sentido.
            </p>
          </div>
        </section>

        {/* Accordion */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Sobre la estimulación cognitiva
          </h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <FaqAccordionItem key={item.question} item={item} />
            ))}
          </div>

          <h2 className="mt-12 text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Sobre TIAM
          </h2>
          <div className="space-y-3">
            {FAQ_SERVICIO.map((item) => (
              <FaqAccordionItem key={item.question} item={item} />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 rounded-2xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
            <p className="font-semibold text-slate-900">¿Tenés dudas sobre tu memoria o la de un ser querido?</p>
            <p className="mt-1 text-slate-600">
              Hacé nuestra autoevaluación orientativa: son 8 preguntas y te lleva menos de 2 minutos.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/autoevaluacion">
                <Button size="md">Hacer la autoevaluación</Button>
              </Link>
              <Link to="/blog">
                <Button variant="secondary" size="md">Leer el blog</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
