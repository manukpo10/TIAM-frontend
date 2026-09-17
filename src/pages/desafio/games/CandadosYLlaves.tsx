import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Candados y llaves" — visuospatial matching, área orientación. Adapted from
 * a paper exercise: padlocks each showing a keyhole silhouette, and a pile of
 * loose keys; work out which key opens which lock. The touch version shows
 * ONE padlock and 4 keys per round — tap the key whose teeth match the
 * keyhole.
 *
 * Shape model: a key's bit is an array of 4 tooth heights, each 0-3 (e.g.
 * [2, 0, 3, 1]) — see `ToothPattern`. The keyhole is drawn from the exact
 * same kind of array, just through a different container/fill: `ToothRow`
 * renders both, called once from `KeySvg` (solid teeth hanging off a shaft)
 * and once from `PadlockSvg` (notches hanging into a dark channel, same
 * positions). "Matches" is therefore literal array equality in code — the
 * correct option's `pattern` IS the round's `target` — never a pixel or
 * visual computation. This is a schematic, not a photo-real lock: the goal
 * is reading instantly at 375px wide, not physical plausibility.
 *
 * Decoy construction (by construction, never generate-and-retry):
 * `ditherAt(base, positions)` copies `base` and forces a DIFFERENT height at
 * every index in `positions`, so the result's Hamming distance from `base`
 * is EXACTLY `positions.length` — never more (untouched teeth are copied
 * verbatim) and never less (every touched tooth is forced away from its
 * original value). Two decoys built from DIFFERENT position-sets against the
 * same base can therefore never collide: take any index where the two sets
 * disagree and exactly one decoy keeps the base's original value there. That
 * single fact is what lets every level below sample position-sets WITHOUT
 * replacement from `combinations(k)` and end up with 4 pairwise-distinct
 * options, with zero runtime collision checks anywhere in this file:
 *   - L1: 3 decoys, each changing 3 of the 4 teeth — obviously wrong.
 *   - L2: 3 decoys, each changing exactly 2 teeth — needs a real look.
 *   - L3: 2 decoys changing exactly 1 tooth (the closest a wrong key can
 *     get) plus the classic trap — the target's own teeth, reversed. The
 *     reversed decoy can never collide with the target OR the two 1-tooth
 *     decoys: `makeBasePattern` always forces tooth 0 and the last tooth
 *     apart, which is enough on its own to guarantee the array is never a
 *     palindrome (a palindrome needs EVERY mirrored pair to match, so
 *     breaking just the outer one already breaks it) — so reversing the
 *     array always flips BOTH of those positions at once, while a genuine
 *     1-tooth decoy, by construction, only ever flips ONE. Two patterns that
 *     differ from the target in a different number of positions can't be
 *     equal to each other, so all 4 options stay distinct no matter which
 *     single tooth the other two decoys happened to change.
 */

const TOOTH_COUNT = 4
const HEIGHTS: number[] = [0, 1, 2, 3]

type ToothPattern = number[]

// x-offsets shared by KeySvg and PadlockSvg so tooth `i` sits at the same
// relative spot in both drawings — comparing them is a straight vertical
// read, never a mental remapping.
const TOOTH_X = [2, 10, 18, 26]
const TOOTH_WIDTH = 6
// Shortest tooth is still a visible nub (never a 0-height/invisible rect) —
// every tooth must read as "present but shallow", never as "missing".
const TOOTH_BASE_PX = 4
const TOOTH_STEP_PX = 6

function toothLength(height: number): number {
  return TOOTH_BASE_PX + height * TOOTH_STEP_PX
}

// Flat hex fills reusing the brand tokens from index.css's @theme block —
// same hardcode-with-comment convention EncontraLaFiguraIgual/ElReloj use,
// since an SVG `fill` needs a literal color, not a Tailwind class.
const KEY_COLOR = '#1B6FC4' // tiam-blue
const LOCK_BODY_COLOR = '#15436F' // tiam-blue-dark
const LOCK_SHACKLE_COLOR = '#5A6B82' // tiam-gray
const LOCK_SLOT_COLOR = '#0f172a' // slate-900 — recessed channel, dark enough that KEY_COLOR notches read clearly against it

function ToothRow({ pattern, fill, top }: { pattern: ToothPattern; fill: string; top: number }) {
  return (
    <>
      {pattern.map((h, i) => (
        <rect
          key={i}
          x={TOOTH_X[i] - TOOTH_WIDTH / 2}
          y={top}
          width={TOOTH_WIDTH}
          height={toothLength(h)}
          rx={2}
          fill={fill}
        />
      ))}
    </>
  )
}

// viewBox is wider than tall, matching a key's natural silhouette and the
// wide-short shape option tiles end up with (h-24 capped height, flexible
// width) — see the options grid below for why tiles are capped-height at all.
function KeySvg({ pattern }: { pattern: ToothPattern }) {
  return (
    <svg viewBox="-37 -17 75 46" className="h-full w-full" aria-hidden="true">
      {/* bow — a ring drawn via stroke, so it never needs to match whatever
          background happens to sit behind the tile (white, green-tinted on
          the revealed-correct tile, etc.) */}
      <circle cx="-20" cy="0" r="10" fill="none" stroke={KEY_COLOR} strokeWidth="6" />
      {/* shaft */}
      <rect x="-6" y="-3" width="40" height="6" rx="2" fill={KEY_COLOR} />
      {/* teeth, hanging from the shaft's underside */}
      <ToothRow pattern={pattern} fill={KEY_COLOR} top={3} />
    </svg>
  )
}

// viewBox is taller than wide (shackle sits above the body), which fits the
// target box's aspect-square shape the same way EncontraLaFiguraIgual's
// target shape does.
function PadlockSvg({ pattern }: { pattern: ToothPattern }) {
  return (
    <svg viewBox="-18 -36 66 78" className="h-full w-full" aria-hidden="true">
      {/* shackle */}
      <path
        d="M 3,-6 V -20 A 12 12 0 0 1 27,-20 V -6"
        fill="none"
        stroke={LOCK_SHACKLE_COLOR}
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* body */}
      <rect x="-14" y="-6" width="58" height="44" rx="10" fill={LOCK_BODY_COLOR} />
      {/* keyway channel */}
      <rect x="-4" y="0" width="36" height="28" rx="4" fill={LOCK_SLOT_COLOR} />
      {/* the required profile — same ToothRow as KeySvg, anchored at the
          channel's ceiling (top=0) instead of a shaft's underside, so it
          reads as notches hanging DOWN into the slot rather than teeth
          hanging off a blade. Same array, same positions, different frame. */}
      <ToothRow pattern={pattern} fill={KEY_COLOR} top={0} />
    </svg>
  )
}

interface KeyOption {
  key: string
  pattern: ToothPattern
  correct: boolean
}
interface Round {
  target: ToothPattern
  options: KeyOption[]
}
interface Level {
  n: number
  name: string
  rounds: number
  hint?: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    // No `hint`: at level 1 there's nothing to add the heading doesn't
    // already say — same call EncontraLaFiguraIgual makes for its L1.
    name: 'Nivel 1',
    rounds: 3,
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    hint: 'Ahora las llaves se parecen más — mirá diente por diente.',
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    hint: 'Ojo: una llave tiene los mismos dientes pero al revés. Esa no abre.',
  },
]

// Every round resolves via a genuine correct tap (no give-up path here), so
// totalAttempts = mistakes + this fixed total — same shape as EncontraLaFiguraIgual.
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

// All k-element subsets of the 4 tooth positions, in lexicographic order.
// Small and fixed (TOOTH_COUNT = 4), so plain recursion is plenty — this
// exists purely so `makeRound` can sample DISTINCT position-sets without
// replacement instead of hand-maintaining separate literal lists per k.
function combinations(k: number): number[][] {
  const out: number[][] = []
  function go(start: number, chosen: number[]) {
    if (chosen.length === k) {
      out.push(chosen)
      return
    }
    for (let i = start; i < TOOTH_COUNT; i++) go(i + 1, [...chosen, i])
  }
  go(0, [])
  return out
}

// Returns `pattern` with the height at each of `positions` replaced by a
// DIFFERENT height — see the file header for why this guarantees an exact
// Hamming distance and, from that, why distinct decoys never collide.
function ditherAt(pattern: ToothPattern, positions: number[]): ToothPattern {
  const next = [...pattern]
  for (const pos of positions) {
    const alternatives = HEIGHTS.filter((h) => h !== pattern[pos])
    next[pos] = pickOne(alternatives)
  }
  return next
}

// The round's correct pattern. Forcing tooth 0 and the last tooth apart is
// enough to guarantee the array is never a palindrome (see file header) —
// that's what keeps the L3 reversed decoy always distinct from the answer.
function makeBasePattern(): ToothPattern {
  const first = pickOne(HEIGHTS)
  const last = pickOne(HEIGHTS.filter((h) => h !== first))
  const middle = Array.from({ length: TOOTH_COUNT - 2 }, () => pickOne(HEIGHTS))
  return [first, ...middle, last]
}

function makeRound(levelIdx: number): Round {
  const target = makeBasePattern()

  let decoyPatterns: ToothPattern[]
  if (levelIdx === 0) {
    // L1 — obviously wrong: 3 decoys, each built from a distinct 3-position
    // subset (4 possible, sampled without replacement), so each changes 3 of
    // the 4 teeth.
    const sets = shuffle(combinations(3)).slice(0, 3)
    decoyPatterns = sets.map((positions) => ditherAt(target, positions))
  } else if (levelIdx === 1) {
    // L2 — decoys differ in exactly 2 teeth: 3 distinct 2-position subsets
    // out of the 6 possible.
    const sets = shuffle(combinations(2)).slice(0, 3)
    decoyPatterns = sets.map((positions) => ditherAt(target, positions))
  } else {
    // L3 — the hard level. Two decoys change exactly ONE tooth (2 of the 4
    // single-position subsets). The third is the reversed target — see the
    // file header for why it can never equal the target or either 1-tooth decoy.
    const sets = shuffle(combinations(1)).slice(0, 2)
    const oneToothDecoys = sets.map((positions) => ditherAt(target, positions))
    decoyPatterns = [...oneToothDecoys, [...target].reverse()]
  }

  const correct: KeyOption = { key: target.join('-'), pattern: target, correct: true }
  const decoys: KeyOption[] = decoyPatterns.map((pattern) => ({
    key: pattern.join('-'),
    pattern,
    correct: false,
  }))
  return { target, options: shuffle([correct, ...decoys]) }
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa llave no entra — probá con otra.',
  'Casi. Comparala diente por diente con el candado.',
  'No es esa — fijate bien en la altura de cada diente.',
]

export function CandadosYLlaves({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `level.rounds` rounds generated once per level/roundKey, not on every
  // round advance — same pattern as EncontraLaFiguraIgual/QueObjetoEs.
  const rounds = useMemo(
    () => Array.from({ length: level.rounds }, () => makeRound(levelIdx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(option: KeyOption) {
    if (!round || resolved || eliminated.has(option.key)) return
    if (option.correct) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(option.key))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see ElVuelto.tsx /
  // EncontraLaFiguraIgual.tsx for why: an effect-based reset lags one render
  // behind, letting `done` read stale-true right as levelIdx reaches the
  // last level and firing onComplete with garbage data.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count.
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when level 3's last round resolves. A full day
  // restart (the wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire twice.
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá la llave que abre el candado</h2>
            {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
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

      {!done && round && (
        <>
          {/* Padlock target, sized to match an option tile rather than fill
              the width — same reasoning as EncontraLaFiguraIgual's target
              box: a phone has to fit both rows of keys without scrolling,
              and a large reference against small candidates would add a
              rescaling step on top of the pattern-matching this game
              actually tests. p-1, not p-4: PadlockSvg's own viewBox margin
              already carries the artwork's breathing room. */}
          {/* Wider than the option tiles' own height on purpose. The padlock
              viewBox is portrait, so inside a square box it letterboxes and
              the notches end up drawn at roughly half the width the key teeth
              get — the two things the player has to compare were rendering at
              very different scales. Sizing up restores rough parity. */}
          <div className="relative mx-auto mt-3 aspect-square w-32 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-1 sm:mt-6 sm:w-40 sm:p-2">
            <PadlockSvg pattern={round.target} />
          </div>

          {/* Keys */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-6">
            {round.options.map((option, idx) => {
              const isEliminated = eliminated.has(option.key)
              const isCorrectShown = resolved && option.correct
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  aria-label={`Llave ${idx + 1}`}
                  className={[
                    // Capped height, not aspect-square: in a 2-column grid on
                    // a phone that made every tile too tall for the second
                    // row to fit above the fold — same fix EncontraLaFiguraIgual
                    // applies. p-1 for the same reason as the target box above.
                    'relative flex h-24 items-center justify-center rounded-2xl border-2 bg-white p-1 transition sm:h-32 sm:p-2',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 grayscale' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  <KeySvg pattern={option.pattern} />
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
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Abriste los {level.rounds} candados — ¡completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
