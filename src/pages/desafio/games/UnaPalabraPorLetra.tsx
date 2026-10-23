import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Una palabra por letra" — día 28, mes 5, lenguaje. A definition describes a word ("La habitación de la casa donde se
 * prepara la comida"); the game gives its FIRST LETTER and how many letters it has, and the player writes it with an
 * on-screen alphabet. It replaced "Cuentas en la tabla" (too close to a game of month 4) at the tallerista's request,
 * who sent a worksheet, "Palabras que empiezan por…", with one definition per letter of the alphabet as the model.
 *
 * ORIGINAL CONTENT. Only the idea (a definition for a word that starts with a given letter) is borrowed. The words and
 * the definitions are TIAM's own, everyday words (the kitchen, the bank, the umbrella, the traffic light) and a few that
 * stretch the alphabet (K, Ñ, X) in the last level, where a clue plus the first letter and the length can only
 * point to one word.
 *
 * CLUES, NOT A BLIND GUESS (a word game never asks for a word with nothing to go on): every word comes with its
 * definition, its first letter already in the first box, and one empty box per remaining letter. A wrong word clears
 * the boxes, costs ONE mistake (a double tap on "Listo" cannot count twice: the first one empties the boxes and "Listo"
 * is off until they fill again) and gets a hint that grows with every miss in the same word: a second clue, then the
 * first TWO letters, and from the third miss the word itself ("escribila para seguir"), so nobody is left stuck.
 * Nothing is red and nothing is timed.
 *
 * WRITING. A keyboard of the 27 letters (A-Z and Ñ, no accents: the answers are compared as plain letters, and the
 * explanation shows the word as it is written) plus a key to take back the last letter. The same letter can be tapped
 * twice in a row (LLAVE, GUITARRA), so there is no per-key double-tap guard; what is guarded is the tap that brings a
 * level ("Empezar", "Siguiente nivel", "Repetir"), and the keys are off while a right word is shown.
 *
 * THREE LEVELS, THREE WORDS EACH (like days 22 and 23). The ramp is the length and how much the definition has to do:
 * short everyday words (level 1) → longer ones (level 2) → words that are not so common, or that start with a rare
 * letter (level 3). Each level has a pool of six or seven words; three are picked ONCE at mount (`epoch`), so "Repetir"
 * replays exactly the same nine. The check script (not committed) confirms that the written form is the plain-letter
 * version of the displayed one, that no clue contains the word it describes and that no word is repeated.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface WordDef {
  /** Plain capital letters (A-Z and Ñ, no accents): what the keyboard can write. */
  word: string
  /** The word as it is written, with its accent: shown in the hint after it is found. */
  display: string
  /** What the word is. It never contains the word. */
  clue: string
  /** A second clue, for after the first miss. */
  tip: string
}
interface LevelDef {
  name: string
  /** Pool of words; WORDS_PER_LEVEL of them are played. */
  words: WordDef[]
}

const WORDS_PER_LEVEL = 3

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    words: [
      { word: 'ABUELO', display: 'abuelo', clue: 'Es el papá de tu papá o de tu mamá.', tip: 'Los nietos lo llaman así.' },
      { word: 'BANCO', display: 'banco', clue: 'Lugar donde se guarda el dinero y se piden préstamos.', tip: 'Ahí se cobra la jubilación.' },
      { word: 'COCINA', display: 'cocina', clue: 'La habitación de la casa donde se prepara la comida.', tip: 'Ahí están la hornalla y la heladera.' },
      { word: 'ESPEJO', display: 'espejo', clue: 'Un vidrio en el que nos miramos y vemos nuestro reflejo.', tip: 'Lo usamos para peinarnos.' },
      { word: 'JABON', display: 'jabón', clue: 'Se frota con agua para lavarse las manos y hace espuma.', tip: 'Viene en barra o líquido.' },
      { word: 'LLAVE', display: 'llave', clue: 'Se usa para abrir la puerta de la casa.', tip: 'Se guarda en el bolsillo o en la cartera.' },
    ],
  },
  {
    name: 'Nivel 2',
    words: [
      { word: 'DENTISTA', display: 'dentista', clue: 'El profesional que cuida los dientes y arregla las muelas.', tip: 'Se va a su consultorio con turno.' },
      { word: 'GUITARRA', display: 'guitarra', clue: 'Instrumento de seis cuerdas que se toca con los dedos.', tip: 'Sirve para acompañar canciones, como el folklore.' },
      { word: 'HOSPITAL', display: 'hospital', clue: 'Lugar adonde se lleva a los enfermos para atenderlos e internarlos.', tip: 'Tiene guardia, salas y médicos.' },
      { word: 'PARAGUAS', display: 'paraguas', clue: 'Se abre sobre la cabeza para no mojarse cuando llueve.', tip: 'Tiene un mango y varillas.' },
      { word: 'SEMAFORO', display: 'semáforo', clue: 'Tiene tres luces de colores y ordena el tránsito en la esquina.', tip: 'Rojo para frenar, verde para avanzar.' },
      { word: 'TEATRO', display: 'teatro', clue: 'Lugar con escenario y butacas donde se presentan obras.', tip: 'Ahí se ve a los actores en vivo.' },
      { word: 'MAÑANA', display: 'mañana', clue: 'La parte del día que va desde que sale el sol hasta el mediodía.', tip: 'Es cuando se toma el desayuno.' },
    ],
  },
  {
    name: 'Nivel 3',
    words: [
      { word: 'INCENDIO', display: 'incendio', clue: 'Fuego grande y sin control que causa daños.', tip: 'Los bomberos lo apagan.' },
      { word: 'KARAOKE', display: 'karaoke', clue: 'Se canta con la letra que aparece en una pantalla.', tip: 'Es un entretenimiento de fiestas y reuniones.' },
      { word: 'QUIMICA', display: 'química', clue: 'Ciencia que estudia de qué están hechas las cosas y cómo se transforman.', tip: 'Se estudia en el laboratorio, con tubos de ensayo.' },
      { word: 'UNICORNIO', display: 'unicornio', clue: 'Caballo imaginario con un cuerno en la frente.', tip: 'Aparece en los cuentos de hadas.' },
      { word: 'XILOFONO', display: 'xilófono', clue: 'Instrumento de listones que suena al golpearlo con palillos.', tip: 'Cada listón da una nota distinta.' },
      { word: 'ÑANDU', display: 'ñandú', clue: 'Ave grande que corre muy rápido y vive en la pampa.', tip: 'Se parece a un avestruz.' },
      { word: 'ZAPALLO', display: 'zapallo', clue: 'Verdura grande y anaranjada con la que se hace puré o sopa.', tip: 'En otros países se llama calabaza.' },
    ],
  },
]
const TOTAL_WORDS = LEVELS.length * WORDS_PER_LEVEL

/** The word of the how-to screen: it is not in the game. */
const EXAMPLE_WORD = 'PERRO'

/** The 27 letters of the keyboard, seven to a row: with the key that takes a letter back they fill four rows exactly. */
const LETTERS = [...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ']
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
  words: WordDef[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({ words: shuffle(lvl.words).slice(0, WORDS_PER_LEVEL) }))
}

/** The hint after a wrong word: it grows with every miss in the same word, and from the third one it says the word. */
function missHint(w: WordDef, misses: number): string {
  if (misses === 1) return `No es. ${w.tip}`
  if (misses === 2) return `No es. ${w.tip} Empieza con «${w.word.slice(0, 2)}».`
  return `Es «${w.display}»: escribila para seguir.`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen vocabulario!', '¡Perfecto!']
/** The pause after a right word, with it on screen, before the next one; every key is off meanwhile. */
const ADVANCE_MS = 1800
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not type a letter of the new level: the keyboard sits right where that button was. */
const SETTLE_MS = 400

const KEY_CLASS =
  'flex min-h-[46px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-xl font-bold text-slate-800 transition ' +
  'hover:border-tiam-blue/40 active:bg-tiam-blue/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 ' +
  '[@media(max-height:700px)]:min-h-[40px]'

/** One box per letter: the first one is given, the rest are filled as the player types. */
function WordBoxes({ word, typed, right }: { word: string; typed: string; right: boolean }) {
  const big = word.length <= 8
  return (
    <div
      role="img"
      aria-label={`Palabra de ${word.length} letras, empieza con ${word[0]}${typed ? `. Escribiste: ${typed}` : ''}`}
      className={`flex flex-wrap justify-center ${big ? 'gap-1.5' : 'gap-1'}`}
    >
      {[...word].map((ch, i) => {
        const given = i === 0
        const letter = given ? ch : typed[i - 1]
        return (
          <span
            key={i}
            className={[
              'flex h-11 items-center justify-center rounded-lg border-2 font-extrabold',
              big ? 'w-8 text-2xl' : 'w-7 text-xl',
              right
                ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                : given
                  ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                  : letter
                    ? 'border-slate-400 bg-white text-slate-900'
                    : 'border-dashed border-slate-300 bg-white',
            ].join(' ')}
          >
            {letter}
          </span>
        )
      })}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Leé la pista: describe una palabra. Te damos la primera letra y cuántas letras tiene.',
    'Escribila con el teclado de la pantalla y tocá «Listo». Si no es, te damos otra ayuda.',
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
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">«Animal que ladra, amigo del hombre»</p>
        <div className="mt-2" aria-hidden="true">
          <WordBoxes word={EXAMPLE_WORD} typed={EXAMPLE_WORD.slice(1)} right={false} />
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
  const { words } = content
  const total = words.length

  const [qIdx, setQIdx] = useState(0)
  // The letters typed after the given first one, and how many wrong words this word has had.
  const [typed, setTyped] = useState('')
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

  const current = words[qIdx]
  const typing = !advancing && !done
  const complete = typed.length === current.word.length - 1

  function typeLetter(ch: string, at: number) {
    if (!typing || at - since < SETTLE_MS) return
    setTyped((cur) => (cur.length >= current.word.length - 1 ? cur : cur + ch))
  }
  function backspace(at: number) {
    if (!typing || at - since < SETTLE_MS) return
    setTyped((cur) => cur.slice(0, -1))
  }
  function submit(at: number) {
    if (!typing || !complete || at - since < SETTLE_MS) return
    if (current.word[0] + typed === current.word) {
      setAdvancing(true)
      setHint({ text: `¡Eso es! «${current.display}».`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setTyped('')
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
    setTyped('')
    setHint({ text: missHint(current, next), ok: false })
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
            Palabra {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The clue */}
          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center [@media(max-height:700px)]:py-2">
            <p className="text-sm font-bold uppercase tracking-wide text-tiam-blue">Pista</p>
            <p className="mt-1 text-xl font-bold leading-snug text-slate-900 sm:text-2xl [@media(max-height:700px)]:text-lg">{current.clue}</p>
            <p className="mt-1 text-base font-medium text-slate-600">
              Empieza con la {current.word[0]} y tiene {current.word.length} letras.
            </p>
          </div>

          {/* The boxes */}
          <div className="mx-auto mt-3 max-w-md">
            <WordBoxes word={current.word} typed={typed} right={advancing} />
          </div>

          <p
            role="status"
            className={`mx-auto mt-2 min-h-[4.5rem] max-w-md text-center text-base font-medium [@media(max-height:700px)]:min-h-[3.5rem] ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>

          {/* Keyboard */}
          <div role="group" aria-label="Teclado de letras" className="mx-auto grid max-w-[340px] grid-cols-7 gap-1.5">
            {LETTERS.map((ch) => (
              <button
                key={ch}
                type="button"
                aria-label={`Letra ${ch}`}
                disabled={advancing}
                onClick={(e) => typeLetter(ch, e.timeStamp)}
                className={KEY_CLASS}
              >
                {ch}
              </button>
            ))}
            <button
              type="button"
              aria-label="Borrar la última letra"
              disabled={advancing}
              onClick={(e) => backspace(e.timeStamp)}
              className={KEY_CLASS}
            >
              <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="mx-auto mt-3 flex max-w-[340px] justify-center">
            <button
              type="button"
              disabled={advancing || !complete}
              onClick={(e) => submit(e.timeStamp)}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500 [@media(max-height:700px)]:min-h-[46px]"
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
          <p className="mt-1 text-slate-600">Encontraste las {total} palabras. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {words.map((w) => (
              <li key={w.word} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{w.display}</span>
                  <span className="text-slate-500"> — {w.clue}</span>
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

export function UnaPalabraPorLetra({ onComplete }: GameProps) {
  // Which words each level plays and in which order — decided once, at mount, so "Repetir" replays exactly the same
  // content.
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué palabra es?</h2>
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
