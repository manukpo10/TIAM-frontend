import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Cómo se llamaba?" — confrontation naming. An object is shown; the player
 * taps its name. Word-finding for everyday objects is one of the first things
 * to wobble, and naming to a picture is the standard way it gets exercised.
 *
 * Inverse of día 19 ("¿Qué objeto es?"), which gives a riddle and asks for the
 * picture. Going picture → word is the harder and more clinically relevant
 * direction: the riddle version lets you reason your way in from the
 * description, while here the word has to be retrieved cold.
 *
 * Reuses two asset folders the catalog already ships — no new art. Difficulty
 * ramps by how everyday the object is (L1 taza/pan, L3 dedal/servilletero) and
 * by pulling the three decoys from the target's own category, so at L3 the
 * options are all plausible names for something on the same table.
 */

type Pool = 'mesa' | 'feria'

interface Item {
  id: string
  label: string
  pool: Pool
  /** Decoys are drawn from the same category first — that is the difficulty knob. */
  category: string
}

// Labels are spelled out rather than derived from the slug: the ids are
// ASCII-folded filenames ("boton", "lapiz") and the player must see real
// Spanish ("botón", "lápiz").
const ITEMS: Item[] = [
  // ── Nivel 1: everyday, high-frequency ──
  { id: 'taza', label: 'taza', pool: 'mesa', category: 'cocina' },
  { id: 'vaso', label: 'vaso', pool: 'mesa', category: 'cocina' },
  { id: 'pan', label: 'pan', pool: 'mesa', category: 'comida' },
  { id: 'libro', label: 'libro', pool: 'mesa', category: 'escritorio' },
  { id: 'llaves', label: 'llaves', pool: 'mesa', category: 'personal' },
  { id: 'paraguas', label: 'paraguas', pool: 'mesa', category: 'personal' },
  { id: 'pelota', label: 'pelota', pool: 'mesa', category: 'personal' },
  { id: 'celular', label: 'celular', pool: 'mesa', category: 'escritorio' },
  { id: 'banana', label: 'banana', pool: 'feria', category: 'fruta' },
  { id: 'naranja', label: 'naranja', pool: 'feria', category: 'fruta' },
  { id: 'tomate', label: 'tomate', pool: 'feria', category: 'verdura' },
  { id: 'zanahoria', label: 'zanahoria', pool: 'feria', category: 'verdura' },

  // ── Nivel 2: familiar but less frequent ──
  { id: 'mate', label: 'mate', pool: 'mesa', category: 'cocina' },
  { id: 'termo', label: 'termo', pool: 'mesa', category: 'cocina' },
  { id: 'maceta', label: 'maceta', pool: 'mesa', category: 'casa' },
  { id: 'vela', label: 'vela', pool: 'mesa', category: 'casa' },
  { id: 'florero', label: 'florero', pool: 'mesa', category: 'casa' },
  { id: 'billetera', label: 'billetera', pool: 'mesa', category: 'personal' },
  { id: 'anteojos', label: 'anteojos', pool: 'mesa', category: 'personal' },
  { id: 'cuaderno', label: 'cuaderno', pool: 'mesa', category: 'escritorio' },
  { id: 'lapicera', label: 'lapicera', pool: 'mesa', category: 'escritorio' },
  { id: 'tijera', label: 'tijera', pool: 'mesa', category: 'escritorio' },
  { id: 'ciruela', label: 'ciruela', pool: 'feria', category: 'fruta' },
  { id: 'mandarina', label: 'mandarina', pool: 'feria', category: 'fruta' },
  { id: 'berenjena', label: 'berenjena', pool: 'feria', category: 'verdura' },
  { id: 'pimiento', label: 'pimiento', pool: 'feria', category: 'verdura' },

  // ── Nivel 3: specific names that genuinely need retrieving ──
  { id: 'dedal', label: 'dedal', pool: 'mesa', category: 'costura' },
  { id: 'ovillo-lana', label: 'ovillo de lana', pool: 'mesa', category: 'costura' },
  { id: 'agujas-tejer', label: 'agujas de tejer', pool: 'mesa', category: 'costura' },
  { id: 'servilletero', label: 'servilletero', pool: 'mesa', category: 'cocina' },
  { id: 'azucarera', label: 'azucarera', pool: 'mesa', category: 'cocina' },
  { id: 'bombilla', label: 'bombilla', pool: 'mesa', category: 'cocina' },
  { id: 'portarretrato', label: 'portarretrato', pool: 'mesa', category: 'casa' },
  { id: 'control-remoto', label: 'control remoto', pool: 'mesa', category: 'casa' },
  { id: 'reloj-pulsera', label: 'reloj de pulsera', pool: 'mesa', category: 'personal' },
  { id: 'frambuesa', label: 'frambuesa', pool: 'feria', category: 'fruta' },
  { id: 'arandanos', label: 'arándanos', pool: 'feria', category: 'fruta' },
  { id: 'granada', label: 'granada', pool: 'feria', category: 'fruta' },
]

// Per-folder globs — filenames collide across folders with different art.
const MESA_IMAGES = import.meta.glob('../../../assets/desafio/games/que-hay-en-la-mesa/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const FERIA_IMAGES = import.meta.glob('../../../assets/desafio/games/buscar-rojos/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function imgFor(item: Item): string | undefined {
  const map = item.pool === 'mesa' ? MESA_IMAGES : FERIA_IMAGES
  return Object.entries(map).find(([path]) => path.endsWith(`/${item.id}.webp`))?.[1]
}

interface Level {
  n: number
  name: string
  rounds: number
  /** Slice of ITEMS this level draws its targets from. */
  from: number
  to: number
  /** When true, decoys come from the target's own category — much harder. */
  sameCategoryDecoys: boolean
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 3, from: 0, to: 12, sameCategoryDecoys: false },
  { n: 2, name: 'Nivel 2', rounds: 4, from: 12, to: 26, sameCategoryDecoys: false },
  { n: 3, name: 'Nivel 3', rounds: 5, from: 26, to: ITEMS.length, sameCategoryDecoys: true },
]

const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

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

interface Round {
  target: Item
  options: Item[]
}

function buildRounds(level: Level): Round[] {
  const pool = ITEMS.slice(level.from, level.to)
  return shuffle(pool)
    .slice(0, level.rounds)
    .map((target) => {
      // Decoys are sampled WITHOUT replacement from a pool that already
      // excludes the target, so the four options can never contain a
      // duplicate — a repeated label would make the round unanswerable.
      const others = ITEMS.filter((i) => i.id !== target.id)
      const preferred = level.sameCategoryDecoys
        ? others.filter((i) => i.category === target.category)
        : []
      const rest = others.filter((i) => !preferred.includes(i))
      const decoys = [...shuffle(preferred), ...shuffle(rest)].slice(0, 3)
      return { target, options: shuffle([target, ...decoys]) }
    })
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa no es. Mirá bien la foto y probá con otra.',
  'No es ese el nombre — fijate de nuevo.',
  'Casi. ¿Para qué se usa? Eso te puede ayudar.',
]

export function ComoSeLlamaba({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const rounds = useMemo(
    () => buildRounds(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= rounds.length

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch) — a same-level replay keeps it.
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function guess(item: Item) {
    if (!round || resolved || eliminated.has(item.id)) return
    if (item.id === round.target.id) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(item.id))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` would read the
  // previous level's stale-true value on the very render that arrives at the
  // new level and fire onComplete with garbage. Same as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when the last level's last round resolves. A
  // genuine full-day restart (the wrap to level 1) gets a new roundKey so it
  // can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cómo se llama esto?</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {rounds.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${rounds.length ? (roundIdx / rounds.length) * 100 : 0}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          <div className="relative mx-auto mt-5 aspect-square w-40 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-3 sm:w-48">
            {(() => {
              const src = imgFor(round.target)
              return src ? (
                <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
              ) : null
            })()}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {round.options.map((option) => {
              const isEliminated = eliminated.has(option.id)
              const isCorrectShown = resolved && option.id === round.target.id
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 px-3 py-2 text-center text-base font-semibold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-60' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {option.label}
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

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Nombraste los {rounds.length} — ¡completaste el {level.name.toLowerCase()}!
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
              Otros objetos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
