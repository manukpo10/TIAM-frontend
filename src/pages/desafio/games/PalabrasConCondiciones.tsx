import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Palabras con condiciones" — día 22, mes 5, ejecutivas. A condition ("termina en
 * L", "tiene dos letras B", "se lee igual al revés", "rima con «coche»") and four
 * words; EXACTLY ONE of them meets it and the player taps it. Checking a property
 * of a word against a rule (its letters, its vowels, its sound, its syllables) is
 * the executive step; the three decoys are near misses chosen to need the check — a
 * word that CONTAINS the letter but does not end in it, a word with one B instead of
 * two, a word that looks symmetrical and is not.
 *
 * Three questions per level, with a gentle ramp: ONE visible feature (how it
 * starts, how it ends, how long it is) → letters and sounds (a letter that occurs
 * twice, a palindrome, a rhyme; the vowels, the same letter at both ends, the
 * syllables) → TWO conditions at once, where the word must meet both. At level 3 the
 * decoys are built on purpose: for every question there is one word that meets the
 * first condition only, one that meets the second only, one that meets neither and
 * the answer that meets both.
 *
 * THE RULES ARE DATA AND THE CHECK IS THE RULE. A condition is a small object
 * (`starts`, `ends`, `length`, `count`, `vowels`, `mirror`, `sameEnds`, `syllables`,
 * `rhyme`, or two of them in a `both`), `describe` writes the sentence the player
 * reads from it and `meets` decides whether a word satisfies it, so the sentence
 * on screen and the word that is accepted can never drift apart. After a tap,
 * `facts` says why: «CUBO» tiene 1 letra B; «CASA» tiene 2 sílabas (ca-sa) y termina
 * en A. Letters and vowels are counted by the code (accents ignored); syllables come
 * from a table written and checked BY HAND (SYLLABLES — only words with no two vowels
 * together, so there is no diphthong or hiatus to argue about: «puerta» is out, a player
 * who splits «pue» counts three), because splitting a Spanish word by rule is
 * exactly where a program is wrong. A throwaway Node script (not committed) checks
 * for every question of every set that exactly ONE option meets the condition under
 * every reading a player could give it: vowels counted with their repeats or only the
 * different ones (a «cuatro vocales» answer has four vowels, all different, and no decoy
 * has four of either kind), letters counted with CH and LL as one letter, as in the old
 * alphabet (which is why a six-letter question has no «cuchara»), and syllables counted
 * by the table or one per vowel (so the same answer wins if a diphthong is split). It
 * also checks that level 3 has the four-way near-miss structure, that no word repeats
 * anywhere in the day, that the syllable table agrees with an independent syllabifier,
 * and that no decoy of a rhyme question rhymes with the target by consonants or by vowels.
 *
 * Every tap is checked live. A wrong word greys out for good (muted, never red),
 * says why it does not fit and costs one mistake — a double tap on it counts ONE;
 * the right one turns green, says why it fits and, after a short pause (the only
 * timer in the game), the next question comes. Taps are ignored during that pause, so
 * a quick second tap can never be judged against the next question. Words are shown
 * in capitals, one per line, so every letter is easy to read and to count.
 *
 * Each level has two authored sets of three questions and ONE is picked at mount
 * (`epoch`, together with the order of the options), so "Repetir" replays exactly the
 * same three sets. Per-level state lives in <LevelView>, keyed by run + level. A short
 * "¿Cómo se juega?" screen (two steps and a small example, its button pinned to the
 * bottom edge) opens the day; "Repetir" never brings it back.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by
 * the click's own timeStamp) is ignored, so the second tap of a double tap on "Empezar",
 * "Siguiente nivel" or "Repetir" never answers the first question (the words sit right
 * where that button was); while the right word shows its check every word is off, which
 * swallows a double tap on the RIGHT one before the next question replaces it. A new level
 * opens at its top, and the solved card is scrolled into view, and so is its button, on a
 * short phone (the words give their room to the card).
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived).
 */

// ── data:start ──
type Simple =
  | { kind: 'starts'; letter: string } // empieza con la letra M
  | { kind: 'startsVowel' } // empieza con vocal
  | { kind: 'ends'; letter: string } // termina en L
  | { kind: 'length'; n: number } // tiene cinco letras
  | { kind: 'count'; letter: string; n: number } // tiene dos letras B
  | { kind: 'vowels'; n: number } // tiene cuatro vocales
  | { kind: 'mirror' } // se lee igual al revés
  | { kind: 'sameEnds' } // empieza y termina con la misma letra
  | { kind: 'syllables'; n: number } // tiene tres sílabas
  | { kind: 'rhyme'; word: string; tail: string } // rima con «coche»
type Rule = Simple | { kind: 'both'; a: Simple; b: Simple }

interface Question {
  rule: Rule
  /** Four words, exactly one of which meets the rule. */
  options: string[]
}
interface LevelDef {
  name: string
  /** Authored sets of three questions; one is played. */
  sets: Question[][]
}

const both = (a: Simple, b: Simple): Rule => ({ kind: 'both', a, b })

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    sets: [
      [
        { rule: { kind: 'ends', letter: 'L' }, options: ['papel', 'libro', 'plato', 'mesa'] },
        { rule: { kind: 'starts', letter: 'M' }, options: ['mano', 'lima', 'campo', 'sopa'] },
        { rule: { kind: 'length', n: 5 }, options: ['perro', 'gato', 'conejo', 'pez'] },
      ],
      [
        { rule: { kind: 'ends', letter: 'R' }, options: ['flor', 'radio', 'carta', 'taza'] },
        { rule: { kind: 'starts', letter: 'S' }, options: ['silla', 'pasta', 'vaso', 'luna'] },
        { rule: { kind: 'length', n: 6 }, options: ['tijera', 'reloj', 'tenedor', 'sol'] },
      ],
    ],
  },
  {
    name: 'Nivel 2',
    sets: [
      [
        { rule: { kind: 'count', letter: 'B', n: 2 }, options: ['bombero', 'cubo', 'tobillo', 'ventana'] },
        { rule: { kind: 'mirror' }, options: ['radar', 'nene', 'coco', 'tela'] },
        { rule: { kind: 'rhyme', word: 'coche', tail: 'oche' }, options: ['noche', 'puente', 'zapato', 'gallina'] },
      ],
      [
        { rule: { kind: 'vowels', n: 4 }, options: ['ventilador', 'naranja', 'zanahoria', 'café'] },
        { rule: { kind: 'sameEnds' }, options: ['agua', 'anillo', 'enero', 'leche'] },
        { rule: { kind: 'syllables', n: 3 }, options: ['cocina', 'planta', 'mariposa', 'mar'] },
      ],
    ],
  },
  {
    name: 'Nivel 3',
    sets: [
      [
        {
          rule: both({ kind: 'syllables', n: 3 }, { kind: 'ends', letter: 'A' }),
          options: ['camisa', 'casa', 'tomate', 'jabón'],
        },
        {
          rule: both({ kind: 'starts', letter: 'C' }, { kind: 'length', n: 4 }),
          options: ['cama', 'camión', 'tren', 'frutilla'],
        },
        {
          rule: both({ kind: 'count', letter: 'A', n: 2 }, { kind: 'ends', letter: 'O' }),
          options: ['payaso', 'sandía', 'camino', 'lápiz'],
        },
      ],
      [
        {
          rule: both({ kind: 'mirror' }, { kind: 'length', n: 3 }),
          options: ['oso', 'somos', 'red', 'barco'],
        },
        {
          rule: both({ kind: 'vowels', n: 3 }, { kind: 'starts', letter: 'P' }),
          options: ['pelota', 'puma', 'banana', 'nube'],
        },
        {
          rule: both({ kind: 'syllables', n: 2 }, { kind: 'startsVowel' }),
          options: ['árbol', 'papá', 'elefante', 'teléfono'],
        },
      ],
    ],
  },
]

// Every set of a level has the same number of questions, so TOTAL_QUESTIONS never
// depends on which one is drawn.
const TOTAL_QUESTIONS = LEVELS.reduce((sum, lvl) => sum + lvl.sets[0].length, 0)

/** Syllables written and checked by hand, for the words a `syllables` rule is asked about. */
const SYLLABLES: Record<string, string> = {
  cocina: 'co-ci-na',
  planta: 'plan-ta',
  mariposa: 'ma-ri-po-sa',
  mar: 'mar',
  camisa: 'ca-mi-sa',
  casa: 'ca-sa',
  tomate: 'to-ma-te',
  jabón: 'ja-bón',
  árbol: 'ár-bol',
  papá: 'pa-pá',
  elefante: 'e-le-fan-te',
  teléfono: 'te-lé-fo-no',
}

/** Lowercase, accents removed: the letters the rules count. */
const plain = (word: string) => word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const isVowel = (ch: string) => 'aeiou'.includes(ch)
const countOf = (word: string, letter: string) => plain(word).split('').filter((ch) => ch === letter.toLowerCase()).length
const vowelCount = (word: string) => plain(word).split('').filter(isVowel).length
const firstOf = (word: string) => plain(word).charAt(0)
const lastOf = (word: string) => plain(word).charAt(plain(word).length - 1)
const reversedOf = (word: string) => plain(word).split('').reverse().join('')

function syllablesOf(word: string): string {
  const hyphenated = SYLLABLES[word]
  if (!hyphenated) throw new Error(`No syllables written for "${word}"`)
  return hyphenated
}

function meetsSimple(rule: Simple, word: string): boolean {
  switch (rule.kind) {
    case 'starts':
      return firstOf(word) === rule.letter.toLowerCase()
    case 'startsVowel':
      return isVowel(firstOf(word))
    case 'ends':
      return lastOf(word) === rule.letter.toLowerCase()
    case 'length':
      return plain(word).length === rule.n
    case 'count':
      return countOf(word, rule.letter) === rule.n
    case 'vowels':
      return vowelCount(word) === rule.n
    case 'mirror':
      return plain(word) === reversedOf(word)
    case 'sameEnds':
      return firstOf(word) === lastOf(word)
    case 'syllables':
      return syllablesOf(word).split('-').length === rule.n
    case 'rhyme':
      return plain(word).endsWith(rule.tail)
  }
}

/** Does the word satisfy the condition (all of its parts)? */
function meets(rule: Rule, word: string): boolean {
  return rule.kind === 'both' ? meetsSimple(rule.a, word) && meetsSimple(rule.b, word) : meetsSimple(rule, word)
}

const NUMBER_WORDS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']

function describeSimple(rule: Simple): string {
  switch (rule.kind) {
    case 'starts':
      return `empieza con la letra ${rule.letter}`
    case 'startsVowel':
      return 'empieza con vocal'
    case 'ends':
      return `termina en ${rule.letter}`
    case 'length':
      return `tiene ${NUMBER_WORDS[rule.n]} ${rule.n === 1 ? 'letra' : 'letras'}`
    case 'count':
      return `tiene ${NUMBER_WORDS[rule.n]} ${rule.n === 1 ? 'letra' : 'letras'} ${rule.letter}`
    case 'vowels':
      return `tiene ${NUMBER_WORDS[rule.n]} ${rule.n === 1 ? 'vocal' : 'vocales'}`
    case 'mirror':
      return 'se lee igual al revés'
    case 'sameEnds':
      return 'empieza y termina con la misma letra'
    case 'syllables':
      return `tiene ${NUMBER_WORDS[rule.n]} ${rule.n === 1 ? 'sílaba' : 'sílabas'}`
    case 'rhyme':
      return `rima con «${rule.word}»`
  }
}

/** The sentence of a condition, as the player reads it after "Tocá la palabra que …". */
function describe(rule: Rule): string {
  return rule.kind === 'both' ? `${describeSimple(rule.a)} y ${describeSimple(rule.b)}` : describeSimple(rule)
}

/** What is true of the word for ONE condition, to finish "«PALABRA» …". */
function factsSimple(rule: Simple, word: string): string {
  const ok = meetsSimple(rule, word)
  switch (rule.kind) {
    case 'starts':
      return `empieza con la letra ${firstOf(word).toUpperCase()}`
    case 'startsVowel':
      return isVowel(firstOf(word))
        ? `empieza con una vocal (${firstOf(word).toUpperCase()})`
        : `empieza con ${firstOf(word).toUpperCase()}, que no es vocal`
    case 'ends':
      return `termina en ${lastOf(word).toUpperCase()}`
    case 'length': {
      const k = plain(word).length
      return `tiene ${k} ${k === 1 ? 'letra' : 'letras'}`
    }
    case 'count': {
      const k = countOf(word, rule.letter)
      if (k === 0) return `no tiene ninguna letra ${rule.letter}`
      return k === 1 ? `tiene 1 sola letra ${rule.letter}` : `tiene ${k} letras ${rule.letter}`
    }
    case 'vowels': {
      const k = vowelCount(word)
      return k === 1 ? 'tiene 1 sola vocal' : `tiene ${k} vocales`
    }
    case 'mirror':
      return ok ? `al revés también dice «${word.toUpperCase()}»` : `al revés dice «${reversedOf(word).toUpperCase()}»`
    case 'sameEnds':
      return ok
        ? `empieza y termina con la ${firstOf(word).toUpperCase()}`
        : `empieza con ${firstOf(word).toUpperCase()} y termina en ${lastOf(word).toUpperCase()}`
    case 'syllables': {
      const k = syllablesOf(word).split('-').length
      return `tiene ${k} ${k === 1 ? 'sílaba' : 'sílabas'} (${syllablesOf(word)})`
    }
    case 'rhyme':
      return ok ? `rima con «${rule.word}»: las dos terminan en «-${rule.tail}»` : `no rima con «${rule.word}»`
  }
}

/** Why a word does or does not fit, whichever the condition: «PALABRA» + this + ".". */
function facts(rule: Rule, word: string): string {
  return rule.kind === 'both' ? `${factsSimple(rule.a, word)} y ${factsSimple(rule.b, word)}` : factsSimple(rule, word)
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

interface QuestionContent {
  rule: Rule
  /** The options in their (frozen) display order. */
  options: string[]
}
interface LevelContent {
  questions: QuestionContent[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({
    questions: pickOne(lvl.sets).map((q) => ({ rule: q.rule, options: shuffle(q.options) })),
  }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente razonamiento!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo!']
/** The pause after a right word before the next question; taps are ignored while it runs. */
const ADVANCE_MS = 1400
/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel", "Repetir") is the
 * second tap of a double tap, and it must not answer a question: the words sit right where that button was.
 * Long enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a small example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'Leé la condición de arriba: una sola de las cuatro palabras la cumple.',
    'Tocala. Si no es, esa palabra se apaga y probás con otra.',
  ]
  // Words that are not in the game itself.
  const example = [
    { word: 'monte', fits: false },
    { word: 'torta', fits: true },
    { word: 'juego', fits: false },
    { word: 'plaza', fits: false },
  ]
  return (
    <div className="mt-4 rounded-3xl border border-indigo-600/20 bg-indigo-600/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3">
        <p className="text-center text-base font-semibold text-slate-700">
          Por ejemplo, la que <span className="text-indigo-700">empieza con la letra T</span>:
        </p>
        <div className="mx-auto mt-2 grid max-w-[260px] grid-cols-2 gap-1.5" aria-hidden="true">
          {example.map((e) => (
            <span
              key={e.word}
              className={[
                'flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border-2 text-base font-bold uppercase tracking-wide',
                e.fits ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : 'border-slate-200 bg-slate-50 text-slate-400',
              ].join(' ')}
            >
              {e.word}
              {e.fits && <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />}
            </span>
          ))}
        </div>
      </div>
      {/* Pinned to the bottom edge when the screen is too short to show it in place (320x640). */}
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
  const { questions } = content
  const total = questions.length

  const [qIdx, setQIdx] = useState(0)
  const [wrong, setWrong] = useState<string[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Words already tapped wrong for this question: a double tap on the same word is
  // ONE tap, even when both land before React has repainted it as disabled.
  const tappedRef = useRef<Set<string>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const question = questions[qIdx]
  const { rule, options } = question

  function handleTap(word: string, at: number) {
    // While the right word shows its check (`advancing`) every word is off, which is what swallows a double tap
    // on the RIGHT one; this swallows the one that follows the button that brought the level.
    if (advancing || done || tappedRef.current.has(word) || at - since < SETTLE_MS) return
    tappedRef.current.add(word)
    if (meets(rule, word)) {
      setAdvancing(true)
      setHint({ text: `¡Eso es! «${word.toUpperCase()}» ${facts(rule, word)}.`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setWrong([])
          setAdvancing(false)
          setHint(null)
          tappedRef.current = new Set()
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    setWrong((w) => [...w, word])
    setHint({ text: `«${word.toUpperCase()}» ${facts(rule, word)}. Probá con otra.`, ok: false })
    onMistake()
  }

  // What the player got, for the recap card: each condition with its answer.
  const recap = questions.map((q) => ({ condition: describe(q.rule), answer: q.options.find((o) => meets(q.rule, o)) ?? '' }))

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
          {level.name}
        </span>
        {!done && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Pregunta {qIdx + 1} de {total}
            </span>
            <h2 className="mt-3 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              Tocá la palabra que <span className="text-indigo-700">{describe(rule)}</span>
            </h2>
            {rule.kind === 'both' && (
              <p className="mt-1 text-base font-medium text-slate-500">Tiene que cumplir las dos cosas.</p>
            )}
          </>
        )}
      </div>

      {!done && (
        <>
          <div className="mx-auto mt-4 flex max-w-sm flex-col gap-2.5" role="group" aria-label="Palabras">
            {options.map((word) => {
              const isWrong = wrong.includes(word)
              const isRight = advancing && meets(rule, word)
              return (
                <button
                  key={word}
                  type="button"
                  disabled={isWrong || advancing}
                  onClick={(e) => handleTap(word, e.timeStamp)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 px-3 py-2 text-xl font-bold uppercase tracking-wide transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRight
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-indigo-600/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {word}
                  {isRight && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-3 min-h-[3.5rem] text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
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
          <p className="mt-1 text-slate-600">Respondiste las {total} condiciones. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {recap.map((r) => (
              <li key={r.answer} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold uppercase tracking-wide text-slate-900">{r.answer}</span>
                  <span className="text-slate-500"> — {r.condition}</span>
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

export function PalabrasConCondiciones({ onComplete }: GameProps) {
  // Which set each level plays and the order of its words — decided once, at
  // mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never
  // brings it back.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá la que cumple</h2>
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
