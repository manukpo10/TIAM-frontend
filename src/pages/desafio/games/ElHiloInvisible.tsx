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
 * (numRows, 2/3/3 según nivel — nivel 3 no crece más allá de nivel 2, ver su
 * propio comentario en LEVELS más abajo): entre cada par de filas consecutivas hay una
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
 * que hay". El ícono activo de la ronda se marca con un aro de color.
 *
 * La grilla en sí NUNCA es superficie de toque (a propósito, mismo
 * principio que el CaminoSecreto original: "las celdas nunca son destino
 * de toque... las opciones de múltiple choice son la única superficie de
 * respuesta interactiva") — la pregunta es "¿cuál es el camino COMPLETO,
 * en números, de este ícono?" y se responde eligiendo, entre varios
 * códigos de 2 a 4 cifras, cuál es el correcto. Los códigos señuelo son
 * los caminos REALES de otros íconos de ESTE MISMO laberinto (nunca
 * inventados) — así un señuelo nunca es descartable a simple vista por
 * "no tiene pinta de código válido"; hay que haber trazado bien el ícono
 * correcto, no solo reconocer un número con forma rara. Un acierto pinta
 * el camino completo del ícono activo en azul (confirmación visual, todo
 * de una vez); un error elimina esa opción (gris, nunca roja) y da una
 * pista, sin bloquear — igual que el resto del catálogo.
 *
 * Renderizado: mismo mecanismo que TrazaElCamino.tsx (SVG con viewBox +
 * posiciones absolutas en porcentaje) pero adaptado de "una polyline por
 * camino sobre una grilla 2D" a "N líneas independientes por franja entre
 * dos filas", ya que acá son 6 caminos simultáneos, no uno solo.
 *
 * El color/grosor de línea NO son cosméticos, son el hallazgo real de una
 * verificación en vivo: un primer intento con gris clarito (#94A3B8,
 * 1.5px) se veía perfecto en la franja ícono→fila1, pero se volvía
 * invisible a simple vista en franjas donde la permutación converge cerca
 * de un único punto central (ej. una reversión completa [3,2,1,0]: las 4
 * líneas se apiñan tan cerca unas de otras cerca del cruce que un trazo
 * clarito deja de distinguirse). Confirmado con una prueba directa
 * (pintar esas líneas de rojo intenso — SÍ aparecían, eran datos/posición
 * correctos, sólo bajo contraste) antes de asumir que era un bug de
 * cálculo. #64748B (slate-600) a 2px resuelve el peor caso sin verse
 * pesado en las franjas con más separación. No confiar en un chequeo por
 * DOM (conteo de `<line>`, atributos, computed style) como prueba de que
 * algo "se ve": ese chequeo pasó igual con el gris invisible — sólo una
 * captura de pantalla real lo detectó.
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
  // Mismo tamaño que nivel 2 a propósito — la forma "completa" de la hoja de
  // referencia (6 columnas × 4 filas) resultó demasiado cargada en la
  // práctica (feedback en vivo del usuario). Sigue siendo un nivel propio
  // (rondas y laberintos nuevos, no comparte contenido con nivel 2), sólo
  // que ya no escala en tamaño en el último paso.
  { n: 3, name: 'Nivel 3', itemsPerRow: 5, numRows: 3, iconPool: ['🍎', '🍐', '🎃', '🥦', '🍅'] },
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

// Con la respuesta como múltiple choice de CÓDIGOS completos (ver cabecera),
// dos columnas con el mismo código serían dos opciones idénticas en la
// lista — ambigüedad real, no cosmética. Reintenta hasta que las
// `itemsPerRow` columnas den `itemsPerRow` códigos distintos; verificado por
// script (2000 corridas/nivel) que 30 intentos alcanzan siempre y de sobra
// (peor caso nivel 1, sólo 2 cifras = 100 códigos posibles para 4 columnas:
// máximo 3 intentos vistos en 2000 corridas).
function buildMaze(level: Level): Maze {
  let lastAttempt: Maze | null = null
  for (let attempt = 0; attempt < 30; attempt++) {
    const perms = Array.from({ length: level.numRows }, () => goodPermutation(level.itemsPerRow))
    const rows = Array.from({ length: level.numRows }, () =>
      Array.from({ length: level.itemsPerRow }, () => Math.floor(Math.random() * 10)),
    )
    const maze: Maze = {
      icons: shuffle(level.iconPool).slice(0, level.itemsPerRow),
      rows,
      perms,
      activeCol: Math.floor(Math.random() * level.itemsPerRow),
    }
    const codes = Array.from({ length: level.itemsPerRow }, (_, c) => codeFor(maze, c))
    if (new Set(codes).size === level.itemsPerRow) return maze
    lastAttempt = maze
  }
  // Nunca pasa en la práctica (ver script de verificación arriba) — pero si
  // los 30 intentos fallan, mejor un laberinto con un código repetido que
  // tirar el componente entero abajo.
  return lastAttempt as Maze
}

/** Columna que ocupa un camino (el que arranca en `startCol`) en cada fila. */
function pathColumns(maze: Maze, startCol: number): number[] {
  const cols = [startCol]
  let cur = startCol
  for (const perm of maze.perms) {
    cur = perm[cur]
    cols.push(cur)
  }
  return cols
}
/** Código de cifras (una por fila de números) del camino que arranca en `startCol`. */
function codeFor(maze: Maze, startCol: number): string {
  const cols = pathColumns(maze, startCol)
  return cols.slice(1).map((col, r) => maze.rows[r][col]).join('')
}
// Tope parejo de 4 opciones en los 3 niveles — la dificultad real ya sube
// vía itemsPerRow/numRows (más caminos para desambiguar, más cifras por
// código), no hace falta encima ampliar el menú de opciones.
function buildOptions(maze: Maze, itemsPerRow: number): string[] {
  const numOptions = Math.min(4, itemsPerRow)
  const correct = codeFor(maze, maze.activeCol)
  const decoyCols = shuffle(
    Array.from({ length: itemsPerRow }, (_, c) => c).filter((c) => c !== maze.activeCol),
  ).slice(0, numOptions - 1)
  return shuffle([correct, ...decoyCols.map((c) => codeFor(maze, c))])
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

  const activeCols = useMemo(() => (maze ? pathColumns(maze, maze.activeCol) : []), [maze])
  const correctCode = useMemo(() => (maze ? codeFor(maze, maze.activeCol) : ''), [maze])
  const options = useMemo(
    () => (maze ? buildOptions(maze, level.itemsPerRow) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maze],
  )

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Errores, acumulados a través de niveles 1→2→3, sólo en cero en un
  // reinicio real del día — mismo patrón que el resto del catálogo.
  const [mistakes, setMistakes] = useState(0)

  function guess(code: string) {
    if (!maze || solved || eliminated.has(code)) return
    if (code === correctCode) {
      setHint(null)
      setPraise(pickOne(PRAISE))
      setSolved(code)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setSolved(null)
        setHint(null)
      }, 1200)
    } else {
      setEliminated((prev) => (prev.has(code) ? prev : new Set(prev).add(code)))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(null)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(null)
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
            El ícono marcado tiene una línea que se cruza con las demás hasta abajo. Seguila con la vista hasta el
            final y tocá, entre las opciones, el código de números que forma tu línea.
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
          {/* Laberinto — sólo visual, nunca superficie de toque (ver
              cabecera). Al acertar, el camino completo del ícono activo se
              resalta en azul de una sola vez, como confirmación. */}
          <div className="relative mx-auto mt-4 w-full max-w-sm" style={{ aspectRatio: `${level.itemsPerRow} / ${totalRows * 0.9}` }}>
            <svg
              viewBox={`0 0 ${level.itemsPerRow - 1} ${level.numRows}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {maze.perms.map((perm, row) =>
                perm.map((toCol, fromCol) => {
                  const isActiveSegment = activeCols[row] === fromCol && activeCols[row + 1] === toCol
                  const isSolvedSegment = isActiveSegment && !!solved
                  return (
                    <line
                      key={`${row}-${fromCol}`}
                      x1={fromCol}
                      y1={row}
                      x2={toCol}
                      y2={row + 1}
                      stroke={isSolvedSegment ? '#1B6FC4' : '#64748B'}
                      strokeWidth={isSolvedSegment ? 2.5 : 2}
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

            {/* Filas de números — puramente visuales, ver arriba */}
            {maze.rows.map((rowValues, r) =>
              rowValues.map((value, col) => {
                const row = r + 1
                const isSolvedHere = !!solved && activeCols[row] === col
                return (
                  <div
                    key={`n-${row}-${col}`}
                    className={[
                      'absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-extrabold transition sm:text-base',
                      isSolvedHere ? 'border-tiam-green bg-tiam-green/10 text-tiam-green' : 'border-slate-200 bg-white text-slate-700',
                    ].join(' ')}
                    style={{ left: pctX(col, level.itemsPerRow), top: pctY(row, level.numRows) }}
                  >
                    {value}
                  </div>
                )
              }),
            )}
          </div>

          {/* Pregunta + opciones — la única superficie interactiva */}
          <p className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-2 text-center text-base font-semibold text-slate-600">
            <span className="text-xl">{maze.icons[maze.activeCol]}</span>
            ¿Cuál es su camino en números?
          </p>
          <div className="mx-auto mt-3 grid max-w-xs grid-cols-2 gap-2.5">
            {options.map((code) => {
              const isEliminated = eliminated.has(code)
              const isSolvedOption = solved === code
              return (
                <button
                  key={code}
                  type="button"
                  disabled={isEliminated || !!solved}
                  onClick={() => guess(code)}
                  className={[
                    'min-h-[48px] rounded-2xl border-2 font-mono text-lg font-bold tracking-wider transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isSolvedOption
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-700 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {code}
                </button>
              )
            })}
          </div>

          {hint && !solved && <p className="mt-3 text-center text-base font-medium text-slate-500">{hint}</p>}
          {solved && <p className="mt-3 text-center text-lg font-semibold text-tiam-green">{praise}</p>}
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
