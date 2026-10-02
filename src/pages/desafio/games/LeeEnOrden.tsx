import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Leé en orden" — día 4, mes 5, atención. The words of a traditional refrán
 * are scattered over the screen, each one tagged with a number. The player
 * hunts for number 1, then 2, then 3… and taps them in that order; every word
 * found drops into the next slot of the strip above, so the refrán reads itself
 * back at the end. Visual search + keeping your place in a sequence.
 *
 * The numbers carry the order, so the game never depends on knowing the
 * saying: it is the payoff, not the question. A wrong tap flashes muted gray
 * (never red), says WHICH number that tile was and which one to look for, and
 * costs one mistake — it never blocks. A tile already placed stays where it is
 * (turned green) instead of vanishing, so the scattered layout never reshuffles
 * under the player's finger.
 *
 * ONE refrán per level, a 5 → 7 → 9 word ramp. Each level has two authored
 * refranes of the same length and one is picked ONCE at mount (`epoch`, together
 * with the scattered order), so "Repetir" replays exactly the same three
 * sayings in the same places. Per-level state lives in <LevelView>, keyed by
 * run + level.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface LevelDef {
  name: string
  /** Traditional refranes, all with the same number of words in a level. */
  sayings: string[]
}

const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', sayings: ['Más vale tarde que nunca', 'La unión hace la fuerza'] },
  { name: 'Nivel 2', sayings: ['Del dicho al hecho hay mucho trecho', 'En casa de herrero, cuchillo de palo'] },
  {
    name: 'Nivel 3',
    sayings: ['No dejes para mañana lo que puedas hacer hoy', 'A caballo regalado no se le miran los dientes'],
  },
]

const TOTAL_WORDS = LEVELS.reduce((sum, lvl) => sum + lvl.sayings[0].split(' ').length, 0)
// ── data:end ──

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

interface Tile {
  /** 1-based position of the word in the refrán — the number printed on the tile. */
  num: number
  word: string
}
interface LevelContent {
  saying: string
  words: string[]
  /** The scattered order — frozen for the whole mount. */
  tiles: Tile[]
}

function buildTiles(words: string[]): Tile[] {
  const items = words.map((word, i) => ({ num: i + 1, word }))
  let shuffled = shuffle(items)
  // Never start with the words already lined up in order.
  for (let guard = 0; guard < 20 && shuffled.every((t, i) => t.num === i + 1); guard++) {
    shuffled = shuffle(items)
  }
  return shuffled
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const saying = pickOne(lvl.sayings)
    const words = saying.split(' ')
    return { saying, words, tiles: buildTiles(words) }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente atención!', '¡Así se hace!', '¡Qué buen ojo!', '¡Perfecto!']

interface LevelViewProps {
  levelIdx: number
  content: LevelContent
  onMistake: () => void
  onSolved: () => void
  onNext: () => void
  onRepeat: () => void
}

function LevelView({ levelIdx, content, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { saying, words, tiles } = content
  const total = words.length

  // How many words are already in place: the next number to find is placedCount + 1.
  const [placedCount, setPlacedCount] = useState(0)
  const [wrongNum, setWrongNum] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

  const solved = placedCount >= total
  const target = placedCount + 1

  function handleTap(tile: Tile) {
    // A second tap on the tile that is still flashing as wrong is a double tap,
    // not a second mistake.
    if (solved || tile.num <= placedCount || wrongNum === tile.num) return
    if (tile.num === target) {
      setPlacedCount((c) => c + 1)
      setWrongNum(null)
      setHint(null)
      if (target === total) {
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setWrongNum(tile.num)
      setHint(`Ese es el número ${tile.num}. Ahora buscá el ${target}.`)
      onMistake()
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setWrongNum(null), 600)
    }
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá las palabras en orden</h2>
            <p className="mt-2 text-base text-slate-500">Seguí los números: 1, 2, 3…</p>
          </>
        )}
      </div>

      {!solved && (
        <>
          {/* The refrán being rebuilt: one slot per word, filled in order. The
              finished refrán is laid out invisibly underneath (same chips, same
              wrapping), so the box is as tall as it will ever be from the first
              tap and the grid below never jumps while the player searches. A
              slot is never wider than the chip that replaces it, so the real
              strip can only wrap into fewer lines than the ghost. */}
          <div className="mt-4 grid rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-2.5">
            <div aria-hidden="true" className="invisible col-start-1 row-start-1 flex flex-wrap justify-center gap-1.5">
              {words.map((word, i) => (
                <span
                  key={i}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border-2 px-2 text-lg font-bold"
                >
                  {word}
                </span>
              ))}
            </div>
            <div className="col-start-1 row-start-1 flex flex-wrap content-start justify-center gap-1.5">
              {words.map((word, i) =>
                i < placedCount ? (
                  <span
                    key={i}
                    className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border-2 border-tiam-green bg-tiam-green/10 px-2 text-lg font-bold text-slate-900"
                  >
                    {word}
                  </span>
                ) : (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={[
                      'flex h-10 min-w-[40px] items-center justify-center rounded-lg border-2 border-dashed px-2 text-base font-bold',
                      i === placedCount ? 'border-tiam-blue text-tiam-blue' : 'border-slate-300 text-slate-400',
                    ].join(' ')}
                  >
                    {i + 1}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* What to look for now */}
          <p className="mt-3 text-center text-xl font-bold text-slate-900">
            Buscá el número <span className="text-tiam-blue">{target}</span>
          </p>

          {/* The scattered words */}
          <div className="mx-auto mt-3 grid max-w-sm grid-cols-3 gap-2 max-[350px]:-mx-2 max-[350px]:gap-1.5">
            {tiles.map((tile) => {
              const isPlaced = tile.num <= placedCount
              const isWrong = wrongNum === tile.num
              return (
                <button
                  key={tile.num}
                  type="button"
                  disabled={isPlaced}
                  onClick={() => handleTap(tile)}
                  aria-label={`Número ${tile.num}: ${tile.word}`}
                  className={[
                    'relative flex min-h-[72px] flex-col items-center justify-center gap-1 break-words rounded-2xl border-2 px-0.5 py-1 transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isPlaced
                      ? 'border-tiam-green bg-tiam-green/10'
                      : isWrong
                        ? 'border-slate-300 bg-slate-100 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold',
                      isPlaced ? 'bg-tiam-green text-white' : 'bg-tiam-blue text-white',
                    ].join(' ')}
                  >
                    {isPlaced ? <Check className="h-4 w-4" strokeWidth={3} /> : tile.num}
                  </span>
                  <span className="text-lg font-bold leading-tight text-slate-800 max-[370px]:text-[17px] max-[350px]:text-base">
                    {tile.word}
                  </span>
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-3 min-h-[2.5rem] text-center text-base font-medium text-slate-500">
            {hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Armaste el refrán, ¡completaste el {level.name.toLowerCase()}!</p>
          <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-xl font-bold leading-snug text-slate-800">«{saying}»</p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={onRepeat}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LeeEnOrden({ onComplete }: GameProps) {
  // Which refrán each level plays, and where its words are scattered — decided
  // once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
  }
  function handleRepeat() {
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={() => setLevelIdx((i) => i + 1)}
      onRepeat={handleRepeat}
    />
  )
}
