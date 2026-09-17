import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Crucigrama numérico" — día 30, área cálculo, el cierre del mes. Un
 * crucigrama aritmético chico: una ecuación horizontal "raíz" (`a op b = c`)
 * con 1-3 ecuaciones verticales "pata" colgando de sus celdas numéricas —
 * cada pata hereda el valor de la celda que comparte con la raíz como su
 * propio primer operando, así que toda celda de cruce pertenece de verdad a
 * DOS ecuaciones y tiene que satisfacer ambas, no sólo alinearse visualmente.
 * Algunas celdas quedan en blanco; tocar una la enfoca y abre una paleta
 * debajo (dígitos 0-9 para celdas numéricas, los operadores del nivel para
 * la celda operador) — nunca un `<input>` de teclado. El tablero entero se
 * autocorrige apenas se completa el último blanco.
 *
 * NO reutiliza CrucigramaDeCifras.tsx (día 11 original) — ese intento
 * anterior de crucigrama numérico quedó RETIRADO: su interacción de "tocar
 * un número entero de un banco y después la fila/columna destino" fue
 * rechazada. Acá nunca se muestra un banco de números candidatos; el
 * jugador arma cada valor que falta directamente sobre la celda, dígito a
 * dígito o con un solo toque de operador.
 *
 * INVARIANTE DE UNICIDAD (por qué la generación es en dos pasadas
 * separadas, nunca una sola): un tablero sólo se muestra si EXACTAMENTE UNA
 * asignación de sus celdas en blanco satisface todas las ecuaciones de la
 * grilla. Paso 1 arma una grilla ya resuelta e internamente consistente:
 * elige el operador/operandos de la raíz, calcula su resultado, y para cada
 * pata elige operador/segundo-operando y calcula SU resultado a partir del
 * valor de cruce ya fijado — así los cruces coinciden por construcción y
 * nunca hace falta reconciliarlos después. Paso 2 pone algunas celdas en
 * blanco y recién ahí PRUEBA la unicidad por fuerza bruta: cada candidato
 * posible para cada celda en blanco (acotado por su cantidad de cifras para
 * números, los operadores del nivel para el signo) se prueba contra todas
 * las ecuaciones con backtracking, contando soluciones y cortando apenas
 * aparece una segunda. Sólo se acepta un tablero que vuelve con exactamente
 * una solución; si no, se vuelve a intentar (primero nuevas celdas en
 * blanco, si hace falta una grilla resuelta nueva) — ver
 * `generateBoard`/`pickBlanks`. Corregir durante el juego reutiliza esta
 * garantía: una celda completada se compara directo contra la única
 * solución conocida, algo que sólo es seguro hacer PORQUE la unicidad ya
 * fue probada — comparar contra "una" solución cuando hay más de una es
 * exactamente cómo un jugador que respondió bien terminaría marcado como
 * equivocado, el modo de falla que todo este diseño en dos pasadas existe
 * para descartar.
 *
 * La huella de la grilla es constante (5×5) en los 3 niveles — sólo cambia
 * la cantidad de patas (1→2→3). La dificultad sube por cantidad de
 * ecuaciones/blancos (2→3→4) y variedad de operadores (+− → +−× → +−×÷, el
 * último nivel exige al menos un blanco de operador), no por una grilla más
 * grande — así el nivel más cargado sigue entrando cómodo en el presupuesto
 * mobile.
 */

type Op = '+' | '−' | '×' | '÷'
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

const MIN_VALUE = 1
const MAX_VALUE = 199

type CellRole = 'num' | 'op' | 'eq'

interface GridCell {
  key: string
  row: number
  col: number
  role: CellRole
  value: string
  digits: number
}

interface PuzzleEquation {
  id: string
  cellKeys: [string, string, string, string, string]
}

interface Board {
  cells: Record<string, GridCell>
  equations: PuzzleEquation[]
  blankKeys: string[]
}

interface Level {
  name: string
  legCols: number[]
  allowedOps: Op[]
  blanks: number
  requireOpBlank: boolean
}

// L1: raíz + 1 pata (2 ecuaciones, 1 cruce). L2: raíz + 2 patas en sus
// extremos (a y c). L3: raíz + 3 patas en sus 3 celdas numéricas (a, b, c)
// — la única que exige un blanco de operador, coherente con ser el primer
// nivel que incluye ÷.
const LEVELS: Level[] = [
  { name: 'Nivel 1', legCols: [4], allowedOps: ['+', '−'], blanks: 2, requireOpBlank: false },
  { name: 'Nivel 2', legCols: [0, 4], allowedOps: ['+', '−', '×'], blanks: 3, requireOpBlank: false },
  { name: 'Nivel 3', legCols: [0, 2, 4], allowedOps: ['+', '−', '×', '÷'], blanks: 4, requireOpBlank: true },
]
// Fijo en los 3 niveles — totalAttempts = mistakes + esto: un "acierto" por
// cada celda en blanco de todo el día, tal como pide la convención de la casa.
const TOTAL_BLANKS = LEVELS.reduce((sum, lvl) => sum + lvl.blanks, 0)

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

function applyOp(a: number, op: Op, b: number): number | null {
  if (op === '+') return a + b
  if (op === '−') return a - b
  if (op === '×') return a * b
  if (b <= 0 || a % b !== 0) return null
  return a / b
}

interface SolvedEquation {
  a: number
  op: Op
  b: number
  c: number
}

// Arma una ecuación `a op b = c`. Sin `fixedA` todo es libre (la raíz); con
// `fixedA` (una pata), `a` ya es el valor fijado por el cruce y sólo se
// eligen op/b, calculando el resultado A PARTIR de él — así los cruces
// coinciden por construcción en vez de necesitar una reconciliación
// posterior. Prueba cada operador permitido en orden al azar, salteando el
// que no pueda dar una ecuación válida (operando/resultado no positivo,
// división inexacta, pasarse de MAX_VALUE) y probando el siguiente; sólo
// devuelve null si ninguno funciona, algo que el llamador toma como "volver
// a tirar todo el tablero".
function buildEquation(allowedOps: Op[], fixedA?: number): SolvedEquation | null {
  for (const op of shuffle(allowedOps)) {
    let a = fixedA ?? randInt(MIN_VALUE, 60)
    let b: number

    if (op === '+') {
      const maxB = MAX_VALUE - a
      if (maxB < 1) continue
      b = randInt(1, Math.min(60, maxB))
    } else if (op === '−') {
      if (a < 2) continue
      b = randInt(1, a - 1)
    } else if (op === '×') {
      if (fixedA === undefined) a = randInt(2, 12)
      const maxB = Math.floor(MAX_VALUE / a)
      if (maxB < 2) continue
      b = randInt(2, Math.min(9, maxB))
    } else {
      if (fixedA === undefined) {
        // Operando libre: se elige el divisor y el cociente PRIMERO para
        // garantizar una división exacta por construcción, en vez de tirar
        // un `a` al azar y esperar que tenga un divisor chico.
        b = randInt(2, 12)
        a = b * randInt(2, 12)
      } else {
        const divisors: number[] = []
        for (let d = 2; d <= 12; d++) if (a % d === 0) divisors.push(d)
        if (divisors.length === 0) continue
        b = pickOne(divisors)
      }
    }

    const c = applyOp(a, op, b)
    if (c === null || c < MIN_VALUE || c > MAX_VALUE) continue
    return { a, op, b, c }
  }
  return null
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

// Una ecuación horizontal "raíz" en la fila 0, más una "pata" vertical por
// cada entrada de `legCols` colgando hacia abajo desde esa columna. La
// primera celda de una pata se ubica EXACTAMENTE sobre la celda de la raíz
// que cruza — misma coordenada, mismo GridCell — así el valor compartido
// tiene una sola fuente de verdad en vez de dos números que haya que
// mantener sincronizados. Las patas sólo se enganchan en una celda NÚMERO
// de la raíz (col 0 = primer operando, col 2 = segundo operando, col 4 =
// resultado) — nunca en el operador ni en el "=" — así toda celda de cruce
// realmente tiene que satisfacer dos ecuaciones, no sólo quedar al lado de
// otra tira.
function buildShape(allowedOps: Op[], legCols: number[]): { cells: Record<string, GridCell>; equations: PuzzleEquation[] } | null {
  const cells: Record<string, GridCell> = {}
  const equations: PuzzleEquation[] = []

  function place(row: number, col: number, role: CellRole, value: string): string {
    const key = cellKey(row, col)
    cells[key] = { key, row, col, role, value, digits: role === 'num' ? value.length : 0 }
    return key
  }

  const root = buildEquation(allowedOps)
  if (!root) return null
  const aKey = place(0, 0, 'num', String(root.a))
  const opKey = place(0, 1, 'op', root.op)
  const bKey = place(0, 2, 'num', String(root.b))
  const eqKey = place(0, 3, 'eq', '=')
  const cKey = place(0, 4, 'num', String(root.c))
  equations.push({ id: 'EQ1', cellKeys: [aKey, opKey, bKey, eqKey, cKey] })

  const rootValueByCol: Record<number, number> = { 0: root.a, 2: root.b, 4: root.c }

  let n = 2
  for (const col of legCols) {
    const leg = buildEquation(allowedOps, rootValueByCol[col])
    if (!leg) return null
    const la = cellKey(0, col)
    const lop = place(1, col, 'op', leg.op)
    const lb = place(2, col, 'num', String(leg.b))
    const leq = place(3, col, 'eq', '=')
    const lc = place(4, col, 'num', String(leg.c))
    equations.push({ id: `EQ${n}`, cellKeys: [la, lop, lb, leq, lc] })
    n++
  }

  return { cells, equations }
}

function domainFor(cell: GridCell, allowedOps: Op[]): string[] {
  if (cell.role === 'op') return allowedOps
  const n = cell.digits
  const lo = n <= 1 ? 0 : Math.pow(10, n - 1)
  const hi = Math.min(Math.pow(10, n) - 1, MAX_VALUE)
  const out: string[] = []
  for (let v = lo; v <= hi; v++) out.push(String(v))
  return out
}

function equationHolds(cells: Record<string, GridCell>, trial: Record<string, string>, eqn: PuzzleEquation): boolean {
  const [aKey, opKey, bKey, , cKey] = eqn.cellKeys
  const readValue = (key: string) => trial[key] ?? cells[key].value
  const a = Number(readValue(aKey))
  const op = readValue(opKey) as Op
  const b = Number(readValue(bKey))
  const c = Number(readValue(cKey))
  if (a < MIN_VALUE || b < MIN_VALUE || c < MIN_VALUE) return false
  const result = applyOp(a, op, b)
  return result !== null && result === c
}

// LA prueba de unicidad. Cuenta cuántas asignaciones de `blankKeys` (cada
// una tomada de su propio dominio) satisfacen todas las ecuaciones,
// cortando apenas se llega a `cap` — un tablero sólo se acepta cuando esto
// devuelve exactamente 1. Asigna los blancos de a uno y revisa una ecuación
// apenas TODAS sus celdas quedan decididas (blanco-de-prueba o dada), así
// que una mala elección se descarta en un paso en vez de esperar a una
// asignación completa — esa poda es lo que mantiene esto rápido aunque el
// espacio de búsqueda nominal (todos los dominios multiplicados entre sí)
// no lo sea.
function countSolutions(
  cells: Record<string, GridCell>,
  equations: PuzzleEquation[],
  blankKeys: string[],
  cap: number,
  allowedOps: Op[],
): number {
  const trial: Record<string, string> = {}
  let count = 0

  function isDetermined(eqn: PuzzleEquation): boolean {
    return eqn.cellKeys.every((k) => !blankKeys.includes(k) || trial[k] !== undefined)
  }

  function step(i: number): void {
    if (count >= cap) return
    if (i === blankKeys.length) {
      count++
      return
    }
    const key = blankKeys[i]
    const touched = equations.filter((e) => e.cellKeys.includes(key))
    for (const val of domainFor(cells[key], allowedOps)) {
      trial[key] = val
      const ok = touched.every((e) => !isDetermined(e) || equationHolds(cells, trial, e))
      if (ok) step(i + 1)
      delete trial[key]
      if (count >= cap) return
    }
  }
  step(0)
  return count
}

// Elige qué celdas quedan en blanco esta ronda y PRUEBA unicidad antes de
// devolver la elección — nunca pone blancos primero y espera que alcance.
// El "al menos un blanco de operador" del nivel 3 queda garantizado por
// construcción (se elige primero el blanco de operador, después el resto),
// no librado al azar.
function pickBlanks(shape: { cells: Record<string, GridCell>; equations: PuzzleEquation[] }, level: Level): string[] | null {
  const eligible = Object.values(shape.cells).filter((c) => c.role !== 'eq').map((c) => c.key)
  const opKeys = Object.values(shape.cells).filter((c) => c.role === 'op').map((c) => c.key)

  for (let guard = 0; guard < 60; guard++) {
    let candidate: string[]
    if (level.requireOpBlank) {
      const firstOp = pickOne(opKeys)
      const rest = shuffle(eligible.filter((k) => k !== firstOp)).slice(0, level.blanks - 1)
      candidate = [firstOp, ...rest]
    } else {
      candidate = shuffle(eligible).slice(0, level.blanks)
    }
    if (countSolutions(shape.cells, shape.equations, candidate, 2, level.allowedOps) === 1) return candidate
  }
  return null
}

function generateBoard(level: Level): Board {
  for (let guard = 0; guard < 200; guard++) {
    const shape = buildShape(level.allowedOps, level.legCols)
    if (!shape) continue
    const blankKeys = pickBlanks(shape, level)
    if (!blankKeys) continue
    return { cells: shape.cells, equations: shape.equations, blankKeys }
  }
  // Prácticamente inalcanzable con estos rangos (ver comentario de archivo)
  // — un corte firme es más seguro que un reintento infinito o mostrar en
  // silencio un tablero que nunca se probó único.
  throw new Error('CrucigramaNumerico: no se pudo generar un crucigrama único')
}

function isEntryComplete(cell: GridCell, entryValue: string | undefined): boolean {
  if (cell.role === 'op') return entryValue !== undefined
  return (entryValue?.length ?? 0) === cell.digits
}

const PRAISE = ['¡Cerraste bien las cuentas!', '¡Excelente cruce!', '¡Así se calcula!', '¡Perfecto!']
const HINTS = [
  'Alguna cuenta no cierra — repasá los números que se cruzan.',
  'Casi. Fijate bien en el signo que elegiste.',
  'No es esa combinación — probá de nuevo con calma.',
]
const CLOSING_MESSAGE =
  'Con este último cruce de cuentas, ¡cerraste los 30 días de ejercicios de este mes! Un logro para estar orgulloso.'

export function CrucigramaNumerico({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const [board, setBoard] = useState<Board>(() => generateBoard(LEVELS[0]))
  const [entries, setEntries] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const [solved, setSolved] = useState(false)
  const [levelDone, setLevelDone] = useState(false)
  // Ambos se acumulan a través de los niveles 1→2→3 y sólo vuelven a cero
  // en un reinicio real del día (ver replay) — un reintento del mismo
  // nivel los conserva.
  const [mistakes, setMistakes] = useState(0)

  const filledCount = board.blankKeys.filter((k) => isEntryComplete(board.cells[k], entries[k])).length
  const focusedCell = focused ? board.cells[focused] : null

  function checkBoard(finalEntries: Record<string, string>) {
    const wrongKeys = board.blankKeys.filter((k) => finalEntries[k] !== board.cells[k].value)
    if (wrongKeys.length === 0) {
      setPraise(pickOne(PRAISE))
      setSolved(true)
      setFocused(null)
      setHint(null)
      window.setTimeout(() => setLevelDone(true), 800)
      return
    }
    // Sólo se limpian las celdas equivocadas — las que ya estaban bien
    // quedan puestas, para no hacerle perder al jugador lo que sí acertó.
    setEntries((prev) => {
      const next = { ...prev }
      for (const k of wrongKeys) delete next[k]
      return next
    })
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    setFocused(wrongKeys[0])
  }

  function advanceFocusOrCheck(nextEntries: Record<string, string>) {
    const remaining = board.blankKeys.filter((k) => !isEntryComplete(board.cells[k], nextEntries[k]))
    if (remaining.length === 0) {
      checkBoard(nextEntries)
    } else {
      setFocused(remaining[0])
    }
  }

  function selectCell(key: string) {
    if (solved || !board.blankKeys.includes(key)) return
    const cell = board.cells[key]
    const hasValue = cell.role === 'op' ? entries[key] !== undefined : (entries[key]?.length ?? 0) > 0
    if (hasValue) {
      setEntries((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
    setFocused(key)
    setHint(null)
  }

  function typeDigit(d: string) {
    if (!focused || solved) return
    const cell = board.cells[focused]
    if (cell.role !== 'num') return
    const current = entries[focused] ?? ''
    if (current.length >= cell.digits) return
    const nextEntries = { ...entries, [focused]: current + d }
    setEntries(nextEntries)
    if (nextEntries[focused].length === cell.digits) advanceFocusOrCheck(nextEntries)
  }

  function chooseOperator(op: Op) {
    if (!focused || solved) return
    const cell = board.cells[focused]
    if (cell.role !== 'op') return
    const nextEntries = { ...entries, [focused]: op }
    setEntries(nextEntries)
    advanceFocusOrCheck(nextEntries)
  }

  // Los resets pasan ACÁ, sincrónicos con el cambio de nivel/ronda, nunca
  // en un useEffect atado a levelIdx — un reset por efecto llega un render
  // tarde, así que `levelDone` leería el valor stale-true del nivel
  // anterior justo en el render que llega al nivel nuevo, y dispararía
  // onComplete con datos basura. Mismo motivo que ElVuelto.tsx/SumaHastaDiez.tsx.
  function nextLevel() {
    const nextIdx = levelIdx + 1
    setBoard(generateBoard(LEVELS[nextIdx]))
    setLevelIdx(nextIdx)
    setRoundKey((k) => k + 1)
    setEntries({})
    setFocused(null)
    setSolved(false)
    setLevelDone(false)
    setHint(null)
  }
  // Sólo se llega acá desde la tarjeta final del último nivel (ver el botón
  // único más abajo), así que siempre es un reinicio real del día — los
  // errores vuelven a cero acá, nunca en una corrección dentro de la misma
  // ronda. El botón dice "Repetir", como en el resto del catálogo.
  function replay() {
    setBoard(generateBoard(LEVELS[0]))
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setEntries({})
    setFocused(null)
    setSolved(false)
    setLevelDone(false)
    setHint(null)
    setMistakes(0)
  }

  // Se dispara una sola vez por roundKey cuando se termina el último nivel.
  // Un reinicio real del día consigue un roundKey nuevo, así que puede
  // reportar de nuevo; volver a renderizar ya terminado no dispara dos veces.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (levelDone && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_BLANKS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelDone, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {!levelDone && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Completá las cuentas cruzadas</h2>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                {filledCount} de {board.blankKeys.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                  style={{ width: `${(filledCount / board.blankKeys.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!levelDone && (
        <>
          {/* Grilla — huella fija 5×5 (ver comentario de archivo), tamaño de
              celda fijo en rem para que los cruces alineen pixel a pixel sin
              depender de cómo reparte el ancho `1fr`. */}
          <div className="mx-auto mt-5 w-fit rounded-3xl bg-slate-50 p-3">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(5, 3.5rem)', gridTemplateRows: 'repeat(5, 3.5rem)' }}>
              {Object.values(board.cells).map((cell) => {
                const style = { gridColumn: cell.col + 1, gridRow: cell.row + 1 }

                if (cell.role === 'eq') {
                  return (
                    <div key={cell.key} style={style} className="flex h-14 w-14 items-center justify-center text-2xl font-bold text-slate-300">
                      =
                    </div>
                  )
                }

                const isBlank = board.blankKeys.includes(cell.key)
                if (!isBlank) {
                  return (
                    <div
                      key={cell.key}
                      style={style}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-lg font-extrabold text-slate-700"
                    >
                      {cell.value}
                    </div>
                  )
                }

                const entryValue = entries[cell.key]
                const isFocused = focused === cell.key
                const complete = isEntryComplete(cell, entryValue)
                const display = cell.role === 'op' ? (entryValue ?? '?') : (entryValue ?? '').padEnd(cell.digits, '_')
                return (
                  <button
                    key={cell.key}
                    type="button"
                    style={style}
                    onClick={() => selectCell(cell.key)}
                    aria-label={cell.role === 'op' ? 'signo, celda vacía' : `número de ${cell.digits} cifras, celda vacía`}
                    aria-pressed={isFocused}
                    className={[
                      'relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-white text-lg font-extrabold transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                      solved
                        ? 'border-tiam-green bg-tiam-green/10 text-slate-700'
                        : isFocused
                          ? 'border-tiam-blue bg-tiam-blue/5 text-slate-700 ring-2 ring-tiam-blue/30'
                          : complete
                            ? 'border-slate-300 text-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                            : 'border-dashed border-slate-300 text-slate-300 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                    ].join(' ')}
                  >
                    {display}
                    {solved && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Paleta */}
          {!solved && focusedCell && focusedCell.role === 'num' && (
            <div className="mx-auto mt-5 grid max-w-xs grid-cols-5 gap-2">
              {DIGITS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => typeDigit(d)}
                  className="min-h-[48px] rounded-xl border-2 border-slate-200 bg-white text-lg font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          {!solved && focusedCell && focusedCell.role === 'op' && (
            <div className="mx-auto mt-5 flex max-w-xs flex-wrap justify-center gap-2">
              {level.allowedOps.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => chooseOperator(op)}
                  className="min-h-[48px] min-w-[64px] rounded-xl border-2 border-slate-200 bg-white text-xl font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {op}
                </button>
              ))}
            </div>
          )}
          {!solved && !focusedCell && (
            <p className="mt-5 text-center text-base font-medium text-slate-400">
              Tocá un espacio vacío de la grilla para completarlo.
            </p>
          )}

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
          {solved && <p className="mt-4 text-center text-lg font-semibold text-tiam-green">{praise}</p>}
        </>
      )}

      {/* Nivel completo */}
      {levelDone && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {levelIdx === LEVELS.length - 1 ? CLOSING_MESSAGE : `Completaste el ${level.name.toLowerCase()}.`}
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextLevel}
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
                onClick={replay}
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
