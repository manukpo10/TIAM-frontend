import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Pintá según el código" — día 29, mes 5, atención. A field of outline shapes
 * (triángulos, círculos, cuadrados and pentágonos) and, above it, a CODE that says
 * which kinds get painted and in what colour ("Triángulos = rojo"). The player
 * scans the field and taps every shape the code names; each one fills with its
 * colour on the spot. The shapes the code does not name stay as they are. Going
 * over a field, picking out the right kinds and not skipping or repeating any is a
 * cancellation task, the classic attention exercise.
 *
 * Ramp: ONE code over a 5×3 field of 15 shapes → TWO codes over 18 shapes → THREE
 * codes over 20 shapes and, once everything is painted, a last question — "¿Cuántos
 * triángulos pintaste?" — answered by tapping one of four numbers. The board stays
 * on screen for that question, so the answer can be counted, never remembered.
 *
 * A wrong tap (a shape the code does not name) flashes muted gray (never red),
 * costs ONE mistake and lights up the code card; a second tap on the shape that is
 * still flashing is a double tap, not another mistake, and a shape that is already
 * painted ignores taps. A progress line ("Llevás 3 de 5") tells how many are
 * left, so nobody keeps hunting after the last one. When everything is painted the
 * level closes after a short pause (the only timer in the game), and then the board
 * gives its room to the result card so the button stays on screen on a short phone.
 *
 * THE LAYOUT IS A GRID: one shape per cell and the whole cell is the button, so two
 * shapes never overlap and every target is as big as the cell (≥ 45px on a 320px
 * phone, 5 columns). Empty cells are plain gaps. Shapes are drawn upright with
 * a thick outline, all about the same size, so a pentágono is never confused with a
 * círculo for being smaller or tilted; a painted shape is filled AND keeps its
 * outline, so "painted" never depends on telling two colours apart.
 *
 * COLOURS are the far-apart inks of El color de la palabra (rojo, azul, dorado,
 * violeta here; verde and negro are not used), always named in the code. Orange,
 * brown and grey are never fills (the unpainted outline is a dark slate, and no
 * code uses negro, so grey and black never share a board).
 *
 * ONE field per level: each level has two authored fields and one is picked ONCE at
 * mount (`epoch`), so "Repetir" replays exactly the same three. Both fields of a
 * level have the same number of shapes to paint, so the score never depends on which
 * one is drawn. Per-level state lives in <LevelView>, keyed by run + level. A
 * "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. A
 * throwaway Node script (not committed) counts every kind in every field, checks the
 * targets and the final question's options, the 44px floor at 320px and the palette.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by
 * the click's own timeStamp) is ignored, so the second tap of a double tap on "Empezar",
 * "Siguiente nivel" or "Repetir" never paints or flashes a shape (the field sits right
 * where that button was). A painted shape ignores taps, and while the level closes every
 * shape and option is off, which swallows a double tap on the LAST one. In level 3 the
 * last shape does not close the level: the code card above the field goes away to make
 * room for the question, so everything under it jumps up by the card's height and an
 * option can end up under the finger that just tapped (a last shape in the third row of
 * the field, at 320-412px). An option therefore ignores taps for SETTLE_MS after the last
 * shape is painted (`paintedAtRef`). The solved card is scrolled into view, and so is its
 * button, on a short phone; a new level opens at its top.
 *
 * totalAttempts = mistakes + every shape to paint + the final question
 * (TOTAL_STEPS, derived).
 */

// ── data:start ──
type ShapeKind = 'triangulo' | 'circulo' | 'cuadrado' | 'pentagono'
type InkId = 'rojo' | 'azul' | 'dorado' | 'violeta'

interface ShapeNames {
  /** "Triángulos" (code card) */
  plural: string
  /** "triángulos" */
  many: string
  /** "triángulo" */
  one: string
}
const SHAPES: Record<ShapeKind, ShapeNames> = {
  triangulo: { plural: 'Triángulos', many: 'triángulos', one: 'triángulo' },
  circulo: { plural: 'Círculos', many: 'círculos', one: 'círculo' },
  cuadrado: { plural: 'Cuadrados', many: 'cuadrados', one: 'cuadrado' },
  pentagono: { plural: 'Pentágonos', many: 'pentágonos', one: 'pentágono' },
}

// Four of the six inks of ElColorDeLaPalabra: every pair is at least 35 apart in
// CIEDE2000. Verde and negro are left out on purpose (red/green and grey/black
// are the pairs this catalogue keeps off a board).
const INKS: Record<InkId, { name: string; hex: string }> = {
  rojo: { name: 'rojo', hex: '#D0021B' },
  azul: { name: 'azul', hex: '#1678D4' },
  dorado: { name: 'dorado', hex: '#B8860B' },
  violeta: { name: 'violeta', hex: '#7E0197' },
}

/** One character per cell in the authored fields; "." is an empty cell. */
const KIND_OF_CODE: Record<string, ShapeKind> = {
  T: 'triangulo',
  C: 'circulo',
  Q: 'cuadrado',
  P: 'pentagono',
}

interface CodeDef {
  kind: ShapeKind
  ink: InkId
}
interface QuestionDef {
  kind: ShapeKind
  /** The four numbers offered (shown as they are written here): the right count and its near misses. */
  options: number[]
}
interface BoardDef {
  /** The kinds the code paints, each with its colour. */
  codes: CodeDef[]
  /** One string per row, five cells each. */
  rows: string[]
  question?: QuestionDef
}
interface LevelDef {
  name: string
  /** Two authored fields; one is picked at mount. */
  boards: BoardDef[]
}

// Every field is five cells wide (the grid below is `grid-cols-5`). Every field
// of a level has the same number of shapes to paint (and the same number of
// shapes), so TOTAL_STEPS never depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    boards: [
      { codes: [{ kind: 'triangulo', ink: 'rojo' }], rows: ['CTQPT', 'QPTCQ', 'TCQTP'] },
      { codes: [{ kind: 'circulo', ink: 'azul' }], rows: ['QCPTC', 'CTQCP', 'PQCTQ'] },
    ],
  },
  {
    name: 'Nivel 2',
    boards: [
      {
        codes: [
          { kind: 'circulo', ink: 'azul' },
          { kind: 'cuadrado', ink: 'dorado' },
        ],
        rows: ['TC.QP', 'PQTCT', 'CPQ.T', 'QTPCP'],
      },
      {
        codes: [
          { kind: 'triangulo', ink: 'violeta' },
          { kind: 'cuadrado', ink: 'rojo' },
        ],
        rows: ['C.PQT', 'QTCPC', 'PCTQ.', 'TPCQP'],
      },
    ],
  },
  {
    name: 'Nivel 3',
    boards: [
      {
        codes: [
          { kind: 'triangulo', ink: 'rojo' },
          { kind: 'circulo', ink: 'azul' },
          { kind: 'pentagono', ink: 'dorado' },
        ],
        rows: ['TCPQT', 'QPCTC', 'CTQPQ', 'QTCQP'],
        question: { kind: 'triangulo', options: [4, 5, 6, 7] },
      },
      {
        codes: [
          { kind: 'triangulo', ink: 'azul' },
          { kind: 'cuadrado', ink: 'dorado' },
          { kind: 'pentagono', ink: 'rojo' },
        ],
        rows: ['PCTQP', 'CTQCP', 'QCPQC', 'TCQTP'],
        question: { kind: 'triangulo', options: [2, 3, 4, 5] },
      },
    ],
  },
]

/** The kind of every cell of a field, row by row (null for an empty cell). */
function cellsOf(board: BoardDef): (ShapeKind | null)[] {
  return board.rows.flatMap((row) => row.split('').map((ch) => KIND_OF_CODE[ch] ?? null))
}

/** The code that paints this kind in this field, if any. */
function codeFor(board: BoardDef, kind: ShapeKind): CodeDef | undefined {
  return board.codes.find((c) => c.kind === kind)
}

/** How many shapes of this kind are in the field. */
function countKind(board: BoardDef, kind: ShapeKind): number {
  return cellsOf(board).filter((k) => k === kind).length
}

/** Shapes the player has to paint in a field: every one whose kind is in the code. */
function targetsOf(board: BoardDef): number {
  return cellsOf(board).filter((k) => k !== null && codeFor(board, k) !== undefined).length
}

const TOTAL_STEPS = LEVELS.reduce(
  (sum, lvl) => sum + targetsOf(lvl.boards[0]) + (lvl.boards[0].question ? 1 : 0),
  0,
)
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface LevelContent {
  board: BoardDef
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({ board: pickOne(lvl.boards) }))
}

/** How long the board stays on screen after the last shape is painted / the right answer. */
const CLOSE_MS = 1000
/** How long a wrong shape stays flashing (and ignores a second tap). */
const FLASH_MS = 600
/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel",
 * "Repetir") is the second tap of a double tap, and it must not paint or flash a shape (the field
 * sits right where that button was). Long enough to swallow a double tap, short enough that nobody
 * who means it notices. */
const SETTLE_MS = 400

const PRAISE = ['¡Muy bien!', '¡Excelente atención!', '¡Así se hace!', '¡Qué buen ojo!', '¡Perfecto!']

/** "5 triángulos de rojo, 5 círculos de azul y 4 pentágonos de dorado". */
function describeCodes(board: BoardDef): string {
  const parts = board.codes.map((c) => {
    const n = countKind(board, c.kind)
    return `${n} ${n === 1 ? SHAPES[c.kind].one : SHAPES[c.kind].many} de ${INKS[c.ink].name}`
  })
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

interface GlyphProps {
  kind: ShapeKind
  fill: string
  stroke: string
  className?: string
}

/** One outline shape in a 40×40 box. Upright, thick outline, all about the same size. */
function ShapeGlyph({ kind, fill, stroke, className }: GlyphProps) {
  const paint = { fill, stroke, strokeWidth: 3, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      {kind === 'circulo' && <circle cx="20" cy="20" r="15" {...paint} />}
      {kind === 'cuadrado' && <rect x="6" y="6" width="28" height="28" rx="2" {...paint} />}
      {kind === 'triangulo' && <polygon points="20,4 37,35 3,35" {...paint} />}
      {kind === 'pentagono' && <polygon points="20,4.8 35.7,16.2 29.7,34.7 10.3,34.7 4.3,16.2" {...paint} />}
    </svg>
  )
}

const OUTLINE = '#475569'
const OUTLINE_MUTED = '#94A3B8'

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a one-line example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'El código dice qué formas se pintan y de qué color.',
    'Tocá cada forma del código y se pinta sola. Las demás quedan como están.',
  ]
  const red = INKS.rojo.hex
  return (
    <div className="mt-4 rounded-3xl border border-orange-600/20 bg-tiam-orange/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-sm font-semibold text-slate-500">Por ejemplo, con este código:</p>
        <p className="mt-1 flex items-center justify-center gap-2 text-lg font-bold text-slate-900">
          <ShapeGlyph kind="triangulo" fill={red} stroke={red} className="h-7 w-7 shrink-0" />
          Triángulos = rojo
        </p>
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
          <ShapeGlyph kind="triangulo" fill="#ffffff" stroke={OUTLINE} className="h-8 w-8 shrink-0" />
          <ShapeGlyph kind="cuadrado" fill="#ffffff" stroke={OUTLINE} className="h-8 w-8 shrink-0" />
          <ArrowRight className="mx-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <ShapeGlyph kind="triangulo" fill={red} stroke={red} className="h-8 w-8 shrink-0" />
          <ShapeGlyph kind="cuadrado" fill="#ffffff" stroke={OUTLINE} className="h-8 w-8 shrink-0" />
        </div>
      </div>
      {/* Pinned to the bottom edge when the screen is too short to show it in place (320x640). */}
      <div className="sticky bottom-3 z-10 mt-4 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

type Stage = 'painting' | 'asking' | 'closing' | 'done'

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
  const { board } = content
  const cells = cellsOf(board)
  const targets = targetsOf(board)
  const { question } = board

  // The cells already painted, in the order they were tapped.
  const [painted, setPainted] = useState<number[]>([])
  const [stage, setStage] = useState<Stage>('painting')
  const [flashCell, setFlashCell] = useState<number | null>(null)
  const [wrongOptions, setWrongOptions] = useState<number[]>([])
  // The code card lights up after a slip, until the next shape is painted.
  const [codeLit, setCodeLit] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The cell that is flashing as wrong, and the options already tapped: a second tap on
  // either is a double tap, even when both land before React has repainted.
  const flashingRef = useRef<number | null>(null)
  const tappedOptionsRef = useRef<Set<number>>(new Set())
  // The timeStamp of the tap that painted the last shape and so brought the question's options on
  // screen (the code card goes away and the layout jumps up): a tap right after it is its double tap.
  const paintedAtRef = useRef(-Infinity)
  const flashTimerRef = useRef<number | undefined>(undefined)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(
    () => () => {
      window.clearTimeout(flashTimerRef.current)
      window.clearTimeout(closeTimerRef.current)
    },
    [],
  )

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (stage !== 'done' || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [stage])

  function close(text: string) {
    setStage('closing')
    setHint({ text, ok: true })
    setCodeLit(false)
    closeTimerRef.current = window.setTimeout(() => {
      setPraise(pickOne(PRAISE))
      setStage('done')
      onSolved()
    }, CLOSE_MS)
  }

  function handleCellTap(index: number, at: number) {
    // The second tap of a double tap on the button that brought the level lands on the field: ignore it.
    if (stage !== 'painting' || at - since < SETTLE_MS || flashingRef.current === index || painted.includes(index)) return
    const kind = cells[index]
    if (kind === null) return
    if (codeFor(board, kind)) {
      const next = [...painted, index]
      setPainted(next)
      setHint(null)
      setCodeLit(false)
      if (next.length >= targets) {
        if (question) {
          paintedAtRef.current = at
          setStage('asking')
        } else {
          close('¡Las pintaste todas!')
        }
      }
      return
    }
    // A shape the code does not name: flash it gray, cost one mistake.
    flashingRef.current = index
    setFlashCell(index)
    setCodeLit(true)
    setHint({ text: `Ese es un ${SHAPES[kind].one}, y el código no lo pide.`, ok: false })
    onMistake()
    window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => {
      flashingRef.current = null
      setFlashCell(null)
    }, FLASH_MS)
  }

  function handleOptionTap(value: number, at: number) {
    if (stage !== 'asking' || !question || at - since < SETTLE_MS || tappedOptionsRef.current.has(value)) return
    // The second tap of a double tap on the last shape can land on an option (the code card is gone,
    // so the layout jumped up under the finger): ignore it.
    if (at - paintedAtRef.current < SETTLE_MS) return
    tappedOptionsRef.current.add(value)
    const answer = countKind(board, question.kind)
    if (value === answer) {
      close(`¡Eso es! Pintaste ${answer} ${answer === 1 ? SHAPES[question.kind].one : SHAPES[question.kind].many}.`)
    } else {
      setWrongOptions((w) => [...w, value])
      const ink = codeFor(board, question.kind)?.ink
      setHint({
        text: `Contalos en el tablero, de a uno: son los ${SHAPES[question.kind].many} pintados${ink ? ` de ${INKS[ink].name}` : ''}.`,
        ok: false,
      })
      onMistake()
    }
  }

  // The kind the final question is about, once everything is painted (and while it closes).
  const askedKind = question && (stage === 'asking' || stage === 'closing') ? question.kind : null
  const showCode = askedKind === null && stage !== 'done'
  const answer = question ? countKind(board, question.kind) : 0
  const title =
    askedKind !== null
      ? `¿Cuántos ${SHAPES[askedKind].many} pintaste?`
      : board.codes.length === 1
        ? `Pintá todos los ${SHAPES[board.codes[0].kind].many} de ${INKS[board.codes[0].ink].name}`
        : 'Pintá cada forma'

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
          {level.name}
        </span>
        {stage !== 'done' && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              {askedKind !== null ? 'Última pregunta' : `Llevás ${painted.length} de ${targets}`}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{title}</h2>
          </>
        )}
      </div>

      {/* The code */}
      {showCode && (
        <div
          className={[
            'mx-auto mt-3 max-w-sm rounded-2xl border-2 px-3 py-2 transition',
            codeLit ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : 'border-slate-200 bg-slate-50',
          ].join(' ')}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Código</p>
          <ul className="mt-1 space-y-1">
            {board.codes.map((c) => (
              <li key={c.kind} className="flex items-center gap-2.5 text-lg font-bold leading-tight text-slate-900">
                <ShapeGlyph kind={c.kind} fill={INKS[c.ink].hex} stroke={INKS[c.ink].hex} className="h-7 w-7 shrink-0" />
                <span>
                  {SHAPES[c.kind].plural} = {INKS[c.ink].name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The field: one shape per cell, the whole cell is the button */}
      {stage !== 'done' && (
        <div
          role="group"
          aria-label="Tablero con formas"
          className="mx-auto mt-3 grid max-w-sm grid-cols-5 gap-1 rounded-2xl border-2 border-slate-100 bg-white p-1"
        >
          {cells.map((kind, i) => {
            if (kind === null) return <div key={i} aria-hidden="true" className="aspect-square" />
            const code = codeFor(board, kind)
            const isPainted = painted.includes(i)
            const isFlash = flashCell === i
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => handleCellTap(i, e.timeStamp)}
                aria-label={`${SHAPES[kind].one}, ${isPainted && code ? `pintado de ${INKS[code.ink].name}` : 'sin pintar'}`}
                className={[
                  'flex aspect-square items-center justify-center rounded-xl border-2 transition',
                  'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  isFlash
                    ? 'border-slate-300 bg-slate-100 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                    : isPainted
                      ? 'border-transparent bg-white'
                      : 'border-slate-100 bg-white hover:border-tiam-blue/40 hover:shadow-md active:scale-95',
                ].join(' ')}
              >
                <ShapeGlyph
                  kind={kind}
                  fill={isPainted && code ? INKS[code.ink].hex : '#ffffff'}
                  stroke={isPainted && code ? INKS[code.ink].hex : isFlash ? OUTLINE_MUTED : OUTLINE}
                  className="w-[86%]"
                />
              </button>
            )
          })}
        </div>
      )}

      {/* The final question */}
      {askedKind !== null && question && (
        <div className="mx-auto mt-3 grid max-w-sm grid-cols-4 gap-2" role="group" aria-label="Opciones">
          {question.options.map((value) => {
            const isWrong = wrongOptions.includes(value)
            const isRightShown = stage === 'closing' && value === answer
            return (
              <button
                key={value}
                type="button"
                disabled={isWrong || stage === 'closing'}
                onClick={(e) => handleOptionTap(value, e.timeStamp)}
                className={[
                  'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 text-2xl font-bold transition',
                  'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  isRightShown
                    ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                    : isWrong
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                ].join(' ')}
              >
                {value}
                {isRightShown && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {stage !== 'done' && (
        <p
          role="status"
          className={`mt-2 min-h-[3rem] text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
        >
          {hint?.text}
        </p>
      )}

      {/* Level complete: the field gives its room to the card */}
      {stage === 'done' && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Pintaste {describeCodes(board)}. ¡Completaste el {level.name.toLowerCase()}!
          </p>
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

export function PintaSegunElCodigo({ onComplete }: GameProps) {
  // Which field each level plays — decided once, at mount, so "Repetir" replays
  // exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never
  // brings it back.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_STEPS })
  }
  function handleStart(at: number) {
    setSince(at)
    setPhase('playing')
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Pintá cada forma</h2>
        </div>
        <HowToPlay onStart={handleStart} />
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
