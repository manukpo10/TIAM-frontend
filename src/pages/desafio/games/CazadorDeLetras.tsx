import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

/**
 * "Cazador de letras" — a letter-cancellation / sustained-attention mini-game.
 *
 * Same tap-target-among-distractors paradigm as "Buscá los rojos," but pure
 * typography (no illustrations): find every instance of a target letter.
 * L1 pops by silhouette alone; L2 adds visually-confusable letters (e o c s —
 * the "rounded aperture" cluster that reads closest to "a"); L3 holds TWO
 * target letters in mind at once (a + e).
 *
 * No timer, ever. Board sizes (15/24/30) mirror BuscarLosRojos' own — already
 * validated to fill the grid with no empty cells at every breakpoint (mobile
 * 3-col, tablet 4-col, desktop 5-col).
 */

interface LetterTile {
  char: string
}

const TARGET_A = 'a'
const TARGET_E = 'e'
const CONFUSABLE_WITH_A = ['e', 'o', 'c', 's']
const CONFUSABLE_WITHOUT_E = ['o', 'c', 's']
const FAR = ['b', 'd', 'f', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'i']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// Distractor/target pools are small (as few as 1 letter for a pure-target
// pool), so sampling is WITH replacement — repeated decoy letters are normal
// and expected in a letter-cancellation task, same as real text.
function sampleWithRepeats(pool: string[], n: number): LetterTile[] {
  return Array.from({ length: n }, () => ({ char: pool[Math.floor(Math.random() * pool.length)] }))
}

interface Level {
  n: number
  name: string
  instruction: string
  isTarget: (tile: LetterTile) => boolean
  build: () => LetterTile[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    instruction: 'Tocá todas las letras A',
    isTarget: (t) => t.char === TARGET_A,
    build: () => [...sampleWithRepeats([TARGET_A], 5), ...sampleWithRepeats(FAR, 10)],
  },
  {
    n: 2,
    name: 'Nivel 2',
    instruction: 'Tocá todas las A (¡ojo con las parecidas!)',
    isTarget: (t) => t.char === TARGET_A,
    build: () => [
      ...sampleWithRepeats([TARGET_A], 8),
      ...sampleWithRepeats(CONFUSABLE_WITH_A, 8),
      ...sampleWithRepeats(FAR, 8),
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    instruction: 'Tocá todas las A y todas las E',
    isTarget: (t) => t.char === TARGET_A || t.char === TARGET_E,
    build: () => [
      ...sampleWithRepeats([TARGET_A], 5),
      ...sampleWithRepeats([TARGET_E], 5),
      ...sampleWithRepeats(CONFUSABLE_WITHOUT_E, 10),
      ...sampleWithRepeats(FAR, 10),
    ],
  },
]

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué atención!']

export function CazadorDeLetras() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const board = useMemo(
    () => shuffle(level.build()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  // Letters repeat by design, so the target count is a plain filter — a Set
  // keyed on the letter itself (like BuscarLosRojos' id-based Set) would
  // collapse every "a" tile into one and let the round "finish" after a
  // single correct tap.
  const targetCount = useMemo(() => board.filter(level.isTarget).length, [board, level])

  const [found, setFound] = useState<Set<number>>(new Set())
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])

  const done = found.size === targetCount && targetCount > 0

  const reset = useCallback(() => {
    setFound(new Set())
    setWrongIdx(null)
  }, [])

  const handleTap = useCallback(
    (tile: LetterTile, index: number) => {
      if (level.isTarget(tile)) {
        setFound((prev) => {
          if (prev.has(index)) return prev
          const next = new Set(prev)
          next.add(index)
          return next
        })
      } else {
        setWrongIdx(index)
        window.setTimeout(() => setWrongIdx((w) => (w === index ? null : w)), 500)
      }
    },
    [level],
  )

  useEffect(() => {
    if (targetCount > 0 && found.size === targetCount) {
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    }
  }, [found, targetCount])

  function nextLevel() {
    reset()
    if (levelIdx < LEVELS.length - 1) {
      setLevelIdx((i) => i + 1)
    } else {
      setLevelIdx(0)
    }
  }
  function replay() {
    reset()
    setRoundKey((k) => k + 1)
  }

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          Atención · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{level.instruction}</h2>
        <p className="mt-2 text-base font-semibold text-slate-500">
          Encontraste {found.size} de {targetCount}
        </p>
        <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
            style={{ width: `${targetCount ? (found.size / targetCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Board */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
        {board.map((tile, i) => {
          const isFound = found.has(i)
          const isWrong = wrongIdx === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleTap(tile, i)}
              aria-label={`letra ${tile.char}`}
              aria-pressed={isFound}
              className={[
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 bg-white transition',
                'min-h-[64px] focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                isFound
                  ? 'border-tiam-green ring-2 ring-tiam-green/30'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-red-300' : '',
              ].join(' ')}
            >
              <span className="text-4xl font-extrabold text-slate-700 sm:text-5xl">{tile.char}</span>
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
      {wrongIdx !== null && !done && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">
          Esa no es {level.n === 3 ? 'una A ni una E' : 'una A'}, ¡probá con otra! 🙂
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
            Encontraste las {targetCount} — ¡completaste el {level.name.toLowerCase()}!
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
