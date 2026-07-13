import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Minus, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué se esconde?" — a figure-ground discrimination mini-game grounded in
 * the Poppelreuter overlapping-figures test (a classic visual-gnosis task:
 * several object drawings superimposed in one space, name every object present).
 *
 * The fused image needs zero new art: the Flux illustrations are flat-color
 * shapes on solid-white canvases, and stacking them with CSS
 * `mix-blend-mode: multiply` makes every white background vanish (white × X = X)
 * while the dark outlines stay crisp through the overlap (black × X = black) —
 * unusually faithful to the real Poppelreuter plates.
 *
 * Selection is hidden-until-submit (à la "¿Qué hay en la mesa?"), NOT live
 * per-tap feedback (à la "Buscá los rojos"): with only 4–8 options and a single
 * static image to parse, live right/wrong per tap would let a player brute-force
 * the answer by tapping each option in turn instead of actually segregating the
 * overlapping contours. Never red — this is recognition territory (gnosias),
 * same rule as "¿Qué será?".
 *
 * VARIAS rondas por nivel (mismo patrón que LosOpuestos/LaCancionDeTuJuventud),
 * adaptado a este mecanismo de "enviar y revisar": cada nivel elige `rounds`
 * composiciones distintas al azar de su pool (sin repetir dentro del nivel).
 * A diferencia de los otros juegos, el paso de una ronda a la siguiente NO es
 * automático por timeout — el resultado de cada ronda (qué encontró, qué se
 * le escapó) se queda en pantalla con su leyenda hasta que la persona toca
 * "Continuar"; recién ahí avanza roundIdx (ver nextRound). La pantalla de fin
 * de nivel (Siguiente nivel/Otra ronda) sólo aparece cuando `done`. 12
 * imágenes en total (3+4+5): el nivel 3 sumó una composición nueva
 * combinando arte YA existente (sin arte nuevo) para llegar de 4 a 5 sin
 * repetir dentro de una misma partida.
 */

interface CompositionItem {
  objectId: string
  xPct: number
  yPct: number
  scale: number
  rotationDeg?: number
}
interface Composition {
  items: CompositionItem[]
  decoyIds: string[]
}
interface Level {
  n: number
  name: string
  rounds: number
  compositions: Composition[]
}

const LABELS: Record<string, string> = {
  paraguas: 'paraguas',
  banana: 'banana',
  guitarra: 'guitarra',
  tijera: 'tijera',
  'manzana-roja': 'manzana',
  tortuga: 'tortuga',
  'reloj-pulsera': 'reloj',
  oso: 'oso',
  corazon: 'corazón',
  zanahoria: 'zanahoria',
  anteojos: 'anteojos',
  mate: 'mate',
  pato: 'pato',
  rana: 'rana',
  sol: 'sol',
  mariposa: 'mariposa',
  llaves: 'llaves',
  'camion-bomberos': 'camión de bomberos',
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 3,
    compositions: [
      { items: [{ objectId: 'paraguas', xPct: 42, yPct: 40, scale: 0.95, rotationDeg: -8 }, { objectId: 'banana', xPct: 58, yPct: 62, scale: 0.9, rotationDeg: 18 }], decoyIds: ['tortuga', 'sol'] },
      { items: [{ objectId: 'guitarra', xPct: 46, yPct: 46, scale: 1, rotationDeg: -10 }, { objectId: 'tijera', xPct: 57, yPct: 56, scale: 0.85, rotationDeg: 32 }], decoyIds: ['oso', 'corazon'] },
      { items: [{ objectId: 'manzana-roja', xPct: 43, yPct: 42, scale: 0.9 }, { objectId: 'tortuga', xPct: 58, yPct: 58, scale: 0.95, rotationDeg: -12 }], decoyIds: ['reloj-pulsera', 'sol'] },
      { items: [{ objectId: 'zanahoria', xPct: 48, yPct: 38, scale: 0.95, rotationDeg: 8 }, { objectId: 'anteojos', xPct: 52, yPct: 62, scale: 1, rotationDeg: -6 }], decoyIds: ['mariposa', 'corazon'] },
      { items: [{ objectId: 'mate', xPct: 44, yPct: 46, scale: 1, rotationDeg: -5 }, { objectId: 'corazon', xPct: 59, yPct: 56, scale: 0.8, rotationDeg: 15 }], decoyIds: ['banana', 'rana'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    compositions: [
      { items: [{ objectId: 'guitarra', xPct: 46, yPct: 42, scale: 0.95, rotationDeg: -10 }, { objectId: 'tijera', xPct: 60, yPct: 54, scale: 0.8, rotationDeg: 30 }, { objectId: 'manzana-roja', xPct: 38, yPct: 60, scale: 0.78 }], decoyIds: ['banana', 'sol', 'tortuga'] },
      { items: [{ objectId: 'mate', xPct: 42, yPct: 44, scale: 0.88, rotationDeg: -8 }, { objectId: 'tortuga', xPct: 60, yPct: 46, scale: 0.85, rotationDeg: 12 }, { objectId: 'reloj-pulsera', xPct: 50, yPct: 64, scale: 0.78, rotationDeg: -15 }], decoyIds: ['rana', 'zanahoria', 'corazon'] },
      { items: [{ objectId: 'banana', xPct: 42, yPct: 40, scale: 0.88, rotationDeg: 22 }, { objectId: 'pato', xPct: 59, yPct: 48, scale: 0.82, rotationDeg: -10 }, { objectId: 'corazon', xPct: 48, yPct: 66, scale: 0.72 }], decoyIds: ['manzana-roja', 'llaves', 'paraguas'] },
      { items: [{ objectId: 'anteojos', xPct: 50, yPct: 36, scale: 0.92, rotationDeg: -5 }, { objectId: 'zanahoria', xPct: 40, yPct: 58, scale: 0.88, rotationDeg: 15 }, { objectId: 'oso', xPct: 62, yPct: 56, scale: 0.8 }], decoyIds: ['llaves', 'banana', 'mariposa'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    compositions: [
      { items: [{ objectId: 'tortuga', xPct: 50, yPct: 52, scale: 0.72 }, { objectId: 'manzana-roja', xPct: 38, yPct: 42, scale: 0.61 }, { objectId: 'banana', xPct: 60, yPct: 40, scale: 0.66, rotationDeg: 25 }, { objectId: 'tijera', xPct: 52, yPct: 62, scale: 0.61, rotationDeg: -30 }, { objectId: 'pato', xPct: 68, yPct: 63, scale: 0.6, rotationDeg: -12 }], decoyIds: ['reloj-pulsera', 'zanahoria', 'rana', 'oso'] },
      { items: [{ objectId: 'mate', xPct: 42, yPct: 46, scale: 0.82, rotationDeg: -8 }, { objectId: 'pato', xPct: 60, yPct: 42, scale: 0.72, rotationDeg: 10 }, { objectId: 'corazon', xPct: 40, yPct: 66, scale: 0.66 }, { objectId: 'zanahoria', xPct: 62, yPct: 64, scale: 0.76, rotationDeg: 18 }], decoyIds: ['reloj-pulsera', 'oso', 'sol', 'banana'] },
      { items: [{ objectId: 'tortuga', xPct: 50, yPct: 54, scale: 0.7 }, { objectId: 'guitarra', xPct: 40, yPct: 40, scale: 0.7, rotationDeg: -15 }, { objectId: 'anteojos', xPct: 60, yPct: 38, scale: 0.66, rotationDeg: 8 }, { objectId: 'reloj-pulsera', xPct: 58, yPct: 64, scale: 0.58, rotationDeg: -10 }, { objectId: 'pato', xPct: 68, yPct: 56, scale: 0.6, rotationDeg: -12 }], decoyIds: ['llaves', 'paraguas', 'rana', 'manzana-roja'] },
      { items: [{ objectId: 'oso', xPct: 50, yPct: 50, scale: 0.7 }, { objectId: 'banana', xPct: 38, yPct: 38, scale: 0.65, rotationDeg: 25 }, { objectId: 'rana', xPct: 62, yPct: 40, scale: 0.61 }, { objectId: 'camion-bomberos', xPct: 52, yPct: 66, scale: 0.7, rotationDeg: -8 }, { objectId: 'pato', xPct: 68, yPct: 62, scale: 0.6, rotationDeg: -12 }], decoyIds: ['zanahoria', 'corazon', 'mariposa', 'reloj-pulsera'] },
      { items: [{ objectId: 'tijera', xPct: 50, yPct: 52, scale: 0.7, rotationDeg: -20 }, { objectId: 'mate', xPct: 38, yPct: 40, scale: 0.64, rotationDeg: -6 }, { objectId: 'sol', xPct: 63, yPct: 38, scale: 0.6, rotationDeg: 10 }, { objectId: 'guitarra', xPct: 48, yPct: 65, scale: 0.64, rotationDeg: -14 }, { objectId: 'llaves', xPct: 68, yPct: 60, scale: 0.56, rotationDeg: 22 }], decoyIds: ['paraguas', 'corazon', 'banana', 'oso'] },
    ],
  },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-se-esconde/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

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

const PRAISE_GOOD = ['¡Excelente ojo!', '¡Muy bien descubierto!', '¡Así se hace!', '¡Qué buena percepción!']
const PRAISE_OK = [
  '¡Buen intento! Algunos estaban bien escondidos.',
  'Con la práctica, cada vez vas a distinguir más rápido las formas escondidas.',
]

type Phase = 'play' | 'results'

export function QueSeEsconde({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` composiciones distintas del pool del nivel, al azar, recalculadas
  // una sola vez por nivel/roundKey (sin repetir dentro del nivel).
  const roundCompositions = useMemo(
    () => shuffle(level.compositions).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const composition = roundCompositions[roundIdx]
  const done = roundIdx >= level.rounds

  const trueIds = useMemo(
    () => new Set(composition ? composition.items.map((i) => i.objectId) : []),
    [composition],
  )
  const options = useMemo(
    () => (composition ? shuffle([...composition.items.map((i) => i.objectId), ...composition.decoyIds]) : []),
    [composition],
  )

  const [phase, setPhase] = useState<Phase>('play')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across every round within a level —
  // every submission counts, same as ElVuelto's every-wrong-check model),
  // only zeroed on a true day restart (see nextLevel's wrap branch).
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE_GOOD))
  }, [done])

  function toggle(id: string) {
    if (phase !== 'play') return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const correctFound = useMemo(() => [...selected].filter((id) => trueIds.has(id)).length, [selected, trueIds])

  function submit() {
    if (!composition) return
    const ratio = trueIds.size ? correctFound / trueIds.size : 0
    setPraise(pickOne(ratio >= 0.6 ? PRAISE_GOOD : PRAISE_OK))
    setPhase('results')
    const missed = trueIds.size - correctFound
    const falsePositives = selected.size - correctFound
    setAccMistakes((m) => m + missed + falsePositives)
    setAccAttempts((a) => a + options.length)
  }

  // A diferencia de los otros juegos del desafío, acá el paso de ronda no es
  // por timeout: la persona revisa la leyenda (qué encontró/qué se le
  // escapó) y toca "Continuar" cuando está lista. roundIdx avanza recién en
  // ese tap, sincrónicamente — nunca en un efecto separado.
  function nextRound() {
    setRoundIdx((i) => i + 1)
    setPhase('play')
    setSelected(new Set())
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey]: an effect only catches
  // up on the render AFTER levelIdx changes, so a sibling effect watching
  // `done`/`phase` would still see stale values on the very render that just
  // arrived at the new level — firing onComplete against the NEW level's
  // composition but the OLD level's leftover selection/phase. Setting
  // `roundIdx`/`phase`/`selected` in the same handler that sets
  // `levelIdx`/`roundKey` means React batches them into one render, so
  // they're never observably out of sync.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setPhase('play')
    setSelected(new Set())
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulator — "Otra ronda" must NOT, even on level 1.
    if (isWrap) {
      setAccMistakes(0)
      setAccAttempts(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setPhase('play')
    setSelected(new Set())
  }

  // Reports the SUM across levels 1→2→3 and across every round within each
  // level: submit() already folded each round's numbers into
  // accMistakes/accAttempts above, so by the time level 3's last round is
  // confirmed (done, via "Continuar" on that round's results) those two
  // state values already hold every round's contribution. Fires once per
  // roundKey, same guard style as ElVuelto, so a genuine full-day restart
  // (wrap to level 1, new roundKey) can report again.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  const optionCols = level.n === 1 ? 'grid-cols-2' : level.n === 2 ? 'grid-cols-3' : 'grid-cols-4'

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          Agnosias · {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué se esconde?</h2>
            {phase === 'play' ? (
              <p className="mt-2 text-base text-slate-500">
                Mirá el dibujo. Tocá todos los objetos que reconozcas escondidos ahí.
              </p>
            ) : (
              <p className="mt-2 text-base font-semibold text-slate-500">
                Encontraste {correctFound} de {trueIds.size} — {praise}
              </p>
            )}
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

      {!done && composition && (
        <>
          {/* Fused canvas */}
          <div className="relative isolate mx-auto mt-6 aspect-square w-56 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:w-64">
            {composition.items.map((it) => {
              const img = imgFor(it.objectId)
              return (
                img && (
                  <img
                    key={it.objectId}
                    src={img}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute mix-blend-multiply"
                    style={{
                      left: `${it.xPct}%`,
                      top: `${it.yPct}%`,
                      width: `${it.scale * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${it.rotationDeg ?? 0}deg)`,
                    }}
                  />
                )
              )
            })}
          </div>

          {/* Options */}
          <div className={`mt-6 grid gap-3 ${optionCols}`}>
            {options.map((id) => {
              const img = imgFor(id)
              const isSelected = selected.has(id)
              const isTrue = trueIds.has(id)

              // Results-phase three-way language (never red): green=found, blue=missed, grey=false positive.
              let stateClass = 'border-slate-200 bg-white'
              let badge: 'hit' | 'missed' | 'false' | null = null
              if (phase === 'play') {
                stateClass = isSelected
                  ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
                  : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
              } else if (isTrue && isSelected) {
                stateClass = 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                badge = 'hit'
              } else if (isTrue && !isSelected) {
                stateClass = 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
                badge = 'missed'
              } else if (!isTrue && isSelected) {
                stateClass = 'border-slate-200 bg-white opacity-40'
                badge = 'false'
              } else {
                stateClass = 'border-slate-200 bg-white opacity-40'
              }

              return (
                <button
                  key={id}
                  type="button"
                  disabled={phase !== 'play'}
                  onClick={() => toggle(id)}
                  aria-label={LABELS[id] ?? id}
                  className={[
                    'relative flex aspect-square items-center justify-center rounded-2xl border-2 p-2 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    stateClass,
                  ].join(' ')}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                  {badge === 'hit' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                  {badge === 'missed' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-blue text-white shadow">
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {badge === 'false' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-white shadow">
                      <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Results legend */}
          {phase === 'results' && (
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-tiam-green" /> Lo encontraste</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-tiam-blue" /> También estaba</span>
              <span className="inline-flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-slate-400" /> No estaba</span>
            </div>
          )}

          {/* Actions */}
          {phase === 'play' ? (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={submit}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Listo
              </button>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Recorriste las {level.rounds} imágenes — completaste el nivel {levelIdx + 1}.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
