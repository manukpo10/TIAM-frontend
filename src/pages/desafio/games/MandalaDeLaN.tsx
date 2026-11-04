import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Mándala de la N" — día 18, mes 6, lenguaje. A mandala drawn in SVG: a ring (or two) of segments, each with a word, and a
 * palette of "paints". Every word has a pair of letters in it (a N followed by F, V, C or CH, and in level 3 also an M
 * followed by B or P). The player picks the paint that names that pair (NF, NV, NC, NCH, MB, MP) and taps the word to
 * paint its segment. The mechanic comes from a spelling-mandala worksheet where each word is coloured according to the
 * letter that follows the N; the words, the number of segments, the layout and the paints (colour, pattern and name)
 * are TIAM's own.
 *
 * ORIGINAL CONTENT. Only the idea is borrowed. A throwaway script (not committed) rejects every word of the worksheet
 * (and the words of the earlier word games of the month), checks that each word of the game has EXACTLY ONE of the
 * pairs of its level (so a word has a single right paint) and that "NC" is never read inside "NCH".
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. Every paint has a colour, a PATTERN (stripes, dots, grid, horizontal lines, vertical
 * lines, waves) and its NAME (NF, NV…), the palette buttons show all three, a painted segment keeps its pattern, and the
 * pair that was found is written in bold and underlined inside the word. A player who cannot tell two colours apart
 * can read the name or follow the pattern.
 *
 * ONE PAINT AT A TIME: tap a paint (it stays chosen), then tap words. A word painted with the wrong paint costs ONE
 * mistake, flashes muted gray (never red) and stays unpainted; the hint grows with the misses on the same word: a nudge,
 * then the pair itself. Tapping a word with no paint chosen is not a mistake, it just asks to choose one. Nothing is
 * timed. The level ends when every segment is painted.
 *
 * THE MANDALA FITS A PHONE: the words are 20 units tall in a 320-unit drawing (16 px on the narrowest phone) and are
 * short enough for their segment. Ramp: 4 words in one ring and two pairs (NF, NV); 6 words in one ring and four pairs
 * (NF, NV, NC, NCH); 8 words in two rings and six pairs (the four above plus MB and MP). Every level has ONE authored
 * set and the position of the words in the rings is chosen ONCE at mount (`epoch`), so "Repetir" replays exactly the
 * same eighteen words.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored and a
 * painted segment cannot be painted again.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
type RuleId = 'nf' | 'nv' | 'nc' | 'nch' | 'mb' | 'mp'
type PatternId = 'rayas' | 'puntos' | 'cuadricula' | 'horizontales' | 'verticales' | 'ondas'

const RULES: Record<RuleId, { label: string; long: string; fill: string; pattern: PatternId }> = {
  nf: { label: 'NF', long: 'La N seguida de la F', fill: '#F4A6A0', pattern: 'rayas' },
  nv: { label: 'NV', long: 'La N seguida de la V', fill: '#9EC8F5', pattern: 'puntos' },
  nc: { label: 'NC', long: 'La N seguida de la C', fill: '#A7DDA2', pattern: 'cuadricula' },
  nch: { label: 'NCH', long: 'La N seguida de CH', fill: '#CDB5F0', pattern: 'horizontales' },
  mb: { label: 'MB', long: 'La M seguida de la B', fill: '#F9CB8B', pattern: 'verticales' },
  mp: { label: 'MP', long: 'La M seguida de la P', fill: '#F6B3D2', pattern: 'ondas' },
}

interface WordDef {
  word: string
  rule: RuleId
  /** Which ring of the mandala it sits in (0 = the inner one). */
  ring: number
}
interface RingDef {
  count: number
  r0: number
  r1: number
  /** Where the word goes inside its segment: (dx, dy) from the centre for four segments, a radius for six. */
  dx?: number
  dy?: number
  r?: number
}
interface LevelDef {
  name: string
  /** What is written in the middle. */
  centre: string
  rules: RuleId[]
  rings: RingDef[]
  words: WordDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    centre: 'N',
    rules: ['nf', 'nv'],
    rings: [{ count: 4, r0: 42, r1: 152, dx: 68, dy: 70 }],
    words: [
      { word: 'inflar', rule: 'nf', ring: 0 },
      { word: 'confite', rule: 'nf', ring: 0 },
      { word: 'envío', rule: 'nv', ring: 0 },
      { word: 'inventar', rule: 'nv', ring: 0 },
    ],
  },
  {
    name: 'Nivel 2',
    centre: 'N',
    rules: ['nf', 'nv', 'nc', 'nch'],
    rings: [{ count: 6, r0: 42, r1: 152, r: 104 }],
    words: [
      { word: 'enfriar', rule: 'nf', ring: 0 },
      { word: 'infante', rule: 'nf', ring: 0 },
      { word: 'enviar', rule: 'nv', ring: 0 },
      { word: 'invento', rule: 'nv', ring: 0 },
      { word: 'pincel', rule: 'nc', ring: 0 },
      { word: 'lancha', rule: 'nch', ring: 0 },
    ],
  },
  {
    name: 'Nivel 3',
    centre: 'N y M',
    rules: ['nf', 'nv', 'nc', 'nch', 'mb', 'mp'],
    rings: [
      { count: 4, r0: 42, r1: 98, dx: 42, dy: 52 },
      { count: 4, r0: 98, r1: 152, dx: 56, dy: 104 },
    ],
    words: [
      { word: 'hombre', rule: 'mb', ring: 0 },
      { word: 'pancho', rule: 'nch', ring: 0 },
      { word: 'campo', rule: 'mp', ring: 0 },
      { word: 'ancla', rule: 'nc', ring: 0 },
      { word: 'enfermo', rule: 'nf', ring: 1 },
      { word: 'convivir', rule: 'nv', ring: 1 },
      { word: 'empanada', rule: 'mp', ring: 1 },
      { word: 'tambor', rule: 'mb', ring: 1 },
    ],
  },
]
const TOTAL_WORDS = LEVELS.reduce((sum, lvl) => sum + lvl.words.length, 0)

const plain = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** The pairs that can be found in a word, "nch" before "nc" so a CH is never read as a C. */
const PAIRS: { rule: RuleId; text: string }[] = [
  { rule: 'nch', text: 'nch' },
  { rule: 'nf', text: 'nf' },
  { rule: 'nv', text: 'nv' },
  { rule: 'nc', text: 'nc' },
  { rule: 'mb', text: 'mb' },
  { rule: 'mp', text: 'mp' },
]
/** Where the pair of a word sits: its position and its letters (an "NC" that is really "NCH" does not count as NC). */
function pairIn(word: string): { rule: RuleId; at: number; len: number }[] {
  const w = plain(word)
  const found: { rule: RuleId; at: number; len: number }[] = []
  for (const p of PAIRS) {
    let from = 0
    for (;;) {
      const at = w.indexOf(p.text, from)
      if (at < 0) break
      if (!(p.rule === 'nc' && w.slice(at, at + 3) === 'nch')) found.push({ rule: p.rule, at, len: p.text.length })
      from = at + 1
    }
  }
  return found
}

/** The example of the how-to screen: it is not in the game. */
const EXAMPLE = { word: 'infantil', rule: 'nf' as RuleId }
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

interface Slot {
  word: WordDef
  ring: number
  k: number
}
/** Which word sits in which segment of every level: decided ONCE, at mount (the words of a ring are mixed). */
function buildEpoch(): Slot[][] {
  return LEVELS.map((lvl) =>
    lvl.rings.flatMap((_, ring) => shuffle(lvl.words.filter((w) => w.ring === ring)).map((word, k) => ({ word, ring, k }))),
  )
}

const PRAISES = ['¡Muy bien!', '¡Excelente!', '¡Qué buen ojo para las letras!', '¡Así se hace!', '¡Perfecto!']
const PRAISE_FALLBACK = PRAISES[0]
/** The pause after the last word, with it painted, before the result card. */
const ADVANCE_MS = 1200
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a double tap. */
const SETTLE_MS = 400

const CX = 160
const CY = 160
function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)]
}
function sectorPath(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r1, a0)
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r0, a1)
  const [x3, y3] = polar(r0, a0)
  return `M${x3.toFixed(1)} ${y3.toFixed(1)}L${x0.toFixed(1)} ${y0.toFixed(1)}A${r1} ${r1} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r0} ${r0} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`
}
function labelAt(ring: RingDef, k: number): [number, number] {
  if (ring.count === 4) {
    const sx = k === 0 || k === 1 ? 1 : -1
    const sy = k === 0 || k === 3 ? -1 : 1
    return [CX + sx * (ring.dx ?? 0), CY + sy * (ring.dy ?? 0)]
  }
  return polar(ring.r ?? 100, (360 / ring.count) * k + 360 / ring.count / 2)
}

/** The fill a paint puts on a segment: its colour with a pattern over it. */
function PaintDefs() {
  const ink = '#1e293b'
  return (
    <defs>
      {(Object.keys(RULES) as RuleId[]).map((id) => {
        const { fill, pattern } = RULES[id]
        const bg = <rect width="10" height="10" fill={fill} />
        let mark
        switch (pattern) {
          case 'rayas':
            mark = <path d="M-2 2l4-4M0 10l10-10M8 12l4-4" stroke={ink} strokeOpacity="0.45" strokeWidth="1.6" />
            break
          case 'puntos':
            mark = <circle cx="5" cy="5" r="1.7" fill={ink} fillOpacity="0.5" />
            break
          case 'cuadricula':
            mark = <path d="M0 0h10M0 0v10" stroke={ink} strokeOpacity="0.4" strokeWidth="1.4" fill="none" />
            break
          case 'horizontales':
            mark = <path d="M0 3h10M0 8h10" stroke={ink} strokeOpacity="0.4" strokeWidth="1.5" />
            break
          case 'verticales':
            mark = <path d="M3 0v10M8 0v10" stroke={ink} strokeOpacity="0.4" strokeWidth="1.5" />
            break
          default:
            mark = <path d="M0 5q2.5-4 5 0t5 0" stroke={ink} strokeOpacity="0.45" strokeWidth="1.5" fill="none" />
        }
        return (
          <pattern key={id} id={`pat-${id}`} width="10" height="10" patternUnits="userSpaceOnUse">
            {bg}
            {mark}
          </pattern>
        )
      })}
    </defs>
  )
}

/** A little square with a paint's colour and pattern (for the palette and the examples). It needs <PaintDefs/> on the page. */
function Swatch({ rule, size = 28 }: { rule: RuleId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" className="shrink-0 rounded-md border border-slate-400/60">
      <rect width="10" height="10" fill={`url(#pat-${rule})`} />
    </svg>
  )
}

/** A word with its pair of letters written in bold and underlined (inside the SVG text). */
function WordText({ word, rule }: { word: string; rule: RuleId | null }) {
  const hit = rule ? pairIn(word).find((p) => p.rule === rule) : undefined
  if (!hit) return <>{word}</>
  return (
    <>
      {word.slice(0, hit.at)}
      <tspan fontWeight={900} textDecoration="underline">
        {word.slice(hit.at, hit.at + hit.len)}
      </tspan>
      {word.slice(hit.at + hit.len)}
    </>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Cada palabra del mándala tiene una N (o una M) seguida de otra letra. Mirá cuál es.',
    'Elegí el color que lleva ese nombre, por ejemplo NF, y tocá la palabra para pintarla.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <PaintDefs />
      </svg>
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
          En «i<span className="underline">nf</span>antil», después de la N viene la F.
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Swatch rule={EXAMPLE.rule} />
          <span className="text-xl font-extrabold text-slate-900">{RULES[EXAMPLE.rule].label}</span>
        </div>
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
  slots: Slot[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, slots, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = slots.length

  const [paint, setPaint] = useState<RuleId | null>(null)
  const [painted, setPainted] = useState<number[]>([])
  const [misses, setMisses] = useState<number[]>(() => slots.map(() => 0))
  const [flash, setFlash] = useState<number | null>(null)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE_FALLBACK)
  const timersRef = useRef<number[]>([])
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

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

  function tapWord(i: number, at: number) {
    if (done || painted.includes(i) || at - since < SETTLE_MS) return
    if (!paint) {
      setHint({ text: 'Primero elegí un color de arriba.', ok: false })
      return
    }
    const w = slots[i].word
    if (paint === w.rule) {
      const next = [...painted, i]
      setPainted(next)
      setHint({ text: `¡Eso es! «${w.word}» lleva ${RULES[w.rule].label}.`, ok: true })
      if (next.length === total) {
        timersRef.current.push(
          window.setTimeout(() => {
            setPraise(pickOne(PRAISES))
            setDone(true)
            onSolved()
          }, ADVANCE_MS),
        )
      }
      return
    }
    const n = misses[i] + 1
    setMisses((m) => m.map((x, j) => (j === i ? n : x)))
    setFlash(i)
    timersRef.current.push(window.setTimeout(() => setFlash((f) => (f === i ? null : f)), 600))
    setHint({
      text: n === 1 ? `Ese no va en «${w.word}». Fijate qué letra viene después de la N o de la M.` : `En «${w.word}» el par es ${RULES[w.rule].label}.`,
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
            Pintaste {painted.length} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The paints: colour + pattern + name */}
          <div
            role="group"
            aria-label="Colores"
            className={`mx-auto mt-2 grid max-w-md gap-1.5 ${level.rules.length === 2 ? 'grid-cols-2' : level.rules.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}
          >
            {level.rules.map((r) => {
              const chosen = paint === r
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={chosen}
                  aria-label={`${RULES[r].label}: ${RULES[r].long}`}
                  onClick={() => {
                    setPaint(r)
                    setHint(null)
                  }}
                  className={[
                    'flex items-center justify-center rounded-xl border-2 px-1 text-lg font-extrabold text-slate-900 transition',
                    level.rules.length === 4 ? 'min-h-[56px] flex-col gap-0.5 py-1' : 'min-h-[46px] gap-1.5',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                    chosen ? 'border-tiam-blue bg-tiam-blue/10 ring-2 ring-tiam-blue/40' : 'border-slate-300 bg-white hover:border-tiam-blue/40',
                  ].join(' ')}
                >
                  <Swatch rule={r} size={24} />
                  {RULES[r].label}
                </button>
              )
            })}
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.75rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? (paint ? `Pintá las palabras que llevan ${RULES[paint].label}.` : 'Elegí un color y tocá una palabra.')}
          </p>

          {/* The mandala */}
          <svg viewBox="0 0 320 320" className="mx-auto block w-full max-w-[340px]" role="group" aria-label="Mándala de palabras">
            <PaintDefs />
            <circle cx={CX} cy={CY} r={156} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
            {slots.map(({ word, ring, k }, i) => {
              const rd = level.rings[ring]
              const span = 360 / rd.count
              const isPainted = painted.includes(i)
              const [tx, ty] = labelAt(rd, k)
              return (
                <g
                  key={word.word}
                  role="button"
                  tabIndex={0}
                  aria-label={isPainted ? `${word.word}, pintada con ${RULES[word.rule].label}` : word.word}
                  onClick={(e) => tapWord(i, e.timeStamp)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      tapWord(i, e.timeStamp)
                    }
                  }}
                  className="cursor-pointer outline-hidden focus-visible:opacity-90"
                >
                  <path
                    d={sectorPath(rd.r0, rd.r1, k * span, (k + 1) * span)}
                    fill={isPainted ? `url(#pat-${word.rule})` : flash === i ? '#e2e8f0' : '#ffffff'}
                    stroke="#64748b"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="20"
                    fontWeight="700"
                    fill={flash === i ? '#64748b' : '#0f172a'}
                    stroke="#ffffff"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    <WordText word={word.word} rule={isPainted ? word.rule : null} />
                  </text>
                </g>
              )
            })}
            <circle cx={CX} cy={CY} r={38} fill="#ffffff" stroke="#1B6FC4" strokeWidth="3" />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize={level.centre.length > 1 ? 24 : 40} fontWeight="900" fill="#15436F">
              {level.centre}
            </text>
          </svg>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Pintaste las {total} palabras. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 text-left text-base text-slate-700">
            {slots.map(({ word }) => (
              <li key={word.word} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2">
                <Swatch rule={word.rule} size={20} />
                <span>
                  <span className="font-bold text-slate-900">{word.word}</span>
                  <span className="text-slate-500"> {RULES[word.rule].label}</span>
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
      {/* The patterns of the paints, for the swatches of the list above (the mandala has its own copy). */}
      {done && (
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <PaintDefs />
        </svg>
      )}
    </div>
  )
}

export function MandalaDeLaN({ onComplete }: GameProps) {
  // Which word sits in which segment — decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Pintá con ortografía</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      slots={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
