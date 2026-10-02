import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Leé y recordá" — día 2, mes 5, memoria. A study → recall game: read a short
 * story about an invented person, tap "Ya lo leí", and then answer three
 * questions about it with the text GONE. Every answer comes from what was just
 * read — never from general knowledge — so the distractors are plausible
 * details (other names, other hours, other numbers), some of them taken from
 * the same story to make the player connect "who" with "what".
 *
 * Deliberately NO countdown on the reading screen (same call as
 * LeerYResponder): reading speed varies enormously in this audience and a clock
 * over a paragraph would punish the slowest readers for the very skill the game
 * trains. The only timer is the brief pause after a CORRECT tap, so the
 * checkmark registers before the next question replaces it. A wrong tap greys
 * out that option and lets the player try again; it costs one mistake.
 *
 * The text is GONE during recall, and so is its title: the recall screen only
 * says "Sobre la historia que leíste", because a title like "Estela y Canela"
 * would answer "¿Cómo se llama la perra de Estela?". No story title and no
 * question prompt contains the correct answer of any question of its story
 * (checked by a throwaway script, not committed).
 *
 * ONE story per level, with a gentle ramp: ~40 words / 3 options per question
 * (L1), ~55 words / 4 options with a "who did what" link (L2), ~60 words and
 * several people to keep apart (L3). Each level has two authored stories and
 * one is picked ONCE at mount (`epoch`, together with each question's option
 * order), so "Repetir" tells exactly the same three stories. Per-level state
 * lives in <LevelView>, keyed by run + level, so it resets without any effect.
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS).
 */

// ── data:start ──
interface Question {
  prompt: string
  correct: string
  /** Plausible wrong answers — none may be true according to the story. */
  wrong: string[]
}
interface Story {
  title: string
  body: string
  questions: Question[]
}
interface LevelDef {
  name: string
  stories: Story[]
}

// Every story in a level has the same number of questions, so TOTAL_QUESTIONS
// never depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    stories: [
      {
        title: 'Una mañana en Tandil',
        body: 'Estela vive en Tandil, en una casa con jardín. Tiene una perra marrón que se llama Canela. Todas las mañanas, a las ocho, la lleva a pasear por la plaza. Después compra tres facturas en la panadería y vuelven juntas a desayunar.',
        questions: [
          { prompt: '¿Cómo se llama la perra de Estela?', correct: 'Canela', wrong: ['Pelusa', 'Mora'] },
          { prompt: '¿A qué hora la lleva a pasear?', correct: 'A las ocho', wrong: ['A las seis', 'A las diez'] },
          { prompt: '¿Cuántas facturas compra en la panadería?', correct: 'Tres', wrong: ['Cinco', 'Dos'] },
        ],
      },
      {
        title: 'Rubén y su quinta',
        body: 'Rubén tiene una quinta chica detrás de su casa, en Luján. Planta tomates, zapallitos y albahaca. Los sábados lo riega todo con una regadera verde. Cuando hay muchos tomates, le lleva una bolsa a su vecina Carmen.',
        questions: [
          { prompt: '¿Qué día riega Rubén su quinta?', correct: 'Los sábados', wrong: ['Los lunes', 'Los domingos'] },
          { prompt: '¿De qué color es la regadera?', correct: 'Verde', wrong: ['Roja', 'Azul'] },
          { prompt: '¿A quién le lleva una bolsa de tomates?', correct: 'A Carmen', wrong: ['A Rosa', 'A Marta'] },
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    stories: [
      {
        title: 'El cumpleaños de Beba',
        body: 'El sábado fue el cumpleaños de Beba. Cumplió setenta años y sus tres hijos armaron una reunión en el patio de su casa, en Bahía Blanca. Marcelo trajo una torta de dulce de leche, Laura llevó las sillas y Gonzalo puso música de tango. Beba recibió de regalo una bufanda celeste que tejió su nieta.',
        questions: [
          { prompt: '¿Cuántos años cumplió Beba?', correct: 'Setenta', wrong: ['Sesenta', 'Ochenta', 'Noventa'] },
          { prompt: '¿Quién trajo la torta de dulce de leche?', correct: 'Marcelo', wrong: ['Laura', 'Gonzalo', 'Su nieta'] },
          { prompt: '¿De qué color es la bufanda que le regalaron?', correct: 'Celeste', wrong: ['Verde', 'Gris', 'Rosa'] },
        ],
      },
      {
        title: 'El viaje de Nora',
        body: 'Nora tomó el tren de las siete de la mañana para visitar a su hermana Julia, que vive en Rosario. El viaje duró cuatro horas. Durante el camino tejió un pulóver amarillo y comió dos sándwiches de jamón y queso. Cuando llegó, Julia la esperaba en la estación con un paraguas, porque estaba lloviendo.',
        questions: [
          { prompt: '¿A qué hora salió el tren?', correct: 'A las siete', wrong: ['A las cinco', 'A las nueve', 'A las doce'] },
          { prompt: '¿En qué ciudad vive Julia?', correct: 'Rosario', wrong: ['Córdoba', 'Mendoza', 'Tucumán'] },
          {
            prompt: '¿Qué comió Nora durante el viaje?',
            correct: 'Dos sándwiches de jamón y queso',
            wrong: ['Una tarta de manzana', 'Tres empanadas de carne', 'Un paquete de galletitas'],
          },
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    stories: [
      {
        title: 'La feria de Don Aurelio',
        body: 'Los domingos hay una feria en la plaza del barrio. Don Aurelio vende yerba y miel en un puesto con toldo rojo. A su lado, doña Mabel ofrece quesos caseros, y enfrente un joven llamado Tomás vende flores. Don Aurelio abre a las nueve y cierra a la una. Su cliente más fiel es Hugo, que siempre se lleva un frasco de miel de eucalipto.',
        questions: [
          { prompt: '¿Quién vende flores en la feria?', correct: 'Tomás', wrong: ['Hugo', 'Don Aurelio', 'Doña Mabel'] },
          { prompt: '¿A qué hora cierra el puesto de Don Aurelio?', correct: 'A la una', wrong: ['A las nueve', 'A las doce', 'A las tres'] },
          {
            prompt: '¿Qué se lleva siempre Hugo?',
            correct: 'Un frasco de miel de eucalipto',
            wrong: ['Un queso casero', 'Un paquete de yerba', 'Un ramo de flores'],
          },
        ],
      },
      {
        title: 'La mudanza de Olga',
        body: 'Olga se mudó el mes pasado a un departamento en el segundo piso, con balcón a la calle. Su sobrino Pablo la ayudó con las cajas y su amiga Elvira le regaló una planta de helecho. Ahora toma el café de la mañana en el balcón y saluda al panadero de enfrente, que se llama Ismael.',
        questions: [
          { prompt: '¿En qué piso vive Olga ahora?', correct: 'En el segundo', wrong: ['En el tercero', 'En el primero', 'En el quinto'] },
          { prompt: '¿Quién le regaló la planta de helecho?', correct: 'Elvira', wrong: ['Pablo', 'Su hermana', 'Su vecina'] },
          { prompt: '¿Cómo se llama el panadero de enfrente?', correct: 'Ismael', wrong: ['Pablo', 'Ernesto', 'Walter'] },
        ],
      },
    ],
  },
]

const TOTAL_QUESTIONS = LEVELS.reduce((sum, lvl) => sum + lvl.stories[0].questions.length, 0)
// ── data:end ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface PreparedQuestion {
  prompt: string
  correct: string
  /** Shuffled once, at mount — never re-shuffled, or the options would jump after a wrong tap. */
  options: string[]
}
interface PreparedLevel {
  title: string
  body: string
  questions: PreparedQuestion[]
}

function buildEpoch(): PreparedLevel[] {
  return LEVELS.map((lvl) => {
    const story = pickOne(lvl.stories)
    return {
      title: story.title,
      body: story.body,
      questions: story.questions.map((q) => ({
        prompt: q.prompt,
        correct: q.correct,
        options: shuffle([q.correct, ...q.wrong]),
      })),
    }
  })
}

const PRAISE_GREAT = ['¡Leíste con mucha atención!', '¡Qué buena memoria!', '¡Así se hace!']
const PRAISE_GOOD = ['¡Muy bien! Cada vez recordás más.', '¡Buen trabajo! La memoria también se entrena.']
const NUDGES = ['Esa no era. Pensá de nuevo en la historia.', 'Todavía no. Probá con otra opción.', 'Casi — fijate en las otras opciones.']

type Phase = 'reading' | 'questions' | 'done'

interface LevelViewProps {
  levelIdx: number
  content: PreparedLevel
  onMistake: () => void
  onSolved: () => void
  onNext: () => void
  onRepeat: () => void
}

function LevelView({ levelIdx, content, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { questions } = content

  const [phase, setPhase] = useState<Phase>('reading')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [wrongOptions, setWrongOptions] = useState<string[]>([])
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelMistakes, setLevelMistakes] = useState(0)
  const [praise, setPraise] = useState(PRAISE_GREAT[0])
  const advanceTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  const question = questions[questionIdx]

  function handleTap(option: string) {
    if (isAdvancing || phase !== 'questions') return
    if (option === question.correct) {
      setIsAdvancing(true)
      // The only timer in the game: a short pause so the checkmark registers.
      advanceTimerRef.current = window.setTimeout(() => {
        if (questionIdx < questions.length - 1) {
          setQuestionIdx((i) => i + 1)
          setWrongOptions([])
          setHint(null)
          setIsAdvancing(false)
        } else {
          setPraise(pickOne(levelMistakes === 0 ? PRAISE_GREAT : PRAISE_GOOD))
          setPhase('done')
          onSolved()
        }
      }, 700)
    } else {
      setWrongOptions((w) => [...w, option])
      setHint(pickOne(NUDGES))
      setLevelMistakes((m) => m + 1)
      onMistake()
    }
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>

        {phase === 'reading' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Leé con tranquilidad</h2>
            <p className="mt-2 text-base text-slate-500">
              Tomate el tiempo que necesites. Después vas a responder sin ver el texto.
            </p>
          </>
        )}

        {phase === 'questions' && (
          <>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Pregunta {questionIdx + 1} de {questions.length}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{question.prompt}</h2>
          </>
        )}

        {phase === 'done' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              ¡Completaste el {level.name.toLowerCase()}!
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Study phase: the story, with a comfortable measure and no clock */}
      {phase === 'reading' && (
        <>
          <div className="mx-auto mt-5 max-w-prose rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="text-base font-bold text-tiam-blue-dark">{content.title}</h3>
            <p className="mt-3 text-lg leading-relaxed text-slate-700">{content.body}</p>
          </div>
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setPhase('questions')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Ya lo leí
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* Recall phase: the text is gone, only the options remain */}
      {phase === 'questions' && (
        <>
          <p className="mt-2 text-center text-base text-slate-500">Sobre la historia que leíste</p>
          <div className="mx-auto mt-4 flex max-w-md flex-col gap-3">
            {question.options.map((option) => {
              const isWrong = wrongOptions.includes(option)
              const isCorrectFound = isAdvancing && option === question.correct
              return (
                <button
                  key={option}
                  type="button"
                  disabled={isWrong || isAdvancing}
                  onClick={() => handleTap(option)}
                  className={[
                    'flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectFound
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-800'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span>{option}</span>
                  {isCorrectFound && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-4 min-h-[3rem] text-center text-base font-medium text-slate-500">
            {!isAdvancing && hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {phase === 'done' && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-slate-600">
            Contestaste las {questions.length} preguntas sobre «{content.title}».
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={onRepeat}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LeeYRecorda({ onComplete }: GameProps) {
  // Which story each level tells, and every question's option order — decided
  // once, at mount, so "Repetir" tells exactly the same stories.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
  }
  function handleRepeat() {
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={() => setLevelIdx((i) => i + 1)}
      onRepeat={handleRepeat}
    />
  )
}
