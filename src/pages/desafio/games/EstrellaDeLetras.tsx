import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Estrella de letras" — día 29, mes 6, ejecutivas (razonamiento). A six-pointed star with a letter on each of its
 * twelve points (the six tips and the six corners of the hexagon inside). The player walks along its lines, from point to
 * point and never through the same point twice, to spell a word that comes with a clue and one box per letter. The
 * mechanic comes from a worksheet where words are hidden in a star of letters joined by lines; here the star's shape,
 * its letters, the words and the clues are TIAM's own.
 *
 * WALKING THE LINES IS THE RULE, SO IT IS CHECKED. The star is data (EDGES: each tip is joined to the two nearest inner
 * points and the six inner points form a ring) and the game only lets a tap continue from the last point to a point joined
 * to it (a tap anywhere else says "ese punto no está unido al anterior" and is not a mistake). A throwaway script
 * (not committed) searches the graph for every word of the day and confirms each can be spelled along edges, and lists
 * the other strings of the same length that the star can spell, to make sure none is a real word that fits a clue (a
 * real stray word would feel like an unfair "no"). The answer is the LETTERS: any walk that spells the word counts.
 *
 * CLUES, NOT A BLIND GUESS (a word game never asks for a word with nothing to go on): every word has a clue, a second tip
 * and its boxes on screen, so its length is visible. A wrong word costs ONE mistake (a double tap on "Listo" cannot
 * count twice: the first tap empties the walk and "Listo" is off until the boxes are full again) and the hint grows with
 * the misses on the same word: the tip, then the first letter, and from the third miss the next point of a valid walk
 * is ringed so the word can be finished, so nobody is left stuck. "Borrar" takes back the last point. Nothing is red
 * and nothing is timed but a short pause so the finished word is seen.
 *
 * THREE WORDS A STAR, ONE STAR A LEVEL. Each level has its own star with its three words sharing the same twelve points,
 * so the same letter is used in more than one word. The ramp is the length (4 to 5 letters, then 6, then 6 to 8) and
 * how indirect the clue is. Each star is authored once, so "Repetir" replays exactly the same nine words.
 *
 * The points are buttons of 44 px; the star is as wide as the screen allows (up to 280 px) and smaller (244 px, its points
 * still 44 px) on a short phone; it lies with its tips left and right so it is wide, not tall, where the clue, the star, the boxes, the feedback and the buttons all stay on screen. A short "¿Cómo se
 * juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>, keyed by run +
 * level. A tap within SETTLE_MS of the tap that brought the level is ignored.
 *
 * totalAttempts = mistakes + every word of the day (TOTAL_WORDS, derived).
 */

// ── data:start ──
interface WordDef {
  /** Plain capital letters (A-Z, no accents): what the walk spells. */
  word: string
  /** The word as it is written, with its accent: shown once it is found. */
  display: string
  /** What it is. It never contains the word. */
  clue: string
  /** A second clue, for after the first miss. */
  tip: string
}
interface LevelDef {
  name: string
  /** The twelve letters: the six tips clockwise from the right, then the six inner points (inner k sits between tip k and tip k+1). */
  letters: string
  words: WordDef[]
}

const POINTS = 12
/** The lines of the star: each tip to its two nearest inner points, and the ring of inner points. */
const EDGES: [number, number][] = []
for (let k = 0; k < 6; k++) {
  EDGES.push([6 + k, 6 + ((k + 1) % 6)])
  EDGES.push([k, 6 + k])
  EDGES.push([k, 6 + ((k + 5) % 6)])
}
function joined(a: number, b: number): boolean {
  return EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** The first walk (point indexes) along the lines that spells `word`, or null. */
function findWalk(letters: string, word: string): number[] | null {
  const walk: number[] = []
  function go(i: number): boolean {
    if (i === word.length) return true
    for (let n = 0; n < POINTS; n++) {
      if (letters[n] !== word[i] || walk.includes(n)) continue
      if (i > 0 && !joined(walk[i - 1], n)) continue
      walk.push(n)
      if (go(i + 1)) return true
      walk.pop()
    }
    return false
  }
  return go(0) ? [...walk] : null
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    letters: 'ATFOSNZARLED',
    words: [
      {
        word: 'TAZA',
        display: 'taza',
        clue: 'Recipiente con asa para tomar café o té.',
        tip: 'Se apoya sobre un platito.',
      },
      {
        word: 'FAROL',
        display: 'farol',
        clue: 'Luz de la calle o del auto que se prende de noche.',
        tip: 'En la calle hay uno cada tanto.',
      },
      {
        word: 'SENDA',
        display: 'senda',
        clue: 'Caminito angosto entre el pasto, hecho de tanto pasar.',
        tip: 'Es más angosta que un camino.',
      },
    ],
  },
  {
    name: 'Nivel 2',
    letters: 'CNNDBJOGIRAL',
    words: [
      {
        word: 'JARDIN',
        display: 'jardín',
        clue: 'Terreno con flores y plantas, junto a una casa.',
        tip: 'Se riega con la manguera.',
      },
      {
        word: 'BALCON',
        display: 'balcón',
        clue: 'Saliente con baranda de un piso alto.',
        tip: 'Ahí se ponen las macetas y a veces se tiende la ropa.',
      },
      {
        word: 'ABRIGO',
        display: 'abrigo',
        clue: 'Prenda gruesa que se usa encima, en invierno.',
        tip: 'Se cuelga en el perchero al llegar a casa.',
      },
    ],
  },
  {
    name: 'Nivel 3',
    letters: 'EVCEAASANTNT',
    words: [
      {
        word: 'CANTANTE',
        display: 'cantante',
        clue: 'Artista que le pone voz a una canción.',
        tip: 'En un recital es quien tiene el micrófono.',
      },
      {
        word: 'ESTANTE',
        display: 'estante',
        clue: 'Tabla en la pared para apoyar libros y adornos.',
        tip: 'Una biblioteca tiene varios, uno sobre otro.',
      },
      {
        word: 'ANTENA',
        display: 'antena',
        clue: 'Va en el techo y capta la señal de la tele.',
        tip: 'Los insectos tienen dos en la cabeza.',
      },
    ],
  },
]
const TOTAL_WORDS = LEVELS.reduce((n, l) => n + l.words.length, 0)

/** Where each point sits on the star, as percentages of its box (10 wide : 9 high; the star has its tips left and right). */
const TIP_X = 41
const TIP_Y = 45.6
function pointPosition(i: number): { x: number; y: number } {
  const tip = i < 6
  const angle = ((60 * (tip ? i : i - 6) + (tip ? 0 : 30)) * Math.PI) / 180
  const k = tip ? 1 : 1 / Math.sqrt(3)
  return { x: 50 + TIP_X * k * Math.cos(angle), y: 50 + TIP_Y * k * Math.sin(angle) }
}
// ── data:end ──

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen recorrido!', '¡Perfecto!']
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
/** The pause after a right word, with it on screen, before the next one; every point is off meanwhile. */
const ADVANCE_MS = 1800
/** A tap this soon after the tap that brought the level is the second tap of a double tap and must not pick a point. */
const SETTLE_MS = 400

const NEXT_BUTTON =
  'inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark'

/** One box per letter of the word, filled as the player walks. */
function WordBoxes({ word, typed, right }: { word: string; typed: string; right: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Palabra de ${word.length} letras${typed ? `. Armaste: ${typed}` : ''}`}
      className="flex justify-center gap-1"
    >
      {[...word].map((_, i) => (
        <span
          key={i}
          className={[
            'flex h-10 min-w-0 max-w-[34px] flex-1 items-center justify-center rounded-lg border-2 text-xl font-extrabold',
            right
              ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
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

/** The star: its lines, with the ones of the current walk in blue, and one 44 px button per point. */
function Star({
  letters,
  walk,
  ringed,
  disabled,
  onTap,
}: {
  letters: string
  walk: number[]
  ringed: number
  disabled: boolean
  onTap: (i: number, at: number) => void
}) {
  const walked = new Set(walk.slice(1).map((n, k) => `${Math.min(walk[k], n)}-${Math.max(walk[k], n)}`))
  return (
    <div className="relative mx-auto aspect-[10/9] w-full max-w-[280px] [@media(max-height:700px)]:max-w-[244px]">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {EDGES.map(([a, b]) => {
          const p = pointPosition(a)
          const q = pointPosition(b)
          const on = walked.has(`${Math.min(a, b)}-${Math.max(a, b)}`)
          return (
            <line
              key={`${a}-${b}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke={on ? '#1B6FC4' : '#CBD5E1'}
              strokeWidth={on ? 4 : 2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div role="group" aria-label="Estrella de letras">
        {[...letters].map((ch, i) => {
          const { x, y } = pointPosition(i)
          const inWalk = walk.includes(i)
          return (
            <button
              key={i}
              type="button"
              aria-label={`Letra ${ch}${inWalk ? ', ya usada' : ''}`}
              disabled={disabled || inWalk}
              onClick={(e) => onTap(i, e.timeStamp)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={[
                'absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xl font-extrabold transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                inWalk
                  ? 'border-tiam-blue bg-tiam-blue text-white'
                  : i === ringed
                    ? 'border-tiam-blue bg-white text-slate-900 ring-4 ring-tiam-blue/40'
                    : 'border-slate-300 bg-white text-slate-900 hover:border-tiam-blue/50 active:bg-tiam-blue/10',
              ].join(' ')}
            >
              {ch}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Cada letra de la estrella está unida por líneas a otras. Empezá en cualquier letra y seguí por las líneas, sin repetir ninguna.',
    'Con la pista y las casillas, armá la palabra letra por letra y tocá «Listo».',
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
        <p className="mt-1 text-base leading-snug text-slate-700">
          para armar «PAN» tocás la P, seguís por una línea hasta la A y por otra hasta la N.
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
  const { words, letters } = level
  const total = words.length

  const [qIdx, setQIdx] = useState(0)
  const [walk, setWalk] = useState<number[]>([])
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

  const current = words[qIdx]
  const typed = walk.map((n) => letters[n]).join('')
  const typing = !advancing && !done
  const complete = walk.length === current.word.length
  // From the third miss, the next point of a valid walk is ringed while the player is still on that walk.
  const solution = findWalk(letters, current.word)
  const onSolution = solution !== null && walk.every((n, k) => solution[k] === n)
  const ringed = misses >= 3 && typing && !complete && solution && onSolution ? solution[walk.length] : -1

  function tapPoint(i: number, at: number) {
    if (!typing || complete || at - since < SETTLE_MS || walk.includes(i)) return
    if (walk.length > 0 && !joined(walk[walk.length - 1], i)) {
      setHint({ text: 'Ese punto no está unido al anterior: seguí por las líneas.', ok: false })
      return
    }
    setHint(null)
    setWalk((w) => [...w, i])
  }
  function back(at: number) {
    if (!typing || at - since < SETTLE_MS) return
    setHint(null)
    setWalk((w) => w.slice(0, -1))
  }
  function submit(at: number) {
    if (!typing || !complete || at - since < SETTLE_MS) return
    if (typed === current.word) {
      setAdvancing(true)
      setHint({ text: `¡Eso es! «${current.display}».`, ok: true })
      timerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setWalk([])
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
    setWalk([])
    onMistake()
    setHint({
      text:
        next === 1
          ? `No es. ${current.tip}`
          : next === 2
            ? `No es. ${current.tip} Empieza con «${current.word[0]}».`
            : 'No es. Marcamos con un aro el próximo punto: seguí desde ahí.',
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
            Palabra {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          <div className="mx-auto mt-2 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-1.5 text-center">
            <p className="text-base font-bold leading-snug text-slate-900 sm:text-xl">{current.clue}</p>
            <p className="text-base font-medium text-slate-600 [@media(max-height:700px)]:hidden">
              La palabra tiene {current.word.length} letras.
            </p>
          </div>

          <div className="mt-1">
            <Star letters={letters} walk={walk} ringed={ringed} disabled={!typing || complete} onTap={tapPoint} />
          </div>

          <div className="mx-auto mt-1 max-w-md">
            <WordBoxes word={current.word} typed={typed} right={advancing} />
          </div>

          {/* Feedback and buttons stay pinned to the bottom edge, so "Listo" is never below the fold. */}
          <div className="sticky bottom-0 z-10 mx-auto mt-1 max-w-[340px] bg-white/95 pb-1 pt-1">
            <p
              role="status"
              className={`min-h-[2.4rem] text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-600'}`}
            >
              {hint?.text}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Borrar la última letra"
                disabled={!typing || walk.length === 0}
                onClick={(e) => back(e.timeStamp)}
                className="flex min-h-[48px] w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-slate-700 transition hover:border-tiam-blue/50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:opacity-40"
              >
                <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!typing || !complete}
                onClick={(e) => submit(e.timeStamp)}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
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
          <p className="mt-1 text-slate-600">Encontraste las {total} palabras. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {words.map((w) => (
              <li key={w.word} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{w.display}</span>
                  <span className="text-slate-500"> — {w.clue}</span>
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

export function EstrellaDeLetras({ onComplete }: GameProps) {
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Palabras por las líneas</h2>
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
