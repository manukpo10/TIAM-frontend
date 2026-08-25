import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, MapPin } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Trazá el camino" — praxias (trazado grafomotor sobre grilla de puntos,
 * adaptación táctil del clásico ejercicio de lápiz "uní los puntos en
 * orden"). Se muestra un recorrido MODELO (una secuencia de puntos
 * numerados y conectados, dibujado en SVG) y hay que reproducirlo tocando
 * los puntos de una grilla vacía EN EL MISMO ORDEN.
 *
 * Mismo motor que CopiaLaFigura.tsx (grilla de puntos + tocar-en-orden +
 * pista suave, nunca roja) pero con dos diferencias deliberadas para no
 * sentirse un calco: acá la grilla CRECE con el nivel (3×3 → 4×4 → 5×5,
 * nunca más grande que el 5×5 que CopiaLaFigura ya probó que entra en
 * mobile) en vez de quedar fija, y los recorridos se presentan como
 * "caminos" con nombre de trayecto cotidiano (el camino al kiosco, a la
 * plaza…) en vez de figuras reconocibles — reafirma que acá se ejercita
 * SEGUIR una ruta, no reconstruir una forma.
 *
 * El modelo queda SIEMPRE visible junto a la grilla interactiva (es copiar
 * un camino, no memorizarlo). Cada camino es un recorrido ABIERTO (nunca
 * vuelve a un punto ya usado), así que un punto del camino es correcto en
 * una sola posición de la secuencia — nunca hay ambigüedad sobre cuál
 * ocurrencia hay que tocar.
 *
 * NOTA para quien cablee este juego: los días 4 de Mes 1 y Mes 2 en
 * challengeContent.ts ya están ocupados (Clave de símbolos / El descuento),
 * así que "día 4" acá es sólo una etiqueta de planificación, no un slot
 * real de registry.ts todavía — este batch deliberadamente no toca ninguno
 * de los dos archivos (ver instrucciones del batch).
 *
 * 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto
 * del catálogo (ver ElDescuento.tsx).
 */

type Point = readonly [number, number]
interface Route {
  title: string
  points: Point[]
}
interface Level {
  n: number
  name: string
  gridSize: number
  routes: Route[]
}

// La grilla crece con el nivel (3×3 → 4×4 → 5×5) — 5×5 es el tamaño máximo
// que CopiaLaFigura.tsx ya validó que entra en 375×812 sin scroll de página.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    gridSize: 3,
    routes: [
      { title: 'el camino al kiosco', points: [[0, 2], [1, 0], [2, 2], [0, 0]] },
      { title: 'el camino a la plaza', points: [[0, 0], [2, 1], [0, 2], [2, 0]] },
      { title: 'el camino a lo de tu vecina', points: [[1, 0], [0, 2], [2, 2], [1, 1]] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    gridSize: 4,
    routes: [
      { title: 'el camino al almacén', points: [[0, 3], [1, 1], [3, 2], [0, 0], [3, 3]] },
      { title: 'el camino a la panadería', points: [[0, 0], [3, 0], [1, 2], [3, 3], [0, 2]] },
      { title: 'el camino a la farmacia', points: [[1, 0], [0, 2], [3, 3], [2, 0], [0, 3]] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    gridSize: 5,
    routes: [
      { title: 'el camino a lo de tu nieto', points: [[0, 4], [2, 1], [4, 3], [0, 0], [4, 4], [1, 2]] },
      { title: 'el camino al club', points: [[0, 0], [4, 1], [1, 3], [4, 4], [0, 2], [3, 0]] },
      { title: 'el camino a la iglesia', points: [[1, 0], [0, 3], [3, 4], [4, 1], [1, 2], [4, 4]] },
    ],
  },
]

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto
// del catálogo.
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

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

const keyOf = (p: Point) => `${p[0]},${p[1]}`
const pctOf = (v: number, gridSize: number) => `${(v / (gridSize - 1)) * 100}%`
const dotsFor = (gridSize: number): Point[] =>
  Array.from({ length: gridSize * gridSize }, (_, i) => [i % gridSize, Math.floor(i / gridSize)])

/** Grilla de fondo: puntos tenues en todas las posiciones, sólo de referencia visual. */
function BackgroundDots({ gridSize }: { gridSize: number }) {
  return (
    <>
      {dotsFor(gridSize).map((p) => (
        <div
          key={keyOf(p)}
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200"
          style={{ left: pctOf(p[0], gridSize), top: pctOf(p[1], gridSize) }}
        />
      ))}
    </>
  )
}

/** Líneas que conectan, en orden, los primeros `count` puntos del camino. */
function RouteLines({
  points,
  count,
  color,
  gridSize,
}: {
  points: Point[]
  count: number
  color: string
  gridSize: number
}) {
  const visible = points.slice(0, count)
  if (visible.length < 2) return null
  return (
    <svg viewBox={`0 0 ${gridSize - 1} ${gridSize - 1}`} className="pointer-events-none absolute inset-0 h-full w-full">
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

const PRAISE_GOOD = ['¡Perfecto, llegaste!', '¡Muy bien recorrido!', '¡Excelente!', '¡Así se hace!']
const WRONG_HINTS = [
  'Ese no es el siguiente paso — mirá el camino de arriba.',
  'Todavía no — fijate bien cuál sigue en el modelo.',
  'Casi. Repasá el orden numerado del camino de arriba.',
]

export function TrazaElCamino({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Qué caminos (del pool del nivel) juegan en ESTA "epoch" (una pasada
  // completa de 3 niveles) — se deciden una sola vez por epoch (al montar),
  // nunca por re-visitar un nivel a mitad de epoch, así
  // "Repetir" devuelve exactamente los mismos caminos.
  const [epochRoutes] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.routes).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const routes = epochRoutes[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const route = routes[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [visitedCount, setVisitedCount] = useState(0)
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Toques fuera de orden, acumulados a través de niveles 1→2→3 y sólo en
  // cero en un reinicio real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  const visitedKeys = new Set((route?.points.slice(0, visitedCount) ?? []).map(keyOf))

  function tapDot(p: Point) {
    if (!route || resolved) return
    const expected = route.points[visitedCount]
    if (expected && expected[0] === p[0] && expected[1] === p[1]) {
      const next = visitedCount + 1
      setVisitedCount(next)
      setHint(null)
      if (next >= route.points.length) {
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
  // el motivo de no hacerlo en un efecto separado.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setVisitedCount(0)
    setHint(null)
    setResolved(false)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setVisitedCount(0)
    setHint(null)
    setResolved(false)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
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
        {!done && route && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Recorré {route.title}</h2>
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

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que ElPasoAPaso.tsx. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <MapPin className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver un camino de modelo, marcado con puntos numerados. Tocá los puntos de la grilla vacía en ese
            mismo orden para recorrer el mismo camino.
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

      {phase === 'playing' && !done && route && (
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center">
          {/* Modelo — siempre visible y completo, con cada punto numerado */}
          <div className="flex flex-col items-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo</p>
            <div className="relative aspect-square w-40 rounded-2xl border-2 border-slate-100 bg-white sm:w-44">
              <BackgroundDots gridSize={level.gridSize} />
              <RouteLines points={route.points} count={route.points.length} color="#7C3AED" gridSize={level.gridSize} />
              {route.points.map((p, i) => (
                <div
                  key={keyOf(p)}
                  className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white"
                  style={{ left: pctOf(p[0], level.gridSize), top: pctOf(p[1], level.gridSize) }}
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
              <BackgroundDots gridSize={level.gridSize} />
              <RouteLines points={route.points} count={visitedCount} color="#1B6FC4" gridSize={level.gridSize} />
              {dotsFor(level.gridSize).map((p) => {
                const isVisited = visitedKeys.has(keyOf(p))
                const order = isVisited ? route.points.findIndex((fp) => fp[0] === p[0] && fp[1] === p[1]) + 1 : null
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
                    style={{ left: pctOf(p[0], level.gridSize), top: pctOf(p[1], level.gridSize) }}
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
            Recorriste los {roundsForLevel} caminos — terminaste el nivel {levelIdx + 1}.
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
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
