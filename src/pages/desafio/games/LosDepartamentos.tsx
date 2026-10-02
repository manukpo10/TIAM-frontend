import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Los departamentos" — día 26, mes 5, ejecutivas. A logic-deduction puzzle in the
 * family of month 4's "Los vecinos", with a theme of its own: an apartment
 * building where every floor (1°, 2°, 3°…) has exactly ONE neighbour. The clues
 * say who lives where ("Marta vive en el 2° piso", "Elena vive justo arriba de
 * Marta", "El que teje tiene un gato") and the player works out each neighbour's
 * name, pet and pastime. Tap a word of the list, then tap the cell it belongs in;
 * a filled cell is tappable again to send its word back to the list.
 *
 * TWO LEVELS ONLY (the facilitator found a longer day too long): L1 is 3 floors ×
 * 2 categories (name, pet), L2 is 4 floors × 3 categories (name, pet, pastime).
 * `TOTAL_BLANKS`, the wrap-around "Repetir" and the how-to are all derived from
 * these two puzzles, never from a literal.
 *
 * THE FLOORS ARE FIXED, THE CATEGORIES ARE DEDUCED. As in a real building the top
 * floor is drawn at the TOP and the 1° at the bottom, each row carrying its own
 * "N° piso" label (never a tap target). Rows are floors and columns are
 * categories, the same transposed layout as Los vecinos, so a 4 × 3 puzzle still
 * fits a 375px phone.
 *
 * THE CLUES COME FIRST, ABOVE THE BUILDING. Level 2 is about two screens long on a
 * phone (the 8 clues alone are ~370px), so with the clues at the bottom they were
 * out of sight until the player scrolled and nothing said that they should. Now the
 * level opens on the clues, and the building and the lists (the part that is
 * tapped, ~620px) sit together right below them.
 *
 * Verification is DEFERRED until every blank of the level is filled (per-tap
 * feedback would front-run the player's own reasoning). When the last cell is
 * filled the level is checked: if everything matches it is solved, otherwise it
 * costs ONE mistake, the correct placements stay and the wrong ones go back to
 * their list, with a gentle count of how many were right (muted gray, never red; with
 * none or only one right it says so in words, because «Casi: 0 de 6» reads wrong).
 *
 * THE CLUES ARE DATA, THEIR TEXT IS DERIVED. Each clue is a structured object
 * (who lives on a floor / the top floor / two descriptions are the same person /
 * one lives right above or below another) and `clueText` writes the sentence from
 * it, so the words on screen can never drift from what was verified. A throwaway
 * Node script (not committed) tried EVERY assignment of every category to the
 * floors and confirmed that each puzzle has exactly ONE solution, that the
 * intended solution satisfies every clue, and listed which clues are redundant
 * (the redundant ones are the DIRECT clues, kept on purpose for an older player).
 *
 * A short "¿Cómo se juega?" screen (two steps and a two-floor example, its
 * button pinned to the bottom edge) opens the day; "Repetir" never brings it back
 * and replays the same two puzzles with the same order of the lists (decided once
 * at mount). Per-level state lives in <LevelView>, keyed by run + level.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged
 * by the click's own timeStamp) is ignored, so the second tap of a double tap on
 * "Empezar", "Siguiente nivel" or "Repetir" never picks the word or fills the cell
 * that sits where that button was; and two guards for older hands inside a level: a
 * quick second tap on the word just picked is a double tap (it would un-pick), and
 * so is one on the cell just filled (it would send the word straight back) or just
 * emptied (a word still picked would drop into the cell it was taken out of). The
 * closing tap is guarded too: when the last answer solves a level the clues and the
 * title vanish and the building moves up some 290px, so the second tap of a double
 * tap on the last cell can land on "Siguiente nivel" / "Repetir" and skip the recap;
 * the result buttons ignore a tap within SETTLE_MS of the tap that solved the level.
 * A new level opens at its top, and the solved card is scrolled into view, and so is
 * its button, on a short phone (the lists and the clues give their room to the card).
 *
 * totalAttempts = mistakes + every blank of the day (TOTAL_BLANKS, derived).
 */

// ── data:start ──
interface Item {
  /** What the word list and the cells show. */
  label: string
  /** How a clue points at the person who has it: "Marta", "el que tiene un gato", "el que teje". */
  ref: string
  /** What a clue says about a person who has it: "tiene un gato", "se dedica a tejer". Names have none. */
  has: string
}
interface Category {
  key: 'nombre' | 'mascota' | 'pasatiempo'
  /** Plural: the column header and the word-list heading. */
  label: string
  /** items[f] = the right item for floor index f (0 = 1° piso): this IS the solution. */
  items: Item[]
}
interface Ref {
  cat: Category['key']
  /** The `label` of the item. */
  item: string
}
type Clue =
  | { kind: 'floor'; who: Ref; floor: number }
  | { kind: 'top'; who: Ref }
  | { kind: 'same'; a: Ref; b: Ref }
  | { kind: 'above'; a: Ref; b: Ref }
  | { kind: 'below'; a: Ref; b: Ref }
interface Puzzle {
  categories: Category[]
  clues: Clue[]
}
interface LevelDef {
  name: string
  puzzle: Puzzle
}

const person = (label: string): Item => ({ label, ref: label, has: '' })
const pet = (label: string, noun: string): Item => ({
  label,
  ref: `el que tiene ${noun}`,
  has: `tiene ${noun}`,
})
const pastime = (label: string, verb: string, infinitive: string): Item => ({
  label,
  ref: `el que ${verb}`,
  has: `se dedica a ${infinitive}`,
})
const R = (cat: Category['key'], item: string): Ref => ({ cat, item })

// 3 floors × 2 categories. items[f] is the neighbour of floor f (f = 0 is the 1° piso).
const PUZZLE_L1: Puzzle = {
  categories: [
    { key: 'nombre', label: 'Vecinos', items: [person('Raúl'), person('Marta'), person('Elena')] },
    {
      key: 'mascota',
      label: 'Mascotas',
      items: [pet('Perro', 'un perro'), pet('Canario', 'un canario'), pet('Gato', 'un gato')],
    },
  ],
  clues: [
    { kind: 'floor', who: R('nombre', 'Marta'), floor: 2 },
    { kind: 'above', a: R('nombre', 'Elena'), b: R('nombre', 'Marta') },
    { kind: 'top', who: R('mascota', 'Gato') },
    { kind: 'same', a: R('nombre', 'Raúl'), b: R('mascota', 'Perro') },
  ],
}

// 4 floors × 3 categories.
const PUZZLE_L2: Puzzle = {
  categories: [
    { key: 'nombre', label: 'Vecinos', items: [person('Nora'), person('Hugo'), person('Julia'), person('Carlos')] },
    {
      key: 'mascota',
      label: 'Mascotas',
      items: [
        pet('Perro', 'un perro'),
        pet('Loro', 'un loro'),
        pet('Gato', 'un gato'),
        pet('Tortuga', 'una tortuga'),
      ],
    },
    {
      key: 'pasatiempo',
      label: 'Aficiones',
      items: [
        pastime('Leer', 'lee', 'leer'),
        pastime('Cocinar', 'cocina', 'cocinar'),
        pastime('Tejer', 'teje', 'tejer'),
        pastime('Pintar', 'pinta', 'pintar'),
      ],
    },
  ],
  clues: [
    { kind: 'floor', who: R('nombre', 'Nora'), floor: 1 },
    { kind: 'top', who: R('nombre', 'Carlos') },
    { kind: 'same', a: R('nombre', 'Julia'), b: R('mascota', 'Gato') },
    { kind: 'above', a: R('mascota', 'Loro'), b: R('nombre', 'Nora') },
    { kind: 'top', who: R('mascota', 'Tortuga') },
    { kind: 'same', a: R('nombre', 'Nora'), b: R('pasatiempo', 'Leer') },
    { kind: 'below', a: R('pasatiempo', 'Tejer'), b: R('nombre', 'Carlos') },
    { kind: 'same', a: R('pasatiempo', 'Cocinar'), b: R('mascota', 'Loro') },
  ],
}

const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', puzzle: PUZZLE_L1 },
  { name: 'Nivel 2', puzzle: PUZZLE_L2 },
]

const floorsOf = (puzzle: Puzzle): number => puzzle.categories[0].items.length

// Total tappable cells across both levels ((3×2) + (4×3) = 18), derived from the
// data so it cannot drift if a puzzle ever changes.
const TOTAL_BLANKS = LEVELS.reduce((sum, lvl) => sum + floorsOf(lvl.puzzle) * lvl.puzzle.categories.length, 0)

function itemOf(puzzle: Puzzle, ref: Ref): Item {
  const category = puzzle.categories.find((c) => c.key === ref.cat)
  const item = category?.items.find((i) => i.label === ref.item)
  if (!item) throw new Error(`Unknown clue reference ${ref.cat}/${ref.item}`)
  return item
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Who is the subject of a "same person" clue: a name, else a pastime, else a pet. */
const SUBJECT_RANK: Record<Category['key'], number> = { nombre: 0, pasatiempo: 1, mascota: 2 }

/** The sentence of a clue, written from its data. */
function clueText(puzzle: Puzzle, clue: Clue): string {
  const ref = (r: Ref) => itemOf(puzzle, r).ref
  switch (clue.kind) {
    case 'floor':
      return `${capital(ref(clue.who))} vive en el ${clue.floor}° piso.`
    case 'top':
      return `${capital(ref(clue.who))} vive en el último piso.`
    case 'above':
      return `${capital(ref(clue.a))} vive justo arriba de ${ref(clue.b)}.`
    case 'below':
      return `${capital(ref(clue.a))} vive justo abajo de ${ref(clue.b)}.`
    case 'same': {
      const [subject, other] = SUBJECT_RANK[clue.a.cat] <= SUBJECT_RANK[clue.b.cat] ? [clue.a, clue.b] : [clue.b, clue.a]
      return `${capital(ref(subject))} ${itemOf(puzzle, other).has}.`
    }
  }
}
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
  /** The word lists, in their (frozen) display order: category key → labels. */
  banks: Record<string, string[]>
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({
    banks: Object.fromEntries(lvl.puzzle.categories.map((c) => [c.key, shuffle(c.items.map((i) => i.label))])),
  }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente trabajo de detective!', '¡Así se deduce!', '¡Perfecto!']
const START_HINT = 'Tocá una palabra de la lista y después la casilla donde creés que va.'
/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel", "Repetir") is the
 * second tap of a double tap and it must not act on what sits where that button was; the same window keeps a
 * second tap on the same word / cell from being a new move. Long enough to swallow a double tap, short enough
 * that nobody who means it notices. */
const SETTLE_MS = 400

// Full class strings, never interpolated: Tailwind only emits classes it can read
// literally in the source. Keyed by the number of categories (2 / 3), which is
// what drives each cell's width — level 2's three columns need the smaller text
// to sit next to the floor label at 375px.
const CELL_TEXT_CLASS: Record<number, string> = {
  2: 'text-base',
  3: 'text-xs min-[360px]:text-sm',
}

/** placements[categoryKey][floorIndex] = the word currently placed there. */
type Placements = Record<string, Record<number, string>>

/** One floor of the worked example, with the markup of the real rows. */
function ExampleFloor({ floor, value }: { floor: number; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-12 shrink-0 flex-col items-center leading-none">
        <span className="text-lg font-bold text-slate-800">{floor}°</span>
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">piso</span>
      </span>
      <div className="flex h-9 w-24 items-center justify-center rounded-xl border-2 border-tiam-green bg-tiam-green/10 text-sm font-semibold text-slate-700">
        {value}
      </div>
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a two-floor example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'En cada piso vive un solo vecino. Las pistas dicen quién vive dónde: el piso, o «justo arriba» o «justo abajo» de otro.',
    'Tocá una palabra de la lista y después la casilla donde creés que va. Podés anotar en un papel lo que vayas descartando.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-indigo-600/20 bg-indigo-600/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>

      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3 rounded-2xl bg-white p-3">
        <p className="text-center text-sm font-semibold text-slate-500">Si «Ana vive justo arriba de Luis» y Luis vive en el 1°…</p>
        <div className="mt-2 flex flex-col items-center gap-1.5" aria-hidden="true">
          <ExampleFloor floor={2} value="Ana" />
          <ExampleFloor floor={1} value="Luis" />
        </div>
        <p className="mt-1.5 text-center text-sm leading-snug text-slate-600">…Ana vive en el 2°, un piso más arriba.</p>
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
  const { puzzle } = level
  const floors = floorsOf(puzzle)
  const cellTextClass = CELL_TEXT_CLASS[puzzle.categories.length]
  const totalForLevel = floors * puzzle.categories.length

  const [placements, setPlacements] = useState<Placements>({})
  const [selected, setSelected] = useState<{ categoryKey: string; value: string } | null>(null)
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The word picked last and the cell filled (or emptied) last, with the click's own timestamp: a
  // second tap on either right after is a double tap.
  const lastWordRef = useRef<{ key: string; at: number }>({ key: '', at: -999999 })
  const lastCellRef = useRef<{ key: string; at: number }>({ key: '', at: -999999 })
  // The tap that solved the level (the click's own timestamp): the clues and the title vanish and the building moves up, so
  // the result card's button can end up right under the finger that closed the level.
  const closedAtRef = useRef(-Infinity)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!solved || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [solved])

  const bank = (categoryKey: string) => {
    const placed = Object.values(placements[categoryKey] ?? {})
    return content.banks[categoryKey].filter((word) => !placed.includes(word))
  }
  const filledCount = puzzle.categories.reduce((sum, c) => sum + Object.keys(placements[c.key] ?? {}).length, 0)

  function validate(finalPlacements: Placements, at: number) {
    const rightCount = puzzle.categories.reduce(
      (sum, c) => sum + c.items.filter((item, f) => finalPlacements[c.key]?.[f] === item.label).length,
      0,
    )
    if (rightCount === totalForLevel) {
      closedAtRef.current = at
      setSolved(true)
      setHint(null)
      setPraise(pickOne(PRAISE))
      onSolved()
      return
    }
    onMistake()
    // «Casi: 0 de 6 están bien» and «1 de 6 están bien» read wrong, so none and one are said in words. (The wrong ones are
    // never exactly one, so "los demás" is always plural.)
    setHint(
      rightCount === 0
        ? 'Todavía no hay ninguno en su lugar. Volvieron todos a la lista — repasá las pistas y probá de nuevo.'
        : rightCount === 1
          ? 'Hay uno en su lugar y se queda ahí. Los demás volvieron a la lista — repasá las pistas y probá de nuevo.'
          : `Casi: ${rightCount} de ${totalForLevel} están bien. Los demás volvieron a la lista — repasá las pistas y probá de nuevo.`,
    )
    // Only the WRONG placements return to their list — the right ones stay put.
    const kept: Placements = {}
    for (const c of puzzle.categories) {
      const cat: Record<number, string> = {}
      c.items.forEach((item, f) => {
        if (finalPlacements[c.key]?.[f] === item.label) cat[f] = item.label
      })
      kept[c.key] = cat
    }
    setPlacements(kept)
  }

  function handleWordTap(categoryKey: string, value: string, at: number) {
    // The second tap of a double tap on the button that brought the level picks nothing.
    if (solved || at - since < SETTLE_MS) return
    const last = lastWordRef.current
    lastWordRef.current = { key: `${categoryKey}/${value}`, at }
    // A second tap on the word just picked is a double tap: keep it picked.
    if (last.key === `${categoryKey}/${value}` && at - last.at < SETTLE_MS) return
    setHint(null)
    setSelected((cur) => (cur?.categoryKey === categoryKey && cur.value === value ? null : { categoryKey, value }))
  }

  function handleCellTap(categoryKey: string, floorIndex: number, at: number) {
    if (solved || at - since < SETTLE_MS) return
    const cellKey = `${categoryKey}/${floorIndex}`
    const filled = placements[categoryKey]?.[floorIndex]
    // A tap on the cell that was just filled is a double tap: it must not send the word straight back. The same goes for
    // the cell that was just emptied: the second tap of a double tap on a filled cell, with another word still picked,
    // would drop that word into the cell the first tap emptied.
    if (lastCellRef.current.key === cellKey && at - lastCellRef.current.at < SETTLE_MS) return
    if (filled !== undefined) {
      lastCellRef.current = { key: cellKey, at }
      setHint(null)
      setPlacements((prev) => {
        const nextCat = { ...prev[categoryKey] }
        delete nextCat[floorIndex]
        return { ...prev, [categoryKey]: nextCat }
      })
      return
    }
    if (!selected || selected.categoryKey !== categoryKey) return
    setHint(null)
    lastCellRef.current = { key: cellKey, at }
    const next: Placements = {
      ...placements,
      [categoryKey]: { ...placements[categoryKey], [floorIndex]: selected.value },
    }
    setPlacements(next)
    setSelected(null)
    const complete = puzzle.categories.every((c) => c.items.every((_, f) => Boolean(next[c.key]?.[f])))
    if (complete) validate(next, at)
  }

  // The result card takes the clues' place and the building moves up, so its button can end up right under the finger that
  // closed the level: the second tap of that double tap must not skip the recap.
  function leave(go: (at: number) => void, at: number) {
    if (at - closedAtRef.current < SETTLE_MS) return
    go(at)
  }

  // Floors from the top of the building down to the 1°.
  const floorOrder = Array.from({ length: floors }, (_, i) => floors - 1 - i)

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              ¿Quién vive en cada piso?
            </h2>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Colocaste {filledCount} de {totalForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                  style={{ width: `${(filledCount / totalForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* The clues come first: they are what the player reads before touching anything, and level 2 is about
          two screens long on a phone, so at the bottom they would be out of sight until the player scrolled. */}
      {!solved && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Pistas</p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-base text-slate-700">
            {puzzle.clues.map((clue, i) => (
              <li key={i}>{clueText(puzzle, clue)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* The building — one row per floor, top floor first, one column per category.
          It stays on screen once solved, as a read-only recap. */}
      <div className="mx-auto mt-4 w-full max-w-[420px]" role="group" aria-label="Edificio">
        <div className="flex items-end gap-1 sm:gap-2">
          <div className="w-12 shrink-0 sm:w-14" />
          {/* 12px at every width, in lower case: «AFICIONES» in capitals is ~65px wide and a 320px phone gives each of the
              three columns 65px, while «Aficiones» is ~55px. */}
          {puzzle.categories.map((c) => (
            <p key={c.key} className="flex-1 text-center text-xs font-bold text-slate-500">
              {c.label}
            </p>
          ))}
        </div>
        {floorOrder.map((f) => (
          <div key={f} className="mt-1 flex items-stretch gap-1 sm:gap-2">
            {/* "N° piso" — a row header, never a tap target. */}
            <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 leading-none sm:w-14">
              <span className="text-lg font-bold text-slate-800">{f + 1}°</span>
              {/* slate-600: slate-500 on this slate-100 header is 4.34:1, just under AA. */}
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">piso</span>
            </div>
            {puzzle.categories.map((c) => {
              const placed = placements[c.key]?.[f]
              const filled = placed !== undefined
              const pickable = !filled && selected !== null && selected.categoryKey === c.key
              const interactive = !solved && (filled || pickable)
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={!interactive}
                  onClick={(e) => handleCellTap(c.key, f, e.timeStamp)}
                  aria-label={
                    filled
                      ? `${placed} — tocá para sacarlo`
                      : pickable
                        ? `Poner ${selected.value} en el ${f + 1}° piso`
                        : `${f + 1}° piso, ${c.label.toLowerCase()} vacío`
                  }
                  className={[
                    'relative flex min-h-[48px] flex-1 items-center justify-center break-words rounded-xl border-2 px-1 py-2 text-center font-semibold leading-tight text-slate-700 transition',
                    cellTextClass,
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40',
                    filled
                      ? solved
                        ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                        : 'border-indigo-600/50 bg-indigo-600/5'
                      : pickable
                        ? 'border-dashed border-indigo-600 bg-indigo-50'
                        : 'border-dashed border-slate-300 bg-white',
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
          {/* One list per category, kept visually apart so a word's TYPE (and so which column it can go in) is always clear. */}
          {puzzle.categories.map((c) => (
            <div key={c.key} className="mt-3">
              <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
              <div className="mt-1.5 flex min-h-[44px] flex-wrap justify-center gap-2">
                {bank(c.key).map((word) => {
                  const isSelected = selected !== null && selected.categoryKey === c.key && selected.value === word
                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={(e) => handleWordTap(c.key, word, e.timeStamp)}
                      aria-pressed={isSelected}
                      className={[
                        'min-h-[44px] rounded-xl border-2 px-3 py-2 text-base font-semibold transition',
                        'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40',
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-indigo-600/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <p role="status" className="mt-3 min-h-[2.75rem] text-center text-base font-medium text-slate-500">
            {hint ?? START_HINT}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Descubriste quién vive en cada piso. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => leave(onRepeat, e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => leave(onNext, e.timeStamp)}
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

export function LosDepartamentos({ onComplete }: GameProps) {
  // The order of every word list — decided once, at mount, so "Repetir" replays
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_BLANKS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Quién vive en cada piso?</h2>
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
