import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles, X } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El refrán del dibujo" — día 20, mes 6, lenguaje. An illustration with no words in it and four refranes (popular
 * sayings): the player taps the one the picture stands for. The mechanic comes from a worksheet where each refrán is
 * drawn as a rebus of little pictures and the player says which refrán it is; here the nine pictures are TIAM's own
 * Flux illustrations (src/assets/desafio/games/refranes-en-imagenes), one scene for each refrán, and the refranes
 * are traditional sayings that belong to nobody.
 *
 * ORIGINAL CONTENT AND CARE WITH THE PICTURES. The worksheet shows its pictures and writes the answer of only one of
 * them (a saying about God): that one is not used, nor are the drawings or the rebus of the worksheet. The refranes
 * were chosen for pictures of TIAM's own; none names a religious figure and nothing is violent (no noose, no
 * straitjacket). Every picture was looked at after being generated and shows, visibly, what its `why` line says: a cat
 * with red mittens on its front paws next to a mouse, sheep standing in pairs, a wall with an ear on each side of its
 * window, a big fish with its mouth open in front of a tiny one, a loud trumpet beside only two walnuts, a horse with a
 * gift ribbon whose teeth are looked at with a magnifying glass, a shrimp asleep on a leaf that the current carries, a
 * clay jug with a zig-zag crack that leaks drops at the edge of a well and a smiling face under a red umbrella in a
 * downpour. The answers were searched in every game of src/pages/desafio/games (months 1 to 6) and none of the nine
 * refranes is the answer of another game; two refranes (a tree that is born crooked, a bird in the hand) were replaced
 * because month 2's "Dichos a medias" already has them. Each picture was made to fit ONE refrán of its options and not
 * the other three (the wrong options of a question are never the right answer of another). A throwaway script (not
 * committed) checks that the four options of every question are different, that no refrán is the right answer of two
 * questions and that no wrong option is the right answer of another one.
 *
 * THREE PICTURES A LEVEL, as the tallerista likes the days short. The ramp is the options: in level 1 the four
 * refranes are about different things, in level 2 they share some theme with the picture (animals, noise, a gift) and
 * in level 3 the options stay close to the picture's subject (the river, water and the kitchen, the weather), so the
 * picture has to be read, not just recognised. The order of the questions of each level and of the options of
 * each question is chosen ONCE at mount (`epoch`), so "Repetir" replays exactly the same nine pictures.
 *
 * A wrong refrán costs ONE mistake, turns muted gray (never red) and stays off; the right one can still be tapped.
 * Once the right one is chosen the wrong ones go away, the line that says what the picture shows appears and the
 * player moves on with "Seguir" (it sticks to the bottom of the card, so it is always in view on a short phone).
 * Nothing is timed. The picture is sized by the screen height, so the four refranes, which have to be read, fit.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that changed the screen is ignored, and an
 * option that was refused cannot be tapped again.
 *
 * totalAttempts = mistakes + every picture of the day (TOTAL_PICTURES, derived).
 */

// ── data:start ──
interface QuestionDef {
  /** Name of the file (without .webp) in the assets folder. */
  image: string
  alt: string
  /** The refrán the picture stands for. */
  answer: string
  /** Three refranes that the picture does NOT stand for. */
  wrong: [string, string, string]
  /** What the picture shows, said after the answer. */
  why: string
}
interface LevelDef {
  name: string
  questions: QuestionDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    questions: [
      {
        image: 'gato',
        alt: 'Ilustración de un gato gris sentado en el piso de una habitación, con las dos patas delanteras metidas en grandes mitones rojos, y un ratoncito marrón parado muy cerca.',
        answer: 'Gato con guantes no caza ratones.',
        wrong: ['Lo cortés no quita lo valiente.', 'Piedra que rueda no cría moho.', 'Cada loco con su tema.'],
        why: 'El gato tiene las patas metidas en mitones rojos y el ratón está al lado, tranquilo.',
      },
      {
        image: 'ovejas',
        alt: 'Ilustración de cuatro ovejas blancas en un prado, paradas de a dos: dos pares separados por un espacio de pasto.',
        answer: 'Cada oveja con su pareja.',
        wrong: ['Zapatero, a tus zapatos.', 'Quien siembra vientos, recoge tempestades.', 'Más vale prevenir que curar.'],
        why: 'Las ovejas están paradas de a dos: cada una junto a su compañera.',
      },
      {
        image: 'paredes',
        alt: 'Ilustración de una pared de ladrillos con una ventana de postigos abiertos y una oreja rosada enorme a cada lado de la ventana.',
        answer: 'Las paredes oyen.',
        wrong: ['Ojos que no ven, corazón que no siente.', 'Gallina vieja hace buen caldo.', 'Mal de muchos, consuelo de tontos.'],
        why: 'La pared tiene una oreja a cada lado de la ventana, como si escuchara.',
      },
    ],
  },
  {
    name: 'Nivel 2',
    questions: [
      {
        image: 'pez',
        alt: 'Ilustración bajo el agua: un pez grande y naranja con la boca abierta nada hacia un pez amarillo muy chiquito que está justo delante.',
        answer: 'El pez grande se come al chico.',
        wrong: ['El pez por la boca muere.', 'Al perro flaco, todo son pulgas.', 'Lo que abunda no daña.'],
        why: 'El pez grande tiene la boca abierta frente al pececito amarillo.',
      },
      {
        image: 'nueces',
        alt: 'Ilustración de una trompeta que suena fuerte, con rayas de sonido a su alrededor, y al lado, sobre una tabla, solo dos nueces.',
        answer: 'Mucho ruido y pocas nueces.',
        wrong: ['Hablando se entiende la gente.', 'Del dicho al hecho hay mucho trecho.', 'A buen entendedor, pocas palabras.'],
        why: 'La trompeta hace muchísimo ruido, pero sobre la tabla hay apenas dos nueces.',
      },
      {
        image: 'caballo',
        alt: 'Ilustración de un caballo marrón sonriente con un moño rojo de regalo al cuello y una lupa grande delante de su boca, que muestra los dientes.',
        answer: 'A caballo regalado no se le miran los dientes.',
        wrong: ['Caballo grande, ande o no ande.', 'Cuando el gato no está, los ratones bailan.', 'Lo barato sale caro.'],
        why: 'El caballo lleva un moño de regalo y le miran los dientes con una lupa.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    questions: [
      {
        image: 'camaron',
        alt: 'Ilustración de un camarón naranja que duerme con los ojos cerrados sobre una hoja verde, en un río de corriente fuerte que arrastra la hoja.',
        answer: 'Camarón que se duerme, se lo lleva la corriente.',
        wrong: ['A río revuelto, ganancia de pescadores.', 'Agua que no has de beber, déjala correr.', 'Cuando el río suena, agua lleva.'],
        why: 'El camarón duerme sobre la hoja y el agua se lo lleva.',
      },
      {
        image: 'canta',
        alt: 'Ilustración de un cántaro grande de barro con una grieta en zigzag de la que caen gotas, apoyado en el borde de un pozo de piedra con un balde de madera colgado.',
        answer: 'Tanto va el cántaro a la fuente que al fin se rompe.',
        wrong: ['Agua que no has de beber, déjala correr.', 'No se puede nadar y guardar la ropa.', 'Cada olla tiene su tapa.'],
        why: 'El cántaro de barro ya tiene una grieta y pierde agua: de tanto ir a la fuente, se está rompiendo.',
      },
      {
        image: 'maltiempo',
        alt: 'Ilustración de una tormenta: nubes oscuras y lluvia fuerte, y debajo una carita redonda y amarilla con una sombrilla roja, que sonríe feliz.',
        answer: 'A mal tiempo, buena cara.',
        wrong: ['Después de la tormenta viene la calma.', 'Año de nieves, año de bienes.', 'No hay peor ciego que el que no quiere ver.'],
        why: 'Llueve muy fuerte y la carita sigue sonriendo bajo su sombrilla roja.',
      },
    ],
  },
]
const TOTAL_PICTURES = LEVELS.reduce((sum, lvl) => sum + lvl.questions.length, 0)
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

const IMAGES = import.meta.glob('../../../assets/desafio/games/refranes-en-imagenes/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imageFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

interface QuestionEpoch {
  q: QuestionDef
  options: string[]
}
/** The order of the questions of each level and of the options of each question: decided ONCE, at mount. */
function buildEpoch(): QuestionEpoch[][] {
  return LEVELS.map((lvl) => shuffle(lvl.questions).map((q) => ({ q, options: shuffle([q.answer, ...q.wrong]) })))
}

const PRAISE = ['¡Muy bien!', '¡Qué buen ojo!', '¡Así se hace!', '¡Excelente!', '¡Qué buenos refranes!']
/** A tap this soon after the tap that changed the screen is the second tap of a double tap and must not land. */
const SETTLE_MS = 400

function Picture({ q }: { q: QuestionDef }) {
  return (
    <img
      src={imageFor(q.image)}
      alt={q.alt}
      className="mx-auto aspect-[4/3] h-[21vh] max-h-[230px] min-h-[110px] w-auto rounded-2xl border-2 border-slate-100 bg-white object-cover"
    />
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá la ilustración con atención: no tiene letras, cuenta un refrán con dibujos.',
    'Entre los cuatro refranes, tocá el que le corresponde. Si no es, probá con otro.',
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
  items: QuestionEpoch[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, items, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = items.length

  const [idx, setIdx] = useState(0)
  const [wrongTaps, setWrongTaps] = useState<string[]>([])
  const [solved, setSolved] = useState(false)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const settleFromRef = useRef(since)
  const solvedRef = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const { q, options } = items[idx]
  const settled = (at: number) => at - settleFromRef.current >= SETTLE_MS

  function pick(option: string, at: number) {
    if (solvedRef.current || wrongTaps.includes(option) || !settled(at)) return
    settleFromRef.current = at
    if (option === q.answer) {
      solvedRef.current = true
      setSolved(true)
      return
    }
    setWrongTaps((w) => [...w, option])
    onMistake()
  }
  function next(at: number) {
    if (!solved || !settled(at)) return
    settleFromRef.current = at
    if (idx < total - 1) {
      solvedRef.current = false
      setIdx((i) => i + 1)
      setWrongTaps([])
      setSolved(false)
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
            Ilustración {idx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          <div className="mt-2">
            <Picture q={q} />
          </div>

          <div role="group" aria-label="Refranes" className="mx-auto mt-2 max-w-md space-y-1">
            {options.map((option) => {
              const isRight = solved && option === q.answer
              const wrong = wrongTaps.includes(option)
              // Once the right refrán is chosen, only it stays.
              if (solved && !isRight) return null
              return (
                <button
                  key={option}
                  type="button"
                  disabled={solved || wrong}
                  onClick={(e) => pick(option, e.timeStamp)}
                  className={[
                    'flex min-h-[48px] w-full items-center gap-2 rounded-2xl border-2 px-3 py-1 text-left text-base font-semibold leading-snug transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRight
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : wrong
                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md active:bg-tiam-blue/5',
                  ].join(' ')}
                >
                  {isRight && <Check className="h-5 w-5 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
                  {wrong && <X className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={3} aria-hidden="true" />}
                  <span>{option}</span>
                  {wrong && <span className="sr-only"> (no es este)</span>}
                </button>
              )
            })}
          </div>

          {/* Once the right refrán is chosen, the explanation and "Seguir" stick to the bottom of the card, so the way on is
              always in view on a short phone. Before that nothing sticks, so the four refranes are never covered. */}
          {solved && (
            <div role="status" className="sticky bottom-0 z-10 mx-auto mt-1 max-w-md bg-white/95 pb-1 pt-1 text-center">
              <p className="text-base font-semibold text-green-700">¡Eso es! {q.why}</p>
              <button
                type="button"
                onClick={(e) => next(e.timeStamp)}
                className="mt-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
              >
                {idx < total - 1 ? 'Seguir' : 'Terminar el nivel'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Reconociste los {total} refranes. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {items.map(({ q: item }) => (
              <li key={item.answer} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span className="font-semibold text-slate-900">{item.answer}</span>
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

export function RefranesEnImagenes({ onComplete }: GameProps) {
  // The order of the pictures and of their refranes — decided once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PICTURES })
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
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué refrán es?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      items={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
