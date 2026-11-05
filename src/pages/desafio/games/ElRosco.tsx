import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, Eye, RotateCcw, SkipForward, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El rosco" — día 24, mes 6, lenguaje. A row of letters: each letter has a definition and the player writes the word
 * it defines, on an on-screen keyboard. The clue says whether the word STARTS WITH that letter or just CONTAINS it, so
 * the first letter is not given, only the number of letters (one box each). A word that does not come can be passed with
 * "Paso": the wheel goes on and the passed letters come back after the last one. The mechanic comes from a worksheet of
 * a letter wheel with one definition per letter; the letters, words and clues are TIAM's own, and the name of the TV
 * show the wheel is known for is deliberately not used anywhere.
 *
 * IT ALWAYS ENDS, AND NOBODY IS STUCK. A pass is allowed only the FIRST time a letter comes up. When it comes back (second
 * round) "Paso" is replaced by "Ver la respuesta", which shows the word, marks the letter with an eye and costs one mistake,
 * so the wheel cannot go round for ever. Inside a turn a wrong word costs ONE mistake, empties the boxes and gives a hint
 * that grows with the misses on that word: the tip, then the first two letters. Nothing is red and nothing is timed but a short
 * pause so the finished word (or the shown answer) is seen. Each letter of the wheel shows its state with an icon as well
 * as a colour: a check (right), a skip arrow (passed, waiting) or an eye (shown).
 *
 * WHAT MAKES IT A DIFFERENT ACTIVITY FROM "Una palabra por letra" (mes 5), which also asks for a word from a definition on
 * the same keyboard: there the first letter is given and filled in the first box, each word is a separate question and
 * there is no way to defer one. Here the first letter is NOT given (half of the clues say "contiene" and the letter can be
 * anywhere), the letters form a wheel with a visible state, and the player decides the order by passing. None of its words
 * is used (the check script rejects them), nor the worksheet's.
 *
 * SHORT, AS THE TALLERISTA PREFERS: about three items a level is her preference, but a wheel of three letters is hardly a wheel,
 * so the wheels have 4, 4 and 5 letters (13 words). The wheel is a row of circles (not a ring): a ring needs a centre label and a clue box beside it, which on a 320×568 phone pushes the last keyboard row under the sticky "Paso / Listo" bar. Ramp: level 1 plain "empieza con" words, level 2 mixes "contiene" with
 * rarer letters, level 3 has a five-letter wheel with long words and less direct clues. Each level is authored once, in
 * alphabetical order around the wheel, so "Repetir" replays exactly the same wheels.
 *
 * KEYBOARD. A to Z and Ñ (no accents: words are compared as plain letters and shown with their accent when found) and a key
 * to take back the last letter, seven to a row, as wide as the screen allows (the card has no side padding to spare). The boxes are one per letter and never wrap, so a long word cannot push
 * the screen sideways. A tap within SETTLE_MS of the one that brought the level, or a letter or button while a right
 * word is shown, is ignored.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface ItemDef {
  /** The letter of the wheel. */
  letter: string
  /** 'E': the word starts with the letter; 'C': it contains it. */
  mode: 'E' | 'C'
  /** Plain capital letters (A-Z and Ñ, no accents): what the keyboard writes. */
  word: string
  /** The word as it is written, with its accent. */
  display: string
  /** What the word is. It never contains the word. */
  clue: string
  /** A second clue, for after the first miss. */
  tip: string
}
interface LevelDef {
  name: string
  /** Items in the order of the wheel (alphabetical by letter). */
  items: ItemDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    items: [
      {
        letter: 'G',
        mode: 'E',
        word: 'GUANTE',
        display: 'guante',
        clue: 'Prenda que abriga cada mano en invierno.',
        tip: 'Viene de a pares y tiene un lugar para cada dedo.',
      },
      {
        letter: 'H',
        mode: 'E',
        word: 'HILO',
        display: 'hilo',
        clue: 'Se pasa por el ojo de la aguja para coser.',
        tip: 'Hay de muchos colores, enrollado en un carretel.',
      },
      {
        letter: 'M',
        mode: 'E',
        word: 'MANTEL',
        display: 'mantel',
        clue: 'Tela que cubre la mesa a la hora de comer.',
        tip: 'Se lava seguido, sobre todo si se cae la salsa.',
      },
      {
        letter: 'V',
        mode: 'E',
        word: 'VACUNA',
        display: 'vacuna',
        clue: 'Pinchazo que protege de una enfermedad.',
        tip: 'Se aplica en el brazo, en la sala de enfermería.',
      },
    ],
  },
  {
    name: 'Nivel 2',
    items: [
      {
        letter: 'B',
        mode: 'E',
        word: 'BOLETO',
        display: 'boleto',
        clue: 'Papelito que se compra para poder viajar.',
        tip: 'Se le muestra al guarda o al inspector.',
      },
      {
        letter: 'C',
        mode: 'C',
        word: 'RECETA',
        display: 'receta',
        clue: 'Papel donde el médico anota los remedios que hay que tomar.',
        tip: 'También se llama así a la lista de pasos para cocinar un plato.',
      },
      {
        letter: 'J',
        mode: 'C',
        word: 'RELOJERO',
        display: 'relojero',
        clue: 'Persona que arregla los aparatos que dan la hora.',
        tip: 'Trabaja con lupa y herramientas muy chiquitas.',
      },
      {
        letter: 'Q',
        mode: 'C',
        word: 'BANQUETE',
        display: 'banquete',
        clue: 'Comida grande y festiva, con muchos invitados.',
        tip: 'Se sirve en casamientos y en fiestas importantes.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    items: [
      {
        letter: 'A',
        mode: 'E',
        word: 'AGUINALDO',
        display: 'aguinaldo',
        clue: 'Pago extra que se cobra a fin de año.',
        tip: 'Es parecido a medio sueldo y llega en diciembre.',
      },
      {
        letter: 'N',
        mode: 'E',
        word: 'NEBLINA',
        display: 'neblina',
        clue: 'Nube baja que no deja ver a lo lejos.',
        tip: 'Aparece en las mañanas frías, sobre el río o la ruta.',
      },
      {
        letter: 'S',
        mode: 'E',
        word: 'SINFONIA',
        display: 'sinfonía',
        clue: 'Composición musical larga, hecha de varias partes.',
        tip: 'Beethoven escribió nueve.',
      },
      {
        letter: 'V',
        mode: 'C',
        word: 'NOVELA',
        display: 'novela',
        clue: 'Libro largo que cuenta una historia inventada.',
        tip: 'Hay de amor, de misterio y de aventuras.',
      },
      {
        letter: 'X',
        mode: 'C',
        word: 'EXTINTOR',
        display: 'extintor',
        clue: 'Aparato rojo que se usa para apagar un incendio.',
        tip: 'Se guarda en la pared de la cocina o del garaje.',
      },
    ],
  },
]
const TOTAL_WORDS = LEVELS.reduce((n, l) => n + l.items.length, 0)

/** The word of the how-to screen: it is not in the game. */
const EXAMPLE = { clue: 'Fruta amarilla y alargada que se pela para comerla.', word: 'PLATANO', display: 'plátano' }

/** The 27 letters of the keyboard, seven to a row: with the key that takes a letter back they fill four rows exactly. */
const LETTERS = [...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ']
// ── data:end ──

type Status = 'pending' | 'right' | 'passed' | 'shown'

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen vocabulario!', '¡Perfecto!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
/** The pause after a right word (or a shown answer), with the word on screen, before the wheel goes on. */
const ADVANCE_MS = 1700
/** A tap this soon after the tap that brought the level is the second tap of a double tap and must not type a letter. */
const SETTLE_MS = 400

const KEY_CLASS =
  'flex min-h-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-xl font-bold text-slate-800 transition ' +
  'hover:border-tiam-blue/40 active:bg-tiam-blue/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:opacity-50'
const NEXT_BUTTON =
  'inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark'

/** The wheel, laid out as a row: one circle per letter, in the order of the wheel; the current one is filled and the others
 * show their state with an icon. The level (or "2.ª vuelta") is written next to it. */
function Wheel({ items, status, cur, label }: { items: ItemDef[]; status: Status[]; cur: number; label: string }) {
  const n = items.length
  return (
    <div className="flex items-center justify-between gap-2">
      <div
        role="img"
        aria-label={`Rosco de ${n} letras: ${items.map((it, i) => `${it.letter} ${status[i] === 'right' ? 'resuelta' : status[i] === 'passed' ? 'pasada' : status[i] === 'shown' ? 'mostrada' : i === cur ? 'actual' : 'pendiente'}`).join(', ')}`}
        className="flex gap-1"
      >
        {items.map((it, i) => {
          const s = status[i]
          return (
            <span
              key={it.letter}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-base font-extrabold',
                s === 'right'
                  ? 'border-tiam-green bg-tiam-green/15 text-slate-900'
                  : s === 'shown'
                    ? 'border-slate-300 bg-slate-100 text-slate-500'
                    : i === cur
                      ? 'border-tiam-blue bg-tiam-blue text-white ring-4 ring-tiam-blue/25'
                      : s === 'passed'
                        ? 'border-dashed border-tiam-orange bg-white text-slate-800'
                        : 'border-slate-300 bg-white text-slate-800',
              ].join(' ')}
            >
              {s === 'right' ? (
                <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />
              ) : s === 'shown' ? (
                <Eye className="h-4 w-4" aria-hidden="true" />
              ) : s === 'passed' && i !== cur ? (
                <SkipForward className="h-4 w-4 text-slate-700" aria-hidden="true" />
              ) : (
                it.letter
              )}
            </span>
          )
        })}
      </div>
      <span className="shrink-0 text-base font-bold text-slate-500">{label}</span>
    </div>
  )
}

/** One box per letter of the word; never wraps. */
function WordBoxes({ word, typed, tone }: { word: string; typed: string; tone: 'idle' | 'right' | 'shown' }) {
  return (
    <div
      role="img"
      aria-label={`Palabra de ${word.length} letras${typed ? `. Escribiste: ${typed}` : ''}`}
      className="flex justify-center gap-1"
    >
      {[...word].map((_, i) => (
        <span
          key={i}
          className={[
            'flex h-10 min-w-0 max-w-[34px] flex-1 items-center justify-center rounded-lg border-2 text-xl font-extrabold',
            tone === 'right'
              ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
              : tone === 'shown'
                ? 'border-slate-400 bg-slate-100 text-slate-700'
                : typed[i]
                  ? 'border-slate-400 bg-white text-slate-900'
                  : 'border-dashed border-slate-300 bg-white',
          ].join(' ')}
        >
          {typed[i]}
        </span>
      ))}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Cada letra del rosco tiene una definición. La pista dice si la palabra empieza con esa letra o si solo la contiene.',
    'Escribila con el teclado y tocá «Listo». Si no te sale, tocá «Paso»: esa letra vuelve más tarde.',
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
        <p className="mt-1 text-sm font-bold uppercase tracking-wide text-tiam-blue">Empieza con la P · {EXAMPLE.word.length} letras</p>
        <p className="text-lg font-bold leading-snug text-slate-900">«{EXAMPLE.clue}»</p>
        <p className="mt-1 text-base text-slate-600">Es «{EXAMPLE.display}»: se escribe en {EXAMPLE.word.length} casillas.</p>
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
  const { items } = level

  const [status, setStatus] = useState<Status[]>(() => items.map(() => 'pending'))
  const [cur, setCur] = useState(0)
  const [typed, setTyped] = useState('')
  const [misses, setMisses] = useState(0)
  const [tone, setTone] = useState<'idle' | 'right' | 'shown'>('idle')
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

  const item = items[cur]
  const second = status[cur] === 'passed'
  const typing = tone === 'idle' && !done
  const complete = typed.length === item.word.length

  /** Moves the wheel on: the next pending letter, then the passed ones, and the end when none is left. */
  function advance(next: Status[], from: number) {
    // The first time no new letter is left, the wheel starts its second round: say so, even when the letter that comes
    // back is the very one that was just passed.
    const startsSecondRound = status[from] === 'pending'
    const pending = next.findIndex((s, i) => i > from && s === 'pending')
    const anyPending = next.findIndex((s) => s === 'pending')
    const passed = next.findIndex((s) => s === 'passed')
    const to = pending >= 0 ? pending : anyPending >= 0 ? anyPending : passed
    if (to < 0) {
      setPraise(pickOne(PRAISE))
      setDone(true)
      onSolved()
      return
    }
    setCur(to)
    setTyped('')
    setMisses(0)
    setTone('idle')
    setHint(
      pending < 0 && anyPending < 0 && startsSecondRound
        ? {
            text:
              to === from
                ? 'Ya no hay letras nuevas. Escribí esta o tocá «Ver la respuesta».'
                : 'Ya no hay letras nuevas: volvemos a las que pasaste.',
            ok: true,
          }
        : null,
    )
  }

  function typeLetter(ch: string, at: number) {
    if (!typing || at - since < SETTLE_MS) return
    setTyped((t) => (t.length >= item.word.length ? t : t + ch))
  }
  function back(at: number) {
    if (!typing || at - since < SETTLE_MS) return
    setTyped((t) => t.slice(0, -1))
  }
  function submit(at: number) {
    if (!typing || !complete || at - since < SETTLE_MS) return
    if (typed === item.word) {
      const next = status.map((s, i) => (i === cur ? 'right' : s)) as Status[]
      setStatus(next)
      setTone('right')
      setHint({ text: `¡Eso es! «${item.display}».`, ok: true })
      timerRef.current = window.setTimeout(() => advance(next, cur), ADVANCE_MS)
      return
    }
    const n = misses + 1
    setMisses(n)
    setTyped('')
    onMistake()
    setHint({
      text: n === 1 ? `No es. ${item.tip}` : `No es. Empieza con «${item.word.slice(0, 2)}».`,
      ok: false,
    })
  }
  function pass(at: number) {
    if (!typing || at - since < SETTLE_MS) return
    if (!second) {
      const next = status.map((s, i) => (i === cur ? 'passed' : s)) as Status[]
      setStatus(next)
      advance(next, cur)
      return
    }
    // Second time around: the answer is shown (one mistake) so the wheel can end.
    const next = status.map((s, i) => (i === cur ? 'shown' : s)) as Status[]
    setStatus(next)
    setTyped(item.word)
    setTone('shown')
    onMistake()
    setHint({ text: `La palabra era «${item.display}».`, ok: false })
    timerRef.current = window.setTimeout(() => advance(next, cur), ADVANCE_MS + 400)
  }

  const wheelLabel = done ? level.name : second ? '2.ª vuelta' : level.name

  return (
    <div ref={topRef} className="px-2 pb-1 pt-2 sm:p-7">
      {!done && (
        <>
          <Wheel items={items} status={status} cur={cur} label={wheelLabel} />
          <div className="mt-2 rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-3 py-1.5">
            <p className="text-sm font-bold leading-tight text-tiam-blue">
              {item.mode === 'E' ? `Empieza con la ${item.letter}` : `Contiene la ${item.letter}`} · {item.word.length} letras
            </p>
            <p className="mt-0.5 text-base font-bold leading-snug text-slate-900">{item.clue}</p>
          </div>

          <p
            role="status"
            className={`min-h-[3rem] py-0.5 text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-600'}`}
          >
            {hint?.text}
          </p>

          <div className="mx-auto max-w-md px-1">
            <WordBoxes word={item.word} typed={typed} tone={tone} />
          </div>

          <div role="group" aria-label="Teclado de letras" className="mx-auto mt-2 grid max-w-[420px] grid-cols-7 gap-[3px]">
            {LETTERS.map((ch) => (
              <button
                key={ch}
                type="button"
                aria-label={`Letra ${ch}`}
                disabled={!typing}
                onClick={(e) => typeLetter(ch, e.timeStamp)}
                className={KEY_CLASS}
              >
                {ch}
              </button>
            ))}
            <button
              type="button"
              aria-label="Borrar la última letra"
              disabled={!typing || typed === ''}
              onClick={(e) => back(e.timeStamp)}
              className={KEY_CLASS}
            >
              <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sticky bottom-0 z-10 mx-auto mt-1 flex max-w-[420px] gap-2 bg-white/95 pb-1 pt-1">
            <button
              type="button"
              disabled={!typing}
              onClick={(e) => pass(e.timeStamp)}
              className="flex min-h-[48px] flex-[3] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-slate-300 bg-white px-2 text-lg font-bold text-slate-700 transition hover:border-tiam-blue/50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:opacity-50"
            >
              {second ? null : <SkipForward className="h-5 w-5" aria-hidden="true" />}
              {second ? 'Ver la respuesta' : 'Paso'}
            </button>
            <button
              type="button"
              disabled={!typing || !complete}
              onClick={(e) => submit(e.timeStamp)}
              className="flex min-h-[48px] flex-[2] items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
            >
              Listo
            </button>
          </div>
        </>
      )}

      {done && (
        <div ref={resultRef} className="mt-3 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Cerraste el rosco. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {items.map((it, i) => (
              <li key={it.letter} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                {status[i] === 'shown' ? (
                  <Eye className="mt-1 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                ) : (
                  <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                )}
                <span className="min-w-0 break-words">
                  <span className="font-bold text-slate-900">{it.display}</span>
                  <span className="text-slate-500"> — {it.clue}</span>
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

export function ElRosco({ onComplete }: GameProps) {
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Armá el rosco</h2>
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
