import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Las diferencias" — a simultaneous visual-comparison / sustained-attention
 * task, área atención, día 23. Two versions of the same scene sit side by
 * side (or stacked — see LAYOUT below); they differ in exactly N spots.
 * Tap whichever item differs, in EITHER panel, to mark that difference
 * found in both.
 *
 * DIFFERENCE FROM QueCambio (día 27, also área atención): QueCambio is
 * SEQUENTIAL — study a board, it disappears, then a changed board appears
 * and you compare it against what you remember, a visual-WORKING-MEMORY
 * task. This game shows BOTH boards AT ONCE, side by side — nothing to
 * memorise, pure simultaneous comparison, no memory load. Same area,
 * deliberately different demand.
 *
 * WHY PROCEDURAL SVG: an image model can't produce two pictures differing
 * in exactly N controlled ways. A scene generated from a data structure (a
 * list of {kind, colour, size, position}) can — clone the list, mutate
 * exactly N items, and the differences are exact, countable, and each gets
 * a precise tappable hit area. See buildScenePair.
 *
 * THE EXACTLY-N INVARIANT: buildScenePair samples N distinct item ids
 * without replacement (so always exactly N — never fewer from a collision,
 * never more) and mutates ONLY those, each via exactly one of 4 perceptible
 * kinds — colour (swapped to a different PALETTE entry), size (moved a full
 * SIZE_PCT step), remove (dropped from the right panel, leaving a dashed
 * tappable ghost slot — an unreachable hit area would make that difference
 * unfindable), or move (shifted MOVE_RADIUS% of the cell, always well clear
 * of its original spot — see moveOffset). Every other item is copied by
 * value, unchanged, into the right scene, so the two scenes are IDENTICAL
 * outside the N mutated slots. Both panels render through the same
 * <ScenePanel>, just fed different item arrays — one rendering path, so an
 * unintended left/right drift is impossible.
 *
 * LAYOUT: panels stack VERTICALLY by default and go side-by-side only from
 * `sm:` (640px) up. A 375px phone gives ~335px of content width; split two
 * ways that's ~155px per panel, which cannot fit a 4-column grid of ≥44px
 * tap targets — so on a phone, stacking is the only option that keeps items
 * both legible and tappable. From `sm:` up, the modal that hosts every
 * challenge game caps at max-w-2xl (672px) (see DesafioPlayPage's day-card
 * modal), so a side-by-side split still leaves ~270-300px per panel —
 * comfortable for 4 columns of ≥44px cells (the grid uses
 * grid-cols-[repeat(4,minmax(44px,1fr))], which floors column width at
 * 44px regardless of viewport).
 *
 * Item position/size inside a cell is expressed as a PERCENTAGE of that
 * cell's own box, not raw pixels — see the reach-budget comment above
 * SIZE_PCT/AMBIENT_MAX/MOVE_RADIUS — so the "items never overlap" and "a
 * move is always perceptible" guarantees hold at any rendered cell size,
 * not just the breakpoints checked above.
 */

const TOTAL_ITEMS = 12 // 4 cols x 3 rows, same board size at every level — only N (differences) scales

type ItemKind = 'circulo' | 'estrella' | 'casa' | 'arbol' | 'nube' | 'flor' | 'pelota'
const KINDS: ItemKind[] = ['circulo', 'estrella', 'casa', 'arbol', 'nube', 'flor', 'pelota']
const KIND_LABEL: Record<ItemKind, string> = {
  circulo: 'círculo',
  estrella: 'estrella',
  casa: 'casa',
  arbol: 'árbol',
  nube: 'nube',
  flor: 'flor',
  pelota: 'pelota',
}

// Six strongly distinguishable hues (never two closely-related blues, etc.)
// so a 'color' mutation always reads as an obviously different colour.
const PALETTE = ['#1B6FC4', '#E8531E', '#4CA52E', '#7C3AED', '#DB2777', '#CA8A04']

type MutationKind = 'color' | 'size' | 'remove' | 'move'
const MUTATION_KINDS: MutationKind[] = ['color', 'size', 'remove', 'move']

type SizeIdx = 0 | 1 | 2
// Every item's visual reach from its OWN cell's center is
// icon-half-size + (jitter or move radius), all expressed as a PERCENT of
// the cell — so this budget holds at ANY rendered cell size. Worst case:
// SIZE_PCT[2]/2 (23) + MOVE_RADIUS (16) = 39, comfortably under the 50 that
// would reach the cell's edge — so two neighbouring items' icons can never
// overlap, regardless of level, mutation or breakpoint.
const SIZE_PCT: Record<SizeIdx, number> = { 0: 30, 1: 38, 2: 46 }
const AMBIENT_MAX = 5 // ambient per-item jitter radius (% of cell), for a loose-grid, not robotic, look
const MOVE_RADIUS = 16 // fixed radius (% of cell) for a 'move' mutation's new offset

interface SceneItem {
  id: number
  kind: ItemKind
  colorIdx: number
  sizeIdx: SizeIdx
  offsetX: number
  offsetY: number
  /** Only ever set on a RIGHT-panel copy — this slot's item was removed. */
  removed?: boolean
}

interface ScenePair {
  items: SceneItem[]
  rightItems: SceneItem[]
  diffIds: Set<number>
}

interface Level {
  n: number
  name: string
  diffs: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', diffs: 4 },
  { n: 2, name: 'Nivel 2', diffs: 5 },
  { n: 3, name: 'Nivel 3', diffs: 6 },
]
// Every round always resolves by genuinely finding ALL of its differences —
// there's no give-up/reveal shortcut — so totalAttempts is a flat constant,
// the same shape EncontraLaFiguraIgual uses for the same reason.
const TOTAL_DIFFS = LEVELS.reduce((sum, l) => sum + l.diffs, 0)

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
function otherIndices(current: number, length: number): number[] {
  const out: number[] = []
  for (let i = 0; i < length; i++) if (i !== current) out.push(i)
  return out
}
function randomOffset(maxMag: number): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2
  const mag = Math.random() * maxMag
  return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag }
}
// Guarantees the new offset lands clearly away from `old`: picking the
// OPPOSITE direction from the old jitter means the two radii ADD instead of
// partially cancelling (a random new angle could by chance land close to
// the old one and be nearly unnoticeable). When the old jitter is ~(0,0),
// any direction is equally "opposite", so a random one is used instead.
function moveOffset(oldX: number, oldY: number): { x: number; y: number } {
  const oldMag = Math.hypot(oldX, oldY)
  const angle = oldMag > 0.01 ? Math.atan2(oldY, oldX) + Math.PI : Math.random() * Math.PI * 2
  return { x: Math.cos(angle) * MOVE_RADIUS, y: Math.sin(angle) * MOVE_RADIUS }
}

function randomItem(id: number): SceneItem {
  const { x, y } = randomOffset(AMBIENT_MAX)
  return {
    id,
    kind: pickOne(KINDS),
    colorIdx: Math.floor(Math.random() * PALETTE.length),
    sizeIdx: Math.floor(Math.random() * 3) as SizeIdx,
    offsetX: x,
    offsetY: y,
  }
}

function buildScenePair(diffCount: number): ScenePair {
  const items = Array.from({ length: TOTAL_ITEMS }, (_, id) => randomItem(id))
  const diffIds = new Set(shuffle(items.map((it) => it.id)).slice(0, diffCount))
  const mutationById = new Map<number, MutationKind>()
  diffIds.forEach((id) => mutationById.set(id, pickOne(MUTATION_KINDS)))

  // Every non-selected item is copied UNCHANGED; every selected item is
  // mutated in exactly one dimension, and never back into the value it
  // started with (otherIndices excludes the current colour/size) — so the
  // scenes differ in EXACTLY `diffCount` items, no more, no less, and every
  // difference is one a player can actually perceive.
  const rightItems: SceneItem[] = items.map((item) => {
    const mut = mutationById.get(item.id)
    if (!mut) return { ...item }
    if (mut === 'remove') return { ...item, removed: true }
    if (mut === 'color') return { ...item, colorIdx: pickOne(otherIndices(item.colorIdx, PALETTE.length)) }
    if (mut === 'size') return { ...item, sizeIdx: pickOne(otherIndices(item.sizeIdx, 3)) as SizeIdx }
    const moved = moveOffset(item.offsetX, item.offsetY)
    return { ...item, offsetX: moved.x, offsetY: moved.y }
  })

  return { items, rightItems, diffIds }
}

function starPoints(outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const angle = (-90 + i * 36) * (Math.PI / 180)
    pts.push(`${(Math.cos(angle) * r).toFixed(1)},${(Math.sin(angle) * r).toFixed(1)}`)
  }
  return pts.join(' ')
}
const STAR_POINTS = starPoints(42, 17)
const PETAL_ANGLES = [0, 72, 144, 216, 288]

// Seven simple, clearly-distinct silhouettes, each centered on (0,0) inside
// a -50..50 viewBox (same convention EncontraLaFiguraIgual uses) — 'circulo'
// and 'pelota' are both round but the ball's seam lines keep them apart at
// a glance even before colour/size are considered.
function ItemIcon({ kind, color }: { kind: ItemKind; color: string }) {
  switch (kind) {
    case 'circulo':
      return (
        <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="0" cy="0" r="42" fill={color} />
        </svg>
      )
    case 'pelota':
      return (
        <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="0" cy="0" r="42" fill={color} />
          <path d="M -42 0 Q 0 -22 42 0" stroke="white" strokeWidth="5" fill="none" />
          <path d="M -42 0 Q 0 22 42 0" stroke="white" strokeWidth="5" fill="none" />
          <line x1="0" y1="-42" x2="0" y2="42" stroke="white" strokeWidth="5" />
        </svg>
      )
    case 'estrella':
      return (
        <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
          <polygon points={STAR_POINTS} fill={color} />
        </svg>
      )
    case 'casa':
      return (
        <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
          <polygon points="-30,44 -30,4 30,4 30,44" fill={color} />
          <polygon points="-38,4 0,-40 38,4" fill={color} />
        </svg>
      )
    case 'arbol':
      return (
        <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
          <rect x="-7" y="10" width="14" height="34" fill="#8B5E34" />
          <circle cx="0" cy="-8" r="34" fill={color} />
        </svg>
      )
    case 'nube':
      return (
        <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="-16" cy="2" r="20" fill={color} />
          <circle cx="14" cy="-8" r="26" fill={color} />
          <circle cx="34" cy="6" r="15" fill={color} />
          <rect x="-30" y="2" width="72" height="22" rx="11" fill={color} />
        </svg>
      )
    case 'flor':
      return (
        <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
          {PETAL_ANGLES.map((a) => (
            <circle
              key={a}
              cx={Math.cos((a * Math.PI) / 180) * 23}
              cy={Math.sin((a * Math.PI) / 180) * 23}
              r="17"
              fill={color}
            />
          ))}
          <circle cx="0" cy="0" r="11" fill="#FCD34D" />
        </svg>
      )
    default:
      return null
  }
}

// Renders ONE panel's grid. Called twice with different `cells` (the left
// scene, then the right one) — same function, same JSX, so left and right
// can never render differently except through the data they're given.
function ScenePanel({
  panelId,
  cells,
  found,
  wrongKey,
  onTap,
}: {
  panelId: 'left' | 'right'
  cells: SceneItem[]
  found: Set<number>
  wrongKey: string | null
  onTap: (panelId: 'left' | 'right', id: number) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(4,minmax(44px,1fr))] gap-2 sm:gap-3">
      {cells.map((item) => {
        const isFound = found.has(item.id)
        const isWrong = wrongKey === `${panelId}:${item.id}`
        const isEmpty = !!item.removed
        return (
          <button
            key={item.id}
            type="button"
            disabled={isFound}
            onClick={() => onTap(panelId, item.id)}
            aria-label={isEmpty ? 'lugar vacío' : KIND_LABEL[item.kind]}
            aria-pressed={isFound}
            className={[
              'relative aspect-square rounded-xl border-2 transition',
              'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
              isFound
                ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                : isWrong
                  ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-400 bg-white'
                  : isEmpty
                    ? 'border-dashed border-slate-300 bg-slate-50/50'
                    : 'border-slate-200 bg-white hover:border-tiam-blue/30',
            ].join(' ')}
          >
            {!isEmpty && (
              <div
                className="absolute"
                style={{
                  left: `${50 + item.offsetX}%`,
                  top: `${50 + item.offsetY}%`,
                  width: `${SIZE_PCT[item.sizeIdx]}%`,
                  height: `${SIZE_PCT[item.sizeIdx]}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <ItemIcon kind={item.kind} color={PALETTE[item.colorIdx]} />
              </div>
            )}
            {isFound && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const PRAISE = ['¡Muy bien, qué buen ojo!', '¡Así se hace!', '¡Excelente, no se te escapó nada!', '¡Perfecto!']
const HINTS = [
  'Ese está igual en los dos cuadros — probá con otro.',
  'Casi. Comparen con calma, cuadro por cuadro.',
  'Ahí no hay diferencia — fijate bien en el color, el tamaño y el lugar de cada cosa.',
]

export function LasDiferencias({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // All 3 levels' scene pairs are built ONCE at mount (the "epoch" pattern
  // QueCambio also uses) so "Repetir" always hands back the exact same
  // scenes — deterministic, not a fresh random pair.
  const [epochScenes] = useState(() => LEVELS.map((lvl) => buildScenePair(lvl.diffs)))
  const level = LEVELS[levelIdx]
  const scene = epochScenes[levelIdx]
  const target = scene.diffIds.size

  const [found, setFound] = useState<Set<number>>(new Set())
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3, zeroed only on a genuine day restart
  // (wrap from level 3 back to level 1) — see nextLevel below.
  const [mistakes, setMistakes] = useState(0)

  const done = found.size >= target

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function tap(panelId: 'left' | 'right', id: number) {
    if (done || found.has(id)) return
    if (scene.diffIds.has(id)) {
      setFound((prev) => new Set(prev).add(id))
      setHint(null)
      return
    }
    setMistakes((m) => m + 1)
    const key = `${panelId}:${id}`
    setWrongKey(key)
    setHint(pickOne(HINTS))
    window.setTimeout(() => setWrongKey((w) => (w === key ? null : w)), 450)
  }

  // Resets happen HERE, synchronously with the level change — never in a
  // useEffect keyed on levelIdx. An effect-based reset lags one render
  // behind, so `done` (derived straight from `found`) would still read the
  // previous level's stale-true value on the very render that arrives at
  // the new level, firing onComplete with garbage — same trap documented in
  // ElVuelto/EncontraLaFiguraIgual/SumaHastaDiez.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setFound(new Set())
    setWrongKey(null)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — a plain level advance never does.
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when level 3's last difference is found. A full
  // day restart gets a new roundKey (nextLevel's wrap branch), so a genuine
  // replay reports again; re-rendering while already done on level 3 does
  // not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_DIFFS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá las diferencias</h2>
            <p className="mt-2 text-base text-slate-500">
              Los dos cuadros son casi iguales. Tocá lo que sea distinto entre uno y otro.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Encontraste {found.size} de {target}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(found.size / target) * 100}%` }}
              />
            </div>
          </>
        )}
        {done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¡Encontraste las {target} diferencias!</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Two panels — stacked on narrow screens, side by side from `sm:` up.
          See the file-header LAYOUT note for the reasoning. */}
      {!done && (
        <>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 rounded-2xl border-2 border-slate-100 bg-white p-3" role="group" aria-label="Cuadro 1">
              <ScenePanel panelId="left" cells={scene.items} found={found} wrongKey={wrongKey} onTap={tap} />
            </div>
            <div className="flex-1 rounded-2xl border-2 border-slate-100 bg-white p-3" role="group" aria-label="Cuadro 2">
              <ScenePanel panelId="right" cells={scene.rightItems} found={found} wrongKey={wrongKey} onTap={tap} />
            </div>
          </div>

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">¡Completaste el {level.name.toLowerCase()}!</p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
