import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Todas las letras" — día 12, mes 6, lenguaje. One LONG word at a time (7 to 12 letters), with a clue and one box per
 * letter. The letters of the word are laid out as a tally, in alphabetical order, each with how many are left (A ×3,
 * E ×2, R ×1…): the player has to use ALL of them, every time they appear, and tap them in the right order. The mechanic
 * comes from a cognitive-challenge post where the letters of a long word sit in the four corners of a board and the word
 * has to be built with all of them; here the letters are a tally and the boxes are the word.
 *
 * WHAT MAKES IT A DIFFERENT ACTIVITY FROM "Palabras desordenadas" (mes 5), which also builds a word with a clue from
 * its letters: there the letters are a scrambled bank of tiles, the words are short (4 to 9 letters) and each level has a
 * category. Here the words are long, the letters are NOT scrambled but sorted with a counter (so the player reasons
 * about which letters the word has and how many times, not about a jumble), nothing is a tile that moves, and the
 * levels have no category, only a clue.
 *
 * ORIGINAL CONTENT. Only the idea (a long word whose letters are all given) is borrowed. The nine words and the clues
 * are TIAM's own, everyday words for adults. A throwaway script (not committed) checks that the sorted letters are
 * exactly those of the word, that the word of the post is not here, that no clue contains its word and that none of the
 * nine words appears as a whole string (an answer or an option) in any other game of src/pages/desafio/games, months 1
 * to 6, "Palabras desordenadas" included. A word that only shows up inside someone else's sentence is not counted.
 *
 * CLUES, NOT A BLIND GUESS (a word game never asks for a word from its letters with nothing to go on): every word has a
 * clue, a second tip and its boxes on screen, so its length is visible. A wrong word costs ONE mistake (a double tap on
 * "Listo" cannot count twice: the first tap empties the boxes and "Listo" is off until they fill again), gives the
 * letters back and the hint grows with the misses on the same word: the tip, then the first letter, then the word.
 * Nothing is red and nothing is timed but a short pause so the finished word is seen.
 *
 * THREE WORDS A LEVEL. The ramp is the length and how much the letters repeat: 7 to 8 letters, 9 to 10, and 11 to 12
 * with the tally full of repeated letters (C ×3, A ×2, O ×2…). The order of the three words of each level is chosen ONCE at
 * mount (`epoch`), so "Repetir" replays exactly the same nine words.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored (the keys
 * sit where that button was).
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface WordDef {
  /** Plain capital letters (A-Z, no accent): what the keys can write. */
  word: string
  /** The word as it is written, with its accent: shown once it is found. */
  display: string
  /** What it is. It never contains the word. */
  clue: string
  /** A second clue, for after the first miss. */
  tip: string
}
interface LevelDef {
  name: string
  words: WordDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    words: [
      { word: 'BANDEJA', display: 'bandeja', clue: 'Tabla con bordes bajos para llevar las tazas y los platos a la mesa.', tip: 'Se usa para servir el desayuno en la cama.' },
      { word: 'ESCALERA', display: 'escalera', clue: 'Peldaños para subir de un piso al otro.', tip: 'Si el ascensor no anda, hay que usarla.' },
      { word: 'ALMOHADA', display: 'almohada', clue: 'Se apoya en la cama para descansar la cabeza.', tip: 'Tiene funda y se rellena con plumas o espuma.' },
    ],
  },
  {
    name: 'Nivel 2',
    words: [
      { word: 'LAVARROPAS', display: 'lavarropas', clue: 'Aparato que lava la ropa y la centrifuga.', tip: 'Se carga con la ropa sucia y se le echa jabón líquido.' },
      { word: 'CALENDARIO', display: 'calendario', clue: 'Muestra los días y los meses del año.', tip: 'Ahí se marcan los cumpleaños.' },
      { word: 'ENSALADERA', display: 'ensaladera', clue: 'Recipiente hondo para servir lechuga y tomate.', tip: 'Puede ser de vidrio o de madera y va en el centro de la mesa.' },
    ],
  },
  {
    name: 'Nivel 3',
    words: [
      { word: 'ELECTRICISTA', display: 'electricista', clue: 'Arregla la luz, los enchufes y los cables.', tip: 'Se lo llama cuando salta la térmica.' },
      { word: 'COMPUTADORA', display: 'computadora', clue: 'Tiene pantalla y teclado y sirve para navegar.', tip: 'Puede ser de escritorio o portátil.' },
      { word: 'CALEFACCION', display: 'calefacción', clue: 'Sistema de la casa que da calor en invierno.', tip: 'Puede ser a gas, con estufas o con radiadores.' },
    ],
  },
]
const TOTAL_WORDS = LEVELS.reduce((sum, lvl) => sum + lvl.words.length, 0)

/** The word of the how-to screen: it is not in the game. */
const EXAMPLE = { clue: 'Árbol de la plaza que da sombra', word: 'TILO' }
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

/** The letters of a word as a tally: each distinct letter once, in alphabetical order, with how many times it appears. */
function tallyOf(word: string): { ch: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ch, count]) => ({ ch, count }))
}

/** The order of the three words of each level — decided ONCE at mount. */
function buildEpoch(): WordDef[][] {
  return LEVELS.map((lvl) => shuffle(lvl.words))
}

/** The hint after a wrong word: it grows with every miss on the same word, and from the third one it says the word. */
function missHint(w: WordDef, misses: number): string {
  if (misses === 1) return `No es. ${w.tip}`
  if (misses === 2) return `No es. ${w.tip} Empieza con «${w.word[0]}».`
  return `Es «${w.display}»: armala para seguir.`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen vocabulario!', '¡Perfecto!']
/** The pause after a right word, with it on screen, before the next one. */
const ADVANCE_MS = 1500
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not place a letter: the keys sit where that button was. */
const SETTLE_MS = 400

/** One box per letter of the word. */
function Boxes({ length, letters, right }: { length: number; letters: string[]; right: boolean }) {
  const long = length > 9
  return (
    <div className="flex flex-wrap justify-center gap-1" aria-hidden="true">
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          className={[
            'flex h-10 items-center justify-center rounded-lg border-2 text-xl font-extrabold',
            long ? 'w-7' : 'w-8',
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
    'Cada palabra es larga y tiene una pista. Abajo están TODAS sus letras, en orden alfabético, y el número dice cuántas veces aparece cada una.',
    'Tocá las letras en el orden de la palabra y apretá «Listo». No sobra ninguna: se usan todas.',
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
        <p className="mt-1 text-base text-slate-600">
          Letras:{' '}
          <span className="font-bold text-slate-900">
            {tallyOf(EXAMPLE.word)
              .map((t) => (t.count > 1 ? `${t.ch} ×${t.count}` : t.ch))
              .join(' · ')}
          </span>
        </p>
        <div className="mt-2">
          <Boxes length={EXAMPLE.word.length} letters={[...EXAMPLE.word]} right={false} />
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
  words: WordDef[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, words, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = words.length

  const [qIdx, setQIdx] = useState(0)
  const [typed, setTyped] = useState<string[]>([])
  const [misses, setMisses] = useState(0)
  const [right, setRight] = useState(false)
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
  const busy = right || done
  const tally = tallyOf(current.word)
  const full = typed.length === current.word.length
  const left = (ch: string, count: number) => count - typed.filter((c) => c === ch).length

  function tapKey(ch: string, count: number, at: number) {
    if (busy || full || at - since < SETTLE_MS || left(ch, count) <= 0) return
    setTyped((t) => [...t, ch])
    setHint(null)
  }
  function backspace(at: number) {
    if (busy || at - since < SETTLE_MS) return
    setTyped((t) => t.slice(0, -1))
  }
  function submit(at: number) {
    if (busy || !full || at - since < SETTLE_MS) return
    if (typed.join('') === current.word) {
      setRight(true)
      setHint({ text: `¡Eso es! «${current.display}».`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setTyped([])
          setMisses(0)
          setRight(false)
          setHint(null)
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    const n = misses + 1
    setMisses(n)
    setTyped([])
    setHint({ text: missHint(current, n), ok: false })
    onMistake()
  }

  const remaining = current.word.length - typed.length

  return (
    <div ref={topRef} className="px-5 pb-2 pt-2.5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-tiam-blue">
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
          {/* The clue and the boxes */}
          <div className="mx-auto mt-1.5 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-3 py-1.5 text-center">
            <p className="text-base font-semibold leading-snug text-slate-800">{current.clue}</p>
            <p className="mt-1 text-base font-bold uppercase tracking-wide text-tiam-blue">{current.word.length} letras</p>
            <div className="mt-1">
              <Boxes length={current.word.length} letters={typed} right={right} />
            </div>
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.75rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? (typed.length === 0 ? 'Tocá las letras para armar la palabra.' : `Te quedan ${remaining} ${remaining === 1 ? 'letra' : 'letras'}.`)}
          </p>

          {/* The tally: every letter once, with how many are left */}
          <div role="group" aria-label="Letras de la palabra" className="mx-auto grid max-w-md grid-cols-5 gap-1.5">
            {tally.map(({ ch, count }) => {
              const rest = left(ch, count)
              return (
                <button
                  key={ch}
                  type="button"
                  disabled={busy || full || rest <= 0}
                  aria-label={`Letra ${ch}, quedan ${rest}`}
                  onClick={(e) => tapKey(ch, count, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] flex-col items-center justify-center rounded-xl border-2 leading-tight transition',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                    rest <= 0 ? 'border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 active:bg-tiam-blue/10',
                  ].join(' ')}
                >
                  <span className="text-xl font-extrabold">{ch}</span>
                  <span className={`text-base font-bold ${rest <= 0 ? 'text-slate-300' : 'text-tiam-blue'}`}>×{rest}</span>
                </button>
              )
            })}
          </div>

          <div className="sticky bottom-0 z-10 mx-auto mt-1.5 flex max-w-md gap-2 bg-white/95 pb-0.5 pt-1">
            <button
              type="button"
              aria-label="Borrar la última letra"
              disabled={busy || typed.length === 0}
              onClick={(e) => backspace(e.timeStamp)}
              className="flex min-h-[48px] w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-slate-700 transition hover:border-tiam-blue/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:border-slate-200 disabled:text-slate-300"
            >
              <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={busy || !full}
              onClick={(e) => submit(e.timeStamp)}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
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
          <p className="mt-1 text-slate-600">Armaste las {total} palabras. ¡Terminaste el {level.name.toLowerCase()}!</p>
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

export function TodasLasLetras({ onComplete }: GameProps) {
  // The order of the words of each level — decided once, at mount, so "Repetir" replays exactly the same content.
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Palabras largas</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      words={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
