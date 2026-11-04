import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Esto no es…" — día 17, mes 6, ejecutivas (razonamiento creativo). A plain shape and a sentence that says what it is
 * NOT: "Esto no es una pelota. ¿Qué otra cosa podría ser?". The player invents another thing the shape could be, writes it or just
 * thinks it, and only AFTER answering do a few example ideas appear. The mechanic comes from a worksheet of outline
 * drawings that each "are not" something and ask what they are instead; here the shapes (drawn in SVG), the sentences
 * and the example ideas are TIAM's own.
 *
 * OPEN, NO ERROR. There is no right answer, so nothing is checked and nothing is a mistake: the day reports
 * `mistakes: 0` and `totalAttempts` = the number of shapes. The player either writes the idea in the box and taps
 * "Listo" or taps "La pensé" for an idea that was only in the head (a screen keyboard is not always welcome). In both
 * cases the example ideas then appear, as a few more possibilities and never as "the answer". What was written is
 * shown back, and at the end of the level the player's own ideas are listed.
 *
 * ORIGINAL CONTENT. Only the mechanic is borrowed, and with it the pattern "Esto no es…" (the day's title). None of
 * the objects of the worksheet's sentences or drawings, and none of the rest of its wording, is used: the shapes are
 * a circle, a bar, a triangle, a crescent, a thick cross, a wavy band and three irregular blobs, and the sentences
 * and the example ideas were written for them. A throwaway script (not committed) rejects the worksheet's objects
 * among the sentences and the ideas.
 *
 * THREE SHAPES A LEVEL, as the tallerista likes the days short. Ramp: level 1 plain geometric shapes, level 2 less
 * obvious ones (a crescent, a cross, a wave) and level 3 irregular blobs where TWO different ideas are asked, each one
 * from a different kind of thing (nature, a place, an animal, something that is eaten…), so that flexible thinking,
 * not the first idea, is what is exercised. The order of the shapes inside a level is chosen ONCE at mount (`epoch`),
 * so "Repetir" replays the same nine shapes.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that changed the screen is ignored. Text
 * that has to be read is 16 px or more (the inputs too, so a phone does not zoom in on them).
 */

// ── data:start ──
interface ShapeDef {
  /** What the picture is, without saying what it could be. */
  alt: string
  /** SVG paths on a 200 × 140 board; `line` ones are a thick stroke, the others are filled. */
  paths: { d: string; line?: boolean }[]
  /** Completes "Esto no es …": an article and a noun. */
  not: string
  /** One label per idea asked. */
  asks: string[]
  /** Example ideas, shown only after the player has answered. */
  ideas: string[]
}
interface LevelDef {
  name: string
  shapes: ShapeDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    shapes: [
      {
        alt: 'Una figura redonda y grande.',
        paths: [{ d: 'M100 14a56 56 0 1 0 0.01 0z' }],
        not: 'una pelota',
        asks: ['Tu idea'],
        ideas: ['un reloj de pared', 'un plato', 'la luna llena', 'una rueda'],
      },
      {
        alt: 'Una figura larga, baja y de esquinas rectas.',
        paths: [{ d: 'M18 46h164v48H18z' }],
        not: 'una regla',
        asks: ['Tu idea'],
        ideas: ['un puente', 'una barra de chocolate', 'un banco de plaza', 'una cama vista de costado'],
      },
      {
        alt: 'Una figura con tres lados y una punta hacia arriba.',
        paths: [{ d: 'M100 12 182 128H18z' }],
        not: 'una cuña de queso',
        asks: ['Tu idea'],
        ideas: ['una montaña', 'la vela de un velero', 'una carpa de camping', 'un pañuelo doblado'],
      },
    ],
  },
  {
    name: 'Nivel 2',
    shapes: [
      {
        alt: 'Una figura curva, gruesa en el medio y con dos puntas.',
        paths: [{ d: 'M142 20A56 56 0 1 0 142 120 44 44 0 1 1 142 20z' }],
        not: 'una luna',
        asks: ['Tu idea'],
        ideas: ['una sonrisa', 'una canoa', 'un gajo de naranja', 'una hamaca'],
      },
      {
        alt: 'Una figura de cuatro brazos iguales que se cruzan en el medio.',
        paths: [{ d: 'M80 14h40v40h40v40h-40v40H80V94H40V54h40z' }],
        not: 'un signo más',
        asks: ['Tu idea'],
        ideas: ['un cruce de calles visto desde arriba', 'un molino con cuatro aspas', 'una pieza de un juego de armar', 'una plaza con cuatro caminos'],
      },
      {
        alt: 'Una cinta gruesa que sube y baja como una ondulación.',
        paths: [{ d: 'M16 72C44 14 72 14 100 72S156 130 184 72', line: true }],
        not: 'una ola',
        asks: ['Tu idea'],
        ideas: ['una serpiente', 'una montaña rusa', 'un camino de sierra', 'una cinta suelta'],
      },
    ],
  },
  {
    name: 'Nivel 3',
    shapes: [
      {
        alt: 'Una mancha de contorno irregular, más ancha que alta.',
        paths: [{ d: 'M36 92C16 50 58 18 100 28C142 38 172 18 184 60C196 102 142 128 100 114C70 106 54 134 36 92Z' }],
        not: 'una mancha de pintura',
        asks: ['1. Algo de la naturaleza', '2. Un objeto del hogar'],
        ideas: ['una isla vista desde arriba', 'un charco', 'una alfombra', 'el mapa de un país inventado'],
      },
      {
        alt: 'Una forma redondeada con una curva hacia adentro, como un riñón.',
        paths: [{ d: 'M26 72C26 30 92 18 134 34C180 50 190 96 152 114C116 130 84 100 62 112C40 122 26 98 26 72Z' }],
        not: 'un poroto',
        asks: ['1. Un lugar', '2. Un animal'],
        ideas: ['una pileta', 'una ballena', 'un lago', 'una laguna con una isla'],
      },
      {
        alt: 'Una forma con tres bultos redondeados, como una nube regordeta.',
        paths: [{ d: 'M100 22C126 10 152 30 146 56C176 56 192 86 170 106C150 126 120 116 100 122C80 116 50 126 30 106C8 86 24 56 54 56C48 30 74 10 100 22Z' }],
        not: 'un repollo',
        asks: ['1. Algo que se come', '2. Algo que se usa o se viste'],
        ideas: ['un pan de molde', 'un gorro de lana', 'un arbusto visto desde arriba', 'un almohadón'],
      },
    ],
  },
]
const TOTAL_SHAPES = LEVELS.reduce((sum, lvl) => sum + lvl.shapes.length, 0)

/** The sentence of the how-to screen: it is not in the game. */
const EXAMPLE_NOT = 'un sobre'
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

/** The order of the shapes of each level: decided once, at mount. */
function buildEpoch(): ShapeDef[][] {
  return LEVELS.map((lvl) => shuffle(lvl.shapes))
}

const PRAISE = ['¡Muy bien!', '¡Qué imaginación!', '¡Así se hace!', '¡Excelente!', '¡Muy creativo!']
/** A tap this soon after the tap that changed the screen is the second tap of a double tap and must not land. */
const SETTLE_MS = 400

function ShapeArt({ shape, className = '' }: { shape: ShapeDef; className?: string }) {
  return (
    <svg viewBox="0 0 200 140" role="img" aria-label={shape.alt} className={`rounded-2xl border-2 border-slate-100 bg-white ${className}`}>
      {shape.paths.map((p, i) =>
        p.line ? (
          <path key={i} d={p.d} fill="none" stroke="#1B6FC4" strokeOpacity="0.55" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path key={i} d={p.d} fill="#1B6FC4" fillOpacity="0.2" stroke="#15436F" strokeWidth="3" strokeLinejoin="round" />
        ),
      )}
    </svg>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá la forma y leé lo que dice: «Esto no es…». Pensá qué otra cosa podría ser.',
    'Escribí tu idea y tocá «Listo», o tocá «La pensé» si la pensaste sin escribirla.',
    'Después te mostramos otras ideas, solo para inspirarte. No hay respuestas equivocadas.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-base font-semibold text-slate-500">Por ejemplo:</p>
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">Esto no es {EXAMPLE_NOT}. ¿Qué otra cosa podría ser?</p>
      </div>
      <div className="sticky bottom-3 z-10 mt-4 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface LevelViewProps {
  levelIdx: number
  shapes: ShapeDef[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, shapes, since, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = shapes.length

  const [idx, setIdx] = useState(0)
  const [values, setValues] = useState<string[]>(() => shapes[0].asks.map(() => ''))
  // null until the shape is answered; then what was written ([] when the idea was only thought).
  const [answer, setAnswer] = useState<string[] | null>(null)
  // What the player wrote for every shape of the level, in order, for the list at the end.
  const [history, setHistory] = useState<(string[] | null)[]>([])
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const settleFromRef = useRef(since)
  const answeredRef = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const ideasRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  // A new shape opens at the top of the card too.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [idx])
  // The example ideas are the point of the step: once they show, bring them fully into view (above the sticky button).
  useEffect(() => {
    if (answer !== null) ideasRef.current?.scrollIntoView({ block: 'nearest' })
  }, [answer])
  // A finished level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const shape = shapes[idx]
  const ready = values.every((v) => v.trim().length > 0)
  const settled = (at: number) => at - settleFromRef.current >= SETTLE_MS

  function submit(typed: boolean, at: number) {
    if (answeredRef.current || !settled(at)) return
    if (typed && !ready) return
    answeredRef.current = true
    settleFromRef.current = at
    setAnswer(typed ? values.map((v) => v.trim()) : [])
  }
  function next(at: number) {
    if (answer === null || !settled(at)) return
    settleFromRef.current = at
    const nextHistory = [...history, answer.length ? answer : null]
    setHistory(nextHistory)
    if (idx < total - 1) {
      answeredRef.current = false
      setIdx((i) => i + 1)
      setValues(shapes[idx + 1].asks.map(() => ''))
      setAnswer(null)
    } else {
      setPraise(pickOne(PRAISE))
      setDone(true)
      onSolved()
    }
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Forma {idx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <form
          className="mx-auto mt-2 max-w-md"
          onSubmit={(e) => {
            e.preventDefault()
            submit(true, e.timeStamp)
          }}
        >
          <ShapeArt shape={shape} className="mx-auto w-36" />
          <p className="mt-2 text-center text-lg font-bold leading-snug text-slate-900">
            Esto no es {shape.not}.
            <span className="block text-base font-semibold text-slate-600">
              ¿Qué otra cosa podría ser?{shape.asks.length > 1 ? ' Pensá dos ideas distintas.' : ''}
            </span>
          </p>

          {answer === null ? (
            <div className="mt-2 space-y-1.5">
              {shape.asks.map((label, k) => (
                <label key={label} className="block">
                  <span className="block text-base font-semibold leading-tight text-slate-600">{label}</span>
                  <input
                    type="text"
                    value={values[k]}
                    maxLength={60}
                    autoComplete="off"
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === k ? e.target.value : x)))}
                    className="mt-0.5 min-h-[46px] w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-tiam-blue focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/30"
                  />
                </label>
              ))}
            </div>
          ) : (
            <div ref={ideasRef} role="status" className="mt-2 scroll-mb-20 rounded-2xl border border-tiam-green/30 bg-tiam-green/5 px-3 py-2 text-base text-slate-700">
              <p className="font-semibold text-slate-900">
                {answer.length ? `Tu idea: ${answer.map((a) => `«${a}»`).join(' y ')}.` : '¡Muy bien, la pensaste!'}
              </p>
              <p className="mt-1 flex items-start gap-1.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-tiam-orange" aria-hidden="true" />
                <span>
                  Otras ideas posibles: {shape.ideas.join(', ')}.
                </span>
              </p>
            </div>
          )}

          {/* The buttons stick to the bottom of the card, so they are always in view on a short phone. */}
          <div className="sticky bottom-0 z-10 mt-2 flex gap-2 bg-white/95 pb-0.5 pt-1">
            {answer === null ? (
              <>
                <button
                  type="button"
                  onClick={(e) => submit(false, e.timeStamp)}
                  className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white px-3 text-lg font-bold text-slate-700 transition hover:border-tiam-blue/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50"
                >
                  La pensé
                </button>
                <button
                  type="submit"
                  disabled={!ready}
                  className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-tiam-blue px-3 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
                >
                  Listo
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => next(e.timeStamp)}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1"
              >
                {idx < total - 1 ? 'Seguir' : 'Terminar el nivel'}
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </form>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Pensaste ideas para las {total} formas. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {shapes.map((s, i) => (
              <li key={s.not} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="text-slate-500">No es {s.not}: </span>
                  <span className="font-bold text-slate-900">{history[i] ? history[i]!.join(' · ') : 'lo pensaste'}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
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

export function EstoNoEs({ onComplete }: GameProps) {
  // The order of the shapes of each level — decided once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    // Open game: there is no wrong answer, so nothing is a mistake.
    onComplete({ mistakes: 0, totalAttempts: TOTAL_SHAPES })
  }
  function handleStart(at: number) {
    setSince(at)
    setPhase('playing')
  }
  function handleNext(at: number) {
    setSince(at)
    setLevelIdx((i) => i + 1)
  }
  function handleRepeat(at: number) {
    setSince(at)
    setLevelIdx(0)
    setRunKey((k) => k + 1)
  }

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué más puede ser?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      shapes={epoch[levelIdx]}
      since={since}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
