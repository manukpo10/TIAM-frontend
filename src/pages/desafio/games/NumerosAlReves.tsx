import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'
import { useSequencingPuzzle } from './useSequencingPuzzle'

/**
 * "Números al revés" — día 27 (mes 3), atención. Reemplaza a El mapa de
 * letras (orientación). Pedido explícito del usuario a partir de una hoja
 * de referencia ("ejercicio de atención — fíjese en los números siguientes
 * y escríbalos de forma inversa"). Área cambiada de orientación a atención
 * — coincide con el propio título de la hoja, y es lo que realmente se
 * ejercita: leer una secuencia con cuidado y reproducirla exactamente al
 * revés, sin saltarse ni repetir ninguna cifra.
 *
 * Mecánica: reutiliza useSequencingPuzzle (mismo motor que AntesYDespues,
 * también con números) de forma directa. La secuencia ORIGINAL queda
 * SIEMPRE visible arriba — igual que en la hoja de papel, donde los números
 * quedan impresos mientras se escribe la respuesta al lado; esto es un
 * ejercicio de atención y ejecución cuidadosa, no de memoria (no se pide
 * memorizar la secuencia y taparla). El truco es pasarle al hook la
 * secuencia YA invertida como `correctOrder` — el banco se arma barajando
 * esos mismos dígitos, y tocar en el orden que pide el hook ES tocarlos en
 * el orden inverso al original, sin necesitar ninguna validación aparte.
 *
 * Los pools SÍ repiten cifras dentro de una misma secuencia a propósito
 * (ej. nivel 3 reutiliza el 9 y el 7) — la propia hoja de referencia lo
 * hace ("4 9 7 8 4 6 4 6 5" repite el 4 tres veces) y useSequencingPuzzle
 * ya trackea cada ficha por su POSICIÓN original, no por su valor, así que
 * dos fichas idénticas nunca colapsan en una sola (misma disciplina que
 * LetrasRevueltas). Lo único que si se verificó por script antes de
 * escribir este archivo: ninguna secuencia elegida es un palíndromo — si
 * lo fuera, invertirla daría la misma secuencia, un "invertí esto" gratis
 * que no exige pensar de verdad.
 *
 * Ramp de dificultad por longitud de secuencia (no por cantidad de
 * distractores, acá no hay): nivel 1 = 3 cifras, nivel 2 = 5, nivel 3 = 7
 * — la propia hoja llega hasta 9, pero eso se sintió sobrecargado en otro
 * juego de este mismo lote (El hilo invisible) y se recortó ahí por el
 * mismo motivo, así que acá se arranca directamente en un techo más bajo.
 */

const LEVELS = [
  { n: 1, name: 'Nivel 1', rounds: 2, pool: [[6, 2, 5], [7, 3, 9], [4, 8, 1], [9, 5, 2], [3, 7, 6], [8, 1, 4]] },
  { n: 2, name: 'Nivel 2', rounds: 2, pool: [[3, 8, 1, 6, 4], [7, 2, 9, 5, 3], [6, 4, 8, 2, 7], [9, 1, 5, 3, 8]] },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    pool: [
      [4, 9, 2, 7, 1, 6, 3],
      [8, 3, 6, 1, 9, 4, 7],
      [2, 7, 4, 9, 3, 8, 1],
      [6, 1, 8, 4, 7, 2, 9],
    ],
  },
]

const PRAISE_GOOD = ['¡Exacto!', '¡Muy bien invertida!', '¡Perfecto!', '¡Así se hace!']
const PRAISE_OK = ['¡Buen intento! Mirá cómo quedaba la secuencia.', '¡Casi! Con la práctica te sale cada vez mejor.']

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

export function NumerosAlReves({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)

  // `rounds` secuencias distintas por nivel para ESTA "epoch" — elegidas
  // una sola vez al montar, nunca vueltas a tirar por "Repetir" ni por
  // re-visitar un nivel a mitad de epoch.
  const [epochOrder] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
  const level = LEVELS[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const original = order[roundIdx]
  const reversed = [...original].reverse()

  const { bank, placed, place, unplace } = useSequencingPuzzle(reversed, `${levelIdx}-${roundKey}-${roundIdx}`)
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
    setAccAttempts((a) => a + reversed.length)
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
    setRoundKey((k) => k + 1)
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Escribila al revés</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-orange transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que AntesYDespues. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <ArrowLeftRight className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver una secuencia de números. Tocá, del banco de abajo, esos mismos números pero en orden inverso
            — el último de la secuencia va primero.
          </p>
          <div className="mx-auto mt-4 max-w-[220px] rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3">
            <p className="text-sm font-semibold text-slate-500">Por ejemplo:</p>
            <p className="mt-1 flex items-center justify-center gap-2 text-lg">
              <span className="font-extrabold tracking-wider text-slate-800">5 6 4 7</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="font-extrabold tracking-wider text-tiam-blue">7 4 6 5</span>
            </p>
          </div>
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
          {/* Secuencia original — siempre visible, ver cabecera. */}
          <div className="mx-auto mt-6 flex max-w-xs flex-wrap justify-center gap-2">
            {original.map((d, i) => (
              <div
                key={i}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-slate-900 text-lg font-black text-white"
              >
                {d}
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
            el inverso es
          </p>

          {/* Slots del inverso, en orden */}
          <div className="mx-auto mt-2 flex max-w-xs flex-wrap justify-center gap-2">
            {reversed.map((_, i) => slot(i))}
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
              El inverso era: <span className="font-bold text-slate-900">{reversed.join(' ')}</span>
            </p>
          )}
          {!done ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente secuencia
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
