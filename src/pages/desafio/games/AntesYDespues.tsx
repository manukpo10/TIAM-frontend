import { useEffect, useMemo, useRef, useState } from 'react'
import { ListOrdered, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Antes y después" — día 30, Mes 2, cierre del área cálculo. Reemplaza a
 * FigurasSuperpuestas.tsx (agnosias): el usuario pidió este juego puntual,
 * a partir de un boceto en papel — un número fijo en el medio, y hay que
 * completar los números que van justo antes y justo después.
 * Sube de nivel = sube la cantidad de números a completar de cada lado (1
 * → 2 → 3), no el tamaño de los números — igual que en el boceto original.
 *
 * Área cambiada de agnosias a cálculo: completar una secuencia numérica es
 * aritmética, no reconocimiento visual. Esto deja Mes 2 sin ningún día de
 * agnosias (antes tenía días 17 y 30; el 17 ya se había cambiado a
 * lenguaje en un pedido anterior) — vale la pena que el usuario lo sepa,
 * no es algo para decidir en silencio acá.
 *
 * Colocación LIBRE por lugar, no por orden de toque — a pedido explícito
 * del usuario ("si haces click en otra posicion poder elegir el numero que
 * va"): la versión original usaba useSequencingPuzzle, que rellena el
 * PRÓXIMO hueco vacío sin importar qué ficha se tocó — tocar los números
 * fuera de orden ascendente los mandaba en silencio al lugar equivocado, y
 * recién se notaba al final con "Revisar". Ahora es tocar una ficha del
 * banco y DESPUÉS el lugar exacto donde va — mismo patrón que
 * CrucigramaDeCifras/QueFaltaEnLaEsquina: si el número no es el que
 * corresponde a ESE lugar, un aviso suave y la ficha vuelve al banco. Como
 * cada ubicación se valida al toque, una ronda completa siempre terminó
 * genuinamente bien — no hace falta botón "Revisar" ni una pantalla de "la
 * secuencia era..." (esas dos piezas existían sólo porque el modelo viejo
 * podía terminar con números en el lugar equivocado sin que el jugador se
 * enterara hasta el final).
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
// Cada ronda exige tantas colocaciones correctas como números tenga (2×k) —
// el denominador de "intentos totales" tiene que sumar eso por nivel, no un
// número fijo, ahora que cada lugar se valida por separado.
const TOTAL_REQUIRED_PLACEMENTS = LEVELS.reduce((sum, l) => sum + l.rounds * 2 * l.k, 0)

const PRAISE_GOOD = ['¡Exacto!', '¡Muy bien completada!', '¡Perfecto!', '¡Así se hace!']
const HINTS = [
  'Ese número no va ahí — fijate si tiene que ir antes o después.',
  'Casi. Pensá qué número sigue justo en ese lugar.',
  'No es ese lugar — mirá bien el orden de la secuencia.',
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

interface Tile {
  id: string
  value: number
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
  const totalSlots = 2 * k
  // slots[0..k-1] = before (índice i -> before[i]); slots[k..2k-1] = after
  // (índice k+i -> after[i]) — mismo orden que se muestra en pantalla.
  const slotValues = [...before, ...after]

  // Ficha por valor (todos distintos dentro de una ronda, por construcción:
  // antes/después de un mismo número nunca se repiten) — estable por ronda,
  // ver mismo patrón en CruceDeLetras.tsx.
  const allTiles = useMemo<Tile[]>(
    () => shuffle(slotValues.map((v) => ({ id: `${v}`, value: v }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )

  const [placedBySlot, setPlacedBySlot] = useState<Map<number, number>>(new Map())
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [accMistakes, setAccMistakes] = useState(0)

  // `done` es puramente el índice de ronda contra el total — NUNCA
  // combinado con `resolved`: una vez que la última ronda se resuelve, el
  // setTimeout de attemptSlot() igual hace avanzar roundIdx (y resetea
  // placedBySlot a vacío) un momento después. Si `done` dependiera de
  // `resolved`, ese reset lo volvería a apagar justo cuando roundIdx ya
  // está fuera de rango, y la pantalla mostraría una ronda fantasma con
  // `target` undefined (NaN por toda la fila) — se reprodujo en vivo antes
  // de este comentario. Mismo patrón que QueFaltaEnLaEsquina.tsx.
  const done = roundIdx >= level.rounds
  const resolved = !done && placedBySlot.size === totalSlots
  const placedValues = new Set(placedBySlot.values())
  const bank = allTiles.filter((t) => !placedValues.has(t.value))

  function selectTile(id: string) {
    if (resolved) return
    setSelectedTileId((prev) => (prev === id ? null : id))
  }

  function attemptSlot(slotIdx: number) {
    if (resolved || placedBySlot.has(slotIdx) || !selectedTileId) return
    const tile = bank.find((t) => t.id === selectedTileId)
    if (!tile) return
    if (tile.value === slotValues[slotIdx]) {
      setSelectedTileId(null)
      setHint(null)
      const next = new Map(placedBySlot).set(slotIdx, tile.value)
      setPlacedBySlot(next)
      if (next.size === totalSlots) {
        setPraise(pickOne(PRAISE_GOOD))
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setPlacedBySlot(new Map())
          setSelectedTileId(null)
          setHint(null)
        }, 900)
      }
      return
    }
    setSelectedTileId(null)
    setAccMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function advanceLevel() {
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
    setPlacedBySlot(new Map())
    setSelectedTileId(null)
    setHint(null)
  }
  function restartEpoch() {
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k2) => k2 + 1)
    setPlacedBySlot(new Map())
    setSelectedTileId(null)
    setHint(null)
    setAccMistakes(0)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accMistakes + TOTAL_REQUIRED_PLACEMENTS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes])

  function slot(i: number) {
    const value = placedBySlot.get(i)
    if (value === undefined) {
      return (
        <button
          key={`slot-${i}`}
          type="button"
          onClick={() => attemptSlot(i)}
          aria-label="Lugar vacío"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-300 transition hover:border-tiam-blue/40"
        >
          ?
        </button>
      )
    }
    return (
      <div
        key={`slot-${i}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-tiam-green bg-tiam-green/5 text-base font-extrabold text-tiam-green"
      >
        {value}
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {phase === 'playing' && !done && (
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
            Vas a ver un número fijo en el medio. Tocá un número del banco y después el lugar exacto donde creas que
            va — a medida que subís de nivel, hay más para completar de cada lado.
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
          {/* Instrucción de 2 pasos, dinámica según si hay un número
              seleccionado — mismo patrón que QueFaltaEnLaEsquina.tsx: la
              pantalla "¿Listo?" explica el orden una sola vez, esto lo
              recuerda en cada ronda, no sólo al principio del día. */}
          {!resolved && (
            <p className="mt-4 text-center text-sm font-semibold text-tiam-blue">
              {selectedTileId ? 'Ahora tocá el lugar donde va' : 'Primero tocá un número del banco'}
            </p>
          )}

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
          {!resolved && (
            <div className="mx-auto mt-6 flex max-w-xs flex-wrap justify-center gap-2">
              {bank.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => selectTile(tile.id)}
                  className={[
                    'flex h-11 min-w-[44px] items-center justify-center rounded-lg border-2 px-2 text-base font-extrabold transition',
                    selectedTileId === tile.id
                      ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900 ring-2 ring-tiam-blue/30'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {tile.value}
                </button>
              ))}
            </div>
          )}

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-4 text-center text-base font-semibold text-tiam-green">{praise}</p>}
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
            Completaste las {level.rounds} secuencias — terminaste el {level.name.toLowerCase()}.
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
