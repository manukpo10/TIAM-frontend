import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check, Puzzle } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué falta en la esquina?" — día 22, agnosias.
 *
 * La referencia original (papel/foto) mostraba una imagen real con un hueco
 * en una esquina. Esta versión lo hace literal: una foto realista (Flux) de
 * un objeto cotidiano, con la esquina inferior derecha tapada, y 3 recortes
 * de esquina como opciones — sólo uno es el recorte REAL de esa foto, los
 * otros dos son esquinas de OTRAS fotos. Los recortes se generan una sola
 * vez con Pillow (42% del cuadro inferior derecho) al crear cada imagen —
 * no hay recorte en tiempo de ejecución, así el pixel-a-pixel siempre calza
 * exacto con la opción correcta.
 *
 * La dificultad no viene de una grilla, viene de cuán parecidos son los
 * señuelos al objetivo. 20 objetos agrupados en 5 familias de color (rojo/
 * verde/amarillo/naranja/marrón, 4 objetos cada una):
 *   Nivel 1: los 2 señuelos son de una familia de color DISTINTA — la
 *     esquina correcta salta a la vista por el color solo.
 *   Nivel 2: un señuelo de la misma familia, uno de otra — hay que mirar
 *     dos veces.
 *   Nivel 3: los 2 señuelos son de la MISMA familia que el objetivo — el
 *     color no alcanza, hace falta atender a la textura/forma real.
 *
 * Nunca rojo, sin timer, siempre reintentable, pantalla "¿Listo?" única vez.
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
function cornerFor(slug: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${slug}-corner.webp`))?.[1]
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

interface Round {
  target: ImgObject
  options: ImgObject[]
  key: string
}
// Nivel 1: señuelos de otra familia de color (fácil, salta a la vista).
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
  const decoys = pickDecoys(target, level.difficulty)
  return { target, options: shuffle([target, ...decoys]), key: target.slug }
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

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!']
const HINTS = [
  'Esa esquina no es de esta foto — fijate bien en el color y la textura.',
  'Casi. Mirá el borde: ¿el color sigue igual ahí?',
  'No es esa — pensá qué objeto es el de la foto completa.',
]

export function QueFaltaEnLaEsquina({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => makeLevelRounds(lvl)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(slug: string) {
    if (!round || resolved || eliminated.has(slug)) return
    if (slug === round.target.slug) {
      setResolved(true)
      setHint(null)
      // Un poco más que el resto del catálogo: da tiempo a ver la foto
      // completa revelada (se saca la tapa de la esquina al resolver).
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 900)
      return
    }
    setEliminated((prev) => new Set(prev).add(slug))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => makeLevelRounds(lvl)))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué pedacito falta en la esquina?</h2>
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
            La foto tiene un pedacito tapado en la esquina de abajo a la derecha. Tocá la opción que completa la
            imagen.
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
          {/* Foto con la esquina tapada */}
          <div className="relative mx-auto mt-4 h-48 w-48 overflow-hidden rounded-2xl border-2 border-slate-100 bg-white sm:mt-6 sm:h-56 sm:w-56">
            <img
              src={imgFor(round.target.slug)}
              alt="Foto con la esquina tapada"
              className="h-full w-full object-cover"
              draggable={false}
            />
            {!resolved && (
              <div
                className="absolute bottom-0 right-0 border-2 border-dashed border-slate-400 bg-slate-100/95"
                style={{ width: '42%', height: '42%' }}
              />
            )}
          </div>

          {/* Opciones: 3 recortes de esquina */}
          <div className="mx-auto mt-5 flex max-w-xs justify-center gap-3 sm:mt-6">
            {round.options.map((opt, i) => {
              const isEliminated = eliminated.has(opt.slug)
              const isCorrectShown = resolved && opt.slug === round.target.slug
              return (
                <button
                  key={opt.slug}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt.slug)}
                  aria-label={`Opción ${i + 1}`}
                  className={[
                    'relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 bg-white transition sm:h-24 sm:w-24',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 opacity-30'
                        : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <img src={cornerFor(opt.slug)} alt="" className="h-full w-full object-cover" draggable={false} />
                  {isCorrectShown && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

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
            ¡Completaste las {level.rounds} fotos — terminaste el {level.name.toLowerCase()}!
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
