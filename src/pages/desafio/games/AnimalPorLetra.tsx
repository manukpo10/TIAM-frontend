import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Un animal por letra" — a letter-to-animal matching game.
 *
 * The original exercise ("A de araña, B de burro…") is generative/spoken
 * and can't be auto-graded, so this converts it to recognition: a target
 * letter is shown, tap the one of 4 illustrated animals (image only, no
 * caption) that starts with it. Forks CadaCosaEnSuGrupo's sequential-queue
 * engine (work through N prompts, correct auto-advances, progress bar) with
 * QueSera's illustrated-option-tile visuals.
 *
 * A wrong tap eliminates that option — muted grey, never red, even
 * transiently: this is a word-finding/naming task, and naming difficulty
 * is emotionally loaded for this audience the same way memory lapses are
 * (same reasoning QueHayEnLaMesa/QueSera already apply, here extended to
 * a third game type rather than following CazadorDeLetras' brief red
 * wiggle, which fits an attention task but not a language one).
 *
 * L2/L3 decoys are drawn from a CUMULATIVE pool (all animals introduced so
 * far, not just the current level) so genuinely confusable pairs surface
 * naturally as the pool grows — same-sound Spanish letter pairs like B/V,
 * L/LL, Y/LL (yeísmo) and seseo (C/S/Z) — without hand-authoring a fragile
 * per-letter decoy matrix.
 */

interface Animal {
  id: string
  label: string
  letter: string
}

const L1_ANIMALS: Animal[] = [
  { id: 'abeja', label: 'abeja', letter: 'A' },
  { id: 'burro', label: 'burro', letter: 'B' },
  { id: 'delfin', label: 'delfín', letter: 'D' },
  { id: 'elefante', label: 'elefante', letter: 'E' },
  { id: 'gato', label: 'gato', letter: 'G' },
  { id: 'mono', label: 'mono', letter: 'M' },
  { id: 'oso', label: 'oso', letter: 'O' },
  { id: 'pato', label: 'pato', letter: 'P' },
  { id: 'rana', label: 'rana', letter: 'R' },
  { id: 'tortuga', label: 'tortuga', letter: 'T' },
]
const L2_ANIMALS: Animal[] = [
  { id: 'vaca', label: 'vaca', letter: 'V' },
  { id: 'cangrejo', label: 'cangrejo', letter: 'C' },
  { id: 'jirafa', label: 'jirafa', letter: 'J' },
  { id: 'leon', label: 'león', letter: 'L' },
  { id: 'nutria', label: 'nutria', letter: 'N' },
  { id: 'flamenco', label: 'flamenco', letter: 'F' },
  { id: 'serpiente', label: 'serpiente', letter: 'S' },
  { id: 'zorro', label: 'zorro', letter: 'Z' },
]
const L3_ANIMALS: Animal[] = [
  { id: 'chancho', label: 'chancho', letter: 'CH' },
  { id: 'llama', label: 'llama', letter: 'LL' },
  { id: 'hipopotamo', label: 'hipopótamo', letter: 'H' },
  { id: 'cebra', label: 'cebra', letter: 'C' },
  { id: 'yacare', label: 'yacaré', letter: 'Y' },
  { id: 'nandu', label: 'ñandú', letter: 'Ñ' },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/animal-por-letra/*.webp', {
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
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface Level {
  n: number
  name: string
  animals: Animal[]
  decoyPool: Animal[]
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', animals: L1_ANIMALS, decoyPool: L1_ANIMALS },
  { n: 2, name: 'Nivel 2', animals: L2_ANIMALS, decoyPool: [...L1_ANIMALS, ...L2_ANIMALS] },
  { n: 3, name: 'Nivel 3', animals: L3_ANIMALS, decoyPool: [...L1_ANIMALS, ...L2_ANIMALS, ...L3_ANIMALS] },
]

interface Trial {
  target: Animal
  options: Animal[]
}
// Real same-sound Spanish confusions (b/v, seseo c/s/z, yeísmo ll/y) — forced
// into the decoy set when relevant so the tricky pairs actually collide,
// instead of colliding only ~13% of the time under uniform random sampling.
const CONFUSABLE_IDS: Record<string, string[]> = {
  burro: ['vaca'], vaca: ['burro'],
  cebra: ['serpiente', 'zorro'], serpiente: ['cebra', 'zorro'], zorro: ['cebra', 'serpiente'],
  llama: ['yacare'], yacare: ['llama'],
}

function buildRound(level: Level): Trial[] {
  return shuffle(level.animals).map((target) => {
    // Fairness fix: also exclude same-letter animals (e.g. cangrejo/cebra both
    // 'C') so the board never shows two legitimately-correct-letter options.
    const pool = level.decoyPool.filter((a) => a.id !== target.id && a.letter !== target.letter)
    const forced = pool.filter((a) => (CONFUSABLE_IDS[target.id] ?? []).includes(a.id))
    const rest = pool.filter((a) => !forced.includes(a))
    const decoyCount = level.n === 3 ? 5 : 3
    const decoys = [...forced, ...pick(rest, Math.max(0, decoyCount - forced.length))].slice(0, decoyCount)
    return {
      target,
      options: shuffle([target, ...decoys]),
    }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']

// Fixed total of trials across the whole day (10+8+6) — every trial is
// resolved with exactly one correct tap no matter how many wrong taps happen
// first, so this is a derivable constant rather than a piece of state.
const TOTAL_TRIALS = LEVELS.reduce((sum, l) => sum + l.animals.length, 0)

export function AnimalPorLetra({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const trials = useMemo(
    () => buildRound(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a true
  // day restart (see nextLevel's wrap branch below) — same policy as ElVuelto.
  const [mistakes, setMistakes] = useState(0)

  const current = trials[currentIndex]
  const done = currentIndex >= trials.length

  function guess(id: string) {
    if (!current) return
    if (id === current.target.id) {
      setCurrentIndex((i) => i + 1)
      setEliminated(new Set())
    } else {
      setEliminated((prev) => new Set(prev).add(id))
      setMistakes((m) => m + 1)
    }
  }

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  // Fires once per roundKey when the last trial of level 3 is resolved. A
  // full day restart (the wrap to level 1) gets a new roundKey, so a genuine
  // replay reports again; re-rendering while already done on level 3 does not
  // fire twice. totalAttempts = accumulated wrong taps + total trials across
  // all 3 levels (a fixed constant) — derived here rather than adding a
  // second piece of state.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_TRIALS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see ElVuelto.tsx for
  // why: an effect only catches up on the render AFTER levelIdx changes, so
  // `done` (derived from currentIndex vs. the NEW level's trials.length)
  // could read stale-true on the very render that just arrived at the new
  // level. This is a REAL risk here, not just theoretical: trial counts go
  // 10→8→6 (decreasing), so leaving level 2 (currentIndex=8) and entering
  // level 3 (trials.length=6) would evaluate done = 8 >= 6 = true on the
  // transitional render, with levelIdx already at the last index.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    if (levelIdx < LEVELS.length - 1) {
      setLevelIdx((i) => i + 1)
    } else {
      setLevelIdx(0)
    }
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra ronda" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
  }

  const optionCols = level.n === 3 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          Lenguaje · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué animal empieza así?</h2>
        <p className="mt-2 text-base font-semibold text-slate-500">
          Llevás {currentIndex} de {trials.length}
        </p>
        <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
            style={{ width: `${trials.length ? (currentIndex / trials.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {!done && current && (
        <>
          {/* Target letter */}
          <div className="mt-6 text-center">
            <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-4xl font-black text-slate-800">
              {current.target.letter}
            </span>
          </div>

          {/* Options */}
          <div className={`mt-6 grid gap-3 ${optionCols}`}>
            {current.options.map((opt) => {
              const isElim = eliminated.has(opt.id)
              const img = imgFor(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isElim}
                  onClick={() => guess(opt.id)}
                  aria-label={opt.label}
                  className={[
                    'relative flex aspect-square items-center justify-center rounded-2xl border-2 bg-white p-4 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isElim
                      ? 'border-slate-200 opacity-40 grayscale'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste los {trials.length} animales — completaste el {level.name.toLowerCase()}!
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
