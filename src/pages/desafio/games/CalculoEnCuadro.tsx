import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles, Table2 } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cálculo en cuadro" — día 19, cálculo. Una tabla con números en la columna
 * izquierda y operaciones simples (+24, -16…) en el encabezado de columnas —
 * cada celda es el número de esa fila con la operación de esa columna
 * aplicada. En vez de pedir la tabla ENTERA (6-9 filas × hasta 4 columnas
 * sería demasiada carga por ronda, y no entra cómodo en mobile), cada ronda
 * sortea unos pocos casilleros vacíos ("celdas objetivo") sobre la tabla ya
 * completa — el resto se ve resuelto de entrada, como contexto/andamiaje.
 * Se resuelve una celda objetivo a la vez, como LaPiramide: se elige el
 * resultado correcto entre 4 opciones (nunca teclado numérico libre, por
 * pedido explícito del brief).
 *
 * Contenido PROCEDURAL: se generan primero las operaciones (magnitud dentro
 * de un rango por nivel) y los números base, siempre con un margen que
 * garantiza que ninguna resta da negativo (el rango de números base
 * arranca bien por encima del máximo posible de las restas de ese nivel) —
 * y RECIÉN DESPUÉS se calculan los valores de la tabla aplicando cada
 * operación. Nunca al revés, así el resultado es correcto por construcción
 * (mismo criterio que MesaDeCartas/DesafioDeDeduccion).
 *
 * Los distractores de cada celda son el error típico de este tipo de tabla:
 * el resultado de OTRA columna aplicada a la misma fila (confundir de
 * operación) o de OTRA fila con la misma columna (confundir de número de
 * partida), no números sueltos sin relación con la tabla.
 *
 * Nivel 1: 6 filas, una sola columna/operación, números chicos, 2 celdas
 * objetivo. Nivel 2: 8 filas, 3 columnas, números medianos, 3 objetivos.
 * Nivel 3: 9 filas, 4 columnas, números más grandes, 4 objetivos — la tabla
 * más cargada de la app en cantidad de casilleros, por eso el resto se
 * queda siempre resuelto (nunca las 9×4 celdas en juego a la vez) y la fila
 * se compacta (padding chico, manteniendo texto en text-base como mínimo)
 * para entrar sin scroll a 375×812.
 */

interface Op {
  label: string
  apply: (n: number) => number
}
interface Target {
  row: number
  col: number
}
interface TableRound {
  rows: number[]
  ops: Op[]
  table: number[][] // table[row][col]
  targets: Target[] // orden de resolución
  optionsPerTarget: number[][] // paralelo a targets
}
interface LevelConfig {
  n: number
  name: string
  rowCount: number
  colCount: number
  targetCount: number
  baseRange: [number, number]
  magRange: [number, number]
}

const LEVEL_CONFIGS: LevelConfig[] = [
  { n: 1, name: 'Nivel 1', rowCount: 6, colCount: 1, targetCount: 2, baseRange: [20, 60], magRange: [3, 15] },
  { n: 2, name: 'Nivel 2', rowCount: 8, colCount: 3, targetCount: 3, baseRange: [30, 90], magRange: [10, 25] },
  { n: 3, name: 'Nivel 3', rowCount: 9, colCount: 4, targetCount: 4, baseRange: [100, 300], magRange: [16, 80] },
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
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
function fillDecoys(correct: number, seeds: number[], need: number): number[] {
  const set = new Set<number>()
  for (const s of seeds) {
    if (s !== correct && s > 0) set.add(s)
  }
  let offset = 2
  while (set.size < need && offset < 80) {
    if (correct + offset !== correct) set.add(correct + offset)
    if (correct - offset > 0) set.add(correct - offset)
    offset += 2
  }
  return shuffle(Array.from(set)).slice(0, need)
}

function buildOps(cfg: LevelConfig): Op[] {
  const ops: Op[] = []
  const usedMags = new Set<number>()
  let guard = 0
  while (ops.length < cfg.colCount && guard < 200) {
    guard++
    const mag = randInt(cfg.magRange[0], cfg.magRange[1])
    if (usedMags.has(mag)) continue
    usedMags.add(mag)
    const sign = Math.random() < 0.5 ? 1 : -1
    const label = sign > 0 ? `+${mag}` : `-${mag}`
    ops.push({ label, apply: (x) => x + sign * mag })
  }
  return ops
}
function buildRows(cfg: LevelConfig): number[] {
  const set = new Set<number>()
  let guard = 0
  while (set.size < cfg.rowCount && guard < 500) {
    set.add(randInt(cfg.baseRange[0], cfg.baseRange[1]))
    guard++
  }
  return shuffle(Array.from(set))
}
function buildTargets(cfg: LevelConfig): Target[] {
  const all: Target[] = []
  for (let r = 0; r < cfg.rowCount; r++) for (let c = 0; c < cfg.colCount; c++) all.push({ row: r, col: c })
  return shuffle(all).slice(0, cfg.targetCount)
}

function buildRound(cfg: LevelConfig): TableRound {
  const ops = buildOps(cfg)
  const rows = buildRows(cfg)
  const targets = buildTargets(cfg)
  const table = rows.map((base) => ops.map((op) => op.apply(base)))

  const optionsPerTarget = targets.map(({ row, col }) => {
    const correct = table[row][col]
    // Errores típicos: el resultado de OTRA columna en la MISMA fila
    // (confundir de operación) o de OTRA fila en la MISMA columna
    // (confundir de número de partida).
    const seeds: number[] = []
    if (ops.length > 1) seeds.push(table[row][(col + 1) % ops.length])
    if (rows.length > 1) seeds.push(table[(row + 1) % rows.length][col])
    seeds.push(correct + (Math.random() < 0.5 ? 1 : -1) * randInt(2, 6))
    return shuffle([correct, ...fillDecoys(correct, seeds, 3)])
  })

  return { rows, ops, table, targets, optionsPerTarget }
}
function buildEpoch(): TableRound[][] {
  return LEVEL_CONFIGS.map((cfg, i) => Array.from({ length: ROUNDS_PER_LEVEL[i] }, () => buildRound(cfg)))
}

const HINTS = [
  'Ese no es — volvé a calcular con calma.',
  'Casi. Fijate bien la fila y la columna correctas.',
  'No es ese — probá con otra opción.',
]
const LEVEL_PRAISE_GOOD = ['¡Excelente nivel!', '¡Muy bien!', '¡Qué bien calculás!']
const LEVEL_PRAISE_OK = ['¡Buen intento! Con la práctica sale cada vez mejor.', '¡Bien ahí! Seguí practicando.']

export function CalculoEnCuadro({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Las rondas de la época completa, decididas una sola vez — al montar —
  // nunca vueltas a generar por re-visitar un nivel,
  // así "Repetir" devuelve exactamente la misma tabla.
  const [epochRounds] = useState(() => buildEpoch())
  const cfg = LEVEL_CONFIGS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  // Cuál celda objetivo (índice en round.targets) está activa, cuáles ya se
  // revelaron, y el set de opciones eliminadas SÓLO para la activa (se
  // limpia al cambiar de objetivo) — mismo patrón que LaPiramide.
  const [activeIdx, setActiveIdx] = useState(0)
  const [revealedIdxs, setRevealedIdxs] = useState<Set<number>>(new Set())
  const [eliminated, setEliminated] = useState<Set<number>>(new Set())
  const [resolving, setResolving] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  const [correctCount, setCorrectCount] = useState(0)
  // Errores acumulados a través de niveles 1→2→3, sólo en cero en un
  // reinicio real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  const target = round ? round.targets[activeIdx] : undefined
  const activeOptions = round ? round.optionsPerTarget[activeIdx] : []

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctCount / roundsForLevel >= 0.6 ? LEVEL_PRAISE_GOOD : LEVEL_PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function targetIndexFor(row: number, col: number): number {
    return round.targets.findIndex((t) => t.row === row && t.col === col)
  }
  function cellState(row: number, col: number): 'given' | 'revealed' | 'active' | 'locked' {
    const idx = targetIndexFor(row, col)
    if (idx === -1) return 'given'
    if (revealedIdxs.has(idx)) return 'revealed'
    return idx === activeIdx ? 'active' : 'locked'
  }

  function guess(value: number) {
    if (!round || !target || resolving || eliminated.has(value)) return
    const correct = round.table[target.row][target.col]
    if (value === correct) {
      setResolving(true)
      setHint(null)
      setRevealedIdxs((prev) => new Set(prev).add(activeIdx))
      setCorrectCount((c) => c + 1)
      const isLast = activeIdx + 1 >= round.targets.length
      window.setTimeout(
        () => {
          if (isLast) {
            setRoundIdx((i) => i + 1)
            setActiveIdx(0)
            setRevealedIdxs(new Set())
          } else {
            setActiveIdx((i) => i + 1)
          }
          setEliminated(new Set())
          setResolving(false)
        },
        isLast ? 1000 : 650,
      )
    } else {
      setEliminated((prev) => new Set(prev).add(value))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.

  // "Siguiente nivel" — avanza dentro de la MISMA época. epochRounds queda
  // intacto: las tablas del nivel i+1 ya se generaron al empezar la época.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setActiveIdx(0)
    setRevealedIdxs(new Set())
    setEliminated(new Set())
    setResolving(false)
    setHint(null)
    setCorrectCount(0)
  }

  // Se ejecuta con el botón "Repetir" en la tarjeta final del
  // último nivel (sólo se muestra ahí, así que siempre es un reinicio real
  // del día). roundKey siempre avanza: es el contador de "qué intento es
  // este" que usa el efecto de onComplete para dispararse otra vez en una
  // repetición.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setActiveIdx(0)
    setRevealedIdxs(new Set())
    setEliminated(new Set())
    setResolving(false)
    setHint(null)
    setCorrectCount(0)
    setMistakes(0)
  }
  // "Repetir" — misma tabla del intento recién terminado.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_CONFIGS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {cfg.name}
        </span>
        {phase === 'playing' && !done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Tabla {roundIdx + 1} de {roundsForLevel}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Table2 className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            La tabla combina cada número de la izquierda con la operación de su columna. Tocá el casillero marcado y
            elegí el resultado correcto entre las opciones.
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

      {phase === 'playing' && !done && round && target && (
        <>
          {/* Tabla */}
          <div className="mx-auto mt-4 w-full max-w-[340px] overflow-hidden rounded-2xl border-2 border-slate-200">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border-b border-r border-slate-200 px-1 py-1.5" />
                  {round.ops.map((op, c) => (
                    <th
                      key={c}
                      className="border-b border-r border-slate-200 px-1 py-1.5 text-base font-extrabold text-tiam-blue last:border-r-0"
                    >
                      {op.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {round.rows.map((base, r) => (
                  <tr key={r} className={r % 2 === 1 ? 'bg-slate-50/60' : ''}>
                    <th className="border-r border-t border-slate-200 px-1.5 py-1 text-base font-bold text-slate-700">
                      {base}
                    </th>
                    {round.ops.map((_, c) => {
                      const state = cellState(r, c)
                      return (
                        <td
                          key={c}
                          className={[
                            'border-r border-t border-slate-100 px-1 py-1 text-base font-bold last:border-r-0',
                            state === 'active'
                              ? 'bg-tiam-blue/10 text-tiam-blue'
                              : state === 'locked'
                                ? 'text-slate-300'
                                : 'text-slate-800',
                          ].join(' ')}
                        >
                          {state === 'given' || state === 'revealed' ? round.table[r][c] : '?'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-center text-lg font-semibold text-slate-700">
            ¿Cuánto es {round.rows[target.row]} {round.ops[target.col].label}?
          </p>

          {/* Opciones */}
          <div className="mx-auto mt-3 grid max-w-xs grid-cols-2 gap-2.5">
            {activeOptions.map((opt) => {
              const isEliminated = eliminated.has(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isEliminated || resolving}
                  onClick={() => guess(opt)}
                  className={[
                    'min-h-[52px] rounded-2xl border-2 text-xl font-extrabold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {hint && !resolving && <p className="mt-3 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Completaste las {roundsForLevel} tablas — terminaste el nivel {levelIdx + 1}.
          </p>
          {levelIdx < LEVEL_CONFIGS.length - 1 ? (
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
