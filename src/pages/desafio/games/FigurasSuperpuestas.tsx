import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Figuras superpuestas +" — día 30 (Mes 2), agnosias, cierre del mes. Same
 * Poppelreuter-plate mechanic as día 27's "¿Cuántos hay?" (CuantosHay.tsx) —
 * contá cuántas figuras hay de cada tipo entre las que se superponen — with
 * a NEW object set (none of these 4-6 ids appear in that day's 18-object
 * roster) and a second phase added on top, per the "+" in the title:
 * after counting, a recognition-memory check — tap only the object TYPES
 * that were actually part of this lámina, among a larger set that also
 * includes types that never appeared.
 *
 * Phase 1 (contar) is a near-verbatim reuse of CuantosHay's approach: unfilled
 * CONTOUR line art so `mix-blend-multiply` lets shapes cross without one
 * occluding another, and placements are PRE-AUTHORED offline (never computed
 * at runtime) — here via a small constrained-random Python script instead of
 * hand-eyeballing, enforcing the same three rules CuantosHay documents:
 * every instance fully inside the canvas, even coverage, and same-type
 * instances kept well apart. Reuses the EXISTING `contornos/` asset library
 * (a superset of que-se-esconde/'s ids) — no new art needed.
 *
 * Phase 2 (repaso) reuses QueHayEnLaMesa's recognition grading language
 * (hit=green check / missed=blue eye / false-positive=grey minus, never red).
 * `rana` is a deliberate "universal foil" — it never appears as a counted
 * type in ANY of the 3 levels below, so it's always a safe, meaningful foil.
 *
 * Both phases run per level (one lámina each), matching this app's
 * 3-independent-levels shape. Levels pick one of 2 pre-authored lámina
 * variants at random once per epoch (a full 3-level day attempt), for
 * replay variety without runtime layout — see epochChoices below.
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
}
interface Level {
  n: number
  name: string
  compositions: Composition[]
  foils: string[]
}

const LABELS: Record<string, string> = {
  gato: 'gatos',
  pato: 'patos',
  oso: 'ositos',
  tortuga: 'tortugas',
  cacerola: 'cacerolas',
  llaves: 'llaveros',
  mate: 'mates',
  silla: 'sillas',
  paraguas: 'paraguas',
  'camion-bomberos': 'camiones de bomberos',
  casa: 'casas',
  flamenco: 'flamencos',
  guitarra: 'guitarras',
  sol: 'soles',
  pez: 'peces',
  rana: 'ranas',
}

// Generated offline (constrained-random Python script, fixed seed, verified
// pairwise same-type distance + canvas margins before being pasted in here)
// — never computed at runtime. See header for the three placement rules.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    foils: ['rana', 'mate', 'silla'],
    compositions: [
      { items: [
        { objectId: 'gato', xPct: 17.5, yPct: 22.5, scale: 0.374, rotationDeg: -80 },
        { objectId: 'gato', xPct: 80.0, yPct: 37.8, scale: 0.465, rotationDeg: -80 },
        { objectId: 'gato', xPct: 53.9, yPct: 33.1, scale: 0.457, rotationDeg: -50 },
        { objectId: 'pato', xPct: 57.0, yPct: 58.2, scale: 0.439, rotationDeg: 175 },
        { objectId: 'pato', xPct: 81.5, yPct: 23.6, scale: 0.468, rotationDeg: 50 },
        { objectId: 'pato', xPct: 20.9, yPct: 58.1, scale: 0.36, rotationDeg: 175 },
        { objectId: 'oso', xPct: 28.4, yPct: 37.6, scale: 0.499, rotationDeg: 175 },
        { objectId: 'oso', xPct: 66.4, yPct: 29.4, scale: 0.391, rotationDeg: 50 },
        { objectId: 'oso', xPct: 85.9, yPct: 75.2, scale: 0.408, rotationDeg: 25 },
        { objectId: 'tortuga', xPct: 64.7, yPct: 64.1, scale: 0.429, rotationDeg: 80 },
        { objectId: 'tortuga', xPct: 29.4, yPct: 22.6, scale: 0.432, rotationDeg: -50 },
        { objectId: 'tortuga', xPct: 35.7, yPct: 60.4, scale: 0.465, rotationDeg: -25 },
      ] },
      { items: [
        { objectId: 'gato', xPct: 56.7, yPct: 64.1, scale: 0.364, rotationDeg: 50 },
        { objectId: 'gato', xPct: 70.2, yPct: 18.8, scale: 0.38, rotationDeg: 175 },
        { objectId: 'gato', xPct: 22.3, yPct: 43.5, scale: 0.476, rotationDeg: 0 },
        { objectId: 'pato', xPct: 83.6, yPct: 72.5, scale: 0.445, rotationDeg: 175 },
        { objectId: 'pato', xPct: 25.9, yPct: 77.1, scale: 0.367, rotationDeg: 50 },
        { objectId: 'pato', xPct: 82.4, yPct: 30.4, scale: 0.439, rotationDeg: 0 },
        { objectId: 'oso', xPct: 30.2, yPct: 57.6, scale: 0.412, rotationDeg: 50 },
        { objectId: 'oso', xPct: 25.3, yPct: 18.4, scale: 0.433, rotationDeg: 80 },
        { objectId: 'oso', xPct: 72.3, yPct: 61.1, scale: 0.411, rotationDeg: 205 },
        { objectId: 'tortuga', xPct: 35.6, yPct: 18.8, scale: 0.485, rotationDeg: 80 },
        { objectId: 'tortuga', xPct: 13.7, yPct: 63.6, scale: 0.372, rotationDeg: -50 },
        { objectId: 'tortuga', xPct: 43.1, yPct: 73.1, scale: 0.417, rotationDeg: 50 },
      ] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    foils: ['rana', 'gato', 'camion-bomberos', 'sol'],
    compositions: [
      { items: [
        { objectId: 'cacerola', xPct: 32.3, yPct: 47.4, scale: 0.458, rotationDeg: 175 },
        { objectId: 'cacerola', xPct: 56.0, yPct: 70.2, scale: 0.433, rotationDeg: -50 },
        { objectId: 'cacerola', xPct: 84.6, yPct: 24.6, scale: 0.388, rotationDeg: 25 },
        { objectId: 'llaves', xPct: 58.2, yPct: 30.8, scale: 0.446, rotationDeg: 205 },
        { objectId: 'llaves', xPct: 17.4, yPct: 39.6, scale: 0.349, rotationDeg: -25 },
        { objectId: 'llaves', xPct: 86.7, yPct: 78.4, scale: 0.371, rotationDeg: -25 },
        { objectId: 'mate', xPct: 29.0, yPct: 66.7, scale: 0.362, rotationDeg: -130 },
        { objectId: 'mate', xPct: 74.1, yPct: 33.9, scale: 0.475, rotationDeg: 0 },
        { objectId: 'mate', xPct: 66.5, yPct: 71.7, scale: 0.44, rotationDeg: -25 },
        { objectId: 'silla', xPct: 86.5, yPct: 57.0, scale: 0.413, rotationDeg: 205 },
        { objectId: 'silla', xPct: 46.7, yPct: 41.1, scale: 0.358, rotationDeg: -25 },
        { objectId: 'silla', xPct: 18.5, yPct: 77.2, scale: 0.413, rotationDeg: 130 },
        { objectId: 'paraguas', xPct: 29.1, yPct: 29.9, scale: 0.409, rotationDeg: 205 },
        { objectId: 'paraguas', xPct: 78.5, yPct: 68.7, scale: 0.37, rotationDeg: 0 },
        { objectId: 'paraguas', xPct: 39.3, yPct: 69.0, scale: 0.486, rotationDeg: 175 },
      ] },
      { items: [
        { objectId: 'cacerola', xPct: 33.3, yPct: 21.3, scale: 0.447, rotationDeg: -130 },
        { objectId: 'cacerola', xPct: 40.3, yPct: 75.4, scale: 0.447, rotationDeg: -130 },
        { objectId: 'cacerola', xPct: 79.2, yPct: 37.0, scale: 0.431, rotationDeg: 50 },
        { objectId: 'llaves', xPct: 54.6, yPct: 72.2, scale: 0.444, rotationDeg: 50 },
        { objectId: 'llaves', xPct: 29.9, yPct: 44.7, scale: 0.473, rotationDeg: 0 },
        { objectId: 'llaves', xPct: 83.3, yPct: 65.2, scale: 0.419, rotationDeg: -25 },
        { objectId: 'mate', xPct: 72.4, yPct: 77.3, scale: 0.479, rotationDeg: 25 },
        { objectId: 'mate', xPct: 27.2, yPct: 58.3, scale: 0.474, rotationDeg: 50 },
        { objectId: 'mate', xPct: 87.1, yPct: 47.3, scale: 0.462, rotationDeg: 80 },
        { objectId: 'silla', xPct: 29.1, yPct: 78.1, scale: 0.41, rotationDeg: -80 },
        { objectId: 'silla', xPct: 63.4, yPct: 26.3, scale: 0.494, rotationDeg: 80 },
        { objectId: 'silla', xPct: 49.7, yPct: 58.0, scale: 0.411, rotationDeg: -25 },
        { objectId: 'paraguas', xPct: 49.3, yPct: 24.7, scale: 0.395, rotationDeg: -25 },
        { objectId: 'paraguas', xPct: 19.5, yPct: 73.6, scale: 0.484, rotationDeg: 175 },
        { objectId: 'paraguas', xPct: 63.3, yPct: 58.3, scale: 0.407, rotationDeg: 50 },
      ] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    foils: ['rana', 'llaves', 'oso', 'mate', 'pato'],
    compositions: [
      { items: [
        { objectId: 'camion-bomberos', xPct: 38.6, yPct: 62.7, scale: 0.419, rotationDeg: 25 },
        { objectId: 'camion-bomberos', xPct: 25.5, yPct: 23.1, scale: 0.487, rotationDeg: 0 },
        { objectId: 'camion-bomberos', xPct: 70.4, yPct: 35.3, scale: 0.451, rotationDeg: 0 },
        { objectId: 'casa', xPct: 88.0, yPct: 18.6, scale: 0.379, rotationDeg: 205 },
        { objectId: 'casa', xPct: 27.2, yPct: 78.9, scale: 0.349, rotationDeg: -130 },
        { objectId: 'casa', xPct: 40.9, yPct: 47.1, scale: 0.398, rotationDeg: 130 },
        { objectId: 'flamenco', xPct: 60.4, yPct: 25.5, scale: 0.411, rotationDeg: -50 },
        { objectId: 'flamenco', xPct: 63.5, yPct: 78.4, scale: 0.386, rotationDeg: 25 },
        { objectId: 'flamenco', xPct: 82.4, yPct: 32.9, scale: 0.382, rotationDeg: -130 },
        { objectId: 'guitarra', xPct: 15.7, yPct: 45.8, scale: 0.488, rotationDeg: -50 },
        { objectId: 'guitarra', xPct: 73.9, yPct: 57.5, scale: 0.44, rotationDeg: 0 },
        { objectId: 'guitarra', xPct: 43.7, yPct: 27.7, scale: 0.348, rotationDeg: 175 },
        { objectId: 'sol', xPct: 16.1, yPct: 77.7, scale: 0.461, rotationDeg: -130 },
        { objectId: 'sol', xPct: 87.5, yPct: 78.4, scale: 0.376, rotationDeg: 50 },
        { objectId: 'sol', xPct: 57.4, yPct: 56.0, scale: 0.353, rotationDeg: -80 },
        { objectId: 'pez', xPct: 27.5, yPct: 54.2, scale: 0.406, rotationDeg: -80 },
        { objectId: 'pez', xPct: 86.1, yPct: 49.7, scale: 0.415, rotationDeg: -25 },
        { objectId: 'pez', xPct: 49.8, yPct: 73.4, scale: 0.437, rotationDeg: 175 },
      ] },
      { items: [
        { objectId: 'camion-bomberos', xPct: 74.9, yPct: 20.1, scale: 0.439, rotationDeg: 50 },
        { objectId: 'camion-bomberos', xPct: 46.9, yPct: 53.8, scale: 0.444, rotationDeg: 130 },
        { objectId: 'camion-bomberos', xPct: 69.9, yPct: 68.1, scale: 0.348, rotationDeg: -25 },
        { objectId: 'casa', xPct: 86.1, yPct: 58.4, scale: 0.482, rotationDeg: 25 },
        { objectId: 'casa', xPct: 39.9, yPct: 29.5, scale: 0.472, rotationDeg: -50 },
        { objectId: 'casa', xPct: 59.5, yPct: 46.5, scale: 0.408, rotationDeg: 175 },
        { objectId: 'flamenco', xPct: 51.9, yPct: 25.1, scale: 0.441, rotationDeg: -130 },
        { objectId: 'flamenco', xPct: 69.4, yPct: 48.2, scale: 0.459, rotationDeg: -50 },
        { objectId: 'flamenco', xPct: 57.6, yPct: 79.4, scale: 0.394, rotationDeg: 25 },
        { objectId: 'guitarra', xPct: 19.5, yPct: 78.0, scale: 0.388, rotationDeg: 80 },
        { objectId: 'guitarra', xPct: 13.7, yPct: 32.4, scale: 0.492, rotationDeg: 50 },
        { objectId: 'guitarra', xPct: 85.2, yPct: 19.7, scale: 0.452, rotationDeg: 175 },
        { objectId: 'sol', xPct: 30.1, yPct: 69.5, scale: 0.346, rotationDeg: 50 },
        { objectId: 'sol', xPct: 77.2, yPct: 34.8, scale: 0.415, rotationDeg: -80 },
        { objectId: 'sol', xPct: 59.3, yPct: 64.2, scale: 0.414, rotationDeg: 130 },
        { objectId: 'pez', xPct: 19.3, yPct: 19.9, scale: 0.495, rotationDeg: 130 },
        { objectId: 'pez', xPct: 19.7, yPct: 57.6, scale: 0.341, rotationDeg: -50 },
        { objectId: 'pez', xPct: 48.5, yPct: 69.9, scale: 0.34, rotationDeg: 0 },
      ] },
    ],
  },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/contornos/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
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

const PRAISE_GOOD = ['¡Excelente ojo!', '¡Muy bien contado!', '¡Así se hace!', '¡Qué buena percepción!']
const PRAISE_OK = ['¡Buen intento! Algunos estaban muy escondidos.', 'Con la práctica vas a ir encontrando cada vez más.']
const ACCENT = '#92400E' // amber-800

type Phase = 'play' | 'results' | 'recognize'

export function FigurasSuperpuestas({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which composition (index into LEVELS[i].compositions) is playing for
  // level i THIS "epoch" (a full 3-level pass). Decided once per epoch — at
  // mount, and again on "Hacer otro" — never re-rolled just because the
  // player re-visits a level, so "Repetir" can hand back the exact same 3
  // láminas deterministically instead of re-randomizing.
  const [epochChoices, setEpochChoices] = useState(() =>
    LEVELS.map((lvl) => Math.floor(Math.random() * lvl.compositions.length)),
  )
  const level = LEVELS[levelIdx]
  const composition = level.compositions[epochChoices[levelIdx]]

  const truth = useMemo(() => {
    const m: Record<string, number> = {}
    for (const it of composition.items) m[it.objectId] = (m[it.objectId] ?? 0) + 1
    return m
  }, [composition])
  const types = useMemo(() => shuffle(Object.keys(truth)), [truth])
  const targetTypes = useMemo(() => new Set(types), [types])

  const recognitionOptions = useMemo(
    () => shuffle([...types, ...level.foils]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [phase, setPhase] = useState<Phase>('play')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [graded, setGraded] = useState(false)
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across both fases and levels 1→2→3, only zeroed on a genuine
  // day restart (restartEpoch) — same policy as every sibling game.
  const [mistakes, setMistakes] = useState(0)
  const [attempts, setAttempts] = useState(0)

  const done = phase === 'recognize' && graded

  useEffect(() => {
    if (done) {
      const correctFound = [...selected].filter((t) => targetTypes.has(t)).length
      setLevelPraise(pickOne(correctFound / targetTypes.size >= 0.6 ? PRAISE_GOOD : PRAISE_OK))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const countOf = (id: string) => counts[id] ?? 0
  function bump(id: string, delta: number) {
    if (phase !== 'play') return
    setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] ?? 0) + delta)) }))
  }
  const correctCount = types.filter((t) => countOf(t) === truth[t]).length

  function submit() {
    if (phase !== 'play') return
    setPhase('results')
    setPraise(pickOne(correctCount === types.length ? PRAISE_GOOD : PRAISE_OK))
    setMistakes((m) => m + (types.length - correctCount))
    setAttempts((a) => a + types.length)
  }
  function goToRecognize() {
    setPhase('recognize')
  }
  function toggleType(id: string) {
    if (graded) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function gradeRecognition() {
    if (graded) return
    const correctFound = [...selected].filter((t) => targetTypes.has(t)).length
    const missed = targetTypes.size - correctFound
    const falsePositives = selected.size - correctFound
    setMistakes((m) => m + missed + falsePositives)
    setAttempts((a) => a + recognitionOptions.length)
    setGraded(true)
  }

  // Resets happen HERE, synchronously with the level/round change — same
  // discipline as CuantosHay/every sibling game (an effect-based reset reads
  // `done` stale right as levelIdx reaches the last level).

  // "Siguiente nivel" — advance within the SAME epoch. epochChoices is left
  // alone: level i+1's composition was already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setPhase('play')
    setCounts({})
    setSelected(new Set())
    setGraded(false)
  }

  // Shared by both restart buttons on the final level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — zero
  // the accumulators either way). roundKey always bumps here: it's the
  // "which attempt is this" generation counter the onComplete effect uses to
  // fire again on a replay, independent of whether the content changed.
  function restartEpoch() {
    setLevelIdx(0)
    setPhase('play')
    setCounts({})
    setSelected(new Set())
    setGraded(false)
    setMistakes(0)
    setAttempts(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same 3 láminas as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random lámina per level, same as before this
  // feature existed (the only option there used to be).
  function restartDifferent() {
    restartEpoch()
    setEpochChoices(LEVELS.map((lvl) => Math.floor(Math.random() * lvl.compositions.length)))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: attempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, attempts])

  const chipCols = types.length <= 3 ? 'grid-cols-3' : types.length === 4 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(146, 64, 14, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {phase === 'play' && <p className="mt-2 text-base text-slate-500">Contá cuántos hay de cada uno.</p>}
        {phase === 'results' && (
          <p className="mt-2 text-base font-semibold text-slate-500">
            Acertaste {correctCount} de {types.length} — {praise}
          </p>
        )}
        {phase === 'recognize' && (
          <p className="mt-2 text-base text-slate-500">Ahora tocá solo los que estaban en la lámina de recién.</p>
        )}
        {!done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Lámina {levelIdx + 1} de {LEVELS.length}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(levelIdx / LEVELS.length) * 100}%`, backgroundColor: ACCENT }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Fase 1: contar (misma lámina se sigue mostrando durante 'results') */}
      {(phase === 'play' || phase === 'results') && (
        <>
          <div className="relative isolate mx-auto mt-3 aspect-[5/3] w-full overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:mt-5">
            {composition.items.map((it, i) => {
              const img = imgFor(it.objectId)
              return (
                img && (
                  <img
                    key={`${it.objectId}-${i}`}
                    src={img}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute mix-blend-multiply"
                    style={{
                      left: `${it.xPct}%`,
                      top: `${it.yPct}%`,
                      height: `${it.scale * 100}%`,
                      width: 'auto',
                      transform: `translate(-50%, -50%) rotate(${it.rotationDeg ?? 0}deg)`,
                    }}
                  />
                )
              )
            })}
          </div>

          <div className={`mt-3 grid gap-2 sm:mt-5 sm:gap-3 ${chipCols}`}>
            {types.map((id) => {
              const img = imgFor(id)
              const mine = countOf(id)
              const real = truth[id]
              const ok = phase === 'results' && mine === real
              const off = phase === 'results' && mine !== real
              return (
                <div
                  key={id}
                  className={[
                    'flex items-center gap-1 rounded-2xl border-2 bg-white px-1.5 py-1.5 transition',
                    ok ? 'border-tiam-green bg-tiam-green/5' : '',
                    off ? 'border-slate-300 bg-slate-50' : '',
                    phase === 'play' ? 'border-slate-200' : '',
                  ].join(' ')}
                >
                  {img && <img src={img} alt={LABELS[id] ?? id} className="h-8 w-8 shrink-0 object-contain" draggable={false} />}
                  {phase === 'play' ? (
                    <div className="flex flex-1 items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => bump(id, -1)}
                        disabled={mine === 0}
                        aria-label={`Menos ${LABELS[id] ?? id}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-95 disabled:opacity-30"
                      >
                        <Minus className="h-4 w-4" strokeWidth={3} />
                      </button>
                      <span className="min-w-[1.5ch] text-center text-lg font-extrabold text-slate-800">{mine}</span>
                      <button
                        type="button"
                        onClick={() => bump(id, 1)}
                        aria-label={`Más ${LABELS[id] ?? id}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition active:scale-95"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <Plus className="h-4 w-4" strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-end gap-1.5 pr-1">
                      {ok ? (
                        <>
                          <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                          <span className="text-lg font-extrabold text-tiam-green">{real}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-base font-semibold text-slate-400 line-through">{mine}</span>
                          <span className="text-lg font-extrabold text-slate-800">{real}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3 text-center sm:mt-4">
            {phase === 'play' ? (
              <button
                type="button"
                onClick={submit}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white transition"
                style={{ backgroundColor: ACCENT }}
              >
                Listo
              </button>
            ) : (
              <button
                type="button"
                onClick={goToRecognize}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white transition"
                style={{ backgroundColor: ACCENT }}
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Fase 2: repaso / reconocimiento */}
      {phase === 'recognize' && !graded && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
            {recognitionOptions.map((id) => {
              const img = imgFor(id)
              const isSelected = selected.has(id)
              const isTarget = targetTypes.has(id)
              let badge: 'hit' | 'missed' | 'false-positive' | null = null
              if (graded) {
                if (isTarget && isSelected) badge = 'hit'
                else if (isTarget && !isSelected) badge = 'missed'
                else if (!isTarget && isSelected) badge = 'false-positive'
              }
              return (
                <button
                  key={id}
                  type="button"
                  disabled={graded}
                  onClick={() => toggleType(id)}
                  aria-pressed={isSelected}
                  aria-label={LABELS[id] ?? id}
                  className={[
                    'relative flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-white p-2 transition',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    badge === 'hit' ? 'border-tiam-green bg-tiam-green/5' : '',
                    badge === 'missed' ? 'border-tiam-blue bg-tiam-blue/5' : '',
                    badge === 'false-positive' ? 'border-slate-200 opacity-50' : '',
                    !badge ? (isSelected ? 'ring-2' : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0') : '',
                  ].join(' ')}
                  style={!badge && isSelected ? { borderColor: ACCENT, backgroundColor: 'rgba(146,64,14,0.06)' } : undefined}
                >
                  {img && <img src={img} alt="" className="h-10 w-10 object-contain" draggable={false} />}
                  <span className="text-center text-xs font-medium leading-tight text-slate-600">{LABELS[id] ?? id}</span>
                  {badge === 'hit' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                  {badge === 'missed' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-blue text-white shadow">
                      <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  )}
                  {badge === 'false-positive' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-white shadow">
                      <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {!graded && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={gradeRecognition}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white transition"
                style={{ backgroundColor: ACCENT }}
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              Acertaste
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-blue text-white">
                <Eye className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              Se te pasó
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-white">
                <Minus className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              No estaba
            </span>
          </div>
          <p className="mt-3 text-slate-600">
            {levelIdx < LEVELS.length - 1
              ? `¡Completaste la lámina ${levelIdx + 1}! Te espera una más difícil.`
              : '¡Completaste las tres láminas del día — cerraste el Mes 2!'}
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
            // Two ways to go again, not one: some players want another crack
            // at these exact láminas, others want fresh ones.
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
