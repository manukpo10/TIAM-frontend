import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Quién es quién?" — día 8 (Mes 2), memoria. Study a small set of faces
 * with their names, then — one at a time, in shuffled order — get asked to
 * match face↔name. Direction is the difficulty lever, same idea DondeEsta.tsx
 * uses for its word↔diagram levels: recognition (see a face, pick the name)
 * is easier than production (see a name, pick the face); level 3 mixes both
 * directions per query, the hardest and most flexible retrieval.
 *
 * Two house patterns combined, one per phase:
 *   - Study phase: timed reveal + early "ya estoy list@" escape hatch, the
 *     same `study-progress-fill` bar as QueHayEnLaMesa.tsx.
 *   - Test phase: DondeEsta.tsx's eliminate-and-retry per query (a wrong tap
 *     just eliminates that option and nudges, never ends the query) — each
 *     query has exactly one right answer, not a recognition set, so
 *     totalAttempts = mistakes + a fixed query count (guaranteed-eventual-
 *     success), same accounting as DondeEsta/DondeLoDeje.
 *
 * Decoys for each query are drawn from the OTHER studied faces (not the
 * full 8-face pool) — genuine interference, since those names/faces were
 * also just seen, not a free confidence-building pick.
 *
 * Faces are new flat-vector illustrated portraits (thick outline, flat
 * colors — same family as los-opuestos.tsx's emotion icons), generated
 * because no face-photo assets exist anywhere in the asset library (checked
 * first) and stock/marketing headshots (assets/profesionales/,
 * testimonial-claudia.webp) are the wrong context for game content.
 */

interface Face {
  id: string
  name: string
}
const FACES: Face[] = [
  { id: 'marta', name: 'Marta' },
  { id: 'jorge', name: 'Jorge' },
  { id: 'susana', name: 'Susana' },
  { id: 'carlos', name: 'Carlos' },
  { id: 'elena', name: 'Elena' },
  { id: 'ruben', name: 'Rubén' },
  { id: 'beatriz', name: 'Beatriz' },
  { id: 'alberto', name: 'Alberto' },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/quien-es-quien/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

type Direction = 'face-to-name' | 'name-to-face'
interface Level {
  n: number
  name: string
  count: number
  studySeconds: number
  minEarlySeconds: number
  direction: Direction | 'mixed'
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', count: 4, studySeconds: 14, minEarlySeconds: 6, direction: 'face-to-name' },
  { n: 2, name: 'Nivel 2', count: 5, studySeconds: 16, minEarlySeconds: 7, direction: 'name-to-face' },
  { n: 3, name: 'Nivel 3', count: 6, studySeconds: 18, minEarlySeconds: 8, direction: 'mixed' },
]
const TOTAL_QUERIES = LEVELS.reduce((sum, l) => sum + l.count, 0)

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

interface Query {
  target: Face
  direction: Direction
  options: Face[] // 3 options, includes target, order fixed for the query's lifetime
}
function buildQueries(level: Level, studied: Face[]): Query[] {
  const order = shuffle(studied)
  return order.map((target) => {
    const direction: Direction = level.direction === 'mixed' ? pickOne(['face-to-name', 'name-to-face']) : level.direction
    const decoys = shuffle(studied.filter((f) => f.id !== target.id)).slice(0, 2)
    return { target, direction, options: shuffle([target, ...decoys]) }
  })
}

const HINTS = ['Ese no es — pensá de nuevo en quién viste.', 'Casi. Fijate bien.', 'No era — probá con otra opción.']
const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente memoria!', '¡Así se hace!', '¡Qué buena memoria para las caras!']
const PRAISE_OK = ['¡Buen intento! Con la práctica se recuerda cada vez más.', '¡Bien ahí! Seguí practicando.']

export function QuienEsQuien({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const studied = useMemo(
    () => shuffle(FACES).slice(0, level.count),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const queries = useMemo(
    () => buildQueries(level, studied),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studied],
  )

  const [phase, setPhase] = useState<'study' | 'test'>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [queryIdx, setQueryIdx] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  const [correctCount, setCorrectCount] = useState(0)
  // Accumulated across levels 1→2→3, only zeroed on a true day restart.
  const [mistakes, setMistakes] = useState(0)

  const done = queryIdx >= level.count

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctCount / level.count >= 0.6 ? PRAISE_GOOD : PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // Timed study reveal + early-continue escape hatch — same shape (and the
  // same rationale for the timer ref) as QueHayEnLaMesa.tsx.
  const autoTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    const floorTimer = window.setTimeout(() => setCanContinueEarly(true), level.minEarlySeconds * 1000)
    const autoTimer = window.setTimeout(() => setPhase('test'), level.studySeconds * 1000)
    autoTimerRef.current = autoTimer
    return () => {
      window.clearTimeout(floorTimer)
      window.clearTimeout(autoTimer)
    }
  }, [levelIdx, roundKey, level.minEarlySeconds, level.studySeconds])

  function advance() {
    window.setTimeout(() => {
      setQueryIdx((i) => i + 1)
      setEliminated(new Set())
      setSolved(false)
      setHint(null)
    }, 900)
  }

  function guess(optionId: string) {
    if (phase !== 'test' || solved || eliminated.has(optionId)) return
    const query = queries[queryIdx]
    if (optionId === query.target.id) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      advance()
    } else {
      setEliminated((prev) => (prev.has(optionId) ? prev : new Set(prev).add(optionId)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level/round change — same
  // discipline as every sibling game (ElVuelto.tsx documents the stale-`done`
  // bug this avoids).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setQueryIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setQueryIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUERIES })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const query = !done ? queries[queryIdx] : undefined

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Conocé a estas personas</h2>
            <p className="mt-2 text-base text-slate-500">Dentro de un rato te voy a preguntar quién es quién.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-green"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {phase === 'test' && !done && query && (
          <>
            <p className="mt-2 text-base text-slate-500">
              {query.direction === 'face-to-name' ? '¿Cómo se llama esta persona?' : '¿Cuál es esta persona?'}
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                {queryIdx} de {level.count}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(queryIdx / level.count) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Study phase: grid of faces + names */}
      {phase === 'study' && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {studied.map((f) => (
            <div key={f.id} className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-slate-100 bg-white p-3">
              {imgFor(f.id) && (
                <img src={imgFor(f.id)} alt="" className="h-20 w-20 object-contain sm:h-24 sm:w-24" draggable={false} />
              )}
              <span className="text-base font-bold text-slate-900">{f.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Study phase: early-continue button */}
      {phase === 'study' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={!canContinueEarly}
            onClick={() => {
              window.clearTimeout(autoTimerRef.current)
              setPhase('test')
            }}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-green px-6 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ya estoy list@, continuar
          </button>
        </div>
      )}

      {/* Test phase: face→name */}
      {phase === 'test' && !done && query && query.direction === 'face-to-name' && (
        <>
          <div className="relative mx-auto mt-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:h-36 sm:w-36">
            {imgFor(query.target.id) && (
              <img src={imgFor(query.target.id)} alt="" className="h-full w-full object-contain" draggable={false} />
            )}
          </div>
          <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5">
            {query.options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(opt.id)}
                  className={[
                    'min-h-[52px] rounded-2xl border-2 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-green/40',
                    isEliminated
                      ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-green/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt.name}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Test phase: name→face */}
      {phase === 'test' && !done && query && query.direction === 'name-to-face' && (
        <>
          <p className="mt-4 text-center text-2xl font-extrabold text-tiam-green">{query.target.name}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {query.options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(opt.id)}
                  aria-label={opt.name}
                  className={[
                    'flex aspect-square items-center justify-center rounded-2xl border-2 bg-white p-1 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-green/40',
                    isEliminated
                      ? 'border-slate-200 opacity-40 grayscale'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:border-tiam-green/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {imgFor(opt.id) && <img src={imgFor(opt.id)} alt="" className="h-full w-full object-contain" draggable={false} />}
                </button>
              )
            })}
          </div>
        </>
      )}

      {hint && !solved && !done && phase === 'test' && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Reconociste a {correctCount} de {level.count} — completaste el {level.name.toLowerCase()}.
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
