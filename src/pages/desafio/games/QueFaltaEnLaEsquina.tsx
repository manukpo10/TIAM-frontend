import { useEffect, useRef, useState } from 'react'
import { Circle, Square, Triangle, Diamond, Grid3x3, RotateCcw, ArrowRight, Sparkles, Check, type LucideIcon } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué falta en la esquina?" — día 22, agnosias.
 *
 * La referencia original (papel/foto) mostraba una imagen real con un hueco
 * en una esquina. Para este lote, sin depender de fotos, se adapta a un
 * PATRÓN GEOMÉTRICO repetitivo dibujado con iconos lucide-react: una grilla
 * de figuras de colores sigue una regla (alternancia tipo tablero de
 * ajedrez en nivel 1/2, franjas diagonales de 3 figuras en nivel 3), la
 * esquina inferior derecha queda en blanco, y el jugador toca — entre 3
 * opciones también dibujadas — cuál figura completa correctamente el
 * patrón. Mismo espíritu que el original: reconocimiento visual + completar
 * lo que falta, sin ningún asset fotográfico.
 *
 * El color es fijo por figura (nunca por instancia individual) — es una
 * pista de identidad, no una trampa — mismo criterio que NoEstaRepetida.tsx.
 *
 * Nivel 1: grilla 2×2, 2 figuras alternadas (tablero), celda vecina a la
 *   esquina ya muestra la figura "hermana" — alcanza con mirar una celda.
 * Nivel 2: mismo tablero de 2 figuras pero en grilla 3×3 — hay que
 *   confirmar la regla mirando más de una celda.
 * Nivel 3: grilla 3×3 con TRES figuras en franjas diagonales
 *   (figura = (fila+columna) % 3) — la figura que falta también aparece en
 *   otras dos celdas de la grilla, pero hay que encontrarlas; las 3
 *   opciones son las 3 figuras del patrón, así que un vistazo rápido no
 *   alcanza, hace falta rastrear la diagonal.
 *
 * Nunca rojo, sin timer, siempre reintentable, pantalla "¿Listo?" única vez.
 */

interface ShapeDef {
  id: string
  label: string
  Icon: LucideIcon
  color: string
}
const SHAPE_PALETTE: ShapeDef[] = [
  { id: 'circle', label: 'círculo', Icon: Circle, color: '#1B6FC4' },
  { id: 'square', label: 'cuadrado', Icon: Square, color: '#E8531E' },
  { id: 'triangle', label: 'triángulo', Icon: Triangle, color: '#4CA52E' },
  { id: 'diamond', label: 'rombo', Icon: Diamond, color: '#9333EA' },
]

type Mode = 'checker' | 'stripe3'
interface Level {
  n: number
  name: string
  rounds: number
  gridSize: number
  mode: Mode
  cellClass: string
  iconClass: string
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, gridSize: 2, mode: 'checker', cellClass: 'h-20 w-20 sm:h-24 sm:w-24', iconClass: 'h-9 w-9 sm:h-11 sm:w-11' },
  { n: 2, name: 'Nivel 2', rounds: 2, gridSize: 3, mode: 'checker', cellClass: 'h-16 w-16 sm:h-20 sm:w-20', iconClass: 'h-7 w-7 sm:h-9 sm:w-9' },
  { n: 3, name: 'Nivel 3', rounds: 2, gridSize: 3, mode: 'stripe3', cellClass: 'h-16 w-16 sm:h-20 sm:w-20', iconClass: 'h-7 w-7 sm:h-9 sm:w-9' },
]
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
const ACCENT = '#D97706' // ámbar

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

interface Round {
  size: number
  cells: (ShapeDef | null)[][] // null = la esquina en blanco
  correctId: string
  options: ShapeDef[]
  key: string
}
function buildOnce(level: Level): Round {
  const size = level.gridSize
  const last = size - 1
  if (level.mode === 'checker') {
    const [a, b] = shuffle(SHAPE_PALETTE).slice(0, 2)
    const unrelated = SHAPE_PALETTE.find((s) => s.id !== a.id && s.id !== b.id)!
    const cells: (ShapeDef | null)[][] = []
    for (let r = 0; r < size; r++) {
      const row: (ShapeDef | null)[] = []
      for (let c = 0; c < size; c++) {
        row.push(r === last && c === last ? null : (r + c) % 2 === 0 ? a : b)
      }
      cells.push(row)
    }
    // La esquina (last,last) siempre tiene paridad par → misma figura que
    // (0,0): es "a" por construcción.
    return { size, cells, correctId: a.id, options: shuffle([a, b, unrelated]), key: [a.id, b.id].sort().join('-') }
  }
  const shapes = shuffle(SHAPE_PALETTE).slice(0, 3)
  const cells: (ShapeDef | null)[][] = []
  for (let r = 0; r < size; r++) {
    const row: (ShapeDef | null)[] = []
    for (let c = 0; c < size; c++) {
      row.push(r === last && c === last ? null : shapes[(r + c) % 3])
    }
    cells.push(row)
  }
  const correct = shapes[(last + last) % 3]
  return { size, cells, correctId: correct.id, options: shuffle(shapes), key: shapes.map((s) => s.id).sort().join('-') }
}
function makeRound(level: Level, avoidKey?: string): Round {
  let round = buildOnce(level)
  let guard = 0
  while (avoidKey && round.key === avoidKey && guard < 10) {
    round = buildOnce(level)
    guard++
  }
  return round
}
function makeLevelRounds(level: Level): Round[] {
  const rounds: Round[] = []
  for (let i = 0; i < level.rounds; i++) {
    rounds.push(makeRound(level, rounds[i - 1]?.key))
  }
  return rounds
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!']
const HINTS = ['Esa no completa el patrón — fijate cómo se repiten las figuras.', 'Casi. Mirá otra celda con la misma posición en el patrón.', 'No es esa — seguí la fila y la columna con calma.']

export function QueFaltaEnLaEsquina({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => makeLevelRounds(lvl)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(shapeId: string) {
    if (!round || resolved || eliminated.has(shapeId)) return
    if (shapeId === round.correctId) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(shapeId))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => makeLevelRounds(lvl)))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué figura falta en la esquina?</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%`, backgroundColor: ACCENT }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Grid3x3 className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            La grilla sigue un patrón de figuras, pero la esquina de abajo a la derecha está vacía. Tocá la opción que la completa.
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
          {/* Grilla del patrón */}
          <div className="mx-auto mt-4 inline-grid gap-2 sm:mt-6" style={{ gridTemplateColumns: `repeat(${round.size}, minmax(0, 1fr))` }}>
            {round.cells.flatMap((row, r) =>
              row.map((cell, c) => {
                const isBlank = cell === null
                return (
                  <div
                    key={`${r}-${c}`}
                    className={[
                      'flex items-center justify-center rounded-2xl border-2 bg-white',
                      level.cellClass,
                      isBlank ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-100',
                    ].join(' ')}
                  >
                    {cell && <cell.Icon className={level.iconClass} style={{ color: cell.color }} strokeWidth={2} />}
                  </div>
                )
              }),
            )}
          </div>

          {/* Opciones */}
          <div className="mx-auto mt-5 flex max-w-xs justify-center gap-3 sm:mt-6">
            {round.options.map((shape) => {
              const isEliminated = eliminated.has(shape.id)
              const isCorrectShown = resolved && shape.id === round.correctId
              return (
                <button
                  key={shape.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(shape.id)}
                  aria-label={shape.label}
                  className={[
                    'relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 bg-white transition sm:h-24 sm:w-24',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 opacity-30'
                        : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <shape.Icon className="h-9 w-9 sm:h-11 sm:w-11" style={{ color: shape.color }} strokeWidth={2} />
                  {isCorrectShown && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {phase === 'playing' && done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Completaste los {level.rounds} patrones — terminaste el {level.name.toLowerCase()}!
          </p>
          {levelIdx < LEVELS.length - 1 ? (
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
