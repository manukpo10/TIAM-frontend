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
 * el orden inverso al original.
 *
 * Validación INMEDIATA por ficha (attemptPlace), no un "Revisar" al final:
 * la primera versión dejaba acomodar las fichas en cualquier orden, deshacer
 * libremente y recién chequear todo junto al tocar "Revisar" — con nivel 1
 * (3 cifras, sólo 3!=6 órdenes posibles) eso se podía resolver por prueba y
 * error puro, sin pensar la inversión de verdad (feedback en vivo del
 * usuario: "se ve muy fácil"). Ahora cada toque se valida contra la
 * posición exacta que le toca (`item.id === placed.length`): si no es la
 * ficha correcta para ESE lugar, rebota con una pista y no se coloca — nunca
 * bloquea, mismo contrato "siempre reintentable" que el resto del catálogo
 * (ElEslabonPerdido, CrucigramaDeCifras, El hilo invisible). Como una ficha
 * sólo se acepta si es correcta, la ronda se resuelve sola al completar el
 * último lugar — ya no hace falta un paso de "Revisar" ni un estado
 * "completo pero mal", así que PRAISE_OK y el resumen "el inverso era X" de
 * la primera versión se sacaron por no tener ya ningún caso real que
 * mostrar.
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
const HINTS = [
  'Esa no es la que sigue — fijate bien qué cifra va en ese lugar.',
  'Todavía no. Repasá la secuencia de arriba antes de tocar otra.',
  'Casi. Contá de nuevo desde el final de la secuencia original.',
]
// Total de cifras a completar en todo el día — la longitud es fija por
// nivel (todas las secuencias de un mismo pool tienen el mismo largo), así
// que este total no depende de qué secuencias caen en cada época.
const TOTAL_DIGITS = LEVELS.reduce((sum, lvl) => sum + lvl.rounds * lvl.pool[0].length, 0)

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
  // `order[roundIdx]` puede ser undefined por un render de transición: el
  // setTimeout de la última ronda sube roundIdx a level.rounds (fuera de
  // rango) en el mismo tick en que `done` recién se vuelve true — el JSX ya
  // no usa `original` en ese caso (gateado por `!done`), pero esta cuenta
  // corre en CADA render sin importar el JSX, así que igual necesita un
  // resguardo o revienta con "is not iterable" antes de llegar a pintar
  // nada (visto en vivo).
  const original: number[] = order[roundIdx] ?? []
  const reversed = [...original].reverse()

  const { bank, placed, place, unplace } = useSequencingPuzzle(reversed, `${levelIdx}-${roundKey}-${roundIdx}`)
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [wrongId, setWrongId] = useState<number | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [mistakes, setMistakes] = useState(0)

  // Puro en función de roundIdx, NO de `resolved` — si dependiera de ambos,
  // el setTimeout de la última ronda que sube roundIdx Y resetea resolved a
  // la vez haría que `done` se vuelva falso justo cuando roundIdx ya está
  // fuera de rango (crash real visto en vivo: `order[roundIdx]` da
  // undefined). Mismo patrón que CrucigramaDeCifras.
  const done = roundIdx >= level.rounds

  function attemptPlace(item: { id: number; value: number }) {
    if (resolved) return
    if (item.id !== placed.length) {
      setWrongId(item.id)
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
      window.setTimeout(() => setWrongId((w) => (w === item.id ? null : w)), 500)
      return
    }
    setHint(null)
    place(item)
    if (placed.length + 1 >= reversed.length) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setResolved(false)
        setHint(null)
      }, 1000)
    }
  }
  function advanceLevel() {
    setResolved(false)
    setHint(null)
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
  }
  function restartEpoch() {
    setResolved(false)
    setHint(null)
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setMistakes(0)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_DIGITS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

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

      {phase === 'playing' && !done && (
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

          {/* Banco de números — cada toque se valida contra el próximo lugar
              exacto, ver cabecera. */}
          {!resolved && (
            <div className="mx-auto mt-6 flex max-w-xs flex-wrap justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => attemptPlace(item)}
                  className={[
                    'flex h-11 min-w-[44px] items-center justify-center rounded-lg border-2 px-2 text-base font-extrabold transition',
                    wrongId === item.id
                      ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300 bg-slate-100 text-slate-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-4 text-center text-lg font-semibold text-tiam-green">{praise}</p>}
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
            Invertiste las {level.rounds} secuencias — completaste el {level.name.toLowerCase()}.
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
