import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Números revueltos" — día 16, mes 6, lenguaje. The letters of a number's NAME come mixed up: the player puts them in
 * order, with a clue about the number, and then, with the name built, taps the same number written in DIGITS among four
 * look-alikes. So every number is two small steps: words -> figures. The mechanic comes from a worksheet where the
 * names of numbers are written with their letters mixed up and the player writes the number; here the numbers, the
 * clues and the way of answering are TIAM's own (one number at a time, letters to tap, and the digits as a second step).
 *
 * ORIGINAL CONTENT. Only the idea is borrowed. A number's name is forced by the subject, but none of the numbers of the
 * worksheet is used here (a throwaway script, not committed, rejects them), and the clues are arithmetic written for
 * adults ("la mitad de 30", "1.000 menos 300"), not copied. Levels: three numbers between 10 and 20, three between
 * 20 and 30 and three of three figures. The script also checks that no OTHER number name from 0 to 999 can be made with
 * the same letters (a single solution), that every clue gives exactly the number, that the four options of the digits
 * step are different and that the number is never the answer of an earlier word game of the month.
 *
 * CLUES, NOT A BLIND GUESS: each number has a clue and one box per letter. A wrong name costs ONE mistake (a double tap
 * on "Listo" cannot count twice: the first tap empties the boxes and "Listo" is off until they fill again), puts the
 * letters back and the clue grows with the misses on the same number: a second clue, then the first letters, then the
 * name itself. The wrong figure of the second step costs one mistake and is muted gray (never red); it stays off and
 * the right one can still be tapped. Nothing is timed.
 *
 * Level 3 is harder for real: levels 1 and 2 give ONE operation (6 por 2, 30 menos 7) and level 3 gives TWO steps (100 por 4,
 * más 100; 800 menos la mitad de 200; 3 por 250, más 150), the names are long and the wrong figures are the typical
 * slips (a zero too many or too few, the digits swapped).
 *
 * Only one number is on screen at a time (its clue, its boxes and its letters), so everything the step needs and its
 * buttons are in view on a short phone, and the button bar sticks to the bottom of the card. The order of the letters
 * and of the figures is chosen ONCE at mount (`epoch`), so "Repetir" replays exactly the same nine numbers.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that changed the screen is ignored, and a
 * letter cannot be placed twice.
 *
 * totalAttempts = mistakes + two steps for every number of the day (TOTAL_STEPS, derived).
 */

// ── data:start ──
interface NumberDef {
  value: number
  /** Plain capital letters (A-Z, no accent): what the tiles can write. */
  word: string
  /** The name as it is written, with its accent. */
  display: string
  /** About the number. It never says the name. */
  clue: string
  /** A second clue, for after the first miss. */
  tip: string
  /** The look-alike figures of the second step. */
  wrong: [number, number, number]
}
interface LevelDef {
  name: string
  numbers: NumberDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    numbers: [
      { value: 12, word: 'DOCE', display: 'doce', clue: 'Un número entre 10 y 20: 6 por 2.', tip: 'Son las horas de media jornada en el reloj.', wrong: [21, 11, 10] },
      { value: 13, word: 'TRECE', display: 'trece', clue: 'Un número entre 10 y 20: 10 más 3.', tip: 'Mucha gente cree que trae mala suerte.', wrong: [31, 33, 14] },
      { value: 15, word: 'QUINCE', display: 'quince', clue: 'Un número entre 10 y 20: la mitad de 30.', tip: 'Es la cantidad de años que se festeja con un baile especial.', wrong: [51, 35, 16] },
    ],
  },
  {
    name: 'Nivel 2',
    numbers: [
      { value: 23, word: 'VEINTITRES', display: 'veintitrés', clue: 'Un número entre 20 y 30: 30 menos 7.', tip: 'Tiene diez letras y arranca con «veinti».', wrong: [32, 22, 33] },
      { value: 25, word: 'VEINTICINCO', display: 'veinticinco', clue: 'Un número entre 20 y 30: el resultado de 5 por 5.', tip: 'Es la mitad de 50.', wrong: [52, 35, 24] },
      { value: 28, word: 'VEINTIOCHO', display: 'veintiocho', clue: 'Un número entre 20 y 30: 4 por 7.', tip: 'Es la cantidad de días que tiene febrero en un año común.', wrong: [82, 38, 27] },
    ],
  },
  {
    name: 'Nivel 3',
    numbers: [
      { value: 500, word: 'QUINIENTOS', display: 'quinientos', clue: 'Un número de tres cifras: 100 por 4, más 100.', tip: 'Es la mitad de 1.000.', wrong: [50, 505, 550] },
      { value: 700, word: 'SETECIENTOS', display: 'setecientos', clue: 'Un número de tres cifras: 800 menos la mitad de 200.', tip: 'Es 7 por 100.', wrong: [70, 707, 770] },
      { value: 900, word: 'NOVECIENTOS', display: 'novecientos', clue: 'Un número de tres cifras: 3 por 250, más 150.', tip: 'Es 9 por 100.', wrong: [90, 909, 990] },
    ],
  },
]
const TOTAL_NUMBERS = LEVELS.reduce((sum, lvl) => sum + lvl.numbers.length, 0)
/** Two steps for every number: its name and its figures. */
const TOTAL_STEPS = TOTAL_NUMBERS * 2

/** The name of the how-to screen: it is not in the game. */
const EXAMPLE = { clue: 'Un número entre 1 y 10: la mitad de 12.', word: 'SEIS', value: 6 }

/** A figure the way it is written in Argentina: 1.000, not 1,000. */
function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
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

interface Tile {
  id: number
  ch: string
}
interface ItemEpoch {
  tiles: Tile[]
  /** The four figures of the second step, in the order they are shown. */
  figures: number[]
}
/** The order of the letters and of the figures of every number: decided ONCE, at mount. */
function buildEpoch(): ItemEpoch[][] {
  return LEVELS.map((lvl) =>
    lvl.numbers.map((n) => {
      let letters = shuffle([...n.word])
      // Never start already solved (a bounded retry; a rotation settles the odd case where the shuffle keeps the order).
      for (let tries = 0; tries < 8 && letters.join('') === n.word; tries++) letters = shuffle([...n.word])
      if (letters.join('') === n.word) letters = [...letters.slice(1), letters[0]]
      return { tiles: letters.map((ch, id) => ({ id, ch })), figures: shuffle([n.value, ...n.wrong]) }
    }),
  )
}

/** The hint after a wrong name: it grows with every miss on the same number, and from the third one it says the name. */
function missHint(n: NumberDef, misses: number): string {
  if (misses === 1) return `No es. ${n.tip}`
  if (misses === 2) return `No es. ${n.tip} Empieza con «${n.word.slice(0, 3)}».`
  return `Es «${n.display}»: armalo para seguir.`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena cabeza!', '¡Perfecto!']
/** A tap this soon after the tap that changed the screen is the second tap of a double tap and must not land. */
const SETTLE_MS = 400

/** One box per letter of a name. */
function Boxes({ word, letters, right }: { word: string; letters: string[]; right: boolean }) {
  const long = word.length > 9
  return (
    <div className={`flex flex-wrap justify-center ${long ? 'gap-0.5' : 'gap-1'}`} aria-hidden="true">
      {[...word].map((_, i) => (
        <span
          key={i}
          className={[
            'flex h-9 items-center justify-center rounded-lg border-2 font-extrabold',
            long ? 'w-5 text-lg' : 'w-8 text-xl',
            right
              ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
              : letters[i]
                ? 'border-slate-400 bg-white text-slate-900'
                : 'border-dashed border-slate-300 bg-white',
          ].join(' ')}
        >
          {letters[i]}
        </span>
      ))}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Leé la pista y tocá las letras en orden para armar el nombre del número. Después apretá «Listo».',
    'Con el nombre armado, tocá ese mismo número escrito en cifras, entre cuatro parecidos.',
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
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">«{EXAMPLE.clue}»</p>
        <div className="mt-2">
          <Boxes word={EXAMPLE.word} letters={[...EXAMPLE.word]} right={false} />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-slate-900">{EXAMPLE.value}</p>
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
  items: ItemEpoch[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, items, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.numbers.length

  const [idx, setIdx] = useState(0)
  // 'build': the letters of the name; 'figures': the number in digits; 'right': both done, waiting for "Seguir".
  const [step, setStep] = useState<'build' | 'figures' | 'right'>('build')
  const [typed, setTyped] = useState<number[]>([])
  const [misses, setMisses] = useState(0)
  const [wrongFigures, setWrongFigures] = useState<number[]>([])
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const settleFromRef = useRef(since)
  const lastTileRef = useRef({ id: -1, at: -Infinity })
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

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

  const num = level.numbers[idx]
  const epoch = items[idx]
  const used = new Set(typed)
  const tileChar = (id: number) => epoch.tiles.find((t) => t.id === id)?.ch ?? ''
  const full = typed.length === num.word.length
  const compact = num.word.length > 8
  const settled = (at: number) => at - settleFromRef.current >= SETTLE_MS

  function tapTile(id: number, at: number) {
    if (step !== 'build' || !settled(at)) return
    const last = lastTileRef.current
    if (last.id === id && at - last.at < SETTLE_MS) return
    lastTileRef.current = { id, at }
    if (used.has(id) || typed.length >= num.word.length) return
    setTyped((t) => [...t, id])
    setHint(null)
  }
  function backspace(at: number) {
    if (step !== 'build' || !settled(at)) return
    setTyped((t) => t.slice(0, -1))
  }
  function submit(at: number) {
    if (step !== 'build' || !full || !settled(at)) return
    settleFromRef.current = at
    if (typed.map(tileChar).join('') === num.word) {
      setStep('figures')
      setHint({ text: `¡Eso es! «${num.display}».`, ok: true })
      return
    }
    const n = misses + 1
    setMisses(n)
    setTyped([])
    setHint({ text: missHint(num, n), ok: false })
    onMistake()
  }
  function pickFigure(value: number, at: number) {
    if (step !== 'figures' || wrongFigures.includes(value) || !settled(at)) return
    settleFromRef.current = at
    if (value === num.value) {
      setStep('right')
      setHint({ text: `¡Eso es! «${num.display}» se escribe ${formatNumber(num.value)}.`, ok: true })
      return
    }
    setWrongFigures((w) => [...w, value])
    setHint({ text: 'Ese no. Probá con otro.', ok: false })
    onMistake()
  }
  function next(at: number) {
    if (step !== 'right' || !settled(at)) return
    settleFromRef.current = at
    if (idx < total - 1) {
      setIdx((i) => i + 1)
      setStep('build')
      setTyped([])
      setMisses(0)
      setWrongFigures([])
      setHint(null)
    } else {
      setPraise(pickOne(PRAISE))
      setDone(true)
      onSolved()
    }
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
            Número {idx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          <div className="mx-auto mt-2 max-w-md rounded-2xl border-2 border-tiam-blue bg-tiam-blue/5 px-3 py-2 text-center">
            <span className="block text-base font-semibold leading-snug text-slate-800">{num.clue}</span>
            <span className="mt-1.5 block">
              <Boxes word={num.word} letters={typed.map(tileChar)} right={step !== 'build'} />
            </span>
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.25rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? (step === 'build' ? 'Tocá las letras para armar el nombre.' : '')}
          </p>

          {step === 'build' && (
            <>
              <div role="group" aria-label="Letras sueltas" className={`mx-auto flex max-w-md flex-wrap justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
                {epoch.tiles.map((t) => {
                  const isUsed = used.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={isUsed}
                      aria-label={`Letra ${t.ch}`}
                      onClick={(e) => tapTile(t.id, e.timeStamp)}
                      className={[
                        'flex items-center justify-center rounded-xl border-2 font-bold transition',
                        compact ? 'h-11 w-11 text-lg' : 'h-12 w-12 text-xl',
                        'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                        isUsed ? 'border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 active:bg-tiam-blue/10',
                      ].join(' ')}
                    >
                      {t.ch}
                    </button>
                  )
                })}
              </div>
              <div className="sticky bottom-0 z-10 mx-auto mt-1 flex max-w-md gap-2 bg-white/95 pb-0.5 pt-1">
                <button
                  type="button"
                  aria-label="Borrar la última letra"
                  disabled={typed.length === 0}
                  onClick={(e) => backspace(e.timeStamp)}
                  className="flex min-h-[52px] w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-slate-700 transition hover:border-tiam-blue/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:border-slate-200 disabled:text-slate-300"
                >
                  <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!full}
                  onClick={(e) => submit(e.timeStamp)}
                  className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
                >
                  Listo
                </button>
              </div>
            </>
          )}

          {step !== 'build' && (
            <>
              <p className="mx-auto mt-1 max-w-md text-center text-lg font-bold text-slate-900">¿Cómo se escribe en cifras?</p>
              <div role="group" aria-label="Cifras" className="mx-auto mt-2 grid max-w-md grid-cols-2 gap-3">
                {epoch.figures.map((v) => {
                  const wrong = wrongFigures.includes(v)
                  const isTheRight = step === 'right' && v === num.value
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={step === 'right' || wrong}
                      onClick={(e) => pickFigure(v, e.timeStamp)}
                      className={[
                        'flex min-h-[56px] items-center justify-center gap-1.5 rounded-2xl border-2 text-2xl font-extrabold transition',
                        'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                        isTheRight
                          ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                          : wrong
                            ? 'border-slate-200 bg-slate-100 text-slate-400'
                            : step === 'right'
                              ? 'border-slate-200 bg-white text-slate-400'
                              : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md active:bg-tiam-blue/5',
                      ].join(' ')}
                    >
                      {isTheRight && <Check className="h-5 w-5 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
                      {formatNumber(v)}
                    </button>
                  )
                })}
              </div>
              <div className="sticky bottom-0 z-10 mx-auto mt-2 min-h-[3.5rem] max-w-md bg-white/95 pb-1 pt-1 text-center">
                {step === 'right' && (
                  <button
                    type="button"
                    onClick={(e) => next(e.timeStamp)}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
                  >
                    {idx < total - 1 ? 'Seguir' : 'Terminar el nivel'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Armaste los {total} números. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {level.numbers.map((n) => (
              <li key={n.word} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{n.display}</span>
                  <span className="text-slate-500"> = {formatNumber(n.value)}</span>
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

export function NumerosRevueltos({ onComplete }: GameProps) {
  // The order of the letters and of the figures — decided once, at mount, so "Repetir" replays exactly the same content.
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">De letras a cifras</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      items={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
