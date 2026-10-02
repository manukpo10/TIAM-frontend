import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Dale color a los números" — día 24, mes 5, cálculo. A number board (1–30, then
 * 1–60, then 1–100) and a list of clues that each describe ONE number by a
 * calculation: "Es el doble de 23", "Es la mitad de 90", "Es 15 más que 32", "Es el
 * número anterior a 40". One clue at a time, each with its own colour: work the
 * number out, find it on the board and tap it — it gets painted in that colour.
 * Mental arithmetic first, then finding the result on a chart.
 *
 * THE BOARD IS CHOPPED INTO SECTIONS OF 30. A 10-column hundred-chart cannot keep
 * 44px targets on a 375px phone (it would need 440px) and a 100-number board in
 * rows of six is taller than the screen. So the board is shown 30 numbers at a
 * time (5 rows of 6, or 6 rows of 5 on a narrow phone, always ≥44px tall and wide)
 * and a row of section buttons ("1–30", "31–60", …) picks the section. Level 1 is
 * exactly one section, so it has no buttons. Nothing scrolls and everything the
 * player needs stays on one screen; the painted numbers keep their colour when the
 * player moves between sections.
 *
 * Every number of the board is a candidate, so the near-miss decoys are built in:
 * the numbers around the answer (the "siguiente", the "anterior", +10 and −10, the
 * result of the other operation, the digits swapped) are all on the board, and the
 * clue sets are chosen so that two answers often sit side by side (45, 46 and 47).
 * Each clue has exactly ONE answer and the answers of a level are all different (a
 * painted number is never a candidate again). The clue sentence AND its value are
 * DERIVED from one object (`textOf`, `valueOf`), so the words on screen can never
 * drift from what is checked. A throwaway Node script (not committed) recomputed
 * every value with its own arithmetic, confirmed each is inside the board and
 * unique within its level, and listed the near-miss decoys of every clue.
 *
 * THE INKS ARE THE FAR-APART SIX of El color de la palabra (rojo, azul, verde,
 * negro, dorado, violeta): level 1 uses the four base inks, level 2 adds DORADO,
 * level 3 adds VIOLETA. Every ink is always shown with its NAME (on the clue and in
 * the recap), never by colour alone. A painted number is white on every ink but
 * dorado, which takes black text (white on #B8860B reaches only 3.3:1, black 6.4:1);
 * azul is a hair darker than in El color de la palabra so that its white text passes AA.
 *
 * A wrong tap greys out that number for this clue (muted, never red), says what
 * the number is and costs one mistake; from the second miss on the hint says
 * whether the answer is bigger or smaller and shows how to think the calculation.
 * The correct number is painted, says why, and after a short pause the next clue
 * comes (the only timer in the game; taps are ignored while it runs, so a quick
 * second tap can never be judged against the next clue). Taps are guarded against
 * the double tap on a wrong number, which counts ONE mistake.
 *
 * Ramp: 4 clues on 1–30 → 5 on 1–60 → 6 on 1–100. ONE set of clues per level: each
 * level has two authored sets and one is picked ONCE at mount (`epoch`), so
 * "Repetir" replays exactly the same three. Per-level state lives in <LevelView>,
 * keyed by run + level. A short "¿Cómo se juega?" screen (two steps and a small
 * example, its button pinned to the bottom edge) opens the day; "Repetir" never
 * brings it back. When a level is solved the board gives way to a recap of the
 * painted numbers, so the button stays on screen.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by
 * the click's own timeStamp) is ignored, so the second tap of a double tap on "Empezar",
 * "Siguiente nivel" or "Repetir" never paints the number (or opens the section) that
 * sits where that button was. A new level opens at its top, and so does every new clue
 * (on a 320x640 phone the clue sits above a board the player may have scrolled down
 * to reach), and the solved card is scrolled into view, and so is its button.
 *
 * totalAttempts = mistakes + every clue of the day (TOTAL_CLUES, derived).
 */

// ── data:start ──
type InkId = 'rojo' | 'azul' | 'verde' | 'negro' | 'dorado' | 'violeta'

// The six inks of ElColorDeLaPalabra (hex values and the CIEDE2000 numbers are documented there), with ONE change:
// azul is 2% darker (#1678D4 -> #1676D0). Here a painted number carries white text, and white on #1678D4 reaches
// 4.495:1, just under AA; on #1676D0 it reaches 4.63:1. The two blues differ by a CIEDE2000 of 0.8, which nobody can
// see, and the swatch, the clue border and the painted number all use this one value, so they stay identical.
const INKS: Record<InkId, { label: string; hex: string }> = {
  rojo: { label: 'Rojo', hex: '#D0021B' },
  azul: { label: 'Azul', hex: '#1676D0' },
  verde: { label: 'Verde', hex: '#05741C' },
  negro: { label: 'Negro', hex: '#000000' },
  dorado: { label: 'Dorado', hex: '#B8860B' },
  violeta: { label: 'Violeta', hex: '#7E0197' },
}

type Clue =
  | { kind: 'double'; n: number } // Es el doble de n
  | { kind: 'half'; n: number } // Es la mitad de n
  | { kind: 'triple'; n: number } // Es el triple de n
  | { kind: 'plus'; a: number; b: number } // Es b más que a
  | { kind: 'minus'; a: number; b: number } // Es b menos que a
  | { kind: 'before'; n: number } // Es el número anterior a n
  | { kind: 'after'; n: number } // Es el número siguiente a n
  | { kind: 'tens'; t: number; u: number } // Tiene t decenas y u unidades

/** The number a clue describes. */
function valueOf(clue: Clue): number {
  switch (clue.kind) {
    case 'double':
      return clue.n * 2
    case 'half':
      return clue.n / 2
    case 'triple':
      return clue.n * 3
    case 'plus':
      return clue.a + clue.b
    case 'minus':
      return clue.a - clue.b
    case 'before':
      return clue.n - 1
    case 'after':
      return clue.n + 1
    case 'tens':
      return clue.t * 10 + clue.u
  }
}

/** The sentence of a clue, as the player reads it. */
function textOf(clue: Clue): string {
  switch (clue.kind) {
    case 'double':
      return `Es el doble de ${clue.n}`
    case 'half':
      return `Es la mitad de ${clue.n}`
    case 'triple':
      return `Es el triple de ${clue.n}`
    case 'plus':
      return `Es ${clue.b} más que ${clue.a}`
    case 'minus':
      return `Es ${clue.b} menos que ${clue.a}`
    case 'before':
      return `Es el número anterior a ${clue.n}`
    case 'after':
      return `Es el número siguiente a ${clue.n}`
    case 'tens':
      return `Tiene ${clue.t} decena${clue.t === 1 ? '' : 's'} y ${clue.u} unidad${clue.u === 1 ? '' : 'es'}`
  }
}

/** How to think the calculation — shown after a second miss, never the answer itself. */
function helpOf(clue: Clue): string {
  switch (clue.kind) {
    case 'double':
      return `Pensalo así: ${clue.n} + ${clue.n}.`
    case 'half':
      return `Pensalo así: repartí ${clue.n} en 2 partes iguales.`
    case 'triple':
      return `Pensalo así: ${clue.n} + ${clue.n} + ${clue.n}.`
    case 'plus':
      return `Pensalo así: ${clue.a} + ${clue.b}.`
    case 'minus':
      return `Pensalo así: ${clue.a} − ${clue.b}.`
    case 'before':
      return `Pensalo así: el número que se dice justo antes de ${clue.n} al contar.`
    case 'after':
      return `Pensalo así: el número que se dice justo después de ${clue.n} al contar.`
    case 'tens':
      return `Pensalo así: ${clue.t} ${clue.t === 1 ? 'decena es' : 'decenas son'} ${clue.t * 10}, y sumale ${clue.u}.`
  }
}

interface LevelDef {
  name: string
  /** The board shows 1…max. */
  max: number
  /** One ink per clue, in order. */
  inks: InkId[]
  /** Authored sets of clues; every set of a level has as many clues as `inks`. */
  sets: Clue[][]
}

const BASE_INKS: InkId[] = ['rojo', 'azul', 'verde', 'negro']

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    max: 30,
    inks: BASE_INKS,
    sets: [
      [
        { kind: 'double', n: 9 },
        { kind: 'half', n: 30 },
        { kind: 'plus', a: 12, b: 8 },
        { kind: 'before', n: 25 },
      ],
      [
        { kind: 'double', n: 13 },
        { kind: 'half', n: 24 },
        { kind: 'minus', a: 30, b: 7 },
        { kind: 'tens', t: 1, u: 9 },
      ],
    ],
  },
  {
    name: 'Nivel 2',
    max: 60,
    inks: [...BASE_INKS, 'dorado'],
    sets: [
      [
        { kind: 'double', n: 23 },
        { kind: 'half', n: 90 },
        { kind: 'plus', a: 32, b: 15 },
        { kind: 'before', n: 40 },
        { kind: 'triple', n: 14 },
      ],
      [
        { kind: 'double', n: 27 },
        { kind: 'half', n: 76 },
        { kind: 'minus', a: 60, b: 18 },
        { kind: 'after', n: 49 },
        { kind: 'plus', a: 24, b: 17 },
      ],
    ],
  },
  {
    name: 'Nivel 3',
    max: 100,
    inks: [...BASE_INKS, 'dorado', 'violeta'],
    sets: [
      [
        { kind: 'double', n: 38 },
        { kind: 'half', n: 150 },
        { kind: 'triple', n: 27 },
        { kind: 'plus', a: 48, b: 36 },
        { kind: 'minus', a: 100, b: 23 },
        { kind: 'before', n: 90 },
      ],
      [
        { kind: 'double', n: 44 },
        { kind: 'half', n: 130 },
        { kind: 'triple', n: 21 },
        { kind: 'plus', a: 37, b: 29 },
        { kind: 'minus', a: 95, b: 27 },
        { kind: 'after', n: 79 },
      ],
    ],
  },
]

/** The board is shown this many numbers at a time. */
const SECTION_SIZE = 30

const TOTAL_CLUES = LEVELS.reduce((sum, lvl) => sum + lvl.sets[0].length, 0)

/** The numbers of one section of the board (0-based). */
function sectionNumbers(section: number, max: number): number[] {
  const from = section * SECTION_SIZE + 1
  const to = Math.min((section + 1) * SECTION_SIZE, max)
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface LevelContent {
  clues: Clue[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({ clues: pickOne(lvl.sets) }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena cabeza para los números!']
/** The pause after a right number before the next clue; taps are ignored while it runs. */
const ADVANCE_MS = 1300
/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel", "Repetir") is the
 * second tap of a double tap, and it must not act on the number or the section button that sits where that
 * button was. Long enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** The text colour that reads on a painted number: white on every ink but dorado, which is light enough that
 * white on it reaches only 3.3:1 (black reaches 6.4:1; the theme's slate-900 is a navy and only 4.7:1). Azul is
 * the next lightest: it is the nudged #1676D0 above, at 4.63:1 with white. */
const onInk = (ink: InkId) => (ink === 'dorado' ? 'text-black' : 'text-white')

function Swatch({ ink, size = 'h-6 w-6' }: { ink: InkId; size?: string }) {
  return (
    <span
      className={`${size} shrink-0 rounded-full border-2 border-white ring-1 ring-slate-300`}
      style={{ backgroundColor: INKS[ink].hex }}
      aria-hidden="true"
    />
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a small example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'Leé la pista y hacé la cuenta en tu cabeza.',
    'Buscá el resultado en el tablero (si hay varios tramos, elegí el tuyo arriba) y tocalo: se pinta del color que te piden.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-cyan-600/20 bg-cyan-600/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="flex items-center justify-center gap-2 text-base font-semibold text-slate-700">
          <Swatch ink="azul" size="h-5 w-5" /> <span className="uppercase">Azul</span>: es el doble de 5
        </p>
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
          {[9, 10, 11].map((n) => (
            <span
              key={n}
              className={[
                'flex h-10 w-10 items-center justify-center rounded-lg border-2 text-lg font-bold tabular-nums',
                n === 10 ? 'border-transparent text-white' : 'border-slate-200 text-slate-800',
              ].join(' ')}
              style={n === 10 ? { backgroundColor: INKS.azul.hex } : undefined}
            >
              {n}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-base text-slate-700">5 + 5 = 10: el 10 se pinta de azul.</p>
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
  const { clues } = content
  const total = clues.length
  const sectionCount = Math.ceil(level.max / SECTION_SIZE)

  const [step, setStep] = useState(0)
  // number -> ink, for every number painted so far.
  const [painted, setPainted] = useState<Record<number, InkId>>({})
  const [wrong, setWrong] = useState<number[]>([])
  const [section, setSection] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Numbers already tapped wrong for this clue: a double tap on the same number is
  // ONE tap, even when both land before React has repainted it as disabled.
  const tappedRef = useRef<Set<number>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone), and
  // so does every new clue: the clue sits above the board, and the player may have scrolled down to reach a low row.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [step])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const clue = clues[step]
  const ink = level.inks[step]
  const answer = valueOf(clue)
  const numbers = sectionNumbers(section, level.max)

  function handleTap(n: number, at: number) {
    // While the right number shows its paint (`advancing`) every number is off, which swallows a double tap
    // on the RIGHT one; this swallows the one that follows the button that brought the level.
    if (advancing || done || tappedRef.current.has(n) || painted[n] !== undefined || at - since < SETTLE_MS) return
    tappedRef.current.add(n)
    if (n === answer) {
      setPainted((p) => ({ ...p, [n]: ink }))
      setAdvancing(true)
      setHint({ text: `¡Eso es! El ${n} ${lowerFirst(textOf(clue))}.`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (step < total - 1) {
          setStep((s) => s + 1)
          setWrong([])
          setAdvancing(false)
          setHint(null)
          tappedRef.current = new Set()
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    const misses = wrong.length + 1
    setWrong((w) => [...w, n])
    onMistake()
    if (misses >= 2) {
      setHint({
        text: `El ${n} no es. El que buscás es ${answer > n ? 'más grande' : 'más chico'}. ${helpOf(clue)}`,
        ok: false,
      })
    } else {
      setHint({ text: `El ${n} no es. Hacé la cuenta con calma y probá con otro.`, ok: false })
    }
  }

  const recap = clues.map((c, i) => ({ n: valueOf(c), ink: level.inks[i], text: textOf(c) }))

  // On a short phone (the modal leaves 100dvh - 95px) the spacing tightens, the "Tramo del tablero" caption goes (the buttons
  // say it) and, on a narrow one (a 320px phone has 256px between the paddings), the section buttons share one row and the
  // board is six columns of 44px+ cells with 4px gaps, borrowing 16px of padding on each side (five columns would make it
  // 294px tall), so the clue, the sections, ALL the numbers of the board and the hint are on screen when a clue opens: a
  // player who does not see that the board goes on below the fold simply cannot answer. Every target stays 44px or more,
  // the text 16px or more. Taller phones keep the roomy layout.
  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Pista {step + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The clue: its colour, by swatch AND name, and the calculation */}
          <div
            className="mt-3 rounded-2xl border-2 bg-white px-4 py-3 text-center [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:py-2"
            style={{ borderColor: INKS[ink].hex }}
          >
            <p className="flex items-center justify-center gap-2 text-base font-semibold text-slate-700">
              Pintá de <Swatch ink={ink} /> <span className="font-bold uppercase text-slate-900">{INKS[ink].label}</span>
            </p>
            <h2 className="mt-1 text-balance text-2xl font-bold leading-snug text-slate-900 [@media(max-height:700px)]:text-xl">{textOf(clue)}</h2>
          </div>

          {sectionCount > 1 && (
            <div className="mt-3 [@media(max-height:700px)]:mt-2" role="group" aria-label="Tramos del tablero">
              <p className="text-center text-sm font-semibold text-slate-500 [@media(max-height:700px)]:hidden">Tramo del tablero</p>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5 [@media(max-height:700px)]:mt-0 [@media(max-height:700px)]:max-[374px]:-mx-2">
                {Array.from({ length: sectionCount }, (_, s) => {
                  const nums = sectionNumbers(s, level.max)
                  const selected = s === section
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={(e) => {
                        // The second tap of a double tap on the button that brought the level opens nothing.
                        if (e.timeStamp - since >= SETTLE_MS) setSection(s)
                      }}
                      aria-pressed={selected}
                      aria-label={`Números del ${nums[0]} al ${nums[nums.length - 1]}`}
                      className={[
                        'min-h-[44px] min-w-[64px] rounded-xl border-2 px-2 text-base font-bold tabular-nums transition [@media(max-height:700px)]:max-[374px]:min-w-[44px] [@media(max-height:700px)]:max-[374px]:px-1',
                        'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                        selected
                          ? 'border-cyan-700 bg-cyan-700 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-cyan-600/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      {nums[0]}–{nums[nums.length - 1]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* The board: 30 numbers at a time, 6 columns from a 358px phone up (5 below it), so every cell is at
              least 44px wide: 6 × 44 + 5 × 6 of gap = 294px of room, which a 360px phone has (296px). The minimum
              height is the room of a full section (6 rows of 5 / 5 rows of 6), so a short last section does not
              make the hint jump. On a short AND narrow phone (a 320x640 one) five columns would make the board 294px
              tall and push the hint off the screen, so it goes back to six: 4px gaps and 16px borrowed from the
              padding on each side (a 320px phone then has 288px: 6 × 44.7 + 5 × 4), 236px tall. */}
          <div
            className="mx-auto mt-3 grid max-w-sm grid-cols-5 content-start gap-1.5 min-h-[294px] min-[358px]:grid-cols-6 min-[358px]:min-h-[244px] [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:max-[357px]:-mx-4 [@media(max-height:700px)]:max-[357px]:grid-cols-6 [@media(max-height:700px)]:max-[357px]:gap-1 [@media(max-height:700px)]:max-[357px]:min-h-[236px]"
            role="group"
            aria-label={`Tablero del ${numbers[0]} al ${numbers[numbers.length - 1]}`}
          >
            {numbers.map((n) => {
              const paint = painted[n]
              const isWrong = wrong.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  disabled={paint !== undefined || isWrong || advancing}
                  onClick={(e) => handleTap(n, e.timeStamp)}
                  aria-label={paint ? `${n}, pintado de ${INKS[paint].label.toLowerCase()}` : `${n}`}
                  className={[
                    'flex h-11 items-center justify-center rounded-lg border-2 text-xl font-bold tabular-nums transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    paint
                      ? `border-transparent ${onInk(paint)}`
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-cyan-600/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                  style={paint ? { backgroundColor: INKS[paint].hex } : undefined}
                >
                  {n}
                </button>
              )
            })}
          </div>

          <p
            role="status"
            className={`mt-2 min-h-[3.5rem] text-center text-base font-medium [@media(max-height:700px)]:min-h-[3rem] ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>
        </>
      )}

      {/* Level complete: a recap of the painted numbers instead of the board */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Pintaste los {total} números. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Números que pintaste">
            {recap.map((r) => (
              <li
                key={r.n}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white py-1 pl-1.5 pr-3 text-base font-bold text-slate-800"
              >
                <span
                  className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-1 text-base font-bold tabular-nums ${onInk(r.ink)}`}
                  style={{ backgroundColor: INKS[r.ink].hex }}
                >
                  {r.n}
                </span>
                <span className="text-sm uppercase tracking-wide">{INKS[r.ink].label}</span>
                <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />
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

export function DaleColorALosNumeros({ onComplete }: GameProps) {
  // Which set of clues each level plays — decided once, at mount, so "Repetir"
  // replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_CLUES })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Pintá cada número</h2>
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
