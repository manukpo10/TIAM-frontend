import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Pencil, RotateCcw, RotateCw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La ruleta de letras" — día 9, mes 5, memoria. Word retrieval with a
 * starting-letter constraint, the same family as month 4's "Tirá el dado": a
 * wheel of letters spins and stops on one, and then a few requests appear —
 * "una fruta", "un nombre de persona" — for which the player thinks of a word
 * that starts with that letter, out loud or on a sheet of paper.
 *
 * OPEN RECALL, UNGRADED, on purpose (same call as TiraElDado.tsx). Nothing here
 * can be checked from a tap: most requests have many valid answers ("una fruta
 * con M" fits manzana, mandarina, melón…), and the retrieval effort in the
 * player's own head is the exercise. So there are no mistakes: each request is
 * closed with a "Ya la pensé" tap and `onComplete` reports `mistakes: 0` with
 * one attempt per request, exactly like TiraElDado does. The `examples` of each
 * set are documentation only — they show anyone editing the data that every
 * letter + category pair has real, easy answers, and they are never rendered
 * or compared with anything.
 *
 * The wheel only ever lands on the letter the level was dealt at mount. That is
 * what lets "Repetir" replay the very same three letters: which letter each
 * level uses is decided ONCE (`epoch`, one of two authored sets per level), and
 * the spin is just the reveal. No K, W, X, Y or Ñ anywhere on the wheel, and
 * every letter is paired only with categories it has easy words for. Each level
 * also draws its requests from a pool of its own — fruta / nombre / país, then
 * prenda / oficio / transporte / comida / herramienta, then animal / objeto /
 * bebida / lugar / parte del cuerpo — so no category ever comes up twice in a run
 * ("una comida" three times in a row is not a new exercise); a throwaway Node
 * script (not committed) checked all 8 possible runs.
 *
 * `prefers-reduced-motion` is respected twice: the wheel jumps straight to its
 * letter (no spin, no wait), and the transition class is also turned off in CSS.
 * The spin is decoration, not a countdown: nothing is timed and the player
 * cannot do anything until the wheel has stopped.
 *
 * Ramp: one letter per level with 2 → 3 → 4 requests. Per-level state lives in
 * <LevelView>, keyed by run + level. A "¿Cómo se juega?" screen opens the day
 * (and mentions the sheet of paper); "Repetir" never brings it back.
 *
 * Double taps are judged by the click's own timeStamp. Every tap within SETTLE_MS of the
 * tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is ignored, so the
 * second tap of a double tap never starts the spin by itself. Where a tap puts something
 * else under the finger inside a level the same window applies: under reduced motion the
 * wheel stops at once and the requests take the place of "Girar la ruleta" (its second tap
 * would tick the first request off), and the card with its button takes the place of the
 * requests (the second tap on the one that closes the level would skip the result).
 *
 * totalAttempts = every request of the day (TOTAL_PROMPTS, derived), mistakes 0.
 */

// ── data:start ──
interface PromptSet {
  letter: string
  /** Each is shown as a request ("una fruta"): the article is part of the text. */
  categories: string[]
  /** Documentation only — never rendered or checked. */
  examples: string[][]
}
interface LevelDef {
  name: string
  sets: PromptSet[]
}

/** The wheel, clockwise from the top. Every letter has plenty of everyday words. */
const WHEEL_LETTERS = ['A', 'B', 'C', 'D', 'L', 'M', 'P', 'R', 'S', 'T']

// Every set of a level has the same number of requests, so TOTAL_PROMPTS never
// depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    sets: [
      {
        letter: 'M',
        categories: ['una fruta', 'un nombre de persona'],
        examples: [
          ['manzana', 'mandarina', 'melón', 'mora', 'mango'],
          ['María', 'Marta', 'Mario', 'Martín', 'Mónica'],
        ],
      },
      {
        letter: 'P',
        categories: ['un país', 'una fruta'],
        examples: [
          ['Perú', 'Paraguay', 'Panamá', 'Portugal', 'Polonia'],
          ['pera', 'piña', 'pomelo', 'palta', 'papaya'],
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    sets: [
      {
        letter: 'C',
        categories: ['una prenda de ropa', 'un oficio', 'un medio de transporte'],
        examples: [
          ['camisa', 'campera', 'corbata', 'chaleco', 'calcetines'],
          ['carpintero', 'cocinero', 'cartero', 'chofer', 'camionero'],
          ['colectivo', 'camión', 'canoa', 'carro', 'camioneta'],
        ],
      },
      {
        letter: 'S',
        categories: ['una comida', 'una prenda de ropa', 'una herramienta'],
        examples: [
          ['sopa', 'sándwich', 'salchicha', 'salame', 'salsa'],
          ['saco', 'short', 'sombrero', 'sandalias', 'sweater'],
          ['serrucho', 'sierra', 'soldadora', 'sacaclavos', 'segueta'],
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    sets: [
      {
        letter: 'T',
        categories: ['un animal', 'un objeto de la casa', 'una bebida', 'un lugar'],
        examples: [
          ['tigre', 'tortuga', 'toro', 'tero', 'tucán'],
          ['taza', 'tenedor', 'toalla', 'tetera', 'tijera'],
          ['té', 'tereré', 'tinto', 'tónica', 'tequila'],
          ['teatro', 'terminal', 'tienda', 'templo', 'torre'],
        ],
      },
      {
        letter: 'R',
        categories: ['un animal', 'una parte del cuerpo', 'un objeto de la casa', 'un lugar'],
        examples: [
          ['rana', 'ratón', 'rata', 'reno', 'rinoceronte'],
          ['rodilla', 'rostro', 'riñón', 'rótula'],
          ['reloj', 'radio', 'regla', 'repasador', 'ropero'],
          ['restaurante', 'rotisería', 'río', 'rambla', 'ruta'],
        ],
      },
    ],
  },
]

const TOTAL_PROMPTS = LEVELS.reduce((sum, lvl) => sum + lvl.sets[0].categories.length, 0)
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildEpoch(): PromptSet[] {
  return LEVELS.map((lvl) => pickOne(lvl.sets))
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** ['a', 'b', 'c'] → "a, b y c" */
function listWithY(items: string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

// ── The wheel: drawn once, rotated as a whole ───────────────────────────────
// Two far-apart inks of the catalog (azul, verde); the white letters have good
// contrast on both. Colour carries no information here — the letter does.
const WEDGE_FILLS = ['#1678D4', '#05741C']
const CENTER = 110
const RADIUS = 104
const STEP = 360 / WHEEL_LETTERS.length

/** How far off the middle of its wedge the wheel stops, either way: a little, still inside the wedge. At
 * module level, like `pickOne`: react-hooks/purity flags a bare Math.random() in a handler that writes a ref. */
function wobbleOf(): number {
  return (Math.random() - 0.5) * (STEP - 14)
}

function polar(radius: number, degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180
  return [CENTER + radius * Math.sin(a), CENTER - radius * Math.cos(a)]
}

const WEDGES = WHEEL_LETTERS.map((letter, i) => {
  const [x0, y0] = polar(RADIUS, STEP * i)
  const [x1, y1] = polar(RADIUS, STEP * (i + 1))
  const mid = STEP * i + STEP / 2
  const [lx, ly] = polar(74, mid)
  return {
    letter,
    mid,
    lx,
    ly,
    fill: WEDGE_FILLS[i % WEDGE_FILLS.length],
    path: `M${CENTER} ${CENTER} L${x0.toFixed(2)} ${y0.toFixed(2)} A${RADIUS} ${RADIUS} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
  }
})

function WheelFace() {
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full" aria-hidden="true" focusable="false">
      <circle cx={CENTER} cy={CENTER} r={RADIUS + 4} fill="#16263F" />
      {WEDGES.map((w) => (
        <g key={w.letter}>
          <path d={w.path} fill={w.fill} stroke="#ffffff" strokeWidth="2" />
          <text
            x={w.lx}
            y={w.ly}
            transform={`rotate(${w.mid.toFixed(2)} ${w.lx.toFixed(2)} ${w.ly.toFixed(2)})`}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize="30"
            fontWeight="700"
          >
            {w.letter}
          </text>
        </g>
      ))}
      <circle cx={CENTER} cy={CENTER} r="16" fill="#ffffff" stroke="#16263F" strokeWidth="3" />
    </svg>
  )
}

/** Fixed pointer at the top: the wheel turns under it. */
function Pointer() {
  return (
    <svg
      viewBox="0 0 28 30"
      className="absolute left-1/2 top-0 z-10 h-7 w-7 -translate-x-1/2 -translate-y-2"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="14,28 2,2 26,2" fill="#16263F" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Tocá «Girar la ruleta»: se detiene en una letra.',
    'Para cada pedido, como «una fruta», pensá una palabra que empiece con esa letra. Decila en voz alta o anotala en un papel.',
    'Cuando la tengas, tocá «Ya la pensé».',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-tiam-blue/15 bg-white p-3">
        <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
        <p className="text-base leading-snug text-slate-700">Tené a mano lápiz y papel, si querés anotar.</p>
      </div>
      <div className="sticky bottom-3 z-10 mt-5 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena memoria!', '¡Perfecto!']

/** A tap this soon after the tap that brought the level here ("Empezar", "Siguiente nivel", "Repetir") is the
 * second tap of a double tap, and it must not spin the wheel (the spin button sits right where that button
 * was). The same window covers a button that another one replaces under the finger inside a level: the
 * requests that take the place of "Girar la ruleta" when the wheel stops at once (reduced motion) and the
 * card's button that takes the place of the last request. Long enough to swallow a double tap, short enough
 * that nobody who means it notices. */
const SETTLE_MS = 400

/** Decoration only — see the module doc. Keep SPIN_MS in step with `duration-[1300ms]` below. */
const SPIN_MS = 1300
const SPIN_TURNS = 3

type Phase = 'idle' | 'spinning' | 'landed'

interface LevelViewProps {
  levelIdx: number
  set: PromptSet
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, set, since, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = set.categories.length

  const [phase, setPhase] = useState<Phase>('idle')
  const [rotation, setRotation] = useState(0)
  const [thought, setThought] = useState<number[]>([])
  const [praise, setPraise] = useState(PRAISE[0])
  const spinTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(spinTimerRef.current), [])
  // The last tap that put something else under the player's finger (the click's own timeStamp): the
  // spin, which under reduced motion swaps its button for the requests at once, and the request that
  // closed the level, which the result card replaces.
  const swapAtRef = useRef(-Infinity)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const solved = thought.length >= total
  const landed = phase === 'landed'

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

  function spin(at: number) {
    // The second tap of a double tap on the button that brought the level would start the spin by itself.
    if (phase !== 'idle' || at - since < SETTLE_MS) return
    swapAtRef.current = at
    const index = WHEEL_LETTERS.indexOf(set.letter)
    // Turn clockwise a few times and stop with the middle of the wedge of the
    // level's letter under the pointer (a little off-centre, still inside it).
    const wobble = wobbleOf()
    const target = 360 * SPIN_TURNS + (360 - (index * STEP + STEP / 2 + wobble))
    setRotation(target)
    if (prefersReducedMotion()) {
      setPhase('landed')
      return
    }
    setPhase('spinning')
    spinTimerRef.current = window.setTimeout(() => setPhase('landed'), SPIN_MS + 60)
  }

  function handleThought(i: number, at: number) {
    // Under reduced motion the requests replace the spin button at once: a tap right after it is its double tap.
    if (!landed || solved || thought.includes(i) || at - swapAtRef.current < SETTLE_MS) return
    const next = [...thought, i]
    setThought(next)
    if (next.length >= total) {
      swapAtRef.current = at
      setPraise(pickOne(PRAISE))
      onSolved()
    }
  }

  // The result card takes the place of the requests, so its button can end up right under the finger
  // that closed the level: the second tap of that double tap must not skip the result.
  function leave(go: (at: number) => void, at: number) {
    if (at - swapAtRef.current < SETTLE_MS) return
    go(at)
  }

  // After the spin the wheel is only decoration, and level 3 stacks the instruction, the progress and FOUR request rows: on
  // a short phone (the modal leaves 100dvh - 95px; 545px on a 320x640 one, where the old layout needed 621px and the last
  // "Ya la pensé" row sat entirely below the fold) the wheel shrinks and the spacing tightens, so every request is on
  // screen once the wheel has stopped. Rows stay 52px or more, the text 16px or more (the 14px "Ya la pensé" label as
  // before). Taller phones keep the roomy layout.
  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {/* Announced when the wheel stops: the letter is the whole news */}
        <div aria-live="polite">
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl [@media(max-height:700px)]:mt-2">
            {landed ? `Salió la «${set.letter}»` : 'Girá la ruleta y pensá palabras'}
          </h2>
        </div>
        {landed && !solved && (
          <>
            <p className="mt-1.5 text-balance text-base text-slate-500">
              Pensá palabras que empiecen con esa letra. Decilas en voz alta o anotalas en un papel.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {thought.length} de {total}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(thought.length / total) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* The wheel: the wrapper turns, the drawing inside stays still. Once the level
          is done it makes room for the result card, which sums the requests up. */}
      {!solved && (
        <div className="mt-5 flex justify-center [@media(max-height:700px)]:mt-3">
          <div
            className={[
              'relative',
              landed ? 'h-24 w-24 [@media(max-height:700px)]:h-16 [@media(max-height:700px)]:w-16' : 'h-44 w-44',
            ].join(' ')}
          >
            <Pointer />
            <div
              className={[
                'h-full w-full',
                // Classes (not an inline style) so `motion-reduce` can switch the spin off.
                phase === 'idle'
                  ? ''
                  : 'transition-transform duration-[1300ms] ease-[cubic-bezier(0.2,0.7,0.15,1)] motion-reduce:transition-none',
              ].join(' ')}
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <WheelFace />
            </div>
          </div>
        </div>
      )}

      {phase !== 'landed' && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={(e) => spin(e.timeStamp)}
            disabled={phase === 'spinning'}
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-tiam-blue px-8 text-lg font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2 disabled:opacity-70"
          >
            <RotateCw className="h-5 w-5" />
            {phase === 'spinning' ? 'Girando…' : 'Girar la ruleta'}
          </button>
        </div>
      )}

      {landed && !solved && (
        <>
          {/* One row per request, closed with a tap */}
          <div className="mx-auto mt-3 flex max-w-md flex-col gap-2.5 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:gap-2">
            {set.categories.map((category, i) => {
              const isDone = thought.includes(i)
              return (
                <button
                  key={category}
                  type="button"
                  disabled={isDone || solved}
                  onClick={(e) => handleThought(i, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition [@media(max-height:700px)]:min-h-[52px] [@media(max-height:700px)]:py-1.5',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isDone
                      ? 'border-tiam-green bg-tiam-green/10'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                      isDone ? 'border-tiam-green bg-tiam-green text-white' : 'border-slate-300',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {isDone && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-tight text-slate-900">{capitalize(category)}</span>
                    <span
                      className={['block text-sm font-bold', isDone ? 'text-green-700' : 'text-tiam-blue'].join(' ')}
                    >
                      {isDone ? 'Listo' : 'Ya la pensé'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
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
            Pensaste palabras con la «{set.letter}» para {listWithY(set.categories)}. ¡Completaste el{' '}
            {level.name.toLowerCase()}!
          </p>
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

export function LaRuletaDeLetras({ onComplete }: GameProps) {
  // Which letter (and requests) each level plays — decided once, at mount, so
  // "Repetir" replays exactly the same three letters.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never
  // brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    // Open recall: nothing is ever wrong, so no mistakes (same as TiraElDado).
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Girá la ruleta y pensá palabras</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      set={epoch[levelIdx]}
      since={since}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
