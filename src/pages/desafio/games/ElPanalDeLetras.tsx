import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El panal de letras" — día 27, mes 5, lenguaje. A honeycomb of seven hexagons: six
 * letters around a golden one in the middle. A clue names a word and says how long it
 * is ("Una bebida de 4 letras", and under it a line that points at it), with one empty
 * box per letter. The player taps hexagons to fill the boxes and "Listo" checks the
 * word; a level ends once every clued word has been found. It is month 4's Flor de
 * palabra, with the flower turned into a honeycomb and two rules of its own: the
 * golden letter in the middle goes in EVERY word, and a letter can be used as many
 * times as the word needs (ALA uses the A twice), so the hexagons never grey out.
 *
 * CLUES, NOT AN OPEN SEARCH, the way Flor de palabra learned to be: every word of the
 * round comes with a short, concrete clue and its length. One clue shows at a time and
 * "Otra pista" moves on to the next one not found yet. Any unfound word of the round is
 * accepted whichever clue is showing (two clues can fit the same boxes: ASADO and
 * PASTA are both "una comida de 5 letras"), so forming the other one still counts
 * ("¡También vale!") instead of reading as a mistake. A real word that is not on the
 * list but that a clue can call to mind (TRES for CERO, MANTO for MANTA, PALA or TAPA for
 * PAVA) is told so — "Esa palabra existe, pero no es la de esta pista." — and costs
 * nothing: each word may carry a short `soft` list of them (same length as the word,
 * formable in that honeycomb), and the boxes clear to try again. Any other word that is
 * not on the list costs one mistake and the boxes clear; a word that leaves out the
 * golden letter is told so ("Falta la letra dorada."). Checking waits for "Listo"
 * instead of firing when the boxes fill, so a mis-tapped last letter can be fixed first,
 * and "Borrar" takes back the last letter. Mistakes are muted gray, never red; nothing is
 * timed except the short pause that lets a right word be seen before the boxes clear.
 *
 * Double taps: a second tap on the same hexagon right after the first is not another
 * letter, it is ignored for SETTLE_MS (no word of the game has the same letter twice in a
 * row, no LL and no RR, so the guard can never swallow a letter somebody really needs).
 * "Borrar" and "Otra pista" each ignore a second tap within SETTLE_MS of their own last
 * one, so a double tap takes back one letter and skips one clue, not two. Every tap
 * within SETTLE_MS of the tap that brought the level (judged by the click's own
 * timeStamp) is ignored too, so the second tap of a double tap on "Empezar", "Siguiente
 * nivel" or "Repetir" never puts a letter in the boxes (the honeycomb sits right where
 * that button was). The solved card is scrolled into view, and so is its button, on a
 * short phone; a new level opens at its top.
 *
 * Letters and words are plain A-Z (no accents, no Ñ), the convention of the whole
 * catalog: CAMION-style straight string comparison, so every word here is one that
 * is written without accents anyway. Ramp: 3 words (3-4 letters, A in the middle) →
 * 4 words (4-5 letters, a consonant in the middle) → 5 words (5-6 letters, another
 * consonant). ONE honeycomb per level: each level has two authored ones and one is
 * picked ONCE at mount (`epoch`); the letters never move, so "Repetir" replays exactly
 * the same three. Both honeycombs of a level ask for the same number of words, and
 * between them they use every one of the seven letters. A throwaway Node script (not
 * committed) checks, for every word, that it uses only letters of its honeycomb,
 * that it contains the golden one, that its length is the one the clue announces and
 * that no clue gives away the word or any other of its honeycomb; that every `soft`
 * word can be formed in its honeycomb and is not an answer there; and that the how-to's
 * example (EXAMPLE_WORD) can be formed in none of the six, so it hands out no answer
 * and costs nothing when somebody copies it.
 *
 * Per-level state lives in <LevelView>, keyed by run + level. A "¿Cómo se juega?"
 * screen opens the day; "Repetir" never brings it back.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface ClueWord {
  /** Plain A-Z: no accents, no Ñ, no letter twice in a row. */
  word: string
  /** Completes "{kind} de N letras": a short noun phrase with its article. */
  kind: string
  /** One concrete line that points at this word and no other of its honeycomb. */
  hint: string
  /**
   * Real words of this honeycomb that the clue can also call to mind (TRES for CERO) but that
   * are not answers of the round: told so, no mistake. As long as `word`, written with the
   * letters of the honeycomb and its golden one, never another word of the round.
   */
  soft?: string[]
}
interface PanalDef {
  /** The golden letter in the middle: in every word. */
  center: string
  /** The six letters around it, clockwise from the upper left. */
  outer: string[]
  /** Every word the round asks for, in the order their clues come up (shortest first). */
  words: ClueWord[]
}
interface LevelDef {
  name: string
  /** Two authored honeycombs; one is picked at mount. */
  panales: PanalDef[]
}

// Every honeycomb of a level asks for the same number of words, so TOTAL_WORDS never
// depends on which one is drawn. Each word uses only the seven letters of its
// honeycomb, always the golden one, and the seven letters are all used by some word.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    panales: [
      {
        center: 'A',
        outer: ['M', 'T', 'E', 'P', 'V', 'L'],
        words: [
          { word: 'ALA', kind: 'Una parte del cuerpo', hint: 'La mueven las aves para volar' },
          { word: 'MATE', kind: 'Una bebida', hint: 'Se toma con bombilla' },
          {
            word: 'PAVA',
            kind: 'Un objeto',
            hint: 'Sirve para calentar el agua',
            soft: ['PALA', 'TAPA', 'LATA', 'VELA', 'MAPA'],
          },
        ],
      },
      {
        center: 'A',
        outer: ['O', 'L', 'C', 'U', 'N', 'S'],
        words: [
          { word: 'OLA', kind: 'Algo del mar', hint: 'Viene con espuma y rompe en la orilla', soft: ['SAL'] },
          { word: 'CUNA', kind: 'Un mueble', hint: 'Se mece para que el bebé se duerma' },
          { word: 'SACO', kind: 'Una prenda', hint: 'Abriga, tiene solapas y botones' },
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    panales: [
      {
        center: 'S',
        outer: ['A', 'O', 'D', 'P', 'T', 'E'],
        words: [
          { word: 'SODA', kind: 'Una bebida', hint: 'Agua con burbujas, de sifón' },
          { word: 'ASADO', kind: 'Una comida', hint: 'Se hace en la parrilla, con amigos' },
          { word: 'POSTE', kind: 'Un palo', hint: 'Sostiene los cables de la luz' },
          { word: 'PASTA', kind: 'Una comida', hint: 'Los fideos y los ravioles son de este tipo' },
        ],
      },
      {
        center: 'R',
        outer: ['A', 'C', 'E', 'O', 'S', 'T'],
        words: [
          { word: 'CERO', kind: 'Un número', hint: 'El que no suma nada', soft: ['TRES'] },
          { word: 'ROCA', kind: 'Una piedra', hint: 'De las grandes, que no se mueven' },
          { word: 'CARTA', kind: 'Un papel', hint: 'Se escribe, va en un sobre y se manda' },
          { word: 'ROSCA', kind: 'Un pan dulce', hint: 'Tiene forma de aro y se come en Pascua' },
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    panales: [
      {
        center: 'C',
        outer: ['O', 'I', 'N', 'A', 'S', 'T'],
        words: [
          { word: 'COSTA', kind: 'Un paisaje', hint: 'La orilla del mar, con playas' },
          { word: 'CANTO', kind: 'Un sonido', hint: 'Lo que hacen los pájaros al amanecer' },
          { word: 'CINTA', kind: 'Una tira', hint: 'De tela, para atar el moño de un regalo' },
          { word: 'OCASO', kind: 'Un momento', hint: 'Cuando el sol se esconde, al final de la tarde' },
          { word: 'COCINA', kind: 'Una habitación', hint: 'Ahí se prepara la comida' },
        ],
      },
      {
        center: 'M',
        outer: ['T', 'O', 'E', 'A', 'N', 'S'],
        words: [
          { word: 'MONTE', kind: 'Un lugar', hint: 'Terreno con muchos árboles y arbustos' },
          { word: 'MENTA', kind: 'Una hierba', hint: 'Da un sabor fresco a las infusiones' },
          { word: 'MANTA', kind: 'Algo para la cama', hint: 'Abriga cuando hace frío', soft: ['MANTO'] },
          { word: 'TOMATE', kind: 'Una verdura', hint: 'Es roja y va en la ensalada' },
          { word: 'SEMANA', kind: 'Un período', hint: 'Siete días, de lunes a domingo' },
        ],
      },
    ],
  },
]

const TOTAL_WORDS = LEVELS.reduce((sum, lvl) => sum + lvl.panales[0].words.length, 0)

/** The seven letters of a honeycomb in hexagon order: 0 is the golden one, 1-6 go clockwise from the upper left. */
function lettersOf(p: PanalDef): string[] {
  return [p.center, ...p.outer]
}

/** "Una bebida de 4 letras". */
function clueLine(w: ClueWord): string {
  return `${w.kind} de ${w.word.length} letras`
}

/** A real word of the honeycomb that is not an answer of the round: told so, no mistake (see `ClueWord.soft`). */
function isSoftWord(p: PanalDef, word: string): boolean {
  return p.words.some((w) => w.soft?.includes(word))
}

/** The how-to's example: it uses the golden A twice, and no honeycomb has a G, so no honeycomb can form it
 * (it gives no answer away and costs nothing if somebody copies it). */
const EXAMPLE_WORD = 'AGUA'

/** Where each hexagon sits, as [left, top] in percent of the honeycomb box. A hexagon is
 * 33.333% wide and 40% tall; rows overlap by a quarter of a hexagon, columns by half. */
const HEX_POS: [number, number][] = [
  [33.333, 30],
  [16.667, 0],
  [50, 0],
  [66.667, 30],
  [50, 60],
  [16.667, 60],
  [0, 30],
]
// ── data:end ──

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface LevelContent {
  panal: PanalDef
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({ panal: pickOne(lvl.panales) }))
}

/** A second tap on the same hexagon this soon, or a tap this soon after the tap that brought the screen
 * here ("Empezar", "Siguiente nivel", "Repetir"), is the second tap of a double tap: it must not add a
 * letter (the honeycomb sits right where that button was). Long enough to swallow a double tap, short
 * enough that nobody who means it notices. */
const SETTLE_MS = 400
/** How long a right word stays on screen, in green, before the boxes clear. */
const CORRECT_MS = 800

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen vocabulario!']
// Kept to one line even at 320px (about 28 characters): the feedback line has a fixed
// height so a message never moves the honeycomb.
const HINTS = ['No es esa. Leé la pista.', 'Todavía no. Probá otra.', 'Casi. Pensá en la pista.']
const NUDGES_REPEAT = ['Esa ya la encontraste.', 'Ya la tenés. Buscá otra.']
const MISSING_CENTER = 'Falta la letra dorada.'
// The one message that wraps to two lines on a phone: the clue card is a line taller while it shows.
const SOFT_MESSAGE = 'Esa palabra existe, pero no es la de esta pista.'
const REMINDER = 'Todas llevan la letra dorada.'

/** The outline of a hexagon, pointy side up, a little smaller than its cell so neighbours never touch. */
const HEX_POINTS = '50,3.5 96.5,26.75 96.5,73.25 50,96.5 3.5,73.25 3.5,26.75'
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a four-box example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'Armá cada palabra tocando las letras del panal. Podés repetir una letra.',
    'Todas las palabras llevan la letra dorada, la del medio.',
  ]
  const box = 'flex h-11 w-11 items-center justify-center rounded-lg border-2 border-amber-600 bg-white text-xl font-bold text-slate-900'
  return (
    <div className="mt-4 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {EXAMPLE_WORD.split('').map((letter, i) => (
            <span key={i} className={box}>
              {letter}
            </span>
          ))}
        </div>
        <p className="mt-2 text-base leading-snug text-slate-700">
          Con la A en el medio, {EXAMPLE_WORD} usa la A dos veces.
        </p>
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
  const { panal } = content
  const letters = lettersOf(panal)
  const target = panal.words.length

  const [building, setBuilding] = useState<number[]>([]) // hexagon indices, in tap order
  const [found, setFound] = useState<string[]>([])
  // Where the clue search starts; the clue on screen is the first unfound word from here on.
  const [clueIdx, setClueIdx] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  // A right word waiting a moment on screen before it locks in.
  const [correctWord, setCorrectWord] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const lastTapRef = useRef<{ hex: number; at: number } | null>(null)
  // The last accepted "Borrar" and "Otra pista" taps: a second one this soon is a double tap, not
  // another letter taken back or another clue skipped.
  const eraseAtRef = useRef(-Infinity)
  const skipAtRef = useRef(-Infinity)
  const correctTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(correctTimerRef.current), [])

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

  let currentClue: ClueWord | null = null
  for (let k = 0; k < target; k++) {
    const candidate = panal.words[(clueIdx + k) % target]
    if (!found.includes(candidate.word)) {
      currentClue = candidate
      break
    }
  }
  const unfoundCount = target - found.length
  const boxesFull = currentClue !== null && building.length === currentClue.word.length
  const builtSoFar = building.map((i) => letters[i]).join('')

  function tapHex(hex: number, at: number) {
    // The second tap of a double tap on the button that brought the level lands on a hexagon: ignore it.
    if (correctWord || !currentClue || building.length >= currentClue.word.length || at - since < SETTLE_MS) return
    // A second tap on the same hexagon this soon is a double tap, not another letter.
    const last = lastTapRef.current
    if (last !== null && last.hex === hex && at - last.at < SETTLE_MS) return
    lastTapRef.current = { hex, at }
    setHint(null)
    setBuilding((prev) => [...prev, hex])
  }
  function eraseLast(at: number) {
    if (correctWord || building.length === 0 || at - eraseAtRef.current < SETTLE_MS) return
    eraseAtRef.current = at
    lastTapRef.current = null
    setHint(null)
    setBuilding((prev) => prev.slice(0, -1))
  }
  function nextClue(at: number) {
    if (!currentClue || correctWord || at - since < SETTLE_MS || at - skipAtRef.current < SETTLE_MS) return
    skipAtRef.current = at
    setClueIdx((panal.words.findIndex((w) => w.word === currentClue.word) + 1) % target)
    lastTapRef.current = null
    setBuilding([])
    setHint(null)
  }
  function submit() {
    if (!boxesFull || correctWord) return
    lastTapRef.current = null
    if (found.includes(builtSoFar)) {
      setHint(pickOne(NUDGES_REPEAT))
      setBuilding([])
      return
    }
    if (panal.words.some((w) => w.word === builtSoFar)) {
      const word = builtSoFar
      const nextFound = [...found, word]
      setHint(null)
      setCorrectWord(word)
      correctTimerRef.current = window.setTimeout(() => {
        setFound(nextFound)
        setBuilding([])
        setCorrectWord(null)
        if (nextFound.length >= target) {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, CORRECT_MS)
      return
    }
    if (isSoftWord(panal, builtSoFar)) {
      // A real word, just not an answer of this round: told so, no mistake, and the boxes clear to try again.
      setHint(SOFT_MESSAGE)
      setBuilding([])
      return
    }
    onMistake()
    setHint(builtSoFar.includes(panal.center) ? pickOne(HINTS) : MISSING_CENTER)
    setBuilding([])
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
          {level.name}
        </span>
        {!done && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Llevás {found.length} de {target}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">Formá las palabras</h2>
          </>
        )}
      </div>

      {!done && currentClue && (
        <>
          {/* The words already found */}
          {found.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-sm font-semibold text-slate-600">
              <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />
              <span className="sr-only">Palabras encontradas:</span>
              {found.join(' · ')}
            </p>
          )}

          {/* The clue and the boxes */}
          <div className="mx-auto mt-2 max-w-sm rounded-2xl border-2 border-amber-600/20 bg-amber-50 px-3 pb-2 pt-2 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Pista</p>
            <p className="text-balance text-lg font-bold leading-snug text-slate-900">{clueLine(currentClue)}</p>
            <p className="text-base leading-snug text-slate-700">{currentClue.hint}</p>
            <div
              className="mt-2 flex justify-center gap-1.5"
              role="img"
              aria-label={`Palabra de ${currentClue.word.length} letras${builtSoFar ? `: ${builtSoFar}` : ''}`}
            >
              {currentClue.word.split('').map((_, i) => {
                const hex = building[i]
                return (
                  <span
                    key={i}
                    className={[
                      'flex h-10 w-9 items-center justify-center rounded-lg border-2 text-xl font-bold text-slate-900 max-[350px]:w-8',
                      hex === undefined
                        ? 'border-dashed border-slate-300 bg-white'
                        : correctWord
                          ? 'border-tiam-green bg-tiam-green/10'
                          : 'border-amber-600 bg-white',
                    ].join(' ')}
                  >
                    {hex === undefined ? '' : letters[hex]}
                  </span>
                )
              })}
            </div>
            <p
              role="status"
              className="mt-1 flex min-h-[24px] items-center justify-center gap-1 text-base font-medium text-slate-500"
            >
              {correctWord ? (
                <span className="inline-flex items-center gap-1 font-bold text-green-700">
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  {correctWord === currentClue.word ? '¡Correcto!' : '¡También vale!'}
                </span>
              ) : (
                (hint ?? REMINDER)
              )}
            </p>
          </div>

          {/* The honeycomb: the golden letter in the middle, six around it */}
          <div role="group" aria-label="Letras del panal" className="relative mx-auto mt-3 w-[198px] max-[350px]:w-[182px]" style={{ aspectRatio: '1.039' }}>
            {HEX_POS.map(([left, top], hex) => {
              const isCenter = hex === 0
              return (
                <button
                  key={hex}
                  type="button"
                  disabled={!!correctWord}
                  onClick={(e) => tapHex(hex, e.timeStamp)}
                  aria-label={isCenter ? `Letra ${letters[hex]}, la del medio` : `Letra ${letters[hex]}`}
                  className="group absolute flex items-center justify-center transition-transform focus:outline-hidden active:scale-95 disabled:cursor-default"
                  style={{ left: `${left}%`, top: `${top}%`, width: '33.333%', height: '40%', clipPath: HEX_CLIP }}
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                    className="absolute inset-0 h-full w-full"
                  >
                    <polygon
                      points={HEX_POINTS}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      className={
                        isCenter
                          ? 'fill-amber-300 stroke-amber-600 group-hover:fill-amber-200 group-focus-visible:stroke-tiam-blue group-focus-visible:[stroke-width:5]'
                          : 'fill-amber-50 stroke-amber-400 group-hover:fill-amber-100 group-focus-visible:stroke-tiam-blue group-focus-visible:[stroke-width:5]'
                      }
                    />
                  </svg>
                  <span className="relative text-3xl font-bold text-slate-900">{letters[hex]}</span>
                </button>
              )
            })}
          </div>

          {/* Three buttons that share the width: on a 320px phone "Otra pista" takes two lines */}
          <div className="mx-auto mt-3 flex max-w-sm gap-2">
            <button
              type="button"
              onClick={(e) => eraseLast(e.timeStamp)}
              disabled={building.length === 0 || !!correctWord}
              className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-xl border border-slate-200 px-2 text-center font-semibold leading-tight text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
            >
              Borrar
            </button>
            {unfoundCount > 1 && (
              <button
                type="button"
                onClick={(e) => nextClue(e.timeStamp)}
                disabled={!!correctWord}
                className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-xl border border-slate-200 px-2 text-center font-semibold leading-tight text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
              >
                Otra pista
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!boxesFull || !!correctWord}
              className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-xl bg-tiam-blue px-2 text-center font-semibold leading-tight text-white transition hover:bg-tiam-blue-dark disabled:cursor-default disabled:opacity-40"
            >
              Listo
            </button>
          </div>
        </>
      )}

      {/* Level complete: the honeycomb gives its room to the card */}
      {done && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste las {target} palabras: {found.join(', ')}. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
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

export function ElPanalDeLetras({ onComplete }: GameProps) {
  // Which honeycomb each level plays — decided once, at mount, so "Repetir" replays
  // exactly the same content.
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Formá las palabras</h2>
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
