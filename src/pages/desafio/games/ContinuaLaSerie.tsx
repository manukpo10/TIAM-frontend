import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, MoveHorizontal } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Continuá la serie" — praxias (razonamiento visoespacial, patrones
 * periódicos). Una FILA lineal de figuras geométricas sigue un patrón que
 * se repite (ej. óvalo-hexágono-óvalo-hexágono-óvalo-¿?) y falta la
 * última; hay que elegir, entre 4 opciones, cuál figura sigue.
 *
 * Formato de FILA (no grilla 2×2/3×3) a propósito — es la diferencia
 * deliberada con SeguiElPatron.tsx, que ya usa el formato de matriz para
 * "la celda que completa el patrón". Misma familia de habilidad
 * (visoespacial, patrón que se completa), pero un layout genuinamente
 * distinto para no sentirse repetido dentro del mismo mes: acá el patrón
 * es 1-D (se repite a lo largo de una fila) en vez de 2-D (crece por fila
 * dentro de una matriz).
 *
 * 100% SVG (mismo criterio que SeguiElPatron: contenido abstracto, ningún
 * asset necesario). La fila siempre tiene 5 figuras visibles + 1 faltante
 * en las 3 niveles — el largo de la fila NO cambia, sólo el período del
 * patrón y el parecido de las opciones incorrectas, para no arriesgar
 * overflow horizontal en mobile con niveles más difíciles.
 *
 * Generado PROCEDURALMENTE en cada ronda (como SeguiElPatron): se arma un
 * "alfabeto" de `período` combinaciones forma+color distintas, se repite
 * cíclicamente para la fila visible, y la figura que falta es siempre la
 * siguiente del ciclo — nunca ambigua. Nivel 3 reutiliza EXACTAMENTE la
 * misma regla que nivel 1/2 (no una habilidad nueva apilada encima), sólo
 * las opciones incorrectas se vuelven más parecidas a la correcta (mismo
 * criterio que DondeEsta/SeguiElPatron).
 *
 * NOTA para quien cablee este juego: el día 20 de Mes 1 y Mes 2 en
 * challengeContent.ts ya están ocupados (¿Dónde está? / Seguí el patrón),
 * así que "día 20" acá es sólo una etiqueta de planificación, no un slot
 * real de registry.ts todavía — este batch deliberadamente no toca
 * ninguno de los dos archivos (ver instrucciones del batch).
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" del resto del catálogo. Cada ronda se re-genera hasta ser
 * distinta de las demás rondas de su mismo nivel (nunca repite contenido
 * dentro del nivel), igual espíritu que el pool+shuffle+slice de las
 * figuras hand-authored de otros juegos.
 */

type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'oval'
interface SeqItem {
  shape: ShapeKind
  color: string
}
interface Round {
  visible: SeqItem[]
  correct: SeqItem
  options: SeqItem[]
}

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'oval']
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7']
const VISIBLE_COUNT = 5

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
function itemKey(it: SeqItem) {
  return `${it.shape}-${it.color}`
}

function randomUnlike(exclude: SeqItem[]): SeqItem {
  let candidate: SeqItem = { shape: 'circle', color: PALETTE[0] }
  let guard = 0
  do {
    candidate = { shape: pickOne(SHAPES), color: pickOne(PALETTE) }
    guard++
  } while (exclude.some((e) => itemKey(e) === itemKey(candidate)) && guard < 30)
  return candidate
}

/** Opción "casi correcta": comparte forma O color con la correcta, nunca las dos. */
function nearMiss(correct: SeqItem, exclude: SeqItem[]): SeqItem {
  let candidate: SeqItem = correct
  let guard = 0
  do {
    const shareShape = Math.random() < 0.5
    candidate = shareShape ? { shape: correct.shape, color: pickOne(PALETTE) } : { shape: pickOne(SHAPES), color: correct.color }
    guard++
  } while (
    (exclude.some((e) => itemKey(e) === itemKey(candidate)) || itemKey(candidate) === itemKey(correct)) &&
    guard < 30
  )
  return candidate
}

function generateRound(levelIdx: number): Round {
  const period = levelIdx === 0 ? 2 : 3
  const shapes = shuffle(SHAPES).slice(0, period)
  const colors = shuffle(PALETTE).slice(0, period)
  const alphabet: SeqItem[] = shapes.map((shape, i) => ({ shape, color: colors[i] }))

  const visible: SeqItem[] = Array.from({ length: VISIBLE_COUNT }, (_, i) => alphabet[i % period])
  const correct = alphabet[VISIBLE_COUNT % period]

  const decoys: SeqItem[] = alphabet.filter((a) => itemKey(a) !== itemKey(correct))
  while (decoys.length < 3) {
    const candidate = levelIdx === 2 ? nearMiss(correct, [correct, ...decoys]) : randomUnlike([correct, ...decoys])
    decoys.push(candidate)
  }

  const options = shuffle([correct, ...decoys.slice(0, 3)])
  return { visible, correct, options }
}

/** Genera `count` rondas para un nivel, sin repetir la misma fila dos veces dentro del nivel. */
function generateLevelRounds(levelIdx: number, count: number): Round[] {
  const rounds: Round[] = []
  const seen = new Set<string>()
  let guard = 0
  while (rounds.length < count && guard < 50) {
    guard++
    const r = generateRound(levelIdx)
    const sig = r.visible.map(itemKey).join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    rounds.push(r)
  }
  while (rounds.length < count) rounds.push(generateRound(levelIdx))
  return rounds
}

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto
// del catálogo.
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3']

function hexPoints(s: number) {
  const cx = s / 2
  const cy = s / 2
  const r = s / 2 - 2
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30)
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`
  })
  return pts.join(' ')
}

function Glyph({ shape, color, size = 28 }: { shape: ShapeKind; color: string; size?: number }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      {shape === 'circle' && <circle cx={s / 2} cy={s / 2} r={s / 2 - 2} fill={color} />}
      {shape === 'square' && <rect x={2} y={2} width={s - 4} height={s - 4} rx={4} fill={color} />}
      {shape === 'triangle' && <polygon points={`${s / 2},2 ${s - 2},${s - 2} 2,${s - 2}`} fill={color} />}
      {shape === 'diamond' && (
        <polygon points={`${s / 2},1 ${s - 1},${s / 2} ${s / 2},${s - 1} 1,${s / 2}`} fill={color} />
      )}
      {shape === 'hexagon' && <polygon points={hexPoints(s)} fill={color} />}
      {shape === 'oval' && <ellipse cx={s / 2} cy={s / 2} rx={s / 2 - 2} ry={s / 2 - 6} fill={color} />}
    </svg>
  )
}

function SeqCell({ item, variant }: { item: SeqItem | null; variant: 'row' | 'option' }) {
  const boxClass = variant === 'row' ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-16 w-16'
  const glyphSize = variant === 'row' ? 26 : 32
  return (
    <div className={`flex items-center justify-center rounded-xl border-2 border-slate-100 bg-white ${boxClass}`}>
      {item && <Glyph shape={item.shape} color={item.color} size={glyphSize} />}
    </div>
  )
}

const PRAISE_GOOD = ['¡Exacto, esa sigue!', '¡Muy bien visto!', '¡Perfecto!', '¡Así se hace!']
const WRONG_HINTS = [
  'Esa no es — fijate qué se repite en la fila.',
  'Casi. Mirá cómo se repiten la forma y el color.',
  'No es esa. Probá con otra opción.',
]

export function ContinuaLaSerie({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Igual que SeguiElPatron: todos los rounds de la epoch se generan una
  // sola vez (al montar y en "Hacer otro"), nunca por re-visitar un nivel.
  const [epochRounds, setEpochRounds] = useState(() =>
    ROUNDS_PER_LEVEL.map((count, idx) => generateLevelRounds(idx, count)),
  )
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Elecciones equivocadas, acumuladas a través de niveles 1→2→3 y sólo en
  // cero en un reinicio real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  function guess(option: SeqItem) {
    if (!round || resolved) return
    if (itemKey(option) === itemKey(round.correct)) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 900)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(itemKey(option)))
      setHint(pickOne(WRONG_HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(ROUNDS_PER_LEVEL.map((count, idx) => generateLevelRounds(idx, count)))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_NAMES.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
          {LEVEL_NAMES[levelIdx]}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué figura sigue?</h2>
            <p className="mt-2 text-base text-slate-500">Fijate el patrón de la fila y elegí la que sigue.</p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que ElPasoAPaso.tsx. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <MoveHorizontal className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver una fila de figuras que se repiten siguiendo un patrón. Fijate cuál figura sigue la serie y
            tocala entre las opciones.
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
          {/* Fila con la serie — patrón horizontal, no matriz */}
          <div className="mt-5 flex items-center justify-center gap-1.5 sm:gap-2">
            {round.visible.map((item, i) => (
              <SeqCell key={i} item={item} variant="row" />
            ))}
            <div
              className={[
                'flex items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 text-lg font-bold text-violet-400',
                'h-11 w-11 sm:h-12 sm:w-12',
              ].join(' ')}
            >
              {resolved ? <Glyph shape={round.correct.shape} color={round.correct.color} size={26} /> : '?'}
            </div>
          </div>

          {/* Opciones */}
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-4 gap-2">
            {round.options.map((opt) => {
              const key = itemKey(opt)
              const isEliminated = eliminated.has(key)
              const isCorrectShown = resolved && key === itemKey(round.correct)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt)}
                  className={[
                    'relative rounded-2xl border-2 p-1 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 opacity-40'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <SeqCell item={opt} variant="option" />
                </button>
              )
            })}
          </div>
        </>
      )}

      {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
      {resolved && <p className="mt-4 text-center text-base font-semibold text-tiam-green">{praise}</p>}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Completaste las {roundsForLevel} series — terminaste el nivel {levelIdx + 1}.
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
