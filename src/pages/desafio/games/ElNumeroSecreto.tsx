import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El número secreto" — día 3, mes 5, cálculo. A grid of numbers and a list of
 * clues about place value and size ("tiene 3 decenas", "termina en 8", "es
 * mayor que 950", "está entre 130 y 200", "no tiene decenas"). The clues come
 * ONE AT A TIME; the player taps the number in the grid that fits the clue on
 * screen. A wrong tap flashes muted gray (never red), shows a hint that points
 * at the right digit and costs one mistake; the number stays tappable, because
 * a number that is wrong for this clue can be the right answer to a later one.
 *
 * EXACTLY ONE NUMBER FITS EACH CLUE, and that is a property of the data, not of
 * the checker: every clue is a predicate over the number (`test`), the
 * predicate is also what judges a tap, and a throwaway Node script (not
 * committed) confirmed for every authored board that each clue matches
 * exactly one number in its grid, that no two clues of a board
 * share their answer, and that the grids are all distinct numbers inside the
 * level's digit range. Decoys are deliberate near-misses: the right digit in
 * the wrong place (83 for "tiene 3 decenas"), a number just outside a range,
 * the same digits swapped (528 for "8 decenas y 2 unidades"). No decoy sits
 * ON a boundary ("mayor que 950" never has a 950 in the grid).
 *
 * "Decenas" means the tens DIGIT, the way a school worksheet reads a number
 * (in 325: 3 centenas, 2 decenas, 5 unidades), so the how-to screen and a one
 * line reminder during play spell that out with an example.
 *
 * Ramp: L1 two-digit numbers and one-property clues (9 numbers, 3 clues); L2
 * three-digit numbers (12 numbers, 3 clues, a range among them); L3 three-digit
 * numbers with two simple clues and two that combine two digits (12 numbers,
 * 4 clues). One board per level: each level has two authored boards and one is
 * picked ONCE at mount (`epoch`, together with the grid order), so "Repetir"
 * plays exactly the same three boards. Per-level state lives in <LevelView>,
 * keyed by run + level.
 *
 * totalAttempts = mistakes + every clue of the day (TOTAL_CLUES, derived).
 */

// ── data:start ──
interface Clue {
  text: string
  /** Shown after a wrong tap; points at the digit to look at. */
  hint: string
  test: (n: number) => boolean
}
interface BoardDef {
  numbers: number[]
  /** Play order: easiest first. */
  clues: Clue[]
}
interface LevelDef {
  name: string
  digits: 2 | 3
  /** One-line reminder of how a number of this size reads. */
  legend: string
  boards: BoardDef[]
}

const hundredsOf = (n: number) => Math.floor(n / 100) % 10
const tensOf = (n: number) => Math.floor(n / 10) % 10
const unitsOf = (n: number) => n % 10

const centenas = (n: number) => (n === 1 ? '1 centena' : `${n} centenas`)
const decenas = (n: number) => (n === 1 ? '1 decena' : `${n} decenas`)
const unidades = (n: number) => (n === 1 ? '1 unidad' : `${n} unidades`)

const tensIs = (d: number, where: string): Clue => ({
  text: `Tiene ${decenas(d)}`,
  hint: `Ese número no tiene ${decenas(d)}. Fijate en ${where}.`,
  test: (n) => tensOf(n) === d,
})
const unitsIs = (d: number): Clue => ({
  text: `Termina en ${d}`,
  hint: `Ese no termina en ${d}. Fijate en la última cifra.`,
  test: (n) => unitsOf(n) === d,
})
const noTens: Clue = {
  text: 'No tiene decenas',
  hint: 'Ese sí tiene decenas. Las decenas son la cifra del medio: buscá uno que tenga un 0 ahí.',
  test: (n) => tensOf(n) === 0,
}
const greaterThan = (x: number): Clue => ({
  text: `Es mayor que ${x}`,
  hint: `Ese no es mayor que ${x}. Buscá uno más grande.`,
  test: (n) => n > x,
})
const lessThan = (x: number): Clue => ({
  text: `Es menor que ${x}`,
  hint: `Ese no es menor que ${x}. Buscá uno más chico.`,
  test: (n) => n < x,
})
const between = (a: number, b: number): Clue => ({
  text: `Está entre ${a} y ${b}`,
  hint: `Ese no está entre ${a} y ${b}. Tiene que ser mayor que ${a} y menor que ${b}.`,
  test: (n) => n > a && n < b,
})
const hundredsAndUnits = (h: number, u: number): Clue => ({
  text: `Tiene ${centenas(h)} y ${unidades(u)}`,
  hint: `Ese no tiene ${centenas(h)} y ${unidades(u)}. Mirá la primera y la última cifra.`,
  test: (n) => hundredsOf(n) === h && unitsOf(n) === u,
})
const tensAndUnits = (t: number, u: number): Clue => ({
  text: `Tiene ${decenas(t)} y ${unidades(u)}`,
  hint: `Ese no tiene ${decenas(t)} y ${unidades(u)}. Mirá las dos últimas cifras.`,
  test: (n) => tensOf(n) === t && unitsOf(n) === u,
})

// The examples are numbers that appear in NO board, so a reminder never doubles as an answer.
const LEGEND_2 = 'Ejemplo: en 47 hay 4 decenas y 7 unidades.'
const LEGEND_3 = 'Ejemplo: en 325 hay 3 centenas, 2 decenas y 5 unidades.'

// Every board in a level has the same count of numbers and clues, so
// TOTAL_CLUES never depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    digits: 2,
    legend: LEGEND_2,
    boards: [
      {
        numbers: [14, 27, 35, 48, 52, 61, 79, 83, 96],
        clues: [tensIs(3, 'la primera cifra'), unitsIs(8), greaterThan(90)],
      },
      {
        numbers: [18, 23, 41, 56, 62, 77, 85, 39, 94],
        clues: [lessThan(20), tensIs(6, 'la primera cifra'), unitsIs(3)],
      },
    ],
  },
  {
    name: 'Nivel 2',
    digits: 3,
    legend: LEGEND_3,
    boards: [
      {
        numbers: [235, 313, 458, 172, 603, 784, 940, 521, 867, 109, 206, 695],
        clues: [unitsIs(8), tensIs(3, 'la cifra del medio'), between(130, 200)],
      },
      {
        numbers: [362, 725, 447, 506, 391, 616, 850, 189, 934, 257, 508, 913],
        clues: [unitsIs(5), between(400, 500), tensIs(6, 'la cifra del medio')],
      },
    ],
  },
  {
    name: 'Nivel 3',
    digits: 3,
    legend: LEGEND_3,
    boards: [
      {
        numbers: [987, 943, 306, 360, 417, 471, 267, 582, 528, 135, 724, 650],
        clues: [greaterThan(950), noTens, hundredsAndUnits(4, 7), tensAndUnits(8, 2)],
      },
      {
        numbers: [135, 168, 204, 743, 734, 473, 691, 619, 961, 358, 825, 512],
        clues: [lessThan(150), noTens, hundredsAndUnits(7, 3), tensAndUnits(9, 1)],
      },
    ],
  },
]

const TOTAL_CLUES = LEVELS.reduce((sum, lvl) => sum + lvl.boards[0].clues.length, 0)
// ── data:end ──

/** [35, 48, 96] → "35, 48 y 96" */
function listWithY(items: number[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
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

interface LevelContent {
  /** The grid, in its (frozen) display order. */
  numbers: number[]
  clues: Clue[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const board = pickOne(lvl.boards)
    return { numbers: shuffle(board.numbers), clues: board.clues }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo para los números!']

// Full class strings, never interpolated: Tailwind only emits classes it can
// read literally in the source.
const GRID_CLASS: Record<2 | 3, string> = {
  2: 'grid-cols-3 gap-3',
  3: 'grid-cols-4 gap-2',
}
const CELL_CLASS: Record<2 | 3, string> = {
  2: 'min-h-[60px] text-2xl',
  3: 'min-h-[56px] text-xl',
}

/** The three place-value boxes of the worked example (325). */
function PlaceValueExample() {
  const cells = [
    { digit: '3', label: 'centenas' },
    { digit: '2', label: 'decenas' },
    { digit: '5', label: 'unidades' },
  ]
  return (
    <div className="mt-3 flex justify-center gap-2">
      {cells.map((c) => (
        <div key={c.label} className="flex w-[86px] flex-col items-center gap-1">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-cyan-600/40 bg-white text-2xl font-bold text-slate-800">
            {c.digit}
          </span>
          <span className="text-sm font-semibold text-slate-600">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: () => void }) {
  const steps = [
    'Vas a ver una pista y una grilla de números.',
    'Tocá el número que cumple la pista. Hay uno solo.',
    'Si te ayuda, recordá cómo se leen las cifras de un número:',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-cyan-600/20 bg-cyan-600/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3">
        <p className="text-center text-sm font-semibold text-slate-500">En el número 325 hay:</p>
        <PlaceValueExample />
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
  onMistake: () => void
  onSolved: () => void
  onNext: () => void
  onRepeat: () => void
}

function LevelView({ levelIdx, content, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { numbers, clues } = content

  const [found, setFound] = useState<number[]>([])
  const [wrongNumber, setWrongNumber] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

  const clueIdx = found.length
  const solved = clueIdx >= clues.length
  const clue = clues[clueIdx]

  function handleTap(n: number) {
    // A second tap on the number that is still flashing as wrong is a double
    // tap, not a second mistake.
    if (solved || found.includes(n) || wrongNumber === n) return
    if (clue.test(n)) {
      setFound((f) => [...f, n])
      setWrongNumber(null)
      setHint(null)
      if (clueIdx === clues.length - 1) {
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setWrongNumber(n)
      setHint(clue.hint)
      onMistake()
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setWrongNumber(null), 600)
    }
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
      </div>

      {!solved && (
        <>
          {/* The clue on screen */}
          <div className="mx-auto mt-3 max-w-sm rounded-2xl border-2 border-cyan-600/30 bg-cyan-600/5 px-4 py-3 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Pista {clueIdx + 1} de {clues.length}
            </p>
            <p className="mt-1 text-2xl font-bold leading-tight text-slate-900">{clue.text}</p>
            <p className="mt-1.5 text-base text-slate-500">{level.legend}</p>
          </div>

          {/* Grid */}
          <div className={`mx-auto mt-4 grid max-w-sm ${GRID_CLASS[level.digits]}`}>
            {numbers.map((n) => {
              const isFound = found.includes(n)
              const isWrong = wrongNumber === n
              return (
                <button
                  key={n}
                  type="button"
                  disabled={isFound}
                  onClick={() => handleTap(n)}
                  aria-label={`Número ${n}`}
                  className={[
                    'relative flex items-center justify-center rounded-2xl border-2 font-bold transition',
                    CELL_CLASS[level.digits],
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isFound
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isWrong
                        ? 'border-slate-300 bg-slate-100 text-slate-500 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {n}
                  {isFound && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
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
          <p className="mt-1 text-slate-600">
            Descubriste los {clues.length} números: {listWithY(found)}. ¡Completaste el {level.name.toLowerCase()}!
          </p>
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

export function ElNumeroSecreto({ onComplete }: GameProps) {
  // Which board each level plays, and the grid order — decided once, at mount,
  // so "Repetir" plays exactly the same boards.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never
  // brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_CLUES })
  }
  function handleRepeat() {
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
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
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={() => setLevelIdx((i) => i + 1)}
      onRepeat={handleRepeat}
    />
  )
}
