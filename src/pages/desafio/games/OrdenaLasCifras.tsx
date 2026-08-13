import { useEffect, useRef, useState } from 'react'
import { ArrowDownWideNarrow, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Ordená las cifras" — día 25, cálculo. Una lista de números de distinta
 * cantidad de cifras (algunos de 2, otros de 5-6) que hay que tocar en
 * orden — de mayor a menor o de menor a mayor según la ronda, alternado. La
 * cantidad de dígitos por sí sola ordena la mayoría de los casos (más
 * cifras = número más grande), pero varios números COMPARTEN cantidad de
 * cifras a propósito (más se comparten a medida que sube el nivel) — ahí ya
 * no alcanza con "contar cifras", hay que comparar los números en sí.
 *
 * Reutiliza el hook compartido `useSequencingPuzzle` (el mismo motor
 * tap-to-order de OrdenarLaFrase/PlanificaLaManana/ElPasoAPaso) en vez de
 * reinventar banco/colocados — acá los "ítems" son números en vez de
 * palabras o pasos de una rutina.
 *
 * A diferencia de ElPasoAPaso (que exige un botón "Revisar" porque cada paso
 * es una frase que hay que LEER), acá se revisa solo apenas se colocan todos
 * los números — no hay nada que leer, un número se reconoce de un vistazo,
 * así que un botón extra sería fricción sin motivo (mismo criterio que
 * Sudoku4x4/DosPistas). Mismo esquema de conteo que ElPasoAPaso sí: cada
 * revisión suma la cantidad de POSICIONES equivocadas a los errores y el
 * total de números de esa ronda a los intentos — no un +1 plano — porque
 * acá "casi bien" (9 de 10 en el lugar correcto) es información real.
 *
 * Un cruce mal puesto NUNCA borra lo ya colocado: las posiciones
 * equivocadas quedan marcadas en gris (nunca rojo) y el jugador sólo
 * reacomoda esas, no tiene que volver a armar toda la fila de cero.
 */

interface LevelConfig {
  n: number
  name: string
  // Una entrada por número de la ronda — la cantidad de cifras de cada uno.
  // Repetir un largo a propósito es lo que sube la dificultad real (obliga a
  // comparar valores, no sólo contar dígitos).
  lengths: number[]
}

const LEVEL_CONFIGS: LevelConfig[] = [
  { n: 1, name: 'Nivel 1', lengths: [2, 3, 4, 5, 6, 2, 3, 4] },
  { n: 2, name: 'Nivel 2', lengths: [2, 2, 3, 3, 4, 4, 5, 5, 6] },
  { n: 3, name: 'Nivel 3', lengths: [2, 3, 3, 3, 4, 4, 4, 5, 5, 6] },
]

const ROUNDS_PER_LEVEL = [2, 2, 2]

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function buildNumbers(lengths: number[]): number[] {
  const used = new Set<number>()
  const result: number[] = []
  for (const len of lengths) {
    const min = 10 ** (len - 1)
    const max = 10 ** len - 1
    let n: number
    let guard = 0
    do {
      n = randInt(min, max)
      guard++
    } while (used.has(n) && guard < 200)
    used.add(n)
    result.push(n)
  }
  return result
}

// Ronda par (0, 2…) del nivel = de mayor a menor; impar = de menor a mayor.
function directionForRound(roundIdx: number): 'desc' | 'asc' {
  return roundIdx % 2 === 0 ? 'desc' : 'asc'
}

// Para cada ronda de la época se decide, de una, la lista YA ordenada según
// su dirección — es exactamente el `correctOrder` que necesita
// useSequencingPuzzle (el hook arma su propio banco barajado a partir de
// esto). Decidido una sola vez por época, igual que en el resto del catálogo.
function buildLevelRounds(cfg: LevelConfig, count: number): number[][] {
  return Array.from({ length: count }, (_, roundIdx) => {
    const nums = buildNumbers(cfg.lengths)
    const dir = directionForRound(roundIdx)
    return dir === 'desc' ? nums.sort((a, b) => b - a) : nums.sort((a, b) => a - b)
  })
}
function buildEpoch(): number[][][] {
  return LEVEL_CONFIGS.map((cfg, i) => buildLevelRounds(cfg, ROUNDS_PER_LEVEL[i]))
}

const PRAISE_GOOD = ['¡Muy bien ordenado!', '¡Perfecto!', '¡Así se hace!', '¡Excelente!']
const HINTS = [
  'Todavía no está — fijate cuáles números cambiarías de lugar.',
  'Casi. Revisá el orden con calma.',
  'Faltan algunos por acomodar — mirá los que quedaron en gris.',
]

export function OrdenaLasCifras({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Los números YA ORDENADOS de cada ronda de la época, decididos una sola
  // vez — al montar y de nuevo en "Hacer otro" — nunca vueltos a generar por
  // re-visitar un nivel, así "Repetir" devuelve exactamente la misma lista.
  const [epochRounds, setEpochRounds] = useState(() => buildEpoch())
  const level = LEVEL_CONFIGS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= roundsForLevel
  const correctOrder = epochRounds[levelIdx][Math.min(roundIdx, roundsForLevel - 1)]
  const direction = directionForRound(roundIdx)

  const { bank, placed, place, unplace } = useSequencingPuzzle(correctOrder, `${levelIdx}-${roundKey}-${roundIdx}`)
  const [resolved, setResolved] = useState(false)
  const [wrongIds, setWrongIds] = useState<Set<number>>(new Set())
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Acumulados a través de niveles 1→2→3 (y de cualquier revisión fallida
  // dentro del mismo nivel), sólo en cero en un reinicio real del día (ver
  // restartEpoch). Mismo esquema que ElPasoAPaso: no es un +1 plano, cuenta
  // POSICIONES equivocadas por revisión y NÚMEROS totales de esa ronda.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  function handlePlace(item: (typeof placed)[number]) {
    place(item)
    setHint(null)
    setWrongIds(new Set())
  }
  function handleUnplace(item: (typeof placed)[number]) {
    unplace(item)
    setHint(null)
    setWrongIds(new Set())
  }

  // Revisa automáticamente apenas se colocan todos los números — sin botón
  // que descubrir (ver comentario del encabezado). checkedRef recuerda qué
  // combinación exacta ya se revisó, para que un doble-invoke de efecto
  // (React 18) no duplique un error ni se re-dispare mientras el intento no
  // cambia — misma guarda que Sudoku4x4/DosPistas.
  const checkedRef = useRef<string | null>(null)
  useEffect(() => {
    if (bank.length > 0) {
      checkedRef.current = null
      return
    }
    if (placed.length === 0) return
    const attemptKey = placed.map((item) => item.id).join(',')
    if (checkedRef.current === attemptKey) return
    checkedRef.current = attemptKey

    const wrongPlacements = placed.filter((item, i) => item.id !== i)
    setAccMistakes((m) => m + wrongPlacements.length)
    setAccAttempts((a) => a + correctOrder.length)
    if (wrongPlacements.length === 0) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setWrongIds(new Set())
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setResolved(false)
      }, 1000)
    } else {
      setWrongIds(new Set(wrongPlacements.map((item) => item.id)))
      setHint(pickOne(HINTS))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank, placed])

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.

  // "Siguiente nivel" — avanza dentro de la MISMA época. epochRounds queda
  // intacto: las listas del nivel i+1 ya se decidieron al empezar la época.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setResolved(false)
    setWrongIds(new Set())
    setHint(null)
  }

  // Compartida por los dos botones de reinicio en la tarjeta final del
  // último nivel (sólo se muestra ahí, así que siempre es un reinicio real
  // del día). roundKey siempre avanza: es el contador de "qué intento es
  // este" que usa tanto useSequencingPuzzle (para rebarajar) como el efecto
  // de onComplete (para dispararse otra vez en una repetición).
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setResolved(false)
    setWrongIds(new Set())
    setHint(null)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  // "Repetir" — misma lista del intento recién terminado.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — listas nuevas por nivel.
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(buildEpoch())
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_CONFIGS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <p className="mt-3 text-lg font-bold text-slate-900">
              Tocalos {direction === 'desc' ? 'de MAYOR a MENOR' : 'de MENOR a MAYOR'}
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Ronda {roundIdx + 1} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día — la dirección
          cambia ronda a ronda, así que vale la pena explicarlo acá una sola
          vez en vez de competir por espacio arriba en cada ronda. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <ArrowDownWideNarrow className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver números de distinto tamaño. Tocalos en el orden que pida cada ronda — a veces de mayor a menor,
            a veces de menor a mayor. Fijate bien la consigna de arriba antes de empezar.
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

      {phase === 'playing' && !done && (
        <>
          {/* Secuencia en construcción */}
          <div className="mt-4 min-h-[56px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-2.5">
            {placed.length === 0 ? (
              <p className="text-center text-base text-slate-400">Tocá los números de abajo para empezar</p>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {placed.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={resolved}
                    onClick={() => handleUnplace(item)}
                    className={[
                      'flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-lg font-bold transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      resolved
                        ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                        : wrongIds.has(item.id)
                          ? 'border-slate-300 bg-slate-100 text-slate-400'
                          : 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10',
                    ].join(' ')}
                  >
                    <span className="text-base font-semibold text-slate-400">{i + 1}.</span>
                    {item.value.toLocaleString('es-AR')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Banco de números */}
          {bank.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlace(item)}
                  className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5 text-lg font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value.toLocaleString('es-AR')}
                </button>
              ))}
            </div>
          )}

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
            Ordenaste las {roundsForLevel} listas — completaste el nivel {levelIdx + 1}.
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
