import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Buscá los rojos" — a visual-search / selective-attention mini-game.
 *
 * One engine, three difficulty levels (grounded in the design research):
 *   L1 feature search (red pops out among far-hue distractors)
 *   L2 similarity      (add orange/pink distractors — red no longer pops)
 *   L3 conjunction     ("buscá las FRUTAS rojas" — combine colour AND category)
 *
 * No timer, ever (time pressure hurts older adults). Warm, non-punitive feedback.
 * Objects render as Flux illustrations when present; otherwise a colour disc so the
 * game is fully playable/testable before the art lands.
 */

type ObjColor = 'red' | 'orange' | 'pink' | 'yellow' | 'green' | 'violet' | 'blue' | 'brown'

interface GameObject {
  id: string
  label: string
  color: ObjColor
  fruit: boolean
}

const COLOR_HEX: Record<ObjColor, string> = {
  red: '#E43D3D',
  orange: '#F2994A',
  pink: '#EC6FA3',
  yellow: '#F5C542',
  green: '#4CA52E',
  blue: '#3B82C4',
  violet: '#8E5FC2',
  brown: '#7B5236',
}

const OBJECTS: GameObject[] = [
  // ── Red (13): 5 unambiguous fruits + 8 red non-fruits ────────────────
  { id: 'manzana-roja', label: 'manzana roja', color: 'red', fruit: true },
  { id: 'frutilla', label: 'frutilla', color: 'red', fruit: true },
  { id: 'cereza', label: 'cerezas', color: 'red', fruit: true },
  { id: 'granada', label: 'granada', color: 'red', fruit: true },
  { id: 'sandia', label: 'sandía', color: 'red', fruit: true },
  { id: 'tomate', label: 'tomate', color: 'red', fruit: false },
  { id: 'pimiento', label: 'pimiento rojo', color: 'red', fruit: false },
  { id: 'rosa', label: 'rosa', color: 'red', fruit: false },
  { id: 'amapola', label: 'amapola', color: 'red', fruit: false },
  { id: 'mariquita', label: 'vaquita de San Antonio', color: 'red', fruit: false },
  { id: 'camion-bomberos', label: 'camión de bomberos', color: 'red', fruit: false },
  { id: 'corazon', label: 'corazón', color: 'red', fruit: false },
  { id: 'labios', label: 'labios', color: 'red', fruit: false },
  // ── Orange (4) ───────────────────────────────────────────────────────
  { id: 'naranja', label: 'naranja', color: 'orange', fruit: true },
  { id: 'mandarina', label: 'mandarina', color: 'orange', fruit: true },
  { id: 'zanahoria', label: 'zanahoria', color: 'orange', fruit: false },
  { id: 'pelota-basquet', label: 'pelota de básquet', color: 'orange', fruit: false },
  // ── Pink (4) ─────────────────────────────────────────────────────────
  { id: 'flamenco', label: 'flamenco', color: 'pink', fruit: false },
  { id: 'chicle', label: 'chicle', color: 'pink', fruit: false },
  { id: 'cerdito', label: 'cerdito', color: 'pink', fruit: false },
  { id: 'flor-cerezo', label: 'flor de cerezo', color: 'pink', fruit: false },
  // ── Far hues (7) ─────────────────────────────────────────────────────
  { id: 'banana', label: 'banana', color: 'yellow', fruit: true },
  { id: 'limon', label: 'limón', color: 'yellow', fruit: true },
  { id: 'hoja-verde', label: 'hoja verde', color: 'green', fruit: false },
  { id: 'manzana-verde', label: 'manzana verde', color: 'green', fruit: true },
  { id: 'uva', label: 'uvas', color: 'violet', fruit: true },
  { id: 'jean', label: 'jean', color: 'blue', fruit: false },
  { id: 'taza-cafe', label: 'taza de café', color: 'brown', fruit: false },
  // ── More far-hue distractors (batch 2) — fill the grid + vary the rounds ──
  { id: 'pera', label: 'pera', color: 'green', fruit: true },
  { id: 'rana', label: 'rana', color: 'green', fruit: false },
  { id: 'brocoli', label: 'brócoli', color: 'green', fruit: false },
  { id: 'arandanos', label: 'arándanos', color: 'blue', fruit: true },
  { id: 'ciruela', label: 'ciruela', color: 'violet', fruit: true },
  { id: 'berenjena', label: 'berenjena', color: 'violet', fruit: false },
  { id: 'globo-azul', label: 'globo azul', color: 'blue', fruit: false },
  { id: 'pollito', label: 'pollito', color: 'yellow', fruit: false },
  { id: 'pina', label: 'ananá', color: 'yellow', fruit: true },
  { id: 'oso', label: 'oso de peluche', color: 'brown', fruit: false },
  // ── More reds (batch 2) — variety for levels 2 & 3 ──
  { id: 'frambuesa', label: 'frambuesa', color: 'red', fruit: true },
  { id: 'globo-rojo', label: 'globo rojo', color: 'red', fruit: false },
  { id: 'cangrejo', label: 'cangrejo', color: 'red', fruit: false },
]

const REDS = OBJECTS.filter((o) => o.color === 'red')
const RED_FRUITS = REDS.filter((o) => o.fruit)
const RED_NONFRUITS = REDS.filter((o) => !o.fruit)
const FAR = OBJECTS.filter((o) => ['yellow', 'green', 'violet', 'blue', 'brown'].includes(o.color))
const ORANGE = OBJECTS.filter((o) => o.color === 'orange')
const PINK = OBJECTS.filter((o) => o.color === 'pink')
// Level-3 pools: fruits that are NOT red (must be rejected), and far-hue non-fruits (easy rejects).
const NONRED_FRUITS_FAR = OBJECTS.filter((o) => o.fruit && o.color !== 'red' && o.color !== 'orange')
const FAR_NONFRUIT = FAR.filter((o) => !o.fruit)

// Illustrations (Flux) — matched by id. Falls back to a colour disc if absent.
const IMAGES = import.meta.glob('../../../assets/desafio/games/buscar-rojos/*.webp', {
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
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)

interface Level {
  n: number
  name: string
  instruction: string
  isTarget: (o: GameObject) => boolean
  build: () => GameObject[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    instruction: 'Tocá todos los objetos ROJOS',
    isTarget: (o) => o.color === 'red',
    build: () => [...pick(REDS, 5), ...pick(FAR, 10)], // 15 → fills the 5-col grid
  },
  {
    n: 2,
    name: 'Nivel 2',
    instruction: 'Tocá todos los ROJOS (¡ojo con los parecidos!)',
    isTarget: (o) => o.color === 'red',
    // 24 → exact rows at 3-col (mobile) AND 4-col (tablet); 1 empty cell at 5-col (desktop)
    build: () => [...pick(REDS, 10), ...pick(ORANGE, 4), ...pick(PINK, 4), ...pick(FAR, 6)],
  },
  {
    n: 3,
    name: 'Nivel 3',
    instruction: 'Tocá solo las FRUTAS rojas',
    isTarget: (o) => o.color === 'red' && o.fruit,
    // 36 → divisible by 3 (12 rows at 3-col mobile grid)
    build: () => [
      ...RED_FRUITS, // targets — every red fruit (6)
      ...pick(RED_NONFRUITS, 10), // red but NOT fruit — the hard rejects (full pool)
      ...pick(NONRED_FRUITS_FAR, 8), // fruit but not red — also reject (full pool)
      ...pick(ORANGE, 4), ...pick(PINK, 4), // near-colour rejects
      ...pick(FAR_NONFRUIT, 4), // easy far rejects
    ],
  },
]

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué atención!']

export function BuscarLosRojos({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // A fresh, shuffled round whenever the level or roundKey changes.
  const board = useMemo(
    () => shuffle(level.build()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const targetIds = useMemo(
    () => new Set(board.filter(level.isTarget).map((o) => o.id)),
    [board, level],
  )

  const [found, setFound] = useState<Set<string>>(new Set())
  const [wrongId, setWrongId] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Mistakes + correct finds, accumulated across levels 1→2→3 and only
  // zeroed on a genuine day restart (wrap from level 3 back to level 1) —
  // see nextLevel's isWrap branch below.
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)

  const done = found.size === targetIds.size && targetIds.size > 0

  const reset = useCallback(() => {
    setFound(new Set())
    setWrongId(null)
  }, [])

  const handleTap = useCallback(
    (o: GameObject, cellKey: string) => {
      if (targetIds.has(o.id)) {
        // Functional updater so quick successive taps each build on the latest state
        // (a plain `new Set(found)` closes over a stale value and drops fast taps).
        setFound((prev) => {
          if (prev.has(cellKey)) return prev
          const next = new Set(prev)
          next.add(cellKey)
          return next
        })
      } else {
        setWrongId(cellKey)
        setMistakes((m) => m + 1)
        window.setTimeout(() => setWrongId((w) => (w === cellKey ? null : w)), 500)
      }
    },
    [targetIds],
  )

  // Pick a fresh praise line the moment the round is completed.
  useEffect(() => {
    if (targetIds.size > 0 && found.size === targetIds.size) {
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    }
  }, [found, targetIds])

  // isWrap resets happen synchronously HERE, in the same handler that
  // changes levelIdx/roundKey — not in a separate effect keyed on them. An
  // effect only catches up one tick after levelIdx changes, so `done`
  // (derived straight from `found`/`targetIds`) would read the previous
  // level's stale, still-true completion state on the very render that just
  // arrived at the new level, firing onComplete instantly with garbage
  // before the player has touched anything.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setFoundAcrossLevels((f) => f + found.size)
    reset()
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulators — replaying a round must NOT, even on level 1.
    if (isWrap) {
      setMistakes(0)
      setFoundAcrossLevels(0)
    }
  }
  function replay() {
    reset()
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey when level 3 is completed. A full day restart
  // (the wrap to level 1) gets a new roundKey via nextLevel above, so a
  // genuine replay of the whole day reports again; re-rendering while still
  // done on level 3 does not fire twice. totalAttempts = accumulated
  // mistakes + every object found across levels 1–3 (foundAcrossLevels
  // covers 1–2, found.size covers the current/last level).
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + foundAcrossLevels + found.size })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          Atención · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{level.instruction}</h2>
        <p className="mt-2 text-base font-semibold text-slate-500">
          Encontraste {found.size} de {targetIds.size}
        </p>
        <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
            style={{ width: `${targetIds.size ? (found.size / targetIds.size) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Board */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
        {board.map((o, i) => {
          const cellKey = `${o.id}-${i}`
          const isFound = found.has(cellKey)
          const isWrong = wrongId === cellKey
          const img = imgFor(o.id)
          return (
            <button
              key={cellKey}
              type="button"
              onClick={() => handleTap(o, cellKey)}
              aria-label={o.label}
              aria-pressed={isFound}
              className={[
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 bg-white p-2 transition',
                'min-h-[64px] focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                isFound
                  ? 'border-tiam-green ring-2 ring-tiam-green/30'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-red-300' : '',
              ].join(' ')}
            >
              {img ? (
                <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />
              ) : (
                <span
                  className="h-2/3 w-2/3 rounded-full"
                  style={{ backgroundColor: COLOR_HEX[o.color] }}
                  aria-hidden
                />
              )}
              {isFound && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Wrong-tap hint */}
      {wrongId && !done && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">
          Ese no es {level.n === 3 ? 'una fruta roja' : 'rojo'}, ¡probá con otro! 🙂
        </p>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste las {targetIds.size} — ¡completaste el {level.name.toLowerCase()}!
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
              Jugar esta ronda otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
