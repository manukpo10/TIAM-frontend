import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La flor que más se repite" — día 21, mes 5, atención. A field of flowers
 * scattered over a white board: 12 flowers of 4 kinds → 18 of 5 → 24 of 6.
 * Two questions about the SAME field, one after the other: "¿Cuál es la flor que
 * más se repite?" and "¿Cuál aparece una sola vez?". The answer is one tap on
 * the kinds of flower shown as options (the flower AND its name). Looking over a
 * field, telling the kinds apart and keeping a count of each is the attention.
 *
 * Every field is built so each question has exactly ONE answer: one kind that
 * appears more times than any other, and exactly one kind that appears once (all
 * the others appear at least twice). The ramp is the size of the field, the number
 * of kinds and the margin: the most repeated kind leads the second by 3 (level
 * 1), 2 (levels 2 and 3). Kinds that look alike (rosa/clavel, girasol/tulipán/
 * lirio, lavanda/orquídea, margarita/jazmín) are never together in a field of
 * levels 1-2, and at most one pair of them is in level 3 (six kinds cannot avoid
 * it): a pair with different shapes, among the middle counts, so neither the kind
 * that appears most nor the one that appears once has a twin on the board.
 *
 * THE LAYOUT. The board is a grid of square cells with one flower per cell, and
 * each flower sits a little off the middle of its cell (up to 0.08 of a cell
 * every way) and tilted a few degrees, so it reads as scattered while it can never
 * touch a neighbour: the flower is 0.84 of a cell, so two flowers that lean toward
 * each other are still 0.84 apart, centre to centre, with their boxes just touching. Levels with more cells than
 * flowers (18 in 20, 24 in 25) leave a random few empty. Which kind goes in which
 * cell is random but decided ONCE, at mount, together with the order of the
 * options (never sorted by count, or the first one would always be right), so
 * "Repetir" replays exactly the same fields in the same places. A throwaway Node
 * script (not committed) draws each layout thousands of times with a seeded random
 * and checks the counts, the 0.8 gap and that every flower is inside the board.
 *
 * A wrong tap greys the option out (muted, never red) and costs one mistake; the
 * hint says what that kind is NOT, without giving the count away. A right tap
 * says how many there were and moves on after a short pause (the only timer). Per-
 * level state lives in <LevelView>, keyed by run + level. The pictures are white-
 * background photos, so they are drawn with a multiply blend on a white board: a
 * white corner can never cover a neighbour.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged
 * by the click's own timeStamp) is ignored, so the second tap of a double tap on
 * "Siguiente nivel" or "Repetir" never answers the first question; and while the
 * right kind shows its check every option is off, which swallows a double tap on
 * the RIGHT one before the next question replaces it. Once the level is solved the
 * board is hidden (the recap lists what was on it) so the result card and its
 * button fit, and the card is scrolled into view on a short phone. While it is
 * played, the board is never wider than what leaves ALL the option rows on screen
 * (boardMaxWidth: it shrinks on a 667px-tall phone, not on a taller one).
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived
 * from QUESTIONS, like the counter and the recap sentence).
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

interface FlowerNames {
  name: string
  /** "8 rosas" */
  many: string
  /** "1 rosa" */
  one: string
  /** A feminine noun: "una sola rosa", not "un solo rosa" (girasol, tulipán, clavel, jazmín and lirio are masculine). */
  fem: boolean
}
const FLOWERS: Record<FlowerId, FlowerNames> = {
  rosa: { name: 'Rosa', many: 'rosas', one: 'rosa', fem: true },
  girasol: { name: 'Girasol', many: 'girasoles', one: 'girasol', fem: false },
  margarita: { name: 'Margarita', many: 'margaritas', one: 'margarita', fem: true },
  tulipan: { name: 'Tulipán', many: 'tulipanes', one: 'tulipán', fem: false },
  lavanda: { name: 'Lavanda', many: 'lavandas', one: 'lavanda', fem: true },
  orquidea: { name: 'Orquídea', many: 'orquídeas', one: 'orquídea', fem: true },
  clavel: { name: 'Clavel', many: 'claveles', one: 'clavel', fem: false },
  hortensia: { name: 'Hortensia', many: 'hortensias', one: 'hortensia', fem: true },
  jazmin: { name: 'Jazmín', many: 'jazmines', one: 'jazmín', fem: false },
  lirio: { name: 'Lirio', many: 'lirios', one: 'lirio', fem: false },
}

interface FieldDef {
  /** Each kind and how many of it are in the field. */
  counts: [FlowerId, number][]
}
interface LevelDef {
  name: string
  /** Grid of square cells the flowers are scattered over. */
  cols: number
  rows: number
  /** Two authored fields; one is picked at mount. */
  fields: FieldDef[]
}

// Every field of a level has the same number of flowers, so the board is always
// the same size. Within a field: one kind has the most, exactly one kind appears
// once and every other kind appears at least twice. The one look-alike pair of
// level 3 sits among the middle counts (4/3 and 6/3), never on an answer.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    cols: 4,
    rows: 3,
    fields: [
      { counts: [['rosa', 6], ['girasol', 3], ['hortensia', 2], ['lavanda', 1]] },
      { counts: [['orquidea', 6], ['jazmin', 3], ['clavel', 2], ['tulipan', 1]] },
    ],
  },
  {
    name: 'Nivel 2',
    cols: 5,
    rows: 4,
    fields: [
      { counts: [['girasol', 7], ['rosa', 5], ['lavanda', 3], ['hortensia', 2], ['margarita', 1]] },
      { counts: [['hortensia', 7], ['tulipan', 5], ['clavel', 3], ['orquidea', 2], ['jazmin', 1]] },
    ],
  },
  {
    name: 'Nivel 3',
    cols: 5,
    rows: 5,
    fields: [
      { counts: [['girasol', 8], ['margarita', 6], ['rosa', 4], ['clavel', 3], ['lavanda', 2], ['hortensia', 1]] },
      { counts: [['clavel', 8], ['tulipan', 6], ['orquidea', 4], ['girasol', 3], ['hortensia', 2], ['margarita', 1]] },
    ],
  },
]

/** The kind that appears most times (the first of the sorted counts) and the one that appears once. */
function answersOf(field: FieldDef): { most: FlowerId; once: FlowerId } {
  const sorted = [...field.counts].sort((a, b) => b[1] - a[1])
  return { most: sorted[0][0], once: sorted[sorted.length - 1][0] }
}

interface Question {
  text: string
  /** What to say when the player taps a kind that is not the answer. */
  nudge: (tapped: FlowerId, countOf: (kind: FlowerId) => number) => string
  answer: (level: PreparedLevel) => FlowerId
  /** Said when it is right. */
  right: (level: PreparedLevel, countOf: (kind: FlowerId) => number) => string
}

// Two questions about the same field. The number of questions (the "Pregunta 1 de 2" counter, the recap
// sentence and TOTAL_QUESTIONS) all come from this list.
const QUESTIONS: Question[] = [
  {
    text: '¿Cuál es la flor que más se repite?',
    nudge: (tapped, countOf) =>
      countOf(tapped) === 1
        ? 'Esa aparece una sola vez. Buscá la que más se repite.'
        : 'Esa se repite, pero hay otra que aparece más veces. Mirá bien el tablero.',
    answer: (lvl) => lvl.most,
    right: (lvl, countOf) => `¡Eso es! Había ${countOf(lvl.most)} ${FLOWERS[lvl.most].many}.`,
  },
  {
    text: '¿Cuál aparece una sola vez?',
    nudge: () => 'Esa aparece más de una vez. Buscá la que está sola.',
    answer: (lvl) => lvl.once,
    // "una sola lavanda" / "un solo tulipán": the flower decides the gender.
    right: (lvl) => `¡Eso es! Había ${FLOWERS[lvl.once].fem ? 'una sola' : 'un solo'} ${FLOWERS[lvl.once].one}.`,
  },
]

const TOTAL_QUESTIONS = LEVELS.length * QUESTIONS.length

/** The widest the board may be so that it, the question above it and ALL the option rows fit the modal of a
 * short phone (375x667 leaves 100dvh - 95px of scroll area; above the board there are 122px, between board
 * and options 12px, 8px of safety; each row of options is 56px with 8px between rows). The board keeps its
 * shape (cols:rows), never gets below 14rem (a flower would be too small to count) and never above 340px, so
 * on a phone that is tall enough nothing changes. On a phone 350px wide or less (320x640) the title in the modal's
 * header wraps onto a second line (28px more) and 14rem alone left the last row of options 23px below the fold in
 * level 3, so there (`narrow`) the estimate grows by that line and the floor is 12rem. */
function boardMaxWidth(level: LevelDef, optionCount: number, narrow = false): string {
  const rows = Math.ceil(optionCount / 2)
  const around = 95 + 122 + 12 + 8 + (rows * 64 - 8) + (narrow ? 28 : 0)
  return `min(340px, max(${narrow ? '12rem' : '14rem'}, calc((100dvh - ${around}px) * ${level.cols} / ${level.rows})))`
}

/** Size of a flower, as a fraction of a cell. */
const FLOWER_SIZE = 0.84
/** How far a flower may sit from the middle of its cell, as a fraction of a cell, along each axis. */
const JITTER = 0.08
/** Largest tilt, in degrees, either way. */
const MAX_TILT = 12

interface PlacedFlower {
  kind: FlowerId
  /** Centre of the flower, in percent of the width / the height of the board. */
  x: number
  y: number
  tilt: number
}

function shuffleWith<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Scatters a field over the board: one flower per chosen cell, off-centre and tilted. */
function layoutField(level: LevelDef, field: FieldDef, rnd: () => number): PlacedFlower[] {
  const kinds = field.counts.flatMap(([kind, n]) => Array.from({ length: n }, () => kind))
  const cells = shuffleWith(
    Array.from({ length: level.cols * level.rows }, (_, i) => i),
    rnd,
  ).slice(0, kinds.length)
  return shuffleWith(kinds, rnd).map((kind, i) => {
    const col = cells[i] % level.cols
    const row = Math.floor(cells[i] / level.cols)
    const dx = (rnd() * 2 - 1) * JITTER
    const dy = (rnd() * 2 - 1) * JITTER
    return {
      kind,
      x: ((col + 0.5 + dx) / level.cols) * 100,
      y: ((row + 0.5 + dy) / level.rows) * 100,
      tilt: (rnd() * 2 - 1) * MAX_TILT,
    }
  })
}
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/flores/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imageFor(kind: FlowerId): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${kind}.webp`))?.[1]
}

interface PreparedLevel {
  field: FieldDef
  most: FlowerId
  once: FlowerId
  flowers: PlacedFlower[]
  /** The kinds in their (frozen) order as options: never sorted by count. */
  options: FlowerId[]
}

function buildEpoch(): PreparedLevel[] {
  return LEVELS.map((lvl) => {
    const field = pickOne(lvl.fields)
    const { most, once } = answersOf(field)
    return {
      field,
      most,
      once,
      flowers: layoutField(lvl, field, Math.random),
      options: shuffleWith(
        field.counts.map(([kind]) => kind),
        Math.random,
      ),
    }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente atención!', '¡Así se hace!', '¡Qué buen ojo!', '¡Perfecto!']

/** A tap this soon after the tap that brought the level here ("Siguiente nivel", "Repetir") is the
 * second tap of a double tap, and it must not answer the first question (the options sit right
 * where that button was). Long enough to swallow a double tap, short enough that nobody who means
 * it notices. */
const SETTLE_MS = 400

interface LevelViewProps {
  levelIdx: number
  content: PreparedLevel
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, content, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { field, flowers, options } = content
  const countOf = (kind: FlowerId) => field.counts.find(([k]) => k === kind)?.[1] ?? 0

  const [questionIdx, setQuestionIdx] = useState(0)
  const [wrongKinds, setWrongKinds] = useState<FlowerId[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Options already tapped for this question: a double tap is ONE tap.
  const tappedRef = useRef<Set<FlowerId>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const question = QUESTIONS[questionIdx]
  const answer = question.answer(content)

  function handleTap(kind: FlowerId, at: number) {
    // While the right kind shows its check (`advancing`) every option is off, which is what swallows
    // a double tap on the RIGHT one; this swallows the one that follows the button that brought the level.
    if (advancing || done || tappedRef.current.has(kind) || at - since < SETTLE_MS) return
    tappedRef.current.add(kind)
    if (kind === answer) {
      setAdvancing(true)
      setHint(question.right(content, countOf))
      advanceTimerRef.current = window.setTimeout(() => {
        if (questionIdx < QUESTIONS.length - 1) {
          setQuestionIdx((i) => i + 1)
          setWrongKinds([])
          setAdvancing(false)
          setHint(null)
          tappedRef.current = new Set()
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, 1300)
    } else {
      setWrongKinds((w) => [...w, kind])
      setHint(question.nudge(kind, countOf))
      onMistake()
    }
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
          {level.name}
        </span>
        {!done && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Pregunta {questionIdx + 1} de {QUESTIONS.length}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{question.text}</h2>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* The board: a white field with the flowers scattered over it. Once the level is solved
              it is no longer needed (the recap below says what was on it) and gives its room to the result. */}
          <div
            role="img"
            aria-label={`Un tablero con ${flowers.length} flores de ${field.counts.length} clases`}
            className="relative mx-auto mt-3 w-full max-w-(--board-max) overflow-hidden rounded-2xl border-2 border-slate-100 bg-white max-[350px]:max-w-(--board-max-narrow)"
            style={
              {
                aspectRatio: `${level.cols} / ${level.rows}`,
                '--board-max': boardMaxWidth(level, options.length),
                '--board-max-narrow': boardMaxWidth(level, options.length, true),
              } as CSSProperties
            }
          >
            {flowers.map((f, i) => (
              <img
                key={i}
                src={imageFor(f.kind)}
                alt=""
                draggable={false}
                className="pointer-events-none absolute select-none mix-blend-multiply"
                style={{
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                  width: `${(FLOWER_SIZE / level.cols) * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${f.tilt}deg)`,
                }}
              />
            ))}
          </div>

          {/* The kinds, each with its picture AND its name */}
          <div className="mx-auto mt-3 flex max-w-sm flex-wrap justify-center gap-2" role="group" aria-label="Clases de flor">
            {options.map((kind) => {
              const isWrong = wrongKinds.includes(kind)
              const isCorrectShown = advancing && kind === answer
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={isWrong || advancing}
                  onClick={(e) => handleTap(kind, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] w-[calc(50%-0.25rem)] items-center gap-2 rounded-2xl border-2 px-2 text-left text-base font-bold transition max-[350px]:gap-1.5 max-[350px]:px-1.5 max-[350px]:text-[13px]',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <img
                    src={imageFor(kind)}
                    alt=""
                    className={['h-10 w-10 shrink-0 rounded-lg object-contain max-[350px]:h-8 max-[350px]:w-8', isWrong ? 'opacity-35 grayscale' : ''].join(' ')}
                  />
                  <span className="flex-1">{FLOWERS[kind].name}</span>
                  {isCorrectShown && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-3 min-h-[3rem] text-center text-base font-medium ${advancing ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint}
          </p>
        </>
      )}

      {/* Level complete: the counts come back as a recap */}
      {done && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Contestaste las {QUESTIONS.length} preguntas. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-500">En el tablero había:</p>
          <ul className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            {[...field.counts]
              .sort((a, b) => b[1] - a[1])
              .map(([kind, n]) => (
                <li
                  key={kind}
                  className="flex items-center gap-1 rounded-xl border border-slate-100 bg-white py-0.5 pl-1 pr-2 text-sm font-bold text-slate-800"
                >
                  <img src={imageFor(kind)} alt="" className="h-7 w-7 rounded-md object-contain" />
                  {n} {n === 1 ? FLOWERS[kind].one : FLOWERS[kind].many}
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

export function LaFlorQueMasSeRepite({ onComplete }: GameProps) {
  // Which field each level shows, where every flower sits and the order of the
  // options — decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
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
