import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ShieldCheck, RotateCcw } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'

/**
 * Orientational cognitive self-assessment. This is an AWARENESS tool, not a
 * diagnostic instrument. Answers never leave the browser — nothing is stored or
 * sent. The result always points toward consulting a professional.
 */

interface Question {
  id: string
  text: string
}

const QUESTIONS: Question[] = [
  { id: 'q1', text: '¿Con qué frecuencia olvidás conversaciones o acontecimientos recientes?' },
  { id: 'q2', text: '¿Repetís preguntas o comentarios sin darte cuenta de que ya los hiciste?' },
  { id: 'q3', text: '¿Te cuesta encontrar la palabra justa al hablar?' },
  { id: 'q4', text: '¿Te desorientás con la fecha, el día de la semana o el lugar donde estás?' },
  { id: 'q5', text: '¿Extraviás objetos cotidianos (llaves, anteojos) más que antes?' },
  { id: 'q6', text: '¿Tenés dificultad para seguir los pasos de una tarea conocida, como una receta o manejar dinero?' },
  { id: 'q7', text: '¿Te cuesta concentrarte para seguir una película, una charla o una lectura?' },
  { id: 'q8', text: '¿Notás que tareas que antes hacías con facilidad ahora te demandan más esfuerzo?' },
]

const ANSWERS = [
  { label: 'Nunca', value: 0 },
  { label: 'A veces', value: 1 },
  { label: 'A menudo', value: 2 },
]

interface ResultBucket {
  min: number
  max: number
  title: string
  tone: 'green' | 'amber' | 'orange'
  message: string
}

const BUCKETS: ResultBucket[] = [
  {
    min: 0,
    max: 4,
    tone: 'green',
    title: 'Pocas señales de alerta',
    message:
      'Tus respuestas no muestran señales destacadas en este momento. Es un buen momento para mantener hábitos saludables: actividad mental, vida social, ejercicio físico y buen descanso. La prevención es la mejor estrategia.',
  },
  {
    min: 5,
    max: 9,
    tone: 'amber',
    title: 'Algunas señales para tener en cuenta',
    message:
      'Aparecen algunas señales que vale la pena observar. No significan que haya un problema, pero podría ser una buena idea conversarlo con un profesional de la salud, sobre todo si notás que se sostienen o aumentan con el tiempo.',
  },
  {
    min: 10,
    max: 16,
    tone: 'orange',
    title: 'Varias señales: te sugerimos consultar',
    message:
      'Tus respuestas reflejan varias señales que conviene evaluar. Te recomendamos consultar con un profesional (neurólogo, neuropsicólogo o tu médico de cabecera) para una valoración adecuada. Detectar a tiempo permite intervenir mejor.',
  },
]

function bucketFor(score: number): ResultBucket {
  return BUCKETS.find((b) => score >= b.min && score <= b.max) ?? BUCKETS[BUCKETS.length - 1]
}

const TONE_STYLES: Record<ResultBucket['tone'], string> = {
  green: 'border-tiam-green/30 bg-tiam-green/10',
  amber: 'border-amber-200 bg-amber-50',
  orange: 'border-tiam-orange/30 bg-tiam-orange/10',
}

export function ScreeningTestPage() {
  const [phase, setPhase] = useState<'intro' | 'questions' | 'result'>('intro')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Autoevaluación cognitiva — TIAM Digital'
  }, [])

  function selectAnswer(value: number) {
    const q = QUESTIONS[current]
    setAnswers((prev) => ({ ...prev, [q.id]: value }))
    if (current < QUESTIONS.length - 1) {
      setCurrent((c) => c + 1)
    } else {
      setPhase('result')
      window.scrollTo(0, 0)
    }
  }

  function restart() {
    setAnswers({})
    setCurrent(0)
    setPhase('intro')
    window.scrollTo(0, 0)
  }

  const score = Object.values(answers).reduce((a, b) => a + b, 0)
  const progress = Math.round((current / QUESTIONS.length) * 100)

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          {/* ── Intro ─────────────────────────────────────────────────────── */}
          {phase === 'intro' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tiam-blue mb-3">
                Autoevaluación
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                Cuestionario orientativo de memoria y cognición
              </h1>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Son 8 preguntas rápidas sobre situaciones de la vida diaria. Al terminar, vas a
                recibir una orientación general. Te lleva menos de 2 minutos.
              </p>

              {/* Medical disclaimer */}
              <div
                role="note"
                className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong className="font-semibold">Importante:</strong> este cuestionario{' '}
                  <strong>no es un diagnóstico</strong> ni reemplaza una consulta profesional. Es
                  solo una herramienta de orientación. Únicamente una evaluación realizada por un
                  profesional de la salud puede determinar un diagnóstico.
                </p>
              </div>

              {/* Privacy note */}
              <div className="mt-3 flex gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  <strong className="font-semibold text-slate-700">Privacidad:</strong> tus
                  respuestas no se guardan ni se envían a ningún lado. Todo el cálculo ocurre en tu
                  dispositivo.
                </p>
              </div>

              <div className="mt-8">
                <Button size="lg" onClick={() => setPhase('questions')}>
                  Empezar el cuestionario
                </Button>
              </div>
            </div>
          )}

          {/* ── Questions ─────────────────────────────────────────────────── */}
          {phase === 'questions' && (
            <div>
              {/* Progress */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Pregunta {current + 1} de {QUESTIONS.length}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-tiam-blue transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <h2 className="text-xl md:text-2xl font-semibold text-slate-900 leading-snug min-h-[3.5rem]">
                {QUESTIONS[current].text}
              </h2>

              <div className="mt-6 flex flex-col gap-3">
                {ANSWERS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => selectAnswer(a.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-left text-slate-700 font-medium transition-colors hover:border-tiam-blue hover:bg-tiam-blue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/30"
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {current > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrent((c) => c - 1)}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-tiam-blue transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Pregunta anterior
                </button>
              )}
            </div>
          )}

          {/* ── Result ────────────────────────────────────────────────────── */}
          {phase === 'result' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tiam-blue mb-3">
                Tu resultado orientativo
              </p>

              {(() => {
                const bucket = bucketFor(score)
                return (
                  <div className={`rounded-2xl border px-6 py-6 ${TONE_STYLES[bucket.tone]}`}>
                    <h1 className="text-2xl font-bold text-slate-900">{bucket.title}</h1>
                    <p className="mt-3 text-slate-700 leading-relaxed">{bucket.message}</p>
                  </div>
                )
              })()}

              {/* Reinforced disclaimer */}
              <div
                role="note"
                className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  Recordá: este resultado es <strong>orientativo</strong> y no constituye un
                  diagnóstico. Ante cualquier duda o preocupación, consultá con un profesional de la
                  salud.
                </p>
              </div>

              {/* CTAs */}
              <div className="mt-8 rounded-2xl border border-tiam-blue/20 bg-tiam-blue/5 p-6">
                <p className="font-semibold text-slate-900">¿Sos profesional de la salud?</p>
                <p className="mt-1 text-sm text-slate-600">
                  TIAM te da ejercicios de estimulación cognitiva organizados por área y nivel, y el
                  seguimiento de cada paciente en un solo lugar.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Link to="/register">
                    <Button size="md">Probá TIAM gratis</Button>
                  </Link>
                  <Link to="/blog">
                    <Button variant="secondary" size="md">Leer el blog</Button>
                  </Link>
                </div>
              </div>

              <button
                type="button"
                onClick={restart}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-tiam-blue transition-colors"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Volver a empezar
              </button>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
