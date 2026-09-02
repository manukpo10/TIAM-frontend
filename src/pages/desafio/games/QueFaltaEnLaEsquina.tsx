import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check, Puzzle } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué falta en la esquina?" — día 22, agnosias.
 *
 * A pedido explícito del usuario ("quiero que sea un rompecabezas y que lo
 * arme") se pasó de una tarea de reconocimiento (elegir, entre 3 recortes,
 * cuál completa la ÚNICA esquina tapada) a una de armado real: la foto
 * completa se corta en 4 piezas (2×2) y el jugador arma el rompecabezas
 * entero, tocando una pieza del banco y después el casillero donde cree que
 * va. El banco mezcla las 4 piezas reales con 2 señuelos — piezas de OTROS
 * objetos — así armar sigue exigiendo distinguir "¿es esta foto o no?"
 * además de, ahora también, "¿en qué lugar va?".
 *
 * Las piezas se cortan en el momento con CSS, directamente de la foto
 * completa que YA existe (`imgFor`) — no hace falta ningún asset nuevo. Una
 * pieza es un <img> de tamaño DOBLE al de su casillero (mismo recorte
 * `object-cover` que usa el resto de la app para estas fotos, así respeta
 * el encuadre real sin depender de que la foto sea cuadrada) puesto dentro
 * de un contenedor `overflow-hidden` del tamaño de un casillero, desplazado
 * con margin negativo según la esquina — siempre se ve exactamente un
 * cuarto de la foto. (Los recortes -corner-*.webp pre-generados que usaba
 * la versión anterior quedaron sin usar en este archivo — no se tocaron,
 * por si algo más los necesita.)
 *
 * Dificultad: sigue viniendo de qué tan parecidos son los señuelos al
 * objetivo (misma familia de color = más difícil), NO de más piezas — se
 * mantiene 2×2 en los 3 niveles, mismo criterio del diseño original.
 *
 * Colocación de a una pieza por vez, validada al toque (mismo patrón que
 * CrucigramaDeCifras): tocás una pieza del banco y después el casillero —
 * si es la pieza real Y el casillero correcto, encaja; si no, un aviso
 * suave y la pieza vuelve al banco (nunca desaparece — a diferencia de la
 * versión anterior que eliminaba definitivamente cada opción descartada,
 * acá los señuelos se quedan disponibles para las 4 colocaciones, no sólo
 * la primera). Nunca rojo, sin timer, siempre reintentable.
 */

interface ImgObject {
  slug: string
  category: 'rojo' | 'verde' | 'amarillo' | 'naranja' | 'marron'
}

const OBJECTS: ImgObject[] = [
  { slug: 'manzana-roja', category: 'rojo' },
  { slug: 'tomate', category: 'rojo' },
  { slug: 'frutilla', category: 'rojo' },
  { slug: 'pimiento-rojo', category: 'rojo' },

  { slug: 'manzana-verde', category: 'verde' },
  { slug: 'pepino', category: 'verde' },
  { slug: 'pimiento-verde', category: 'verde' },
  { slug: 'lima', category: 'verde' },

  { slug: 'banana', category: 'amarillo' },
  { slug: 'limon', category: 'amarillo' },
  { slug: 'pimiento-amarillo', category: 'amarillo' },
  { slug: 'maiz', category: 'amarillo' },

  { slug: 'naranja', category: 'naranja' },
  { slug: 'zanahoria', category: 'naranja' },
  { slug: 'calabaza', category: 'naranja' },
  { slug: 'damasco', category: 'naranja' },

  { slug: 'nuez', category: 'marron' },
  { slug: 'castana', category: 'marron' },
  { slug: 'papa', category: 'marron' },
  { slug: 'pan', category: 'marron' },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-falta-en-la-esquina/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(slug: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${slug}.webp`))?.[1]
}

type Corner = 'tl' | 'tr' | 'bl' | 'br'
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br']
// Tamaño fijo de casillero/pieza — ver comentario de cabecera sobre por qué
// es un <img> de tamaño DOBLE recortado, no una clase de Tailwind: el
// desplazamiento de margin negativo necesita el mismo número en JS y en el
// estilo, y no varía por breakpoint (2×2 ya entra cómodo en 375px).
const PIECE_SIZE = 88

function PieceImage({ slug, corner }: { slug: string; corner: Corner }) {
  const offsetX = corner === 'tr' || corner === 'br' ? -PIECE_SIZE : 0
  const offsetY = corner === 'bl' || corner === 'br' ? -PIECE_SIZE : 0
  return (
    <div style={{ width: PIECE_SIZE, height: PIECE_SIZE }} className="overflow-hidden">
      <img
        src={imgFor(slug)}
        alt=""
        draggable={false}
        style={{ width: PIECE_SIZE * 2, height: PIECE_SIZE * 2, marginLeft: offsetX, marginTop: offsetY }}
        className="max-w-none max-h-none object-cover"
      />
    </div>
  )
}

type Difficulty = 'easy' | 'mixed' | 'hard'
interface Level {
  n: number
  name: string
  rounds: number
  difficulty: Difficulty
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, difficulty: 'easy' },
  { n: 2, name: 'Nivel 2', rounds: 2, difficulty: 'mixed' },
  { n: 3, name: 'Nivel 3', rounds: 2, difficulty: 'hard' },
]
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
// Cada ronda ahora exige 4 colocaciones correctas (una por esquina), no 1
// —  el denominador de "intentos totales" tiene que reflejar eso, si no
// cada error pesa 4× más de lo que debería en el cálculo de estrellas.
const PIECES_PER_ROUND = 4
const ACCENT = '#D97706' // ámbar

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface DecoyPiece {
  obj: ImgObject
  corner: Corner
}
interface Round {
  target: ImgObject
  decoyPieces: DecoyPiece[]
  key: string
}
// Nivel 1: señuelos de otra familia de color (fácil, saltan a la vista).
// Nivel 3: señuelos de la MISMA familia (difícil, el color no alcanza).
function pickDecoys(target: ImgObject, difficulty: Difficulty): ImgObject[] {
  const others = OBJECTS.filter((o) => o.slug !== target.slug)
  const same = others.filter((o) => o.category === target.category)
  const diff = others.filter((o) => o.category !== target.category)
  if (difficulty === 'easy') return pick(diff, 2)
  if (difficulty === 'hard') return pick(same, 2)
  return [pick(same, 1)[0], pick(diff, 1)[0]]
}
function buildOnce(level: Level): Round {
  const target = pickOne(OBJECTS)
  const decoyObjs = pickDecoys(target, level.difficulty)
  const decoyPieces = decoyObjs.map((obj) => ({ obj, corner: pickOne(CORNERS) }))
  return { target, decoyPieces, key: target.slug }
}
function makeRound(level: Level, avoidKey?: string): Round {
  let round = buildOnce(level)
  let guard = 0
  while (avoidKey && round.key === avoidKey && guard < 10) {
    round = buildOnce(level)
    guard++
  }
  return round
}
function makeLevelRounds(level: Level): Round[] {
  const rounds: Round[] = []
  for (let i = 0; i < level.rounds; i++) {
    rounds.push(makeRound(level, rounds[i - 1]?.key))
  }
  return rounds
}

interface BankPiece {
  id: string
  slug: string
  corner: Corner
  isReal: boolean
}
function buildBank(round: Round): BankPiece[] {
  const real: BankPiece[] = CORNERS.map((corner) => ({
    id: `real-${corner}`,
    slug: round.target.slug,
    corner,
    isReal: true,
  }))
  const decoys: BankPiece[] = round.decoyPieces.map((d, i) => ({
    id: `decoy-${i}`,
    slug: d.obj.slug,
    corner: d.corner,
    isReal: false,
  }))
  return shuffle([...real, ...decoys])
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!']
const HINTS = [
  'Ese pedacito no va ahí — fijate el color y la forma.',
  'Casi. Mirá bien de qué parte de la foto es ese pedacito.',
  'No es ese lugar — pensá qué esquina de la foto le corresponde.',
]

export function QueFaltaEnLaEsquina({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochRounds] = useState(() => LEVELS.map((lvl) => makeLevelRounds(lvl)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  // Banco estable por ronda: `round` sólo cambia de referencia cuando
  // levelIdx/roundIdx avanzan (epochRounds, más abajo, se decide una única
  // vez al montar) — mismo patrón que CruceDeLetras.tsx.
  const allPieces = useMemo(() => (round ? buildBank(round) : []), [round])

  const [placedCorners, setPlacedCorners] = useState<Set<Corner>>(new Set())
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)

  const resolved = placedCorners.size === 4
  // Sólo las piezas reales YA colocadas salen del banco — los señuelos se
  // quedan siempre (ver comentario de cabecera: a diferencia de la versión
  // anterior, acá nunca desaparecen).
  const bank = allPieces.filter((p) => !(p.isReal && placedCorners.has(p.corner)))

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function selectPiece(id: string) {
    if (resolved) return
    setSelectedPieceId((prev) => (prev === id ? null : id))
  }

  function attemptSlot(slotCorner: Corner) {
    if (!round || resolved || placedCorners.has(slotCorner) || !selectedPieceId) return
    const piece = bank.find((p) => p.id === selectedPieceId)
    if (!piece) return
    if (piece.isReal && piece.corner === slotCorner) {
      setHint(null)
      setSelectedPieceId(null)
      const next = new Set(placedCorners).add(slotCorner)
      setPlacedCorners(next)
      if (next.size === 4) {
        // Un poco más que el resto del catálogo: da tiempo a ver el
        // rompecabezas completo armado antes de pasar a la próxima ronda.
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setPlacedCorners(new Set())
          setSelectedPieceId(null)
          setHint(null)
        }, 900)
      }
      return
    }
    setSelectedPieceId(null)
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPlacedCorners(new Set())
    setSelectedPieceId(null)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setPlacedCorners(new Set())
    setSelectedPieceId(null)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS * PIECES_PER_ROUND })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Armá el rompecabezas</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%`, backgroundColor: ACCENT }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Puzzle className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a armar una foto en 4 pedacitos. Tocá un pedacito del banco y después el lugar del rompecabezas donde
            creas que va. Ojo: hay pedacitos de otras fotos mezclados.
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
          {/* Marco del rompecabezas: 4 casilleros vacíos que se van llenando. */}
          <div
            className="mx-auto mt-4 grid grid-cols-2 gap-1 sm:mt-6"
            style={{ width: PIECE_SIZE * 2 + 4 }}
          >
            {CORNERS.map((corner) => {
              const filled = placedCorners.has(corner)
              return (
                <button
                  key={corner}
                  type="button"
                  disabled={filled || resolved}
                  onClick={() => attemptSlot(corner)}
                  aria-label={filled ? 'Casillero completo' : 'Casillero vacío'}
                  style={{ width: PIECE_SIZE, height: PIECE_SIZE }}
                  className={[
                    'relative flex items-center justify-center overflow-hidden rounded-xl border-2 transition',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    filled ? 'border-tiam-green' : 'border-dashed border-slate-300 bg-slate-50 hover:border-tiam-blue/40',
                  ].join(' ')}
                >
                  {filled && (
                    <>
                      <PieceImage slug={round.target.slug} corner={corner} />
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {/* Banco de piezas: reales + señuelos, mezclados. */}
          {!resolved && (
            <div className="mx-auto mt-5 flex max-w-xs flex-wrap items-center justify-center gap-2 sm:mt-6">
              {bank.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => selectPiece(piece.id)}
                  aria-label="Pedacito de rompecabezas"
                  style={{ width: PIECE_SIZE, height: PIECE_SIZE }}
                  className={[
                    'relative overflow-hidden rounded-xl border-2 bg-white transition',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    selectedPieceId === piece.id
                      ? 'border-tiam-blue ring-2 ring-tiam-blue/30'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <PieceImage slug={piece.slug} corner={piece.corner} />
                </button>
              ))}
            </div>
          )}

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {phase === 'playing' && done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Armaste los {level.rounds} rompecabezas — terminaste el {level.name.toLowerCase()}!
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
