import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Pencil, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'
import pizarron from '@/assets/desafio/games/quien-se-sienta-donde/pizarron.webp'
import g1 from '@/assets/desafio/games/quien-se-sienta-donde/g1.webp'
import g2 from '@/assets/desafio/games/quien-se-sienta-donde/g2.webp'
import g3 from '@/assets/desafio/games/quien-se-sienta-donde/g3.webp'
import g4 from '@/assets/desafio/games/quien-se-sienta-donde/g4.webp'
import g5 from '@/assets/desafio/games/quien-se-sienta-donde/g5.webp'
import b1 from '@/assets/desafio/games/quien-se-sienta-donde/b1.webp'
import b2 from '@/assets/desafio/games/quien-se-sienta-donde/b2.webp'
import b3 from '@/assets/desafio/games/quien-se-sienta-donde/b3.webp'
import b4 from '@/assets/desafio/games/quien-se-sienta-donde/b4.webp'
import b5 from '@/assets/desafio/games/quien-se-sienta-donde/b5.webp'

/**
 * "¿Quién se sienta dónde?" — día 4, mes 5, atención. An aula seen from the front: the blackboard on top and
 * a grid of desks, each with a boy or a girl already drawn in it. Below, the names to place and a list of
 * clues ("Julia se sienta justo detrás de Alberto", "Teresa se sienta entre un chico y una chica"). The
 * player works out which name goes in which desk, tapping a name and then a desk. A seating-plan deduction
 * puzzle: read every clue with care and keep several facts in mind at once.
 *
 * ORIGINAL CONTENT. The idea (a classroom, name tags and positional clues) comes from a paper worksheet,
 * but the drawings, names, clues and puzzles here are TIAM's own: the children are Flux illustrations in
 * the site's flat style, and every puzzle was generated and proven by a throwaway script, not copied.
 *
 * DECIDABLE FROM THE DRAWING. Every clue is checkable by looking at the picture alone: the row words are
 * printed beside the rows ("adelante" is the row nearest the blackboard, "atrás" the farthest), "justo
 * detrás" is the desk right below, "al lado" is the desk right beside it in the same row, and "chico/chica"
 * is what is drawn. Each child's gender is visible, and every name has a gender, so a girl's name can only
 * go in a girl's desk: the game says so at once instead of letting the player waste a try.
 *
 * UNIQUENESS INVARIANT. Each puzzle's clue set was proven, by exhaustively enumerating every placement of
 * the names that respects the genders (at most 5!·4! = 2880), to admit EXACTLY ONE solution, and then
 * pruned until no clue could be removed without admitting a second one. Level 1 reveals the answer fast
 * (2×3 desks, positive clues); level 2 (3×3 desks) needs more clues and more care. There used to be a third
 * level with weaker clues ("no se sienta en la misma fila", "rodeado por sus compañeros"): the tallerista
 * asked to leave the day at TWO levels, so it was removed.
 *
 * NEVER A HARD FAIL. When every desk has a name, the board is checked: the names that are right turn green
 * and stay, the wrong ones flash and go back to the bank, and each wrong one costs one mistake. Nothing is
 * ever red, nothing blocks, no timers. Tapping a placed name takes it back; tapping a clue ticks it off.
 *
 * ONE puzzle per level; each level has two authored puzzles of the same size and one is picked ONCE at
 * mount (`epoch`, together with the bank's order), so "Repetir" replays exactly the same two puzzles.
 * Per-level state lives in <LevelView>, keyed by run + level.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by the click's own
 * timeStamp) is ignored, so the second tap of a double tap on "Siguiente nivel" or "Repetir" never lands on
 * a name or a desk of the new level; the result card's button ignores a tap within SETTLE_MS of the tap that
 * placed the last name. A new level opens at its top and the solved card is scrolled into view.
 *
 * totalAttempts = mistakes + every name of the day (TOTAL_NAMES, derived).
 */

// ── data:start ──
type Gender = 'g' | 'b'

interface PuzzleDef {
  rows: number
  cols: number
  /** 'g' = chica, 'b' = chico, desk by desk: left to right, nearest the blackboard first. */
  seats: string
  /** The name that goes in each desk, in the same order as `seats`. */
  solution: string[]
  /** The drawing of each desk (a key of ART), in the same order as `seats`. */
  art: string[]
  clues: string[]
}
interface LevelDef {
  name: string
  puzzles: PuzzleDef[]
}

const ART: Record<string, string> = { g1, g2, g3, g4, g5, b1, b2, b3, b4, b5 }

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    puzzles: [
      {
        rows: 2,
        cols: 3,
        seats: 'gbbbgg',
        solution: ['Elena', 'Alberto', 'Oscar', 'Mario', 'Julia', 'Teresa'],
        art: ['g5', 'b5', 'b1', 'b2', 'g3', 'g4'],
        clues: [
          'Julia y Teresa se sientan uno al lado del otro.',
          'Julia y Mario se sientan en la misma fila.',
          'Julia se sienta justo detrás de Alberto.',
          'Julia se sienta entre un chico y una chica.',
        ],
      },
      {
        rows: 2,
        cols: 3,
        seats: 'ggbbbg',
        solution: ['Marta', 'Marisa', 'Pedro', 'Luis', 'Mario', 'Julia'],
        art: ['g1', 'g2', 'b4', 'b2', 'b5', 'g5'],
        clues: [
          'Marta está más cerca del pizarrón que Julia.',
          'Marta se sienta en una esquina.',
          'Pedro se sienta al lado de una chica.',
          'Julia y Mario se sientan uno al lado del otro.',
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    puzzles: [
      {
        rows: 3,
        cols: 3,
        seats: 'bggbggbbg',
        solution: ['Daniel', 'Julia', 'Elena', 'Jorge', 'Teresa', 'Graciela', 'Alberto', 'Carlos', 'Nora'],
        art: ['b4', 'g5', 'g2', 'b3', 'g1', 'g3', 'b1', 'b2', 'g4'],
        clues: [
          'Nora se sienta justo detrás de Graciela.',
          'Elena y Julia se sientan uno al lado del otro.',
          'Alberto y Carlos se sientan en la misma fila.',
          'Graciela y Jorge se sientan en la misma fila.',
          'Julia se sienta entre un chico y una chica.',
          'Carlos se sienta al lado de una chica.',
        ],
      },
      {
        rows: 3,
        cols: 3,
        seats: 'bgbggbbgg',
        solution: ['Daniel', 'Elena', 'Luis', 'Nora', 'Silvia', 'Carlos', 'Jorge', 'Teresa', 'Marta'],
        art: ['b2', 'g2', 'b5', 'g1', 'g4', 'b1', 'b3', 'g5', 'g3'],
        clues: [
          'Marta se sienta justo detrás de Carlos.',
          'Nora y Silvia se sientan uno al lado del otro.',
          'Nora está más cerca del pizarrón que Jorge.',
          'Elena se sienta en la fila de adelante.',
          'Silvia se sienta al lado de un chico.',
          'Carlos se sienta justo detrás de Luis.',
        ],
      },
    ],
  },
]

const TOTAL_NAMES = LEVELS.reduce((sum, lvl) => sum + lvl.puzzles[0].solution.length, 0)
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

interface LevelContent {
  puzzle: PuzzleDef
  /** The names to place, in the order the bank shows them — frozen for the whole mount. */
  bank: string[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const puzzle = pickOne(lvl.puzzles)
    return { puzzle, bank: shuffle(puzzle.solution) }
  })
}

/** A name's gender is the gender of the desk it belongs to. */
function genderOf(puzzle: PuzzleDef, name: string): Gender {
  return puzzle.seats[puzzle.solution.indexOf(name)] as Gender
}

function rowLabel(rows: number, r: number): string {
  return (rows === 2 ? ['Adelante', 'Atrás'] : ['Adelante', 'Del medio', 'Atrás'])[r]
}

const PRAISE = ['¡Muy bien!', '¡Excelente atención!', '¡Así se hace!', '¡Qué buena deducción!', '¡Perfecto!']

/** A tap this soon after the tap that brought the level here ("Siguiente nivel", "Repetir") is the second tap
 * of a double tap, and it must not land on a name or a desk of the new level. The same window covers the card's
 * button right after the name that closed the level, and a second tap on a desk that just refused a name. */
const SETTLE_MS = 400
/** How long the wrong names stay in their desks, flashing, before they go back to the bank. */
const BOUNCE_MS = 1100

const STEPS = [
  'Cada asiento del aula ya tiene dibujado un chico o una chica. Abajo están los nombres que faltan ubicar.',
  'Leé las pistas: te dicen dónde se sienta cada uno. El pizarrón está arriba: «adelante» es la fila más cerca del pizarrón y «justo detrás» es el asiento de abajo.',
  'Tocá un nombre y después el asiento donde va. Cuando todos tengan su lugar, se corrige: los que están bien quedan en verde y los demás vuelven abajo.',
]

function HowToPlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-tiam-blue/15 bg-white p-3">
        <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
        <p className="text-base leading-snug text-slate-700">
          Tocá una pista para marcarla cuando ya la usaste. Y tené a mano lápiz y papel si te ayuda.
        </p>
      </div>
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface LevelViewProps {
  levelIdx: number
  content: LevelContent
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
  const { puzzle, bank } = content
  const { rows, cols, seats, solution, art, clues } = puzzle
  const count = solution.length

  // The name in each desk (null = empty), the desks already confirmed, and the ones flashing as wrong.
  const [placed, setPlaced] = useState<(string | null)[]>(() => Array(count).fill(null))
  const [locked, setLocked] = useState<boolean[]>(() => Array(count).fill(false))
  const [flashing, setFlashing] = useState<number[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [ticked, setTicked] = useState<boolean[]>(() => Array(clues.length).fill(false))
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const bounceTimerRef = useRef<number | undefined>(undefined)
  const lastRefusalRef = useRef(Number.NEGATIVE_INFINITY)
  // The tap that placed the last name, which closed the level: the result card shows up under that finger.
  const closedAtRef = useRef(Number.NEGATIVE_INFINITY)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(bounceTimerRef.current), [])

  const solved = placed.every((name, i) => name === solution[i])
  const checking = flashing.length > 0
  const inBank = bank.filter((name) => !placed.includes(name))

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!solved || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [solved])

  function tapName(name: string, at: number) {
    if (solved || checking || at - since < SETTLE_MS) return
    setSelected((current) => (current === name ? null : name))
    setHint(null)
  }

  function tapSeat(i: number, at: number) {
    if (solved || checking || locked[i] || at - since < SETTLE_MS) return

    // No name in hand: tapping a name that is already in a desk takes it back to the bank.
    if (selected === null) {
      if (placed[i] !== null) {
        setPlaced((p) => p.map((name, k) => (k === i ? null : name)))
        setHint(null)
      } else {
        setHint('Primero tocá un nombre de abajo y después el asiento donde va.')
      }
      return
    }

    // A girl's name cannot go in a boy's desk (and the other way round): said at once, costs one mistake.
    const seatGender = seats[i] as Gender
    if (genderOf(puzzle, selected) !== seatGender) {
      // A second tap on the same refusal is a double tap, not a second mistake.
      if (at - lastRefusalRef.current < SETTLE_MS) return
      lastRefusalRef.current = at
      setHint(
        seatGender === 'g'
          ? `${selected} es nombre de chico: en este asiento se sienta una chica.`
          : `${selected} es nombre de chica: en este asiento se sienta un chico.`,
      )
      onMistake()
      return
    }

    // Place it (a name already in that desk goes back to the bank by being overwritten).
    const next = placed.map((name, k) => (k === i ? selected : name))
    setPlaced(next)
    setSelected(null)
    setHint(null)
    if (next.some((name) => name === null)) return

    // Every desk has a name: check the board.
    const wrong = next.map((name, k) => (name !== solution[k] ? k : -1)).filter((k) => k >= 0)
    if (wrong.length === 0) {
      closedAtRef.current = at
      setLocked(Array(count).fill(true))
      setPraise(pickOne(PRAISE))
      onSolved()
      return
    }
    for (let m = 0; m < wrong.length; m++) onMistake()
    setFlashing(wrong)
    setLocked(next.map((_, k) => !wrong.includes(k)))
    setHint(
      wrong.length === 1
        ? 'Hay un nombre que no va ahí. Vuelve abajo: leé de nuevo las pistas y probá en otro asiento.'
        : `Hay ${wrong.length} nombres que no van ahí. Vuelven abajo: leé de nuevo las pistas y probá otra vez.`,
    )
    window.clearTimeout(bounceTimerRef.current)
    bounceTimerRef.current = window.setTimeout(() => {
      setPlaced((p) => p.map((name, k) => (wrong.includes(k) ? null : name)))
      setFlashing([])
    }, BOUNCE_MS)
  }

  function toggleClue(i: number) {
    setTicked((t) => t.map((v, k) => (k === i ? !v : v)))
  }

  // The card shows up under the finger that closed the level: the second tap of that double tap must not
  // skip the result.
  function leave(go: (at: number) => void, at: number) {
    if (at - closedAtRef.current < SETTLE_MS) return
    go(at)
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Ubicá a cada uno en su asiento</h2>
        {!solved && <p className="mt-1 text-base text-slate-500">Leé las pistas y poné cada nombre donde corresponde.</p>}
      </div>

      {/* Clues */}
      <div className="mx-auto mt-4 w-full max-w-[420px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Las pistas</p>
        <ul className="mt-2 space-y-1.5">
          {clues.map((clue, i) => (
            <li key={clue}>
              <button
                type="button"
                aria-pressed={ticked[i]}
                onClick={() => toggleClue(i)}
                className={[
                  'flex min-h-[44px] w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-base leading-snug transition',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                  ticked[i] ? 'bg-tiam-green/10 text-slate-500' : 'bg-white text-slate-800',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
                    ticked[i] ? 'border-tiam-green bg-tiam-green text-white' : 'border-slate-300 bg-white',
                  ].join(' ')}
                >
                  {ticked[i] && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span>{clue}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* The aula: blackboard on top, then the desks, with the name of each row beside it */}
      <div className="mx-auto mt-4 w-full max-w-[420px]">
        <img
          src={pizarron}
          alt="Ilustración del frente de un aula: una maestra sonriente junto al pizarrón"
          width={840}
          height={280}
          className="aspect-[3/1] w-full rounded-2xl object-cover"
        />
        <div className="mt-2 flex gap-2">
          <div aria-hidden="true" className="flex w-5 shrink-0 flex-col gap-2">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex flex-1 items-center justify-center">
                <span
                  className="text-xs font-bold uppercase tracking-wide text-slate-500"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {rowLabel(rows, r)}
                </span>
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {seats.split('').map((seat, i) => {
              const name = placed[i]
              const isLocked = locked[i]
              const isFlashing = flashing.includes(i)
              const r = Math.floor(i / cols)
              const c = i % cols
              return (
                <button
                  key={i}
                  type="button"
                  disabled={solved}
                  onClick={(e) => tapSeat(i, e.timeStamp)}
                  aria-label={`${rowLabel(rows, r)}, asiento ${c + 1}, ${seat === 'g' ? 'una chica' : 'un chico'}: ${
                    name ? `lleva el nombre ${name}` : 'sin nombre'
                  }`}
                  className={[
                    'flex flex-col rounded-2xl border-2 bg-white p-1.5 text-center transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                    isLocked
                      ? 'border-tiam-green bg-tiam-green/10'
                      : isFlashing
                        ? 'border-slate-400 bg-slate-100'
                        : selected && !solved
                          ? 'border-tiam-blue/40 ring-2 ring-tiam-blue/20'
                          : 'border-slate-200',
                  ].join(' ')}
                >
                  <img
                    src={ART[art[i]]}
                    alt=""
                    width={240}
                    height={262}
                    className="aspect-[240/262] w-full rounded-xl object-cover"
                  />
                  <span
                    className={[
                      'mt-1 flex min-h-[34px] items-center justify-center rounded-lg px-1 text-base font-bold leading-tight',
                      name
                        ? isLocked
                          ? 'text-green-800'
                          : isFlashing
                            ? 'text-slate-500'
                            : 'bg-tiam-blue/10 text-tiam-blue-dark'
                        : 'border-2 border-dashed border-slate-300 text-slate-500',
                    ].join(' ')}
                  >
                    {name ?? '¿Quién?'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* The names still to place */}
      {!solved && (
        <>
          <div className="mx-auto mt-4 flex min-h-[56px] w-full max-w-[420px] flex-wrap justify-center gap-2">
            {inBank.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={selected === name}
                onClick={(e) => tapName(name, e.timeStamp)}
                className={[
                  'min-h-[48px] rounded-xl border-2 px-4 text-lg font-bold transition',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                  selected === name
                    ? 'border-tiam-blue bg-tiam-blue text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-tiam-blue/50',
                ].join(' ')}
              >
                {name}
              </button>
            ))}
          </div>
          {/* Two lines on a narrow phone: the room is reserved, so a hint never makes the page jump. */}
          <p role="status" className="mt-3 min-h-[3rem] text-center text-base font-medium text-slate-500">
            {hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Ubicaste a todos en su asiento. ¡Completaste el {level.name.toLowerCase()}!</p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => leave(onRepeat, e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => leave(onNext, e.timeStamp)}
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

export function QuienSeSientaDonde({ onComplete }: GameProps) {
  // Which puzzle each level plays, and the bank's order — decided once, at mount, so "Repetir" replays
  // exactly the same content.
  const [epoch] = useState(buildEpoch)
  // How-to screen, once per opening of the day — "Repetir" never sets it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_NAMES })
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

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
            {LEVELS[0].name}
          </span>
        </div>
        <HowToPlay onStart={() => setPhase('playing')} />
      </div>
    )
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
