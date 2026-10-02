import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Forma y color" — día 6, mes 5, orientación. A double-entry table: each ROW is
 * a shape (círculo, cuadrado, triángulo, rombo), each COLUMN is a colour, and
 * every cell holds one letter. Above it, a row of coloured shapes; each one
 * points at one cell — find its row, find its column, tap where they cross —
 * and the letters you collect spell a word. Reading a two-way table (a
 * timetable, a spreadsheet, a map grid) is the orientation skill; the word is
 * the payoff, and a category clue ("es una fruta") plus the empty boxes under
 * every shape (the word's length) keep it from ever being a guessing game.
 *
 * NO LETTER REPEATS IN A TABLE. Every cell of every authored table holds a
 * different letter, so a letter points at exactly one cell: tapping "the
 * letter you can see" and tapping "the cell the shape points at" are the same
 * thing, and the check can compare cells without ever rejecting a correct
 * reading. A word that repeats a letter (PLAZA) simply points at the same cell
 * twice. The steps are DERIVED from the word and the table (`stepsOf`), never
 * authored separately, so they cannot drift out of sync; a throwaway Node
 * script (not committed) confirmed for every table that its letters are all
 * distinct, that it contains every letter of its word and that no letter easy
 * to misread (I, Q) is in play.
 *
 * Colours are the same far-apart inks the Stroop day uses (rojo, azul, verde,
 * negro: never a lookalike pair) and each shape also carries its colour NAME
 * under it, so a player who cannot tell the hues apart can still match words.
 * The rombo is drawn tall and narrow so it never reads as a tilted cuadrado.
 *
 * A wrong tap flashes muted gray (never red), costs one mistake and turns on a
 * scaffold: the target's row and column headers light up and the hint names
 * them. The flash is temporary — a cell that is wrong for this step is the
 * right answer for the next one, so nothing is ever locked.
 *
 * Ramp: L1 3 shapes × 3 colours, a 3-letter word; L2 adds the rombo (4 × 3, a
 * 4-letter word); L3 adds the negro column (4 × 4, a 5-letter word). ONE word
 * per level: each level has two authored tables and one is picked ONCE at mount
 * (`epoch`), so "Repetir" replays exactly the same three tables. Per-level state
 * lives in <LevelView>, keyed by run + level. A "¿Cómo se juega?" screen with a
 * worked example opens the day; "Repetir" never brings it back.
 *
 * totalAttempts = mistakes + every letter of the day (TOTAL_LETTERS, derived).
 */

// ── data:start ──
type ShapeId = 'circulo' | 'cuadrado' | 'triangulo' | 'rombo'
type ColorId = 'rojo' | 'azul' | 'verde' | 'negro'

const SHAPES: Record<ShapeId, { label: string; article: string }> = {
  circulo: { label: 'Círculo', article: 'del círculo' },
  cuadrado: { label: 'Cuadrado', article: 'del cuadrado' },
  triangulo: { label: 'Triángulo', article: 'del triángulo' },
  rombo: { label: 'Rombo', article: 'del rombo' },
}
// The inks of ElColorDeLaPalabra (≥ 35 apart in CIEDE2000, ≥ 3:1 on white).
const COLORS: Record<ColorId, { label: string; article: string; hex: string }> = {
  rojo: { label: 'Rojo', article: 'del rojo', hex: '#D0021B' },
  azul: { label: 'Azul', article: 'del azul', hex: '#1678D4' },
  verde: { label: 'Verde', article: 'del verde', hex: '#05741C' },
  negro: { label: 'Negro', article: 'del negro', hex: '#000000' },
}

interface PuzzleDef {
  /** Completes "Pista: es …". */
  clue: string
  word: string
  /** One string per shape row, one letter per colour column. */
  rows: string[]
}
interface LevelDef {
  name: string
  shapes: ShapeId[]
  colors: ColorId[]
  puzzles: PuzzleDef[]
}

// Every table holds all-different letters (no I or Q, which read badly), so a
// letter marks exactly one cell. Every word in a level has the same length.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    shapes: ['circulo', 'cuadrado', 'triangulo'],
    colors: ['rojo', 'azul', 'verde'],
    puzzles: [
      { clue: 'una fruta', word: 'UVA', rows: ['MUT', 'VSP', 'NRA'] },
      { clue: 'una comida', word: 'PAN', rows: ['LGP', 'DNF', 'ATB'] },
    ],
  },
  {
    name: 'Nivel 2',
    shapes: ['circulo', 'cuadrado', 'triangulo', 'rombo'],
    colors: ['rojo', 'azul', 'verde'],
    puzzles: [
      { clue: 'un animal', word: 'GATO', rows: ['ROM', 'SGL', 'NDT', 'APC'] },
      { clue: 'un mueble', word: 'MESA', rows: ['BMR', 'ELT', 'DNS', 'CAP'] },
    ],
  },
  {
    name: 'Nivel 3',
    shapes: ['circulo', 'cuadrado', 'triangulo', 'rombo'],
    colors: ['rojo', 'azul', 'verde', 'negro'],
    puzzles: [
      { clue: 'algo para sentarse', word: 'BANCO', rows: ['RLTN', 'BDGP', 'FMCS', 'HAVO'] },
      { clue: 'un lugar del barrio', word: 'PLAZA', rows: ['FPBH', 'CDGL', 'AMRN', 'SVZT'] },
    ],
  },
]

interface Step {
  row: number
  col: number
  letter: string
}

/** The cell each letter of the word points at, in order. */
function stepsOf(puzzle: PuzzleDef): Step[] {
  return puzzle.word.split('').map((letter) => {
    const row = puzzle.rows.findIndex((r) => r.includes(letter))
    return { row, col: row < 0 ? -1 : puzzle.rows[row].indexOf(letter), letter }
  })
}

const TOTAL_LETTERS = LEVELS.reduce((sum, lvl) => sum + lvl.puzzles[0].word.length, 0)
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface LevelContent {
  puzzle: PuzzleDef
  steps: Step[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const puzzle = pickOne(lvl.puzzles)
    return { puzzle, steps: stepsOf(puzzle) }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente orientación!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena vista!']

const cellKey = (row: number, col: number) => `${row}-${col}`

/**
 * A filled glyph is a COLOURED FIGURE (the thing to decode); a hollow one is
 * only a row label in the table, so a grey outline can never be mistaken for a
 * colour (gris/negro is one of the pairs this catalog keeps apart).
 */
function ShapeGlyph({ shape, fill, size, hollow }: { shape: ShapeId; fill: string; size: number; hollow?: boolean }) {
  const paint = hollow
    ? { fill: 'none', stroke: '#475569', strokeWidth: 3, strokeLinejoin: 'round' as const }
    : { fill }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="shrink-0">
      {shape === 'circulo' && <circle cx="20" cy="20" r="15" {...paint} />}
      {shape === 'cuadrado' && <rect x="6" y="6" width="28" height="28" rx="2" {...paint} />}
      {shape === 'triangulo' && <polygon points="20,5 36,34 4,34" {...paint} />}
      {shape === 'rombo' && <polygon points="20,3 31,20 20,37 9,20" {...paint} />}
    </svg>
  )
}

// Full class string (Tailwind only emits classes it can read literally).
const BLEED_CLASS = 'max-[350px]:-mx-2 max-[350px]:w-[calc(100%+1rem)]'

interface CellTableProps {
  shapes: ShapeId[]
  colors: ColorId[]
  rows: string[]
  small?: boolean
  /** Row / column headers to light up (the scaffold). */
  activeRow?: number
  activeCol?: number
  /** Cells the player has already used in this word. */
  usedKeys?: ReadonlySet<string>
  wrongKey?: string | null
  /** A cell to show in green (the worked example). */
  markKey?: string | null
  onTap?: (row: number, col: number) => void
}

function CellTable({ shapes, colors, rows, small, activeRow, activeCol, usedKeys, wrongKey, markKey, onTap }: CellTableProps) {
  // Wide enough for "Cuadrado" at 14px bold (68.6px) without touching the edges.
  const headWidth = 72
  const gap = small ? 4 : 6
  // Cells never grow past this size: with only three columns the squares would
  // otherwise balloon and push the bottom of the screen below the fold. With
  // four columns the table fills the width and the cells shrink to ~54px too.
  const maxCell = small ? 44 : 54
  return (
    <div
      className={[
        'mx-auto grid w-full',
        // Four columns at 320px would squeeze the cells below 44px: let the table
        // borrow 8px of the screen padding on each side there.
        colors.length >= 4 && !small ? BLEED_CLASS : '',
      ].join(' ')}
      style={{
        gridTemplateColumns: `${headWidth}px repeat(${colors.length}, minmax(0, 1fr))`,
        gap,
        maxWidth: headWidth + colors.length * (maxCell + gap),
      }}
    >
      <div aria-hidden="true" />
      {colors.map((c, ci) => (
        <div
          key={c}
          className={[
            'flex flex-col items-center justify-end gap-1 rounded-xl py-1',
            activeCol === ci ? 'bg-tiam-blue/10 text-tiam-blue-dark' : 'text-slate-600',
          ].join(' ')}
        >
          <span className="h-2.5 w-8 rounded-full" style={{ backgroundColor: COLORS[c].hex }} aria-hidden="true" />
          <span className="text-sm font-bold">{COLORS[c].label}</span>
        </div>
      ))}
      {shapes.map((s, ri) => (
        <div key={s} className="contents">
          <div
            className={[
              'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1',
              activeRow === ri ? 'bg-tiam-blue/10 text-tiam-blue-dark' : 'text-slate-600',
            ].join(' ')}
          >
            <ShapeGlyph shape={s} fill="none" hollow size={small ? 20 : 26} />
            <span className="text-sm font-bold">{SHAPES[s].label}</span>
          </div>
          {colors.map((c, ci) => {
            const key = cellKey(ri, ci)
            const letter = rows[ri][ci]
            const isMarked = markKey === key
            const isUsed = usedKeys?.has(key) ?? false
            const isWrong = wrongKey === key
            const className = [
              'relative flex aspect-square items-center justify-center rounded-xl border-2 font-bold transition',
              small ? 'min-h-[40px] text-lg' : 'min-h-[44px] text-2xl',
              isMarked || isUsed
                ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                : isWrong
                  ? 'border-slate-300 bg-slate-100 text-slate-500 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                  : 'border-slate-200 bg-white text-slate-800',
              onTap && !isWrong && !isUsed
                ? 'hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                : '',
            ].join(' ')
            if (!onTap) {
              return (
                <div key={key} className={className}>
                  {letter}
                </div>
              )
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTap(ri, ci)}
                aria-label={`${SHAPES[s].label} ${COLORS[c].label.toLowerCase()}: letra ${letter}`}
                className={`${className} focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1`}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: () => void }) {
  // Two short steps and a worked example: this whole screen has to fit a phone
  // without scrolling, because the "Empezar" button is at the bottom of it.
  const steps = [
    'Cada figura de color que ves arriba esconde una letra de la tabla.',
    'Buscá la fila de su forma y la columna de su color: la letra está donde se cruzan.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-amber-600/20 bg-amber-600/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      {/* Worked example, drawn with the real table markup */}
      <div className="mt-3 rounded-2xl bg-white p-3">
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-semibold text-slate-500">Por ejemplo, un</span>
          <ShapeGlyph shape="circulo" fill={COLORS.rojo.hex} size={30} />
          <span className="text-base font-bold text-slate-700">círculo rojo</span>
        </div>
        <div className="mt-2">
          <CellTable
            small
            shapes={['circulo', 'cuadrado']}
            colors={['rojo', 'azul']}
            rows={['SO', 'LA']}
            activeRow={0}
            activeCol={0}
            markKey={cellKey(0, 0)}
          />
        </div>
        <p className="mt-2 text-center text-sm leading-snug text-slate-600">
          Se cruzan en la <span className="font-bold">S</span>. Con todas las letras armás una palabra.
        </p>
      </div>

      <div className="mt-4 text-center">
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
  const { puzzle, steps } = content

  // How many letters of the word are decoded: the step to solve is stepIdx.
  const [stepIdx, setStepIdx] = useState(0)
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [scaffold, setScaffold] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

  const solved = stepIdx >= steps.length
  const current = solved ? null : steps[stepIdx]
  // A cell is painted "used" only once the word is done with it: PLAZA points at the
  // same cell for both A's, so it stays unpainted until the second one is found.
  const stillNeeded = new Set(steps.slice(stepIdx).map((s) => cellKey(s.row, s.col)))
  const usedKeys = new Set(
    steps
      .slice(0, stepIdx)
      .map((s) => cellKey(s.row, s.col))
      .filter((key) => !stillNeeded.has(key)),
  )

  function handleTap(row: number, col: number) {
    // A second tap on the cell that is still flashing as wrong is a double tap,
    // not a second mistake.
    if (!current || wrongKey === cellKey(row, col)) return
    if (row === current.row && col === current.col) {
      const next = stepIdx + 1
      setStepIdx(next)
      setWrongKey(null)
      setScaffold(false)
      setHint(null)
      if (next >= steps.length) {
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      const shape = SHAPES[level.shapes[current.row]]
      const color = COLORS[level.colors[current.col]]
      // Flash only — a cell that is wrong now can be the answer to a later step.
      setWrongKey(cellKey(row, col))
      setScaffold(true)
      setHint(`Esa no es. Buscá la fila ${shape.article} y la columna ${color.article}.`)
      onMistake()
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setWrongKey(null), 600)
    }
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Descubrí la palabra</h2>
            <p className="mt-2 text-base text-slate-500">
              Pista: es <span className="font-bold text-amber-700">{puzzle.clue}</span>.
            </p>
          </>
        )}
      </div>

      {/* The figures of the word, each with an empty box for its letter */}
      <div className="mt-4 flex justify-center gap-1.5">
        {steps.map((step, i) => {
          const shapeId = level.shapes[step.row]
          const color = COLORS[level.colors[step.col]]
          const isDone = i < stepIdx
          const isCurrent = i === stepIdx
          return (
            <div
              key={i}
              role="group"
              aria-label={`Figura ${i + 1}: ${SHAPES[shapeId].label.toLowerCase()} ${color.label.toLowerCase()}`}
              className={[
                'flex w-[52px] flex-col items-center gap-1 rounded-2xl px-1 py-2',
                isCurrent ? 'bg-tiam-blue/10 ring-2 ring-tiam-blue' : 'bg-slate-50',
              ].join(' ')}
            >
              <ShapeGlyph shape={shapeId} fill={color.hex} size={36} />
              <span className="text-sm font-bold text-slate-600">{color.label}</span>
              <span
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-lg border-2 text-2xl font-bold',
                  isDone ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : 'border-dashed border-slate-300 text-slate-300',
                ].join(' ')}
              >
                {isDone ? step.letter : ''}
              </span>
            </div>
          )
        })}
      </div>

      {!solved && (
        <>
          <div className="mt-4">
            <CellTable
              shapes={level.shapes}
              colors={level.colors}
              rows={puzzle.rows}
              activeRow={scaffold && current ? current.row : undefined}
              activeCol={scaffold && current ? current.col : undefined}
              usedKeys={usedKeys}
              wrongKey={wrongKey}
              onTap={handleTap}
            />
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
            La palabra era <span className="font-bold text-slate-800">{puzzle.word}</span>: es {puzzle.clue}. ¡Completaste
            el {level.name.toLowerCase()}!
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

export function FormaYColor({ onComplete }: GameProps) {
  // Which table each level plays — decided once, at mount, so "Repetir" plays
  // exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_LETTERS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
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
