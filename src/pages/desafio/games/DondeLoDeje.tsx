import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Dónde lo dejé" — día 16 (Mes 2), memoria espacial. A grid of empty cells
 * briefly shows an everyday object in some of them; then everything goes
 * blank and the player is asked, one object at a time, which cell it was in.
 *
 * Two house patterns combined, one per phase:
 *   - Study phase: fixed timed exposure with an early "ya estoy list@"
 *     escape hatch, same shape (and the same `study-progress-fill` CSS
 *     keyframe bar) as QueHayEnLaMesa.tsx — this is WHAT was on the table,
 *     that game's exact mechanic, so its study-phase UX is reused verbatim.
 *   - Test phase: DondeEsta.tsx's eliminate-and-retry pattern (a wrong tap
 *     just eliminates that cell and nudges, never ends the query) rather
 *     than QueHayEnLaMesa's one-shot "select all, then reveal" — spatial
 *     position is a single right answer per object, not a recognition set,
 *     so it reads as a sequence of small guessing games, each resolved by a
 *     genuine correct tap (guaranteed-eventual-success ⇒ totalAttempts =
 *     mistakes + fixed query count, same accounting as DondeEsta).
 *
 * Grid size AND object count both climb with level (3×3/4 objects → 4×4/6 →
 * 4×4/8), so both "how much space" and "how many items" ramp up. Objects
 * reuse QueHayEnLaMesa's existing photo library (`que-hay-en-la-mesa/`) — a
 * deliberate cross-game reuse of already-generated everyday-object photos
 * rather than regenerating near-duplicates for a second memory game.
 */

interface PoolObject {
  id: string
  label: string
}
const POOL: PoolObject[] = [
  { id: 'anteojos', label: 'anteojos' },
  { id: 'billetera', label: 'billetera' },
  { id: 'celular', label: 'celular' },
  { id: 'control-remoto', label: 'control remoto' },
  { id: 'cuaderno', label: 'cuaderno' },
  { id: 'diario', label: 'diario' },
  { id: 'lapicera', label: 'lapicera' },
  { id: 'lapiz', label: 'lápiz' },
  { id: 'libro', label: 'libro' },
  { id: 'llaves', label: 'llaves' },
  { id: 'maceta', label: 'maceta' },
  { id: 'mate', label: 'mate' },
  { id: 'ovillo-lana', label: 'ovillo de lana' },
  { id: 'paraguas', label: 'paraguas' },
  { id: 'portarretrato', label: 'portarretrato' },
  { id: 'reloj-pulsera', label: 'reloj de pulsera' },
  { id: 'taza', label: 'taza' },
  { id: 'termo', label: 'termo' },
  { id: 'tijera', label: 'tijera' },
  { id: 'vaso', label: 'vaso' },
  { id: 'vela', label: 'vela' },
]
const BY_ID = new Map(POOL.map((o) => [o.id, o]))

// Reused as-is from QueHayEnLaMesa.tsx — same folder, same glob shape.
const IMAGES = import.meta.glob('../../../assets/desafio/games/que-hay-en-la-mesa/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

interface Level {
  n: number
  name: string
  cols: number
  objects: number
  studySeconds: number
  minEarlySeconds: number
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', cols: 3, objects: 4, studySeconds: 14, minEarlySeconds: 6 },
  { n: 2, name: 'Nivel 2', cols: 4, objects: 6, studySeconds: 18, minEarlySeconds: 7 },
  { n: 3, name: 'Nivel 3', cols: 4, objects: 8, studySeconds: 22, minEarlySeconds: 8 },
]
const TOTAL_QUERIES = LEVELS.reduce((sum, l) => sum + l.objects, 0)

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

interface Layout {
  cellToObject: Map<number, string>
  objectToCell: Map<string, number>
  queryOrder: string[]
}
function buildLayout(level: Level): Layout {
  const cellCount = level.cols * level.cols
  const cellIndices = shuffle(Array.from({ length: cellCount }, (_, i) => i)).slice(0, level.objects)
  const objects = shuffle(POOL).slice(0, level.objects)
  const cellToObject = new Map<number, string>()
  const objectToCell = new Map<string, number>()
  objects.forEach((obj, i) => {
    cellToObject.set(cellIndices[i], obj.id)
    objectToCell.set(obj.id, cellIndices[i])
  })
  return { cellToObject, objectToCell, queryOrder: shuffle(objects.map((o) => o.id)) }
}

const HINTS = ['Ahí no estaba — probá con otra celda.', 'Casi. Pensá bien dónde lo viste.', 'No era esa celda — seguí probando.']
const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente memoria!', '¡Así se hace!', '¡Qué buena memoria espacial!']
const PRAISE_OK = ['¡Buen intento! La memoria espacial también se entrena.', '¡Bien ahí! Cada vez vas a recordar más.']

export function DondeLoDeje({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Layout (objects AND their cell positions, decided together) for the
  // WHOLE epoch, one per level — generated once at mount, and again only
  // inside restartDifferent(). Never re-rolled just by revisiting a level,
  // so "Repetir" hands back the exact same layout.
  const [epochLayouts, setEpochLayouts] = useState(() => LEVELS.map((lvl) => buildLayout(lvl)))
  const layout = epochLayouts[levelIdx]

  const [phase, setPhase] = useState<'study' | 'test'>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [queryIdx, setQueryIdx] = useState(0)
  const [eliminated, setEliminated] = useState<Set<number>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  const [correctCount, setCorrectCount] = useState(0)
  // Accumulated across levels 1→2→3, only zeroed by restartEpoch (a true
  // day restart).
  const [mistakes, setMistakes] = useState(0)

  const done = queryIdx >= level.objects

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctCount / level.objects >= 0.6 ? PRAISE_GOOD : PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // Timed study reveal + early-continue escape hatch, same shape as
  // QueHayEnLaMesa.tsx (see its comment for why the timer ref matters: an
  // early click must cancel the pending auto-timer, or it fires later and
  // snaps phase back to 'study' mid-test).
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

  function guessCell(cellIdx: number) {
    if (phase !== 'test' || solved || eliminated.has(cellIdx)) return
    const queryId = layout.queryOrder[queryIdx]
    if (layout.cellToObject.get(cellIdx) === queryId) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      advance()
    } else {
      setEliminated((prev) => (prev.has(cellIdx) ? prev : new Set(prev).add(cellIdx)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level/round change — same
  // discipline as every sibling game (see ElVuelto.tsx / Memotest.tsx for why
  // an effect-based reset would let `done` read stale right at the last level).

  // "Siguiente nivel" — advance within the SAME attempt. epochLayouts is left
  // alone: every level's layout was already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setQueryIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
  }

  // Shared by both restart buttons on the final level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — zero
  // the mistake accumulator either way). roundKey always bumps here: it's
  // the "which attempt is this" generation counter the onComplete effect
  // uses to fire again on a replay, independent of whether the layout
  // changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setQueryIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
    setMistakes(0)
  }
  // "Repetir" — same layout as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random layout per level, same as before this
  // feature existed (the only option there used to be).
  function restartDifferent() {
    restartEpoch()
    setEpochLayouts(LEVELS.map((lvl) => buildLayout(lvl)))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUERIES })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const currentQuery = !done ? BY_ID.get(layout.queryOrder[queryIdx]) : undefined
  const cellCount = level.cols * level.cols

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Fijate bien dónde queda cada cosa</h2>
            <p className="mt-2 text-base text-slate-500">Dentro de un rato te voy a preguntar dónde estaba cada objeto.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full"
                style={{ animationDuration: `${level.studySeconds}s`, backgroundColor: '#4F46E5' }}
              />
            </div>
          </>
        )}

        {phase === 'test' && !done && currentQuery && (
          <>
            <p className="mt-2 text-base text-slate-500">¿En qué casillero estaba?</p>
            <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-4 py-2">
              {imgFor(currentQuery.id) && (
                <img src={imgFor(currentQuery.id)} alt="" className="h-10 w-10 object-contain" draggable={false} />
              )}
              <span className="text-lg font-extrabold text-slate-900">{currentQuery.label}</span>
            </div>
            <div className="mx-auto mt-3 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                {queryIdx} de {level.objects}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${(queryIdx / level.objects) * 100}%`, backgroundColor: '#4F46E5' }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Grid */}
      {!done && (
        <div
          className="mx-auto mt-5 grid max-w-xs gap-2 sm:max-w-sm sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cellCount }).map((_, cellIdx) => {
            const objId = layout.cellToObject.get(cellIdx)
            const obj = objId ? BY_ID.get(objId) : undefined

            if (phase === 'study') {
              return (
                <div
                  key={cellIdx}
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-slate-100 bg-white p-1"
                >
                  {obj && imgFor(obj.id) && (
                    <>
                      <img src={imgFor(obj.id)} alt="" className="h-8 w-8 object-contain sm:h-10 sm:w-10" draggable={false} />
                      <span className="text-center text-[9px] font-medium leading-tight text-slate-500 sm:text-[10px]">
                        {obj.label}
                      </span>
                    </>
                  )}
                </div>
              )
            }

            // Test phase: every cell is blank; only styling reveals state.
            const isEliminated = eliminated.has(cellIdx)
            const isSolvedHere = solved && objId === layout.queryOrder[queryIdx]
            return (
              <button
                key={cellIdx}
                type="button"
                disabled={solved || isEliminated}
                onClick={() => guessCell(cellIdx)}
                aria-label={`Casillero ${cellIdx + 1}`}
                className={[
                  'relative flex aspect-square items-center justify-center rounded-2xl border-2 transition',
                  'focus:outline-none focus:ring-2 focus:ring-offset-1',
                  isSolvedHere
                    ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                    : isEliminated
                      ? 'border-slate-200 bg-slate-50 opacity-40'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                ].join(' ')}
              >
                {isSolvedHere && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
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
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: '#4F46E5' }}
          >
            Ya estoy list@, continuar
          </button>
        </div>
      )}

      {hint && !solved && !done && phase === 'test' && (
        <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste los {level.objects} objetos — completaste el {level.name.toLowerCase()}.
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
