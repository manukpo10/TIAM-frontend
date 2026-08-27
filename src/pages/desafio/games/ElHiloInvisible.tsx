import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Route } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El hilo invisible" — día 21 (mes 3), atención. Reemplaza a CaminoSecreto
 * (orientación). Pedido explícito del usuario a partir de una hoja de
 * referencia: una fila de íconos arriba, conectada por líneas que se cruzan
 * a varias filas de números — hay que seguir CON LA VISTA la línea de un
 * ícono puntual a través del enredo hasta el final, sin confundirse con las
 * otras 5 líneas que se cruzan en el camino. Reasignado de orientación a
 * atención porque lo que se ejercita acá es rastreo visual sostenido en un
 * campo de distractores — no es "recordar una secuencia de pasos" como
 * Encaminada/CaminoSecreto/RadarDeSilabas (la familia real de orientación de
 * este catálogo), es desambiguar visualmente UNA línea entre varias que se
 * cruzan, tarea clásica de atención (parecida en espíritu al Trail Making
 * Test).
 *
 * Cada ronda arma un laberinto de columnas (ítemsPorFila) × filas de números
 * (numRows, 2/3/4 según nivel): entre cada par de filas consecutivas hay una
 * PERMUTACIÓN — cada columna de la fila de arriba conecta con exactamente
 * una columna de la fila de abajo, y viceversa (nunca dos líneas nacen o
 * terminan en el mismo lugar), así el laberinto se ve exactamente como la
 * hoja de referencia: un maremoto de líneas rectas que se cruzan pero nunca
 * se juntan. `goodPermutation` fuerza dos cosas por sorteo con reintento:
 * ningún ítem baja derecho a la misma columna (sería una línea vertical
 * "gratis", fácil de seguir sin esfuerzo) y hay un mínimo de cruces reales
 * (una permutación casi ordenada se ve como líneas casi paralelas, muy poco
 * enredo) — verificado 1000 veces por nivel con un script descartable antes
 * de escribir este componente (misma disciplina que CrucigramaDeCifras):
 * siempre biyección válida, nunca punto fijo, mínimo de cruces aceptable en
 * los 3 niveles.
 *
 * El laberinto ENTERO (los 6 caminos, no sólo el del ícono activo) se
 * dibuja siempre completo, igual que la hoja de papel — ocultar las otras
 * líneas convertiría esto en un ejercicio trivial de "seguí la única línea
 * que hay". El ícono activo de la ronda se marca con un aro de color; el
 * jugador toca, fila por fila, la celda de número donde cree que sigue SU
 * línea (nunca en otro orden: la fila siguiente ni siquiera es interactiva
 * hasta resolver la actual, mismo contrato secuencial que TrazaElCamino).
 * Un acierto pinta ese tramo de línea en azul (progreso visible) y revela
 * la cifra en el "código" que se arma abajo; un error dreal dentro de esa
 * fila específica sólo da una pista y nunca bloquea — igual que el resto
 * del catálogo.
 *
 * Renderizado: mismo mecanismo que TrazaElCamino.tsx (SVG con viewBox +
 * posiciones absolutas en porcentaje) pero adaptado de "una polyline por
 * camino sobre una grilla 2D" a "N líneas independientes por franja entre
 * dos filas", ya que acá son 6 caminos simultáneos, no uno solo.
 *
 * Contenido: números e íconos se generan de nuevo en cada ronda (nunca fijos
 * como CaminoSecreto/TrazaElCamino) — memorizar "la fila 2 siempre es
 * 6,0,7,2,4,0" volvería trivial cualquier repetición, y acá no hay
 * contenido semántico que perder por sortear de nuevo (a diferencia de un
 * crucigrama con palabras reales). 2 rondas por nivel, laberinto nuevo en
 * cada una, ícono activo elegido al azar entre las columnas de esa ronda.
 */

interface Maze {
  icons: string[] // itemsPerRow emoji — fila 0
  rows: number[][] // numRows filas de dígitos
  perms: number[][] // perms[k][c] = columna de la fila k+1 a la que conecta la columna c de la fila k
  activeCol: number
}
interface Level {
  n: number
  name: string
  itemsPerRow: number
  numRows: number
  iconPool: string[]
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', itemsPerRow: 4, numRows: 2, iconPool: ['🍎', '🍐', '🥕', '🥦'] },
  { n: 2, name: 'Nivel 2', itemsPerRow: 5, numRows: 3, iconPool: ['🍎', '🍐', '🎃', '🥦', '🍅'] },
  { n: 3, name: 'Nivel 3', itemsPerRow: 6, numRows: 4, iconPool: ['🍎', '🍐', '🎃', '🥦', '🍅', '🍆'] },
]
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
function randomPermutation(n: number): number[] {
  return shuffle(Array.from({ length: n }, (_, i) => i))
}
function crossingCount(perm: number[]): number {
  let count = 0
  for (let i = 0; i < perm.length; i++)
    for (let j = i + 1; j < perm.length; j++) if ((perm[i] - perm[j]) * (i - j) < 0) count++
  return count
}
// Ver cabecera: sin puntos fijos, con un piso de cruces reales — verificado
// por script que siempre converge dentro de 40 intentos en los 3 niveles.
function goodPermutation(n: number): number[] {
  const maxCrossings = (n * (n - 1)) / 2
  for (let attempt = 0; attempt < 40; attempt++) {
    const p = randomPermutation(n)
    if (p.every((v, i) => v !== i) && crossingCount(p) >= Math.floor(maxCrossings * 0.4)) return p
  }
  return randomPermutation(n)
}

function buildMaze(level: Level): Maze {
  const perms = Array.from({ length: level.numRows }, () => goodPermutation(level.itemsPerRow))
  const rows = Array.from({ length: level.numRows }, () =>
    Array.from({ length: level.itemsPerRow }, () => Math.floor(Math.random() * 10)),
  )
  const icons = shuffle(level.iconPool).slice(0, level.itemsPerRow)
  const activeCol = Math.floor(Math.random() * level.itemsPerRow)
  return { icons, rows, perms, activeCol }
}

/** Columna que ocupa el camino activo en cada fila (0 = íconos, 1..numRows = números). */
function activePathColumns(maze: Maze): number[] {
  const cols = [maze.activeCol]
  let cur = maze.activeCol
  for (const perm of maze.perms) {
    cur = perm[cur]
    cols.push(cur)
  }
  return cols
}

const pctX = (col: number, itemsPerRow: number) => `${(col / (itemsPerRow - 1)) * 100}%`
const pctY = (row: number, numRows: number) => `${(row / numRows) * 100}%`

const HINTS = [
  'Ese no es — seguí con la vista la línea de tu ícono, sin saltar a otra.',
  'Todavía no. Fijate bien dónde cruza justo tu línea en esta fila.',
  'Casi. Repasá el tramo que ya resolviste antes de elegir.',
]
const PRAISE = ['¡Llegaste al final!', '¡Excelente rastreo!', '¡Muy bien seguido!', '¡Perfecto!']

export function ElHiloInvisible({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  // Un laberinto nuevo por ronda — ver cabecera sobre por qué NO se fija
  // como el resto del catálogo. Un array por nivel, decidido una sola vez
  // por época para que "Repetir" devuelva exactamente lo mismo.
  const [epochMazes] = useState(() =>
    LEVELS.map((lvl, i) => Array.from({ length: ROUNDS_PER_LEVEL[i] }, () => buildMaze(lvl))),
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= roundsForLevel
  const maze = epochMazes[levelIdx][roundIdx] as Maze | undefined

  const activeCols = useMemo(() => (maze ? activePathColumns(maze) : []), [maze])
  const activeCode = useMemo(
    () => (maze ? activeCols.slice(1).map((col, r) => maze.rows[r][col]) : []),
    [maze, activeCols],
  )

  // Cuántas filas de números ya resolvió para el camino activo (0 = ninguna).
  const [progress, setProgress] = useState(0)
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [wrongCell, setWrongCell] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Errores, acumulados a través de niveles 1→2→3, sólo en cero en un
  // reinicio real del día — mismo patrón que el resto del catálogo.
  const [mistakes, setMistakes] = useState(0)

  function tapCell(row: number, col: number) {
    if (!maze || resolved || row !== progress + 1) return
    if (col === activeCols[row]) {
      setHint(null)
      const next = progress + 1
      setProgress(next)
      if (next >= level.numRows) {
        setPraise(pickOne(PRAISE))
        setResolved(true)
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setProgress(0)
          setResolved(false)
          setHint(null)
        }, 1000)
      }
    } else {
      const key = `${row}-${col}`
      setWrongCell(key)
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
      window.setTimeout(() => setWrongCell((w) => (w === key ? null : w)), 500)
    }
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setProgress(0)
    setResolved(false)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setProgress(0)
    setResolved(false)
    setHint(null)
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
  }, [done, levelIdx, roundKey, mistakes])

  const totalRows = level.numRows + 1

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <p className="mt-2 text-base font-semibold text-slate-500">
            Camino {roundIdx + 1} de {roundsForLevel}
          </p>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Route className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            El ícono marcado tiene una línea que se cruza con las demás hasta abajo. Seguila con la vista, fila por
            fila, y tocá el número donde sigue tu línea — sin confundirte con las otras.
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

      {phase === 'playing' && !done && maze && (
        <>
          {/* Laberinto */}
          <div className="relative mx-auto mt-4 w-full max-w-sm" style={{ aspectRatio: `${level.itemsPerRow} / ${totalRows * 0.9}` }}>
            <svg
              viewBox={`0 0 ${level.itemsPerRow - 1} ${level.numRows}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {maze.perms.map((perm, row) =>
                perm.map((toCol, fromCol) => {
                  const isActiveSegment = activeCols[row] === fromCol && activeCols[row + 1] === toCol
                  const isSolvedSegment = isActiveSegment && progress > row
                  return (
                    <line
                      key={`${row}-${fromCol}`}
                      x1={fromCol}
                      y1={row}
                      x2={toCol}
                      y2={row + 1}
                      stroke={isSolvedSegment ? '#1B6FC4' : '#CBD5E1'}
                      strokeWidth={isSolvedSegment ? 0.06 : 0.03}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                }),
              )}
            </svg>

            {/* Fila de íconos */}
            {maze.icons.map((icon, col) => (
              <div
                key={`icon-${col}`}
                className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xl"
                style={{ left: pctX(col, level.itemsPerRow), top: pctY(0, level.numRows) }}
              >
                <span
                  className={col === maze.activeCol ? 'flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-tiam-blue' : ''}
                >
                  {icon}
                </span>
              </div>
            ))}

            {/* Filas de números */}
            {maze.rows.map((rowValues, r) =>
              rowValues.map((value, col) => {
                const row = r + 1
                const isNext = row === progress + 1
                const isSolvedHere = activeCols[row] === col && progress >= row
                const isWrong = wrongCell === `${row}-${col}`
                return (
                  <button
                    key={`n-${row}-${col}`}
                    type="button"
                    disabled={!isNext || resolved}
                    onClick={() => tapCell(row, col)}
                    aria-label={`número ${value}, fila ${row}, columna ${col + 1}`}
                    className={[
                      'absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-extrabold transition sm:text-base',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      isSolvedHere
                        ? 'border-tiam-green bg-tiam-green/10 text-tiam-green'
                        : isWrong
                          ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300 bg-slate-100 text-slate-500'
                          : isNext
                            ? 'border-tiam-blue bg-white text-slate-800 hover:bg-tiam-blue/5 active:scale-90'
                            : 'border-slate-200 bg-white text-slate-400',
                    ].join(' ')}
                    style={{ left: pctX(col, level.itemsPerRow), top: pctY(row, level.numRows) }}
                  >
                    {value}
                  </button>
                )
              }),
            )}
          </div>

          {/* Código que se arma a medida que se resuelve cada fila */}
          <div className="mx-auto mt-4 flex max-w-[220px] items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3">
            <span className="text-xl">{maze.icons[maze.activeCol]}</span>
            <span className="font-mono text-xl font-extrabold tracking-wider text-tiam-blue">
              {activeCode.map((d, i) => (i < progress ? d : '_')).join(' ')}
            </span>
          </div>

          {hint && !resolved && <p className="mt-3 text-center text-base font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-3 text-center text-lg font-semibold text-tiam-green">{praise}</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Seguiste los {roundsForLevel} caminos — completaste el {level.name.toLowerCase()}.
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
