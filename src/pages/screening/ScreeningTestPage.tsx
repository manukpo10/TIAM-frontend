import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ShieldCheck, RotateCcw, User, Users } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'
import screeningIllustration from '@/assets/autoevaluacion.webp'

/**
 * Orientational cognitive screening. AWARENESS tool, NOT a diagnostic instrument.
 *
 * Methodology is inspired by validated brief screening interviews (notably the AD8,
 * Galvin et al. 2005, and its Rioplatense validation AD8-arg): it asks about CHANGE
 * relative to how things used to be — the most sensitive signal — across the same
 * cognitive/functional domains (judgment, interest, repetition, learning to use
 * devices, temporal orientation, finances, appointments, day-to-day memory).
 *
 * Questions are ORIGINAL wording (the AD8 is copyrighted; we don't reproduce it).
 * Answers never leave the browser. Score = number of "Sí, es un cambio". The
 * cutoff of 2 mirrors the AD8-arg validated cutoff, but framed as orientational.
 */

type Perspective = 'self' | 'other'

interface Question {
  id: string
  domain: string
  self: string
  other: string
}

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    domain: 'Juicio y decisiones',
    self: '¿Notás un cambio en tu capacidad para tomar decisiones o resolver problemas cotidianos respecto a cómo lo hacías antes?',
    other: '¿Notás un cambio en su capacidad para tomar decisiones o resolver problemas cotidianos respecto a cómo lo hacía antes?',
  },
  {
    id: 'q2',
    domain: 'Interés en actividades',
    self: '¿Perdiste interés en pasatiempos o actividades que antes disfrutabas?',
    other: '¿Perdió interés en pasatiempos o actividades que antes disfrutaba?',
  },
  {
    id: 'q3',
    domain: 'Repetición',
    self: '¿Repetís las mismas preguntas, relatos o comentarios sin darte cuenta de que ya los hiciste?',
    other: '¿Repite las mismas preguntas, relatos o comentarios sin darse cuenta de que ya los hizo?',
  },
  {
    id: 'q4',
    domain: 'Uso de dispositivos',
    self: '¿Te cuesta más que antes aprender a usar un aparato o dispositivo nuevo (celular, control remoto, microondas)?',
    other: '¿Le cuesta más que antes aprender a usar un aparato o dispositivo nuevo (celular, control remoto, microondas)?',
  },
  {
    id: 'q5',
    domain: 'Orientación temporal',
    self: '¿Te confundís con el día, el mes o el año más seguido que antes?',
    other: '¿Se confunde con el día, el mes o el año más seguido que antes?',
  },
  {
    id: 'q6',
    domain: 'Manejo del dinero',
    self: '¿Se te complica manejar temas de dinero que antes resolvías sin problema (pagar cuentas, controlar gastos)?',
    other: '¿Se le complica manejar temas de dinero que antes resolvía sin problema (pagar cuentas, controlar gastos)?',
  },
  {
    id: 'q7',
    domain: 'Citas y compromisos',
    self: '¿Olvidás citas o compromisos más seguido que antes?',
    other: '¿Olvida citas o compromisos más seguido que antes?',
  },
  {
    id: 'q8',
    domain: 'Memoria cotidiana',
    self: '¿Sentís que los problemas de memoria o de pensamiento aparecen casi todos los días, y no solo de vez en cuando?',
    other: '¿Notás que los problemas de memoria o de pensamiento aparecen casi todos los días, y no solo de vez en cuando?',
  },
]

// Only "Sí, es un cambio" scores a point — mirrors the AD8 scoring.
const ANSWERS = [
  { label: 'Sí, es un cambio', value: 1 },
  { label: 'No, sin cambios', value: 0 },
  { label: 'No estoy seguro/a', value: 0 },
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
    max: 1,
    tone: 'green',
    title: 'Pocas señales de cambio',
    message:
      'Las respuestas están dentro de lo esperable: no aparecen cambios cognitivos destacados respecto a antes. Es un buen momento para sostener hábitos protectores: actividad mental, vida social, ejercicio físico y buen descanso.',
  },
  {
    min: 2,
    max: 3,
    tone: 'amber',
    title: 'Algunas señales de cambio',
    message:
      'Aparecen algunas señales de cambio respecto a cómo eran las cosas antes. En los instrumentos de cribado validados, este nivel ya sugiere conversarlo con un profesional de la salud, sobre todo si los cambios se sostienen o aumentan. No significa que exista un diagnóstico.',
  },
  {
    min: 4,
    max: 8,
    tone: 'orange',
    title: 'Varias señales de cambio',
    message:
      'Las respuestas reflejan varios cambios respecto a antes. Te recomendamos consultar con un profesional (neurólogo, neuropsicólogo o tu médico de cabecera) para una valoración adecuada. Detectar a tiempo permite intervenir mejor.',
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
  const [perspective, setPerspective] = useState<Perspective>('self')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Autoevaluación cognitiva — TIAM Digital'
  }, [])

  function start(p: Perspective) {
    setPerspective(p)
    setAnswers({})
    setCurrent(0)
    setPhase('questions')
    window.scrollTo(0, 0)
  }

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
  const flaggedDomains = QUESTIONS.filter((q) => answers[q.id] === 1).map((q) => q.domain)
  const progress = Math.round((current / QUESTIONS.length) * 100)

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          {/* ── Intro ─────────────────────────────────────────────────────── */}
          {phase === 'intro' && (
            <div>
              <img
                src={screeningIllustration}
                alt=""
                className="mb-6 w-full rounded-2xl border border-slate-100"
              />
              <p className="text-xs font-semibold uppercase tracking-wider text-tiam-blue mb-3">
                Autoevaluación
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                Cuestionario orientativo de cambios cognitivos
              </h1>
              <p className="mt-4 text-[17px] text-slate-600 leading-relaxed">
                Basado en la metodología de instrumentos de cribado validados (como el{' '}
                <strong className="font-semibold text-slate-700">AD8</strong>), este cuestionario
                observa <strong className="font-semibold text-slate-700">cambios respecto a cómo
                eran las cosas antes</strong> —el indicador más sensible—, no simples olvidos
                aislados. Son 8 preguntas y te lleva menos de 2 minutos.
              </p>

              {/* Medical disclaimer */}
              <div
                role="note"
                className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong className="font-semibold">Importante:</strong> este cuestionario{' '}
                  <strong>no es un diagnóstico</strong> ni reemplaza una consulta profesional. Es una
                  herramienta de orientación. Únicamente una evaluación realizada por un profesional
                  de la salud puede determinar un diagnóstico.
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

              {/* Perspective selector */}
              <div className="mt-8">
                <p className="font-semibold text-slate-900 mb-3">¿Sobre quién querés responder?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => start('self')}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-tiam-blue hover:bg-tiam-blue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/30"
                  >
                    <User className="h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-900">Sobre mí</span>
                      <span className="block text-sm text-slate-500">Respondo por mi cuenta</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => start('other')}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-tiam-blue hover:bg-tiam-blue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/30"
                  >
                    <Users className="h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-900">Sobre un ser querido</span>
                      <span className="block text-sm text-slate-500">Respondo como familiar</span>
                    </span>
                  </button>
                </div>
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

              <p className="text-xs font-semibold uppercase tracking-wide text-tiam-blue mb-2">
                {QUESTIONS[current].domain}
              </p>
              <h2 className="text-xl md:text-2xl font-semibold text-slate-900 leading-snug min-h-[4.5rem]">
                {QUESTIONS[current][perspective]}
              </h2>

              <div className="mt-6 flex flex-col gap-3">
                {ANSWERS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => selectAnswer(a.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-left text-[17px] text-slate-700 font-medium transition-colors hover:border-tiam-blue hover:bg-tiam-blue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/30"
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
                    <div className="flex items-baseline justify-between gap-4">
                      <h1 className="text-2xl font-bold text-slate-900">{bucket.title}</h1>
                      <span className="shrink-0 text-sm font-semibold text-slate-500 tabular-nums">
                        {score} de 8 señales
                      </span>
                    </div>
                    <p className="mt-3 text-slate-700 leading-relaxed">{bucket.message}</p>

                    {flaggedDomains.length > 0 && (
                      <div className="mt-4 border-t border-slate-900/5 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          Áreas donde marcaste un cambio
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {flaggedDomains.map((d) => (
                            <span
                              key={d}
                              className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-900/5"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                  Este resultado es <strong>orientativo</strong>. Está inspirado en la metodología de
                  instrumentos de cribado validados, pero no los reemplaza ni constituye un
                  diagnóstico. Ante cualquier duda, consultá con un profesional de la salud.
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
