import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Dos de cada grupo" — día 5, mes 5, ejecutivas. A condition made of TWO parts
 * ("son de madera y sirven para sentarse", "tienen alas, pero no vuelan") and eight
 * or ten everyday things; exactly TWO of them meet it and the player taps those two.
 * The tallerista found the single-property version too easy, so every condition now
 * has two parts and the decoys are the near misses: they meet only one of the two
 * (a "silla de plástico" is for sitting but not wooden; a "mesa de madera" is wooden
 * but not for sitting). The material is written in the object's name wherever an
 * object could come in more than one, so no decoy is ambiguous: nothing meets the
 * condition under any reasonable reading except the two.
 *
 * Every tap is checked live. A wrong object greys out for good (it can never
 * become right: the condition does not change), says why it does not fit and
 * costs one mistake; the right ones turn green. No timer, no "Revisar".
 *
 * THREE questions per level (the tallerista found one condition per level too short),
 * each with its own condition and objects, and a ramp: material + use (L1, 8 objects
 * each), material + use, kind + colour or kind + habitat (L2, 10 objects) and "has it,
 * but not that" conditions (L3, 10 objects). Each level has a pool of four authored
 * sets; three of them are picked ONCE at mount (`epoch`, together with the order of
 * the objects), so "Repetir" plays exactly the same nine questions. Between two
 * questions the explanation stays on screen for a moment and the taps are off.
 * Per-level state lives in <LevelView>, keyed by run + level. Words are kept apart
 * on purpose: an object that is RIGHT in one set shows up nowhere else, so it never
 * flips from "doesn't fit" to "fits" between two questions of the same run (a script
 * checks it for every set).
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by the
 * click's own timeStamp) is ignored, so the second tap of a double tap on "Siguiente nivel"
 * or "Repetir" never lands on an object of the new level (the grid sits right where that
 * button was). Nothing else needs it while playing: an object that is found or ruled out
 * stays put, disabled. The card's button ignores a tap within SETTLE_MS of the object that
 * closed the level (the card takes the grid's place, so it can end up under that finger). A
 * new level opens at its top and the solved card is scrolled into view with its button.
 *
 * totalAttempts = mistakes + the two objects of every question of the day (TOTAL_PICKS).
 */

// ── data:start ──
interface GroupSet {
  /** Completes "Tocá los 2 que …". */
  condition: string
  /** Exactly the two objects that meet the condition. */
  correct: [string, string]
  /** Objects that do not meet it under any reasonable reading. */
  wrong: string[]
  /** Shown after a wrong tap. */
  no: string
  /** Shown on the result card. */
  why: string
}
interface LevelDef {
  name: string
  sets: GroupSet[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    sets: [
      {
        condition: 'son de madera y sirven para sentarse',
        correct: ['silla de madera', 'banco de madera'],
        wrong: [
          'mesa de madera',
          'puerta de madera',
          'cuchara de madera',
          'silla de plástico',
          'sillón de tela',
          'sábana de tela',
        ],
        no: 'Ese no es de madera o no sirve para sentarse.',
        why: 'La silla y el banco son de madera y sirven para sentarse.',
      },
      {
        condition: 'son de vidrio y se usan para tomar',
        correct: ['vaso de vidrio', 'copa de vidrio'],
        wrong: [
          'espejo de vidrio',
          'ventana de vidrio',
          'plato de vidrio',
          'taza de cerámica',
          'vaso de plástico',
          'mate de calabaza',
        ],
        no: 'Ese no es de vidrio o no se usa para tomar.',
        why: 'El vaso y la copa son de vidrio y se usan para tomar.',
      },
      {
        condition: 'son de plástico y se usan para comer',
        correct: ['tenedor de plástico', 'cuchara de plástico'],
        wrong: [
          'tenedor de metal',
          'cuchara de madera',
          'plato de cerámica',
          'vaso de plástico',
          'botella de plástico',
          'balde de plástico',
        ],
        no: 'Ese no es de plástico o no se usa para comer.',
        why: 'El tenedor y la cuchara son de plástico y se usan para comer.',
      },
      {
        condition: 'son de metal y se usan en la cocina',
        correct: ['sartén de metal', 'cacerola de metal'],
        wrong: [
          'taza de cerámica',
          'plato de cerámica',
          'jarra de plástico',
          'martillo de metal',
          'llave de metal',
          'clavo de metal',
        ],
        no: 'Ese no es de metal o no se usa en la cocina.',
        why: 'La sartén y la cacerola son de metal y se usan en la cocina.',
      },
    ],
  },
  {
    name: 'Nivel 2',
    sets: [
      {
        condition: 'son de metal y sirven para cortar',
        correct: ['cuchillo de metal', 'serrucho de metal'],
        wrong: [
          'tijera de plástico',
          'cuchillo de plástico',
          'martillo de metal',
          'llave de metal',
          'cuchara de metal',
          'olla de metal',
          'plato de plástico',
          'lápiz de madera',
        ],
        no: 'Ese no es de metal o no sirve para cortar.',
        why: 'El cuchillo y el serrucho son de metal y sirven para cortar.',
      },
      {
        condition: 'son frutas y son amarillas',
        correct: ['banana', 'limón'],
        wrong: ['naranja', 'sandía', 'uva', 'choclo', 'girasol', 'mostaza', 'zanahoria', 'tomate'],
        no: 'Ese no es una fruta o no es amarillo.',
        why: 'La banana y el limón son frutas y son amarillas.',
      },
      {
        condition: 'tienen cuatro patas y viven en una casa',
        correct: ['perro', 'gato'],
        wrong: ['caballo', 'vaca', 'oveja', 'cerdo', 'loro', 'canario', 'pez', 'gallina'],
        no: 'Ese no tiene cuatro patas, o no vive en una casa.',
        why: 'El perro y el gato tienen cuatro patas y viven en una casa.',
      },
      {
        condition: 'son frutas y son rojas',
        correct: ['frutilla', 'cereza'],
        wrong: ['manzana verde', 'uva', 'naranja', 'remolacha', 'rabanito', 'zanahoria', 'lechuga', 'pera verde'],
        no: 'Ese no es una fruta o no es rojo.',
        why: 'La frutilla y la cereza son frutas y son rojas.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    sets: [
      {
        condition: 'tienen alas, pero no vuelan',
        correct: ['pingüino', 'avestruz'],
        wrong: ['paloma', 'loro', 'mariposa', 'avión', 'oso', 'vaca', 'tortuga', 'tigre'],
        no: 'Ese no tiene alas, o sí vuela.',
        why: 'El pingüino y el avestruz tienen alas, pero no vuelan.',
      },
      {
        condition: 'son de tela, pero no se usan para vestirse',
        correct: ['sábana', 'toalla'],
        wrong: ['camisa', 'pantalón', 'campera', 'zapatos de cuero', 'plato', 'llave', 'martillo', 'vaso'],
        no: 'Ese no es de tela, o se usa para vestirse.',
        why: 'La sábana y la toalla son de tela, pero no se usan para vestirse.',
      },
      {
        condition: 'tienen cuatro patas, pero no son animales',
        correct: ['mesa', 'cama'],
        wrong: ['elefante', 'burro', 'jirafa', 'oso', 'lámpara', 'puerta', 'reloj', 'bicicleta'],
        no: 'Ese no tiene cuatro patas, o es un animal.',
        why: 'La mesa y la cama tienen cuatro patas, pero no son animales.',
      },
      {
        condition: 'viven en el agua, pero no son peces',
        correct: ['ballena', 'delfín'],
        wrong: ['pez', 'tiburón', 'trucha', 'conejo', 'ardilla', 'zorro', 'pavo', 'ciervo'],
        no: 'Ese no vive en el agua, o es un pez.',
        why: 'La ballena y el delfín viven en el agua, pero no son peces.',
      },
    ],
  },
]

/** Questions per level, picked at mount from the level's pool of sets. */
const QUESTIONS_PER_LEVEL = 3
/** Objects to find in every question. */
const PICKS_PER_QUESTION = 2
const TOTAL_PICKS = LEVELS.length * QUESTIONS_PER_LEVEL * PICKS_PER_QUESTION
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

interface QuestionContent {
  set: GroupSet
  /** The objects in their (frozen) display order. */
  options: string[]
}
interface LevelContent {
  questions: QuestionContent[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({
    questions: shuffle(lvl.sets)
      .slice(0, QUESTIONS_PER_LEVEL)
      .map((set) => ({ set, options: shuffle([...set.correct, ...set.wrong]) })),
  }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente razonamiento!', '¡Así se hace!', '¡Perfecto!']

/** A tap this soon after the tap that brought the level here ("Siguiente nivel", "Repetir") is the second tap
 * of a double tap, and it must not be judged against the object that sits where that button was. The same
 * window covers the card's button right after the object that closed the level (the card takes the grid's
 * place). Long enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

/** How long the explanation of a solved question stays on screen before the next question replaces it. */
const NEXT_QUESTION_MS = 1800

interface LevelViewProps {
  levelIdx: number
  content: LevelContent
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, content, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = content.questions.length

  const [qIdx, setQIdx] = useState(0)
  const { set, options } = content.questions[qIdx]
  const [found, setFound] = useState<string[]>([])
  const [ruledOut, setRuledOut] = useState<string[]>([])
  const [hint, setHint] = useState<string | null>(null)
  // The question is solved and the next one is about to replace it: every object is off meanwhile.
  const [advancing, setAdvancing] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const [flash, setFlash] = useState<string | null>(null)
  // The tap that found the last object of the level: the result card takes the grid's place.
  const closedAtRef = useRef(Number.NEGATIVE_INFINITY)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(
    () => () => {
      window.clearTimeout(flashTimerRef.current)
      window.clearTimeout(advanceTimerRef.current)
    },
    [],
  )

  const isLastQuestion = qIdx === total - 1
  const solved = isLastQuestion && found.length >= PICKS_PER_QUESTION

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!solved || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [solved])

  function handleTap(option: string, at: number) {
    // The second tap of a double tap on the button that brought the level lands on an object: not an answer.
    if (solved || advancing || found.includes(option) || ruledOut.includes(option) || at - since < SETTLE_MS) return
    if (set.correct.includes(option)) {
      const nextFound = [...found, option]
      setFound(nextFound)
      setHint(null)
      if (nextFound.length < PICKS_PER_QUESTION) return
      if (isLastQuestion) {
        closedAtRef.current = at
        setPraise(pickOne(PRAISE))
        onSolved()
        return
      }
      // Not the last question: say why for a moment (taps are off), then bring the next one.
      setAdvancing(true)
      setHint(`¡Muy bien! ${set.why}`)
      advanceTimerRef.current = window.setTimeout(() => {
        setQIdx((i) => i + 1)
        setFound([])
        setRuledOut([])
        setHint(null)
        setAdvancing(false)
      }, NEXT_QUESTION_MS)
    } else {
      setRuledOut((r) => [...r, option])
      setHint(`${set.no} Probá con otro.`)
      onMistake()
      setFlash(option)
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setFlash(null), 600)
    }
  }

  // The card takes the grid's place, so its button can end up right under the finger that closed the
  // level: the second tap of that double tap must not skip the result.
  function leave(go: (at: number) => void, at: number) {
    if (at - closedAtRef.current < SETTLE_MS) return
    go(at)
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Pregunta {qIdx + 1} de {total}
            </span>
            <h2 className="mt-3 text-2xl font-bold leading-snug text-slate-900">
              Tocá los 2 que <span className="text-indigo-700">{set.condition}</span>
            </h2>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Encontraste {found.length} de {PICKS_PER_QUESTION}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                  style={{ width: `${(found.length / PICKS_PER_QUESTION) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!solved && (
        <>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
            {options.map((option) => {
              const isFound = found.includes(option)
              const isRuledOut = ruledOut.includes(option)
              const isFlashing = flash === option
              return (
                <button
                  key={`${qIdx}-${option}`}
                  type="button"
                  disabled={isFound || isRuledOut}
                  onClick={(e) => handleTap(option, e.timeStamp)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 px-2 py-3 text-xl font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isFound
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isRuledOut
                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                    isFlashing ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out]' : '',
                  ].join(' ')}
                >
                  {/* Only the first letter: "silla de madera" must not become "Silla De Madera". */}
                  <span className="block first-letter:uppercase">{option}</span>
                  {isFound && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-4 min-h-[4.5rem] text-center text-base font-medium ${advancing ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Resolviste las {total} preguntas. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <ul className="mt-3 space-y-1.5 text-left">
            {content.questions.map((q) => (
              <li
                key={q.set.condition}
                className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-base leading-snug text-slate-700"
              >
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} />
                {q.set.why}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => leave(onRepeat, e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => leave(onNext, e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
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

export function DosDeCadaGrupo({ onComplete }: GameProps) {
  // Which sets each level plays, and the order of their objects — decided once, at
  // mount, so "Repetir" plays exactly the same content.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PICKS })
  }
  function handleNext(at: number) {
    setSince(at)
    setLevelIdx((i) => i + 1)
  }
  function handleRepeat(at: number) {
    setSince(at)
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
