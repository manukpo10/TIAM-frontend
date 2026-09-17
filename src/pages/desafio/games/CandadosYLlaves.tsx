import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Candados y llaves" — visuospatial matching, área orientación. Adapted from
 * a paper exercise: padlocks each showing a keyhole, and a pile of loose keys;
 * work out which key opens which lock. The touch version shows ONE padlock and
 * 4 keys per round — tap the key that fits.
 *
 * THE KEY IS THE INVERSE OF THE LOCK. A key's bit is an array of 4 tooth
 * heights, each 0-3 (e.g. [2, 0, 3, 1]) — see `ToothPattern`. The padlock does
 * not repeat that shape: its channel shows PINS rising from the floor, each
 * one exactly as tall as the room the matching tooth leaves (`pinLength`), so
 * a long tooth sits over a short pin and a short tooth over a tall one. The
 * first version drew the lock with the same teeth as the key, which turned
 * the round into "find the identical key" — not how a key fits a lock. In
 * code the correct option's `pattern` is still the round's `target` (literal
 * array equality, never a pixel computation); only the drawing inverts it.
 * When the right key is tapped its teeth are drawn inside the padlock's
 * channel, so the player sees it fit.
 *
 * Decoy construction (by construction, never generate-and-retry):
 * `ditherAt(base, positions)` copies `base` and forces a DIFFERENT height at
 * every index in `positions`, so the result's Hamming distance from `base` is
 * EXACTLY `positions.length`. Two decoys built from DIFFERENT position-sets
 * against the same base can therefore never collide: take any index where the
 * two sets disagree and exactly one decoy keeps the base's original value
 * there. That is what lets every level sample position-sets WITHOUT
 * replacement from `combinations(k)`:
 *   - L1: 3 decoys, each changing 3 of the 4 teeth — obviously wrong.
 *   - L2: 2 decoys changing exactly 2 teeth, plus the trap: the key that
 *     looks the SAME as the lock (`sameAsLock`, every tooth h → 3 − h).
 *   - L3: 2 decoys changing exactly 1 tooth, plus the same trap.
 * The trap differs from the target in all 4 teeth (h and 3 − h are never
 * equal for whole heights), and every other decoy in its round differs in 1
 * or 2, so all 4 options stay distinct: two patterns that differ from the
 * target in a different number of positions can't be equal to each other.
 */

const TOOTH_COUNT = 4
const HEIGHTS: number[] = [0, 1, 2, 3]
const MAX_HEIGHT = 3

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

// The padlock's keyway: teeth come down from the ceiling (y = 0), pins rise
// from the floor, and a matching pair leaves a small gap between them.
const CHANNEL_DEPTH = 28
const FIT_GAP = 2

// The pin under tooth `height`: the tallest tooth (22) gets the shortest pin
// (4) and the shortest tooth (4) the tallest pin (22) — the same lengths in
// reverse, which is exactly what makes the lock the key's inverse.
function pinLength(height: number): number {
  return CHANNEL_DEPTH - FIT_GAP - toothLength(height)
}

// The key whose teeth look identical to the lock's pins: toothLength(3 − h)
// equals pinLength(h) for every height.
function sameAsLock(pattern: ToothPattern): ToothPattern {
  return pattern.map((h) => MAX_HEIGHT - h)
}

// Flat hex fills reusing the brand tokens from index.css's @theme block —
// same hardcode-with-comment convention EncontraLaFiguraIgual/ElReloj use,
// since an SVG `fill` needs a literal color, not a Tailwind class.
const KEY_COLOR = '#1B6FC4' // tiam-blue
const LOCK_BODY_COLOR = '#15436F' // tiam-blue-dark
const LOCK_SHACKLE_COLOR = '#5A6B82' // tiam-gray
const LOCK_SLOT_COLOR = '#0f172a' // slate-900 — recessed channel
const LOCK_PIN_COLOR = '#CBD5E1' // slate-300 — light against the dark channel, and never mistaken for a blue key tooth

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
// target shape does. `pattern` is the KEY that opens it: the lock draws the
// pins that pattern needs, and `fitted` also draws the key's teeth in place.
function PadlockSvg({ pattern, fitted }: { pattern: ToothPattern; fitted: boolean }) {
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
      <rect x="-4" y="0" width="36" height={CHANNEL_DEPTH} rx="4" fill={LOCK_SLOT_COLOR} />
      {/* pins, rising from the channel floor */}
      {pattern.map((h, i) => (
        <rect
          key={i}
          x={TOOTH_X[i] - TOOTH_WIDTH / 2}
          y={CHANNEL_DEPTH - pinLength(h)}
          width={TOOTH_WIDTH}
          height={pinLength(h)}
          rx={2}
          fill={LOCK_PIN_COLOR}
        />
      ))}
      {/* the right key's teeth, dropped in from the top once it's found */}
      {fitted && <ToothRow pattern={pattern} fill={KEY_COLOR} top={0} />}
    </svg>
  )
}

interface KeyOption {
  key: string
  pattern: ToothPattern
  correct: boolean
  /** The trap key that looks identical to the lock (see the file header). */
  sameAsLock: boolean
}
interface Round {
  target: ToothPattern
  options: KeyOption[]
}
interface Level {
  n: number
  name: string
  rounds: number
  hint: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 3,
    hint: 'La llave que abre es la inversa del candado: donde el candado es alto, la llave es corta.',
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    hint: 'Cuidado: una de las llaves es igual al candado, y esa no entra.',
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    hint: 'Ahora las llaves cambian de a un diente — mirá bien cada uno.',
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

// The round's correct key. The first and last teeth are forced apart so no
// lock comes out flat (four pins of the same height give nothing to read).
function makeBasePattern(): ToothPattern {
  const first = pickOne(HEIGHTS)
  const last = pickOne(HEIGHTS.filter((h) => h !== first))
  const middle = Array.from({ length: TOOTH_COUNT - 2 }, () => pickOne(HEIGHTS))
  return [first, ...middle, last]
}

function makeRound(levelIdx: number): Round {
  const target = makeBasePattern()

  let decoyPatterns: ToothPattern[]
  let trap: ToothPattern | null = null
  if (levelIdx === 0) {
    // L1 — obviously wrong: 3 decoys, each built from a distinct 3-position
    // subset (4 possible, sampled without replacement), so each changes 3 of
    // the 4 teeth.
    const sets = shuffle(combinations(3)).slice(0, 3)
    decoyPatterns = sets.map((positions) => ditherAt(target, positions))
  } else {
    // L2 changes 2 teeth, L3 only 1; both add the key that looks like the
    // lock. See the file header for why the four options never collide.
    const changed = levelIdx === 1 ? 2 : 1
    const sets = shuffle(combinations(changed)).slice(0, 2)
    decoyPatterns = sets.map((positions) => ditherAt(target, positions))
    trap = sameAsLock(target)
  }

  const toOption = (pattern: ToothPattern, correct: boolean, isTrap: boolean): KeyOption => ({
    key: pattern.join('-'),
    pattern,
    correct,
    sameAsLock: isTrap,
  })
  const options = [
    toOption(target, true, false),
    ...decoyPatterns.map((pattern) => toOption(pattern, false, false)),
    ...(trap ? [toOption(trap, false, true)] : []),
  ]
  return { target, options: shuffle(options) }
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa llave no entra — probá con otra.',
  'Casi. Donde el candado es alto, la llave tiene que ser corta.',
  'No es esa — buscá la llave que llena los huecos del candado.',
]
const SAME_AS_LOCK_HINT = 'Esa es igual al candado, por eso no entra. Buscá la que es al revés.'

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
    setHint(option.sameAsLock ? SAME_AS_LOCK_HINT : pickOne(HINTS))
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá la llave que encaja en el candado</h2>
            <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>
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
            <PadlockSvg pattern={round.target} fitted={resolved} />
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
