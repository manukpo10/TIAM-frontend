import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Link2, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cadena de palabras" — día 10, mes 6, lenguaje. A chain starts with one word cut into syllables (MA·TE) and the
 * next link has to begin with the LAST syllable of that word. Four words wait below; the player taps the one that
 * starts with that syllable and the chain grows by one word, until it has four. The mechanic comes from a worksheet with
 * two columns of boxes joined by chain drawings, where a word was written to start with the last syllable of the one
 * before; here nothing is written: the right word is chosen among four.
 *
 * ORIGINAL CONTENT. Only the idea (a chain of words where each one starts with the last syllable of the previous one)
 * is borrowed. The three chains are TIAM's own, in everyday words for adults, and the two chains of the worksheet are
 * not used. A throwaway script (not committed) checks that every link really joins (the last syllable of a word is the
 * first of the next, written the same), that in each step EXACTLY ONE of the four words begins with the syllable asked
 * for, that every decoy begins with the same letter (the trap) and that no word is a right answer in two places of the
 * month.
 *
 * NOT AMBIGUOUS: a decoy never begins with the letters of the syllable asked for. If the chain needs «RA», a word like
 * «RANCHO» (RAN·CHO) is never offered, because a reader could fairly say it starts with «RA». The traps start with the
 * same FIRST LETTER (level 1: TE → TAXI, TIJERA, TUBO), or with the same first TWO letters when the syllable has three
 * (level 2: TOR → TOLDO, TOSTADA, TÓMBOLA), which is why the player has to read the syllable and not only the first
 * letter. The previous word is shown cut into syllables with the last one in colour; the options are plain words.
 *
 * A wrong word costs ONE mistake, is switched off (muted gray, never red) and gets a hint that grows with the misses:
 * what the word has to begin with, reading it aloud, and the last one standing. Nothing is timed but a short pause so
 * the new link is seen.
 *
 * THREE LINKS A LEVEL, as the tallerista likes the days short. The ramp is the syllable asked for: level 1 asks for
 * two-letter syllables (TE, CHO, ZO) and the traps share the first letter; level 2 mixes three-letter ones (TOR, SOL)
 * with a trap that shares the first two letters; level 3 has longer words and syllables of four letters (MUES, VEN) or
 * with a cluster (TRA). Each level has ONE authored chain, and the order of the four words of each step is chosen ONCE
 * at mount (`epoch`), so "Repetir" replays exactly the same nine links.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is
 * ignored (the words sit where that button was) and a word already tried for the link is ignored.
 *
 * totalAttempts = mistakes + every link of the day (TOTAL_LINKS, derived).
 */

// ── data:start ──
/** A word as its syllables, lowercase and with its accent: the first and the last are the ones that chain. */
type Word = string[]
interface LinkDef {
  /** The word that continues the chain: it starts with the last syllable of the word before. */
  word: Word
  /** Three words that begin with the same letter(s) but not with that syllable. */
  decoys: Word[]
}
interface LevelDef {
  name: string
  /** The word the chain starts with. */
  start: Word
  links: LinkDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    start: ['ma', 'te'],
    links: [
      { word: ['te', 'cho'], decoys: [['ta', 'xi'], ['ti', 'je', 'ra'], ['tu', 'bo']] },
      { word: ['cho', 'ri', 'zo'], decoys: [['ca', 'ma'], ['ce', 'bo', 'lla'], ['cu', 'na']] },
      { word: ['zo', 'rro'], decoys: [['za', 'pa', 'llo'], ['zu', 'mo'], ['ze', 'bra']] },
    ],
  },
  {
    name: 'Nivel 2',
    start: ['pin', 'tor'],
    links: [
      { word: ['tor', 'na', 'sol'], decoys: [['tol', 'do'], ['tos', 'ta', 'da'], ['tóm', 'bo', 'la']] },
      { word: ['sol', 'da', 'do'], decoys: [['som', 'bre', 'ro'], ['sor', 'do'], ['son', 'ri', 'sa']] },
      { word: ['do', 'min', 'go'], decoys: [['da', 'ño'], ['de', 'dal'], ['di', 'ne', 'ro']] },
    ],
  },
  {
    name: 'Nivel 3',
    start: ['mues', 'tra'],
    links: [
      { word: ['tra', 'ba', 'jo'], decoys: [['tré', 'bol'], ['tri', 'go'], ['tro', 'fe', 'o']] },
      { word: ['jo', 'ven'], decoys: [['ju', 'gue', 'te'], ['ja', 'bón'], ['ji', 'ra', 'fa']] },
      { word: ['ven', 'ta', 'ja'], decoys: [['ver', 'dad'], ['ves', 'ti', 'do'], ['ve', 'ra', 'no']] },
    ],
  },
]
const TOTAL_LINKS = LEVELS.reduce((sum, lvl) => sum + lvl.links.length, 0)

/** The chain of the how-to screen: it is not in the game. */
const EXAMPLE = { start: ['va', 'so'], next: ['so', 'pa'] }
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
const text = (w: Word) => w.join('')
const lastOf = (w: Word) => w[w.length - 1]

/** The four words of each link of each level, in the order they show — decided ONCE at mount. */
function buildEpoch(): Word[][][] {
  return LEVELS.map((lvl) => lvl.links.map((l) => shuffle([l.word, ...l.decoys])))
}

/** The hint after a wrong word: it grows with every miss on the same link, and from the third one only one is left. */
function missHint(syl: string, misses: number): string {
  if (misses === 1) return `Esa no empieza con «${syl.toUpperCase()}». Fijate bien cómo empieza.`
  if (misses === 2) return `Tiene que empezar justo con «${syl.toUpperCase()}». Probá leer cada palabra en voz alta.`
  return `Queda una sola: la que empieza con «${syl.toUpperCase()}».`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen vocabulario!', '¡Perfecto!']
/** The pause after a right word, with it on the chain, before the next link. */
const ADVANCE_MS = 1500
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a word: the words sit where that button was. */
const SETTLE_MS = 400

/** A word on the chain, cut into syllables. The syllables that join with its neighbours are in colour. */
function ChainWord({ word, joinStart, joinEnd }: { word: Word; joinStart: boolean; joinEnd: boolean }) {
  return (
    <span className="inline-flex items-center rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xl font-extrabold uppercase text-slate-900">
      {word.map((s, i) => {
        const joined = (i === 0 && joinStart) || (i === word.length - 1 && joinEnd)
        return (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <span className="px-0.5 text-slate-300" aria-hidden="true">·</span>}
            <span className={joined ? 'text-tiam-blue' : undefined}>{s}</span>
          </span>
        )
      })}
    </span>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá la última sílaba de la palabra de la cadena: está en color.',
    'Tocá la palabra que EMPIEZA con esa sílaba. Ojo: otras empiezan con la misma letra, pero no encajan.',
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
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5" aria-hidden="true">
          <ChainWord word={EXAMPLE.start} joinStart={false} joinEnd />
          <Link2 className="h-5 w-5 text-slate-400" />
          <ChainWord word={EXAMPLE.next} joinStart joinEnd={false} />
        </div>
        <p className="mt-2 text-base text-slate-600">
          «{text(EXAMPLE.next)}» empieza con <span className="font-bold uppercase text-slate-900">{lastOf(EXAMPLE.start)}</span>, la última sílaba de «{text(EXAMPLE.start)}».
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
  /** The four words of each link, in the order they show. */
  options: Word[][]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, options, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.links.length

  // The link being answered, the words already tried wrong for it and the one just chosen right.
  const [qIdx, setQIdx] = useState(0)
  const [tried, setTried] = useState<string[]>([])
  const [placed, setPlaced] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same keys, but readable at once: a double tap lands before React has repainted the word as disabled.
  const lockedRef = useRef<Set<string>>(new Set())
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
  // The words of the chain so far: the start and every link already right (and the one just chosen).
  const chain: Word[] = [level.start, ...level.links.slice(0, qIdx + (placed ? 1 : 0)).map((l) => l.word)]
  const link = level.links[qIdx]
  const asked = lastOf(chain[qIdx])

  function tapWord(word: Word, at: number) {
    if (busy || at - since < SETTLE_MS) return
    const key = `${qIdx}|${text(word)}`
    if (lockedRef.current.has(key)) return
    lockedRef.current.add(key)
    if (text(word) === text(link.word)) {
      setPlaced(text(word))
      setAdvancing(true)
      setHint({ text: `¡Eso es! «${text(word)}» empieza con «${asked.toUpperCase()}».`, ok: true })
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
    setTried((t) => [...t, text(word)])
    setHint({ text: missHint(asked, n), ok: false })
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
            Eslabón {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The chain so far */}
          <div
            className="mx-auto mt-3 flex max-w-md flex-wrap items-center justify-center gap-x-1.5 gap-y-2 rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-3 py-3"
            role="group"
            aria-label="La cadena hasta ahora"
          >
            {chain.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <Link2 className="h-5 w-5 text-slate-400" aria-hidden="true" />}
                <ChainWord word={w} joinStart={i > 0} joinEnd={i < chain.length - 1 || !placed} />
              </span>
            ))}
          </div>

          <p className="mx-auto mt-3 max-w-md text-center text-xl font-bold leading-snug text-slate-900">
            ¿Qué palabra empieza con <span className="uppercase text-tiam-blue">{asked}</span>?
          </p>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[3rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? 'Tocá la palabra que sigue en la cadena.'}
          </p>

          {/* The four words */}
          <div role="group" aria-label="Palabras" className="mx-auto mt-1 grid max-w-md grid-cols-2 gap-2">
            {options[qIdx].map((w) => {
              const t = text(w)
              const isTried = tried.includes(t)
              const isPlaced = placed === t
              return (
                <button
                  key={t}
                  type="button"
                  disabled={busy || isTried}
                  onClick={(e) => tapWord(w, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] items-center justify-center rounded-2xl border-2 px-2 text-xl font-extrabold uppercase transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isPlaced
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-800'
                      : isTried
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 hover:shadow-md',
                  ].join(' ')}
                >
                  {t}
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
          <p className="mt-1 text-slate-600">Armaste la cadena completa. ¡Terminaste el {level.name.toLowerCase()}!</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 rounded-2xl bg-white px-3 py-3" aria-label="La cadena completa">
            {[level.start, ...level.links.map((l) => l.word)].map((w, i, all) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <Link2 className="h-5 w-5 text-slate-400" aria-hidden="true" />}
                <ChainWord word={w} joinStart={i > 0} joinEnd={i < all.length - 1} />
              </span>
            ))}
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-base text-slate-600">
            <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />
            Cada palabra empieza con la última sílaba de la anterior.
          </p>
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

export function CadenaDePalabras({ onComplete }: GameProps) {
  // The order of the four words of each link — decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_LINKS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Eslabón por eslabón</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      options={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
