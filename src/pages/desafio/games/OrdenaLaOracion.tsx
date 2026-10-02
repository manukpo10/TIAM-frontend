import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Ordená la oración" — día 1, mes 5, lenguaje. The words of an everyday
 * sentence are scattered; the player taps them in the order they go and the
 * sentence builds itself, left to right, in a strip above the bank.
 *
 * Each tap is checked live (same family as OrdenAlfabetico / CaminoNumerico):
 * the right next word moves up into the sentence, a wrong one flashes muted
 * gray (never red), costs one mistake and changes nothing else. No timer, no
 * "Revisar" step: with one sentence per level the player always knows exactly
 * where they stand.
 *
 * Spanish word order is looser than English, so a sentence is not one string
 * but a list of ACCEPTED orderings (`orders`; the first is the canonical one
 * shown on the result card). A tap is right when the words placed so far are
 * the start of ANY accepted ordering, so "Mañana vamos con toda la familia a
 * comer ravioles" is as good as the canonical wording. Every sentence is
 * authored so that its first word is the only capitalised one — that cue plus
 * the accepted variants is what keeps a natural sentence from being rejected.
 * Values are compared as exact strings, which is also what lets two identical
 * words ("la" … "la") be tapped in either order.
 *
 * ONE sentence per level, a 5 → 7 → 9 word ramp. Which of the level's two
 * authored sentences plays is decided ONCE, at mount (`epoch`), together with
 * the bank's shuffled order, so "Repetir" replays exactly the same three
 * sentences. Per-level state lives in <LevelView>, keyed by run + level, so
 * moving on or repeating resets it without any effect.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface SentenceSet {
  /** Every acceptable full ordering. orders[0] is the canonical sentence. */
  orders: string[]
}
interface LevelDef {
  name: string
  sentences: SentenceSet[]
}

// Every sentence in a level has the same number of words, so TOTAL_WORDS does
// not depend on which one is drawn. All orderings of a sentence use exactly
// the same words, and only the first word is capitalised.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    sentences: [
      { orders: ['El tío toma mate amargo'] },
      { orders: ['Mi nieta dibuja una flor'] },
    ],
  },
  {
    name: 'Nivel 2',
    sentences: [
      { orders: ['El colectivo me deja en la esquina', 'El colectivo en la esquina me deja'] },
      { orders: ['Mi vecina del tercero riega las plantas', 'Mi vecina riega las plantas del tercero'] },
    ],
  },
  {
    name: 'Nivel 3',
    sentences: [
      {
        orders: [
          'Mañana vamos a comer ravioles con toda la familia',
          'Mañana vamos con toda la familia a comer ravioles',
          'Mañana con toda la familia vamos a comer ravioles',
        ],
      },
      {
        orders: [
          'La abuela guarda los botones en una lata roja',
          'La abuela guarda en una lata roja los botones',
          'La abuela en una lata roja guarda los botones',
        ],
      },
    ],
  },
]

const TOTAL_WORDS = LEVELS.reduce((sum, lvl) => sum + lvl.sentences[0].orders[0].split(' ').length, 0)

/** True when `words` is the beginning (or the whole) of any accepted ordering. */
function startsLikeAnOrder(orders: string[][], words: string[]): boolean {
  return orders.some((o) => words.length <= o.length && words.every((w, i) => o[i] === w))
}
/** True when `words` is exactly one of the accepted orderings. */
function isFullOrder(orders: string[][], words: string[]): boolean {
  return orders.some((o) => o.length === words.length && o.every((w, i) => words[i] === w))
}
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
  id: number
  value: string
}
interface LevelContent {
  orders: string[][]
  /** The bank, already shuffled — frozen for the whole mount. */
  tiles: Tile[]
}

function buildTiles(words: string[]): Tile[] {
  const items = words.map((value, id) => ({ id, value }))
  let shuffled = shuffle(items)
  // A short sentence can shuffle back into its own order — never hand the
  // player a freebie.
  for (let guard = 0; guard < 20 && shuffled.every((t, i) => t.value === words[i]); guard++) {
    shuffled = shuffle(items)
  }
  return shuffled
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const chosen = pickOne(lvl.sentences)
    const orders = chosen.orders.map((s) => s.split(' '))
    return { orders, tiles: buildTiles(orders[0]) }
  })
}

const PRAISE = ['¡Muy bien armada!', '¡Excelente!', '¡Así se arma una oración!', '¡Perfecto!']
const FIRST_WORD_HINT = 'Esa no va primero. Empezá por la palabra que tiene mayúscula.'
const NUDGES = [
  'Esa todavía no va. Pensá cómo sigue la oración.',
  'Casi. Leé en voz alta lo que armaste y fijate qué palabra sigue.',
  'No es esa. Probá con otra palabra.',
]

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
  const { orders, tiles } = content
  const total = orders[0].length

  const [placedIds, setPlacedIds] = useState<number[]>([])
  const [wrongId, setWrongId] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

  const placed = placedIds.flatMap((id) => tiles.find((t) => t.id === id) ?? [])
  const bank = tiles.filter((t) => !placedIds.includes(t.id))

  function handleTap(tile: Tile) {
    // A second tap on the word that is still flashing as wrong is a double tap,
    // not a second mistake.
    if (solved || wrongId === tile.id) return
    const nextWords = [...placed.map((t) => t.value), tile.value]
    if (startsLikeAnOrder(orders, nextWords)) {
      setPlacedIds((ids) => [...ids, tile.id])
      setWrongId(null)
      setHint(null)
      if (isFullOrder(orders, nextWords)) {
        setSolved(true)
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setWrongId(tile.id)
      setHint(placed.length === 0 ? FIRST_WORD_HINT : pickOne(NUDGES))
      onMistake()
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setWrongId(null), 600)
    }
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Armá la oración</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá las palabras en el orden en que van. Empezá por la que tiene mayúscula.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {placed.length} de {total}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(placed.length / total) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* The sentence being built — stays on screen once solved */}
      <div
        className={[
          'mt-5 min-h-[72px] rounded-2xl border-2 p-3',
          solved ? 'border-tiam-green/40 bg-tiam-green/5' : 'border-dashed border-slate-200 bg-slate-50',
        ].join(' ')}
      >
        {placed.length === 0 ? (
          <p className="py-2 text-center text-base text-slate-400">Tocá la primera palabra de abajo</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {placed.map((tile) => (
              <span
                key={tile.id}
                className="flex min-h-[44px] items-center rounded-xl border-2 border-tiam-green bg-tiam-green/10 px-3 text-lg font-bold text-slate-900"
              >
                {tile.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Word bank */}
      {!solved && (
        <>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {bank.map((tile) => {
              const isWrong = wrongId === tile.id
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handleTap(tile)}
                  className={[
                    'min-h-[48px] rounded-xl border-2 px-4 py-2 text-lg font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40',
                    isWrong
                      ? 'border-slate-300 bg-slate-100 text-slate-500 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {tile.value}
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-4 min-h-[3rem] text-center text-base font-medium text-slate-500">
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
          <p className="mt-1 text-slate-600">Armaste la oración entera. ¡Completaste el {level.name.toLowerCase()}!</p>
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

export function OrdenaLaOracion({ onComplete }: GameProps) {
  // Which sentence each level plays, and the bank's order — decided once, at
  // mount, so "Repetir" replays exactly the same content.
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
