import { useEffect, useRef, useState } from 'react'
import { ListOrdered, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'
import { useSequencingPuzzle } from './useSequencingPuzzle'

/**
 * "Antes y después" — día 30, Mes 2, cierre del área cálculo. Reemplaza a
 * FigurasSuperpuestas.tsx (agnosias): el usuario pidió este juego puntual,
 * a partir de un boceto en papel — un número fijo en el medio, y hay que
 * completar los números que van justo antes y justo después, en orden.
 * Sube de nivel = sube la cantidad de números a completar de cada lado (1
 * → 2 → 3), no el tamaño de los números — igual que en el boceto original.
 *
 * Área cambiada de agnosias a cálculo: completar una secuencia numérica es
 * aritmética, no reconocimiento visual. Esto deja Mes 2 sin ningún día de
 * agnosias (antes tenía días 17 y 30; el 17 ya se había cambiado a
 * lenguaje en un pedido anterior) — vale la pena que el usuario lo sepa,
 * no es algo para decidir en silencio acá.
 *
 * Mecánica: reutiliza useSequencingPuzzle (mismo motor que
 * LetrasRevueltas/ArmaLaEscena/CopiaElPatron) de una forma directa — los
 * números que faltan (antes y después del número mostrado) son, por
 * construcción, una secuencia YA ascendente y consecutiva, así que pasarlos
 * como "pool" y dejar que el jugador los toque en el orden correcto
 * ES exactamente "tocarlos de menor a mayor", que es lo mismo que "llenar
 * los huecos de izquierda a derecha" en la fila `_ _ _ N _ _ _`. No hace
 * falta ninguna lógica de validación aparte.
 *
 * Pool verificado con un script descartable (mismo criterio que el resto
 * del catálogo): para cada número de cada nivel se confirmó que los K
 * números de antes y los K de después dan un rango sin negativos.
 */

interface Level {
  n: number
  name: string
  rounds: number
  k: number
  pool: number[]
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, k: 1, pool: [100, 205, 320, 456, 789] },
  { n: 2, name: 'Nivel 2', rounds: 2, k: 2, pool: [158, 167, 284, 725, 341, 512] },
  { n: 3, name: 'Nivel 3', rounds: 2, k: 3, pool: [928, 605, 421, 850, 300] },
]

const PRAISE_GOOD = ['¡Exacto!', '¡Muy bien completada!', '¡Perfecto!', '¡Así se hace!']
const PRAISE_OK = ['¡Buen intento! Mirá cómo iba la secuencia.', '¡Casi! Con la práctica te sale cada vez mejor.']

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

export function AntesYDespues({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)

  // `rounds` números distintos por nivel para ESTA "epoch" — elegidos una
  // sola vez al montar, nunca vueltos a tirar por "Repetir" ni por
  // re-visitar un nivel a mitad de epoch.
  const [epochOrder] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
  const level = LEVELS[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const target = order[roundIdx]
  const k = level.k
  const before = Array.from({ length: k }, (_, i) => target - k + i)
  const after = Array.from({ length: k }, (_, i) => target + i + 1)

  const { bank, placed, place, unplace } = useSequencingPuzzle(
    [...before, ...after],
    `${levelIdx}-${roundKey}-${roundIdx}`,
  )
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const isCorrect = bank.length === 0 && placed.every((item, i) => item.id === i)
  const readyToCheck = bank.length === 0
  const done = checked && roundIdx >= level.rounds - 1

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    const stepMistakes = placed.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + stepMistakes)
    setAccAttempts((a) => a + before.length + after.length)
  }
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }
  function advanceLevel() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
  }
  function restartEpoch() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k2) => k2 + 1)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  // Cada slot vacío, en orden: primero los K "antes", después N (fijo, no
  // se toca), después los K "después" — `placed[i]` cubre los slots antes
  // Y después con el mismo índice corrido, sin distinguir grupo: el slot
  // "antes" #j es placed[j], el slot "después" #j es placed[k + j].
  function slot(i: number) {
    const item = placed[i]
    if (!item) {
      return (
        <div
          key={`empty-${i}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm text-slate-300"
        >
          ?
        </div>
      )
    }
    return (
      <button
        key={`filled-${i}`}
        type="button"
        onClick={() => unplace(item)}
        aria-label={`Quitar ${item.value}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-tiam-green bg-tiam-green/5 text-base font-extrabold text-tiam-green transition hover:-translate-y-0.5"
      >
        {item.value}
      </button>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Antes y después</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que el resto del catálogo. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <ListOrdered className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver un número fijo en el medio. Tocá, en orden de menor a mayor, los números del banco que van
            justo antes y justo después — a medida que subís de nivel, hay más para completar de cada lado.
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

      {phase === 'playing' && !done && !checked && (
        <>
          {/* Secuencia en 3 filas — antes / número fijo / después — en vez
              de una sola fila horizontal: con K=3 (nivel 3) los 7 elementos
              (3 + 1 + 3) no entran en una línea a 375px de ancho sin que el
              último hueco se corte solo a una segunda línea por el wrap.
              Apilarlas evita depender de dónde cae el wrap, sea cual sea K. */}
          <div className="mx-auto mt-6 flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center gap-1.5">{before.map((_, i) => slot(i))}</div>
            <div className="flex h-12 min-w-[48px] items-center justify-center rounded-lg border-2 border-slate-900 bg-slate-900 px-2 text-lg font-black text-white">
              {target}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">{after.map((_, i) => slot(k + i))}</div>
          </div>

          {/* Banco de números */}
          <div className="mx-auto mt-6 flex max-w-xs flex-wrap justify-center gap-2">
            {bank.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => place(item)}
                className="flex h-11 min-w-[44px] items-center justify-center rounded-lg border-2 border-slate-200 bg-white px-2 text-base font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
              >
                {item.value}
              </button>
            ))}
          </div>

          {readyToCheck && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Resultado */}
      {checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <p className="mt-2 text-base text-slate-600">
              La secuencia era:{' '}
              <span className="font-bold text-slate-900">
                {before.join(', ')}, {target}, {after.join(', ')}
              </span>
            </p>
          )}
          {!done ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente número
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : levelIdx < LEVELS.length - 1 ? (
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
