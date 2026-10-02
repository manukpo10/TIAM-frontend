import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Dos de cada grupo" — día 5, mes 5, ejecutivas. A condition ("son de tela",
 * "tienen asa", "flotan en el agua") and a handful of everyday objects; exactly
 * TWO of them meet it and the player taps those two. Classifying by a property
 * (what is it made of, what parts does it have, what does it do) is the
 * reasoning step; the other objects are chosen so none of them meets the
 * condition under any reasonable reading — a cuchara has a "mango", not an
 * "asa"; a plain "pelota" floats; nothing in a "de tela" set is a shoe or a hat
 * (both come in fabric).
 *
 * Every tap is checked live. A wrong object greys out for good (it can never
 * become right: the condition does not change), says why it does not fit and
 * costs one mistake; the right ones turn green. No timer, no "Revisar".
 *
 * ONE condition per level, with a gentle ramp: a material the eye can see (L1,
 * 6 objects), a part an object has (L2, 8 objects) and what an object does (L3,
 * 8 objects). Each level has two authored sets and one is picked ONCE at mount
 * (`epoch`, together with the order of the objects), so "Repetir" plays exactly
 * the same three sets. Per-level state lives in <LevelView>, keyed by run +
 * level. Words are kept apart across levels on purpose, so an object never
 * flips from "doesn't fit" to "fits" between two levels of the same run.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by the
 * click's own timeStamp) is ignored, so the second tap of a double tap on "Siguiente nivel"
 * or "Repetir" never lands on an object of the new level (the grid sits right where that
 * button was). Nothing else needs it while playing: an object that is found or ruled out
 * stays put, disabled. The card's button ignores a tap within SETTLE_MS of the object that
 * closed the level (the card takes the grid's place, so it can end up under that finger). A
 * new level opens at its top and the solved card is scrolled into view with its button.
 *
 * totalAttempts = mistakes + the two objects of every level (TOTAL_PICKS).
 */

// ── data:start ──
interface GroupSet {
  /** Completes "Tocá los 2 que …". */
  condition: string
  /** Exactly the two objects that meet the condition. */
  correct: [string, string]
  /** Objects that do not meet it under any reasonable reading. */
  wrong: string[]
  /** Shown after a wrong tap. */
  no: string
  /** Shown on the result card. */
  why: string
}
interface LevelDef {
  name: string
  sets: GroupSet[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    sets: [
      {
        condition: 'son de tela',
        correct: ['camisa', 'sábana'],
        wrong: ['llave', 'plato', 'martillo', 'maceta'],
        no: 'Ese no es de tela.',
        why: 'La camisa y la sábana son de tela.',
      },
      {
        condition: 'son de vidrio',
        correct: ['vaso', 'espejo'],
        wrong: ['llave', 'silla', 'ladrillo', 'toalla'],
        no: 'Ese no es de vidrio.',
        why: 'El vaso y el espejo son de vidrio.',
      },
    ],
  },
  {
    name: 'Nivel 2',
    sets: [
      {
        condition: 'tienen asa',
        correct: ['taza', 'canasta'],
        wrong: ['plato', 'jabón', 'regla', 'almohada', 'bufanda', 'lápiz'],
        no: 'Ese no tiene asa.',
        why: 'La taza y la canasta tienen asa.',
      },
      {
        condition: 'tienen ruedas',
        correct: ['auto', 'bicicleta'],
        wrong: ['paraguas', 'zapato', 'sombrero', 'bufanda', 'peine', 'libro'],
        no: 'Ese no tiene ruedas.',
        why: 'El auto y la bicicleta tienen ruedas.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    sets: [
      {
        condition: 'flotan en el agua',
        correct: ['corcho', 'pelota'],
        wrong: ['piedra', 'moneda', 'llave', 'tijera', 'ancla', 'martillo'],
        no: 'Ese se hunde: no flota.',
        why: 'El corcho y la pelota flotan en el agua.',
      },
      {
        condition: 'sirven para cortar',
        correct: ['tijera', 'cuchillo'],
        wrong: ['cuchara', 'martillo', 'lápiz', 'regla', 'peine', 'plato'],
        no: 'Ese no sirve para cortar.',
        why: 'La tijera y el cuchillo sirven para cortar.',
      },
    ],
  },
]

const PICKS_PER_LEVEL = 2
const TOTAL_PICKS = LEVELS.length * PICKS_PER_LEVEL
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

interface LevelContent {
  set: GroupSet
  /** The objects in their (frozen) display order. */
  options: string[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const set = pickOne(lvl.sets)
    return { set, options: shuffle([...set.correct, ...set.wrong]) }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente razonamiento!', '¡Así se hace!', '¡Perfecto!']

/** A tap this soon after the tap that brought the level here ("Siguiente nivel", "Repetir") is the second tap
 * of a double tap, and it must not be judged against the object that sits where that button was. The same
 * window covers the card's button right after the object that closed the level (the card takes the grid's
 * place). Long enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

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
  const { set, options } = content

  const [found, setFound] = useState<string[]>([])
  const [ruledOut, setRuledOut] = useState<string[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  const [flash, setFlash] = useState<string | null>(null)
  // The tap that found the second object, which closed the level: the result card takes the grid's place.
  const closedAtRef = useRef(Number.NEGATIVE_INFINITY)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])

  const solved = found.length >= PICKS_PER_LEVEL

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!solved || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [solved])

  function handleTap(option: string, at: number) {
    // The second tap of a double tap on the button that brought the level lands on an object: not an answer.
    if (solved || found.includes(option) || ruledOut.includes(option) || at - since < SETTLE_MS) return
    if (set.correct.includes(option)) {
      setFound((f) => [...f, option])
      setHint(null)
      if (found.length + 1 >= PICKS_PER_LEVEL) {
        closedAtRef.current = at
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setRuledOut((r) => [...r, option])
      setHint(`${set.no} Probá con otro.`)
      onMistake()
      setFlash(option)
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setFlash(null), 600)
    }
  }

  // The card takes the grid's place, so its button can end up right under the finger that closed the
  // level: the second tap of that double tap must not skip the result.
  function leave(go: (at: number) => void, at: number) {
    if (at - closedAtRef.current < SETTLE_MS) return
    go(at)
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-2xl font-bold leading-snug text-slate-900">
              Tocá los 2 que <span className="text-indigo-700">{set.condition}</span>
            </h2>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Encontraste {found.length} de {PICKS_PER_LEVEL}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                  style={{ width: `${(found.length / PICKS_PER_LEVEL) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!solved && (
        <>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
            {options.map((option) => {
              const isFound = found.includes(option)
              const isRuledOut = ruledOut.includes(option)
              const isFlashing = flash === option
              return (
                <button
                  key={option}
                  type="button"
                  disabled={isFound || isRuledOut}
                  onClick={(e) => handleTap(option, e.timeStamp)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 px-2 py-3 text-xl font-bold capitalize transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isFound
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isRuledOut
                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                    isFlashing ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out]' : '',
                  ].join(' ')}
                >
                  {option}
                  {isFound && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
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
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {set.why} ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => leave(onRepeat, e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => leave(onNext, e.timeStamp)}
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

export function DosDeCadaGrupo({ onComplete }: GameProps) {
  // Which set each level plays, and the order of its objects — decided once, at
  // mount, so "Repetir" plays exactly the same content.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PICKS })
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
