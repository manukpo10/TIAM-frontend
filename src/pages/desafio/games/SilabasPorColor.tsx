import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Sílabas por color" — día 15, mes 6, atención. A table of syllables, each one in a coloured square, and a strip of
 * coloured squares that spells a word: for every square of the strip the player finds the same square in the table
 * and taps it, and the syllables that were tapped, in order, make the word. The mechanic comes from a worksheet with a
 * table of syllables on coloured cells and strips of colours that are read as words; the syllables, the words and the
 * table are TIAM's own.
 *
 * ORIGINAL CONTENT. Only the idea is borrowed. A throwaway script (not committed) checks that none of the worksheet's
 * words is here, that the syllables of a table are all different (so a syllable marks exactly one square), that every
 * word is made of the syllables of its table and that no word of the day repeats a word of an earlier game of the month.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. Every square has its own colour AND its own shape (círculo, estrella, luna…),
 * drawn on the square of the table and on the matching square of the strip, so a player who cannot tell two blues
 * apart can follow the shape. The colours of a level are all different, and so are its shapes. After a miss the hint
 * names the colour and the shape.
 *
 * HOW IT DIFFERS FROM "Forma y color" (month 5, día 6), a double-entry table where a shape and a colour pointed at the
 * crossing: here there is no crossing and no hidden letter; each square of the strip is a whole square of the table
 * (colour and shape together), the squares of the table carry the syllable you read, and what comes out is a word you
 * can read as it grows. The ramp is the size of the table and the length of the words: 3×3 and words of two or three
 * syllables, 4×3 and three syllables, 4×4 with words of four syllables and look-alike colours (two blues, two greens,
 * two pinks) where the shape is what tells them apart.
 *
 * A wrong square costs ONE mistake, flashes muted gray (never red) and turns on a scaffold: first a nudge, then the
 * colour and the shape, then a ring around the right square. Nothing is timed but a short pause so a finished word is
 * seen. THREE WORDS A LEVEL, as the tallerista likes the days short. The position of the squares in each table and the
 * order of the words are chosen ONCE at mount (`epoch`), so "Repetir" replays exactly the same nine words.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is
 * ignored, and so is a second tap on the same square within the same window (a syllable can be needed twice in a
 * row, and the second tap of a double tap must not be taken for it).
 *
 * totalAttempts = mistakes + every square of every strip of the day (TOTAL_SQUARES, derived).
 */

// ── data:start ──
type ColorId =
  | 'rojo' | 'naranja' | 'amarillo' | 'lima' | 'verde' | 'turquesa' | 'celeste' | 'azul'
  | 'violeta' | 'lila' | 'rosa' | 'marron' | 'gris' | 'crema' | 'mostaza' | 'menta'
type ShapeId =
  | 'circulo' | 'cuadrado' | 'triangulo' | 'rombo' | 'estrella' | 'corazon' | 'hexagono' | 'cruz'
  | 'luna' | 'gota' | 'flecha' | 'anillo' | 'pentagono' | 'rayo' | 'semicirculo' | 'equis'

// Light fills: the dark text on them is far above 4.5:1.
const COLORS: Record<ColorId, { label: string; hex: string }> = {
  rojo: { label: 'rojo', hex: '#F28B82' },
  naranja: { label: 'naranja', hex: '#F8B26A' },
  amarillo: { label: 'amarillo', hex: '#F7DC6F' },
  lima: { label: 'verde lima', hex: '#C6E27A' },
  verde: { label: 'verde', hex: '#8FD18F' },
  turquesa: { label: 'turquesa', hex: '#7FD9C9' },
  celeste: { label: 'celeste', hex: '#9ED5F5' },
  azul: { label: 'azul', hex: '#86A8F2' },
  violeta: { label: 'violeta', hex: '#BBA0EE' },
  lila: { label: 'lila', hex: '#DDB6F0' },
  rosa: { label: 'rosa', hex: '#F7B2CB' },
  marron: { label: 'marrón', hex: '#CDA57F' },
  gris: { label: 'gris', hex: '#CFD4DA' },
  crema: { label: 'crema', hex: '#F3E6C4' },
  mostaza: { label: 'mostaza', hex: '#E3C25A' },
  menta: { label: 'menta', hex: '#B8EBD0' },
}

// Paths on a 24×24 square.
const SHAPES: Record<ShapeId, { label: string; d: string }> = {
  circulo: { label: 'círculo', d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  cuadrado: { label: 'cuadrado', d: 'M4 4h16v16H4z' },
  triangulo: { label: 'triángulo', d: 'M12 3 22 20H2z' },
  rombo: { label: 'rombo', d: 'M12 2 21 12 12 22 3 12z' },
  estrella: { label: 'estrella', d: 'M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.4 5.9 20.9l1.5-6.8L2.2 9.5l6.9-.7z' },
  corazon: { label: 'corazón', d: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z' },
  hexagono: { label: 'hexágono', d: 'M12 2 21 7v10l-9 5-9-5V7z' },
  cruz: { label: 'cruz', d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' },
  luna: { label: 'luna', d: 'M20 14.5A9 9 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z' },
  gota: { label: 'gota', d: 'M12 2.5c4 5 7 8 7 11.5a7 7 0 0 1-14 0c0-3.5 3-6.5 7-11.5z' },
  flecha: { label: 'flecha', d: 'M3 10h11V5l7 7-7 7v-5H3z' },
  anillo: { label: 'anillo', d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z' },
  pentagono: { label: 'pentágono', d: 'M12 2 22 9.5 18 21H6L2 9.5z' },
  rayo: { label: 'rayo', d: 'M13 2 4 14h6l-1 8 9-12h-6z' },
  semicirculo: { label: 'medio círculo', d: 'M3 17a9 9 0 0 1 18 0z' },
  equis: { label: 'equis', d: 'M5 3l7 7 7-7 2 2-7 7 7 7-2 2-7-7-7 7-2-2 7-7-7-7z' },
}

interface CellDef {
  syl: string
  color: ColorId
  shape: ShapeId
}
interface WordDef {
  /** Plain capital letters (A-Z, no accent). */
  word: string
  /** The word as it is written, with its accent. */
  display: string
  syllables: string[]
}
interface LevelDef {
  name: string
  cols: number
  /** cols × rows squares, every syllable, colour and shape different. */
  cells: CellDef[]
  words: WordDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    cols: 3,
    cells: [
      { syl: 'PA', color: 'rojo', shape: 'circulo' },
      { syl: 'NA', color: 'amarillo', shape: 'estrella' },
      { syl: 'MA', color: 'verde', shape: 'cuadrado' },
      { syl: 'PU', color: 'celeste', shape: 'triangulo' },
      { syl: 'MAN', color: 'violeta', shape: 'corazon' },
      { syl: 'ZA', color: 'naranja', shape: 'rombo' },
      { syl: 'SI', color: 'marron', shape: 'luna' },
      { syl: 'TO', color: 'gris', shape: 'hexagono' },
      { syl: 'RE', color: 'rosa', shape: 'cruz' },
    ],
    words: [
      { word: 'PAPA', display: 'papa', syllables: ['PA', 'PA'] },
      { word: 'PUMA', display: 'puma', syllables: ['PU', 'MA'] },
      { word: 'MANZANA', display: 'manzana', syllables: ['MAN', 'ZA', 'NA'] },
    ],
  },
  {
    name: 'Nivel 2',
    cols: 4,
    cells: [
      { syl: 'LI', color: 'rojo', shape: 'estrella' },
      { syl: 'TA', color: 'naranja', shape: 'cuadrado' },
      { syl: 'BA', color: 'amarillo', shape: 'gota' },
      { syl: 'VE', color: 'verde', shape: 'circulo' },
      { syl: 'BRE', color: 'turquesa', shape: 'triangulo' },
      { syl: 'RE', color: 'celeste', shape: 'corazon' },
      { syl: 'ES', color: 'azul', shape: 'rombo' },
      { syl: 'CO', color: 'violeta', shape: 'flecha' },
      { syl: 'MU', color: 'rosa', shape: 'luna' },
      { syl: 'SO', color: 'marron', shape: 'anillo' },
      { syl: 'DA', color: 'gris', shape: 'hexagono' },
      { syl: 'PI', color: 'crema', shape: 'cruz' },
    ],
    words: [
      { word: 'LIBRETA', display: 'libreta', syllables: ['LI', 'BRE', 'TA'] },
      { word: 'VEREDA', display: 'vereda', syllables: ['VE', 'RE', 'DA'] },
      { word: 'ESCOBA', display: 'escoba', syllables: ['ES', 'CO', 'BA'] },
    ],
  },
  {
    name: 'Nivel 3',
    cols: 4,
    cells: [
      { syl: 'TE', color: 'celeste', shape: 'estrella' },
      { syl: 'LE', color: 'azul', shape: 'circulo' },
      { syl: 'FO', color: 'verde', shape: 'cuadrado' },
      { syl: 'NO', color: 'lima', shape: 'triangulo' },
      { syl: 'CHO', color: 'rosa', shape: 'corazon' },
      { syl: 'CO', color: 'rojo', shape: 'rombo' },
      { syl: 'LA', color: 'violeta', shape: 'luna' },
      { syl: 'PA', color: 'lila', shape: 'hexagono' },
      { syl: 'PE', color: 'amarillo', shape: 'cruz' },
      { syl: 'RA', color: 'mostaza', shape: 'gota' },
      { syl: 'DU', color: 'turquesa', shape: 'flecha' },
      { syl: 'SI', color: 'menta', shape: 'anillo' },
      { syl: 'BE', color: 'naranja', shape: 'pentagono' },
      { syl: 'TU', color: 'marron', shape: 'rayo' },
      { syl: 'RI', color: 'gris', shape: 'semicirculo' },
      { syl: 'MA', color: 'crema', shape: 'equis' },
    ],
    words: [
      { word: 'TELEFONO', display: 'teléfono', syllables: ['TE', 'LE', 'FO', 'NO'] },
      { word: 'CHOCOLATE', display: 'chocolate', syllables: ['CHO', 'CO', 'LA', 'TE'] },
      { word: 'PAPELERA', display: 'papelera', syllables: ['PA', 'PE', 'LE', 'RA'] },
    ],
  },
]
const TOTAL_SQUARES = LEVELS.reduce((sum, lvl) => sum + lvl.words.reduce((s, w) => s + w.syllables.length, 0), 0)

/** The words of the how-to screen: they are not in the game. */
const EXAMPLE: CellDef[] = [
  { syl: 'GU', color: 'rojo', shape: 'circulo' },
  { syl: 'SA', color: 'celeste', shape: 'estrella' },
  { syl: 'NO', color: 'verde', shape: 'cuadrado' },
]
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

interface LevelEpoch {
  cells: CellDef[]
  words: WordDef[]
}
/** The position of the squares of every table and the order of its words: decided ONCE, at mount. */
function buildEpoch(): LevelEpoch[] {
  return LEVELS.map((lvl) => ({ cells: shuffle(lvl.cells), words: shuffle(lvl.words) }))
}

/** The hint after a wrong square: it grows with every miss on the same square of the strip. */
function missHint(cell: CellDef, misses: number): string {
  if (misses === 1) return 'Ese no. Fijate bien en el color y en la forma del cuadradito de arriba.'
  if (misses === 2) return `No es. Buscá el cuadrado ${COLORS[cell.color].label}, con forma de ${SHAPES[cell.shape].label}.`
  return 'Ese no. Te marcamos el cuadrado que buscás con un aro.'
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Qué buen ojo!', '¡Así se hace!', '¡Perfecto!']
/** The pause after a finished word, with it on screen, before the next one. */
const ADVANCE_MS = 1100
/** A tap this soon after the tap that brought the level is the second tap of a double tap and must not land. */
const SETTLE_MS = 400

function ShapeIcon({ shape, className }: { shape: ShapeId; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={SHAPES[shape].d} fill="#1e293b" fillOpacity="0.85" fillRule="evenodd" />
    </svg>
  )
}

/** The little square of the strip: a colour and its shape. */
function Swatch({ cell, active }: { cell: CellDef; active: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${COLORS[cell.color].label}, ${SHAPES[cell.shape].label}`}
      className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${active ? 'border-tiam-blue ring-2 ring-tiam-blue/40' : 'border-slate-400/60'}`}
      style={{ backgroundColor: COLORS[cell.color].hex }}
    >
      <ShapeIcon shape={cell.shape} className="h-7 w-7" />
    </span>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Arriba hay una tira de cuadraditos de colores. Cada uno tiene su color y su forma.',
    'Buscá en la tabla el mismo cuadrado y tocalo: sale su sílaba. Los cuadraditos, en orden, arman una palabra.',
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
        <div className="mt-2 flex justify-center gap-2">
          {EXAMPLE.map((c) => (
            <div key={c.syl} className="flex flex-col items-center gap-1">
              <Swatch cell={c} active={false} />
              <span className="flex h-9 w-12 items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-lg font-extrabold text-slate-900">
                {c.syl}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-lg font-bold text-slate-900">Gu + sa + no = gusano</p>
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
  epoch: LevelEpoch
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, epoch, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = epoch.words.length

  const [wordIdx, setWordIdx] = useState(0)
  // The squares of the strip already found, for the word on screen.
  const [slot, setSlot] = useState(0)
  const [misses, setMisses] = useState(0)
  const [flash, setFlash] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const lastTapRef = useRef({ i: -1, at: -Infinity })
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

  const word = epoch.words[wordIdx]
  const cellOf = (syl: string) => epoch.cells.find((c) => c.syl === syl) ?? epoch.cells[0]
  const wordFull = slot === word.syllables.length
  const target = wordFull ? null : cellOf(word.syllables[slot])
  const showRing = misses >= 3 && target !== null

  function tapCell(i: number, at: number) {
    if (advancing || done || wordFull || at - since < SETTLE_MS) return
    const last = lastTapRef.current
    if (last.i === i && at - last.at < SETTLE_MS) return
    lastTapRef.current = { i, at }
    const cell = epoch.cells[i]
    if (target && cell.syl === target.syl) {
      const nextSlot = slot + 1
      setSlot(nextSlot)
      setMisses(0)
      setFlash(null)
      setHint(null)
      if (nextSlot === word.syllables.length) {
        setAdvancing(true)
        timersRef.current.push(
          window.setTimeout(() => {
            if (wordIdx < total - 1) {
              setWordIdx((w) => w + 1)
              setSlot(0)
              setAdvancing(false)
            } else {
              setPraise(pickOne(PRAISE))
              setDone(true)
              onSolved()
            }
          }, ADVANCE_MS),
        )
      }
      return
    }
    const n = misses + 1
    setMisses(n)
    setFlash(i)
    setHint(target ? missHint(target, n) : null)
    timersRef.current.push(window.setTimeout(() => setFlash((f) => (f === i ? null : f)), 600))
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
            Palabra {wordIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The strip: a coloured square per syllable, and under each one the syllable once it is found */}
          <div className="mx-auto mt-2 max-w-md rounded-2xl border-2 border-tiam-blue bg-tiam-blue/5 px-3 py-2">
            <div className="flex justify-center gap-2">
              {word.syllables.map((syl, k) => {
                const c = cellOf(syl)
                const found = k < slot
                return (
                  <div key={k} className="flex flex-col items-center gap-1">
                    <Swatch cell={c} active={k === slot && !advancing} />
                    <span
                      className={[
                        'flex h-9 min-w-12 items-center justify-center rounded-lg border-2 px-1 text-lg font-extrabold',
                        found ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : 'border-dashed border-slate-300 bg-white text-transparent',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {found ? syl : '·'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.75rem] max-w-md text-center leading-snug ${wordFull ? 'text-lg font-bold text-green-700' : 'text-base font-medium text-slate-500'}`}
          >
            {wordFull
              ? `¡Eso es! «${word.display}».`
              : (hint ?? (slot === 0 && misses === 0 ? 'Buscá en la tabla el cuadrado marcado en la tira.' : ''))}
          </p>

          {/* The table */}
          <div
            role="group"
            aria-label="Tabla de sílabas"
            className="mx-auto grid max-w-md gap-1.5"
            style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
          >
            {epoch.cells.map((c, i) => {
              const isTarget = showRing && target !== null && c.syl === target.syl
              return (
                <button
                  key={c.syl}
                  type="button"
                  aria-label={`${c.syl}, ${COLORS[c.color].label}, ${SHAPES[c.shape].label}`}
                  onClick={(e) => tapCell(i, e.timeStamp)}
                  className={[
                    'relative flex min-h-[50px] items-center justify-center rounded-xl border-2 text-xl font-extrabold text-slate-900 transition',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                    flash === i ? 'border-slate-300 opacity-40' : 'border-slate-400/60 active:brightness-95',
                    isTarget ? 'ring-4 ring-tiam-blue' : '',
                  ].join(' ')}
                  style={{ backgroundColor: COLORS[c.color].hex }}
                >
                  <span className="absolute left-1 top-0.5">
                    <ShapeIcon shape={c.shape} className="h-3.5 w-3.5" />
                  </span>
                  <span className="pt-3">{c.syl}</span>
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
          <p className="mt-1 text-slate-600">Armaste las {total} palabras. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {epoch.words.map((w) => (
              <li key={w.word} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span className="font-bold text-slate-900">{w.display}</span>
                <span className="text-slate-500">({w.syllables.join(' · ').toLowerCase()})</span>
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

export function SilabasPorColor({ onComplete }: GameProps) {
  // The position of the squares and the order of the words — decided once, at mount, so "Repetir" replays the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_SQUARES })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Palabras de colores</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      epoch={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
