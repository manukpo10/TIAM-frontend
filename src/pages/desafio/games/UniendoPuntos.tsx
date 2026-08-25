import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Uniendo puntos" — día 6 (mes 2), ejecutivas. A classic connect-the-dots:
 * tap the numbered (or lettered) dots in ascending order on a scattered
 * layout; an SVG line is drawn between taps as they go, and closes into the
 * finished shape once the last dot is found — matching the day's own
 * `instructions` copy in challengeContent.ts ("uní los puntos ... para
 * completar el dibujo").
 *
 * Deliberately scoped like CaminoNumerico.tsx (día "Camino numérico", the
 * Trail-Making-Test-style game already in this codebase): absolute/percentage
 * positioning instead of a CSS grid, an SVG polyline trail overlay, "tap the
 * next one in order" validation, a muted (never red) wiggle + orienting hint
 * on a wrong tap, no timer, no elimination, double-tap safe. Per the brief,
 * there's deliberately NO geometric self-crossing validation — only the TAP
 * ORDER is checked, exactly like a printed connect-the-dots page.
 *
 * Unlike CaminoNumerico's hand-placed layouts, the dot positions here are
 * generated from a regular star-polygon construction ({n/k}, i.e. connect
 * every k-th vertex of a regular n-gon — the same trick that draws a classic
 * 5-pointed star from 5 dots): plugging in coprime (n, k) always visits every
 * vertex exactly once and always resolves into a clean, attractive shape, so
 * there's no hand-authored coordinate list to get wrong. Tap order is baked
 * into the array position (`points[i]` IS the i-th dot to find), so — unlike
 * CaminoNumerico, which shuffles VALUES onto fixed slots — no value-shuffle
 * is needed here at all.
 *
 * Difficulty ramps on three axes per the brief ("more dots/less-obvious
 * spatial layout at higher levels"): dot count (5 → 8 → 11), a small random per-dot jitter
 * that grows with level (L1 is a clean, instantly-legible star; L3's jitter
 * means you genuinely can't guess the shape ahead of tapping), and a fresh
 * random rotation every round/replay so the picture is never memorized.
 */

interface Point {
  x: number
  y: number
}
interface ShapeSpec {
  n: number
  kOptions: number[]
}
interface Level {
  n: number
  name: string
  labelType: 'number' | 'letter'
  jitter: number
  shape: ShapeSpec
}

// labelType por nivel invertido a pedido del profesional que revisó el
// catálogo: originalmente número/número/letra, se sentía repetitivo con otro
// ejercicio de números del mes. Ahora letra/letra/número — deja el nivel 3
// (más puntos, más jitter) con etiquetas familiares justo cuando las otras
// dos variables de dificultad ya están al máximo.
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', labelType: 'letter', jitter: 0, shape: { n: 5, kOptions: [2] } },
  { n: 2, name: 'Nivel 2', labelType: 'letter', jitter: 0.06, shape: { n: 8, kOptions: [3] } },
  { n: 3, name: 'Nivel 3', labelType: 'number', jitter: 0.13, shape: { n: 11, kOptions: [3, 4, 5] } },
]

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Regular {n/k} star polygon: n points on a circle, connected every k-th
// vertex. Any k coprime with n visits all n vertices before closing, which is
// exactly the classic "draw a star without lifting the pen" construction —
// returned ALREADY in tap order (points[0] is dot 1, points[1] is dot 2, …).
function starPolygonPoints(n: number, k: number, jitter: number): Point[] {
  const cx = 50
  const cy = 50
  const radius = 33
  const rotation = Math.random() * 360
  const verts: Point[] = []
  for (let i = 0; i < n; i++) {
    const angleDeg = rotation - i * (360 / n)
    const angleRad = (angleDeg * Math.PI) / 180
    const r = jitter > 0 ? radius * (1 + (Math.random() * 2 - 1) * jitter) : radius
    verts.push({ x: cx + r * Math.cos(angleRad), y: cy - r * Math.sin(angleRad) })
  }
  const order: Point[] = []
  let idx = 0
  for (let i = 0; i < n; i++) {
    order.push(verts[idx])
    idx = (idx + k) % n
  }
  return order
}

function labelFor(level: Level, i: number): string {
  return level.labelType === 'letter' ? String.fromCharCode(65 + i) : String(i + 1)
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto dibujo!', '¡Qué buena atención!']

export function UniendoPuntos({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which star-polygon points are playing for level i THIS "epoch" (a full
  // 3-level pass). Decided once, at mount — never re-rolled just because the
  // player re-visits a level, so "Repetir" always hands back the exact same
  // drawing deterministically instead of re-generating (a fresh
  // rotation/jitter) and accidentally landing on something new.
  const [epochPoints] = useState(() =>
    LEVELS.map((lvl) => starPolygonPoints(lvl.shape.n, pickOne(lvl.shape.kOptions), lvl.jitter)),
  )
  const level = LEVELS[levelIdx]
  const points = epochPoints[levelIdx]

  const [foundCount, setFoundCount] = useState(0)
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [wrongHint, setWrongHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (wrap
  // from level 3 back to level 1) — same policy as CaminoNumerico, the
  // closest sibling game.
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)

  const done = foundCount >= points.length

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function handleTap(i: number) {
    if (done) return
    if (i < foundCount) return // already found, silent no-op

    if (i === foundCount) {
      setFoundCount((c) => c + 1)
      setWrongIdx(null)
      setWrongHint(null)
      return
    }

    setWrongIdx(i)
    setWrongHint(`Ese no sigue ahora — buscá el ${labelFor(level, foundCount)}.`)
    setMistakes((m) => m + 1)
    window.setTimeout(() => {
      setWrongIdx((v) => (v === i ? null : v))
      setWrongHint(null)
    }, 1500)
  }

  // Resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundKey — never in a separate effect keyed on them (that would
  // let the onComplete effect below read a stale `done` the render it
  // arrives at the new level, the same hazard fixed across this codebase's
  // other games — see CaminoNumerico's identical comment).
  // "Siguiente nivel" — advance within the SAME attempt. epochPoints is left
  // alone: level i+1's shape was already generated when this epoch started.
  function advanceLevel() {
    setFoundAcrossLevels((f) => f + foundCount)
    setLevelIdx((i) => i + 1)
    setFoundCount(0)
    setWrongIdx(null)
    setWrongHint(null)
  }
  // Shown on the final level's complete card. roundKey always bumps here:
  // it's the "which attempt is this" generation counter the onComplete
  // effect uses to fire again on a replay, independent of whether the
  // drawing itself changed.
  function restartEpoch() {
    setLevelIdx(0)
    setFoundCount(0)
    setWrongIdx(null)
    setWrongHint(null)
    setMistakes(0)
    setFoundAcrossLevels(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same drawing as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + foundAcrossLevels + foundCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const trail = points.slice(0, foundCount)
  const trailStr = trail.map((p) => `${p.x},${p.y}`).join(' ')
  const closedTrailStr = done && points.length > 0 ? `${trailStr} ${points[0].x},${points[0].y}` : trailStr

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
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Uní los puntos en orden</h2>
      </div>

      {!done && (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-2xl font-black text-slate-800">
            {labelFor(level, foundCount)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Tocá el que sigue</p>
            <p className="text-base font-semibold text-slate-500">
              Llevás {foundCount} de {points.length}
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(foundCount / points.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Scatter canvas */}
      {!done && (
        <div className="relative mx-auto mt-5 aspect-square w-full max-w-[380px] rounded-3xl border-2 border-slate-100 bg-slate-50/60">
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
            <polyline
              points={closedTrailStr}
              fill="none"
              stroke="#4CA52E"
              strokeWidth="1.2"
              strokeOpacity="0.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {points.map((p, i) => {
            const isFound = i < foundCount
            const isWrongFlash = wrongIdx === i
            return (
              <button
                key={i}
                type="button"
                disabled={isFound || done}
                onClick={() => handleTap(i)}
                aria-label={`Punto ${labelFor(level, i)}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className={[
                  'absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center',
                  'rounded-full border-2 text-base font-bold transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  isFound
                    ? 'border-tiam-green bg-white text-slate-700 ring-2 ring-tiam-green/30'
                    : isWrongFlash
                      ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-400 bg-white text-slate-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-tiam-blue/40 hover:shadow-md active:scale-95',
                ].join(' ')}
              >
                {labelFor(level, i)}
                {isFound && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {wrongHint && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{wrongHint}</p>}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            ¡Uniste los {points.length} puntos — completaste el {level.name.toLowerCase()}!
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
