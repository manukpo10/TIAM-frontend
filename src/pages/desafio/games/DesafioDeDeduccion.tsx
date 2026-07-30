import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check, Star, Circle, Square, Triangle, Heart, Hexagon, type LucideIcon } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Desafío de deducción" — día 22 del Mes 2, cierre lógico del área
 * cálculo. Un sistema de 3 ecuaciones con símbolos (figuras en vez de
 * letras) y 3 incógnitas — hay que deducir cuánto vale cada símbolo y
 * tocar el valor correcto entre varias opciones, un símbolo a la vez.
 *
 * Generado PROCEDURALMENTE (a pedido explícito del brief: "solve
 * algebraically... when generating each round's numbers"), pero SIN
 * resolver ningún sistema en runtime: se eligen primero los 3 valores
 * ocultos (A, B, C, enteros positivos distintos) y RECIÉN DESPUÉS se arman
 * las 3 ecuaciones sumando esos valores según una combinación de
 * coeficientes fija y ya verificada a mano (ver PATTERNS) — así la
 * aritmética siempre cierra exacta (sólo sumas y multiplicaciones por
 * enteros chicos, nunca una división), y el sistema siempre tiene una
 * solución única porque la matriz de coeficientes de cada PATTERN es
 * no-singular (verificado a mano, una sola vez, al escribir este archivo).
 *
 * Los símbolos son íconos de lucide-react con color fijo por ícono (mismo
 * criterio que DondeEsta.tsx con sus formas). 3 símbolos elegidos al azar
 * de un pool de 6 en cada ronda, para variedad entre partidas.
 *
 * Cada ronda resuelve sus 3 símbolos EN ORDEN (A, luego B, luego C) — igual
 * que el resto del juego, una sola pregunta a la vez con eliminación de
 * opciones incorrectas (nunca roja). Los símbolos ya resueltos quedan
 * visibles arriba con su valor, como una bitácora de lo descubierto.
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total). totalAttempts cuenta
 * los 3 símbolos de cada ronda por separado (18 en total), no la ronda
 * entera de una — cada símbolo es su propio acierto.
 */

interface Symbol {
  Icon: LucideIcon
  color: string
}
const SYMBOL_POOL: Symbol[] = [
  { Icon: Star, color: '#f59e0b' },
  { Icon: Circle, color: '#3b82f6' },
  { Icon: Square, color: '#f43f5e' },
  { Icon: Triangle, color: '#10b981' },
  { Icon: Heart, color: '#ec4899' },
  { Icon: Hexagon, color: '#8b5cf6' },
]

// Coeficientes de [A, B, C] para cada una de las 3 ecuaciones. Las 3 son
// filas de una matriz NO singular (determinante ≠ 0, verificado a mano),
// así que el sistema siempre tiene solución única — condición necesaria
// para que "deducir" el valor de cada símbolo sea un problema real y no
// una adivinanza. Nivel 3 usa una ecuación con los 3 símbolos juntos (un
// paso más de integración que niveles 1/2, que sólo combinan de a 2).
const PATTERNS: [number, number, number][][] = [
  [
    [1, 1, 0],
    [0, 1, 1],
    [1, 0, 1],
  ],
  [
    [2, 1, 0],
    [0, 1, 1],
    [1, 0, 2],
  ],
  [
    [1, 1, 1],
    [2, 0, 1],
    [1, 2, 0],
  ],
]
const RANGES: [number, number][] = [
  [2, 12],
  [3, 18],
  [5, 24],
]

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
function randomInt(n: number): number {
  return Math.floor(Math.random() * n)
}

function distinctTriplet([min, max]: [number, number]): [number, number, number] {
  let a: number
  let b: number
  let c: number
  let guard = 0
  do {
    a = min + randomInt(max - min + 1)
    b = min + randomInt(max - min + 1)
    c = min + randomInt(max - min + 1)
    guard++
  } while ((a === b || b === c || a === c) && guard < 50)
  return [a, b, c]
}

interface Equation {
  coeffs: [number, number, number]
  sum: number
}
interface Round {
  symbols: Symbol[] // 3, en el orden A, B, C
  values: number[] // valor oculto de A, B, C
  equations: Equation[]
}

function generateRound(levelIdx: number): Round {
  const symbols = shuffle(SYMBOL_POOL).slice(0, 3)
  const values = distinctTriplet(RANGES[levelIdx])
  const equations = PATTERNS[levelIdx].map((coeffs) => ({
    coeffs,
    sum: coeffs[0] * values[0] + coeffs[1] * values[1] + coeffs[2] * values[2],
  }))
  return { symbols, values, equations }
}

/** Arma `need` distractores distintos de `correct` (≥1, nunca 0 ni negativo),
 * prefiriendo los `seeds` naturales (el valor de OTRO símbolo — confundir
 * cuál es cuál) y completando con desvíos chicos si hace falta. */
function decoysFor(correct: number, seeds: number[], need: number): number[] {
  const set = new Set<number>()
  for (const s of seeds) {
    if (s !== correct && s >= 1) set.add(s)
  }
  let offset = 1
  while (set.size < need && offset < 30) {
    if (correct + offset !== correct) set.add(correct + offset)
    if (correct - offset >= 1) set.add(correct - offset)
    offset++
  }
  return shuffle(Array.from(set)).slice(0, need)
}

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto del
// lote (ver ElDescuento.tsx). Cada ronda resuelve 3 símbolos, así que
// totalAttempts cuenta 3 por ronda (18 en total), no 1.
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
const TOTAL_SYMBOL_CHECKS = TOTAL_ROUNDS * 3
const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3']
const OPTIONS_COUNT = [3, 4, 4]

const PRAISE_GOOD = ['¡Exacto, lo dedujiste bien!', '¡Muy bien calculado!', '¡Perfecto!', '¡Así se hace!']
const WRONG_HINTS = [
  'Ese no es — repasá las 3 ecuaciones con calma.',
  'Casi. Fijate qué valor cierra en todas las ecuaciones donde aparece.',
  'No es ese valor. Probá con otra opción.',
]

function EquationRow({ eq, symbols }: { eq: Equation; symbols: Symbol[] }) {
  const tokens: number[] = []
  eq.coeffs.forEach((coeff, i) => {
    for (let k = 0; k < coeff; k++) tokens.push(i)
  })
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-100 bg-white px-3 py-2">
      {tokens.map((symbolIdx, i) => {
        const { Icon, color } = symbols[symbolIdx]
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-400">+</span>}
            <Icon className="h-6 w-6" style={{ color }} fill={color} strokeWidth={1.5} />
          </span>
        )
      })}
      <span className="ml-1 text-slate-400">=</span>
      <span className="text-lg font-extrabold text-slate-900">{eq.sum}</span>
    </div>
  )
}

export function DesafioDeDeduccion({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  const rounds = useMemo(
    () => Array.from({ length: roundsForLevel }, () => generateRound(levelIdx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [symbolIdx, setSymbolIdx] = useState(0)
  const [eliminated, setEliminated] = useState<Set<number>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Toques equivocados, acumulados a través de niveles 1→2→3 y sólo en cero
  // en un reinicio real del día (ver la rama isWrap de nextLevel).
  const [mistakes, setMistakes] = useState(0)

  const options = useMemo(() => {
    if (!round || symbolIdx >= 3) return []
    const correct = round.values[symbolIdx]
    const seeds = round.values.filter((_, i) => i !== symbolIdx)
    return shuffle([correct, ...decoysFor(correct, seeds, OPTIONS_COUNT[levelIdx] - 1)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, symbolIdx])

  function guess(value: number) {
    if (!round || resolved || symbolIdx >= 3) return
    if (value === round.values[symbolIdx]) {
      const next = symbolIdx + 1
      setSymbolIdx(next)
      setEliminated(new Set())
      setHint(null)
      if (next >= 3) {
        setPraise(pickOne(PRAISE_GOOD))
        setResolved(true)
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setSymbolIdx(0)
          setEliminated(new Set())
          setResolved(false)
        }, 1100)
      }
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(value))
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
    setSymbolIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setSymbolIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_NAMES.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_SYMBOL_CHECKS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const currentSymbol = round && symbolIdx < 3 ? round.symbols[symbolIdx] : null

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {LEVEL_NAMES[levelIdx]}
        </span>
        {!done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {roundsForLevel}
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

      {!done && round && (
        <>
          <p className="mt-3 text-center text-sm text-slate-500">
            Descubrí cuánto vale cada símbolo mirando las 3 cuentas.
          </p>

          {/* Ecuaciones */}
          <div className="mt-3 flex flex-col gap-2">
            {round.equations.map((eq, i) => (
              <EquationRow key={i} eq={eq} symbols={round.symbols} />
            ))}
          </div>

          {/* Bitácora de símbolos ya resueltos */}
          <div className="mt-3 flex min-h-[36px] flex-wrap items-center justify-center gap-3">
            {round.symbols.map((sym, i) => {
              if (i >= symbolIdx) return null
              const { Icon, color } = sym
              return (
                <span key={i} className="inline-flex items-center gap-1 text-sm font-bold text-slate-700">
                  <Icon className="h-4 w-4" style={{ color }} fill={color} strokeWidth={1.5} />=
                  {round.values[i]}
                  <Check className="h-3.5 w-3.5 text-tiam-green" strokeWidth={3} />
                </span>
              )
            })}
          </div>

          {/* Pregunta actual */}
          {currentSymbol && (
            <>
              <p className="mt-2 flex items-center justify-center gap-2 text-lg font-bold text-slate-900">
                ¿Cuánto vale
                <currentSymbol.Icon className="h-6 w-6" style={{ color: currentSymbol.color }} fill={currentSymbol.color} strokeWidth={1.5} />
                ?
              </p>
              <div className={`mx-auto mt-3 grid max-w-xs gap-3 ${options.length === 3 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {options.map((value) => {
                  const isEliminated = eliminated.has(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={isEliminated}
                      onClick={() => guess(value)}
                      className={[
                        'min-h-[52px] rounded-2xl border-2 px-4 py-2.5 text-lg font-bold transition',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                        isEliminated
                          ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                          : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-4 text-center text-sm font-semibold text-tiam-green">{praise}</p>}
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
            Dedujiste los {roundsForLevel * 3} valores — completaste el nivel {levelIdx + 1}.
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
              Otro desafío
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
