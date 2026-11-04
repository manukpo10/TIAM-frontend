import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "En mi barrio" — día 5, mes 6, orientación. The places of a neighbourhood and what each one is for. Level 1: a
 * drawing of a place and three names, tap the one that names it. Level 2: an errand ("Necesitás un kilo de tomates y
 * una lechuga") and three places drawn with their names: tap where you would go. Level 3: errands again, but the four
 * options are always the four food shops, so the errand has to be read for what it really asks (a cut of beef, fruit,
 * something baked, an ice-cream flavour). It comes from a worksheet where the places of a neighbourhood are joined with
 * their pictures; none of its drawings, its list of places or its text is here, and its places are Spanish ones
 * (a metro station, a university) while these are the ones of an Argentine barrio: panadería, verdulería, kiosco, plaza.
 *
 * OWN PICTURES. Each of the fourteen places is a TIAM Flux illustration (src/assets/desafio/games/en-mi-barrio, soft flat
 * style, no signs with writing) and every one was looked at: what the errands say can really be told from the picture
 * (bread and loaves in the bakery window, tools and a ladder at the hardware store, a green cross at the pharmacy).
 * The second and third level never put in the options a place that also sells what the errand asks for: the kiosco,
 * which sells a bit of everything, is left out of them, and in level 3 only the right shop sells what the errand
 * names (the answers of the day are also all different, so each place is the right one once). A throwaway script (not committed)
 * checks that no right place is repeated in the day, that the options of an item are different and contain the right
 * one and that every picture exists.
 *
 * NO LOSING WORDS. A wrong place costs ONE mistake and goes muted gray (never red); the first miss only says to think a
 * little more and the second one gives a clue about what that place is for. Nothing is timed but a short pause so the
 * right place is seen before the next question.
 *
 * THREE QUESTIONS A LEVEL, as the tallerista likes the days short. Each level has a pool of four or five items and three
 * are picked ONCE at mount (`epoch`, with the order of the options), so "Repetir" replays exactly the same nine.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is
 * ignored (the options sit where that button was) and an option already tapped is a disabled button with a ref guard on
 * top, so a double tap counts ONE mistake.
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived).
 */

// ── data:start ──
type PlaceId =
  | 'panaderia'
  | 'farmacia'
  | 'verduleria'
  | 'carniceria'
  | 'kiosco'
  | 'plaza'
  | 'banco'
  | 'correo'
  | 'ferreteria'
  | 'peluqueria'
  | 'libreria'
  | 'heladeria'
  | 'floreria'
  | 'zapateria'

const PLACE_NAMES: Record<PlaceId, string> = {
  panaderia: 'Panadería',
  farmacia: 'Farmacia',
  verduleria: 'Verdulería',
  carniceria: 'Carnicería',
  kiosco: 'Kiosco',
  plaza: 'Plaza',
  banco: 'Banco',
  correo: 'Correo',
  ferreteria: 'Ferretería',
  peluqueria: 'Peluquería',
  libreria: 'Librería',
  heladeria: 'Heladería',
  floreria: 'Florería',
  zapateria: 'Zapatería',
}

/** Which places are masculine: "el banco", "al banco". */
const MASCULINE: PlaceId[] = ['kiosco', 'banco', 'correo']
function the(place: PlaceId): string {
  return `${MASCULINE.includes(place) ? 'el' : 'la'} ${PLACE_NAMES[place].toLowerCase()}`
}
function goTo(place: PlaceId): string {
  return `${MASCULINE.includes(place) ? 'al' : 'a la'} ${PLACE_NAMES[place].toLowerCase()}`
}

interface ItemDef {
  /** The right place. */
  answer: PlaceId
  /** The places on offer, the right one among them. */
  options: PlaceId[]
  /** The errand (levels 2 and 3); level 1 shows the drawing of the place instead. */
  errand?: string
  /** A clue after the second miss. */
  tip: string
}
interface LevelDef {
  name: string
  /** 'picture': a drawing and names. 'errand': an errand and drawings with their names. */
  kind: 'picture' | 'errand'
  /** Pool of items; QUESTIONS_PER_LEVEL of them are played. */
  pool: ItemDef[]
}

const QUESTIONS_PER_LEVEL = 3

const FOOD_SHOPS: PlaceId[] = ['panaderia', 'carniceria', 'verduleria', 'heladeria']

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    kind: 'picture',
    pool: [
      { answer: 'farmacia', options: ['farmacia', 'ferreteria', 'plaza'], tip: 'Ahí se compran los remedios.' },
      { answer: 'plaza', options: ['plaza', 'heladeria', 'correo'], tip: 'Tiene árboles, asientos para descansar y juegos.' },
      { answer: 'kiosco', options: ['kiosco', 'floreria', 'banco'], tip: 'Venden diarios, revistas, golosinas y gaseosas.' },
      { answer: 'correo', options: ['correo', 'carniceria', 'zapateria'], tip: 'Ahí se mandan las cartas y los paquetes.' },
      { answer: 'banco', options: ['banco', 'panaderia', 'libreria'], tip: 'Ahí se guarda y se retira el dinero.' },
    ],
  },
  {
    name: 'Nivel 2',
    kind: 'errand',
    pool: [
      { answer: 'peluqueria', options: ['peluqueria', 'farmacia', 'verduleria'], errand: 'Querés cortarte el pelo para la fiesta del sábado.', tip: 'Ahí hay tijeras, peines y espejos.' },
      { answer: 'floreria', options: ['floreria', 'banco', 'carniceria'], errand: 'Querés llevarle un ramo de flores a tu hermana para su cumpleaños.', tip: 'Ahí se venden ramos y plantas.' },
      { answer: 'zapateria', options: ['zapateria', 'correo', 'plaza'], errand: 'Se te gastaron las zapatillas y necesitás un par nuevo.', tip: 'Ahí se compran zapatos, zapatillas y pantuflas.' },
      { answer: 'ferreteria', options: ['ferreteria', 'heladeria', 'correo'], errand: 'Se te rompió la canilla y necesitás una llave y un caño nuevo.', tip: 'Ahí se venden herramientas y materiales para arreglar la casa.' },
      { answer: 'libreria', options: ['libreria', 'farmacia', 'plaza'], errand: 'Tu nieta necesita carpeta, hojas y lapiceras para el colegio.', tip: 'Ahí se venden libros, cuadernos y útiles.' },
    ],
  },
  // Level 3: the four options are ALWAYS the four food shops, so the errand has to be read for what it asks (a cut of meat,
  // fruit, something baked, an ice cream flavour) and does not name the shop or what it sells in general.
  {
    name: 'Nivel 3',
    kind: 'errand',
    pool: [
      { answer: 'panaderia', options: FOOD_SHOPS, errand: 'Querés unas medialunas calentitas para acompañar el mate.', tip: 'Ahí se hornean los panes, las facturas y las medialunas.' },
      { answer: 'carniceria', options: FOOD_SHOPS, errand: 'Para el guiso del domingo necesitás un kilo de peceto.', tip: 'El peceto es un corte de carne.' },
      { answer: 'verduleria', options: FOOD_SHOPS, errand: 'Para la ensalada de frutas necesitás duraznos, bananas y manzanas.', tip: 'Las frutas se compran donde venden las verduras.' },
      { answer: 'heladeria', options: FOOD_SHOPS, errand: 'Para el postre del cumpleaños querés un cuarto kilo de dulce de leche granizado.', tip: 'El granizado es un gusto de helado.' },
    ],
  },
]
const TOTAL_QUESTIONS = LEVELS.length * QUESTIONS_PER_LEVEL

/** The errand of the how-to screen: it is not in the game. */
const EXAMPLE = { errand: 'Querés comprar el diario y una revista.', place: 'kiosco' as PlaceId }
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

const IMAGES = import.meta.glob('../../../assets/desafio/games/en-mi-barrio/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imageFor(id: PlaceId): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

interface PreparedItem {
  def: ItemDef
  /** The options in the order they show. */
  options: PlaceId[]
}
function buildEpoch(): PreparedItem[][] {
  return LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, QUESTIONS_PER_LEVEL).map((def) => ({ def, options: shuffle(def.options) })))
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Conocés bien el barrio!', '¡Perfecto!']
/** The pause after the right place, with it on screen, before the next question. */
const ADVANCE_MS = 1500
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a place: the options sit where that button was. */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = ['Primero mirás un dibujo y elegís cómo se llama el lugar.', 'Después te contamos un mandado y tocás el lugar a donde irías.']
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
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">«{EXAMPLE.errand}»</p>
        <p className="mt-2 text-base text-slate-600">
          Irías <span className="font-bold text-slate-900">{goTo(EXAMPLE.place)}</span>.
        </p>
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
  items: PreparedItem[]
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
  const byPicture = level.kind === 'picture'

  const [qIdx, setQIdx] = useState(0)
  // Options already tapped wrong in the current question, and the one that was right.
  const [wrong, setWrong] = useState<PlaceId[]>([])
  const [right, setRight] = useState<PlaceId | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same options, but readable at once: a double tap lands before React has repainted the button as disabled.
  const tappedRef = useRef<Set<string>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

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

  const current = items[qIdx]
  const busy = advancing || done

  function choose(place: PlaceId, at: number) {
    if (busy || at - since < SETTLE_MS) return
    const key = `${qIdx}-${place}`
    if (tappedRef.current.has(key)) return
    tappedRef.current.add(key)
    if (place === current.def.answer) {
      setRight(place)
      setAdvancing(true)
      setHint({ text: byPicture ? `¡Eso es! Es ${the(place)}.` : `¡Eso es! Para eso vas ${goTo(place)}.`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setWrong([])
          setRight(null)
          setHint(null)
          setAdvancing(false)
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    const n = wrong.length + 1
    setWrong((w) => [...w, place])
    setHint({ text: n === 1 ? 'Ese no es. Pensalo un poco más.' : `Ese tampoco. ${current.def.tip}`, ok: false })
    onMistake()
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
            Pregunta {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && byPicture && (
        <>
          <h2 className="mt-2 text-balance text-center text-lg font-bold leading-snug text-slate-900 sm:text-2xl">¿Qué lugar es este?</h2>
          <img
            src={imageFor(current.def.answer)}
            alt="Dibujo de un lugar del barrio"
            className="mx-auto mt-2 aspect-[16/10] w-full max-w-[300px] rounded-2xl border-2 border-slate-100 bg-white object-cover"
          />
          <div role="group" aria-label="Nombres" className="mx-auto mt-2 flex max-w-md flex-col gap-1.5">
            {current.options.map((place) => {
              const isRight = right === place
              const isWrong = wrong.includes(place)
              return (
                <button
                  key={place}
                  type="button"
                  disabled={busy || isWrong}
                  onClick={(e) => choose(place, e.timeStamp)}
                  className={[
                    'flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 px-3 text-xl font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRight
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md active:bg-tiam-blue/5',
                  ].join(' ')}
                >
                  {isRight && <Check className="h-5 w-5 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
                  {PLACE_NAMES[place]}
                </button>
              )
            })}
          </div>
        </>
      )}

      {!done && !byPicture && (
        <>
          <div className="mx-auto mt-2 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-1.5 text-center">
            <p className="text-xl font-bold leading-snug text-slate-900">{current.def.errand}</p>
          </div>
          {/* Three places: one under the other, each with a big drawing at its side (a row of three does not fit the names
              of a 320px phone). Four places: two by two. */}
          <div
            role="group"
            aria-label="Lugares"
            className={`mx-auto mt-2 grid max-w-md gap-1.5 ${current.options.length === 3 ? 'grid-cols-1' : 'grid-cols-2'}`}
          >
            {current.options.map((place) => {
              const isRight = right === place
              const isWrong = wrong.includes(place)
              const row = current.options.length === 3
              return (
                <button
                  key={place}
                  type="button"
                  disabled={busy || isWrong}
                  aria-label={PLACE_NAMES[place]}
                  onClick={(e) => choose(place, e.timeStamp)}
                  className={[
                    row ? 'relative flex items-center gap-3 rounded-2xl border-2 p-1.5 text-left transition' : 'relative flex flex-col items-center rounded-2xl border-2 p-1.5 transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRight
                      ? 'border-tiam-green bg-tiam-green/10 ring-2 ring-tiam-green/30'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100'
                        : 'border-slate-200 bg-white hover:border-tiam-blue/40 hover:shadow-md active:bg-tiam-blue/5',
                  ].join(' ')}
                >
                  <img
                    src={imageFor(place)}
                    alt=""
                    className={`rounded-xl object-cover ${row ? 'aspect-[4/3]' : 'aspect-[16/10]'} ${row ? 'w-20 shrink-0' : 'w-full'} ${isWrong ? 'opacity-35 grayscale' : ''}`}
                  />
                  <span className={`${row ? 'text-xl' : 'mt-1 text-base'} font-bold leading-tight ${isWrong ? 'text-slate-400' : 'text-slate-900'}`}>{PLACE_NAMES[place]}</span>
                  {isRight && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                      <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {!done && (
        <p
          role="status"
          className={`mx-auto mt-1 min-h-[2.5rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
        >
          {hint?.text}
        </p>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Respondiste las {total} preguntas. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {items.map(({ def }) => (
              <li key={def.answer} className="flex items-center gap-2 rounded-xl bg-white px-2 py-2">
                <img src={imageFor(def.answer)} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" />
                <span>
                  <span className="font-bold text-slate-900">{PLACE_NAMES[def.answer]}</span>
                  {def.errand && <span className="text-slate-500"> — {def.errand}</span>}
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

export function EnMiBarrio({ onComplete }: GameProps) {
  // Which items each level plays and the order of their options — decided once, at mount, so "Repetir" replays
  // exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Los lugares del barrio</h2>
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
