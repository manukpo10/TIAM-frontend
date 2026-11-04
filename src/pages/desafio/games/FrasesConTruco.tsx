import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Frases con truco" — día 26, mes 6, lenguaje. A funny two-word phrase ("NADIE PARA") whose letters, shuffled, spell
 * ONE other word (PANADERÍA). The game gives a clue and one box per letter of the hidden word; the player taps the
 * letters of the phrase, in the order the hidden word needs, to fill the boxes. The mechanic comes from a worksheet of
 * odd phrases that hide a word; here the nine phrases, their hidden words and the clues are TIAM's own.
 *
 * WHAT MAKES IT A DIFFERENT ACTIVITY FROM THE OTHER LETTER GAMES OF THE MONTH (días 7, 12, 16): the bank of letters is not
 * a separate tray, a tally or a ring of tiles: it is the PHRASE itself, written in two rows (one per word), and a tapped
 * letter is greyed out where it stands. The surprise of the game is that two ordinary words ("cien dados", "alma cero")
 * contain another word, so the player reads the phrase before looking at its letters.
 *
 * ORIGINAL CONTENT AND READ ALOUD. Only the idea (a phrase that hides a word) is borrowed. Each phrase is built so that
 * its letters are EXACTLY those of the hidden word, accents and spaces aside (a throwaway script, not committed, checks
 * it, and that no clue contains the hidden word or a word of its phrase), and each is a plain Spanish phrase that reads
 * naturally out loud in Rioplatense Spanish ("gris tero", "che son", "con nieta", "mirá tela": the accent on "mirá" is not shown,
 * the letters are the same). Nothing in them is rude. The hidden words are also not answers elsewhere in the month.
 *
 * CLUES, NOT A BLIND GUESS (a word game never asks for a word with nothing to go on): every word has a clue, a second
 * tip and its boxes on screen, so its length is visible. A wrong word costs ONE mistake (a double tap on "Listo" cannot
 * count twice: the first tap puts the letters back and "Listo" is off until the boxes are full again), and the hint
 * grows with the misses on the same word: the tip, then the first letter, and from the third miss the next letter
 * is ringed in the phrase so the word can be finished, so nobody is left stuck. "Borrar" takes back the last letter.
 * Nothing is red and nothing is timed but a short pause so the finished word is seen.
 *
 * THREE PHRASES A LEVEL. The ramp is the length of the hidden word (6 to 7 letters, then 8, then 8 to 9) and how
 * abstract it is: level 1 asks for things that can be pictured (the nights, socks, a fish), level 3 for words that are
 * ideas (a record, attention, something hidden), whose clue describes a meaning instead of an object. Each level has
 * one authored set of three, in a fixed order, so "Repetir" replays exactly the same nine phrases.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. A tap within SETTLE_MS of the tap that brought the level is ignored (the letters sit where
 * that button was).
 *
 * totalAttempts = mistakes + every phrase of the day (TOTAL_PHRASES, derived).
 */

// ── data:start ──
interface PhraseDef {
  /** The funny phrase, two words, plain capital letters (no accents). */
  phrase: string
  /** The hidden word, plain capital letters (no accents). */
  word: string
  /** The hidden word as it is written, with its accent. */
  display: string
  /** What the word is. It never contains the word nor a word of the phrase. */
  clue: string
  /** A second clue, for after the first miss. */
  tip: string
}
interface LevelDef {
  name: string
  phrases: PhraseDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    phrases: [
      {
        phrase: 'CHE SON',
        word: 'NOCHES',
        display: 'noches',
        clue: 'Parte del día en que ya no hay sol y casi todos duermen.',
        tip: 'Vienen después del atardecer.',
      },
      {
        phrase: 'SI DAME',
        word: 'MEDIAS',
        display: 'medias',
        clue: 'Prenda que se pone en los pies, debajo del calzado.',
        tip: 'Se usan de a pares y abrigan en invierno.',
      },
      {
        phrase: 'DE COPAS',
        word: 'PESCADO',
        display: 'pescado',
        clue: 'Lo que se saca del río o del mar con una caña y después se cocina.',
        tip: 'Se come a la plancha o frito, con limón.',
      },
    ],
  },
  {
    name: 'Nivel 2',
    phrases: [
      {
        phrase: 'ALMA CERO',
        word: 'CARAMELO',
        display: 'caramelo',
        clue: 'Golosina dura y dulce que se chupa.',
        tip: 'Viene envuelto en un papelito.',
      },
      {
        phrase: 'LA DANESA',
        word: 'ENSALADA',
        display: 'ensalada',
        clue: 'Plato frío de verduras crudas, con aceite y sal.',
        tip: 'Lleva lechuga, tomate y cebolla.',
      },
      {
        phrase: 'MIRA TELA',
        word: 'MATERIAL',
        display: 'material',
        clue: 'Aquello de lo que está hecho un objeto: madera, vidrio o metal.',
        tip: 'También se dice de lo que se usa para trabajar, como los útiles.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    phrases: [
      {
        phrase: 'GRIS TERO',
        word: 'REGISTRO',
        display: 'registro',
        clue: 'Cuaderno o planilla donde se anotan datos para no olvidarlos.',
        tip: 'Los consultorios y los comercios llevan uno.',
      },
      {
        phrase: 'CON NIETA',
        word: 'ATENCION',
        display: 'atención',
        clue: 'Lo que ponemos para escuchar sin distraernos.',
        tip: 'Se pide cuando alguien necesita que lo escuchen.',
      },
      {
        phrase: 'CIEN DADOS',
        word: 'ESCONDIDA',
        display: 'escondida',
        clue: 'Dicho de una cosa que alguien puso fuera de la vista.',
        tip: 'Una sorpresa guardada en un cajón queda así.',
      },
    ],
  },
]
const TOTAL_PHRASES = LEVELS.reduce((n, l) => n + l.phrases.length, 0)

/** The phrase of the how-to screen: it is not in the game. */
const EXAMPLE = { phrase: 'TRAS LA', word: 'SALTAR', clue: 'Dar un brinco para pasar por encima de algo.' }
// ── data:end ──

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo para las letras!', '¡Perfecto!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
/** The pause after a right word, with it on screen, before the next phrase; every tile is off meanwhile. */
const ADVANCE_MS = 1800
/** A tap this soon after the tap that brought the level is the second tap of a double tap and must not take a letter. */
const SETTLE_MS = 400

const NEXT_BUTTON =
  'inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark'

/** The hidden word's boxes: one per letter, filled as the player takes letters from the phrase. */
function WordBoxes({ word, typed, right }: { word: string; typed: string; right: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Palabra de ${word.length} letras${typed ? `. Armaste: ${typed}` : ''}`}
      className="flex justify-center gap-1"
    >
      {[...word].map((_, i) => {
        const letter = typed[i]
        return (
          <span
            key={i}
            className={[
              'flex h-11 min-w-0 max-w-[34px] flex-1 items-center justify-center rounded-lg border-2 text-xl font-extrabold',
              right
                ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
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

/** The phrase as rows of letter tiles; `used` are the indexes (over the whole phrase) already taken. */
function PhraseTiles({
  phrase,
  used,
  ringed,
  disabled,
  onTap,
}: {
  phrase: string
  used: number[]
  ringed: number
  disabled: boolean
  onTap?: (index: number, at: number) => void
}) {
  let index = 0
  return (
    <div role="group" aria-label="Letras de la frase" className="mx-auto flex max-w-[300px] flex-col gap-1.5">
      {phrase.split(' ').map((w, row) => (
        <div key={row} className="flex justify-center gap-1">
          {[...w].map((ch) => {
            const i = index++
            const taken = used.includes(i)
            return (
              <button
                key={i}
                type="button"
                aria-label={`Letra ${ch}${taken ? ', ya usada' : ''}`}
                disabled={disabled || taken || !onTap}
                onClick={(e) => onTap?.(i, e.timeStamp)}
                className={[
                  'h-12 min-w-0 max-w-[48px] flex-1 rounded-xl border-2 text-xl font-extrabold transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                  taken
                    ? 'border-slate-200 bg-slate-100 text-slate-300'
                    : i === ringed
                      ? 'border-tiam-blue bg-tiam-blue/10 text-slate-900 ring-4 ring-tiam-blue/40'
                      : 'border-slate-300 bg-white text-slate-900 hover:border-tiam-blue/50 active:bg-tiam-blue/10',
                ].join(' ')}
              >
                {ch}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Leé la frase: parece una cosa, pero con sus letras mezcladas se arma otra palabra.',
    'Con la pista y las casillas, tocá las letras de la frase en el orden que necesite la palabra y después «Listo».',
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
        <p className="mt-1 text-lg font-extrabold tracking-wide text-slate-900">{EXAMPLE.phrase}</p>
        <p className="mt-1 text-base leading-snug text-slate-700">«{EXAMPLE.clue}»</p>
        <p className="mt-1 text-base font-semibold text-slate-600">
          Son las letras de «{EXAMPLE.word.toLowerCase()}» ({EXAMPLE.word.length} letras).
        </p>
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
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { phrases } = level
  const total = phrases.length

  const [qIdx, setQIdx] = useState(0)
  // Indexes (over the phrase's letters, spaces not counted) taken so far, in order, and the misses of this phrase.
  const [used, setUsed] = useState<number[]>([])
  const [misses, setMisses] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const timerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const current = phrases[qIdx]
  const letters = [...current.phrase.replace(' ', '')]
  const typed = used.map((i) => letters[i]).join('')
  const typing = !advancing && !done
  const complete = used.length === current.word.length
  // From the third miss the next letter the word needs is ringed in the phrase.
  const ringed =
    misses >= 3 && typing && !complete
      ? letters.findIndex((ch, i) => !used.includes(i) && ch === current.word[used.length])
      : -1

  function take(index: number, at: number) {
    if (!typing || complete || at - since < SETTLE_MS || used.includes(index)) return
    setUsed((u) => [...u, index])
  }
  function back(at: number) {
    if (!typing || at - since < SETTLE_MS) return
    setUsed((u) => u.slice(0, -1))
  }
  function submit(at: number) {
    if (!typing || !complete || at - since < SETTLE_MS) return
    if (typed === current.word) {
      setAdvancing(true)
      setHint({ text: `¡Eso es! «${current.display}».`, ok: true })
      timerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setUsed([])
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
    setUsed([])
    onMistake()
    setHint({
      text:
        next === 1
          ? `No es. ${current.tip}`
          : next === 2
            ? `No es. ${current.tip} Empieza con «${current.word[0]}».`
            : 'No es. Marcamos con un aro la próxima letra: seguí desde ahí.',
      ok: false,
    })
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Frase {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center [@media(max-height:700px)]:py-2">
            <p className="text-sm font-bold uppercase tracking-wide text-tiam-blue">Pista</p>
            <p className="mt-1 text-lg font-bold leading-snug text-slate-900 sm:text-xl [@media(max-height:700px)]:text-base">
              {current.clue}
            </p>
            <p className="mt-1 text-base font-medium text-slate-600">La palabra tiene {current.word.length} letras.</p>
          </div>

          <p className="mt-3 text-center text-sm font-bold uppercase tracking-wide text-slate-500">La frase con truco</p>
          <div className="mt-1">
            <PhraseTiles phrase={current.phrase} used={used} ringed={ringed} disabled={!typing || complete} onTap={take} />
          </div>

          <div className="mx-auto mt-3 max-w-md">
            <WordBoxes word={current.word} typed={typed} right={advancing} />
          </div>

          {/* Feedback and buttons stay pinned to the bottom edge, so "Listo" is never below the fold. */}
          <div className="sticky bottom-0 z-10 mx-auto mt-1 max-w-[340px] bg-white/95 pb-1 pt-1">
            <p
              role="status"
              className={`min-h-[3rem] text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-600'}`}
            >
              {hint?.text}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Borrar la última letra"
                disabled={!typing || used.length === 0}
                onClick={(e) => back(e.timeStamp)}
                className="flex min-h-[52px] w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-slate-700 transition hover:border-tiam-blue/50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:opacity-40"
              >
                <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!typing || !complete}
                onClick={(e) => submit(e.timeStamp)}
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
              >
                Listo
              </button>
            </div>
          </div>
        </>
      )}

      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Descubriste las {total} palabras. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {phrases.map((p) => (
              <li key={p.word} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{p.display}</span>
                  <span className="text-slate-500"> — estaba en «{p.phrase.toLowerCase()}»</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button type="button" onClick={(e) => onRepeat(e.timeStamp)} className={NEXT_BUTTON}>
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button type="button" onClick={(e) => onNext(e.timeStamp)} className={NEXT_BUTTON}>
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

export function FrasesConTruco({ onComplete }: GameProps) {
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PHRASES })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué palabra esconde?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
