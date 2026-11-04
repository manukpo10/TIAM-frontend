import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Mirá el dibujo" — día 2, mes 6, atención. A drawing of an everyday scene and a few sentences about it: the player
 * says whether each one is true or false. In levels 1 and 2 the drawing stays on screen while the sentences are
 * answered; in level 3 it is shown first, for as long as the player wants ("Ya lo miré"), and then it is hidden, so
 * the sentences are answered from what was seen. The mechanic comes from a worksheet where a drawn bedroom is followed
 * by sixteen true-or-false sentences; here the scenes and the sentences are TIAM's own.
 *
 * OWN SCENES. The three drawings are TIAM's own Flux illustrations (src/assets/desafio/games/mira-el-dibujo): a
 * kitchen where an older woman has tea, a square with a fountain and a living room. Every sentence was written
 * AFTER looking at the final picture and is true or false of THAT picture (a count, a place, what someone is doing),
 * never of a general fact, and each one has a line saying what the picture shows. This is a new component: it does not
 * use the old true-or-false game that is not wired into any month. A throwaway script (not committed) checks that
 * every level has both true and false sentences and no sentence repeats in the day.
 *
 * AN ANSWER, THEN WHY. A right answer turns green; a wrong one costs ONE mistake and is shown in muted gray (never red),
 * and either way the line that says what the picture shows appears and the player moves on with "Seguir" (a true-or-
 * false has no second try, so there is nothing to retry; no timer pushes the player along). After the last sentence of
 * level 3 the drawing comes back so the memory can be checked against it.
 *
 * THREE LEVELS: 3 / 3 / 4 sentences (a day of about ten answers, as the tallerista likes the days short). The ramp is the
 * drawing: visible with obvious details, visible with counts and activities, and finally from memory. The order of
 * the sentences of each level is chosen ONCE at mount (`epoch`), so "Repetir" replays the same ten in the same order.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that changed the screen is
 * ignored (the buttons of one step sit where the buttons of the previous one were), and an answered sentence cannot be
 * answered again.
 *
 * totalAttempts = mistakes + every sentence of the day (TOTAL_SENTENCES, derived).
 */

// ── data:start ──
type SceneId = 'cocina' | 'plaza' | 'living'

interface Sentence {
  text: string
  truth: boolean
  /** What the picture shows: said after the answer. */
  why: string
}
interface LevelDef {
  name: string
  scene: SceneId
  /** Shown first and then hidden (level 3). */
  fromMemory: boolean
  sentences: Sentence[]
}

const SCENES: Record<SceneId, { alt: string }> = {
  cocina: { alt: 'Ilustración de una cocina: una señora de pelo plateado está sentada a una mesa con una tetera, dos tazas y un plato de fruta; un gato duerme en una silla.' },
  plaza: { alt: 'Ilustración de una plaza con una fuente: un señor con gorra lee el diario en un banco y una señora pasea a un perro; hay dos palomas y un carrito.' },
  living: { alt: 'Ilustración de un living: un sofá con dos almohadones, una biblioteca, una lámpara de pie, una señora en un sillón y un perro dormido sobre la alfombra.' },
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    scene: 'cocina',
    fromMemory: false,
    sentences: [
      { text: 'Sobre la mesa hay una tetera.', truth: true, why: 'La tetera roja está en el medio de la mesa.' },
      { text: 'Hay un perro durmiendo en una silla.', truth: false, why: 'En la silla duerme un gato, no un perro.' },
      { text: 'Hay una planta en la ventana.', truth: true, why: 'La planta está en una maceta, sobre el borde de la ventana.' },
    ],
  },
  {
    name: 'Nivel 2',
    scene: 'plaza',
    fromMemory: false,
    sentences: [
      { text: 'Hay dos palomas cerca de la fuente.', truth: true, why: 'Hay una paloma a cada lado de la fuente, en el piso.' },
      { text: 'El señor del banco está tomando mate.', truth: false, why: 'El señor está leyendo el diario.' },
      { text: 'La señora pasea a su perro con correa.', truth: true, why: 'El perro va atado con una correa, al lado de la señora.' },
    ],
  },
  {
    name: 'Nivel 3',
    scene: 'living',
    fromMemory: true,
    sentences: [
      { text: 'En el sofá hay dos almohadones naranjas.', truth: true, why: 'Hay un almohadón naranja en cada punta del sofá.' },
      { text: 'El perro está durmiendo en el sofá.', truth: false, why: 'El perro duerme sobre la alfombra, no en el sofá.' },
      { text: 'La lámpara de pie está al lado de la biblioteca.', truth: false, why: 'La lámpara está del otro lado: al lado del sillón de la señora.' },
      { text: 'La señora del sillón tiene una manta sobre las piernas.', truth: true, why: 'Una manta blanca le cubre las piernas.' },
    ],
  },
]
const TOTAL_SENTENCES = LEVELS.reduce((sum, lvl) => sum + lvl.sentences.length, 0)
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

const IMAGES = import.meta.glob('../../../assets/desafio/games/mira-el-dibujo/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imageFor(id: SceneId): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

/** The order of the sentences of each level: decided once, at mount. */
function buildEpoch(): Sentence[][] {
  return LEVELS.map((lvl) => shuffle(lvl.sentences))
}

const PRAISE = ['¡Muy bien!', '¡Qué buen ojo!', '¡Así se hace!', '¡Excelente!', '¡Perfecto!']
/** A tap this soon after the tap that changed the screen ("Empezar", "Seguir", "Ya lo miré", "Siguiente nivel",
 * "Repetir") is the second tap of a double tap: the next step's buttons sit where that button was. */
const SETTLE_MS = 400

function Scene({ id, className = '' }: { id: SceneId; className?: string }) {
  return (
    <img
      src={imageFor(id)}
      alt={SCENES[id].alt}
      className={`mx-auto aspect-[960/549] w-full max-w-md rounded-2xl border-2 border-slate-100 bg-white object-cover ${className}`}
    />
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá el dibujo con atención.',
    'Leé cada frase y tocá «Verdadero» o «Falso», según lo que se ve en el dibujo.',
    'En el último nivel el dibujo se esconde: ¡fijate bien antes!',
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
  sentences: Sentence[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, sentences, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = sentences.length

  // Level 3 starts by studying the drawing; the others go straight to the sentences.
  const [phase, setPhase] = useState<'study' | 'ask' | 'done'>(level.fromMemory ? 'study' : 'ask')
  const [qIdx, setQIdx] = useState(0)
  // What the player answered for the current sentence (null until answered).
  const [answer, setAnswer] = useState<boolean | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same answer, but readable at once: a double tap lands before React has repainted.
  const answeredRef = useRef(false)
  // When the screen last changed because of a tap (that tap's own timeStamp): every tap within SETTLE_MS is ignored.
  const settleFromRef = useRef(since)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    if (phase !== 'done') topRef.current?.scrollIntoView({ block: 'start' })
  }, [phase])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (phase !== 'done' || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [phase])

  const current = sentences[qIdx]

  function startAsking(at: number) {
    if (at - settleFromRef.current < SETTLE_MS) return
    settleFromRef.current = at
    setPhase('ask')
  }
  function answerWith(value: boolean, at: number) {
    if (answeredRef.current || at - settleFromRef.current < SETTLE_MS) return
    answeredRef.current = true
    settleFromRef.current = at
    setAnswer(value)
    if (value !== current.truth) onMistake()
  }
  function next(at: number) {
    if (answer === null || at - settleFromRef.current < SETTLE_MS) return
    settleFromRef.current = at
    if (qIdx < total - 1) {
      answeredRef.current = false
      setQIdx((i) => i + 1)
      setAnswer(null)
    } else {
      setPraise(pickOne(PRAISE))
      setPhase('done')
      onSolved()
    }
  }

  const answered = answer !== null
  const right = answered && answer === current.truth

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {phase === 'ask' && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Frase {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {phase === 'study' && (
        <>
          <h2 className="mt-3 text-balance text-center text-xl font-bold leading-snug text-slate-900 sm:text-2xl">Mirá bien el dibujo</h2>
          <p className="mt-2 text-center text-base text-slate-500">
            Después se va a esconder y te vamos a preguntar por lo que había. Fijate en las cosas, en las personas y en lo que hacen.
          </p>
          <div className="mt-3">
            <Scene id={level.scene} />
          </div>
          <div className="sticky bottom-3 z-10 mt-4 text-center">
            <button
              type="button"
              onClick={(e) => startAsking(e.timeStamp)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
            >
              Ya lo miré
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {phase === 'ask' && (
        <>
          {!level.fromMemory ? (
            <div className="mt-3">
              <Scene id={level.scene} />
            </div>
          ) : (
            <p className="mt-3 text-center text-base font-medium text-slate-500">Respondé de memoria, sin mirar el dibujo.</p>
          )}

          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-tiam-blue">¿Verdadero o falso?</p>
            <p className="mt-1 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{current.text}</p>
          </div>

          <div role="group" aria-label="Respuesta" className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-3">
            {[true, false].map((value) => {
              const chosen = answer === value
              const isTheRight = answered && current.truth === value
              return (
                <button
                  key={String(value)}
                  type="button"
                  disabled={answered}
                  onClick={(e) => answerWith(value, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] items-center justify-center gap-1.5 rounded-2xl border-2 text-lg font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isTheRight
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : answered && chosen
                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                        : answered
                          ? 'border-slate-200 bg-white text-slate-400'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md active:bg-tiam-blue/5',
                  ].join(' ')}
                >
                  {isTheRight && <Check className="h-5 w-5 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
                  {value ? 'Verdadero' : 'Falso'}
                </button>
              )
            })}
          </div>

          <div role="status" className="mx-auto mt-3 min-h-[5.5rem] max-w-md text-center">
            {answered && (
              <>
                <p className={`text-base font-semibold ${right ? 'text-green-700' : 'text-slate-600'}`}>
                  {right ? '¡Eso es!' : `Era ${current.truth ? 'verdadero' : 'falso'}.`} {current.why}
                </p>
                <button
                  type="button"
                  onClick={(e) => next(e.timeStamp)}
                  className="mt-3 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
                >
                  Seguir
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Level complete */}
      {phase === 'done' && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Respondiste las {total} frases. ¡Completaste el {level.name.toLowerCase()}!</p>
          {level.fromMemory && (
            <div className="mt-3">
              <p className="mb-2 text-base font-semibold text-slate-600">Así era el dibujo:</p>
              <Scene id={level.scene} />
            </div>
          )}
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

export function MiraElDibujo({ onComplete }: GameProps) {
  // The order of the sentences of each level — decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_SENTENCES })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Verdadero o falso?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      sentences={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
