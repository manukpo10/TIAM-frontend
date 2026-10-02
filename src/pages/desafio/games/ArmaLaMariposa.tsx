import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Armá la mariposa" — día 25, mes 5, praxias (visuoespacial). A silhouette on a
 * square grid and a handful of coloured pieces made of squares (a bar, an L, a
 * square, a T…). Fill the whole silhouette with the pieces, none left over and
 * none sticking out. Spatial planning and the visual fit of a shape into a gap.
 *
 * SIMPLIFIED FOR AN OLDER PLAYER: the pieces NEVER rotate or flip, each one is
 * always drawn the way it must go. Tap a piece of the tray (it lights up), then
 * tap the square of the silhouette where its white dot should go: the dot marks
 * the piece's anchor, its top-left filled square (first square in reading order).
 * A placement is accepted only if EVERY square of the piece lands on an empty
 * square of the silhouette; tap a piece already on the silhouette to take it back
 * to the tray (it costs nothing). Squares outside the silhouette are not buttons,
 * so a stray finger there does nothing.
 *
 * Validated by GEOMETRY, never against a stored solution: the figure is done when
 * every piece is on it, and since the pieces add up to exactly the silhouette's
 * area, ANY tiling is accepted. A piece that does not fit is the only mistake: it
 * flashes the tapped square in muted gray (never red), costs ONE mistake and turns
 * on a scaffold — the squares where that piece CAN go get a ring. Taking a piece
 * back, or putting one where the puzzle can no longer be finished, costs nothing:
 * in that second case the hint says that the figure no longer closes and to take a
 * piece back (found by a small search over the pieces that are left). No timer.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by
 * the click's own timeStamp) is ignored, so the second tap of a double tap on "Empezar",
 * "Siguiente nivel" or "Repetir" never picks a piece or fills a square (the tray and the
 * board sit right where that button was). Inside a level the piece just placed ignores a
 * second tap for the same window (or it would come straight back out); the squares a
 * piece has just left ignore it too (the second tap of a double tap on a placed piece,
 * while another piece is chosen, would be judged there: a refusal that costs a mistake,
 * or a placement nobody asked for); and a second tap on a square that was just refused
 * is one refusal, not two mistakes. A new level opens at its top, and the solved card is
 * scrolled into view, and so is its button, on a short phone (the tray gives its room to
 * the card; the finished figure stays as the reward).
 *
 * Colours are the far-apart inks of El color de la palabra (rojo, azul, verde,
 * dorado, violeta; never a look-alike pair) and every tray piece carries its colour
 * NAME under it. Level 1 uses three of them, level 2 adds DORADO, level 3 adds
 * VIOLETA.
 *
 * Ramp: 3 pieces in a staircase / a flag → 4 pieces in a house / a mushroom → 5
 * pieces in a butterfly. ONE puzzle per level: each level has two authored ones and
 * one is picked ONCE at mount (`epoch`), so "Repetir" replays exactly the same
 * three. Per-level state lives in <LevelView>, keyed by run + level. A short
 * "¿Cómo se juega?" screen (two steps and a small example, its button pinned to the
 * bottom edge) opens the day; "Repetir" never brings it back. A throwaway
 * Node script (not committed) solved every puzzle with its own search, counted its
 * tilings, checked that the pieces add up to the silhouette, that every piece is
 * drawn with its anchor first and that no two pieces of a puzzle share a shape.
 *
 * totalAttempts = mistakes + every piece of the day (TOTAL_PIECES, derived).
 */

// ── data:start ──
/** [row, column] */
type Cell = [number, number]
type InkId = 'rojo' | 'azul' | 'verde' | 'dorado' | 'violeta'

// Five of the six inks of ElColorDeLaPalabra (hex values documented there).
const INKS: Record<InkId, { label: string; hex: string }> = {
  rojo: { label: 'Rojo', hex: '#D0021B' },
  azul: { label: 'Azul', hex: '#1678D4' },
  verde: { label: 'Verde', hex: '#05741C' },
  dorado: { label: 'Dorado', hex: '#B8860B' },
  violeta: { label: 'Violeta', hex: '#7E0197' },
}

interface PieceDef {
  ink: InkId
  /** The piece as it must be placed (no rotation): '#' is a square of the piece. */
  art: string[]
}
interface PuzzleDef {
  /** With its article: "la escalera". */
  figure: string
  /** The silhouette: '#' is a square to fill. */
  board: string[]
  pieces: PieceDef[]
}
interface LevelDef {
  name: string
  puzzles: PuzzleDef[]
}

// Every puzzle of a level has the same number of pieces, so TOTAL_PIECES never
// depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    puzzles: [
      {
        figure: 'la escalera',
        board: ['#...', '##..', '###.', '####'],
        pieces: [
          { ink: 'rojo', art: ['#.', '##'] },
          { ink: 'azul', art: ['###', '#..'] },
          { ink: 'verde', art: ['###'] },
        ],
      },
      {
        figure: 'la bandera',
        board: ['####', '####', '#...', '#...', '#...'],
        pieces: [
          { ink: 'rojo', art: ['##', '.#'] },
          { ink: 'azul', art: ['##', '##'] },
          { ink: 'verde', art: ['#', '#', '#', '#'] },
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    puzzles: [
      {
        figure: 'la casita',
        board: ['..#..', '.###.', '#####', '#####'],
        pieces: [
          { ink: 'rojo', art: ['#.', '##'] },
          { ink: 'azul', art: ['.#.', '###'] },
          { ink: 'verde', art: ['##', '##'] },
          { ink: 'dorado', art: ['###'] },
        ],
      },
      {
        figure: 'el hongo',
        board: ['.###.', '#####', '.###.', '.###.'],
        pieces: [
          { ink: 'rojo', art: ['.#', '##', '.#'] },
          { ink: 'azul', art: ['#.', '#.', '##'] },
          { ink: 'verde', art: ['#.', '##'] },
          { ink: 'dorado', art: ['###'] },
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    puzzles: [
      {
        figure: 'la mariposa',
        board: ['##.##', '#####', '.###.', '#####', '.#.#.'],
        pieces: [
          { ink: 'rojo', art: ['##.', '###'] },
          { ink: 'azul', art: ['##', '##'] },
          { ink: 'verde', art: ['###'] },
          { ink: 'dorado', art: ['##', '.#'] },
          { ink: 'violeta', art: ['###', '.#.'] },
        ],
      },
      {
        figure: 'la mariposa',
        board: ['##.##', '#####', '.###.', '#####', '.#.#.'],
        pieces: [
          { ink: 'rojo', art: ['##', '##', '#.'] },
          { ink: 'azul', art: ['##', '##'] },
          { ink: 'verde', art: ['#', '#', '#'] },
          { ink: 'dorado', art: ['##', '#.'] },
          { ink: 'violeta', art: ['.#', '##', '.#'] },
        ],
      },
    ],
  },
]

const TOTAL_PIECES = LEVELS.reduce((sum, lvl) => sum + lvl.puzzles[0].pieces.length, 0)

/** Filled squares of an ASCII picture, in reading order (row by row, left to right). */
function filledCells(art: string[]): Cell[] {
  const cells: Cell[] = []
  art.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] === '#') cells.push([r, c])
  })
  return cells
}

/** A piece as offsets from its ANCHOR: the first filled square in reading order (its top-left filled square). */
function offsetsOf(art: string[]): Cell[] {
  const cells = filledCells(art)
  const [ar, ac] = cells[0]
  return cells.map(([r, c]): Cell => [r - ar, c - ac])
}

/** The silhouette as a grid of booleans. */
function shapeOf(board: string[]): boolean[][] {
  return board.map((line) => line.split('').map((ch) => ch === '#'))
}

/** Does a piece anchored at (row, col) lie wholly on empty squares of the silhouette? */
function fitsAt(shape: boolean[][], owner: number[][], offsets: Cell[], row: number, col: number): boolean {
  return offsets.every(([dr, dc]) => {
    const r = row + dr
    const c = col + dc
    return r >= 0 && r < shape.length && c >= 0 && c < shape[0].length && shape[r][c] && owner[r][c] < 0
  })
}

/** Every square where this piece's anchor could be put right now. */
function anchorsFor(shape: boolean[][], owner: number[][], offsets: Cell[]): Cell[] {
  const found: Cell[] = []
  shape.forEach((line, r) => {
    line.forEach((inShape, c) => {
      if (inShape && fitsAt(shape, owner, offsets, r, c)) found.push([r, c])
    })
  })
  return found
}

/** The first empty square of the silhouette in reading order, or null when it is full. */
function firstEmpty(shape: boolean[][], owner: number[][]): Cell | null {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[0].length; c++) if (shape[r][c] && owner[r][c] < 0) return [r, c]
  }
  return null
}

/**
 * Can the pieces in `remaining` (indexes into `offsets`) still fill what is left of the silhouette?
 * The first empty square in reading order can only be the ANCHOR of the piece that covers it, so
 * each step tries every remaining piece there.
 */
function canComplete(shape: boolean[][], owner: number[][], offsets: Cell[][], remaining: number[]): boolean {
  const grid = owner.map((line) => [...line])
  const search = (left: number[]): boolean => {
    const next = firstEmpty(shape, grid)
    if (next === null) return left.length === 0
    for (const p of left) {
      if (!fitsAt(shape, grid, offsets[p], next[0], next[1])) continue
      for (const [dr, dc] of offsets[p]) grid[next[0] + dr][next[1] + dc] = p
      const ok = search(left.filter((q) => q !== p))
      for (const [dr, dc] of offsets[p]) grid[next[0] + dr][next[1] + dc] = -1
      if (ok) return true
    }
    return false
  }
  return search(remaining)
}
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface LevelContent {
  puzzle: PuzzleDef
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({ puzzle: pickOne(lvl.puzzles) }))
}

/** "de la escalera", "del hongo": the figure with its preposition ("de el" is never written). */
const ofFigure = (figure: string) => (figure.startsWith('el ') ? `del ${figure.slice(3)}` : `de ${figure}`)

const PRAISE = ['¡Muy bien!', '¡Excelente ojo para las formas!', '¡Así se arma!', '¡Perfecto!', '¡Qué buen pulso!']
/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel", "Repetir") is the
 * second tap of a double tap and it must not act on what sits where that button was; the same window keeps a
 * second tap on the same piece / square from being a new move. Long enough to swallow a double tap, short
 * enough that nobody who means it notices. */
const SETTLE_MS = 400

/** The grid of who owns each square (-1 = empty), from where each piece is anchored. */
function ownerGrid(shape: boolean[][], offsets: Cell[][], anchors: (Cell | null)[]): number[][] {
  const owner = shape.map((line) => line.map(() => -1))
  anchors.forEach((anchor, i) => {
    if (anchor === null) return
    for (const [dr, dc] of offsets[i]) owner[anchor[0] + dr][anchor[1] + dc] = i
  })
  return owner
}

interface PieceArtProps {
  art: string[]
  hex: string
  cellPx: number
  muted?: boolean
}

/** A piece drawn small, with the white dot on its anchor square. */
function PieceArt({ art, hex, cellPx, muted = false }: PieceArtProps) {
  const cols = Math.max(...art.map((line) => line.length))
  const anchor = filledCells(art)[0]
  return (
    <div aria-hidden="true" className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`, gap: 2 }}>
      {art.flatMap((line, r) =>
        Array.from({ length: cols }, (_, c) => {
          if (line[c] !== '#') return <span key={`${r}-${c}`} style={{ width: cellPx, height: cellPx }} />
          const isAnchor = anchor[0] === r && anchor[1] === c
          return (
            <span
              key={`${r}-${c}`}
              className="flex items-center justify-center rounded-[3px]"
              style={{ width: cellPx, height: cellPx, backgroundColor: muted ? '#cbd5e1' : hex }}
            >
              {isAnchor && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
          )
        }),
      )}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a small example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'Tocá una pieza de abajo y después el cuadradito del dibujo donde querés poner su puntito blanco.',
    'Las piezas no se giran. Para sacar una, tocala en el dibujo.',
  ]
  const exampleArt = ['#.', '##']
  return (
    <div className="mt-4 rounded-3xl border border-violet-600/20 bg-violet-600/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <div className="flex items-center justify-center gap-4" aria-hidden="true">
          <PieceArt art={exampleArt} hex={INKS.rojo.hex} cellPx={20} />
          <ArrowRight className="h-5 w-5 text-slate-400" />
          <div className="grid grid-cols-3 gap-0.5">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const filled = i === 0 || i === 3 || i === 4
              return (
                <span
                  key={i}
                  className="flex h-5 w-5 items-center justify-center rounded-[3px] border border-dashed border-slate-300"
                  style={filled ? { backgroundColor: INKS.rojo.hex, borderStyle: 'solid', borderColor: INKS.rojo.hex } : undefined}
                >
                  {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              )
            })}
          </div>
        </div>
        <p className="mt-2 text-base text-slate-700">La pieza entra con su puntito en el cuadradito que tocaste.</p>
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
  const { puzzle } = content
  const shape = shapeOf(puzzle.board)
  const offsets = puzzle.pieces.map((p) => offsetsOf(p.art))
  const rows = shape.length
  const cols = shape[0].length

  // Where each piece is anchored (null = still in the tray).
  const [anchors, setAnchors] = useState<(Cell | null)[]>(() => puzzle.pieces.map(() => null))
  const [selected, setSelected] = useState<number | null>(null)
  // On after the first refusal of a piece: ring the squares where it CAN go.
  const [scaffold, setScaffold] = useState(false)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  const lastPlacedRef = useRef<{ piece: number; at: number }>({ piece: -1, at: -999999 })
  const lastRefusedRef = useRef<{ key: string; at: number }>({ key: '', at: -999999 })
  // The squares ("row,col") a piece left when it was taken back, and when: a second tap on any of them right after is the
  // second tap of a double tap on that piece, not a move.
  const lastTakenRef = useRef<{ keys: string[]; at: number }>({ keys: [], at: -999999 })
  const lastPickRef = useRef<{ piece: number; at: number }>({ piece: -1, at: -999999 })
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

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

  const owner = ownerGrid(shape, offsets, anchors)
  const placedCount = anchors.filter((a) => a !== null).length
  const total = puzzle.pieces.length
  const legalAnchors =
    scaffold && selected !== null ? new Set(anchorsFor(shape, owner, offsets[selected]).map(([r, c]) => `${r},${c}`)) : null

  function takeBack(piece: number) {
    setAnchors((prev) => prev.map((a, i) => (i === piece ? null : a)))
    setScaffold(false)
    setHint(null)
  }

  function handlePiece(piece: number, at: number) {
    // The second tap of a double tap on the button that brought the level picks nothing.
    if (done || anchors[piece] !== null || at - since < SETTLE_MS) return
    const last = lastPickRef.current
    lastPickRef.current = { piece, at }
    // A second tap on the piece just picked is a double tap: keep it picked.
    if (last.piece === piece && at - last.at < SETTLE_MS) return
    setScaffold(false)
    if (selected === piece) {
      setSelected(null)
      setHint(null)
      return
    }
    setSelected(piece)
    setHint(`Elegiste la pieza de color ${INKS[puzzle.pieces[piece].ink].label.toLowerCase()}. Tocá el cuadradito del dibujo donde va su puntito blanco.`)
  }

  function handleCell(row: number, col: number, at: number) {
    // The second tap of a double tap on the button that brought the level fills nothing.
    if (done || at - since < SETTLE_MS) return
    const key = `${row},${col}`
    // The second tap of a double tap on a piece that was just taken back lands on a square the piece has just left (or on
    // one of its other squares, if the finger slipped). With another piece chosen it would be judged as a new move there:
    // a refusal that costs a mistake, or a placement nobody asked for.
    const taken = lastTakenRef.current
    if (at - taken.at < SETTLE_MS && taken.keys.includes(key)) return
    const owned = owner[row][col]
    if (owned >= 0) {
      // A tap on the piece that was just placed is a double tap: it must not come straight back out.
      const last = lastPlacedRef.current
      if (last.piece === owned && at - last.at < SETTLE_MS) return
      const home = anchors[owned]
      if (home) lastTakenRef.current = { keys: offsets[owned].map(([dr, dc]) => `${home[0] + dr},${home[1] + dc}`), at }
      takeBack(owned)
      return
    }
    if (selected === null) {
      setHint('Primero elegí una pieza de abajo.')
      return
    }
    // A second tap on the square just refused is one refusal, not two mistakes.
    if (lastRefusedRef.current.key === key && at - lastRefusedRef.current.at < SETTLE_MS) return
    if (!fitsAt(shape, owner, offsets[selected], row, col)) {
      lastRefusedRef.current = { key, at }
      setScaffold(true)
      setFlashKey(key)
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setFlashKey(null), 600)
      // The rings mark where this piece CAN go; when it can go nowhere right now there is nothing marked to look at.
      setHint(
        anchorsFor(shape, owner, offsets[selected]).length > 0
          ? 'Ahí no entra: la pieza se sale del dibujo o choca con otra. Mirá los lugares marcados.'
          : 'Ahí no entra, y por ahora esa pieza no entra en ningún lado. Tocá una pieza del dibujo para sacarla y probá de nuevo.',
      )
      onMistake()
      return
    }
    const nextAnchors = anchors.map((a, i): Cell | null => (i === selected ? [row, col] : a))
    lastPlacedRef.current = { piece: selected, at }
    setAnchors(nextAnchors)
    setSelected(null)
    setScaffold(false)
    const left = nextAnchors.flatMap((a, i) => (a === null ? [i] : []))
    if (left.length === 0) {
      setHint(null)
      setPraise(pickOne(PRAISE))
      setDone(true)
      onSolved()
      return
    }
    const nextOwner = ownerGrid(shape, offsets, nextAnchors)
    setHint(
      canComplete(shape, nextOwner, offsets, left)
        ? null
        : 'Con esa pieza ahí, la figura ya no se puede completar. Tocá una pieza del dibujo para sacarla y probá en otro lugar.',
    )
  }

  // Largest size of one square, in px: five rows of them must leave room for the tray on a short phone.
  const maxCell = 48
  const gap = 4

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Pusiste {placedCount} de {total}
          </span>
        )}
      </div>

      {/* The silhouette: only the squares to fill are buttons */}
      <div
        role="group"
        aria-label={`Dibujo ${ofFigure(puzzle.figure)}: ${rows} filas y ${cols} columnas`}
        className="mx-auto mt-3 grid w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap,
          maxWidth: cols * maxCell + (cols - 1) * gap,
        }}
      >
        {shape.flatMap((line, r) =>
          line.map((inShape, c) => {
            if (!inShape) return <div key={`${r}-${c}`} aria-hidden="true" />
            const key = `${r},${c}`
            const o = owner[r][c]
            const ink = o >= 0 ? puzzle.pieces[o].ink : null
            const isAnchor = o >= 0 && anchors[o]?.[0] === r && anchors[o]?.[1] === c
            const isLegal = legalAnchors !== null && legalAnchors.has(key)
            const isFlash = flashKey === key
            const state = ink ? `pieza de color ${INKS[ink].label.toLowerCase()}` : 'vacío'
            return (
              <button
                key={key}
                type="button"
                disabled={done}
                onClick={(e) => handleCell(r, c, e.timeStamp)}
                aria-label={`Fila ${r + 1}, columna ${c + 1}: ${state}`}
                className={[
                  'relative flex aspect-square items-center justify-center rounded-lg border-2 transition',
                  'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  ink
                    ? 'border-transparent'
                    : isFlash
                      ? 'border-slate-400 bg-slate-200 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                      : isLegal
                        ? 'border-dashed bg-white'
                        : 'border-dashed border-slate-300 bg-slate-100',
                ].join(' ')}
                style={
                  ink
                    ? { backgroundColor: INKS[ink].hex }
                    : isLegal && selected !== null
                      ? { borderColor: INKS[puzzle.pieces[selected].ink].hex }
                      : undefined
                }
              >
                {isAnchor && <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />}
                {isLegal && selected !== null && (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: INKS[puzzle.pieces[selected].ink].hex }}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          }),
        )}
      </div>

      {!done && (
        <>
          {/* The tray: every piece keeps its place, a piece already on the drawing leaves a ghost */}
          <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Piezas">
            {puzzle.pieces.map((piece, i) => {
              const placed = anchors[i] !== null
              const isSelected = selected === i
              const label = INKS[piece.ink].label
              const longest = Math.max(piece.art.length, ...piece.art.map((line) => line.length))
              return (
                <button
                  key={i}
                  type="button"
                  disabled={placed}
                  onClick={(e) => handlePiece(i, e.timeStamp)}
                  aria-pressed={isSelected}
                  aria-label={placed ? `Pieza de color ${label.toLowerCase()}, ya puesta` : `Pieza de color ${label.toLowerCase()}`}
                  className={[
                    'flex min-h-[80px] min-w-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-1.5 transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    placed
                      ? 'border-dashed border-slate-200 bg-slate-50 opacity-60'
                      : isSelected
                        ? '-translate-y-0.5 border-violet-600 bg-violet-50 ring-2 ring-violet-600/30'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-600/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span className="flex min-h-[46px] items-center justify-center">
                    <PieceArt art={piece.art} hex={INKS[piece.ink].hex} cellPx={longest >= 4 ? 13 : 14} muted={placed} />
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wide text-slate-700">{label}</span>
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-2 min-h-[2.75rem] text-center text-base font-medium text-slate-500">
            {hint ?? `Armá ${puzzle.figure}: tocá una pieza de abajo para elegirla.`}
          </p>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Armaste {puzzle.figure} con las {total} piezas. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
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

export function ArmaLaMariposa({ onComplete }: GameProps) {
  // Which puzzle each level plays — decided once, at mount, so "Repetir" replays
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PIECES })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Llená el dibujo con las piezas</h2>
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
