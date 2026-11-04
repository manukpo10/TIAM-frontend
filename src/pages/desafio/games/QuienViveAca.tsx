import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Quién vive acá?" — día 13, mes 6, razonamiento. A block of buildings and a neighbour who says what their building
 * is like ("Vivo en un edificio que tiene cuatro pisos y no tiene escalera"). The player reads the statement and taps the
 * building that fits; the neighbour's name is put on it and the next neighbour speaks. The mechanic comes from a
 * worksheet with eight buildings and speech bubbles, where the name of each person was written next to the building
 * they describe; here the buildings are drawn in code and the neighbours speak one at a time.
 *
 * ORIGINAL CONTENT. Only the idea (deducing who lives in which building from what each one says about it) is borrowed.
 * The buildings are TIAM's own drawings (SVG), the names are other names and the statements are written from the data
 * of each building. Nothing of the worksheet's drawings, names or sentences is used.
 *
 * WHAT MAKES IT A DIFFERENT ACTIVITY FROM "Las casas del barrio" (mes 4), where all the clues are on screen, the names
 * wait in a bank and the whole assignment is checked at the end: here ONE neighbour speaks at a time and each tap is
 * checked at once; the clues describe what the building LOOKS like (floors, windows, balconies, stairs, awning, roof,
 * colour) and not where it is on a grid, and from the middle of a level on the statements compare with the building of a
 * neighbour who was already placed ("es más bajo que el de Estela"), which is how the player reasons.
 *
 * EVERY PUZZLE HAS ONE SOLUTION. The statements are GENERATED from structured conditions (`say`), never typed apart, and a
 * throwaway script (not committed) checks, for every level, that at each step exactly one of the buildings still free
 * fits the statement (so the order is solvable), that the statements only refer to neighbours already placed and, by
 * trying every possible assignment of names to buildings (720 with six), that the whole set of statements has exactly
 * ONE solution. Colour is never the only signal: the colour of each wall is also written under the building, and every
 * other feature is a shape.
 *
 * A WRONG BUILDING costs ONE mistake and is switched off (muted gray, never red); the hint grows with the misses on
 * the same neighbour: which part of the statement does not fit, how many buildings are still free, and the last one
 * standing is ringed. Nothing is timed but a short pause so the name on its building is seen.
 *
 * ONE PUZZLE A LEVEL (four, six and six neighbours). The ramp: level 1 gives one feature per statement, level 2 two
 * features (and "no tiene…"), level 3 three features, negations and comparisons with a neighbour. The order of the
 * buildings on the street is chosen ONCE at mount (`epoch`), so "Repetir" replays exactly the same three puzzles.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored (the
 * buildings sit where that button was) and a building already tried for the neighbour is ignored.
 *
 * totalAttempts = mistakes + every neighbour of the day (TOTAL_NEIGHBOURS, derived).
 */

// ── data:start ──
type Wall = 'celeste' | 'durazno' | 'menta' | 'amarillo' | 'lila' | 'rosa'
interface BuildingDef {
  wall: Wall
  /** Floors, the ground floor included. */
  floors: 2 | 3 | 4
  windows: 'arco' | 'cuadradas'
  balcony: boolean
  stairs: boolean
  /** An awning over the door. */
  awning: boolean
  roof: 'plano' | 'en punta'
}
type Cond =
  | { k: 'wall'; v: Wall }
  | { k: 'floors'; v: 2 | 3 | 4 }
  | { k: 'floorsVs'; cmp: 'lt' | 'gt' | 'eq'; who: string }
  | { k: 'windows'; v: 'arco' | 'cuadradas' }
  | { k: 'balcony'; v: boolean }
  | { k: 'stairs'; v: boolean }
  | { k: 'awning'; v: boolean }
  | { k: 'roof'; v: 'plano' | 'en punta' }

interface ResidentDef {
  name: string
  /** The building (index in `buildings`) where this neighbour lives. */
  home: number
  conds: Cond[]
}
interface LevelDef {
  name: string
  buildings: BuildingDef[]
  /** In the order they speak. */
  residents: ResidentDef[]
}

const b = (wall: Wall, floors: 2 | 3 | 4, windows: 'arco' | 'cuadradas', balcony: boolean, stairs: boolean, awning: boolean, roof: 'plano' | 'en punta'): BuildingDef => ({ wall, floors, windows, balcony, stairs, awning, roof })

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    buildings: [
      b('celeste', 3, 'arco', false, false, false, 'plano'),
      b('durazno', 2, 'cuadradas', true, true, true, 'en punta'),
      b('menta', 4, 'arco', true, false, false, 'plano'),
      b('rosa', 3, 'cuadradas', false, true, true, 'en punta'),
    ],
    residents: [
      { name: 'Nora', home: 0, conds: [{ k: 'wall', v: 'celeste' }] },
      { name: 'Beto', home: 1, conds: [{ k: 'floors', v: 2 }] },
      { name: 'Lidia', home: 2, conds: [{ k: 'floors', v: 4 }] },
      { name: 'Carlos', home: 3, conds: [{ k: 'wall', v: 'rosa' }] },
    ],
  },
  {
    name: 'Nivel 2',
    buildings: [
      b('lila', 4, 'arco', true, false, false, 'plano'),
      b('amarillo', 2, 'cuadradas', false, true, true, 'en punta'),
      b('celeste', 3, 'arco', false, true, false, 'en punta'),
      b('durazno', 3, 'cuadradas', true, false, true, 'plano'),
      b('menta', 2, 'arco', true, true, true, 'plano'),
      b('rosa', 4, 'cuadradas', false, false, false, 'en punta'),
    ],
    residents: [
      { name: 'Marta', home: 0, conds: [{ k: 'floors', v: 4 }, { k: 'balcony', v: true }] },
      { name: 'Hernán', home: 1, conds: [{ k: 'floors', v: 2 }, { k: 'windows', v: 'cuadradas' }] },
      { name: 'Silvia', home: 2, conds: [{ k: 'windows', v: 'arco' }, { k: 'awning', v: false }] },
      { name: 'Daniel', home: 4, conds: [{ k: 'balcony', v: true }, { k: 'stairs', v: true }] },
      { name: 'Rosa', home: 3, conds: [{ k: 'awning', v: true }, { k: 'roof', v: 'plano' }] },
      { name: 'Tomás', home: 5, conds: [{ k: 'wall', v: 'rosa' }] },
    ],
  },
  {
    name: 'Nivel 3',
    buildings: [
      b('celeste', 3, 'cuadradas', true, true, false, 'plano'),
      b('durazno', 4, 'arco', true, false, true, 'en punta'),
      b('menta', 2, 'cuadradas', false, false, false, 'en punta'),
      b('amarillo', 3, 'arco', false, true, true, 'plano'),
      b('lila', 4, 'cuadradas', true, true, true, 'plano'),
      b('rosa', 2, 'arco', true, false, false, 'en punta'),
    ],
    residents: [
      { name: 'Estela', home: 1, conds: [{ k: 'floors', v: 4 }, { k: 'stairs', v: false }] },
      { name: 'Gabriel', home: 0, conds: [{ k: 'floorsVs', cmp: 'lt', who: 'Estela' }, { k: 'balcony', v: true }, { k: 'windows', v: 'cuadradas' }] },
      { name: 'Julia', home: 3, conds: [{ k: 'balcony', v: false }, { k: 'windows', v: 'arco' }] },
      { name: 'Ramiro', home: 4, conds: [{ k: 'floorsVs', cmp: 'eq', who: 'Estela' }] },
      { name: 'Olga', home: 5, conds: [{ k: 'floors', v: 2 }, { k: 'balcony', v: true }] },
      { name: 'Víctor', home: 2, conds: [{ k: 'wall', v: 'menta' }] },
    ],
  },
]
const TOTAL_NEIGHBOURS = LEVELS.reduce((sum, lvl) => sum + lvl.residents.length, 0)

const FLOOR_WORD = { 2: 'dos', 3: 'tres', 4: 'cuatro' } as const

/** What a condition says, in words (the statement is built from these, never typed apart). */
function say(c: Cond): string {
  switch (c.k) {
    case 'wall':
      return `es de color ${c.v}`
    case 'floors':
      return `tiene ${FLOOR_WORD[c.v]} pisos`
    case 'floorsVs':
      return c.cmp === 'lt' ? `es más bajo que el de ${c.who}` : c.cmp === 'gt' ? `es más alto que el de ${c.who}` : `tiene tantos pisos como el de ${c.who}`
    case 'windows':
      return c.v === 'arco' ? 'tiene ventanas con arco' : 'tiene ventanas cuadradas'
    case 'balcony':
      return c.v ? 'tiene balcones' : 'no tiene balcones'
    case 'stairs':
      return c.v ? 'tiene escalera en la entrada' : 'no tiene escalera'
    case 'awning':
      return c.v ? 'tiene un toldo sobre la puerta' : 'no tiene toldo'
    case 'roof':
      return c.v === 'plano' ? 'tiene el techo plano' : 'tiene el techo en punta'
  }
}
/** The whole statement of a neighbour. */
function statement(conds: Cond[]): string {
  // «tiene A, tiene B y tiene C» reads better as «tiene A, B y C»
  const parts = conds.map(say).map((t, i, all) => (i > 0 && t.startsWith('tiene ') && all[i - 1].startsWith('tiene ') ? t.slice(6) : t))
  const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
  return `Vivo en un edificio que ${text}.`
}
/** Does a building fit a condition? `homes` gives the building of each neighbour already placed (for the comparisons). */
function fits(c: Cond, bd: BuildingDef, homes: Record<string, BuildingDef | undefined>): boolean {
  switch (c.k) {
    case 'wall':
      return bd.wall === c.v
    case 'floors':
      return bd.floors === c.v
    case 'floorsVs': {
      const other = homes[c.who]
      if (!other) return false
      return c.cmp === 'lt' ? bd.floors < other.floors : c.cmp === 'gt' ? bd.floors > other.floors : bd.floors === other.floors
    }
    case 'windows':
      return bd.windows === c.v
    case 'balcony':
      return bd.balcony === c.v
    case 'stairs':
      return bd.stairs === c.v
    case 'awning':
      return bd.awning === c.v
    case 'roof':
      return bd.roof === c.v
  }
}
/** The building in words, for a screen reader. */
function describe(bd: BuildingDef): string {
  return [`color ${bd.wall}`, `${FLOOR_WORD[bd.floors]} pisos`, `ventanas ${bd.windows === 'arco' ? 'con arco' : 'cuadradas'}`, bd.balcony ? 'con balcones' : 'sin balcones', bd.stairs ? 'con escalera' : 'sin escalera', bd.awning ? 'con toldo' : 'sin toldo', `techo ${bd.roof}`].join(', ')
}

/** The neighbour of the how-to screen: not in the game. */
const EXAMPLE = { name: 'Elena', conds: [{ k: 'floors', v: 3 }, { k: 'stairs', v: true }] as Cond[] }
// ── data:end ──

// ── buildings:start ──
const WALL_HEX: Record<Wall, string> = { celeste: '#9fd0ec', durazno: '#f6c3a0', menta: '#a9dcc0', amarillo: '#f4de8a', lila: '#c7b3e6', rosa: '#f3b3c6' }
const WALL_DARK: Record<Wall, string> = { celeste: '#5f9cc2', durazno: '#cf8f68', menta: '#6fb08c', amarillo: '#c9b04f', lila: '#9680c2', rosa: '#c97a93' }

/** The building as SVG (viewBox 0 0 100 134): floors, windows, balconies, awning, stairs and roof drawn from its data. */
function buildingSvg(bd: BuildingDef): string {
  const fill = WALL_HEX[bd.wall]
  const dark = WALL_DARK[bd.wall]
  const ground = 124
  const groundH = 28
  const upper = bd.floors - 1
  const topY = ground - groundH - upper * 24
  const out: string[] = []
  out.push(`<rect x="0" y="${ground}" width="100" height="5" rx="2" fill="#cdd6df"/>`)
  out.push(`<rect x="18" y="${topY}" width="64" height="${ground - topY}" fill="${fill}" stroke="${dark}" stroke-width="2"/>`)
  // roof
  if (bd.roof === 'plano') out.push(`<rect x="14" y="${topY - 6}" width="72" height="7" rx="2" fill="${dark}"/>`)
  else out.push(`<polygon points="13,${topY + 1} 50,${topY - 22} 87,${topY + 1}" fill="#9a6b58" stroke="#6f4a3c" stroke-width="2" stroke-linejoin="round"/>`)
  // windows, drawn with the shape of the building
  const win = (x: number, y: number) =>
    bd.windows === 'arco'
      ? `<path d="M${x} ${y + 14} v-8 a6 6 0 0 1 12 0 v8 z" fill="#fff6cf" stroke="#4d5b6b" stroke-width="2"/>`
      : `<rect x="${x}" y="${y}" width="12" height="14" fill="#fff6cf" stroke="#4d5b6b" stroke-width="2"/>`
  for (let r = 1; r <= upper; r++) {
    const floorTop = ground - groundH - r * 24
    const y = floorTop + 4
    out.push(win(28, y), win(60, y))
    if (bd.balcony) {
      for (const x of [24, 56]) {
        out.push(`<rect x="${x}" y="${y + 14}" width="20" height="4" fill="#4d5b6b"/>`)
        out.push(`<path d="M${x} ${y + 14} v-6 M${x + 10} ${y + 14} v-6 M${x + 20} ${y + 14} v-6 M${x} ${y + 8} h20" stroke="#4d5b6b" stroke-width="1.6" fill="none"/>`)
      }
    }
  }
  // ground floor: door in the middle, a window at each side
  out.push(win(26, 100), win(62, 100))
  out.push(`<rect x="43" y="100" width="14" height="${ground - 100}" fill="#8a5a3b" stroke="#5b3a24" stroke-width="2"/><circle cx="54" cy="113" r="1.6" fill="#f3d27a"/>`)
  if (bd.awning) {
    out.push(`<polygon points="38,99 62,99 67,107 33,107" fill="#d94f4f"/><polygon points="44,99 50,99 50,107 42,107" fill="#fff"/><polygon points="56,99 62,99 64,107 58,107" fill="#fff"/>`)
  }
  if (bd.stairs) {
    out.push(`<rect x="41" y="120" width="18" height="4" fill="#9aa5b1"/><rect x="38" y="124" width="24" height="4" fill="#aab4bf"/><rect x="35" y="128" width="30" height="4" fill="#bac3cc"/>`)
  }
  return out.join('')
}
// ── buildings:end ──

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

/** The order the buildings of each level show on the street — decided ONCE at mount. */
function buildEpoch(): number[][] {
  return LEVELS.map((lvl) => shuffle(lvl.buildings.map((_, i) => i)))
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena deducción!', '¡Perfecto!']
/** The pause after a right building, with the name on it, before the next neighbour. */
const ADVANCE_MS = 1500
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a building: the buildings sit where that button was. */
const SETTLE_MS = 400

function Building({ bd, className }: { bd: BuildingDef; className?: string }) {
  return <svg viewBox="0 0 100 134" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: buildingSvg(bd) }} />
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Un vecino te cuenta cómo es su edificio: los pisos, las ventanas, los balcones, la escalera, el toldo, el techo o el color.',
    'Tocá el edificio que le corresponde. Su nombre queda en el edificio y habla el próximo vecino.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-base font-semibold text-slate-500">Por ejemplo:</p>
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">
          {EXAMPLE.name}: «{statement(EXAMPLE.conds)}»
        </p>
        <p className="mt-1 text-base text-slate-600">Hay que buscar el edificio con tres pisos y escalera.</p>
      </div>
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
  /** The order the buildings show, as indices of the level's buildings. */
  order: number[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, order, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.residents.length

  // The neighbour speaking, the buildings already given a name (by building index) and the wrong ones tried for them.
  const [qIdx, setQIdx] = useState(0)
  const [named, setNamed] = useState<Record<number, string>>({})
  const [tried, setTried] = useState<number[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same keys, but readable at once: a double tap lands before React has repainted the building as disabled.
  const lockedRef = useRef<Set<string>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const current = level.residents[qIdx]
  const busy = advancing || done
  // The building of every neighbour already placed, for the comparisons.
  const homes: Record<string, BuildingDef | undefined> = {}
  for (const r of level.residents.slice(0, qIdx)) homes[r.name] = level.buildings[r.home]
  const free = level.buildings.map((_, i) => i).filter((i) => named[i] === undefined)
  const cols = level.buildings.length === 4 ? 'grid-cols-2' : 'grid-cols-3'

  function tapBuilding(i: number, at: number) {
    if (busy || at - since < SETTLE_MS || named[i] !== undefined || tried.includes(i)) return
    const key = `${qIdx}|${i}`
    if (lockedRef.current.has(key)) return
    lockedRef.current.add(key)
    if (i === current.home) {
      setNamed((m) => ({ ...m, [i]: current.name }))
      setAdvancing(true)
      setHint({ text: `¡Eso es! ${current.name} vive ahí.`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((q) => q + 1)
          setTried([])
          setHint(null)
          setAdvancing(false)
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    const n = tried.length + 1
    setTried((t) => [...t, i])
    const failing = current.conds.find((c) => !fits(c, level.buildings[i], homes))
    setHint({
      text:
        n === 1
          ? `No es. Ese edificio no cumple con esto: «${failing ? say(failing) : ''}».`
          : n === 2
            ? `Tampoco. Quedan ${free.length - n} edificios sin probar: leé de nuevo lo que dice ${current.name}.`
            : `Queda uno solo que cumple todo lo que dice ${current.name}.`,
      ok: false,
    })
    onMistake()
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Vecino {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* What the neighbour says */}
          <div className="mx-auto mt-2 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-3 py-2 text-center">
            <p className="text-base font-semibold leading-snug text-slate-900">
              <span className="font-extrabold text-tiam-blue">{current.name} dice:</span> «{statement(current.conds)}»
            </p>
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.75rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? 'Tocá el edificio donde vive.'}
          </p>

          {/* The street */}
          <div role="group" aria-label="Edificios" className={`mx-auto grid max-w-md gap-1.5 ${cols}`}>
            {order.map((i) => {
              const bd = level.buildings[i]
              const owner = named[i]
              const isTried = tried.includes(i)
              const ringed = tried.length >= 3 && i === current.home
              return (
                <button
                  key={i}
                  type="button"
                  disabled={busy || owner !== undefined || isTried}
                  aria-label={`Edificio de color ${bd.wall}${owner ? `, de ${owner}` : ''}: ${describe(bd)}`}
                  onClick={(e) => tapBuilding(i, e.timeStamp)}
                  className={[
                    'relative flex min-h-[44px] flex-col items-center rounded-xl border-2 px-1 pb-1 pt-1 transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    owner !== undefined
                      ? 'border-tiam-green bg-tiam-green/10'
                      : isTried
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-40 grayscale'
                        : ringed
                          ? 'border-tiam-blue bg-white ring-2 ring-tiam-blue/50'
                          : 'border-slate-300 bg-white hover:border-tiam-blue/40 hover:shadow-md',
                  ].join(' ')}
                >
                  <Building bd={bd} className={level.buildings.length === 4 ? 'h-[96px] w-auto' : 'h-[78px] w-auto'} />
                  {/* the colour is written under the building; once it has a neighbour, its name takes that place */}
                  <span className={`text-base leading-tight ${owner !== undefined ? 'font-extrabold text-green-800' : 'font-semibold text-slate-600'}`}>{owner ?? bd.wall}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Ubicaste a los {total} vecinos. ¡Terminaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {level.residents.map((r) => (
              <li key={r.name} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{r.name}</span>
                  <span className="text-slate-500"> — {statement(r.conds).replace('Vivo en un edificio que', 'edificio que')}</span>
                </span>
              </li>
            ))}
          </ul>
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

export function QuienViveAca({ onComplete }: GameProps) {
  // The order of the buildings of each level on the street — decided once, at mount, so "Repetir" replays exactly the
  // same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_NEIGHBOURS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Los vecinos de la cuadra</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      order={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
