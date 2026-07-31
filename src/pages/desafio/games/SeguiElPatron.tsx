import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Seguí el patrón" — día 20 del Mes 2, praxias (razonamiento visoespacial,
 * matriz simplificada estilo Raven). Se arma una grilla de 2×2 o 3×3 con
 * figuras geométricas y falta la última celda (abajo a la derecha); hay que
 * elegir, entre 4 opciones, cuál la completa.
 *
 * 100% dibujado (SVG), sin ningún asset — el contenido es inherentemente
 * abstracto (forma/color/cantidad), igual criterio que DondeEsta.tsx.
 *
 * Generado PROCEDURALMENTE en cada ronda (no un pool fijo de matrices como
 * El Vuelto/ContadorMasMenos): la regla es siempre "la cantidad de figuras
 * aumenta de a una hacia la derecha" (1, 2, 3…), y cada fila tiene su propia
 * combinación de forma+color fija — como YO genero la celda faltante con la
 * misma regla que las demás, siempre es consistente y nunca ambigua, sin
 * necesitar decenas de matrices escritas a mano.
 *
 * Nivel 3 reutiliza EXACTAMENTE la misma regla que nivel 1/2 (no una
 * habilidad nueva apilada encima) — sólo cambia el color/forma de los
 * distractores para hacerlos más parecidos entre sí (mismo criterio que
 * DondeEsta.tsx: "genuinamente una habilidad aplicada dos veces").
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" del resto del lote (ver ElDescuento.tsx).
 */

type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond'
interface Cell {
  shape: ShapeKind
  color: string
  count: number
}

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond']
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7']

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
  const rest = SHAPES.filter((s) => s !== shape)
  return pickOne(rest)
}
function cellKey(c: Cell) {
  return `${c.shape}-${c.color}-${c.count}`
}

interface Round {
  size: 2 | 3
  grid: Cell[][] // incluye la celda faltante (para poder revelarla al acertar)
  options: Cell[]
}

function generateRound(levelIdx: number): Round {
  const size: 2 | 3 = levelIdx === 0 ? 2 : 3
  const shapes = shuffle(SHAPES).slice(0, size)
  const colors = shuffle(PALETTE).slice(0, size)
  // Nivel 1: una sola forma+color para toda la matriz (más simple, "warm-up").
  // Niveles 2/3: cada fila tiene su propia forma+color fija.
  const rows = Array.from({ length: size }, (_, r) => ({
    shape: levelIdx === 0 ? shapes[0] : shapes[r],
    color: levelIdx === 0 ? colors[0] : colors[r],
  }))
  const grid: Cell[][] = rows.map((row) => Array.from({ length: size }, (_, c) => ({ ...row, count: c + 1 })))
  const correct = grid[size - 1][size - 1]

  let decoys: Cell[]
  if (levelIdx === 0) {
    decoys = [
      { ...correct, count: correct.count - 1 },
      { ...correct, count: correct.count + 1 },
      { ...correct, shape: otherShape(correct.shape) },
    ]
  } else if (levelIdx === 1) {
    decoys = [
      { ...correct, count: correct.count - 1 },
      { ...rows[0], count: correct.count },
      { ...rows[1], count: correct.count },
    ]
  } else {
    decoys = [
      { ...correct, count: correct.count - 1 },
      { ...rows[0], count: correct.count },
      { shape: correct.shape, color: rows[0].color, count: correct.count },
    ]
  }
  const options = shuffle([correct, ...decoys])
  return { size, grid, options }
}

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto del
// lote (ver ElDescuento.tsx).
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3']

function Glyph({ shape, color, size = 22 }: { shape: ShapeKind; color: string; size?: number }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      {shape === 'circle' && <circle cx={s / 2} cy={s / 2} r={s / 2 - 1.5} fill={color} />}
      {shape === 'square' && <rect x={1.5} y={1.5} width={s - 3} height={s - 3} rx={3} fill={color} />}
      {shape === 'triangle' && <polygon points={`${s / 2},2 ${s - 2},${s - 2} 2,${s - 2}`} fill={color} />}
      {shape === 'diamond' && (
        <polygon points={`${s / 2},1 ${s - 1},${s / 2} ${s / 2},${s - 1} 1,${s / 2}`} fill={color} />
      )}
    </svg>
  )
}

function MatrixCell({ cell, size }: { cell: Cell; size: 2 | 3 }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border-2 border-slate-100 bg-white ${
        size === 2 ? 'h-16 w-16' : 'h-14 w-14 sm:h-16 sm:w-16'
      }`}
    >
      <div className="flex flex-wrap items-center justify-center gap-0.5">
        {Array.from({ length: cell.count }, (_, i) => (
          <Glyph key={i} shape={cell.shape} color={cell.color} size={size === 2 ? 20 : 16} />
        ))}
      </div>
    </div>
  )
}

const PRAISE_GOOD = ['¡Exacto, ese completa el patrón!', '¡Muy bien visto!', '¡Perfecto!', '¡Así se hace!']
const WRONG_HINTS = [
  'Ese no es — fijate cómo aumenta la cantidad en cada fila.',
  'Casi. Mirá bien la forma y el color de esa fila.',
  'No es esa. Probá con otra opción.',
]

export function SeguiElPatron({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  // Un round fresco por índice de ronda del nivel — generado una sola vez
  // por nivel/roundKey, no en cada render.
  const rounds = useMemo(
    () => Array.from({ length: roundsForLevel }, () => generateRound(levelIdx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel
  const correct = round ? round.grid[round.size - 1][round.size - 1] : null

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Toques equivocados, acumulados a través de niveles 1→2→3 y sólo en cero
  // en un reinicio real del día (ver la rama isWrap de nextLevel).
  const [mistakes, setMistakes] = useState(0)

  function guess(option: Cell) {
    if (!round || !correct || resolved) return
    if (cellKey(option) === cellKey(correct)) {
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
      setEliminated((prev) => new Set(prev).add(cellKey(option)))
      setHint(pickOne(WRONG_HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.
  function nextLevel() {
    const isWrap = levelIdx === LEVEL_NAMES.length - 1
    setLevelIdx((i) => (i < LEVEL_NAMES.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué figura completa el patrón?</h2>
            <p className="mt-2 text-base text-slate-500">Fijate cómo cambian las figuras y elegí la que falta.</p>
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

      {!done && round && correct && (
        <>
          {/* Matriz */}
          <div
            className="mx-auto mt-5 grid w-fit gap-2"
            style={{ gridTemplateColumns: `repeat(${round.size}, minmax(0, 1fr))` }}
          >
            {round.grid.map((row, r) =>
              row.map((cell, c) => {
                const isMissing = r === round.size - 1 && c === round.size - 1
                if (isMissing) {
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`flex items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 text-2xl font-bold text-violet-400 ${
                        round.size === 2 ? 'h-16 w-16' : 'h-14 w-14 sm:h-16 sm:w-16'
                      }`}
                    >
                      {resolved ? <MatrixCell cell={correct} size={round.size} /> : '?'}
                    </div>
                  )
                }
                return <MatrixCell key={`${r}-${c}`} cell={cell} size={round.size} />
              }),
            )}
          </div>

          {/* Opciones */}
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3">
            {round.options.map((opt) => {
              const key = cellKey(opt)
              const isEliminated = eliminated.has(key)
              const isCorrectShown = resolved && key === cellKey(correct)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt)}
                  className={[
                    'relative rounded-2xl border-2 p-1 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 opacity-40'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <MatrixCell cell={opt} size={round.size} />
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-4 text-center text-base font-semibold text-tiam-green">{praise}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Completaste los {roundsForLevel} patrones — terminaste el nivel {levelIdx + 1}.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVEL_NAMES.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otro patrón
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
