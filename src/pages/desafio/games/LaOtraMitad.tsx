import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, FlipHorizontal2 } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La otra mitad" — praxias (razonamiento visoespacial, simetría especular).
 * Se muestra medio dibujo (formas geométricas simples a la izquierda de una
 * línea de simetría marcada) y hay que elegir, entre 4 opciones, cuál
 * muestra el dibujo COMPLETO reflejado correctamente.
 *
 * 100% SVG (canvas abstracto "0 0 8 8", línea de simetría fija en x=4) —
 * mismo criterio que SeguiElPatron/DondeEsta: el contenido es inherentemente
 * abstracto (forma/color/posición), así que dibujarlo en vivo no necesita
 * ningún asset.
 *
 * Generado PROCEDURALMENTE en cada ronda (como SeguiElPatron/
 * DesafioDeDeduccion): siempre se arma la mitad IZQUIERDA primero (la
 * verdad fundamental) y las 4 opciones se derivan de ella por construcción
 * — nunca al revés — así el resultado correcto es siempre exactamente uno
 * y nunca ambiguo:
 *   - correcta: cada forma reflejada en x (mismo color/forma/posición Y).
 *   - desplazada: la reflejada correcta, pero corrida en Y como grupo.
 *   - rotada: la reflejada correcta, girada 180° sobre su propio centro.
 *   - con una forma cambiada: la reflejada correcta, con UNA figura de
 *     otra forma (misma posición y color).
 * Cada forma de la mitad izquierda tiene una combinación forma+color única
 * dentro de la ronda, así que rotar o cambiar una pieza SIEMPRE se nota —
 * nunca puede coincidir por accidente con la opción correcta.
 *
 * NOTA para quien cablee este juego: el día 12 de Mes 1 y Mes 2 en
 * challengeContent.ts ya están ocupados (Oraciones a medida / El paso a
 * paso), así que "día 12" acá es sólo una etiqueta de planificación, no un
 * slot real de registry.ts todavía — este batch deliberadamente no toca
 * ninguno de los dos archivos (ver instrucciones del batch).
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" del resto del catálogo. La cantidad de formas por dibujo
 * sube con el nivel (2 → 3 → 4), como en SeguiElPatron.
 */

type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond'
interface Piece {
  shape: ShapeKind
  color: string
  x: number
  y: number
}
type OptionKind = 'correct' | 'shifted' | 'rotated' | 'swapped'
interface Option {
  id: OptionKind
  pieces: Piece[]
}
interface Round {
  leftPieces: Piece[]
  options: Option[]
}

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond']
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7']
// 4 posiciones fijas en la mitad izquierda (x<4), ninguna sobre la línea de
// simetría ni sobre el centro vertical — así ninguna transformación puede
// "coincidir con la correcta" por casualidad geométrica.
const SLOTS = [
  { x: 1.6, y: 2.2 },
  { x: 2.6, y: 4.6 },
  { x: 1.4, y: 6.2 },
  { x: 3.0, y: 1.4 },
]
const R = 0.55

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
function otherShape(shape: ShapeKind): ShapeKind {
  return pickOne(SHAPES.filter((s) => s !== shape))
}
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function generateRound(levelIdx: number): Round {
  const n = levelIdx + 2 // 2, 3, 4 formas
  const slots = SLOTS.slice(0, n)
  const used = new Set<string>()
  const leftPieces: Piece[] = slots.map((slot) => {
    let shape: ShapeKind
    let color: string
    let sig: string
    do {
      shape = pickOne(SHAPES)
      color = pickOne(PALETTE)
      sig = `${shape}-${color}`
    } while (used.has(sig))
    used.add(sig)
    return { shape, color, x: slot.x, y: slot.y }
  })

  const correctPieces = leftPieces.map((p) => ({ ...p, x: 8 - p.x }))

  const avgY = leftPieces.reduce((s, p) => s + p.y, 0) / leftPieces.length
  const dy = avgY >= 4 ? -1.6 : 1.6
  const shiftedPieces = correctPieces.map((p) => ({ ...p, y: clamp(p.y + dy, 0.7, 7.3) }))

  const cx = correctPieces.reduce((s, p) => s + p.x, 0) / correctPieces.length
  const cy = correctPieces.reduce((s, p) => s + p.y, 0) / correctPieces.length
  const rotatedPieces = correctPieces.map((p) => ({
    ...p,
    x: clamp(2 * cx - p.x, 4.3, 7.7),
    y: clamp(2 * cy - p.y, 0.6, 7.4),
  }))

  const swapIdx = Math.floor(Math.random() * correctPieces.length)
  const swappedPieces = correctPieces.map((p, i) => (i === swapIdx ? { ...p, shape: otherShape(p.shape) } : p))

  const options: Option[] = shuffle([
    { id: 'correct', pieces: correctPieces },
    { id: 'shifted', pieces: shiftedPieces },
    { id: 'rotated', pieces: rotatedPieces },
    { id: 'swapped', pieces: swappedPieces },
  ])

  return { leftPieces, options }
}

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto
// del catálogo.
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3']

function PieceGlyph({ piece }: { piece: Piece }) {
  const { shape, color, x, y } = piece
  if (shape === 'circle') return <circle cx={x} cy={y} r={R} fill={color} />
  if (shape === 'square') return <rect x={x - R} y={y - R} width={R * 2} height={R * 2} rx={R * 0.25} fill={color} />
  if (shape === 'triangle') return <polygon points={`${x},${y - R} ${x + R},${y + R} ${x - R},${y + R}`} fill={color} />
  return <polygon points={`${x},${y - R} ${x + R},${y} ${x},${y + R} ${x - R},${y}`} fill={color} />
}

function SceneSvg({ leftPieces, rightPieces }: { leftPieces: Piece[]; rightPieces: Piece[] }) {
  return (
    <svg viewBox="0 0 8 8" className="h-full w-full">
      <line x1={4} y1={0.3} x2={4} y2={7.7} stroke="#CBD5E1" strokeWidth={0.12} strokeDasharray="0.3,0.25" />
      {leftPieces.map((p, i) => (
        <PieceGlyph key={`l${i}`} piece={p} />
      ))}
      {rightPieces.map((p, i) => (
        <PieceGlyph key={`r${i}`} piece={p} />
      ))}
    </svg>
  )
}

const PRAISE_GOOD = ['¡Exacto, esa es la mitad correcta!', '¡Muy bien reflejado!', '¡Perfecto!', '¡Así se hace!']
const WRONG_HINTS = [
  'Esa no es — fijate bien cómo se refleja cada forma.',
  'Casi. Compará con cuidado la posición de cada forma.',
  'No es esa. Mirá de nuevo el modelo de la izquierda.',
]

export function LaOtraMitad({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Igual que SeguiElPatron: todos los rounds de la epoch se generan una
  // sola vez (al montar y en "Hacer otro"), nunca al re-visitar un nivel,
  // así "Repetir" devuelve exactamente la misma ronda.
  const [epochRounds, setEpochRounds] = useState(() =>
    ROUNDS_PER_LEVEL.map((count, idx) => Array.from({ length: count }, () => generateRound(idx))),
  )
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [eliminated, setEliminated] = useState<Set<OptionKind>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Elecciones equivocadas, acumuladas a través de niveles 1→2→3 y sólo en
  // cero en un reinicio real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  function guess(option: Option) {
    if (!round || resolved) return
    if (option.id === 'correct') {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 900)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(option.id))
      setHint(pickOne(WRONG_HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(ROUNDS_PER_LEVEL.map((count, idx) => Array.from({ length: count }, () => generateRound(idx))))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_NAMES.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
          {LEVEL_NAMES[levelIdx]}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuál es el dibujo completo?</h2>
            <p className="mt-2 text-base text-slate-500">Elegí la opción que refleja bien la otra mitad.</p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que ElPasoAPaso.tsx. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <FlipHorizontal2 className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver medio dibujo con una línea que marca dónde se refleja. Elegí, entre las opciones, cuál muestra
            el dibujo COMPLETO tal cual se vería reflejado del otro lado.
          </p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && !done && round && (
        <>
          {/* Modelo: sólo la mitad izquierda, con la línea de simetría */}
          <div className="mt-5 flex flex-col items-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo</p>
            <div className="aspect-square w-36 rounded-2xl border-2 border-slate-100 bg-white p-1 sm:w-40">
              <SceneSvg leftPieces={round.leftPieces} rightPieces={[]} />
            </div>
          </div>

          {/* Opciones */}
          <div className="mx-auto mt-5 grid max-w-[280px] grid-cols-2 gap-3">
            {round.options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              const isCorrectShown = resolved && opt.id === 'correct'
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt)}
                  className={[
                    'relative aspect-square rounded-2xl border-2 p-1 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 opacity-40'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <SceneSvg leftPieces={round.leftPieces} rightPieces={opt.pieces} />
                </button>
              )
            })}
          </div>
        </>
      )}

      {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
      {resolved && <p className="mt-4 text-center text-base font-semibold text-tiam-green">{praise}</p>}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Acertaste los {roundsForLevel} dibujos — terminaste el nivel {levelIdx + 1}.
          </p>
          {levelIdx < LEVEL_NAMES.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Hacer otro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
