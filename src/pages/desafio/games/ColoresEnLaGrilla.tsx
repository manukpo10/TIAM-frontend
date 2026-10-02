import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Colores en la grilla" — día 17, mes 5, orientación. A board of coloured
 * squares with a LETTER for every row (A, B, C…, from the top) and a NUMBER for
 * every column (1, 2, 3…, from the left). One question at a time: "¿De qué color
 * es la casilla C4?" — find row C, find column 4, look where they cross, and tap
 * the colour you see among the options (a swatch AND its name, never colour
 * alone). Reading a two-way grid by coordinates (a map, a spreadsheet, a bingo
 * card, a battleship board) is the orientation skill; this is the colour twin of
 * month 2's Coordenadas, where the answer was a letter to collect.
 *
 * Wrong tap: that option greys out (muted, never red) and costs one mistake;
 * the hint names where to look and turns on a scaffold — the row letter and the
 * column number of the target light up. The board itself never changes, so the
 * answer stays where it was. A correct tap rings the cell in green, says its
 * colour by name and moves on after a short pause (the only timer in the game).
 *
 * THE INKS ARE THE FAR-APART SIX of El color de la palabra (rojo, azul, verde,
 * negro, dorado, violeta; hex values and the CIEDE2000 numbers are documented
 * there): every pair that can share a board is at least 35 apart, so a cell's
 * colour is never a judgement call. Level 1 uses the four base inks, level 2 adds
 * DORADO, level 3 adds VIOLETA — a new ink per level, never a look-alike. Orange,
 * grey and brown are not in play. Each board also keeps two neighbours from ever
 * sharing an ink (so every square reads as its own square), uses every ink of its
 * level at least twice, and every question lands on a different row and column
 * with a different answer. A throwaway Node script (not committed) checks all of
 * that, plus the palette distances.
 *
 * Ramp: 4×4 with 3 questions → 5×5 with 4 → 5×6 (five rows, six columns) with 5.
 * ONE board per level: each level has two authored boards and one is picked ONCE
 * at mount (`epoch`), so "Repetir" replays exactly the same three boards and the
 * same questions. Per-level state lives in <LevelView>, keyed by run + level. A
 * "¿Cómo se juega?" screen with a worked example opens the day; "Repetir" never
 * brings it back.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged
 * by the click's own timeStamp) is ignored, so the second tap of a double tap on
 * "Empezar", "Siguiente nivel" or "Repetir" never answers the first question; and
 * while the right answer shows its check every option is off, which swallows a
 * double tap on the RIGHT one before the next question replaces it. The solved
 * card is scrolled into view on a short phone.
 *
 * Short phones: the player has to see the board AND the colour buttons together,
 * so the board is capped to what is left of the screen (see boardMaxWidth) and,
 * under 700px of height, the header, spacing and buttons tighten up so that the
 * hint fits too. Targets stay 48px or more and the text 16px or more.
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived).
 */

// ── data:start ──
type InkId = 'rojo' | 'azul' | 'verde' | 'negro' | 'dorado' | 'violeta'

// The six inks of ElColorDeLaPalabra, in the order they enter the levels.
const INKS: Record<InkId, { label: string; hex: string }> = {
  rojo: { label: 'Rojo', hex: '#D0021B' },
  azul: { label: 'Azul', hex: '#1678D4' },
  verde: { label: 'Verde', hex: '#05741C' },
  negro: { label: 'Negro', hex: '#000000' },
  dorado: { label: 'Dorado', hex: '#B8860B' },
  violeta: { label: 'Violeta', hex: '#7E0197' },
}

/** One character per square in the authored boards. */
const CODE_TO_INK: Record<string, InkId> = {
  R: 'rojo',
  A: 'azul',
  V: 'verde',
  N: 'negro',
  D: 'dorado',
  L: 'violeta',
}

interface BoardDef {
  /** One string per row (A, B, C…), one code character per column (1, 2, 3…). */
  rows: string[]
  /** The squares to ask about, in order, as "C4": row letter + column number. */
  asks: string[]
}
interface LevelDef {
  name: string
  /** The inks in play: they are also the answer options, in this order. */
  inks: InkId[]
  boards: BoardDef[]
}

const BASE_INKS: InkId[] = ['rojo', 'azul', 'verde', 'negro']

// Every board of a level has the same size and the same number of questions, so
// TOTAL_QUESTIONS never depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    inks: BASE_INKS,
    boards: [
      { rows: ['ARAN', 'VNRV', 'NRVR', 'ANAV'], asks: ['C2', 'D4', 'A3'] },
      { rows: ['AVRN', 'RAVR', 'NVAV', 'ANVN'], asks: ['C4', 'D2', 'A3'] },
    ],
  },
  {
    name: 'Nivel 2',
    inks: [...BASE_INKS, 'dorado'],
    boards: [
      { rows: ['RVNAD', 'VRAVN', 'NVDRV', 'DRAND', 'ADVRA'], asks: ['D3', 'A2', 'E4', 'C1'] },
      { rows: ['NDVAV', 'DNARA', 'VRNDN', 'RVAVD', 'NAVRN'], asks: ['C4', 'A5', 'B3', 'D1'] },
    ],
  },
  {
    name: 'Nivel 3',
    inks: [...BASE_INKS, 'dorado', 'violeta'],
    boards: [
      { rows: ['RVRALD', 'VDLVDV', 'RNRDLN', 'NANVAL', 'ARLNRN'], asks: ['D4', 'A5', 'E1', 'B2', 'C6'] },
      { rows: ['NLRLNL', 'LNAVAV', 'RDRLNA', 'LAVDAV', 'NRDNRD'], asks: ['B5', 'C3', 'A4', 'D6', 'E1'] },
    ],
  },
]

const TOTAL_QUESTIONS = LEVELS.reduce((sum, lvl) => sum + lvl.boards[0].asks.length, 0)

const ROW_LETTERS = 'ABCDEF'

/** "C4" → { row: 2, col: 3 } (zero-based). */
function parseCoord(coord: string): { row: number; col: number } {
  return { row: ROW_LETTERS.indexOf(coord[0]), col: Number(coord.slice(1)) - 1 }
}

/** The ink on a square of a board. */
function inkAt(board: BoardDef, coord: string): InkId {
  const { row, col } = parseCoord(coord)
  return CODE_TO_INK[board.rows[row][col]]
}
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

const PRAISE = ['¡Muy bien!', '¡Excelente orientación!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena vista!']

/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel",
 * "Repetir") is the second tap of a double tap, and it must not answer the first question (the
 * options sit right where that button was). Long enough to swallow a double tap, short enough
 * that nobody who means it notices. */
const SETTLE_MS = 400

// Literal class strings (Tailwind only emits classes it can read in the source).
const LABEL_BASE = 'flex items-center justify-center rounded-lg text-base font-bold transition-colors'
const LABEL_ON = 'bg-tiam-blue/10 text-tiam-blue-dark'
const LABEL_OFF = 'text-slate-500'

/** Width of the column of row letters (and height of the row of column numbers). */
const LABEL_WIDTH = 28
/** A square never gets smaller than this on a short phone (it is 34px already on a 320px one with six columns). */
const MIN_CELL = 36

type FitMode = 'roomy' | 'short' | 'shortNarrow'

/** The widest the board may be so that it and ALL the colour buttons are on screen together when a question opens
 * (a player who does not see that the colours go on below the fold simply cannot answer). The modal leaves
 * 100dvh - 95px of scroll area; `around` is everything on the screen that is not the board, in px, and the board
 * keeps its shape: width = label column + gaps + (height - label row - gaps) * cols / rows.
 *  - roomy (taller than 700px): the header is 124px (the question takes two lines), then 12px, then the buttons
 *    (52px rows, 10px between them). The hint may go below the fold here.
 *  - short (700px or less): the header is tightened (12px of padding, the chip row 27px, 6px, a question of 18px
 *    that fits one line on a phone 375px wide: 29px, 8px), the buttons are 48px rows 8px apart with 8px above them,
 *    and the hint (8px + 48px) and the 12px of padding below are counted too. The question is 295px wide, so on a
 *    narrower phone (a 360px one has 296px of room) it cannot be counted on to keep one line, and it takes two
 *    (54px) on a 320px one: shortNarrow.
 * Never narrower than MIN_CELL squares, never wider than the natural size, so a tall phone changes nothing. */
function boardMaxWidth(rows: number, cols: number, maxCell: number, gap: number, inkCount: number, mode: FitMode): string {
  const buttonRows = Math.ceil(inkCount / 2)
  const around =
    mode === 'roomy'
      ? 124 + 12 + (buttonRows * 52 + (buttonRows - 1) * 10)
      : 12 + 27 + 6 + (mode === 'short' ? 29 : 54) + 8 + 8 + (buttonRows * 48 + (buttonRows - 1) * 8) + 8 + 48 + 12
  const natural = LABEL_WIDTH + cols * (maxCell + gap)
  const floor = LABEL_WIDTH + cols * (Math.min(MIN_CELL, maxCell) + gap)
  const room = `(100dvh - ${95 + around + LABEL_WIDTH + rows * gap}px)`
  return `min(${natural}px, max(${floor}px, calc(${LABEL_WIDTH + cols * gap}px + ${room} * ${cols} / ${rows})))`
}

interface ColorBoardProps {
  board: BoardDef
  /** Row / column to light up (the scaffold). */
  activeRow?: number
  activeCol?: number
  /** A square to ring in green (the answer just found). */
  markCell?: { row: number; col: number } | null
  /** Largest size of one square, in px — keeps a small board from ballooning. */
  maxCell: number
  gap: number
  /** How many colour buttons sit under the board: when given, the board is capped to leave room for them (boardMaxWidth). */
  fitInks?: number
}

function ColorBoard({ board, activeRow, activeCol, markCell, maxCell, gap, fitInks }: ColorBoardProps) {
  const rows = board.rows.length
  const cols = board.rows[0].length
  const labelWidth = LABEL_WIDTH
  return (
    <div
      role="img"
      aria-label={`Grilla de colores: ${rows} filas, de la A a la ${ROW_LETTERS[rows - 1]}, y ${cols} columnas, del 1 al ${cols}`}
      className={[
        'mx-auto grid w-full',
        fitInks === undefined
          ? ''
          : 'max-w-(--bm) [@media(max-height:700px)]:max-[374px]:max-w-(--bm-narrow) [@media(max-height:700px)]:min-[375px]:max-w-(--bm-short)',
      ].join(' ')}
      style={
        {
          gridTemplateColumns: `${labelWidth}px repeat(${cols}, minmax(0, 1fr))`,
          gap,
          ...(fitInks === undefined
            ? { maxWidth: labelWidth + cols * (maxCell + gap) }
            : {
                '--bm': boardMaxWidth(rows, cols, maxCell, gap, fitInks, 'roomy'),
                '--bm-short': boardMaxWidth(rows, cols, maxCell, gap, fitInks, 'short'),
                '--bm-narrow': boardMaxWidth(rows, cols, maxCell, gap, fitInks, 'shortNarrow'),
              }),
        } as CSSProperties
      }
    >
      <div aria-hidden="true" />
      {Array.from({ length: cols }, (_, c) => (
        <div key={`c${c}`} aria-hidden="true" className={`${LABEL_BASE} h-7 ${activeCol === c ? LABEL_ON : LABEL_OFF}`}>
          {c + 1}
        </div>
      ))}
      {board.rows.map((rowCodes, r) => (
        <div key={`r${r}`} className="contents">
          <div aria-hidden="true" className={`${LABEL_BASE} ${activeRow === r ? LABEL_ON : LABEL_OFF}`}>
            {ROW_LETTERS[r]}
          </div>
          {rowCodes.split('').map((code, c) => {
            const marked = markCell?.row === r && markCell.col === c
            return (
              <div
                key={c}
                aria-hidden="true"
                className={[
                  'relative aspect-square rounded-lg',
                  marked ? 'ring-4 ring-tiam-green ring-offset-2' : '',
                ].join(' ')}
                style={{ backgroundColor: INKS[CODE_TO_INK[code]].hex }}
              >
                {marked && (
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** The colour of an answer button. It is a flex box, not an inline span: an inline one ignores its width and height and
 * showed up as a 4px sliver. The check of the right answer sits INSIDE it, so the button keeps its width (a separate
 * badge next to "Violeta" did not fit a 150px button once the swatch really took its 28px). */
function Swatch({ ink, checked }: { ink: InkId; checked?: boolean }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white ring-1 ring-slate-300 max-[350px]:h-6 max-[350px]:w-6"
      style={{ backgroundColor: INKS[ink].hex }}
      aria-hidden="true"
    >
      {checked && <Check className="h-4 w-4 text-white motion-safe:animate-[pop_0.3s_ease-out]" strokeWidth={3.5} />}
    </span>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a two-row example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'La letra es la fila, a la izquierda. El número es la columna, arriba.',
    'Mirá dónde se cruzan y tocá el color de esa casilla.',
  ]
  const example: BoardDef = { rows: ['RVN', 'NRA'], asks: ['B3'] }
  return (
    <div className="mt-4 rounded-3xl border border-amber-600/20 bg-amber-600/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-sm font-semibold text-slate-500">Ejemplo: la casilla B3</p>
        <div className="mx-auto mt-2 max-w-[168px]">
          <ColorBoard board={example} activeRow={1} activeCol={2} markCell={{ row: 1, col: 2 }} maxCell={40} gap={6} />
        </div>
        <p className="mt-2 text-base text-slate-700">
          La fila B y la columna 3 se cruzan en el <span className="font-bold text-slate-900">azul</span>.
        </p>
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
  const total = board.asks.length

  const [questionIdx, setQuestionIdx] = useState(0)
  const [wrongInks, setWrongInks] = useState<InkId[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Inks already tapped for this question: a double tap on the same option is
  // ONE tap, even when both land before React has repainted it as disabled.
  const tappedRef = useRef<Set<InkId>>(new Set())
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

  const coord = board.asks[questionIdx]
  const target = parseCoord(coord)
  const answer = inkAt(board, coord)
  // The scaffold turns on at the first wrong tap of a question and stays until the next one.
  const scaffold = wrongInks.length > 0 && !advancing

  function handleTap(ink: InkId, at: number) {
    // While the right answer shows its check (`advancing`) every option is off, which is what swallows
    // a double tap on the RIGHT one; this swallows the one that follows the button that brought the level.
    if (advancing || done || tappedRef.current.has(ink) || at - since < SETTLE_MS) return
    tappedRef.current.add(ink)
    if (ink === answer) {
      setAdvancing(true)
      setHint(`¡Eso es! ${coord} es de color ${INKS[ink].label.toLowerCase()}.`)
      advanceTimerRef.current = window.setTimeout(() => {
        if (questionIdx < total - 1) {
          setQuestionIdx((i) => i + 1)
          setWrongInks([])
          setAdvancing(false)
          setHint(null)
          tappedRef.current = new Set()
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, 1100)
    } else {
      setWrongInks((w) => [...w, ink])
      setHint(`Esa no es. Buscá la fila ${coord[0]} y la columna ${coord.slice(1)}: la casilla está donde se cruzan.`)
      onMistake()
    }
  }

  // The [@media(max-height:700px)] classes are the short-phone layout (see boardMaxWidth, which counts them).
  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
          {level.name}
        </span>
        {!done && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Pregunta {questionIdx + 1} de {total}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl [@media(max-height:700px)]:mt-1.5 [@media(max-height:700px)]:text-lg">
              ¿De qué color es la casilla{' '}
              <span className="inline-block rounded-lg border-2 border-tiam-blue bg-tiam-blue/5 px-2 text-tiam-blue">
                {coord}
              </span>
              ?
            </h2>
          </>
        )}
      </div>

      {!done && (
        <>
          <div className="mt-3 [@media(max-height:700px)]:mt-2">
            <ColorBoard
              board={board}
              activeRow={scaffold || advancing ? target.row : undefined}
              activeCol={scaffold || advancing ? target.col : undefined}
              markCell={advancing ? target : null}
              maxCell={level.inks.length >= 6 ? 50 : 56}
              gap={level.inks.length >= 6 ? 4 : 6}
              fitInks={level.inks.length}
            />
          </div>

          {/* The answers: a swatch AND the colour name, in a fixed order */}
          <div
            className="mx-auto mt-3 flex max-w-sm flex-wrap justify-center gap-2.5 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:gap-y-2"
            role="group"
            aria-label="Colores"
          >
            {level.inks.map((ink) => {
              const isWrong = wrongInks.includes(ink)
              const isCorrectShown = advancing && ink === answer
              return (
                <button
                  key={ink}
                  type="button"
                  disabled={isWrong || advancing}
                  onClick={(e) => handleTap(ink, e.timeStamp)}
                  className={[
                    'flex min-h-[52px] w-[calc(50%-0.3125rem)] items-center gap-3 rounded-2xl border-2 px-3 text-left text-lg font-bold transition max-[350px]:gap-2 max-[350px]:px-2.5 [@media(max-height:700px)]:min-h-[48px]',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span className={isWrong ? 'opacity-40' : ''}>
                    <Swatch ink={ink} checked={isCorrectShown} />
                  </span>
                  <span className="flex-1">{INKS[ink].label}</span>
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-3 min-h-[3rem] text-center text-base font-medium [@media(max-height:700px)]:mt-2 ${advancing ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste el color de las {total} casillas. ¡Completaste el {level.name.toLowerCase()}!
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

export function ColoresEnLaGrilla({ onComplete }: GameProps) {
  // Which board each level plays — decided once, at mount, so "Repetir" replays
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá cada casilla</h2>
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
