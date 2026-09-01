import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Hash, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Crucigrama de cifras" — día 11, cálculo. Un "fill-in" numérico: una
 * grilla chica con celdas bloqueadas y celdas jugables agrupadas en tiras
 * ("filas"/"columnas") de 2 a 4 cifras, algunas ya dadas como pista. El
 * jugador toca un número del banco y después la fila/columna donde cree que
 * encaja; se auto-valida en el momento (sin botón "Revisar").
 *
 * FORMA fija, CIFRAS procedurales: la forma de cada grilla (qué celdas están
 * bloqueadas, qué tiras existen y dónde se cruzan) está autorada a mano y
 * verificada por script antes de escribir este componente (misma disciplina
 * que Encaminada/LaPiramide) — armar a mano una forma de crucigrama válida
 * es fácil de arruinar con un índice mal puesto, así que eso se chequeó una
 * sola vez, no en cada partida. El chequeo incluye CONECTIVIDAD, no sólo
 * bordes/alineación: las 6 formas originales de este archivo tenían 1-3
 * tiras por grilla que no cruzaban a NINGUNA otra tira (ej. una fila de 2
 * cifras flotando sola en una esquina, sin compartir celda con nada) — eso
 * es justo lo que un jugador ve como "las filas y columnas no coinciden":
 * una tira sin cruce nunca revela ni una cifra por deducción, así que se
 * resuelve a puro ensayo-y-error de longitud+coincidencia exacta, sin
 * sentirse un crucigrama real. Corregido rehaciendo esas tiras para que
 * TODAS las de una misma grilla queden en una sola red conectada (BFS desde
 * la primera tira debe alcanzar a todas — verificado por script). Las CIFRAS de cada celda, en cambio, se
 * generan al azar en cada ronda: se llena la grilla celda por celda (una
 * sola vez por celda, así una intersección queda automáticamente consistente
 * entre ambas tiras que la comparten — no hace falta ningún chequeo extra de
 * "cruce válido", es correcto por construcción) y de ahí se derivan las
 * respuestas de cada tira. El primer dígito de toda tira nunca es 0 (no hay
 * números con cero a la izquierda). Si dos tiras no-dadas terminan con la
 * misma respuesta (posible con cifras al azar, aunque raro) la ronda se
 * vuelve a generar.
 *
 * La validación de un intento compara el número elegido contra la respuesta
 * EXACTA de la tira tocada (no sólo contra los cruces ya visibles) — así
 * nunca puede pasar que un número "distinto pero parecido" quede aceptado en
 * el lugar equivocado y deje la grilla inconsistente. Para el jugador esto
 * se siente exactamente igual que deducir por cruces: la cifra ya visible en
 * un cruce SIEMPRE contradice a cualquier número que no vaya ahí, así que un
 * intento mal irá a un choque visible casi siempre; en el único caso sin
 * cruce visible, alcanza con probar el número que sobra por descarte —
 * técnica válida en cualquier crucigrama de cifras real.
 *
 * Nunca rojo: un intento que no encaja (por cantidad de cifras o porque no
 * es el número correcto) deja un empujoncito suave y no borra nada de lo ya
 * colocado. 2 grillas por nivel (6 en total), tamaño 6×6 → 7×7 → 8×8 y más
 * tiras para completar a medida que sube el nivel.
 */

interface SlotShape {
  id: string
  cells: [number, number][]
}
interface GridShape {
  rows: number
  cols: number
  slots: SlotShape[]
  givenIds: string[]
}
interface PlacedSlot {
  id: string
  cells: [number, number][]
  digits: number
  answer: string
  given: boolean
  dir: 'Fila' | 'Columna'
}
interface CrosswordRound {
  rows: number
  cols: number
  grid: number[][]
  slots: PlacedSlot[]
  bankOrder: string[] // ids de las tiras no dadas, orden barajado una sola vez
}

function cellKey(r: number, c: number): string {
  return `${r}-${c}`
}

// ── Formas — verificadas por script (bordes, alineación, largo ≥ 2) antes de
// escribir este archivo. 2 formas por nivel, 6×6 → 7×7 → 8×8. ──────────────
const L1_SHAPE_A: GridShape = {
  rows: 6,
  cols: 6,
  slots: [
    { id: 'S1', cells: [[0, 2], [1, 2], [2, 2]] },
    { id: 'S2', cells: [[1, 2], [1, 3]] },
    { id: 'S3', cells: [[1, 3], [2, 3], [3, 3]] },
  ],
  givenIds: ['S1'],
}
const L1_SHAPE_B: GridShape = {
  rows: 6,
  cols: 6,
  slots: [
    { id: 'S1', cells: [[2, 1], [2, 2], [2, 3]] },
    { id: 'S2', cells: [[1, 3], [2, 3]] },
    { id: 'S3', cells: [[2, 1], [3, 1]] },
  ],
  givenIds: ['S1'],
}
const L2_SHAPE_A: GridShape = {
  rows: 7,
  cols: 7,
  slots: [
    { id: 'S1', cells: [[0, 3], [1, 3], [2, 3], [3, 3]] },
    { id: 'S2', cells: [[1, 2], [1, 3], [1, 4]] },
    { id: 'S3', cells: [[3, 3], [3, 4], [3, 5]] },
    { id: 'S4', cells: [[3, 5], [4, 5], [5, 5]] },
  ],
  givenIds: ['S1'],
}
const L2_SHAPE_B: GridShape = {
  rows: 7,
  cols: 7,
  slots: [
    { id: 'S1', cells: [[3, 1], [3, 2], [3, 3], [3, 4]] },
    { id: 'S2', cells: [[1, 2], [2, 2], [3, 2]] },
    { id: 'S3', cells: [[3, 4], [4, 4], [5, 4]] },
    { id: 'S4', cells: [[5, 4], [5, 5], [5, 6]] },
  ],
  givenIds: ['S1'],
}
const L3_SHAPE_A: GridShape = {
  rows: 8,
  cols: 8,
  slots: [
    { id: 'S1', cells: [[0, 3], [1, 3], [2, 3], [3, 3]] },
    { id: 'S2', cells: [[5, 2], [5, 3], [5, 4], [5, 5]] },
    { id: 'S3', cells: [[1, 2], [1, 3], [1, 4]] },
    { id: 'S4', cells: [[3, 3], [3, 4], [3, 5]] },
    { id: 'S5', cells: [[3, 5], [4, 5], [5, 5]] },
    { id: 'S6', cells: [[5, 2], [6, 2]] },
  ],
  givenIds: ['S1', 'S2'],
}
const L3_SHAPE_B: GridShape = {
  rows: 8,
  cols: 8,
  slots: [
    { id: 'S1', cells: [[2, 1], [2, 2], [2, 3], [2, 4]] },
    { id: 'S2', cells: [[3, 5], [4, 5], [5, 5], [6, 5]] },
    { id: 'S3', cells: [[2, 2], [3, 2], [4, 2]] },
    { id: 'S4', cells: [[2, 4], [3, 4]] },
    { id: 'S5', cells: [[3, 3], [3, 4], [3, 5]] },
    { id: 'S6', cells: [[6, 2], [6, 3], [6, 4], [6, 5]] },
  ],
  givenIds: ['S1', 'S2'],
}

const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3']
const LEVEL_SHAPES: GridShape[][] = [
  [L1_SHAPE_A, L1_SHAPE_B],
  [L2_SHAPE_A, L2_SHAPE_B],
  [L3_SHAPE_A, L3_SHAPE_B],
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

function fillGrid(shape: GridShape): number[][] {
  const grid: (number | null)[][] = Array.from({ length: shape.rows }, () => Array(shape.cols).fill(null))
  // Toda celda que sea la PRIMERA de alguna tira no puede quedar en 0 (nunca
  // hay números con cero a la izquierda) — el resto va de 0 a 9 libremente.
  const firstCells = new Set(shape.slots.map((s) => cellKey(s.cells[0][0], s.cells[0][1])))
  for (const slot of shape.slots) {
    for (const [r, c] of slot.cells) {
      if (grid[r][c] == null) {
        grid[r][c] = firstCells.has(cellKey(r, c)) ? randInt(1, 9) : randInt(0, 9)
      }
    }
  }
  return grid as number[][]
}

function buildRound(shape: GridShape): CrosswordRound {
  let grid: number[][] = []
  let answers: Record<string, string> = {}
  let guard = 0
  let hasDuplicate: boolean
  do {
    grid = fillGrid(shape)
    answers = {}
    for (const slot of shape.slots) answers[slot.id] = slot.cells.map(([r, c]) => grid[r][c]).join('')
    hasDuplicate = false
    const seen = new Set<string>()
    for (const slot of shape.slots) {
      if (shape.givenIds.includes(slot.id)) continue
      if (seen.has(answers[slot.id])) {
        hasDuplicate = true
        break
      }
      seen.add(answers[slot.id])
    }
    guard++
  } while (hasDuplicate && guard < 20)

  const slots: PlacedSlot[] = shape.slots.map((slot) => {
    const given = shape.givenIds.includes(slot.id)
    const horizontal = slot.cells.every(([r]) => r === slot.cells[0][0])
    return {
      id: slot.id,
      cells: slot.cells,
      digits: slot.cells.length,
      answer: answers[slot.id],
      given,
      dir: horizontal ? 'Fila' : 'Columna',
    }
  })
  const bankOrder = shuffle(slots.filter((s) => !s.given).map((s) => s.id))
  return { rows: shape.rows, cols: shape.cols, grid, slots, bankOrder }
}

function buildEpoch(): CrosswordRound[][] {
  return LEVEL_SHAPES.map((shapes) => shuffle(shapes).map((shape) => buildRound(shape)))
}

const PRAISE_GOOD = ['¡Justo ahí!', '¡Muy bien!', '¡Así se arma!', '¡Perfecto!']
const HINT_LENGTH = 'Ese número no tiene la misma cantidad de cifras que esa tira.'
const HINT_MISMATCH = [
  'Ese no es — fijate qué cifras ya cruzan ahí.',
  'Casi. Probá con otro número.',
  'No es ese — mirá bien las cifras que ya tenés puestas.',
]

export function CrucigramaDeCifras({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Las 2 grillas de cada nivel (con sus cifras ya generadas), decididas una
  // sola vez por época, al montar — nunca
  // vueltas a generar por re-visitar un nivel, así "Repetir" devuelve
  // exactamente la misma grilla.
  const [epochRounds] = useState(() => buildEpoch())
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [placedSlotIds, setPlacedSlotIds] = useState<Set<string>>(new Set())
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Intentos fallidos, acumulados a través de niveles 1→2→3, sólo en cero en
  // un reinicio real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  const nonGivenSlots = round ? round.slots.filter((s) => !s.given) : []
  const allSlotCellKeys = round ? new Set(round.slots.flatMap((s) => s.cells.map(([r, c]) => cellKey(r, c)))) : new Set<string>()
  const visibleSlotIds = new Set(round ? round.slots.filter((s) => s.given || placedSlotIds.has(s.id)).map((s) => s.id) : [])
  const visibleCellKeys = new Set(
    round
      ? round.slots.filter((s) => visibleSlotIds.has(s.id)).flatMap((s) => s.cells.map(([r, c]) => cellKey(r, c)))
      : [],
  )
  const bankSlots = round ? round.bankOrder.map((id) => nonGivenSlots.find((s) => s.id === id)!).filter((s) => !placedSlotIds.has(s.id)) : []
  const targetSlots = nonGivenSlots.filter((s) => !placedSlotIds.has(s.id))

  function slotPreview(slot: PlacedSlot): string {
    return slot.cells.map(([r, c]) => (visibleCellKeys.has(cellKey(r, c)) ? round.grid[r][c] : '_')).join(' ')
  }

  // Todas las celdas de una tira "Fila" comparten fila, y las de "Columna"
  // comparten columna — así que ese único número (1-based) es a la vez el
  // eje que hay que mostrar en la consigna Y el que ya está pintado en el
  // borde de la grilla, para que se puedan emparejar a simple vista.
  function slotAxisNumber(slot: PlacedSlot): number {
    return slot.dir === 'Fila' ? slot.cells[0][0] + 1 : slot.cells[0][1] + 1
  }

  function attemptPlace(targetId: string) {
    if (!round || !selectedTileId || resolved) return
    const tile = nonGivenSlots.find((s) => s.id === selectedTileId)
    const target = nonGivenSlots.find((s) => s.id === targetId)
    if (!tile || !target || placedSlotIds.has(target.id)) return
    if (tile.digits !== target.digits) {
      setHint(HINT_LENGTH)
      setMistakes((m) => m + 1)
      return
    }
    if (tile.answer !== target.answer) {
      setHint(pickOne(HINT_MISMATCH))
      setMistakes((m) => m + 1)
      return
    }
    setHint(null)
    setSelectedTileId(null)
    const next = new Set(placedSlotIds).add(target.id)
    setPlacedSlotIds(next)
    if (next.size === nonGivenSlots.length) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setPlacedSlotIds(new Set())
        setSelectedTileId(null)
        setResolved(false)
        setHint(null)
      }, 1000)
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.

  // "Siguiente nivel" — avanza dentro de la MISMA época. epochRounds queda
  // intacto: las grillas del nivel i+1 ya se generaron al empezar la época.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPlacedSlotIds(new Set())
    setSelectedTileId(null)
    setResolved(false)
    setHint(null)
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
    setPlacedSlotIds(new Set())
    setSelectedTileId(null)
    setResolved(false)
    setHint(null)
    setMistakes(0)
  }
  // "Repetir" — misma grilla del intento recién terminado.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_NAMES.length - 1 && reportedRoundKeyRef.current !== roundKey) {
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
          {LEVEL_NAMES[levelIdx]}
        </span>
        {phase === 'playing' && !done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Grilla {roundIdx + 1} de {roundsForLevel}
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
            <Hash className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Tocá un número del banco y después la fila o columna donde creas que encaja. Los números al borde de la
            grilla te ayudan a ubicarla — coinciden con los de la lista. Si coincide con las cifras que ya cruzan
            ahí, se coloca solo.
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
          {/* Grilla — el nivel 3 (8 columnas) se achica un poco más que
              6×6/7×7: son 64 celdas en vez de 36-49, y ese es el margen que
              cierra el presupuesto mobile del nivel más cargado. Primera
              fila/columna del grid CSS son los números de eje (1-based), no
              celdas jugables — mismos números que usa la consigna de abajo
              ("Fila 3", "Columna 5"), para que se puedan ubicar a simple
              vista en vez de tener que adivinar por forma/posición. */}
          <div
            className={round.cols >= 8 ? 'mx-auto mt-3 grid w-full max-w-[260px] gap-1' : 'mx-auto mt-4 grid w-full max-w-[300px] gap-1'}
            style={{ gridTemplateColumns: `0.9rem repeat(${round.cols}, minmax(0, 1fr))` }}
          >
            <div aria-hidden="true" />
            {Array.from({ length: round.cols }, (_, c) => (
              <div key={`col-${c}`} className="flex items-center justify-center text-[9px] font-bold text-slate-400 sm:text-[10px]">
                {c + 1}
              </div>
            ))}
            {Array.from({ length: round.rows }, (_, r) => [
              <div key={`row-${r}`} className="flex items-center justify-center text-[9px] font-bold text-slate-400 sm:text-[10px]">
                {r + 1}
              </div>,
              ...Array.from({ length: round.cols }, (_, c) => {
                const k = cellKey(r, c)
                if (!allSlotCellKeys.has(k)) {
                  return <div key={k} className="aspect-square rounded-md bg-slate-100" />
                }
                const isVisible = visibleCellKeys.has(k)
                return (
                  <div
                    key={k}
                    className={[
                      'flex aspect-square items-center justify-center rounded-md border-2 text-base font-extrabold sm:text-lg',
                      isVisible ? 'border-slate-200 bg-white text-slate-800' : 'border-dashed border-slate-300 bg-slate-50 text-slate-300',
                    ].join(' ')}
                  >
                    {isVisible ? round.grid[r][c] : ''}
                  </div>
                )
              }),
            ])}
          </div>

          {!resolved && (
            <>
              {/* Banco de números */}
              <p className="mt-3 text-center text-base font-semibold uppercase tracking-wide text-slate-400">
                Números para ubicar
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                {bankSlots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedTileId((prev) => (prev === s.id ? null : s.id))}
                    className={[
                      'min-h-[44px] min-w-[52px] rounded-xl border-2 px-3 py-2 text-lg font-extrabold text-slate-800 transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      selectedTileId === s.id
                        ? 'border-tiam-blue bg-tiam-blue/10'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                    ].join(' ')}
                  >
                    {s.answer}
                  </button>
                ))}
              </div>

              {/* ¿Dónde va? */}
              <p className="mt-3 text-center text-base font-semibold uppercase tracking-wide text-slate-400">
                ¿Dónde va?
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                {targetSlots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!selectedTileId}
                    onClick={() => attemptPlace(s.id)}
                    className={[
                      'flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-3 py-2 transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      selectedTileId
                        ? 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                        : 'border-slate-100 bg-slate-50 opacity-60',
                    ].join(' ')}
                  >
                    <span className="text-base font-bold text-slate-600">
                      {s.dir} {slotAxisNumber(s)}
                    </span>
                    <span className="font-mono text-base font-bold text-tiam-blue">{slotPreview(s)}</span>
                  </button>
                ))}
              </div>

              {hint && <p className="mt-3 text-center text-base font-medium text-slate-500">{hint}</p>}
            </>
          )}

          {resolved && <p className="mt-5 text-center text-lg font-semibold text-tiam-green">{praise}</p>}
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
            Completaste las {roundsForLevel} grillas — terminaste el nivel {levelIdx + 1}.
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
