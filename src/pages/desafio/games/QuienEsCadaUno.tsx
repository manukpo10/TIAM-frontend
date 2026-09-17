import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Quién es cada uno?" — día 16, ejecutivas. A logic-grid puzzle adapted
 * from a paper worksheet: a numbered row of simple figures with visibly
 * different heights (and sometimes one accessory each), a set of clues
 * about NAMED people, and a bank of names — the player works out which
 * name goes on which figure and taps them into place.
 *
 * DECIDABLE-FROM-THE-DRAWING RULE: every clue is checkable by looking ONLY
 * at what's drawn — the number badge on each figure, and its height
 * relative to the others (never a pixel-judgement call: heights step by a
 * fixed amount per rank, see heightPx() below, so "más alto/más bajo" is
 * unmistakable at 375px), plus, when present, one accessory. Position
 * words always resolve against the visible number badge ("número par",
 * "número 1", "último lugar"), never against an ambiguous "left/right"
 * reading. Clothes colours vary but no clue ever mentions a colour.
 *
 * THE FIGURES ARE ILLUSTRATIONS (Flux, same flat line-art style as the
 * quien-lo-dijo portraits), one per figure, standing and cropped from the
 * top of the head (or hat) to the shoes, so scaling an image to
 * heightPx(rank) makes the drawn person that tall. Three things keep them
 * honest to the clues: each illustration carries exactly the accessory its
 * data says and no other (generated with every other accessory in the
 * negative prompt); a hat adds height above the head, so hatted figures get
 * HAT_ALLOWANCE (both are the tallest of their group, so erring high can
 * only make the tallest look taller); and "anteojos" became "bufanda",
 * because glasses on a full-body figure this size are too small to see.
 * Each illustration also shows the gender of the name that solves its
 * position — a figure called Rosa can't look like a man — which makes some
 * placements quicker without changing the one solution.
 *
 * UNIQUENESS INVARIANT: each puzzle's clue set was authored against a
 * fixed (figures, solution) pair and proven — by a throwaway brute-force
 * script that enumerated every permutation of names over positions — to
 * admit EXACTLY ONE satisfying assignment, and that it's the intended
 * one. Both L3 puzzles are fully irreducible (removing any single clue
 * admits a second solution), so the hardest level always needs real
 * deduction; L1 and L2 keep one or two clues that elimination alone would
 * also reach (unavoidable once headcount is only 3 or 4 — pinning
 * all-but-one position always forces the last by elimination) — kept
 * because they're still true and help the player confirm their reasoning,
 * never because any single clue gives the whole board away.
 *
 * DIFFERENCE FROM PistasConvergentes.tsx / DeduciLaPalabra.tsx: both of
 * those resolve a list of CANDIDATES down to a SINGLE word, via
 * convergent association or elimination — one unknown, picked from a
 * fixed multiple-choice list. This game assigns MULTIPLE names to
 * MULTIPLE positions at once (a small constraint-satisfaction problem,
 * closer to a logic grid than a multiple-choice question) and never shows
 * a list of options to rule out — you place a name, and either the whole
 * board is right or only the wrong placements bounce back for another
 * try.
 *
 * Structural template is SumaHastaDiez.tsx (not the other two): no
 * ready/splash screen — the instruction lives in the persistent header —
 * and a wrong full board is never a hard fail (muted slate, never red;
 * only the wrong names return to the bank). No timers.
 */

type Accessory = 'hat' | 'scarf' | 'bag'

interface Figure {
  heightRank: number
  accessory?: Accessory
  /** File name (without .webp) in assets/desafio/games/quien-es-cada-uno. */
  art: string
}

interface Puzzle {
  figures: Figure[]
  /** names[i] is the correct name for figures[i] (position i+1) — this IS the solution. */
  names: string[]
  clues: string[]
}

interface Level {
  n: number
  name: string
  headCount: number
  pool: Puzzle[]
}

// 2 hand-authored puzzles per level (one is picked when the day opens and
// "Repetir" replays it) — each verified offline (scratchpad, deleted) to have
// exactly one valid name-to-figure assignment. Difficulty scales by
// headcount: 3 → 4 → 5 people.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    headCount: 3,
    pool: [
      {
        figures: [{ heightRank: 2, art: 'l1p1-1' }, { heightRank: 3, art: 'l1p1-2' }, { heightRank: 1, art: 'l1p1-3' }],
        names: ['Juan', 'Alberto', 'Rosa'],
        clues: ['Juan está en el número 1.', 'Alberto es el más alto de los tres.', 'Rosa es la más baja de los tres.'],
      },
      {
        figures: [{ heightRank: 1, art: 'l1p2-1' }, { heightRank: 3, art: 'l1p2-2' }, { heightRank: 2, art: 'l1p2-3' }],
        names: ['Carmen', 'Enrique', 'Miguel'],
        clues: [
          'Carmen es la más baja de los tres.',
          'Enrique es el más alto de los tres.',
          'Miguel está en el último lugar.',
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    headCount: 4,
    pool: [
      {
        figures: [{ heightRank: 3, art: 'l2p1-1' }, { heightRank: 1, art: 'l2p1-2' }, { heightRank: 4, accessory: 'hat', art: 'l2p1-3' }, { heightRank: 2, art: 'l2p1-4' }],
        names: ['Pedro', 'Lucía', 'Roberto', 'Susana'],
        clues: [
          'Pedro está en un número impar.',
          'Lucía es la más baja del grupo.',
          'Roberto es el que usa sombrero.',
          'Susana está en un número par.',
        ],
      },
      {
        figures: [{ heightRank: 2, art: 'l2p2-1' }, { heightRank: 4, art: 'l2p2-2' }, { heightRank: 1, art: 'l2p2-3' }, { heightRank: 3, accessory: 'scarf', art: 'l2p2-4' }],
        names: ['Marta', 'Oscar', 'Beatriz', 'Juan'],
        clues: [
          'Marta está en un número impar.',
          'Oscar es el más alto del grupo.',
          'Beatriz es la más baja del grupo.',
          'Juan es el que usa bufanda.',
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    headCount: 5,
    pool: [
      {
        figures: [
          { heightRank: 3, art: 'l3p1-1' },
          { heightRank: 5, accessory: 'hat', art: 'l3p1-2' },
          { heightRank: 1, art: 'l3p1-3' },
          { heightRank: 4, art: 'l3p1-4' },
          { heightRank: 2, art: 'l3p1-5' },
        ],
        names: ['Alberto', 'Elena', 'Silvia', 'Ricardo', 'Teresa'],
        clues: [
          'Elena es la que usa sombrero.',
          'Ricardo está en un número par.',
          'Teresa está en el último lugar.',
          'Alberto y Ricardo son más altos que Silvia.',
        ],
      },
      {
        figures: [
          { heightRank: 4, art: 'l3p2-1' },
          { heightRank: 2, art: 'l3p2-2' },
          { heightRank: 5, art: 'l3p2-3' },
          { heightRank: 1, accessory: 'bag', art: 'l3p2-4' },
          { heightRank: 3, art: 'l3p2-5' },
        ],
        names: ['Roberto', 'María', 'Carlos', 'Rosa', 'Hugo'],
        clues: [
          'Rosa es la que lleva bolso.',
          'Carlos es el más alto del grupo.',
          'Roberto es más alto que María y que Hugo.',
          'María está en un número par.',
        ],
      },
    ],
  },
]

// One puzzle per level, every day the challenge is opened — this is the
// fixed per-day denominator for totalAttempts (3 + 4 + 5 = 12), not a
// running count, because headcount per level never varies.
const TOTAL_PEOPLE = LEVELS.reduce((sum, lvl) => sum + lvl.headCount, 0)

// Full class strings, never interpolated — same convention as SumaHastaDiez.
const FIGURES_GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-3 gap-3',
  2: 'grid-cols-4 gap-2',
  3: 'grid-cols-5 gap-1.5',
}

const ACCESSORY_LABEL: Record<Accessory, string> = {
  hat: 'con sombrero',
  scarf: 'con bufanda',
  bag: 'con bolso',
}

const HINTS = [
  'Casi. Alguno de los nombres no va ahí — repasá las pistas con calma.',
  'Todavía no. Fijate bien las alturas y los números antes de tocar de nuevo.',
  'No es esa combinación. Volvé a leer las pistas una por una.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente razonamiento!', '¡Así se deduce!', '¡Perfecto!']

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
// names[] IS the solution in position order, so a shuffle that lands back on
// it would lay the bank out as the answer key — reshuffle until it doesn't.
function shuffleAwayFromSolution(names: string[]): string[] {
  let order = shuffle(names)
  while (order.every((name, i) => name === names[i])) order = shuffle(names)
  return order
}

// Fixed step per height rank — a gap wide enough that "más alto/más bajo"
// reads as obvious rather than a judgement call. Sized so the widest
// illustration still fits a level-3 column (5 across at 375px) without
// being shrunk, which would silently change its apparent height.
const HEIGHT_BASE_PX = 72
const HEIGHT_STEP_PX = 18
function heightPx(rank: number): number {
  return HEIGHT_BASE_PX + (rank - 1) * HEIGHT_STEP_PX
}

// A hat sits above the head, so a hatted figure is drawn taller by this
// factor and its body still measures heightPx(rank). Both hats in the data
// belong to the tallest figure of their group, so erring high can only make
// the tallest look taller — it never flips an order.
const HAT_ALLOWANCE = 1.16

const FIGURE_ART = import.meta.glob('../../../assets/desafio/games/quien-es-cada-uno/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function artFor(id: string): string | undefined {
  return Object.entries(FIGURE_ART).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

function heightDescription(rank: number, maxRank: number): string {
  if (rank === maxRank) return 'la más alta del grupo'
  if (rank === 1) return 'la más baja del grupo'
  return `de altura media (puesto ${rank} de ${maxRank}, de más baja a más alta)`
}

// Never reveals the name assigned to the figure — only what's drawn.
function figureAriaLabel(position: number, figure: Figure, maxRank: number): string {
  const accessoryDesc = figure.accessory ? `, ${ACCESSORY_LABEL[figure.accessory]}` : ''
  return `Figura número ${position}, ${heightDescription(figure.heightRank, maxRank)}${accessoryDesc}`
}

function figureDrawHeight(figure: Figure): number {
  return Math.round(heightPx(figure.heightRank) * (figure.accessory === 'hat' ? HAT_ALLOWANCE : 1))
}

/** The illustration, scaled so its height IS the height signal. */
function PersonFigure({ figure }: { figure: Figure }) {
  return <img src={artFor(figure.art)} alt="" style={{ height: figureDrawHeight(figure) }} className="w-auto max-w-none" />
}

export function QuienEsCadaUno({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Which pool puzzle each level plays, picked once per level — at mount —
  // never re-rolled just because the player re-visits a level or hits
  // "Repetir", so a replay always brings back the same group and clues
  // (same content-freezing convention as SumaHastaDiez.tsx's `epoch`).
  const [epoch] = useState(() => LEVELS.map((lvl) => pickOne(lvl.pool)))
  const puzzle = epoch[levelIdx]
  const bankOrder = useMemo(() => shuffleAwayFromSolution(puzzle.names), [puzzle])
  const maxFigureHeight = Math.max(...puzzle.figures.map(figureDrawHeight))

  const [placements, setPlacements] = useState<(string | null)[]>(() => Array(LEVELS[0].headCount).fill(null))
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates 1→2→3 across levels, zeroed only on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  const placedCount = placements.filter((p) => p !== null).length
  const bankNames = bankOrder.filter((name) => !placements.includes(name))

  function handleBankTap(name: string) {
    if (solved) return
    setSelectedName((prev) => (prev === name ? null : name))
  }

  // Tapping a figure either places the selected name (bumping whatever was
  // there back to the bank, since the bank is just "names not currently
  // placed") or, with nothing selected, returns its placed name. Auto-checks
  // the instant every figure is named — that's the only place a puzzle
  // resolves, so a correct board is never second-guessed later.
  function handleFigureTap(position: number) {
    if (solved) return
    let next: (string | null)[]
    if (selectedName) {
      next = [...placements]
      next[position] = selectedName
      setSelectedName(null)
    } else if (placements[position] !== null) {
      next = [...placements]
      next[position] = null
    } else {
      return
    }
    setPlacements(next)
    if (next.some((p) => p === null)) return
    const isCorrect = next.every((name, i) => name === puzzle.names[i])
    if (isCorrect) {
      setSolved(true)
      setPraise(pickOne(PRAISE))
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
      // Only the wrong names bounce back to the bank — correct ones stay put.
      setPlacements(next.map((name, i) => (name === puzzle.names[i] ? name : null)))
    }
  }

  // Resets happen HERE, synchronously with the level/round change, never in
  // an effect keyed on levelIdx — an effect lags one render behind, so
  // `solved` would read the previous puzzle's stale-true value on the very
  // render that arrives at the new level and fire onComplete (or flash a
  // false completion card) with garbage. Same reasoning as SumaHastaDiez.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    const nextIdx = isWrap ? 0 : levelIdx + 1
    setLevelIdx(nextIdx)
    setRoundKey((k) => k + 1)
    setPlacements(Array(LEVELS[nextIdx].headCount).fill(null))
    setSelectedName(null)
    setSolved(false)
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level's puzzle is solved. A
  // genuine full-day restart (the wrap back to level 1) gets a new
  // roundKey, so it can report again.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (solved && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PEOPLE })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Quién es cada uno?</h2>
        <p className="mt-1 text-base text-slate-500">
          Tocá un nombre y después la figura que le corresponde, según las pistas.
        </p>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            {placedCount} de {level.headCount}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
              style={{ width: `${(placedCount / level.headCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pistas */}
      <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pistas</p>
        <ul className="mt-2 space-y-1.5">
          {puzzle.clues.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-base leading-snug text-slate-700">
              <span className="mt-0.5 font-bold text-tiam-blue">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Figuras numeradas */}
      <div className={`mt-4 grid ${FIGURES_GRID_CLASS[level.n]}`}>
        {puzzle.figures.map((figure, position) => {
          const placedName = placements[position]
          return (
            <button
              key={position}
              type="button"
              disabled={solved}
              onClick={() => handleFigureTap(position)}
              aria-label={figureAriaLabel(position + 1, figure, level.headCount)}
              aria-pressed={placedName !== null}
              className={[
                'relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-white px-1 pb-1.5 pt-1.5 transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                placedName
                  ? 'border-tiam-blue/50 bg-tiam-blue/5'
                  : 'border-slate-200 hover:border-tiam-blue/30 hover:shadow-sm',
              ].join(' ')}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-white">
                {position + 1}
              </span>
              <div className="flex items-end justify-center" style={{ height: maxFigureHeight }}>
                <PersonFigure figure={figure} />
              </div>
              <span
                className={[
                  'flex min-h-[28px] w-full items-center justify-center rounded-lg px-0.5 text-center text-[11px] font-semibold leading-tight',
                  placedName ? 'bg-tiam-blue text-white' : 'border border-dashed border-slate-300 text-slate-300',
                ].join(' ')}
              >
                {placedName ?? '?'}
              </span>
              {solved && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Banco de nombres */}
      {!solved && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {bankNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleBankTap(name)}
              aria-pressed={selectedName === name}
              className={[
                'min-h-[44px] rounded-xl border-2 px-4 text-base font-semibold transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                selectedName === name
                  ? 'border-tiam-blue bg-tiam-blue text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
              ].join(' ')}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

      {/* Completion */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Ubicaste a las {level.headCount} personas — ¡completaste el {level.name.toLowerCase()}!
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
