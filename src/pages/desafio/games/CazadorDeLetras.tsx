import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

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

// Board density per level, mobile-first. The tile count climbs 15 → 24 → 36,
// so the COLUMNS climb with it and the tiles shrink — the board must never
// grow past the fold. In a cancellation task a target you can't see is one you
// can't cross off, and the counter then strands you at "3 de 14" with nothing
// on screen to suggest the grid continues below. Dense small letters are also
// closer to the paper instrument this adapts than a short column of huge ones.
// Every tile here stays at or above the 44px minimum tap target. Full class
// strings, never interpolated: Tailwind only emits classes it can read
// literally in the source.
const BOARD_CLASS: Record<number, string> = {
  1: 'grid-cols-4 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5',
  2: 'grid-cols-5 gap-2 sm:grid-cols-5 sm:gap-4 lg:grid-cols-6',
  3: 'grid-cols-6 gap-1.5 sm:grid-cols-6 sm:gap-3 lg:grid-cols-8',
}
const TILE_CLASS: Record<number, string> = {
  1: 'h-16 text-4xl sm:h-20 sm:text-5xl',
  2: 'h-14 text-3xl sm:h-20 sm:text-5xl',
  3: 'h-14 text-3xl sm:h-16 sm:text-4xl',
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
      ...sampleWithRepeats(CONFUSABLE_WITH_A, 10),
      ...sampleWithRepeats(FAR, 6),
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    instruction: 'Tocá todas las A y todas las E',
    isTarget: (t) => t.char === TARGET_A || t.char === TARGET_E,
    build: () => [
      ...sampleWithRepeats([TARGET_A], 7),
      ...sampleWithRepeats([TARGET_E], 7),
      ...sampleWithRepeats(CONFUSABLE_WITHOUT_E, 14),
      ...sampleWithRepeats(FAR, 8),
    ],
  },
]

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué atención!']

export function CazadorDeLetras({ day: _day, onComplete }: GameProps) {
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
  // Mistakes + correct finds, accumulated across levels 1→2→3 and only zeroed
  // on a genuine day restart (wrap from level 3 back to level 1) — see
  // nextLevel's isWrap branch below.
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)

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
        setMistakes((m) => m + 1)
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

  // isWrap resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundKey — not in a separate effect keyed on them. An effect only
  // catches up one tick after levelIdx changes, so `done` (derived straight
  // from `found`/`targetCount`) would read the previous level's stale, still-
  // true completion state on the very render that just arrived at the new
  // level, firing onComplete instantly with garbage before the player has
  // touched anything.
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
  // done on level 3 does not fire twice. totalAttempts = accumulated mistakes
  // + every letter found across levels 1–3 (foundAcrossLevels covers 1–2,
  // found.size covers the current/last level).
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + foundAcrossLevels + found.size })
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
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{level.instruction}</h2>
        {/* Count and bar share a row — every pixel spent restating progress is a
            pixel the board doesn't get, and the board is the game. */}
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Encontraste {found.size} de {targetCount}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${targetCount ? (found.size / targetCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Board */}
      <div className={`mt-5 grid ${BOARD_CLASS[level.n]}`}>
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
                'relative flex items-center justify-center rounded-2xl border-2 bg-white transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                TILE_CLASS[level.n],
                isFound
                  ? 'border-tiam-green ring-2 ring-tiam-green/30'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                // The wiggle alone marks a wrong tap. This used to also paint the
                // border red, which no other game in this folder does — a wrong
                // answer here is never scored against you and never ends anything,
                // so it has no business looking like an alarm.
                isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300' : '',
              ].join(' ')}
            >
              <span className="font-extrabold leading-none text-slate-700">{tile.char}</span>
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
