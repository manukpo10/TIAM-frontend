import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La sílaba del medio" — día 3, mes 6, lenguaje. A word comes cut into syllables with the one in the middle missing
 * (CA · ? · NO) and a clue that describes it; four syllables wait below and the player taps the one that completes
 * the word and then taps the gap. The mechanic comes from a worksheet where a syllable of a column is joined to the
 * word whose middle is blank; here there is no line to draw, just two taps.
 *
 * ORIGINAL CONTENT. Only the idea (a word with its middle syllable missing, and a list of syllables to complete it)
 * is borrowed. The words and the clues are TIAM's own, everyday words for adults (a throwaway script, not committed,
 * checks that no word is one of the worksheet's, that no clue contains its word, that the middle syllable is really
 * the middle one and that the options of a word are different).
 *
 * CLUES, NOT A BLIND GUESS (a word game never asks for a word with nothing to go on): every word comes with a clue,
 * the boxes of ALL its syllables are on screen (so the length is visible) and every wrong syllable makes a word that
 * does not exist, so only one syllable fits the clue. A wrong syllable costs ONE mistake, is switched off for that word
 * (muted gray, never red) and gets a hint that grows with the misses: a nudge, then reading the word aloud, then the
 * last one standing. Nothing is timed but a short pause so the finished word is read.
 *
 * THREE WORDS A LEVEL, as the tallerista likes the days short. The ramp is the word and what the options look like:
 * level 1 has three-syllable words with options that look nothing alike, level 2 has words whose options share the
 * consonant and change only the vowel (PA, PE, PI, PO), and level 3 has five-syllable words (the middle one is the
 * third) with options that sound the same or nearly (VI, BI, FI; GRA, CRA, BRA). Each level has a pool of five or six
 * words; three are picked ONCE at mount (`epoch`, with the order of the options), so "Repetir" replays exactly the
 * same nine.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is
 * ignored (the syllables sit where that button was), a second tap on a chosen syllable is not "take it back" and a
 * syllable already tried for the word is ignored.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface WordDef {
  /** The syllables as they are written (lowercase, with their accent): the middle one is the one that is missing. */
  syllables: string[]
  /** What the word is. It never contains the word. */
  clue: string
  /** A nudge after the first wrong syllable. */
  tip: string
  /** Four syllables, the right one among them; any of the others makes a word that does not exist. */
  options: string[]
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
      { syllables: ['ca', 'mi', 'no'], clue: 'Por ahí se va de un lugar a otro, a pie o en auto.', tip: 'Pensá en una calle de tierra o un sendero.', options: ['mi', 'na', 'lo', 'su'] },
      { syllables: ['pi', 'ja', 'ma'], clue: 'La ropa que te ponés para dormir.', tip: 'Es de dos piezas: arriba y abajo.', options: ['ja', 'sa', 'nu', 'lu'] },
      { syllables: ['ma', 'de', 'ra'], clue: 'El material de los árboles con el que se hacen los muebles.', tip: 'La mesa de tu casa puede ser de este material.', options: ['de', 'ri', 'so', 'pu'] },
      { syllables: ['za', 'pa', 'to'], clue: 'Calzado que se pone en el pie y se ata con cordones.', tip: 'Se compra de a pares.', options: ['pa', 'te', 'mi', 'li'] },
      { syllables: ['pe', 'lo', 'ta'], clue: 'Se patea en el fútbol y se tira al aro en el básquet.', tip: 'Es redonda y rebota.', options: ['lo', 'mi', 'nu', 'fa'] },
      { syllables: ['ven', 'ta', 'na'], clue: 'Se abre en la pared para que entren el aire y la luz.', tip: 'Tiene vidrio y cortinas.', options: ['ta', 'pa', 'go', 'li'] },
    ],
  },
  {
    name: 'Nivel 2',
    words: [
      { syllables: ['cam', 'pa', 'na'], clue: 'Es de metal, cuelga de una torre y suena cuando la hacen balancear.', tip: 'Hace «ding, dong».', options: ['pa', 'pe', 'pi', 'po'] },
      { syllables: ['ga', 'lle', 'ta'], clue: 'Alimento seco y crocante que se come con el mate o con el té.', tip: 'Las hay dulces y saladas.', options: ['lle', 'lla', 'llo', 'llu'] },
      { syllables: ['to', 'ma', 'te'], clue: 'Fruto rojo y redondo que va en la ensalada y en la salsa.', tip: 'Se corta en rodajas.', options: ['ma', 'me', 'mi', 'mo'] },
      { syllables: ['bo', 'te', 'lla'], clue: 'Recipiente con el cuello angosto para el agua, el vino o la gaseosa.', tip: 'Se tapa con una tapa o un corcho.', options: ['te', 'ta', 'to', 'tu'] },
      { syllables: ['ca', 'mi', 'sa'], clue: 'Prenda con cuello y botones que cubre el torso.', tip: 'Se usa con corbata o sin ella.', options: ['mi', 'ma', 'me', 'mo'] },
      { syllables: ['pan', 'ta', 'lón'], clue: 'Prenda que cubre cada pierna por separado.', tip: 'Tiene bolsillos y se sujeta con cinturón.', options: ['ta', 'te', 'ti', 'to'] },
    ],
  },
  {
    name: 'Nivel 3',
    words: [
      { syllables: ['fo', 'to', 'gra', 'fí', 'a'], clue: 'Imagen que se saca con una cámara y se guarda en un álbum.', tip: 'Las fotos viejas son un recuerdo.', options: ['gra', 'cra', 'bra', 'dra'] },
      { syllables: ['ma', 'ra', 'vi', 'llo', 'so'], clue: 'Algo tan lindo o tan extraordinario que deja a todos asombrados.', tip: 'Es como decir «espectacular».', options: ['vi', 'bi', 'fi', 'ni'] },
      { syllables: ['ma', 'te', 'má', 'ti', 'ca'], clue: 'Materia que trabaja con números y cuentas.', tip: 'Ahí se estudian la suma y la multiplicación.', options: ['má', 'ná', 'rá', 'lá'] },
      { syllables: ['cal', 'cu', 'la', 'do', 'ra'], clue: 'Aparatito con teclas para hacer cuentas.', tip: 'Se usa en el almacén y en el banco.', options: ['la', 'le', 'li', 'lo'] },
      { syllables: ['car', 'pin', 'te', 'rí', 'a'], clue: 'Taller donde se trabaja la madera y se arman puertas y muebles.', tip: 'Ahí se usa el serrucho y el martillo.', options: ['te', 'ta', 'to', 'tu'] },
    ],
  },
]
const TOTAL_WORDS = LEVELS.length * WORDS_PER_LEVEL

/** The word of the how-to screen: it is not in the game. */
const EXAMPLE = { clue: 'Fruta amarilla y alargada que se pela', syllables: ['ba', 'na', 'na'], missing: 'na' }
// ── data:end ──

function middleOf(w: WordDef): string {
  return w.syllables[Math.floor(w.syllables.length / 2)]
}
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

interface PreparedWord {
  def: WordDef
  /** The options in the order they show. */
  options: string[]
}
function buildEpoch(): PreparedWord[][] {
  return LEVELS.map((lvl) => shuffle(lvl.words).slice(0, WORDS_PER_LEVEL).map((def) => ({ def, options: shuffle(def.options) })))
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen vocabulario!', '¡Perfecto!']
/** The pause after a right word, with it on screen, before the next one. */
const ADVANCE_MS = 1700
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a syllable: the syllables sit where that button was. Also the window in which a
 * second tap on the same syllable is a double tap, not "choose it again to take it back". */
const SETTLE_MS = 400

/** The word as boxes, one per syllable; the middle one is the gap, empty until the right syllable is placed. */
function WordBoxes({
  syllables,
  filled,
  armed,
  onGap,
}: {
  syllables: string[]
  /** The syllable placed in the gap, or null. */
  filled: string | null
  /** A syllable is chosen: the gap invites the tap. */
  armed: boolean
  onGap?: (at: number) => void
}) {
  const mid = Math.floor(syllables.length / 2)
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label={`Palabra de ${syllables.length} sílabas`}>
      {syllables.map((s, i) => {
        const box = 'flex h-14 min-w-[52px] items-center justify-center rounded-xl border-2 px-1.5 text-2xl font-extrabold uppercase'
        if (i !== mid) {
          return (
            <span key={i} className={`${box} border-slate-300 bg-white text-slate-900`}>
              {s}
            </span>
          )
        }
        if (filled) {
          return (
            <span key={i} className={`${box} border-tiam-green bg-tiam-green/10 text-slate-900`}>
              {filled}
            </span>
          )
        }
        return (
          <button
            key={i}
            type="button"
            aria-label="Hueco de la sílaba del medio"
            onClick={(e) => onGap?.(e.timeStamp)}
            className={[
              `${box} border-dashed transition focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1`,
              armed ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue' : 'border-slate-400 bg-white text-slate-400',
            ].join(' ')}
          >
            ?
          </button>
        )
      })}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = ['Leé la pista: describe una palabra a la que le falta la sílaba del medio.', 'Tocá la sílaba que la completa y después tocá el hueco.']
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
        <div className="mt-2" aria-hidden="true">
          <WordBoxes syllables={EXAMPLE.syllables} filled={EXAMPLE.missing} armed={false} />
        </div>
        <p className="mt-2 text-base text-slate-600">
          La sílaba que falta es <span className="font-bold uppercase text-slate-900">{EXAMPLE.missing}</span>.
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
  words: PreparedWord[]
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
  const [selected, setSelected] = useState<string | null>(null)
  // Syllables already tried wrong for the current word.
  const [tried, setTried] = useState<string[]>([])
  const [placed, setPlaced] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same keys, but readable at once: a double tap lands before React has repainted the chip as disabled.
  const lockedRef = useRef<Set<string>>(new Set())
  const lastChipTapRef = useRef({ syl: '', at: -Infinity })
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
  const busy = advancing || done

  function tapSyllable(syl: string, at: number) {
    if (busy || at - since < SETTLE_MS) return
    const last = lastChipTapRef.current
    // The second tap of a double tap on the chosen syllable is not "take it back".
    if (last.syl === syl && at - last.at < SETTLE_MS) return
    lastChipTapRef.current = { syl, at }
    setSelected((cur) => (cur === syl ? null : syl))
    setHint(null)
  }

  function tapGap(at: number) {
    if (busy || at - since < SETTLE_MS) return
    if (!selected) {
      setHint({ text: 'Primero tocá una sílaba de abajo.', ok: false })
      return
    }
    const key = `${qIdx}|${selected}`
    if (lockedRef.current.has(key)) return
    lockedRef.current.add(key)
    const word = current.def
    if (selected === middleOf(word)) {
      setPlaced(selected)
      setSelected(null)
      setAdvancing(true)
      setHint({ text: `¡Eso es! «${word.syllables.join('')}».`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setTried([])
          setPlaced(null)
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
    setTried((t) => [...t, selected])
    setSelected(null)
    setHint({
      text:
        n === 1
          ? `Esa sílaba no arma una palabra. ${word.tip}`
          : n === 2
            ? 'Esa tampoco. Probá leer la palabra completa en voz alta con cada sílaba.'
            : 'Queda una sola sílaba: tocala y después tocá el hueco.',
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
            Palabra {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The clue */}
          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-tiam-blue">Pista</p>
            <p className="mt-1 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{current.def.clue}</p>
          </div>

          {/* The word, with its gap */}
          <div className="mx-auto mt-4 max-w-md">
            <WordBoxes syllables={current.def.syllables} filled={placed} armed={selected !== null} onGap={tapGap} />
          </div>

          <p
            role="status"
            className={`mx-auto mt-3 min-h-[3.5rem] max-w-md text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? (selected ? 'Ahora tocá el hueco de la palabra.' : 'Tocá la sílaba que falta.')}
          </p>

          {/* The syllables */}
          <div role="group" aria-label="Sílabas" className="mx-auto mt-1 grid max-w-md grid-cols-4 gap-2">
            {current.options.map((syl) => {
              const isTried = tried.includes(syl)
              const isPlaced = placed === syl
              const isSelected = selected === syl
              return (
                <button
                  key={syl}
                  type="button"
                  disabled={busy || isTried}
                  aria-pressed={isSelected}
                  onClick={(e) => tapSyllable(syl, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] items-center justify-center rounded-2xl border-2 text-2xl font-extrabold uppercase transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isPlaced
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-800'
                      : isTried
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : isSelected
                          ? 'border-tiam-blue bg-tiam-blue text-white shadow-md'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md',
                  ].join(' ')}
                >
                  {syl}
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
          <p className="mt-1 text-slate-600">Completaste las {total} palabras. ¡Terminaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {words.map(({ def }) => (
              <li key={def.syllables.join('')} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{def.syllables.join('')}</span>
                  <span className="text-slate-500"> — {def.clue}</span>
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

export function LaSilabaDelMedio({ onComplete }: GameProps) {
  // Which words each level plays and the order of their syllables — decided once, at mount, so "Repetir" replays
  // exactly the same content.
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué sílaba falta?</h2>
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
