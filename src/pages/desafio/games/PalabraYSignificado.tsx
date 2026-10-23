import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Palabra y significado" — día 30, mes 5, lenguaje. Three words and their meanings: the player taps a word and then
 * the meaning that belongs to it. It replaced "La estrella de sumas" (too close to another game of the catalog) at
 * the tallerista's request, who sent a worksheet, "Relaciona cada palabra con su significado", where each word of a
 * column is joined with a line to its meaning in the other column.
 *
 * ORIGINAL CONTENT. Only the idea of the worksheet (match a word with its meaning) is borrowed. The words and the
 * meanings are TIAM's own, written for adults, and none of the words is one of the worksheet's ten. A throwaway script (not committed) checks that no meaning contains the word it explains, that no word or
 * meaning is repeated anywhere in the day, and that every level has the number of leftover meanings it announces.
 *
 * NO LINES TO DRAW. On a phone, drawing a line across two columns is the hard part, not the language: here the words
 * are a row of chips and the meanings a list, and a match is two taps (the word first, then the meaning). A right
 * pair turns green and is locked, with the word written in front of its meaning. A wrong meaning costs ONE mistake,
 * is switched off for that word and says why not (muted gray, never red); the first miss of a word also gets a nudge
 * ("Pensá en…"). Tapping a meaning with no word chosen only says to choose a word first. Nothing is timed.
 *
 * THREE WORDS A LEVEL, as the tallerista likes the days short (she asked for "3 por nivel" in other games), and the
 * ramp is how many meanings have to be read and how alike they are: level 1 has one meaning per word, level 2 has one
 * meaning too many and level 3 has two too many (the meanings of words that are NOT in the round, so the last pair
 * is never found by elimination). Concrete words (antiguo, puntual) → values and abstract nouns (justicia, esfuerzo)
 * → actions and attitudes (tolerar, prudente). Every level has two authored sets and one is picked ONCE at mount
 * (`epoch`), with the order of the words and of the meanings shuffled: "Repetir" replays exactly the same nine.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored (the
 * words sit where that button was), a second tap on a chip is not a "deselect", and a pair already matched or a
 * meaning already tried for the chosen word is ignored.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface Pair {
  word: string
  /** What the word means: it never contains the word. */
  meaning: string
  /** A nudge after the first wrong meaning for this word. */
  tip: string
}
interface SetDef {
  /** The three words of the round with their meanings. */
  pairs: Pair[]
  /** Meanings of words that are not in the round: they are always wrong. */
  decoys: string[]
}
interface LevelDef {
  name: string
  /** Meanings left over in every set of this level. */
  extra: number
  /** Two authored sets; one is picked at mount. */
  sets: SetDef[]
}

const WORDS_PER_LEVEL = 3

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    extra: 0,
    sets: [
      {
        pairs: [
          { word: 'Veloz', meaning: 'Que se mueve o hace las cosas muy rápido.', tip: 'Pensá en una liebre corriendo.' },
          { word: 'Alegre', meaning: 'Que se siente contento y lo demuestra.', tip: 'Pensá en alguien que canta mientras cocina.' },
          { word: 'Cansado', meaning: 'Al que le faltan fuerzas después de un día de mucho trabajo.', tip: 'Pensá en cómo llegás a la noche, antes de dormir.' },
        ],
        decoys: [],
      },
      {
        pairs: [
          { word: 'Generoso', meaning: 'Que da lo que tiene con gusto, sin guardarse nada.', tip: 'Pensá en alguien que siempre convida.' },
          { word: 'Puntual', meaning: 'Que llega siempre a la hora acordada.', tip: 'Pensá en el reloj.' },
          { word: 'Amable', meaning: 'Que trata a los demás con cariño y buenos modales.', tip: 'Pensá en alguien que saluda con una sonrisa.' },
        ],
        decoys: [],
      },
    ],
  },
  {
    name: 'Nivel 2',
    extra: 1,
    sets: [
      {
        pairs: [
          { word: 'Confianza', meaning: 'Creer que podemos contar con alguien sin dudar de él.', tip: 'Pensá en alguien a quien le dejarías las llaves de tu casa.' },
          { word: 'Disciplina', meaning: 'Cumplir todos los días con lo que uno se propuso.', tip: 'Pensá en hacer gimnasia todos los días, llueva o truene.' },
          { word: 'Honestidad', meaning: 'Decir la verdad y no engañar a nadie.', tip: 'Pensá en devolver una billetera que se encontró.' },
        ],
        decoys: ['La calma para esperar o aguantar sin enojarse.'],
      },
      {
        pairs: [
          { word: 'Recuerdo', meaning: 'Lo que guardamos en la memoria de algo que ya pasó.', tip: 'Pensá en una foto vieja.' },
          { word: 'Costumbre', meaning: 'Lo que hacemos siempre de la misma manera, todos los días.', tip: 'Pensá en tomar el mate a la misma hora.' },
          { word: 'Compañía', meaning: 'La presencia de alguien que está con nosotros.', tip: 'Pensá en no estar solo.' },
        ],
        decoys: ['Lo que sentimos cuando pasa algo que no esperábamos.'],
      },
    ],
  },
  {
    name: 'Nivel 3',
    extra: 2,
    sets: [
      {
        pairs: [
          { word: 'Convivir', meaning: 'Vivir juntos y respetarse día a día.', tip: 'Pensá en una familia que comparte la casa.' },
          { word: 'Tolerar', meaning: 'Aceptar lo que no nos gusta o lo que piensan distinto, sin enojarnos.', tip: 'Pensá en aguantar sin perder la paciencia.' },
          { word: 'Cuidar', meaning: 'Ocuparse de que una persona o una cosa esté bien y no se dañe.', tip: 'Pensá en regar las plantas o atender a un enfermo.' },
        ],
        decoys: ['Dar las gracias por algo que recibimos.', 'Dejar de lado el enojo con quien nos hizo daño.'],
      },
      {
        pairs: [
          { word: 'Prudente', meaning: 'Que piensa antes de actuar para evitar problemas.', tip: 'Pensá en mirar bien antes de cruzar la calle.' },
          { word: 'Humilde', meaning: 'Que no presume de lo que sabe ni de lo que tiene.', tip: 'Pensá en alguien sencillo, que no se cree más que nadie.' },
          { word: 'Perseverante', meaning: 'Que sigue intentando hasta lograr lo que quiere, aunque tarde.', tip: 'Pensá en no rendirte aunque cueste.' },
        ],
        decoys: ['Que espera que las cosas salgan bien y ve el lado bueno.', 'Que dice lo que piensa con la verdad, aunque cueste.'],
      },
    ],
  },
]
const TOTAL_WORDS = LEVELS.length * WORDS_PER_LEVEL

/** The pair of the how-to screen: it is not in the game. */
const EXAMPLE = { word: 'Valiente', meaning: 'Que enfrenta el peligro sin miedo.' }
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

/** One meaning on screen: `word` is the word it belongs to, or '' for a leftover one. */
interface Meaning {
  id: string
  text: string
  word: string
}
interface LevelContent {
  /** The words in the order they show. */
  words: string[]
  meanings: Meaning[]
  pairs: Pair[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const set = pickOne(lvl.sets)
    const all: Omit<Meaning, 'id'>[] = [
      ...set.pairs.map((p) => ({ text: p.meaning, word: p.word })),
      ...set.decoys.map((text) => ({ text, word: '' })),
    ]
    return {
      words: shuffle(set.pairs.map((p) => p.word)),
      meanings: shuffle(all).map((m, i) => ({ ...m, id: `m${i}` })),
      pairs: set.pairs,
    }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen vocabulario!', '¡Perfecto!']
/** The pause after the last pair, with it on screen, before the result card. */
const ADVANCE_MS = 1400
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a word or a meaning: the chips sit where that button was. Also the window in which
 * a second tap on the same chip is a double tap, not "choose it again to take it back". */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = ['Tocá una palabra.', 'Después tocá el significado que le corresponde. A veces sobra alguno.']
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
      <div className="mt-3 rounded-2xl bg-white p-3">
        <p className="text-center text-base font-semibold text-slate-500">Por ejemplo:</p>
        <div className="mt-2 flex justify-center">
          <span className="inline-flex min-h-[40px] items-center rounded-full border-2 border-tiam-green bg-tiam-green/10 px-4 text-lg font-bold text-slate-900">
            <Check className="mr-1.5 h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />
            {EXAMPLE.word}
          </span>
        </div>
        <p className="mt-2 rounded-xl border-2 border-tiam-green bg-tiam-green/10 px-3 py-2 text-center text-base font-semibold leading-snug text-slate-800">
          <span className="font-bold">{EXAMPLE.word}:</span> {EXAMPLE.meaning}
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
  const { words, meanings, pairs } = content
  const total = words.length
  const extra = meanings.length - total

  const [selected, setSelected] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  // "word|meaning id" pairs already tried wrong, and how many wrong meanings each word has had.
  const [tried, setTried] = useState<string[]>([])
  const [misses, setMisses] = useState<Record<string, number>>({})
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same keys, but readable at once: a double tap lands before React has repainted the chip or the meaning.
  const lockedRef = useRef<Set<string>>(new Set())
  const lastWordTapRef = useRef({ word: '', at: -Infinity })
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

  const busy = advancing || done

  function tapWord(word: string, at: number) {
    if (busy || lockedRef.current.has(word) || at - since < SETTLE_MS) return
    const last = lastWordTapRef.current
    // The second tap of a double tap on the chosen word is not "take it back".
    if (last.word === word && at - last.at < SETTLE_MS) return
    lastWordTapRef.current = { word, at }
    setSelected((cur) => (cur === word ? null : word))
    setHint(null)
  }

  function tapMeaning(m: Meaning, at: number) {
    if (busy || lockedRef.current.has(m.id) || at - since < SETTLE_MS) return
    if (!selected) {
      setHint({ text: 'Primero tocá una palabra.', ok: false })
      return
    }
    const key = `${selected}|${m.id}`
    if (lockedRef.current.has(key)) return
    lockedRef.current.add(key)
    const pair = pairs.find((p) => p.word === selected)
    if (m.word === selected && pair) {
      lockedRef.current.add(selected)
      lockedRef.current.add(m.id)
      const nextMatched = [...matched, selected]
      setMatched(nextMatched)
      setSelected(null)
      setHint({ text: `¡Eso es! ${selected}: ${pair.meaning}`, ok: true })
      if (nextMatched.length === total) {
        setAdvancing(true)
        advanceTimerRef.current = window.setTimeout(() => {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }, ADVANCE_MS)
      }
      return
    }
    const n = (misses[selected] ?? 0) + 1
    setTried((t) => [...t, key])
    setMisses((x) => ({ ...x, [selected]: n }))
    setHint({
      text: n === 1 && pair ? `Ese significado no es el de «${selected}». ${pair.tip}` : `Ese tampoco es el de «${selected}». Leé con calma y probá con otro.`,
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
            Llevás {matched.length} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          <h2 className="mt-3 text-balance text-center text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            Uní cada palabra con su significado
          </h2>
          {extra > 0 && (
            <p className="mt-1 text-center text-base font-medium text-slate-500">
              {extra === 1 ? 'Ojo: sobra un significado.' : 'Ojo: sobran dos significados.'}
            </p>
          )}

          {/* The words */}
          <div role="group" aria-label="Palabras" className="mx-auto mt-3 flex max-w-md flex-wrap justify-center gap-2">
            {words.map((word) => {
              const isMatched = matched.includes(word)
              const isSelected = selected === word
              return (
                <button
                  key={word}
                  type="button"
                  disabled={isMatched || busy}
                  aria-pressed={isSelected}
                  onClick={(e) => tapWord(word, e.timeStamp)}
                  className={[
                    'inline-flex min-h-[48px] items-center rounded-full border-2 px-4 text-lg font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isMatched
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-700'
                      : isSelected
                        ? 'border-tiam-blue bg-tiam-blue text-white shadow-md'
                        : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md',
                  ].join(' ')}
                >
                  {isMatched && <Check className="mr-1.5 h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
                  {word}
                </button>
              )
            })}
          </div>

          {/* The meanings */}
          <div role="group" aria-label="Significados" className="mx-auto mt-3 flex max-w-md flex-col gap-2">
            {meanings.map((m) => {
              const owner = m.word !== '' && matched.includes(m.word) ? m.word : null
              const isTried = selected !== null && tried.includes(`${selected}|${m.id}`)
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={owner !== null || isTried || busy}
                  onClick={(e) => tapMeaning(m, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] items-center rounded-2xl border-2 px-3 py-2 text-left text-base leading-snug transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    owner !== null
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-800'
                      : isTried
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md',
                  ].join(' ')}
                >
                  <span>
                    {owner !== null && <span className="font-bold">{owner}: </span>}
                    {m.text}
                  </span>
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mx-auto mt-3 min-h-[3.5rem] max-w-md text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Uniste las {total} palabras. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {pairs.map((p) => (
              <li key={p.word} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{p.word}</span>
                  <span className="text-slate-500"> — {p.meaning}</span>
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

export function PalabraYSignificado({ onComplete }: GameProps) {
  // Which set each level plays and the order of its words and meanings — decided once, at mount, so "Repetir"
  // replays exactly the same content.
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué significa?</h2>
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
