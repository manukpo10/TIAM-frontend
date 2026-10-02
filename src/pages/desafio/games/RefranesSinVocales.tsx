import { useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Refranes sin vocales" — día 7, mes 5, lenguaje. Words and sayings with every
 * vowel taken out: the consonants stay where they are and each missing vowel
 * is a blank, filled one at a time with a five-button picker (A E I O U). The
 * blank you are on is highlighted; a right vowel drops in and the highlight
 * moves to the next one on its own, left to right, so the player never has to
 * aim at a small target — the only taps are on the five big buttons.
 *
 * Word games must never be a guessing game, so every item states what it is: a
 * category for the words of level 1 ("son dos frutas") and the topic of the
 * refrán for levels 2 and 3 ("habla de …"); the consonants and the number of
 * blanks already give each word's length and shape. A vowel the saying does not
 * have there greys out for that blank (the choices shrink instead of repeating
 * the same mistake) and costs one mistake — at most four per blank.
 *
 * Ramp by number of blanks: 6 (two short words) → 10 (a five-word refrán) → 14
 * (a longer refrán). Every refrán is traditional and written WITHOUT accents on
 * the vowels, so five buttons are always enough; a throwaway Node script (not
 * committed) confirmed each item has exactly the level's blank count, so
 * TOTAL_BLANKS never depends on which one is drawn.
 *
 * ONE item per level: each level has two authored ones and one is picked ONCE
 * at mount (`epoch`), so "Repetir" replays exactly the same three. Per-level
 * state lives in <LevelView>, keyed by run + level.
 *
 * totalAttempts = mistakes + every blank of the day (TOTAL_BLANKS, derived).
 */

// ── data:start ──
interface ItemSet {
  /** Completes "Pista: …". */
  clue: string
  /** One entry per line shown; every vowel in them is a blank. */
  lines: string[]
}
interface LevelDef {
  name: string
  heading: string
  /** Blanks every item of the level has. */
  blanks: number
  items: ItemSet[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    heading: 'Completá las vocales de las palabras',
    blanks: 6,
    items: [
      { clue: 'son dos frutas', lines: ['cereza', 'durazno'] },
      { clue: 'son dos animales', lines: ['conejo', 'tortuga'] },
    ],
  },
  {
    name: 'Nivel 2',
    heading: 'Completá el refrán',
    blanks: 10,
    items: [
      { clue: 'habla de quien grita mucho y hace poco', lines: ['Perro que ladra no muerde'] },
      { clue: 'habla de cómo tomar los momentos difíciles', lines: ['Al mal tiempo, buena cara'] },
    ],
  },
  {
    name: 'Nivel 3',
    heading: 'Completá el refrán',
    blanks: 14,
    items: [
      { clue: 'habla de querer hacer demasiadas cosas a la vez', lines: ['Quien mucho abarca poco aprieta'] },
      { clue: 'habla de que todos nos equivocamos alguna vez', lines: ['El que tiene boca se equivoca'] },
    ],
  },
]

const VOWELS = ['A', 'E', 'I', 'O', 'U']

const isVowel = (ch: string) => 'aeiou'.includes(ch.toLowerCase())

/** The vowels of an item, in reading order — the answers to its blanks. */
function blanksOf(item: ItemSet): string[] {
  return item.lines
    .join('')
    .split('')
    .filter(isVowel)
    .map((ch) => ch.toUpperCase())
}

const TOTAL_BLANKS = LEVELS.reduce((sum, lvl) => sum + lvl.blanks, 0)
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface Cell {
  char: string
  /** Index of the blank this cell hides, or null for a consonant / punctuation. */
  blank: number | null
  /** False for punctuation (a comma), which gets a narrow cell. */
  letter: boolean
}

/** lines → words → cells, numbering the vowels (the blanks) in reading order. */
function layout(item: ItemSet): Cell[][][] {
  let next = 0
  return item.lines.map((line) =>
    line.split(' ').map((word) =>
      word.split('').map((raw) => ({
        char: raw.toUpperCase(),
        blank: isVowel(raw) ? next++ : null,
        letter: /\p{L}/u.test(raw),
      })),
    ),
  )
}

interface LevelContent {
  item: ItemSet
  rows: Cell[][][]
  answers: string[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const item = pickOne(lvl.items)
    return { item, rows: layout(item), answers: blanksOf(item) }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se completa!', '¡Perfecto!']
const NUDGES = [
  'Esa vocal no va ahí. Probá con otra.',
  'Todavía no. Leelo en voz alta y fijate qué vocal suena bien.',
  'Casi. Probá con otra vocal.',
]

// Full class strings, never interpolated: Tailwind only emits classes it can
// read literally in the source. Sizes are fitted so the longest word of each
// level stays inside the grey box on one line, down to a 320px phone (240px
// inside the box): level 1's 7-letter words take 7 × 32px + 6 × 2px = 236px.
// A comma gets a narrow cell of its own, and the gap between WORDS (32px) is
// wider than a whole letter cell (24-32px + 2px), so word breaks read clearly.
const CELL_CLASS = [
  { box: 'h-12 w-8 text-3xl', punct: 'h-12 w-3 text-3xl' },
  { box: 'h-11 w-6 text-2xl', punct: 'h-11 w-2.5 text-2xl' },
  { box: 'h-10 w-6 text-xl', punct: 'h-10 w-2 text-xl' },
]

interface LevelViewProps {
  levelIdx: number
  content: LevelContent
  onMistake: () => void
  onSolved: () => void
  onNext: () => void
  onRepeat: () => void
}

function LevelView({ levelIdx, content, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { item, rows, answers } = content
  const total = answers.length

  // How many blanks are filled: the blank to fill now is `filled`.
  const [filled, setFilled] = useState(0)
  const [wrongVowels, setWrongVowels] = useState<string[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])

  const solved = filled >= total
  const cellClass = CELL_CLASS[levelIdx]

  function handlePick(vowel: string) {
    if (solved || wrongVowels.includes(vowel)) return
    if (vowel === answers[filled]) {
      setFilled(filled + 1)
      setWrongVowels([])
      setHint(null)
      if (filled + 1 >= total) {
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setWrongVowels((w) => [...w, vowel])
      setHint(pickOne(NUDGES))
      onMistake()
    }
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{level.heading}</h2>
            <p className="mt-2 text-base text-slate-500">
              Pista: <span className="font-bold text-green-700">{item.clue}</span>.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Vocales: {filled} de {total}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(filled / total) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* The text with its blanks — stays on screen, completed, once solved */}
      <div
        role="group"
        aria-label={`Pista: ${item.clue}`}
        className="mt-5 flex flex-col items-center gap-3 rounded-2xl bg-slate-50 px-2 py-4"
      >
        {rows.map((words, li) => (
          <div key={li} className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            {words.map((cells, wi) => (
              <span key={wi} className="inline-flex gap-0.5">
                {cells.map((cell, ci) => {
                  if (!cell.letter) {
                    return (
                      <span
                        key={ci}
                        className={`flex items-center justify-center font-bold text-slate-800 ${cellClass.punct}`}
                      >
                        {cell.char}
                      </span>
                    )
                  }
                  const base = `flex items-center justify-center rounded-md font-bold ${cellClass.box}`
                  if (cell.blank === null) {
                    return (
                      <span key={ci} className={`${base} text-slate-800`}>
                        {cell.char}
                      </span>
                    )
                  }
                  if (cell.blank < filled) {
                    return (
                      <span key={ci} className={`${base} bg-tiam-green/10 text-green-700`}>
                        {cell.char}
                      </span>
                    )
                  }
                  const isCurrent = cell.blank === filled
                  return (
                    <span
                      key={ci}
                      aria-hidden="true"
                      className={[
                        base,
                        'border-b-4',
                        isCurrent
                          ? 'border-tiam-blue bg-tiam-blue/10 motion-safe:animate-pulse'
                          : 'border-slate-300',
                      ].join(' ')}
                    />
                  )
                })}
              </span>
            ))}
          </div>
        ))}
      </div>

      {!solved && (
        <>
          {/* The five vowels */}
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-5 gap-2">
            {VOWELS.map((v) => {
              const isWrong = wrongVowels.includes(v)
              return (
                <button
                  key={v}
                  type="button"
                  disabled={isWrong}
                  onClick={() => handlePick(v)}
                  className={[
                    'min-h-[56px] rounded-xl border-2 text-2xl font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40',
                    isWrong
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {v}
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-4 min-h-[3rem] text-center text-base font-medium text-slate-500">
            {hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Pusiste las {total} vocales en su lugar. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={onRepeat}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
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

export function RefranesSinVocales({ onComplete }: GameProps) {
  // Which item each level plays — decided once, at mount, so "Repetir" plays
  // exactly the same content.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_BLANKS })
  }
  function handleRepeat() {
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={() => setLevelIdx((i) => i + 1)}
      onRepeat={handleRepeat}
    />
  )
}
