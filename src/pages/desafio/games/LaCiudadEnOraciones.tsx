import { useEffect, useRef, useState } from 'react'
import { ArrowRight, PencilLine, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La ciudad en oraciones" — día 28, mes 6, lenguaje. A pen-and-paper day that is a `game` (not a `card`) because it
 * needs a picture: TIAM's own Flux illustration of a city corner (a bakery, a bus stop, a small plaza with a fountain)
 * stays on screen while the player writes, on a sheet of paper or aloud, a few sentences about it. The mechanic, writing
 * sentences about a picture of a city, comes from a worksheet; the picture, the prompts and the wording are TIAM's own.
 *
 * NOTHING TO GET WRONG. Nothing is typed and nothing is checked: the player writes on paper (or says the sentences) and
 * taps "Ya las escribí" when done. The day reports `mistakes: 0` and `totalAttempts` = the number of prompts, once the
 * third level is finished. Every prompt can be answered from what is really drawn in the picture (the bakery with its
 * loaves and its awning, the woman in the yellow coat with a bag, the red bus and the person with the red umbrella, the
 * yellow taxi and the traffic light, the fountain, the older man on the bench with his dog and the pigeons, the girl with
 * the pink kite).
 *
 * THREE LEVELS, TWO PROMPTS EACH, the same picture. The ramp is what is asked of the writer: level 1 names and places
 * things ("a sentence about the bakery"), level 2 describes what people are doing, level 3 invents (what the woman will
 * cook, a person chosen by the player and three sentences that tell who it is, where they go and what happens). The
 * picture is one fixed illustration and there is nothing drawn at mount, so "Repetir" shows the same day again.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. A tap within SETTLE_MS of the tap that brought the level is ignored.
 */

// ── data:start ──
interface LevelDef {
  name: string
  /** What is asked in this level. */
  title: string
  prompts: string[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    title: 'Mirá y nombrá',
    prompts: [
      'Escribí una oración sobre la panadería: qué se ve en su vidriera o quién está en la puerta.',
      'Escribí una oración sobre el colectivo y las personas que lo esperan.',
    ],
  },
  {
    name: 'Nivel 2',
    title: 'Contá lo que pasa',
    prompts: [
      'Escribí una oración sobre lo que hace el señor sentado en el banco de la plaza.',
      'Escribí una oración sobre la nena que está cerca de la fuente.',
    ],
  },
  {
    name: 'Nivel 3',
    title: 'Imaginá',
    prompts: [
      'Escribí dos oraciones: qué va a cocinar la mujer del tapado amarillo con lo que compró.',
      'Elegí a una persona y escribí tres oraciones: quién es, a dónde va y qué le pasa.',
    ],
  },
]
const TOTAL_PROMPTS = LEVELS.reduce((n, l) => n + l.prompts.length, 0)

const PICTURE_ALT =
  'Ilustración de una esquina de ciudad en un día de sol: a la izquierda una panadería con toldo a rayas verdes y panes en la vidriera, una mujer con tapado amarillo y una bolsa; en el centro un colectivo rojo y blanco en la parada, con una persona con paraguas rojo, un taxi amarillo y un semáforo; a la derecha una plaza con una fuente, un señor sentado en un banco con un perro, palomas y una nena con un barrilete rosa. Atrás, edificios con balcones llenos de plantas.'
// ── data:end ──

const IMAGES = import.meta.glob('../../../assets/desafio/games/la-ciudad-en-oraciones/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const PICTURE = Object.entries(IMAGES).find(([path]) => path.endsWith('/ciudad.webp'))?.[1]

const PRAISE = ['¡Muy bien!', '¡Qué lindas oraciones!', '¡Así se hace!', '¡Excelente!', '¡Cuánta imaginación!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
/** A tap this soon after the tap that brought the level is the second tap of a double tap and is ignored. */
const SETTLE_MS = 400

const NEXT_BUTTON =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-2'

function Picture() {
  if (!PICTURE) return null
  return (
    <img
      src={PICTURE}
      alt={PICTURE_ALT}
      width={960}
      height={640}
      className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 [@media(max-height:700px)]:max-w-[250px]"
    />
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá la ilustración con calma. Tomá una hoja y un lápiz.',
    'Escribí las oraciones que pide cada nivel. Si preferís, decilas en voz alta. No hay respuestas correctas ni incorrectas.',
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
        <button type="button" onClick={(e) => onStart(e.timeStamp)} className={NEXT_BUTTON}>
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface LevelViewProps {
  levelIdx: number
  since: number
  onFinished: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, since, onFinished, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const topRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  function finish(at: number) {
    if (done || at - since < SETTLE_MS) return
    setPraise(pickOne(PRAISE))
    setDone(true)
    if (isLast) onFinished()
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        <span className="ml-3 align-middle text-base font-semibold text-slate-500">{level.title}</span>
      </div>

      <div className="mt-2">
        <Picture />
      </div>

      {!done && (
        <>
          <ol className="mx-auto mt-3 max-w-md space-y-2">
            {level.prompts.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-base font-medium leading-snug text-slate-800">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          <div className="sticky bottom-0 z-10 mx-auto mt-3 max-w-md bg-white/95 pb-1 pt-1 text-center">
            <button type="button" onClick={(e) => finish(e.timeStamp)} className={`${NEXT_BUTTON} w-full`}>
              <PencilLine className="h-5 w-5" aria-hidden="true" />
              Ya las escribí
            </button>
          </div>
        </>
      )}

      {done && (
        <div ref={resultRef} className="mt-3 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">¡Completaste el {level.name.toLowerCase()}!</p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button type="button" onClick={(e) => onRepeat(e.timeStamp)} className={NEXT_BUTTON}>
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button type="button" onClick={(e) => onNext(e.timeStamp)} className={NEXT_BUTTON}>
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

export function LaCiudadEnOraciones({ onComplete }: GameProps) {
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleFinished() {
    if (reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes: 0, totalAttempts: TOTAL_PROMPTS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Una esquina de la ciudad</h2>
        </div>
        <div className="mt-3">
          <Picture />
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      since={since}
      onFinished={handleFinished}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
