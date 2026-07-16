import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Las mismas letras" — an anagram-MATCHING game for ejecutivas (mentally
 * rearranging letters is working memory, not vocabulary). Two columns of
 * words; tap one on the left, then one on the right — if they're anagrams
 * of each other (exact same letters, just reordered), they lock in as a
 * matched pair. A wrong pairing is never a hard fail: a gentle text hint
 * plays and both tiles quietly deselect, fully retryable — same "never red"
 * rule as every other game in this folder.
 *
 * Reuses Memotest's two-tap selection state machine (pick one, pick a
 * second, compare, lock-in or deselect), adapted from a single grid to two
 * separate columns: `selectedLeft`/`selectedRight` replace Memotest's single
 * `pending` array. Evaluation happens synchronously inside whichever tap
 * handler completes the pair (never in a `useEffect` watching "are both
 * sides selected"), so there's no stale-render window.
 *
 * ONE board per level, no inner round-index layer — same shape as
 * TuResumen.tsx (which deliberately has no `roundIdx`): a 5-pair board is
 * already 10+ taps, so stacking a round-within-level layer on top would make
 * this one of the longest games in the folder. `LEVELS.length === 3` and
 * each level's board IS the round.
 *
 * Difficulty ramp removes the length cue as levels progress: L1/L2 mix word
 * lengths (length alone narrows candidates), L3 uses ALL-5-letter words so
 * matching has to come from actually comparing letter sets, not sizing them
 * up at a glance.
 *
 * Content note: camisón/mocasín (L1) is a genuine anagram once accents are
 * read as their base vowel (ó≈o, í≈i) — same 7 letters, same counts, just
 * different accented vowels land in different words. Every pair below was
 * verified letter-by-letter (diacritics normalized) before being hardcoded;
 * matching at runtime is by `pairId` (assigned once in buildBoard), never by
 * re-deriving anagram-equality from the word text, so this is a content note
 * for whoever edits LEVELS next, not a runtime concern.
 */

interface WordPair {
  a: string
  b: string
}
interface Level {
  n: number
  name: string
  pairs: WordPair[]
  hint?: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    pairs: [
      { a: 'lobo', b: 'bolo' },
      { a: 'trigo', b: 'grito' },
      { a: 'camisón', b: 'mocasín' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    pairs: [
      { a: 'saco', b: 'cosa' },
      { a: 'andar', b: 'nadar' },
      { a: 'sentido', b: 'destino' },
      { a: 'Brasil', b: 'silbar' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    pairs: [
      { a: 'calvo', b: 'clavo' },
      { a: 'perla', b: 'pelar' },
      { a: 'corte', b: 'recto' },
      { a: 'pleno', b: 'polen' },
      { a: 'barco', b: 'cobra' },
    ],
    hint: 'Ahora todas las palabras tienen el mismo largo: vas a tener que fijarte bien en las letras de cada una, no en el tamaño.',
  },
]

// Fixed total of successful matches across the whole day (3+4+5) — every
// pair is matched exactly once no matter how many mismatches happen along
// the way, so this is a derivable constant rather than a piece of state to
// track. Same pattern as Memotest's TOTAL_PAIRS.
const TOTAL_PAIRS = LEVELS.reduce((sum, l) => sum + l.pairs.length, 0)

interface WordTile {
  pairId: number
  word: string
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

// Randomizes which word of each pair lands in the left vs. right column,
// then shuffles the order within each column independently — so pairs never
// line up row-by-row and column position carries no information.
function buildBoard(level: Level): { left: WordTile[]; right: WordTile[] } {
  const left: WordTile[] = []
  const right: WordTile[] = []
  level.pairs.forEach((pair, pairId) => {
    const [first, second] = Math.random() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a]
    left.push({ pairId, word: first })
    right.push({ pairId, word: second })
  })
  return { left: shuffle(left), right: shuffle(right) }
}

const MISMATCH_LINES = [
  'Esas no tienen las mismas letras. ¡Probá con otra combinación!',
  'Casi... pero no son la misma palabra reordenada.',
  '¡Buen intento! Fijate bien en las letras de cada palabra.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente ojo para las letras!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena observación!']

export function LasMismasLetras({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const board = useMemo(
    () => buildBoard(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [matchedPairIds, setMatchedPairIds] = useState<Set<number>>(new Set())
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)
  const [selectedRight, setSelectedRight] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [mismatchLine, setMismatchLine] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Mistake count, accumulated across levels 1→2→3 and only zeroed on a true
  // day restart (see nextLevel's wrap branch below) — same policy as
  // Memotest/CuantosHay.
  const [mistakes, setMistakes] = useState(0)

  const done = matchedPairIds.size >= level.pairs.length

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  // Fires once per roundKey when level 3's board is fully matched. A full
  // day restart (the wrap to level 1) gets a new roundKey, so a genuine
  // replay reports again; re-rendering while already done on level 3 does
  // not fire twice. totalAttempts = accumulated mistakes + total successful
  // matches across all 3 levels (a fixed constant — every pair is matched
  // exactly once) — derived here rather than adding a second piece of state.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PAIRS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  // Compares the current left/right picks. Correct pairs hold both tiles
  // selected for a beat before locking in green (so the match reads as
  // deliberate, not instant); wrong pairs hold for longer with a text hint,
  // then both quietly deselect — never red, always retryable. Same 500ms /
  // 1200ms timing as Memotest's match/mismatch.
  function evaluate(leftIdx: number, rightIdx: number) {
    setLocked(true)
    const leftTile = board.left[leftIdx]
    const rightTile = board.right[rightIdx]

    if (leftTile.pairId === rightTile.pairId) {
      window.setTimeout(() => {
        setMatchedPairIds((prev) => new Set(prev).add(leftTile.pairId))
        setSelectedLeft(null)
        setSelectedRight(null)
        setLocked(false)
      }, 500)
    } else {
      setMismatchLine(pickOne(MISMATCH_LINES))
      setMistakes((m) => m + 1)
      window.setTimeout(() => {
        setSelectedLeft(null)
        setSelectedRight(null)
        setLocked(false)
        setMismatchLine(null)
      }, 1200)
    }
  }

  function handleTap(side: 'left' | 'right', index: number) {
    if (locked || done) return
    const tile = (side === 'left' ? board.left : board.right)[index]
    if (matchedPairIds.has(tile.pairId)) return

    const isLeft = side === 'left'
    const ownSelected = isLeft ? selectedLeft : selectedRight
    const otherSelected = isLeft ? selectedRight : selectedLeft
    if (ownSelected === index) return // re-tap on the already-selected tile: no-op

    if (isLeft) setSelectedLeft(index)
    else setSelectedRight(index)

    if (otherSelected === null) return // still waiting on the other column

    const leftIdx = isLeft ? index : otherSelected
    const rightIdx = isLeft ? otherSelected : index
    evaluate(leftIdx, rightIdx)
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see CuantosHay.tsx
  // for why: an effect only catches up on the render AFTER levelIdx changes,
  // so `done` (derived from matchedPairIds vs. the NEW level's pairs) could
  // read stale-true on the very render that just arrived at the new level.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setMatchedPairIds(new Set())
    setSelectedLeft(null)
    setSelectedRight(null)
    setLocked(false)
    setMismatchLine(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra vuelta" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setMatchedPairIds(new Set())
    setSelectedLeft(null)
    setSelectedRight(null)
    setLocked(false)
    setMismatchLine(null)
  }

  function renderTile(side: 'left' | 'right', tile: WordTile, index: number) {
    const isMatched = matchedPairIds.has(tile.pairId)
    const isSelected = (side === 'left' ? selectedLeft : selectedRight) === index
    return (
      <button
        key={index}
        type="button"
        disabled={isMatched || locked}
        onClick={() => handleTap(side, index)}
        className={[
          'relative min-h-[44px] w-full rounded-xl border-2 px-3 py-2.5 text-center text-sm font-semibold transition',
          'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 sm:text-base',
          isMatched
            ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
            : isSelected
              ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900 ring-2 ring-tiam-blue/30'
              : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
        ].join(' ')}
      >
        {tile.word}
        {isMatched && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Encontrá las palabras con las mismas letras
            </h2>
            <p className="mt-2 text-base text-slate-500">
              {level.hint ??
                'Tocá una palabra de la izquierda y otra de la derecha. Si tienen las mismas letras, forman pareja.'}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Encontraste {matchedPairIds.size} de {level.pairs.length} parejas
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(matchedPairIds.size / level.pairs.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Board */}
      {!done && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {board.left.map((tile, index) => renderTile('left', tile, index))}
            </div>
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {board.right.map((tile, index) => renderTile('right', tile, index))}
            </div>
          </div>

          {mismatchLine && (
            <p className="mt-4 text-center text-sm font-medium text-slate-500">{mismatchLine}</p>
          )}
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
            ¡Encontraste las {level.pairs.length} parejas — completaste el {level.name.toLowerCase()}!
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
              Otra vuelta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
