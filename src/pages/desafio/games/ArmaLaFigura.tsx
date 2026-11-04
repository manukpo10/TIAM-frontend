import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Armá la figura" — día 19, mes 6, praxias (visuoespacial). A figure drawn in SVG with dotted outlines (a boat, a train,
 * a kite) and, below, the pieces that fill it. The player taps a piece and then the dotted shape where it fits. The
 * mechanic comes from a worksheet with a dotted drawing made of rectangles, triangles and a half circle and the same
 * pieces in colour to cut and paste; here the three figures, their pieces and the way of playing are TIAM's own.
 *
 * HOW IT DIFFERS FROM "Armá la mariposa" (month 5, día 25), where the pieces were made of squares of a grid and had to
 * tile a whole silhouette, with many possible tilings and a search to say whether the figure could still be closed:
 * here there is nothing to tile and nothing to search. Every piece has its OWN dotted shape, with the exact outline
 * (rectangles, a trapezoid, triangles, a square), so the task is to compare shape, size and direction, and there is
 * exactly one place for each piece. The ramp: four pieces of different shapes (a boat), five pieces where three of them
 * are rectangles of different proportions (a train), and six pieces where four are the SAME triangle and are told apart
 * only by where its right angle is, and two are mirror triangles (a kite). The pieces are drawn in the direction they go in
 * (nothing rotates) and the colour is only decoration: every piece is told by its outline.
 *
 * ONE PIECE AT A TIME: tapping a piece lights it up (tapping it again lets it go); tapping a dotted shape with a piece
 * in hand puts it there if it is the right one. A wrong shape costs ONE mistake, flashes muted gray (never red) and the
 * piece stays in hand; the hint names the piece ("el triángulo con el ángulo recto abajo a la izquierda") and, from the
 * second miss on the same piece, the right shape gets a blue ring. Tapping a shape with no piece chosen is not a
 * mistake. Nothing is timed and there is no dead end: a piece can only be placed where it belongs.
 *
 * Every figure was drawn on a plain grid of units, with every piece a polygon with no overlap with the others (checked
 * by a throwaway script, not committed, that also measures the smallest piece, the shapes being all different within
 * a figure, and that every polygon is convex). The figure is sized to the screen, so that the figure, the hint and the
 * pieces are in view on a short phone. The pieces in the tray are shown at 0.6 of the size of the figure.
 * One figure per level; the order of the pieces in the tray is chosen ONCE at mount (`epoch`), so "Repetir" replays the same
 * three figures (the pieces in the same order).
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored, a piece
 * tapped twice in a row within that window is not "put down" again and a shape refused is not refused twice.
 *
 * totalAttempts = mistakes + every piece of the day (TOTAL_PIECES, derived).
 */

// ── data:start ──
type Pt = [number, number]
interface PieceDef {
  /** The outline, in the units of the figure, in the direction it goes. */
  pts: Pt[]
  fill: string
  /** Said after a miss: what the piece is like. */
  name: string
}
interface LevelDef {
  name: string
  /** What the figure is, with its article. */
  figure: string
  /** The area of the drawing: "x y width height". */
  box: [number, number, number, number]
  pieces: PieceDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    figure: 'el barco',
    box: [20, 14, 260, 216],
    pieces: [
      { pts: [[30, 160], [270, 160], [230, 220], [70, 220]], fill: '#9EC8F5', name: 'el trapecio ancho, más grande arriba que abajo' },
      { pts: [[95, 110], [205, 110], [205, 160], [95, 160]], fill: '#F9CB8B', name: 'el rectángulo' },
      { pts: [[150, 24], [205, 110], [95, 110]], fill: '#F6B3D2', name: 'el triángulo con la punta hacia arriba' },
      { pts: [[40, 114], [86, 114], [86, 160], [40, 160]], fill: '#A7DDA2', name: 'el cuadrado' },
    ],
  },
  {
    name: 'Nivel 2',
    figure: 'el tren',
    box: [10, 4, 290, 186],
    pieces: [
      { pts: [[20, 120], [165, 120], [165, 180], [20, 180]], fill: '#F4A6A0', name: 'el rectángulo largo y bajo' },
      { pts: [[165, 70], [235, 70], [235, 180], [165, 180]], fill: '#9EC8F5', name: 'el rectángulo alto y angosto' },
      { pts: [[36, 70], [84, 70], [94, 120], [26, 120]], fill: '#CDB5F0', name: 'el trapecio, más angosto arriba que abajo' },
      { pts: [[165, 70], [235, 70], [200, 14]], fill: '#F9CB8B', name: 'el triángulo con la punta hacia arriba' },
      { pts: [[240, 130], [290, 130], [290, 180], [240, 180]], fill: '#A7DDA2', name: 'el cuadrado' },
    ],
  },
  {
    name: 'Nivel 3',
    figure: 'el barrilete',
    box: [50, 2, 200, 270],
    pieces: [
      { pts: [[150, 100], [150, 10], [240, 100]], fill: '#F4A6A0', name: 'el triángulo con el ángulo recto abajo a la izquierda' },
      { pts: [[150, 100], [150, 10], [60, 100]], fill: '#9EC8F5', name: 'el triángulo con el ángulo recto abajo a la derecha' },
      { pts: [[150, 100], [240, 100], [150, 190]], fill: '#A7DDA2', name: 'el triángulo con el ángulo recto arriba a la izquierda' },
      { pts: [[150, 100], [60, 100], [150, 190]], fill: '#F9CB8B', name: 'el triángulo con el ángulo recto arriba a la derecha' },
      { pts: [[150, 232], [85, 200], [85, 264]], fill: '#CDB5F0', name: 'el triángulo chico que apunta hacia la derecha' },
      { pts: [[150, 232], [215, 200], [215, 264]], fill: '#F6B3D2', name: 'el triángulo chico que apunta hacia la izquierda' },
    ],
  },
]
const TOTAL_PIECES = LEVELS.reduce((sum, lvl) => sum + lvl.pieces.length, 0)

/** The size of the pieces of the tray, against the figure. */
const TRAY_SCALE = 0.6

/** The example of the how-to screen: it is not in the game. */
const EXAMPLE: { pts: Pt[]; fill: string } = { pts: [[8, 44], [56, 44], [72, 8], [24, 8]], fill: '#9EC8F5' }
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

const pathOf = (pts: Pt[]) => `M${pts.map((p) => p.join(' ')).join('L')}Z`
function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** The order of the pieces in the tray of each level: decided ONCE, at mount. */
function buildEpoch(): number[][] {
  return LEVELS.map((lvl) => shuffle(lvl.pieces.map((_, i) => i)))
}

const PRAISE = ['¡Muy bien!', '¡Qué buen ojo!', '¡Así se hace!', '¡Excelente!', '¡Perfecto!']
/** A tap this soon after the tap that brought the level or put a piece down is the second tap of a double tap. */
const SETTLE_MS = 400

/** A piece drawn at its own size (the tray), with a margin so its outline is not cut. */
function PieceSvg({ piece, scale }: { piece: { pts: Pt[]; fill: string }; scale: number }) {
  const b = bounds(piece.pts)
  const w = b.x1 - b.x0 + 8
  const h = b.y1 - b.y0 + 8
  return (
    <svg viewBox={`${b.x0 - 4} ${b.y0 - 4} ${w} ${h}`} width={w * scale} height={h * scale} aria-hidden="true">
      <path d={pathOf(piece.pts)} fill={piece.fill} stroke="#334155" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá la figura de líneas punteadas: cada hueco tiene la forma de una pieza.',
    'Tocá una pieza de abajo y después tocá el hueco donde encaja, hasta armar la figura completa.',
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
      <div className="mt-3 flex items-center justify-center gap-4 rounded-2xl bg-white p-3">
        <svg viewBox="0 0 80 52" width="80" height="52" aria-hidden="true">
          <path d={pathOf(EXAMPLE.pts)} fill={EXAMPLE.fill} stroke="#334155" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <ArrowRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <svg viewBox="0 0 80 52" width="80" height="52" aria-hidden="true">
          <path d={pathOf(EXAMPLE.pts)} fill="none" stroke="#64748b" strokeWidth="2.5" strokeDasharray="6 5" strokeLinejoin="round" />
        </svg>
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
  tray: number[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, tray, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.pieces.length
  const [bx, by, bw, bh] = level.box

  const [held, setHeld] = useState<number | null>(null)
  const [placed, setPlaced] = useState<number[]>([])
  const [misses, setMisses] = useState<number[]>(() => level.pieces.map(() => 0))
  const [flash, setFlash] = useState<number | null>(null)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const lastTapRef = useRef({ key: '', at: -Infinity })
  const timersRef = useRef<number[]>([])
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

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

  /** True when this tap is the second tap of a double tap on the same target. */
  function repeated(key: string, at: number): boolean {
    const last = lastTapRef.current
    const same = last.key === key && at - last.at < SETTLE_MS
    lastTapRef.current = { key, at }
    return same
  }

  function tapPiece(i: number, at: number) {
    if (done || placed.includes(i) || at - since < SETTLE_MS || repeated(`p${i}`, at)) return
    setHeld((h) => (h === i ? null : i))
    setHint(held === i ? null : { text: `Elegiste ${level.pieces[i].name}. Tocá su hueco.`, ok: true })
  }
  function tapSlot(s: number, at: number) {
    if (done || placed.includes(s) || at - since < SETTLE_MS || repeated(`s${s}`, at)) return
    if (held === null) {
      setHint({ text: 'Primero tocá una pieza de abajo.', ok: false })
      return
    }
    if (held === s) {
      const next = [...placed, s]
      setPlaced(next)
      setHeld(null)
      setHint({ text: '¡Encaja!', ok: true })
      if (next.length === total) {
        timersRef.current.push(
          window.setTimeout(() => {
            setPraise(pickOne(PRAISE))
            setDone(true)
            onSolved()
          }, ADVANCE_MS),
        )
      }
      return
    }
    const n = misses[held] + 1
    setMisses((m) => m.map((x, j) => (j === held ? n : x)))
    setFlash(s)
    timersRef.current.push(window.setTimeout(() => setFlash((f) => (f === s ? null : f)), 600))
    setHint({
      text:
        n === 1
          ? 'Ahí no entra. Compará la forma y el tamaño de la pieza con el hueco.'
          : 'Ahí no entra. Probá en el hueco marcado con el aro azul.',
      ok: false,
    })
    onMistake()
  }

  const ringSlot = held !== null && misses[held] >= 2 && !placed.includes(held) ? held : null
  const remaining = tray.filter((i) => !placed.includes(i))

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Colocaste {placed.length} de {total}
          </span>
        )}
      </div>

      {/* The figure: dotted shapes that fill in as the pieces are placed */}
      <svg
        viewBox={`${bx} ${by} ${bw} ${bh}`}
        className="mx-auto mt-2 block max-h-[34vh] w-full max-w-[340px]"
        role="group"
        aria-label={`Figura punteada: ${level.figure}`}
      >
        {level.pieces.map((p, s) => {
          const isPlaced = placed.includes(s)
          return (
            <g
              key={s}
              role="button"
              tabIndex={isPlaced || done ? -1 : 0}
              aria-label={isPlaced ? `Hueco ya completo` : `Hueco ${s + 1}`}
              onClick={(e) => tapSlot(s, e.timeStamp)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  tapSlot(s, e.timeStamp)
                }
              }}
              className="cursor-pointer outline-hidden"
            >
              <path
                d={pathOf(p.pts)}
                fill={isPlaced ? p.fill : flash === s ? '#e2e8f0' : '#ffffff'}
                fillOpacity={isPlaced || flash === s ? 1 : 0.9}
                stroke={isPlaced ? '#334155' : ringSlot === s ? '#1B6FC4' : '#64748b'}
                strokeWidth={isPlaced ? 3 : ringSlot === s ? 5 : 2.5}
                strokeDasharray={isPlaced ? undefined : ringSlot === s ? '3 5' : '7 5'}
                strokeLinejoin="round"
                pointerEvents="all"
              />
            </g>
          )
        })}
      </svg>

      {!done && (
        <>
          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.75rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? `Armá ${level.figure}: tocá una pieza y después su hueco.`}
          </p>

          {/* The pieces that are left */}
          <div role="group" aria-label="Piezas" className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2">
            {remaining.map((i) => {
              const chosen = held === i
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={chosen}
                  aria-label={`Pieza: ${level.pieces[i].name}`}
                  onClick={(e) => tapPiece(i, e.timeStamp)}
                  className={[
                    'flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border-2 p-1.5 transition',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                    chosen ? 'border-tiam-blue bg-tiam-blue/10 ring-2 ring-tiam-blue/40' : 'border-slate-300 bg-white hover:border-tiam-blue/40',
                  ].join(' ')}
                >
                  <PieceSvg piece={level.pieces[i]} scale={TRAY_SCALE} />
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-3 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Armaste {level.figure}. ¡Completaste el {level.name.toLowerCase()}!</p>
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

/** The pause after the last piece, with the figure whole, before the result card. */
const ADVANCE_MS = 1100

export function ArmaLaFigura({ onComplete }: GameProps) {
  // The order of the pieces in each tray — decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PIECES })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Cada pieza en su lugar</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      tray={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
