import { useEffect, useRef, useState } from 'react'
import {
  Star, Heart, Sun, Moon, Cloud,
  Cat, Dog, Fish, Bird, Rabbit, Flower2, Leaf,
  Circle, Square, Triangle, Pentagon, Hexagon, Octagon, Diamond,
  RotateCcw, ArrowRight, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "No está repetida" — a visual-search / feature-discrimination mini-game.
 *
 * Every figure on the board appears in a matching SET (a pair, or — at level
 * 3 — sometimes a trio) except exactly ONE figure, which has no match at
 * all. Tap the unmatched one. Icon-based (lucide-react), no illustration
 * needed: each figure is drawn live and randomly rotated/mirrored per
 * INSTANCE so the task is genuinely "same shape, any pose" rather than
 * "same pixels" — same precedent EncontraLaFiguraIgual set for live-rendered
 * shapes over fixed art when the exact geometry has to be controlled.
 *
 * Difficulty ramps via three independent levers:
 *   L1 few, very distinct icons (star/heart/sun/moon/cloud), right-angle
 *      rotations only, 4 pairs + 1 lone.
 *   L2 more icon types, still visually distinct (animals/nature), 6 pairs +
 *      1 lone — the added lever here is pure COUNT (more to scan).
 *   L3 abstract geometric shapes that are easy to mistake for each other at
 *      a glance (pentagon/hexagon/octagon), arbitrary-degree rotation (not
 *      just 90°), and — per the brief's own "pairs/SETS" wording — some
 *      shapes appear in TRIOS, not just pairs, so spotting "the lone one"
 *      takes an actual count, not a quick visual pair-off.
 *
 * Color is fixed PER ICON TYPE (never per instance) — it's a helpful,
 * consistent identity cue, not a red herring. Randomizing color per instance
 * would let two genuine copies of the same figure look like they "don't
 * match," which is confusing rather than harder for this audience. Rotation
 * and mirroring are the only per-instance variation, and neither changes
 * what a shape actually IS, so they add difficulty without adding unfairness.
 */

interface IconDef {
  id: string
  label: string
  Icon: LucideIcon
  color: string
}

// Palette reuses brand tokens (tiam-blue/orange/green/blue-dark) plus the
// same praxias/agnosias accent hexes DesafioPlayPage's AREA_META already
// uses elsewhere, plus one amber — seven distinct, legible colors, enough
// for the largest pool (L2/L3) with room to spare.
const L1_POOL: IconDef[] = [
  { id: 'star', label: 'estrella', Icon: Star, color: '#E8531E' },
  { id: 'heart', label: 'corazón', Icon: Heart, color: '#DB2777' },
  { id: 'sun', label: 'sol', Icon: Sun, color: '#D97706' },
  { id: 'moon', label: 'luna', Icon: Moon, color: '#1B6FC4' },
  { id: 'cloud', label: 'nube', Icon: Cloud, color: '#5A6B82' },
]
const L2_POOL: IconDef[] = [
  { id: 'cat', label: 'gato', Icon: Cat, color: '#E8531E' },
  { id: 'dog', label: 'perro', Icon: Dog, color: '#15436F' },
  { id: 'fish', label: 'pez', Icon: Fish, color: '#1B6FC4' },
  { id: 'bird', label: 'pájaro', Icon: Bird, color: '#D97706' },
  { id: 'rabbit', label: 'conejo', Icon: Rabbit, color: '#5A6B82' },
  { id: 'flower', label: 'flor', Icon: Flower2, color: '#DB2777' },
  { id: 'leaf', label: 'hoja', Icon: Leaf, color: '#4CA52E' },
]
const L3_POOL: IconDef[] = [
  { id: 'circle', label: 'círculo', Icon: Circle, color: '#1B6FC4' },
  { id: 'square', label: 'cuadrado', Icon: Square, color: '#E8531E' },
  { id: 'triangle', label: 'triángulo', Icon: Triangle, color: '#4CA52E' },
  { id: 'pentagon', label: 'pentágono', Icon: Pentagon, color: '#7C3AED' },
  { id: 'hexagon', label: 'hexágono', Icon: Hexagon, color: '#15436F' },
  { id: 'octagon', label: 'octágono', Icon: Octagon, color: '#DB2777' },
  { id: 'diamond', label: 'rombo', Icon: Diamond, color: '#D97706' },
]
// Parallel to L3_POOL: 4 trios + 2 pairs + 1 lone (the 7th slot is always
// overridden to 1 at build time) — "pairs/SETS of matching duplicates" per
// the brief, not just pairs, which is what makes L3 harder than a bigger L2.
const L3_NORMAL_COUNTS = [3, 3, 3, 3, 2, 2, 2]

interface Level {
  n: number
  name: string
  pool: IconDef[]
  normalCounts: number[] // parallel to pool; overridden to 1 for the lone index
  rounds: number
  rotationStep: number // degrees; smaller step = finer, harder-to-eyeball angles
  cols: string
  tileClass: string
  iconClass: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    pool: L1_POOL,
    normalCounts: L1_POOL.map(() => 2),
    rounds: 2,
    rotationStep: 90,
    cols: 'grid-cols-3 gap-3 sm:gap-4',
    tileClass: 'h-20 sm:h-24',
    iconClass: 'h-9 w-9 sm:h-11 sm:w-11',
  },
  {
    n: 2,
    name: 'Nivel 2',
    pool: L2_POOL,
    normalCounts: L2_POOL.map(() => 2),
    rounds: 3,
    rotationStep: 90,
    cols: 'grid-cols-4 gap-2.5 sm:grid-cols-5 sm:gap-3',
    tileClass: 'h-16 sm:h-20',
    iconClass: 'h-7 w-7 sm:h-9 sm:w-9',
  },
  {
    n: 3,
    name: 'Nivel 3',
    pool: L3_POOL,
    normalCounts: L3_NORMAL_COUNTS,
    rounds: 3,
    rotationStep: 15,
    cols: 'grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6 sm:gap-3',
    tileClass: 'h-14 sm:h-18',
    iconClass: 'h-6 w-6 sm:h-8 sm:w-8',
  },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Tile {
  key: string
  id: string
  label: string
  Icon: LucideIcon
  color: string
  rotation: number
  mirrored: boolean
}

function randomRotation(step: number): number {
  const steps = 360 / step
  return Math.floor(Math.random() * steps) * step
}

interface RoundData {
  tiles: Tile[]
  loneId: string
}

function buildRound(level: Level): RoundData {
  const loneIdx = Math.floor(Math.random() * level.pool.length)
  const tiles: Tile[] = []
  level.pool.forEach((def, i) => {
    const count = i === loneIdx ? 1 : level.normalCounts[i]
    for (let c = 0; c < count; c++) {
      tiles.push({
        key: `${def.id}-${c}`,
        id: def.id,
        label: def.label,
        Icon: def.Icon,
        color: def.color,
        rotation: randomRotation(level.rotationStep),
        mirrored: Math.random() < 0.5,
      })
    }
  })
  return { tiles: shuffle(tiles), loneId: level.pool[loneIdx].id }
}

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena atención!']

export function NoEstaRepetida({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Rounds for the WHOLE epoch (all 3 levels), generated once — at mount —
  // never re-rolled just by revisiting a level, so "Repetir" hands back the
  // exact same boards.
  const [epochRounds] = useState(() =>
    LEVELS.map((lvl) => Array.from({ length: lvl.rounds }, () => buildRound(lvl))),
  )
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [found, setFound] = useState(false)
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Mistakes, accumulated across levels 1→2→3 and only zeroed by
  // restartEpoch (a genuine day restart).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
  }, [done])

  function handleTap(tile: Tile) {
    if (!round || found) return
    if (tile.id === round.loneId) {
      setFound(true)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setFound(false)
      }, 700)
      return
    }
    setWrongKey(tile.key)
    setMistakes((m) => m + 1)
    window.setTimeout(() => setWrongKey((w) => (w === tile.key ? null : w)), 500)
  }

  // Resets happen synchronously HERE, with the level/round change itself —
  // see every other game in this folder for why a separate effect can't
  // safely own this (it lags one render behind and lets `done` read the
  // previous level's stale true right as levelIdx reaches the last level).

  // "Siguiente nivel" — advance within the SAME attempt. epochRounds is left
  // alone: every level's boards were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setFound(false)
    setWrongKey(null)
  }

  // Called by restartSame on the final level's complete card (only ever
  // shown once level 3 is done, so always a genuine day restart — zero
  // the mistake accumulator either way). roundKey always bumps here: it's
  // the "which attempt is this" generation counter the onComplete effect
  // uses to fire again on a replay, independent of whether the boards
  // themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setFound(false)
    setWrongKey(null)
    setMistakes(0)
  }
  // "Repetir" — same boards as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }

  const totalRoundsAllLevels = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + totalRoundsAllLevels })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá la única figura que no se repite</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Board */}
      {!done && round && (
        <div className={`mx-auto mt-5 grid max-w-lg ${level.cols}`}>
          {round.tiles.map((tile) => {
            const isFoundTile = found && tile.id === round.loneId
            const isWrong = wrongKey === tile.key
            const Icon = tile.Icon
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => handleTap(tile)}
                disabled={found}
                aria-label={tile.label}
                className={[
                  'relative flex items-center justify-center rounded-2xl border-2 bg-white transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  level.tileClass,
                  isFoundTile
                    ? 'border-tiam-green ring-2 ring-tiam-green/30'
                    : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300' : '',
                ].join(' ')}
              >
                <Icon
                  className={level.iconClass}
                  style={{ color: tile.color, transform: `rotate(${tile.rotation}deg) scaleX(${tile.mirrored ? -1 : 1})` }}
                  strokeWidth={2}
                />
              </button>
            )
          })}
        </div>
      )}

      {/* Wrong-tap hint */}
      {!done && wrongKey !== null && (
        <p className="mt-4 text-center text-base font-medium text-slate-500">Esa tiene pareja en algún lado, ¡seguí mirando! 🙂</p>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">¡Encontraste todas — completaste el {level.name.toLowerCase()}!</p>
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
