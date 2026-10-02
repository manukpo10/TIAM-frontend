import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Las flores del jardín" — día 15, mes 5, memoria. A study → recall game: the
 * garden shows 3 / 4 / 5 flowers, each one with its NAME under it, and stays on
 * screen until the player taps "Ya las miré" (no clock: looking speed varies a
 * lot in this audience and a timer would punish the slowest eyes for the very
 * skill the game trains). Then the garden is gone and a grid of 6 / 8 / 10
 * flowers appears, WITHOUT names: tap the ones that were in the garden.
 *
 * Everything the player needs is on the study screen. The recall never asks for
 * a name, never depends on knowing flowers, and shows no label that could give
 * an answer away (the tiles carry no text at all; the recap with names only
 * appears once the level is solved). The study screen says so out loud: "no hace
 * falta saber de flores".
 *
 * A wrong tap greys that flower out (never red) with a gentle nudge and costs
 * one mistake; a flower that is already greyed or found is a disabled button,
 * and a ref guard on top makes a double tap count ONE mistake. The level closes
 * when every garden flower is found, after a short pause so the last check
 * registers (the only timer in the game).
 *
 * The second tap of a double tap never counts: every tap within SETTLE_MS of the
 * tap that brought the screen here (judged by the click's own timeStamp) is
 * ignored, so a double tap on "Siguiente nivel" does not press "Ya las miré" of
 * the next garden, and a double tap on "Ya las miré" does not answer on the grid.
 * A solved level scrolls its result card into view on a short phone.
 *
 * The sets are built so the memory is fair: no flower in the "others" looks like
 * a flower of the garden. Looks-alike are kept in groups (rosa/clavel,
 * girasol/tulipán/lirio, lavanda/orquídea, margarita/jazmín); in the 3- and
 * 4-flower levels a group is either all in the garden or all out of it, and in
 * level 3 (where all ten flowers are on the grid) the garden holds whole groups
 * on purpose. A throwaway Node script (not committed) checks every set: sizes,
 * no repeats, the 6 / 8 / 10 grid, and zero cross looks-alike pairs.
 *
 * ONE garden per level: each level has two authored sets and one is picked ONCE
 * at mount (`epoch`, together with the order of the recall grid), so "Repetir"
 * replays exactly the same three gardens in the same places. Per-level state
 * lives in <LevelView>, keyed by run + level, so it resets without any effect.
 *
 * totalAttempts = mistakes + every flower of the gardens (TOTAL_FLOWERS, derived).
 */

// ── data:start ──
type FlowerId =
  | 'rosa'
  | 'girasol'
  | 'margarita'
  | 'tulipan'
  | 'lavanda'
  | 'orquidea'
  | 'clavel'
  | 'hortensia'
  | 'jazmin'
  | 'lirio'

const FLOWER_NAMES: Record<FlowerId, string> = {
  rosa: 'Rosa',
  girasol: 'Girasol',
  margarita: 'Margarita',
  tulipan: 'Tulipán',
  lavanda: 'Lavanda',
  orquidea: 'Orquídea',
  clavel: 'Clavel',
  hortensia: 'Hortensia',
  jazmin: 'Jazmín',
  lirio: 'Lirio',
}

interface GardenDef {
  /** The flowers of the garden: shown with their names in the study phase. */
  studied: FlowerId[]
  /** Flowers that were NOT in the garden: they complete the recall grid. */
  others: FlowerId[]
}
interface LevelDef {
  name: string
  gardens: GardenDef[]
}

// Every garden of a level has the same size, and `others` is as long as
// `studied`, so the grid is always 6 / 8 / 10 and TOTAL_FLOWERS never depends on
// which garden is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    gardens: [
      { studied: ['rosa', 'girasol', 'lavanda'], others: ['hortensia', 'margarita', 'jazmin'] },
      { studied: ['margarita', 'clavel', 'lirio'], others: ['lavanda', 'hortensia', 'orquidea'] },
    ],
  },
  {
    name: 'Nivel 2',
    gardens: [
      { studied: ['rosa', 'clavel', 'margarita', 'jazmin'], others: ['girasol', 'lavanda', 'hortensia', 'orquidea'] },
      { studied: ['girasol', 'tulipan', 'lirio', 'lavanda'], others: ['rosa', 'margarita', 'hortensia', 'clavel'] },
    ],
  },
  {
    name: 'Nivel 3',
    gardens: [
      {
        studied: ['rosa', 'clavel', 'margarita', 'jazmin', 'hortensia'],
        others: ['girasol', 'tulipan', 'lirio', 'lavanda', 'orquidea'],
      },
      {
        studied: ['girasol', 'tulipan', 'lirio', 'lavanda', 'orquidea'],
        others: ['rosa', 'clavel', 'margarita', 'jazmin', 'hortensia'],
      },
    ],
  },
]

/** How many flowers go on each row (rows with fewer tiles are centered). */
const STUDY_LAYOUT: Record<number, { rows: number[]; perRow: 2 | 3 }> = {
  3: { rows: [3], perRow: 3 },
  4: { rows: [2, 2], perRow: 2 },
  5: { rows: [3, 2], perRow: 3 },
}
/** The widest the garden may be while it is studied. With 3 flowers to a row the tiles are small already; with
 * 2 to a row (level 2) they are big, so on a short phone they give way: the modal leaves 100dvh - 95px of scroll
 * area and everything else of the study screen (header, 3-line paragraph, name lines, gaps and the button) takes
 * about 330px plus the width of the garden, so 100dvh - 454px (24px of that is one more paragraph line, in
 * case it wraps) keeps both rows and "Ya las miré" on screen. On a 375x667 phone that is the 14rem floor: tiles
 * of 108px, still bigger than the 98px ones of level 1. A tall phone keeps the 340px cap. */
const STUDY_MAX_WIDTH: Record<2 | 3, string> = {
  3: '340px',
  2: 'min(340px, max(14rem, calc(100dvh - 454px)))',
}
/** The same for a short phone (700px of height or less), where the study screen is also tightened (12px of padding
 * above and below, 8px above the title, 12px above the garden, 8px between its rows, 12px above the button): there
 * everything but the garden takes 239px on a phone 375px wide or more (title on one line, 3-line paragraph) and 291px
 * on a narrower one (title on two lines, 4-line paragraph: the title is 296px wide, so a 360px phone, with 296px of
 * room, cannot be counted on to keep it on one line), and the garden itself is its width + 56px, so the width is
 * 100dvh - 95px - that - 56px, less 8px of safety. A lower floor than the tall phones' (12rem): on a 320x640 phone
 * the tiles are 92px (80px pictures), still bigger than the 80px ones (68px pictures) of 3 flowers to a row there.
 * Level 3 (3 and 2 to a row) has tiles that small already and keeps the 340px cap, which fits. */
const STUDY_MAX_WIDTH_SHORT: Record<2 | 3, string> = {
  3: '340px',
  2: 'min(340px, max(12rem, calc(100dvh - 398px)))',
}
const STUDY_MAX_WIDTH_NARROW: Record<2 | 3, string> = {
  3: '340px',
  2: 'min(340px, max(12rem, calc(100dvh - 450px)))',
}
/** The widest the recall grid may be on a short phone (700px of height or less), so that EVERY row of flowers is on
 * screen when the recall opens (a player who does not see that the flowers go on below the fold cannot find them
 * all). Above the grid there are 143px on a phone 375px wide or more (title on one line, 2-line paragraph) and 171px
 * on a narrower one (both on two lines); a tile is a third of the width less 16px of gaps, a row is a tile and 8px of
 * gap, so for `rows` rows the width is 16px + 3 * (100dvh - 95px - that - 4px of safety - 8px per gap) / rows. Never
 * narrower than 14rem, never wider than 340px: it only bites on the 10-flower level of a short 360px phone. */
function recallMaxWidth(rows: number, above: number): string {
  return `min(340px, max(14rem, calc(16px + (100dvh - ${95 + above + 4 + 8 * (rows - 1)}px) * 3 / ${rows})))`
}
const RECALL_ABOVE = { short: 143, narrow: 171 }
const RECALL_ROWS: Record<number, number[]> = {
  6: [3, 3],
  8: [3, 3, 2],
  10: [3, 3, 2, 2],
}

const TOTAL_FLOWERS = LEVELS.reduce((sum, lvl) => sum + lvl.gardens[0].studied.length, 0)
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
function splitRows<T>(items: T[], rows: number[]): T[][] {
  const out: T[][] = []
  let at = 0
  for (const n of rows) {
    out.push(items.slice(at, at + n))
    at += n
  }
  return out
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/flores/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imageFor(id: FlowerId): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

interface PreparedLevel {
  studied: FlowerId[]
  /** Studied + others in their (frozen) grid order: the grid never reshuffles after a tap. */
  grid: FlowerId[]
}

function buildEpoch(): PreparedLevel[] {
  return LEVELS.map((lvl) => {
    const garden = pickOne(lvl.gardens)
    return { studied: garden.studied, grid: shuffle([...garden.studied, ...garden.others]) }
  })
}

const PRAISE_GREAT = ['¡Qué buena memoria!', '¡Las recordaste todas!', '¡Así se hace!']
const PRAISE_GOOD = ['¡Muy bien! Cada vez recordás más.', '¡Buen trabajo! La memoria también se entrena.']
const NUDGES = [
  'Esa no estaba en el jardín. Probá con otra.',
  'Todavía no. Acordate de las que viste.',
  'Casi. Mirá bien las otras flores.',
]

// Literal class strings: Tailwind only emits classes it can read in the source.
const TILE_WIDTH = {
  2: 'w-[calc((100%-0.5rem)/2)]',
  3: 'w-[calc((100%-1rem)/3)]',
} as const

type Phase = 'study' | 'recall' | 'done'

/** A tap this soon after the screen changed is the second tap of a double tap on the button that
 * brought the player here ("Siguiente nivel", "Ya las miré", "Repetir"): it must not be judged
 * against what is now under the finger (a flower of the grid, the "Ya las miré" of the next
 * garden). Long enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

interface LevelViewProps {
  levelIdx: number
  content: PreparedLevel
  /** The timeStamp of the tap that brought this level on screen (-Infinity when the day just opened). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, content, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { studied, grid } = content
  const total = studied.length

  const [phase, setPhase] = useState<Phase>('study')
  const [found, setFound] = useState<FlowerId[]>([])
  const [wrong, setWrong] = useState<FlowerId[]>([])
  const [closing, setClosing] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelMistakes, setLevelMistakes] = useState(0)
  const [praise, setPraise] = useState(PRAISE_GREAT[0])
  // Flowers already tapped: a double tap on the same flower is ONE tap, even
  // when both taps land before React has repainted the tile as disabled.
  const tappedRef = useRef<Set<FlowerId>>(new Set())
  // When the screen last changed because of a tap (that tap's own timeStamp): every tap within
  // SETTLE_MS of it is ignored. It moves to the "Ya las miré" tap when the grid appears.
  const settleFromRef = useRef(since)
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level, and the recall that follows the study, open at the top, not wherever the previous
  // button left the scroll (a short phone).
  useEffect(() => {
    if (phase !== 'done') topRef.current?.scrollIntoView({ block: 'start' })
  }, [phase])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (phase !== 'done' || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [phase])

  function startRecall(at: number) {
    // The second tap of a double tap on "Siguiente nivel" can land on this button: it is not a
    // "Ya las miré" (the garden would vanish before it was looked at).
    if (at - settleFromRef.current < SETTLE_MS) return
    settleFromRef.current = at
    setPhase('recall')
  }

  function handleTap(id: FlowerId, at: number) {
    if (phase !== 'recall' || closing || tappedRef.current.has(id)) return
    // The second tap of a double tap on "Ya las miré" lands on the grid: not an answer.
    if (at - settleFromRef.current < SETTLE_MS) return
    tappedRef.current.add(id)
    if (studied.includes(id)) {
      const nextFound = [...found, id]
      setFound(nextFound)
      setHint(null)
      if (nextFound.length === total) {
        setClosing(true)
        // The only timer in the game: a short pause so the last check registers.
        advanceTimerRef.current = window.setTimeout(() => {
          setPraise(pickOne(levelMistakes === 0 ? PRAISE_GREAT : PRAISE_GOOD))
          setPhase('done')
          onSolved()
        }, 700)
      }
    } else {
      setWrong((w) => [...w, id])
      setHint(pickOne(NUDGES))
      setLevelMistakes((m) => m + 1)
      onMistake()
    }
  }

  const studyLayout = STUDY_LAYOUT[total]
  const recallRows = RECALL_ROWS[grid.length]

  // The [@media(max-height:700px)] classes are the study screen of a short phone: tighter spacing so that the whole
  // garden, its names and "Ya las miré" are on screen together, with nothing under the pinned button (see STUDY_MAX_WIDTH).
  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue-dark">
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl [@media(max-height:700px)]:mt-2">
              Mirá bien las flores del jardín
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Fijate cómo es cada una. Después tenés que reconocerlas, sin los nombres. No hace falta saber de flores.
            </p>
          </>
        )}

        {phase === 'recall' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl [@media(max-height:700px)]:mt-2">
              ¿Cuáles estaban en el jardín?
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá las {total} flores que viste. Encontraste{' '}
              <span className="font-bold text-slate-700">
                {found.length} de {total}
              </span>
              .
            </p>
          </>
        )}

        {phase === 'done' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              ¡Completaste el {level.name.toLowerCase()}!
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Study phase: the garden, with the names, for as long as the player wants */}
      {phase === 'study' && (
        <>
          <div
            className="mx-auto mt-4 max-w-(--sw) space-y-3 [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:max-[374px]:max-w-(--sw-narrow) [@media(max-height:700px)]:min-[375px]:max-w-(--sw-short) [@media(max-height:700px)]:space-y-2"
            style={
              {
                '--sw': STUDY_MAX_WIDTH[studyLayout.perRow],
                '--sw-short': STUDY_MAX_WIDTH_SHORT[studyLayout.perRow],
                '--sw-narrow': STUDY_MAX_WIDTH_NARROW[studyLayout.perRow],
              } as CSSProperties
            }
          >
            {splitRows(studied, studyLayout.rows).map((row, r) => (
              <div key={r} className="flex justify-center gap-2">
                {row.map((id) => (
                  <div key={id} className={`flex flex-col items-center ${TILE_WIDTH[studyLayout.perRow]}`}>
                    <div className="w-full rounded-2xl border-2 border-slate-100 bg-white p-1">
                      <img src={imageFor(id)} alt="" className="aspect-square w-full rounded-xl object-contain" />
                    </div>
                    {/* Outside the bordered box on purpose: a long name may be a few px wider than a narrow tile. */}
                    <span className="mt-1 whitespace-nowrap text-base font-bold text-slate-800">{FLOWER_NAMES[id]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Pinned to the bottom edge when the screen is too short to show it in place (320x640). */}
          <div className="sticky bottom-3 z-10 mt-5 text-center [@media(max-height:700px)]:mt-3">
            <button
              type="button"
              onClick={(e) => startRecall(e.timeStamp)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
            >
              Ya las miré
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* Recall phase: the garden is gone, only unnamed flowers remain */}
      {phase === 'recall' && (
        <>
          <div
            className="mx-auto mt-4 max-w-[340px] space-y-2 [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:max-[374px]:max-w-(--rw-narrow) [@media(max-height:700px)]:min-[375px]:max-w-(--rw-short)"
            style={
              {
                '--rw-short': recallMaxWidth(recallRows.length, RECALL_ABOVE.short),
                '--rw-narrow': recallMaxWidth(recallRows.length, RECALL_ABOVE.narrow),
              } as CSSProperties
            }
          >
            {splitRows(grid, recallRows).map((row, r) => (
              <div key={r} className="flex justify-center gap-2">
                {row.map((id) => {
                  const isFound = found.includes(id)
                  const isWrong = wrong.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={isFound || isWrong || closing}
                      onClick={(e) => handleTap(id, e.timeStamp)}
                      aria-label={isFound ? 'Flor encontrada' : isWrong ? 'Flor descartada' : 'Flor'}
                      className={[
                        'relative rounded-2xl border-2 p-1 transition',
                        TILE_WIDTH[3],
                        'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                        isFound
                          ? 'border-tiam-green bg-tiam-green/10 ring-2 ring-tiam-green/30'
                          : isWrong
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100'
                            : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      <img
                        src={imageFor(id)}
                        alt=""
                        className={[
                          'aspect-square w-full rounded-xl object-contain',
                          isWrong ? 'opacity-35 grayscale' : '',
                        ].join(' ')}
                      />
                      {isFound && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <p role="status" className="mt-3 min-h-[3rem] text-center text-base font-medium text-slate-500">
            {hint}
          </p>
        </>
      )}

      {/* Level complete: the names come back as a recap, now that nothing is at stake */}
      {phase === 'done' && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-slate-600">En el jardín había:</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {studied.map((id) => (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white py-1 pl-1 pr-3 text-base font-semibold text-slate-800"
              >
                <img src={imageFor(id)} alt="" className="h-9 w-9 rounded-lg object-contain" />
                {FLOWER_NAMES[id]}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
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

export function LasFloresDelJardin({ onComplete }: GameProps) {
  // Which garden each level shows, and where the flowers sit on the recall
  // grid — decided once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_FLOWERS })
  }
  function handleNext(at: number) {
    setSince(at)
    setLevelIdx((i) => i + 1)
  }
  function handleRepeat(at: number) {
    setSince(at)
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
