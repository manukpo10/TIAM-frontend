import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Copiá la figura" — día 5 del Mes 2, praxias (praxia construccional). Se
 * muestra una figura simple (5-7 puntos conectados, ej. una casa, una
 * flecha, una estrella) sobre una grilla de puntos, y hay que reconstruirla
 * tocando los puntos EN EL MISMO ORDEN sobre una grilla vacía idéntica.
 *
 * 100% SVG (coordenadas en un espacio de grilla 0-4, viewBox "0 0 4 4") —
 * son figuras geométricas simples, así que dibujarlas en vivo es más nítido
 * que cualquier foto generada y no necesita ningún asset (mismo criterio que
 * ElReloj/DondeEsta). La referencia queda SIEMPRE visible junto a la grilla
 * interactiva (esto es copiar, no memorizar — a diferencia de "¿Qué será?",
 * que sí oculta progresivamente).
 *
 * Cada figura es un camino ABIERTO (nunca vuelve a un punto ya usado), así
 * que un punto de la figura es correcto en UNA sola posición de la
 * secuencia — un toque fuera de orden nunca "gasta" un punto que hace falta
 * más adelante. La referencia numera cada vértice (1, 2, 3…) para que el
 * orden a copiar sea siempre inequívoco, nunca una adivinanza sobre por
 * dónde empezar.
 *
 * Nunca hard-fail: un toque a un punto que no es el siguiente sólo muestra
 * una pista neutra (nunca rojo) y no descuenta nada más que sumar al
 * contador de errores — se puede seguir intentando indefinidamente.
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" que ElVuelto/OrdenarLaFrase/PlanificaLaManana. La cantidad de
 * puntos por figura sube con el nivel (5 → 6 → 7), como pide el brief.
 */

type Point = readonly [number, number]
interface Figure {
  title: string
  points: Point[]
}
interface Level {
  n: number
  name: string
  figures: Figure[]
}

// Grilla compartida de 5×5 (coordenadas 0-4 en ambos ejes) para las 3
// figuras de todos los niveles — sólo cambia CUÁNTOS puntos tiene cada
// figura, nunca el tamaño de la grilla, así que la mecánica no cambia entre
// niveles (mismo criterio de DondeEsta: "la misma habilidad, no dos
// habilidades distintas apiladas").
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    figures: [
      { title: 'la casa', points: [[0, 4], [0, 2], [2, 0], [4, 2], [4, 4]] },
      { title: 'la flecha', points: [[0, 2], [3, 2], [2, 0], [4, 2], [2, 4]] },
      { title: 'el triángulo', points: [[0, 3], [2, 0], [4, 3], [3, 4], [1, 4]] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    figures: [
      { title: 'el zigzag', points: [[0, 0], [1, 4], [2, 0], [3, 4], [4, 0], [2, 2]] },
      { title: 'la onda', points: [[0, 4], [1, 0], [2, 3], [3, 0], [4, 4], [2, 1]] },
      { title: 'la casa grande', points: [[0, 4], [0, 2], [2, 0], [4, 2], [4, 4], [2, 4]] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    figures: [
      { title: 'la estrella', points: [[2, 0], [3, 3], [0, 1], [4, 1], [1, 3], [2, 2], [2, 4]] },
      { title: 'el rayo', points: [[3, 0], [1, 1], [2, 1], [0, 3], [2, 3], [1, 4], [3, 2]] },
      { title: 'la cometa', points: [[2, 0], [0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [2, 1]] },
    ],
  },
]

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto del
// lote (ver ElDescuento.tsx).
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

const GRID_SIZE = 5 // puntos por lado (coordenadas 0..4)
const ALL_DOTS: Point[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => [i % GRID_SIZE, Math.floor(i / GRID_SIZE)])
const keyOf = (p: Point) => `${p[0]},${p[1]}`
const pct = (v: number) => `${(v / (GRID_SIZE - 1)) * 100}%`

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

const PRAISE_GOOD = ['¡Perfecto, quedó igual!', '¡Muy bien copiada!', '¡Excelente!', '¡Así se hace!']
const WRONG_HINTS = [
  'Ese no es el siguiente punto — mirá la figura de arriba.',
  'Todavía no — fijate bien cuál sigue en el modelo.',
  'Casi. Repasá el orden numerado de la figura de arriba.',
]

/** Grilla de fondo: puntos tenues en las 25 posiciones, sólo de referencia visual. */
function BackgroundDots() {
  return (
    <>
      {ALL_DOTS.map((p) => (
        <div
          key={keyOf(p)}
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200"
          style={{ left: pct(p[0]), top: pct(p[1]) }}
        />
      ))}
    </>
  )
}

/** Líneas que conectan, en orden, los primeros `count` puntos de `points`. */
function FigureLines({ points, count, color }: { points: Point[]; count: number; color: string }) {
  const visible = points.slice(0, count)
  if (visible.length < 2) return null
  return (
    <svg viewBox={`0 0 ${GRID_SIZE - 1} ${GRID_SIZE - 1}`} className="pointer-events-none absolute inset-0 h-full w-full">
      <polyline
        points={visible.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={0.07}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function CopiaLaFigura({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  const figures = useMemo(
    () => shuffle(level.figures).slice(0, roundsForLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const figure = figures[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [visitedCount, setVisitedCount] = useState(0)
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Toques fuera de orden, acumulados a través de niveles 1→2→3 y sólo en
  // cero en un reinicio real del día (ver la rama isWrap de nextLevel).
  const [mistakes, setMistakes] = useState(0)

  const visitedKeys = useMemo(
    () => new Set((figure?.points.slice(0, visitedCount) ?? []).map(keyOf)),
    [figure, visitedCount],
  )

  function tapDot(p: Point) {
    if (!figure || resolved) return
    const expected = figure.points[visitedCount]
    if (expected && expected[0] === p[0] && expected[1] === p[1]) {
      const next = visitedCount + 1
      setVisitedCount(next)
      setHint(null)
      if (next >= figure.points.length) {
        setPraise(pickOne(PRAISE_GOOD))
        setResolved(true)
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setVisitedCount(0)
          setResolved(false)
        }, 900)
      }
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(WRONG_HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado sobre [levelIdx, roundKey].
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setVisitedCount(0)
    setHint(null)
    setResolved(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setVisitedCount(0)
    setHint(null)
    setResolved(false)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
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
          {level.name}
        </span>
        {!done && figure && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Reconstruí la figura: {figure.title}</h2>
            <p className="mt-2 text-base text-slate-500">Tocá los puntos de abajo en el mismo orden que el modelo.</p>
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

      {!done && figure && (
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center">
          {/* Modelo — siempre visible y completo, con cada punto numerado */}
          <div className="flex flex-col items-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo</p>
            <div className="relative aspect-square w-40 rounded-2xl border-2 border-slate-100 bg-white sm:w-44">
              <BackgroundDots />
              <FigureLines points={figure.points} count={figure.points.length} color="#7C3AED" />
              {figure.points.map((p, i) => (
                <div
                  key={keyOf(p)}
                  className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white"
                  style={{ left: pct(p[0]), top: pct(p[1]) }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Grilla interactiva — vacía al empezar, se completa a medida que se toca en orden */}
          <div className="flex flex-col items-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tu turno</p>
            <div className="relative aspect-square w-56 rounded-2xl border-2 border-slate-100 bg-white sm:w-64">
              <BackgroundDots />
              <FigureLines points={figure.points} count={visitedCount} color="#1B6FC4" />
              {ALL_DOTS.map((p) => {
                const isVisited = visitedKeys.has(keyOf(p))
                const order = isVisited ? figure.points.findIndex((fp) => fp[0] === p[0] && fp[1] === p[1]) + 1 : null
                return (
                  <button
                    key={keyOf(p)}
                    type="button"
                    disabled={resolved}
                    onClick={() => tapDot(p)}
                    aria-label={`punto columna ${p[0] + 1}, fila ${p[1] + 1}`}
                    className={[
                      'absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      isVisited
                        ? 'bg-tiam-blue text-white'
                        : 'border-2 border-slate-300 bg-white hover:border-tiam-blue/50 hover:bg-tiam-blue/5 active:scale-90',
                    ].join(' ')}
                    style={{ left: pct(p[0]), top: pct(p[1]) }}
                  >
                    {order}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
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
            Copiaste bien las {roundsForLevel} figuras — completaste el nivel {levelIdx + 1}.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra figura
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
