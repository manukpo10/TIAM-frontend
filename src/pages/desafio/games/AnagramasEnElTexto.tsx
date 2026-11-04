import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Anagramas en el texto" — día 22, mes 6, atención. A short text about everyday adult life and, hidden in it, words
 * that have exactly the same letters in another order (one of them reads "casa", its partner "saca"). The player reads,
 * taps the words that share their letters and taps "Comprobar". The mechanic comes from a worksheet that hides groups of
 * anagrams inside a paragraph; here the three texts, their words and the example are TIAM's own, written for the game.
 *
 * WHAT IS CHECKED. A group is found only when the player has selected exactly its words (a set, in any order). The data
 * are verified by a throwaway script (not committed): every group is a true anagram (same letters once accents and
 * capitals are ignored), no other word of the text has the same letters as another, and no word is written twice in a
 * text, so there is no second "right answer" that would feel like an unfair "no". Words are compared by their letters
 * only (the accent of "Julián" does not matter).
 *
 * THREE TEXTS, ONE ROUND EACH. The ramp is how much there is to find and how much the game says about it: level 1 has one
 * pair and says so, level 2 one group of three and says so, level 3 two groups (a trio and a pair) and does NOT say how
 * many words each one has. The texts also get longer with the levels. There is nothing to choose at mount: each level has a single authored text,
 * so "Repetir" replays exactly the same content.
 *
 * A WRONG CHECK costs ONE mistake and, like the other word games, gives a hint that grows with the misses in the level: first
 * a general one (look at words of the same length), then one word of the first group still hidden is marked, and from the
 * third miss all its words are marked, so nobody is left stuck. Nothing is red and nothing is timed. After a miss the
 * selection is emptied, so a double tap on "Comprobar" cannot count twice.
 *
 * Every word of the text is a button of at least 44 px (the paragraph has a tall line height for it). Found words turn
 * green with a check, are listed below the text, and cannot be tapped again; the selected ones are blue. The colour is
 * never the only signal: a selected word shows a heavier border and a found one a check.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. A tap within SETTLE_MS of the tap that brought the level is ignored (the words sit where the
 * previous button was).
 *
 * totalAttempts = mistakes + every word the player has to find in the day (TOTAL_WORDS, derived), so one slip in a day
 * does not cost a whole star.
 */

// ── data:start ──
interface LevelDef {
  name: string
  /** The text. Words are separated by single spaces; punctuation sticks to its word. */
  text: string
  /** What the game says about the groups. */
  prompt: string
  /** The anagram groups, as plain lowercase words without accents. */
  groups: string[][]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    text: 'Todos los días, al volver del trabajo, Mariano saca las llaves y entra en su casa con una sonrisa.',
    prompt: 'En el texto hay dos palabras con exactamente las mismas letras.',
    groups: [['casa', 'saca']],
  },
  {
    name: 'Nivel 2',
    text: 'Mi meta de este año es juntarme con las chicas, tomar mate y elegir un tema distinto en cada charla.',
    prompt: 'En el texto hay tres palabras con exactamente las mismas letras.',
    groups: [['mate', 'meta', 'tema']],
  },
  {
    name: 'Nivel 3',
    text: 'Julián voló hasta Roma con un ramo de jazmines para su amor. Cenaron una rica sopa y, al terminar, caminaron a paso lento hacia el hotel.',
    prompt: 'Hay dos grupos de palabras con las mismas letras. No te decimos de cuántas.',
    groups: [
      ['amor', 'ramo', 'roma'],
      ['paso', 'sopa'],
    ],
  },
]
const TOTAL_WORDS = LEVELS.reduce((n, l) => n + l.groups.reduce((m, g) => m + g.length, 0), 0)

/** The sentence of the how-to screen: its pair is not in the game. */
const EXAMPLE = {
  text: 'Cada tarde pasamos por la sala y vemos las alas de unas palomas.',
  pair: ['sala', 'alas'],
}

/** Letters only, lowercase, no accents: what two words are compared by. */
function plain(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-zñ]/g, '')
}
/** Splits a text into its words with the punctuation around each one. */
function tokenize(text: string): { before: string; core: string; after: string; key: string }[] {
  return text.split(' ').map((raw) => {
    const m = raw.match(/^([^\p{L}]*)([\p{L}]+)([^\p{L}]*)$/u)
    const core = m ? m[2] : raw
    return {
      before: m ? m[1] : '',
      core,
      after: m ? m[3] : '',
      key: plain(core),
    }
  })
}
// ── data:end ──

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!', '¡Perfecto!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
/** A tap this soon after the tap that brought the level is the second tap of a double tap and must not select a word. */
const SETTLE_MS = 400

const NEXT_BUTTON =
  'inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark'

function WordButton({
  token,
  state,
  onTap,
}: {
  token: ReturnType<typeof tokenize>[number]
  state: 'plain' | 'selected' | 'found' | 'marked'
  onTap: (e: React.MouseEvent) => void
}) {
  const style = {
    plain: 'border-slate-200 bg-slate-50 text-slate-900 hover:border-tiam-blue/40',
    selected: 'border-tiam-blue bg-tiam-blue/15 font-bold text-tiam-blue-dark ring-2 ring-tiam-blue',
    found: 'border-tiam-green bg-tiam-green/15 font-bold text-slate-900',
    marked: 'border-dashed border-tiam-blue bg-white text-slate-900',
  }[state]
  return (
    <>
      <span className="whitespace-nowrap">
        {token.before}
        <button
          type="button"
          disabled={state === 'found'}
          aria-pressed={state === 'selected'}
          onClick={onTap}
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border-2 px-1.5 align-middle text-lg transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 ${style}`}
        >
          {state === 'found' && <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />}
          {token.core}
        </button>
        {token.after}
      </span>{' '}
    </>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Leé el texto: algunas palabras se arman con las mismas letras, mezcladas de otra manera.',
    'Tocá esas palabras y después «Comprobar». Si te equivocás, te damos una ayuda.',
  ]
  const tokens = tokenize(EXAMPLE.text)
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
        <p className="mt-1 text-lg font-medium leading-snug text-slate-900">
          {tokens.map((t, i) => (
            <span key={i} className={EXAMPLE.pair.includes(t.key) ? 'rounded bg-tiam-green/20 px-0.5 font-bold' : ''}>
              {t.before}
              {t.core}
              {t.after}{' '}
            </span>
          ))}
        </p>
        <p className="mt-1 text-base text-slate-600">«sala» y «alas» tienen las mismas letras: s, a, l, a.</p>
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
  const tokens = tokenize(level.text)

  const [selected, setSelected] = useState<string[]>([])
  const [found, setFound] = useState<string[][]>([])
  const [misses, setMisses] = useState(0)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const done = found.length === level.groups.length
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const foundWords = new Set(found.flat())
  const pending = level.groups.find((g) => !found.some((f) => f[0] === g[0]))
  // Words marked as a hint: after the 2nd miss one word of the first group still hidden, after the 3rd all of them.
  const marked = new Set<string>(!pending || misses < 2 ? [] : misses === 2 ? [pending[0]] : pending)

  function tap(key: string, at: number) {
    if (done || at - since < SETTLE_MS || foundWords.has(key)) return
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  }
  function check(at: number) {
    if (done || selected.length < 2 || at - since < SETTLE_MS) return
    const group = level.groups.find((g) => g.length === selected.length && g.every((w) => selected.includes(w)))
    if (group) {
      const next = [...found, group]
      setFound(next)
      setSelected([])
      setHint({
        text: `¡Eso es! ${group.join(', ')} tienen las mismas letras.`,
        ok: true,
      })
      if (next.length === level.groups.length) {
        setPraise(pickOne(PRAISE))
        onSolved()
      }
      return
    }
    const n = misses + 1
    setMisses(n)
    setSelected([])
    onMistake()
    setHint({
      text:
        n === 1
          ? 'Esas no tienen las mismas letras. Probá con palabras que tengan la misma cantidad de letras.'
          : n === 2
            ? 'Esas no. Te marcamos una palabra con borde punteado: buscá la que tiene sus mismas letras.'
            : 'Esas no. Marcamos con borde punteado las palabras de un grupo: tocalas y comprobá.',
      ok: false,
    })
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        <span className="ml-3 align-middle text-base font-semibold text-slate-500">
          {found.length} de {level.groups.length} {level.groups.length === 1 ? 'grupo' : 'grupos'}
        </span>
      </div>

      <p className="mx-auto mt-3 max-w-md text-center text-base font-semibold leading-snug text-slate-800">
        {level.prompt}
      </p>

      <p className="mx-auto mt-2 max-w-md text-lg leading-[3rem] text-slate-900 [@media(max-height:700px)]:leading-[2.9rem]">
        {tokens.map((t, i) => (
          <WordButton
            key={i}
            token={t}
            state={
              foundWords.has(t.key)
                ? 'found'
                : selected.includes(t.key)
                  ? 'selected'
                  : marked.has(t.key)
                    ? 'marked'
                    : 'plain'
            }
            onTap={(e) => tap(t.key, e.timeStamp)}
          />
        ))}
      </p>

      <p
        role="status"
        className={`mx-auto mt-1 min-h-[3.5rem] max-w-md text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-600'}`}
      >
        {hint?.text}
      </p>

      {!done && (
        <div className="sticky bottom-3 z-10 mx-auto mt-2 max-w-md">
          <button
            type="button"
            disabled={selected.length < 2}
            onClick={(e) => check(e.timeStamp)}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white shadow-md transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {selected.length >= 2 ? `Comprobar (${selected.length} palabras)` : 'Comprobar'}
          </button>
        </div>
      )}

      {done && (
        <div ref={resultRef} className="mt-3 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {level.groups.map((g) => (
              <li key={g[0]} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{g.join(' · ')}</span>
                  <span className="text-slate-500"> — mismas letras: {[...plain(g[0])].sort().join(' ')}</span>
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

export function AnagramasEnElTexto({ onComplete }: GameProps) {
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Palabras con las mismas letras</h2>
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
