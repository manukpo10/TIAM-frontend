import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pencil, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Los vecinos" — día 26, ejecutivas (replaces "Caras y emociones", which
 * stays on disk unused per this catalog's convention — see registry.ts). A
 * classic logic-deduction puzzle ("acertijo de Einstein" / zebra puzzle): a
 * row of houses, each with a FIXED color, and a list of clues that let you
 * deduce which país/mascota/bebida/comida belongs to each house.
 *
 * SAME FAMILY AS AViajar.tsx (día 24) and CasasDelBarrio.tsx (día 29) — all
 * three are constraint-satisfaction puzzles where several clues have to be
 * held in mind and combined to deduce a full assignment. This one is the
 * most general of the three: AViajar fixes exactly 2 categories (transporte/
 * destino) and CasasDelBarrio assigns a single attribute (a name) to a fixed
 * grid position; here the number of categories is DATA-DRIVEN and varies per
 * level (2 → 3 → 4), so the rendering code is one loop over
 * `puzzle.categories` — never a hardcoded column count.
 *
 * LAYOUT: rows are houses, not columns. The classic zebra-puzzle worksheet
 * lays houses out as columns, but that doesn't fit a 375px phone once nivel
 * 3 reaches 5 houses × 4 categories, so it's transposed here: each ROW is
 * one house (a fixed-color swatch + "Casa N", neither tappable — the color
 * is GIVEN, never guessed), each COLUMN is one category.
 *
 * INTERACTION: same tap-a-word-then-tap-a-cell flow as AViajar — pick a word
 * from a bank, tap the cell it belongs in; an already-filled cell is
 * tappable again to send it back to its own bank. Verification is DEFERRED
 * until every blank in the level is filled (not per-tap — with this many
 * interdependent clues, per-tap feedback would front-run the player's own
 * reasoning). Once checked: correct placements stay, wrong ones bounce back
 * to their bank with a random hint (never red — see HINTS/house rules).
 *
 * CONTENT: hand-authored, one puzzle per level, pre-verified by the
 * requester with a brute-force script over every permutation to have
 * exactly one solution — used here EXACTLY as given (clue wording, item
 * names and house colors are all verbatim, down to nivel 3's color-name
 * gender being slightly inconsistent with nivel 1's, e.g. "Rojo" here vs
 * "Roja" there — cosmetic only, it only ever surfaces in an aria-label,
 * never in on-screen text or clue wording). Each category's `items` array is
 * stored in HOUSE ORDER (`items[h]` is the correct answer for house h) —
 * this doubles as the solution, so there's no separate solution map that
 * could drift out of sync with it (unlike AViajar's `solution` record). Only
 * the banks' DISPLAY order is shuffled (`useMemo`, cosmetic only, same
 * mechanism as AViajar's `shuffledModos`/`shuffledDestinos`) — the puzzle
 * itself never varies, so "Repetir" always replays the exact same 3
 * puzzles. `TOTAL_BLANKS` is derived from the data (houses × categories,
 * summed across levels), never a bare literal.
 *
 * NIVEL 3 is the classic Einstein/zebra puzzle (5 houses, 4 categories, 20
 * blanks, 14 clues) — the hardest single puzzle in the app's whole game
 * catalog, requiring genuine multi-step chained deduction. A "¿Cómo se
 * juega?" ready screen (`phase: 'ready' | 'playing'`, same pattern as
 * LaberintoDeMultiplicaciones.tsx) explains the three things a first-time
 * player needs before nivel 1 even starts — colors are fixed per house,
 * clues can point by color/position/adjacency, and how tapping works — plus
 * a worked 2-house example reusing the real cell markup, and a
 * lápiz-y-papel note. Shown once per opening of the day; "Repetir" never
 * resets it back to 'ready'.
 *
 * MOBILE WIDTH at nivel 3 (5 rows × a house-color+label column × 4 tappable
 * cells) is the widest row in the app's whole game catalog. It fits at
 * 375px with a small font (`text-[10px]`, via CELL_TEXT_CLASS) and
 * `break-words` on each cell — the one genuinely long item name
 * ("Hamburguesa") wraps onto a second line inside its ~60px cell instead of
 * overflowing it, so the horizontal-scroll fallback used by
 * PalabrasEnClave.tsx / QueSigue.tsx isn't needed here. Verified in-browser
 * at a 375px viewport before shipping.
 */

interface HouseColor {
  name: string
  hex: string
}

interface Category {
  key: string
  /** Plural display label (e.g. "Países") — rendered uppercase via CSS both
   * as the column header above the grid and as the word-bank heading below
   * it, and lowercased for aria-labels. */
  label: string
  /** items[h] = the correct item for house index h — see file header: this
   * IS the solution, not just the bank contents. */
  items: string[]
}

interface Puzzle {
  houses: HouseColor[]
  categories: Category[]
  clues: string[]
}

interface Level {
  n: number
  name: string
  puzzle: Puzzle
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

// ── Puzzles — hand-authored, one per level, pre-verified by the requester
// (brute-force over every permutation) to have exactly one solution. See
// file header for how `items` doubles as the solution.

const PUZZLE_L1: Puzzle = {
  houses: [
    { name: 'Amarilla', hex: '#EAB308' },
    { name: 'Roja', hex: '#DC2626' },
    { name: 'Azul', hex: '#2563EB' },
  ],
  categories: [
    { key: 'pais', label: 'Países', items: ['Francia', 'España', 'Italia'] },
    { key: 'mascota', label: 'Mascotas', items: ['Perro', 'Pez', 'Gato'] },
  ],
  clues: [
    'El francés vive en la primera casa.',
    'El dueño de la casa azul tiene un gato.',
    'El español vive en la casa roja.',
    'El francés tiene un perro.',
  ],
}

const PUZZLE_L2: Puzzle = {
  houses: [
    { name: 'Naranja', hex: '#EA580C' },
    { name: 'Verde', hex: '#16A34A' },
    { name: 'Rosa', hex: '#EC4899' },
    { name: 'Gris', hex: '#6B7280' },
  ],
  categories: [
    { key: 'pais', label: 'Países', items: ['Portugal', 'Grecia', 'Japón', 'México'] },
    { key: 'mascota', label: 'Mascotas', items: ['Conejo', 'Tortuga', 'Loro', 'Hámster'] },
    { key: 'bebida', label: 'Bebidas', items: ['Agua', 'Gaseosa', 'Jugo', 'Leche'] },
  ],
  clues: [
    'El griego vive en la casa verde.',
    'El mexicano vive en la última casa.',
    'El dueño de la casa naranja tiene un conejo.',
    'El que vive en la casa gris toma leche.',
    'El portugués vive en la primera casa.',
    'El griego tiene una tortuga.',
    'El que tiene hámster vive en la casa gris.',
    'El portugués toma agua.',
    'El que toma jugo vive al lado del griego.',
  ],
}

const PUZZLE_L3: Puzzle = {
  houses: [
    { name: 'Naranja', hex: '#EA580C' },
    { name: 'Celeste', hex: '#0EA5E9' },
    { name: 'Rojo', hex: '#DC2626' },
    { name: 'Verde', hex: '#16A34A' },
    { name: 'Negro', hex: '#1F2937' },
  ],
  categories: [
    { key: 'pais', label: 'Países', items: ['Noruega', 'Dinamarca', 'Reino Unido', 'Alemania', 'Suecia'] },
    { key: 'mascota', label: 'Mascotas', items: ['Gato', 'Caballo', 'Pájaro', 'Pez', 'Perro'] },
    { key: 'bebida', label: 'Bebidas', items: ['Agua', 'Té', 'Leche', 'Café', 'Cerveza'] },
    { key: 'comida', label: 'Comidas', items: ['Puré', 'Ensalada', 'Croquetas', 'Pizza', 'Hamburguesa'] },
  ],
  clues: [
    'El británico vive en la casa roja.',
    'El sueco tiene un perro como mascota.',
    'El danés toma té.',
    'El noruego vive en la primera casa.',
    'El alemán come pizza.',
    'El dueño de la casa verde bebe café.',
    'El propietario que come croquetas cría pájaros.',
    'El dueño de la casa naranja come puré.',
    'El hombre que vive en la casa del centro bebe leche.',
    'El hombre que come ensalada vive al lado del que tiene un gato.',
    'El hombre que tiene un caballo vive al lado del que come puré.',
    'El hombre que come hamburguesas toma cerveza.',
    'El hombre que come ensalada vive al lado del que toma agua.',
    'El noruego vive al lado de la casa azul (la casa celeste).',
  ],
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', puzzle: PUZZLE_L1 },
  { n: 2, name: 'Nivel 2', puzzle: PUZZLE_L2 },
  { n: 3, name: 'Nivel 3', puzzle: PUZZLE_L3 },
]

// Total tappable cells across all three levels ((3×2) + (4×3) + (5×4) = 38)
// — derived from the data rather than a bare literal, so it can't silently
// drift if a puzzle's house or category count ever changes.
const TOTAL_BLANKS = LEVELS.reduce((sum, lvl) => sum + lvl.puzzle.houses.length * lvl.puzzle.categories.length, 0)

// Full class strings, never interpolated — Tailwind only emits classes it
// can read literally in the source (same discipline as
// LaberintoDeMultiplicaciones.tsx's GRID_CLASS/CELL_CLASS). Keyed by
// category count (2/3/4), which is what actually drives each tappable
// cell's width — nivel 3's 4 columns need the smallest text to fit
// alongside the house-color+label column at 375px.
const CELL_TEXT_CLASS: Record<number, string> = {
  2: 'text-sm sm:text-base',
  3: 'text-xs sm:text-sm',
  4: 'text-[10px] sm:text-sm',
}

const PRAISE = ['¡Muy bien!', '¡Excelente trabajo de detective!', '¡Así se deduce!', '¡Perfecto!']
const HINTS = [
  'Algo de eso no va ahí — volvió a la lista. Repasá las pistas y probá de nuevo.',
  'Casi. Uno de los datos no corresponde a esa casa — fijate bien en las pistas.',
  'Esa combinación no cierra. Uno volvió a la lista — pensalo de nuevo con calma.',
]

/** placements[categoryKey][houseIndex] = the word currently placed there. */
type Placements = Record<string, Record<number, string>>

/** One house of the worked example, reusing the real row's swatch+cell
 * markup (same principle as LaberintoDeMultiplicaciones.tsx's ExampleCell)
 * so recognizing a cell in the actual game means recognizing this screen. */
function ExampleHouse({ hex, label, value, solved }: { hex: string; label: string; value: string; solved: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: hex }} aria-hidden="true" />
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
      <div
        className={[
          'flex h-11 w-16 items-center justify-center rounded-xl border-2 text-xs font-semibold',
          solved ? 'border-tiam-green bg-tiam-green/10 text-slate-700' : 'border-dashed border-slate-300 bg-white text-slate-400',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: () => void }) {
  const steps = [
    'Cada casa tiene un color fijo que no cambia.',
    'Las pistas dicen qué país, mascota, bebida o comida va en cada casa — a veces por el color, a veces por la posición, y a veces por "vive al lado de".',
    'Tocás una palabra de la lista de abajo y después la casilla donde creas que va.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-2xl bg-white p-3">
        <p className="text-center text-sm font-semibold text-slate-500">
          Por ejemplo, con la pista "el dueño de la casa roja tiene un gato":
        </p>
        <div className="mt-3 flex items-start justify-center gap-4">
          <ExampleHouse hex="#EAB308" label="Casa 1" value="?" solved={false} />
          <ExampleHouse hex="#DC2626" label="Casa 2" value="Gato" solved />
        </div>
        <p className="mt-2 text-center text-xs leading-snug text-slate-500">
          La casa 2 es la roja, así que ya sabés que ahí va el gato.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-tiam-blue/15 bg-white p-3">
        <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
        <p className="text-base leading-snug text-slate-700">
          Tené a mano lápiz y papel: podés anotar lo que vayas descartando si te ayuda.
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

export function LosVecinos({ day: _day, onComplete }: GameProps) {
  // How-to screen, once per opening of the day — "Repetir" never sets it
  // back, same convention as LaberintoDeMultiplicaciones.tsx.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const puzzle = level.puzzle

  // Cosmetic only — WHICH puzzle plays at each level never varies (see file
  // header), only the banks' display order does, recomputed whenever the
  // level (and so `puzzle`'s reference) changes.
  const shuffledItems = useMemo(
    () => Object.fromEntries(puzzle.categories.map((c) => [c.key, shuffle(c.items)])),
    [puzzle],
  )

  // placements[categoryKey] is created lazily on first placement (see
  // placeItem) — {...undefined} is a safe no-op, so there's no need to
  // pre-seed every category's map on mount or on nextLevel.
  const [placements, setPlacements] = useState<Placements>({})
  const [selected, setSelected] = useState<{ categoryKey: string; value: string } | null>(null)
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates 1→2→3 across levels; zeroed ONLY on the genuine day restart
  // (wrap from level 3 back to level 1).
  const [mistakes, setMistakes] = useState(0)

  const banks = Object.fromEntries(
    puzzle.categories.map((c) => [
      c.key,
      shuffledItems[c.key].filter((word) => !Object.values(placements[c.key] ?? {}).includes(word)),
    ]),
  )

  function isComplete(p: Placements) {
    return puzzle.categories.every((c) => c.items.every((_, h) => Boolean(p[c.key]?.[h])))
  }

  function validate(finalPlacements: Placements) {
    const allCorrect = puzzle.categories.every((c) => c.items.every((correct, h) => finalPlacements[c.key]?.[h] === correct))
    if (allCorrect) {
      setSolved(true)
      setPraise(pickOne(PRAISE))
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    // Only the WRONG placements return to their bank — correct ones stay put.
    const cleared: Placements = {}
    for (const c of puzzle.categories) {
      const nextCat: Record<number, string> = {}
      for (let h = 0; h < c.items.length; h++) {
        const placed = finalPlacements[c.key]?.[h]
        if (placed && placed === c.items[h]) nextCat[h] = placed
      }
      cleared[c.key] = nextCat
    }
    setPlacements(cleared)
  }

  function placeItem(categoryKey: string, houseIndex: number) {
    if (!selected || selected.categoryKey !== categoryKey || solved) return
    setHint(null)
    const next: Placements = {
      ...placements,
      [categoryKey]: { ...placements[categoryKey], [houseIndex]: selected.value },
    }
    setPlacements(next)
    setSelected(null)
    if (isComplete(next)) validate(next)
  }

  function unplaceItem(categoryKey: string, houseIndex: number) {
    if (solved) return
    setHint(null)
    setPlacements((prev) => {
      if (!prev[categoryKey] || !(houseIndex in prev[categoryKey])) return prev
      const nextCat = { ...prev[categoryKey] }
      delete nextCat[houseIndex]
      return { ...prev, [categoryKey]: nextCat }
    })
  }

  // Resets happen HERE, synchronously with the level/puzzle change, never in
  // a useEffect keyed on levelIdx — an effect lags one render behind, so the
  // onComplete-reporting effect below would read the PREVIOUS puzzle's
  // stale `solved === true` on the render that just arrived at the new
  // level, and fire onComplete with garbage. Same reasoning as AViajar.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setPlacements({})
    setSelected(null)
    setHint(null)
    setSolved(false)
    if (isWrap) {
      // Genuine day restart — the mistake counter zeroes. Puzzle content
      // never varies by level anyway, so there's nothing to re-roll:
      // "Repetir" always replays the exact same 3 puzzles.
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

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {level.name}
          </span>
        </div>
        <HowToPlay onStart={() => setPhase('playing')} />
      </div>
    )
  }

  const totalForLevel = puzzle.houses.length * puzzle.categories.length
  const filledCount = puzzle.categories.reduce((sum, c) => sum + Object.keys(placements[c.key] ?? {}).length, 0)
  const cellTextClass = CELL_TEXT_CLASS[puzzle.categories.length]

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Los vecinos</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá una palabra de la lista y después la casilla donde creas que va, según las pistas.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Colocaste {filledCount} de {totalForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                  style={{ width: `${(filledCount / totalForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Grid — one row per house, one column per category. Stays visible
          once solved too, as a read-only recap, same convention as
          AViajar.tsx's table. */}
      <div className="mx-auto mt-5 w-full max-w-[420px]">
        <div className="flex items-end gap-1 sm:gap-2">
          <div className="w-10 shrink-0 sm:w-14" />
          {puzzle.categories.map((c) => (
            <p key={c.key} className="flex-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">
              {c.label}
            </p>
          ))}
        </div>
        {puzzle.houses.map((house, h) => (
          <div key={h} className="mt-1 flex items-stretch gap-1 sm:gap-2">
            {/* Color + "Casa N" — a row header, never a tap target: the
                color is GIVEN, never guessed. */}
            <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-0.5 sm:w-14">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 sm:h-4 sm:w-4"
                style={{ backgroundColor: house.hex }}
                role="img"
                aria-label={`Color de la casa ${h + 1}: ${house.name.toLowerCase()}`}
              />
              <span className="text-center text-[9px] font-bold leading-none text-slate-800 sm:text-xs">Casa {h + 1}</span>
            </div>
            {puzzle.categories.map((c) => {
              const placed = placements[c.key]?.[h]
              const filled = Boolean(placed)
              const interactive = !solved && (filled || (selected !== null && selected.categoryKey === c.key))
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={!interactive}
                  onClick={() => (filled ? unplaceItem(c.key, h) : placeItem(c.key, h))}
                  aria-label={
                    filled
                      ? `${placed} — tocá para sacarlo`
                      : selected !== null && selected.categoryKey === c.key
                        ? `Poner ${selected.value} en la casa ${h + 1}`
                        : `Casa ${h + 1}, ${c.label.toLowerCase()} vacío`
                  }
                  className={[
                    'relative flex min-h-[44px] flex-1 items-center justify-center break-words rounded-xl border-2 px-1 py-2 text-center font-semibold leading-tight text-slate-700 transition',
                    cellTextClass,
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    filled && solved ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                    filled && !solved ? 'border-tiam-blue/50 bg-tiam-blue/5' : '',
                    !filled ? 'border-dashed border-slate-300 bg-white' : '',
                    interactive ? 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                  ].join(' ')}
                >
                  {placed ?? '?'}
                  {filled && solved && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {!solved && (
        <>
          {/* One bank per category, kept visually separate so each word's
              TYPE (and so which column it can land on) is always obvious. */}
          {puzzle.categories.map((c) => (
            <div key={c.key} className="mt-4">
              <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {banks[c.key].map((word) => {
                  const isSelected = selected !== null && selected.categoryKey === c.key && selected.value === word
                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={() =>
                        setSelected((cur) =>
                          cur?.categoryKey === c.key && cur.value === word ? null : { categoryKey: c.key, value: word },
                        )
                      }
                      className={[
                        'min-h-[44px] rounded-xl border-2 px-3 py-2 text-sm font-semibold transition',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                        isSelected
                          ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                          : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

          {/* Clues — always visible, per spec. */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Pistas</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-base text-slate-700">
              {puzzle.clues.map((clue, i) => (
                <li key={i}>{clue}</li>
              ))}
            </ul>
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
            Descubriste dónde vive cada vecino en el {level.name.toLowerCase()} — ¡buena deducción!
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
