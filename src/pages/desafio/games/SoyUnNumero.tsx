import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Soy un número" — día 23, mes 5, lenguaje. A riddle in which a number describes itself ("Soy el número que viene
 * justo antes del 4.500", "Con las cifras 6, 2, 8 y 4 armo el número más chico posible") and the player works out
 * which number it is and WRITES it with an on-screen numeric keypad. Reading the clue with care (what "justo antes",
 * "entre" or "el más chico de 4 cifras" ask for) and then doing the small calculation is the exercise. It replaced
 * "La pirámide de letras" at the tallerista's request, who sent a worksheet of number riddles ("Adivina adivinador")
 * as the model.
 *
 * ORIGINAL CONTENT. The idea (a number that describes itself) is a classic riddle form; the riddles here are TIAM's
 * own. Each one was checked by a throwaway script that scans every integer from 0 to 99.999 and confirms that EXACTLY
 * ONE number fits the clue, and that it is the one stored here. No two riddles of the game share an answer.
 *
 * WRITING, NOT CHOOSING. There are no options to choose from: the player types the number, so the answer cannot be
 * found by elimination. Digits show with the Argentine thousands dot as they are typed (3.904), a number cannot start
 * with 0, and five digits is the longest answer. A wrong number is cleared, costs ONE mistake (a double tap on "Listo"
 * cannot count twice: the first one empties the box) and gets a hint that grows with every miss in the same riddle:
 * first what to look at, then the first digit, and from the third miss the answer itself ("escribilo para seguir"),
 * so nobody is ever left stuck. Nothing is red and nothing is timed.
 *
 * Three riddles per level out of a pool of five to seven per level (so two people can get different ones), picked ONCE
 * at mount (`epoch`): "Repetir" replays exactly the same nine. Ramp: build a number from its parts, or the one just
 * before / after another (level 1) → the smallest or largest number made with some digits, a number between two others,
 * place value in words (level 2) → clues that need two steps (a sum of digits, "el doble de", "a mitad de camino",
 * the smallest number that cannot start with 0) (level 3). Per-level state lives in <LevelView>, keyed by run + level.
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir")
 * is ignored, and while the right number shows its explanation every key is off, which swallows a double tap on "Listo"
 * before the next riddle replaces it. Typing the same digit twice in a row ("00", "11") is NOT guarded: it is how a
 * number is written.
 *
 * totalAttempts = mistakes + every riddle of the day (TOTAL_RIDDLES, derived).
 */

// ── data:start ──
interface Riddle {
  /** What the number says about itself. */
  text: string
  /** The one number that fits (checked for every integer from 0 to 99.999). */
  answer: number
  /** What to look at, after a wrong number. */
  tip: string
  /** The reasoning, shown when the number is right and on the result card. */
  why: string
}
interface LevelDef {
  name: string
  /** Pool of riddles; RIDDLES_PER_LEVEL of them are played. */
  riddles: Riddle[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    riddles: [
      { text: 'Soy el número que se forma con 3.000 + 900 + 4.', answer: 3904, tip: 'Sumá las partes: tres mil, novecientos y cuatro.', why: '3.000 + 900 + 4 = 3.904.' },
      { text: 'Soy el número que se forma con 5.000 + 40 + 7.', answer: 5047, tip: 'Sumá las partes: cinco mil, cuarenta y siete.', why: '5.000 + 40 + 7 = 5.047.' },
      { text: 'Soy el número que se forma con 2.000 + 600 + 80 + 3.', answer: 2683, tip: 'Sumá las partes, de a una: miles, cientos, decenas y unidades.', why: '2.000 + 600 + 80 + 3 = 2.683.' },
      { text: 'Soy el número que viene justo antes del 4.500.', answer: 4499, tip: 'El que viene justo antes es uno menos.', why: 'Justo antes del 4.500 está el 4.499.' },
      { text: 'Soy el número que viene justo después del 7.399.', answer: 7400, tip: 'El que viene justo después es uno más.', why: 'Justo después del 7.399 está el 7.400.' },
    ],
  },
  {
    name: 'Nivel 2',
    riddles: [
      { text: 'Con las cifras 6, 2, 8 y 4 armo el número más chico posible. ¿Qué número soy?', answer: 2468, tip: 'Para el más chico, la cifra más chica va primero.', why: 'Con 6, 2, 8 y 4 el más chico es el 2.468.' },
      { text: 'Con las cifras 7, 1, 9 y 3 armo el número más grande posible. ¿Qué número soy?', answer: 9731, tip: 'Para el más grande, la cifra más grande va primero.', why: 'Con 7, 1, 9 y 3 el más grande es el 9.731.' },
      { text: 'Estoy entre el 5.000 y el 5.010 y termino en 6.', answer: 5006, tip: 'Mirá solo los números que hay entre el 5.000 y el 5.010.', why: 'Entre el 5.000 y el 5.010, el que termina en 6 es el 5.006.' },
      { text: 'Estoy entre el 8.999 y el 9.001.', answer: 9000, tip: 'Fijate qué número hay justo en el medio de esos dos.', why: 'Entre el 8.999 y el 9.001 está el 9.000.' },
      { text: 'Soy el menor número de 4 cifras que empieza con 6 y termina con 5.', answer: 6005, tip: 'Las cifras del medio tienen que ser las más chicas posibles.', why: 'El menor que empieza con 6 y termina con 5 es el 6.005.' },
      { text: 'Soy el mayor número de 4 cifras que empieza con 3.', answer: 3999, tip: 'Las cifras que faltan tienen que ser las más grandes posibles.', why: 'El mayor de 4 cifras que empieza con 3 es el 3.999.' },
      { text: 'Tengo 6 unidades de mil, 5 centenas, 0 decenas y 8 unidades.', answer: 6508, tip: 'Escribí cada cifra en su lugar: mil, cientos, decenas y unidades.', why: '6 de mil, 5 de cien, 0 de diez y 8 unidades: 6.508.' },
    ],
  },
  {
    name: 'Nivel 3',
    riddles: [
      { text: 'Tengo 4 cifras: la primera es 5, la última es 2 y las dos del medio son iguales. Todas mis cifras suman 13.', answer: 5332, tip: 'Si 5 y 2 suman 7, a las dos cifras del medio les faltan 6 para llegar a 13.', why: '5 + 3 + 3 + 2 = 13: soy el 5.332.' },
      { text: 'Estoy entre el 4.000 y el 4.100, y mis dos últimas cifras son iguales y suman 10.', answer: 4055, tip: 'Dos cifras iguales que suman 10: pensá en la mitad de 10.', why: 'Entre el 4.000 y el 4.100, con 5 y 5 al final: el 4.055.' },
      { text: 'Con las cifras 5, 0, 3 y 7 armo el número más chico de 4 cifras. ¿Qué número soy?', answer: 3057, tip: 'Un número de 4 cifras no puede empezar con 0: poné primero la cifra más chica que no sea el 0.', why: 'No puedo empezar con 0, así que soy el 3.057.' },
      { text: 'Soy el número que viene justo antes del doble de 2.500.', answer: 4999, tip: 'Primero calculá el doble de 2.500 y después buscá el que viene justo antes.', why: 'El doble de 2.500 es 5.000, y justo antes está el 4.999.' },
      { text: 'Soy el número que viene justo después del que se forma con 7.000 + 90 + 9.', answer: 7100, tip: 'Primero armá el número con las partes y después sumale uno.', why: '7.000 + 90 + 9 = 7.099, y justo después está el 7.100.' },
      { text: 'Estoy justo a mitad de camino entre el 6.000 y el 6.100.', answer: 6050, tip: 'A mitad de camino quiere decir que estoy a la misma distancia de los dos.', why: 'De 6.000 a 6.100 hay 100: la mitad es 50, así que soy el 6.050.' },
    ],
  },
]

/** Riddles played in every level. */
const RIDDLES_PER_LEVEL = 3
const TOTAL_RIDDLES = LEVELS.length * RIDDLES_PER_LEVEL
/** The longest number that can be written. */
const MAX_DIGITS = 5

/** 3904 → "3.904": the Argentine thousands dot, also for four digits. */
const format = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
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
  riddles: Riddle[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({ riddles: shuffle(lvl.riddles).slice(0, RIDDLES_PER_LEVEL) }))
}

/** The hint after a wrong number: it grows with every miss in the same riddle, and from the third one it says the answer. */
function missHint(riddle: Riddle, guess: number, misses: number): string {
  const wrong = `El ${format(guess)} no es.`
  if (misses === 1) return `${wrong} ${riddle.tip}`
  if (misses === 2) return `${wrong} ${riddle.tip} Empieza con el ${String(riddle.answer)[0]}.`
  return `${wrong} Soy el ${format(riddle.answer)}: escribilo para seguir.`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena cabeza!', '¡Perfecto!']
/** The pause after a right number, with its explanation on screen, before the next riddle; every key is off meanwhile. */
const ADVANCE_MS = 2200
/** A tap this soon after the tap that brought the level here ("Empezar", "Siguiente nivel", "Repetir") is the second tap
 * of a double tap, and it must not type a digit of the new level: the keypad sits right where that button was. */
const SETTLE_MS = 400

const KEY_CLASS =
  'flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-2xl font-extrabold text-slate-800 transition ' +
  'hover:border-tiam-blue/40 active:bg-tiam-blue/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 ' +
  '[@media(max-height:700px)]:min-h-[48px]'

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Leé la pista: es un número que habla de sí mismo.',
    'Pensá qué número es y escribilo con el teclado de la pantalla.',
    'Cuando lo tengas, tocá «Listo». Si no es, te damos una ayuda y probás de nuevo.',
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
      <div className="mt-4 rounded-2xl bg-white p-3 text-center">
        <p className="text-base font-semibold text-slate-500">Por ejemplo:</p>
        <p className="mt-1 text-lg font-bold text-slate-900">«Soy el número que viene justo después del 19»</p>
        <p className="mt-1 text-lg font-bold text-tiam-blue">Soy el 20</p>
      </div>
      <div className="sticky bottom-3 z-10 mt-5 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
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
  const { riddles } = content
  const total = riddles.length

  const [qIdx, setQIdx] = useState(0)
  // What is being written (digits only) and how many wrong numbers this riddle has had.
  const [digits, setDigits] = useState('')
  const [misses, setMisses] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
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

  const riddle = riddles[qIdx]
  const typing = !advancing && !done

  function typeDigit(d: string, at: number) {
    if (!typing || at - since < SETTLE_MS) return
    // A number does not start with 0, and none of the answers is longer than MAX_DIGITS.
    setDigits((cur) => (cur.length >= MAX_DIGITS || (cur === '' && d === '0') ? cur : cur + d))
  }
  function backspace(at: number) {
    if (!typing || at - since < SETTLE_MS) return
    setDigits((cur) => cur.slice(0, -1))
  }
  function submit(at: number) {
    if (!typing || digits === '' || at - since < SETTLE_MS) return
    const guess = Number(digits)
    if (guess === riddle.answer) {
      setAdvancing(true)
      setHint({ text: `¡Eso es! ${riddle.why}`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setDigits('')
          setMisses(0)
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
    const next = misses + 1
    setMisses(next)
    setDigits('')
    setHint({ text: missHint(riddle, guess, next), ok: false })
    onMistake()
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Acertijo {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The riddle */}
          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center [@media(max-height:700px)]:py-2">
            <p className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl [@media(max-height:700px)]:text-lg">
              {riddle.text}
            </p>
          </div>

          {/* The number being written */}
          <div
            role="status"
            aria-label={digits ? `Tu número: ${format(Number(digits))}` : 'Todavía no escribiste ningún número'}
            className="mx-auto mt-3 flex min-h-[64px] max-w-md items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-4 text-4xl font-extrabold tracking-wide text-slate-900 [@media(max-height:700px)]:min-h-[52px] [@media(max-height:700px)]:text-3xl"
          >
            {digits ? (
              format(Number(digits))
            ) : (
              <span className="text-lg font-semibold text-slate-500">Escribí tu número</span>
            )}
            {typing && (
              <span aria-hidden="true" className="ml-1 inline-block h-8 w-0.5 bg-tiam-blue motion-safe:animate-pulse" />
            )}
          </div>

          <p
            className={`mx-auto mt-2 min-h-[4.5rem] max-w-md text-center text-base font-medium [@media(max-height:700px)]:min-h-[3.5rem] ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>

          {/* Keypad */}
          <div role="group" aria-label="Teclado numérico" className="mx-auto mt-1 grid max-w-[320px] grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                disabled={advancing}
                onClick={(e) => typeDigit(d, e.timeStamp)}
                className={KEY_CLASS}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              aria-label="Borrar la última cifra"
              disabled={advancing}
              onClick={(e) => backspace(e.timeStamp)}
              className={KEY_CLASS}
            >
              <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
            </button>
            <button type="button" disabled={advancing} onClick={(e) => typeDigit('0', e.timeStamp)} className={KEY_CLASS}>
              0
            </button>
            <button
              type="button"
              disabled={advancing || digits === ''}
              onClick={(e) => submit(e.timeStamp)}
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-tiam-blue px-2 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500 [@media(max-height:700px)]:min-h-[48px]"
            >
              Listo
            </button>
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
          <p className="mt-1 text-slate-600">Descubriste los {total} números. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {riddles.map((r) => (
              <li key={r.answer} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{format(r.answer)}</span>
                  <span className="text-slate-500"> — {r.why}</span>
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

export function SoyUnNumero({ onComplete }: GameProps) {
  // Which riddles each level plays, and in which order — decided once, at mount, so "Repetir" replays exactly the
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_RIDDLES })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué número soy?</h2>
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
