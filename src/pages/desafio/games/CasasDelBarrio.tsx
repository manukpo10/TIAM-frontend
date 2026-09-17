import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Las casas del barrio" — día 29, orientación. A grid of houses; some carry
 * a fixed label (anchors), the rest are blank. A bank of place names sits
 * below; tap a name, then tap the house it belongs on — tapping a placed
 * name sends it back to the bank. The clues (always visible) are the only
 * way to deduce which blank gets which name. Checked automatically once
 * every blank has a name: all correct solves the level; otherwise it's one
 * mistake, a gentle hint, and only the WRONG placements return to the bank
 * (correct ones stay put, so the player doesn't lose progress they already
 * earned).
 *
 * WHY THIS IS DIFFERENT FROM Coordenadas AND DondeEsta, even though all
 * three live under "orientación": Coordenadas is coordinate-LOOKUP (read a
 * label, find the cell at its row/column intersection) — one target at a
 * time, no inference involved. DondeEsta is relation-RECOGNITION (does this
 * one picture match dentro/encima/debajo/izquierda/derecha?) — a closed
 * multiple-choice check against a single shown scene. Neither requires
 * combining more than one fact. Casas del barrio is a small CONSTRAINT-
 * SATISFACTION puzzle — several clues have to be held in mind and combined
 * (often chained: clue 2 only resolves once clue 1's target is placed) to
 * deduce a full assignment of names to fixed grid positions, closer to a
 * mini logic-grid puzzle than a lookup or a recognition check.
 *
 * UNAMBIGUOUS SPATIAL LANGUAGE (the hard part the brief calls out): on a
 * flat top-down grid, "atrás de" and "enfrente de" have no defined meaning
 * — there's no camera position implying a "front" or "back" — so they are
 * never used, anywhere, on purpose. "A la izquierda de" is ALSO ambiguous
 * on its own (does it mean "somewhere to the left" or "immediately to the
 * left"?), so every relation here is spelled out as "justo a la
 * izquierda/derecha/arriba/abajo de" — "justo" is the word doing the
 * disambiguating work, and it always means the single adjacent cell in that
 * direction, never "anywhere further along." "Entre X y Y" is defined just
 * as concretely: same row as X and Y, immediately adjacent to both — i.e.
 * sitting in the one cell directly between them, not "somewhere along the
 * row." A one-line reminder of this appears right above the clue list, in
 * plain words, since the whole puzzle is unfair if the reader silently
 * assumes a looser meaning.
 *
 * UNIQUENESS INVARIANT: every clue's prose (see `clueText`) is GENERATED
 * from the same structured `{ type, subject, ref }` data the puzzle's
 * `solution` is authored against — never hand-typed separately — so the
 * sentence shown to the player can never drift out of sync with the
 * relation actually being tested. On top of that, each of the 6 authored
 * puzzles below (2 per level) was verified with a throwaway Node script
 * that brute-forced every possible assignment of bank names to blank houses
 * and confirmed exactly one satisfies every clue, and that the one solution
 * is the authored one. The script and its output are not part of this
 * commit (per the task instructions) — see the PR/session notes for the
 * per-puzzle result.
 *
 * Difficulty ramps by grid size AND unknown count together, per spec:
 * Nivel 1 is a 2×3 grid with 2 blanks, Nivel 2 a 3×3 grid with 3 blanks,
 * Nivel 3 a 3×4 grid with 5 blanks (including at least one "entre" clue).
 * One puzzle solved = one level done (no rounds within a level, same shape
 * as SumaHastaDiez.tsx) — `totalAttempts` is therefore mistakes plus a
 * FIXED total of blank houses across all three levels (2+3+5=10), not an
 * accumulating per-attempt count.
 */

// ── Structured clue data — the single source of truth for both the prose
// shown to the player (via clueText) and the brute-force uniqueness check
// (see file header). Only relations that are unambiguous on a flat grid are
// representable at all: no "atrás"/"enfrente" variant exists in this type.
type Clue =
  | { type: 'left'; subject: string; ref: string }
  | { type: 'right'; subject: string; ref: string }
  | { type: 'above'; subject: string; ref: string }
  | { type: 'below'; subject: string; ref: string }
  | { type: 'between'; subject: string; refA: string; refB: string }

interface HouseSpec {
  id: string // `${row}-${col}` — also the key into anchors/placements/solution
  row: number
  col: number
  colorIdx: number
  roofIdx: number
}

interface Puzzle {
  rows: number
  cols: number
  houses: HouseSpec[]
  /** houseId -> fixed label. Anchors are shown but never tappable. */
  anchors: Record<string, string>
  /** houseIds that need a name from the bank, in no particular order. */
  blankIds: string[]
  /** The names the bank holds this round — same set as solution's values. */
  names: string[]
  /** houseId -> correct name, for the blank houses only. */
  solution: Record<string, string>
  clues: Clue[]
}

interface Level {
  n: number
  name: string
  pool: Puzzle[]
}

// ── House visuals — plain SVG, no image files. Colour and roof SHAPE vary
// independently (palette index vs. a 3-way roof polygon) so neighbouring
// houses read as visually distinct even when a formula happens to repeat a
// colour. House colours are content (this game's "props"), not brand
// chrome, so they intentionally sit outside the tiam-* token set.
interface HousePaletteEntry {
  body: string
  roof: string
  door: string
}
const HOUSE_PALETTE: HousePaletteEntry[] = [
  { body: '#F6B57A', roof: '#8C4A2F', door: '#5C3A21' },
  { body: '#8FCBDC', roof: '#2E5C6E', door: '#1F3F4C' },
  { body: '#C9B37E', roof: '#6B4A2A', door: '#4A3218' },
  { body: '#A8C98A', roof: '#3F6B3F', door: '#2A4A2A' },
  { body: '#E3A6B0', roof: '#8C3F4A', door: '#5C2933' },
  { body: '#B8AEDC', roof: '#5A4A8C', door: '#3D3260' },
  { body: '#F2D06B', roof: '#8C6A2A', door: '#5C441C' },
  { body: '#9AB8C9', roof: '#3F5C6E', door: '#2A3F4A' },
]

function RoofPolygon({ shape, color }: { shape: number; color: string }) {
  const points =
    shape === 0 ? '10,42 50,6 90,42' : shape === 1 ? '8,42 28,14 72,14 92,42' : '8,42 20,10 92,24 92,42'
  return <polygon points={points} fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth={1.5} />
}

function HouseGraphic({ colorIdx, roofIdx }: { colorIdx: number; roofIdx: number }) {
  const palette = HOUSE_PALETTE[colorIdx % HOUSE_PALETTE.length]
  const roofShape = roofIdx % 3
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <rect x={12} y={40} width={76} height={50} rx={3} fill={palette.body} stroke="rgba(0,0,0,0.15)" strokeWidth={1.5} />
      <RoofPolygon shape={roofShape} color={palette.roof} />
      <rect x={20} y={50} width={14} height={14} rx={2} fill="white" fillOpacity={0.75} stroke="rgba(0,0,0,0.15)" />
      <rect x={66} y={50} width={14} height={14} rx={2} fill="white" fillOpacity={0.75} stroke="rgba(0,0,0,0.15)" />
      <rect x={42} y={66} width={16} height={24} rx={1.5} fill={palette.door} />
    </svg>
  )
}

// Deterministic, purely cosmetic mix so neighbouring cells tend to differ —
// not randomised, since house appearance is fixed content per puzzle.
function buildHouses(rows: number, cols: number): HouseSpec[] {
  const houses: HouseSpec[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      houses.push({
        id: `${r}-${c}`,
        row: r,
        col: c,
        colorIdx: (r + c * 2) % HOUSE_PALETTE.length,
        roofIdx: (r * 2 + c) % 3,
      })
    }
  }
  return houses
}

// ── Clue prose, generated from the structured relation — never hand-typed
// separately (see file header: this is what keeps the sentence honest).
// Every place name in this file starts with "el " or "la ", so the de/del
// contraction rule below is exhaustive without a general grammar engine.
function withDe(name: string): string {
  return name.startsWith('el ') ? `del ${name.slice(3)}` : `de ${name}`
}
function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}
function clueText(clue: Clue): string {
  switch (clue.type) {
    case 'left':
      return `${capitalize(clue.subject)} está justo a la izquierda ${withDe(clue.ref)}.`
    case 'right':
      return `${capitalize(clue.subject)} está justo a la derecha ${withDe(clue.ref)}.`
    case 'above':
      return `${capitalize(clue.subject)} está justo arriba ${withDe(clue.ref)}.`
    case 'below':
      return `${capitalize(clue.subject)} está justo abajo ${withDe(clue.ref)}.`
    case 'between':
      return `${capitalize(clue.subject)} está entre ${clue.refA} y ${clue.refB}.`
  }
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

// ── Puzzles — hand-authored, 2 per level so playing the day again can serve
// a different layout. Every puzzle in a level's pool has the SAME blank count
// as every other (2 / 3 / 5) — that's what makes TOTAL_BLANKS below a valid
// fixed constant regardless of which puzzle a round draws.

const PUZZLE_L1_A: Puzzle = {
  rows: 2,
  cols: 3,
  houses: buildHouses(2, 3),
  anchors: {
    '0-0': 'el consultorio',
    '0-2': 'la escuela',
    '1-0': 'la casa de Hugo',
    '1-2': 'la plaza',
  },
  blankIds: ['0-1', '1-1'],
  names: ['la panadería', 'el kiosco'],
  solution: { '0-1': 'la panadería', '1-1': 'el kiosco' },
  clues: [
    { type: 'right', subject: 'la panadería', ref: 'el consultorio' },
    { type: 'below', subject: 'el kiosco', ref: 'la panadería' },
  ],
}

const PUZZLE_L1_B: Puzzle = {
  rows: 2,
  cols: 3,
  houses: buildHouses(2, 3),
  anchors: {
    '0-0': 'la farmacia',
    '0-1': 'la escuela',
    '1-1': 'el club',
    '1-2': 'la casa de Hugo',
  },
  blankIds: ['0-2', '1-0'],
  names: ['la verdulería', 'la casa de la abuela'],
  solution: { '0-2': 'la verdulería', '1-0': 'la casa de la abuela' },
  clues: [
    { type: 'right', subject: 'la verdulería', ref: 'la escuela' },
    { type: 'below', subject: 'la casa de la abuela', ref: 'la farmacia' },
  ],
}

const PUZZLE_L2_A: Puzzle = {
  rows: 3,
  cols: 3,
  houses: buildHouses(3, 3),
  anchors: {
    '0-0': 'el consultorio',
    '0-1': 'la escuela',
    '0-2': 'la plaza',
    '1-0': 'la casa de Hugo',
    '2-1': 'el club',
    '2-2': 'la farmacia',
  },
  blankIds: ['1-1', '1-2', '2-0'],
  names: ['la panadería', 'el kiosco', 'la verdulería'],
  solution: { '1-1': 'la panadería', '1-2': 'el kiosco', '2-0': 'la verdulería' },
  clues: [
    { type: 'below', subject: 'la panadería', ref: 'la escuela' },
    { type: 'right', subject: 'el kiosco', ref: 'la panadería' },
    { type: 'below', subject: 'la verdulería', ref: 'la casa de Hugo' },
  ],
}

const PUZZLE_L2_B: Puzzle = {
  rows: 3,
  cols: 3,
  houses: buildHouses(3, 3),
  anchors: {
    '0-0': 'la farmacia',
    '0-2': 'la escuela',
    '1-0': 'el consultorio',
    '1-2': 'la plaza',
    '2-0': 'el club',
    '2-1': 'la casa de Hugo',
  },
  blankIds: ['0-1', '1-1', '2-2'],
  names: ['el kiosco', 'la verdulería', 'la casa de la sobrina'],
  solution: { '0-1': 'el kiosco', '1-1': 'la verdulería', '2-2': 'la casa de la sobrina' },
  clues: [
    { type: 'right', subject: 'el kiosco', ref: 'la farmacia' },
    { type: 'below', subject: 'la verdulería', ref: 'el kiosco' },
    { type: 'below', subject: 'la casa de la sobrina', ref: 'la plaza' },
  ],
}

const PUZZLE_L3_A: Puzzle = {
  rows: 3,
  cols: 4,
  houses: buildHouses(3, 4),
  anchors: {
    '0-0': 'la escuela',
    '0-2': 'el restaurante',
    '0-3': 'la plaza',
    '1-0': 'el consultorio',
    '1-2': 'la casa de Hugo',
    '2-0': 'el club',
    '2-2': 'la farmacia',
  },
  blankIds: ['0-1', '1-1', '1-3', '2-1', '2-3'],
  names: ['la casa de la sobrina', 'la panadería', 'el kiosco', 'la verdulería', 'la casa de la abuela'],
  solution: {
    '0-1': 'la casa de la sobrina',
    '1-1': 'la panadería',
    '1-3': 'el kiosco',
    '2-1': 'la verdulería',
    '2-3': 'la casa de la abuela',
  },
  clues: [
    { type: 'between', subject: 'la casa de la sobrina', refA: 'el restaurante', refB: 'la escuela' },
    { type: 'below', subject: 'la panadería', ref: 'la casa de la sobrina' },
    { type: 'right', subject: 'el kiosco', ref: 'la casa de Hugo' },
    { type: 'right', subject: 'la verdulería', ref: 'el club' },
    { type: 'right', subject: 'la casa de la abuela', ref: 'la farmacia' },
  ],
}

const PUZZLE_L3_B: Puzzle = {
  rows: 3,
  cols: 4,
  houses: buildHouses(3, 4),
  anchors: {
    '0-0': 'el consultorio',
    '0-2': 'la escuela',
    '1-0': 'la casa de Hugo',
    '1-3': 'el restaurante',
    '2-0': 'la plaza',
    '2-2': 'el club',
    '2-3': 'la farmacia',
  },
  blankIds: ['0-1', '0-3', '1-1', '1-2', '2-1'],
  names: ['el kiosco', 'la casa de la abuela', 'la panadería', 'la verdulería', 'la casa de la sobrina'],
  solution: {
    '0-1': 'el kiosco',
    '0-3': 'la casa de la abuela',
    '1-1': 'la panadería',
    '1-2': 'la verdulería',
    '2-1': 'la casa de la sobrina',
  },
  clues: [
    { type: 'between', subject: 'la casa de la sobrina', refA: 'la plaza', refB: 'el club' },
    { type: 'left', subject: 'el kiosco', ref: 'la escuela' },
    { type: 'below', subject: 'la panadería', ref: 'el kiosco' },
    { type: 'left', subject: 'la verdulería', ref: 'el restaurante' },
    { type: 'above', subject: 'la casa de la abuela', ref: 'el restaurante' },
  ],
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', pool: [PUZZLE_L1_A, PUZZLE_L1_B] },
  { n: 2, name: 'Nivel 2', pool: [PUZZLE_L2_A, PUZZLE_L2_B] },
  { n: 3, name: 'Nivel 3', pool: [PUZZLE_L3_A, PUZZLE_L3_B] },
]

// Fixed total of blank houses across all three levels (2+3+5=10) — derived
// from the data (each level's first pool entry) rather than a bare literal,
// so it can't silently drift if a puzzle's blank count ever changes.
const TOTAL_BLANKS = LEVELS.reduce((sum, lvl) => sum + lvl.pool[0].blankIds.length, 0)

// Full class strings, never interpolated — Tailwind only emits classes it
// can read literally in the source (same discipline as SumaHastaDiez).
const GRID_COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-3 gap-2 sm:gap-3',
  2: 'grid-cols-3 gap-2 sm:gap-3',
  3: 'grid-cols-4 gap-1.5 sm:gap-2.5',
}

const PRAISE = ['¡Muy bien!', '¡Excelente memoria de barrio!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Alguno de esos nombres no va ahí — volvió a la lista. Repasá las pistas y probá de nuevo.',
  'Casi. Uno de los nombres no corresponde a esa casa — fijate bien en las pistas.',
  'Esa combinación no cierra. Uno volvió a la lista — pensalo de nuevo con calma.',
]

export function CasasDelBarrio({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which puzzle each level is playing THIS "epoch" (one full 1→2→3 pass) —
  // decided once at mount, same pattern as Coordenadas' epochOrder. Only
  // nextLevel()'s wrap branch (every level, fresh epoch) ever changes it —
  // advancing forward mid-epoch leaves it alone, so a level not yet visited
  // keeps its original mount-time pick.
  const [puzzleIdx, setPuzzleIdx] = useState<number[]>(() =>
    LEVELS.map((lvl) => Math.floor(Math.random() * lvl.pool.length)),
  )
  const level = LEVELS[levelIdx]
  const puzzle = level.pool[puzzleIdx[levelIdx]]

  const shuffledNames = useMemo(() => shuffle(puzzle.names), [puzzle])

  // houseId -> name currently placed there. Only ever holds blank-house
  // entries — anchors are never keys here.
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates 1→2→3 across levels; zeroed ONLY on the genuine day restart
  // (wrap from level 3 back to level 1).
  const [mistakes, setMistakes] = useState(0)

  const bankNames = shuffledNames.filter((name) => !Object.values(placements).includes(name))

  function validate(finalPlacements: Record<string, string>) {
    const allCorrect = puzzle.blankIds.every((id) => finalPlacements[id] === puzzle.solution[id])
    if (allCorrect) {
      setSolved(true)
      setPraise(pickOne(PRAISE))
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    // Only the WRONG placements return to the bank — correct ones stay put.
    const cleared = { ...finalPlacements }
    for (const id of puzzle.blankIds) {
      if (cleared[id] !== puzzle.solution[id]) delete cleared[id]
    }
    setPlacements(cleared)
  }

  function placeName(houseId: string) {
    if (!selectedName || solved) return
    setHint(null)
    const next = { ...placements, [houseId]: selectedName }
    setPlacements(next)
    setSelectedName(null)
    if (puzzle.blankIds.every((id) => next[id])) validate(next)
  }

  function unplaceHouse(houseId: string) {
    if (solved) return
    setHint(null)
    setPlacements((prev) => {
      if (!(houseId in prev)) return prev
      const next = { ...prev }
      delete next[houseId]
      return next
    })
  }

  // Resets happen HERE, synchronously with the level/puzzle change, never in
  // a useEffect keyed on levelIdx — an effect lags one render behind, so the
  // onComplete-reporting effect below would read the PREVIOUS puzzle's
  // stale `solved === true` on the render that just arrived at the new
  // level, and fire onComplete with garbage. Same reasoning as
  // SumaHastaDiez/Coordenadas.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setPlacements({})
    setSelectedName(null)
    setHint(null)
    setSolved(false)
    if (isWrap) {
      // Genuine day restart — fresh epoch, every level rerolls its puzzle,
      // and the mistake counter zeroes.
      setPuzzleIdx(LEVELS.map((lvl) => Math.floor(Math.random() * lvl.pool.length)))
      setMistakes(0)
    }
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey when the LAST level is solved. A genuine day
  // restart gets a new roundKey (via nextLevel's wrap branch), so a full
  // replay of the day can report again; re-rendering while already solved
  // on level 3 cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (solved && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_BLANKS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, levelIdx, roundKey, mistakes])

  const filledCount = Object.keys(placements).length

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Las casas del barrio</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá un nombre de la lista y después la casa que le corresponde, según las pistas.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Colocaste {filledCount} de {puzzle.blankIds.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                  style={{ width: `${(filledCount / puzzle.blankIds.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Grid — stays visible once solved too, as a read-only recap. */}
      <div className={`mx-auto mt-5 grid w-full max-w-[380px] ${GRID_COLS_CLASS[level.n]}`}>
        {puzzle.houses.map((house) => {
          const anchorLabel = puzzle.anchors[house.id]
          const isAnchor = Boolean(anchorLabel)
          const placedName = placements[house.id]
          const isFilled = Boolean(placedName)
          const label = isAnchor ? anchorLabel : (placedName ?? '?')
          const interactive = !isAnchor && !solved && (isFilled || selectedName !== null)
          return (
            <button
              key={house.id}
              type="button"
              disabled={!interactive}
              onClick={() => (isFilled ? unplaceHouse(house.id) : placeName(house.id))}
              aria-label={
                isAnchor
                  ? anchorLabel
                  : isFilled
                    ? `${placedName} — tocá para sacarlo de la casa`
                    : selectedName
                      ? `Poner ${selectedName} acá`
                      : 'Casa vacía'
              }
              className={[
                'flex flex-col items-center justify-start gap-1 rounded-xl border-2 p-1 transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                isAnchor ? 'border-slate-200 bg-slate-50' : '',
                !isAnchor && isFilled && solved ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                !isAnchor && isFilled && !solved ? 'border-tiam-blue/50 bg-tiam-blue/5' : '',
                !isAnchor && !isFilled ? 'border-dashed border-slate-300 bg-white' : '',
                interactive ? 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
              ].join(' ')}
            >
              <span className="relative aspect-square w-full">
                <HouseGraphic colorIdx={house.colorIdx} roofIdx={house.roofIdx} />
                {!isAnchor && isFilled && solved && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="text-center text-[9px] font-bold leading-tight text-slate-700 sm:text-[10px]">
                {label}
              </span>
            </button>
          )
        })}
      </div>

      {!solved && (
        <>
          {/* Bank */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {bankNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedName((cur) => (cur === name ? null : name))}
                className={[
                  'min-h-[44px] rounded-xl border-2 px-3 py-2 text-sm font-semibold transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  selectedName === name
                    ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                    : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                ].join(' ')}
              >
                {name}
              </button>
            ))}
          </div>

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

          {/* Clues — always visible, per spec. */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Pistas</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-base text-slate-700">
              {puzzle.clues.map((clue, i) => (
                <li key={i}>{clueText(clue)}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">
              "Justo" quiere decir pegado, en la casa de al lado — no en cualquier otro lugar de esa dirección.
            </p>
          </div>
        </>
      )}

      {/* Completion */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Ubicaste las {puzzle.blankIds.length} casas del {level.name.toLowerCase()} — ¡buen ojo de vecino!
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
