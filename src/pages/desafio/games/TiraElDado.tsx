import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Pencil } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Tirá el dado" — categorical word-retrieval with a starting-letter
 * constraint, from the paper exercise's six prompts (one per die face): "un
 * medio de transporte que empiece con C", "una verdura que empiece con Z"…
 *
 * PENCIL AND PAPER, ON PURPOSE — not a second version of multiple-choice.
 * The first build offered four tappable words (one correct, three decoys);
 * too easy, since a rushed tap could win by elimination without really
 * retrieving anything. The user's fix wasn't "harder decoys" — it was to
 * take the digital answer step out entirely: the die shows the prompt, the
 * player writes or says whatever word occurs to them on their own paper, and
 * taps "Ya la tengo" to move on. Nothing here is graded, because there is no
 * way to validate an open Spanish vocabulary from a tap, and because most of
 * these prompts have many valid answers anyway ("un deporte que empiece con
 * F" fits fútbol AND several others) — the retrieval effort in the player's
 * own head is the exercise, same as a verbal-fluency task in real
 * cognitive-stimulation practice. `mistakes` is hardcoded to 0, same house
 * convention ElVuelto.tsx already uses for its change-making rounds ("this
 * never scores or fails a round").
 *
 * The "¿Cómo se juega?" ready screen (same phase pattern and pencil note as
 * TelaranaMatematica.tsx's HowToPlay) is what actually carries the pencil-
 * and-paper idea to the player — nothing later in the flow mentions paper
 * again, so a returning player who skips it isn't left confused, just back
 * to a plain prompt-and-continue loop they've already seen once.
 *
 * `answer` on each prompt is NOT rendered or checked anywhere — it exists so
 * anyone editing this pool can see, at a glance, that the category+letter
 * pair has a real solution (the exact words verified when this pool was
 * still multiple-choice).
 */

interface Prompt {
  /** Category phrase WITH its article, e.g. 'una verdura'. */
  categoryLabel: string
  letter: string
  /** Documentation only — see module doc. */
  answer: string
}

interface Level {
  n: number
  name: string
  rounds: number
  /** Candidate prompts this level draws 6 of (one per face), once per level
   * at mount — a pool bigger than the 6 faces so the day's opening draw
   * doesn't always land on the exact same six things. Once drawn, that six
   * stays fixed for the rest of the day, including through "Repetir". */
  pool: Prompt[]
}

// ── Level 1 — common letters ────────────────────────────────────────────
const L1_PROMPTS: Prompt[] = [
  { categoryLabel: 'un medio de transporte', letter: 'C', answer: 'colectivo' },
  { categoryLabel: 'una verdura', letter: 'Z', answer: 'zapallo' },
  { categoryLabel: 'una fruta', letter: 'D', answer: 'durazno' },
  { categoryLabel: 'un país', letter: 'B', answer: 'Bolivia' },
  { categoryLabel: 'un deporte', letter: 'F', answer: 'fútbol' },
  { categoryLabel: 'un mes', letter: 'A', answer: 'abril' },
  { categoryLabel: 'un animal', letter: 'G', answer: 'gato' },
  { categoryLabel: 'un color', letter: 'N', answer: 'negro' },
]

// ── Level 2 — medium letters ─────────────────────────────────────────────
const L2_PROMPTS: Prompt[] = [
  { categoryLabel: 'un medio de transporte', letter: 'A', answer: 'avión' },
  { categoryLabel: 'una verdura', letter: 'P', answer: 'papa' },
  { categoryLabel: 'una fruta', letter: 'M', answer: 'manzana' },
  { categoryLabel: 'un país', letter: 'P', answer: 'Perú' },
  { categoryLabel: 'un deporte', letter: 'N', answer: 'natación' },
  { categoryLabel: 'un mes', letter: 'J', answer: 'junio' },
  { categoryLabel: 'un animal', letter: 'L', answer: 'león' },
  { categoryLabel: 'un oficio', letter: 'M', answer: 'médico' },
]

// ── Level 3 — less common letters ───────────────────────────────────────
const L3_PROMPTS: Prompt[] = [
  { categoryLabel: 'una verdura', letter: 'R', answer: 'remolacha' },
  { categoryLabel: 'una fruta', letter: 'F', answer: 'frutilla' },
  { categoryLabel: 'un país', letter: 'U', answer: 'Uruguay' },
  { categoryLabel: 'un animal', letter: 'J', answer: 'jirafa' },
  { categoryLabel: 'una prenda de ropa', letter: 'B', answer: 'bufanda' },
  { categoryLabel: 'un oficio', letter: 'P', answer: 'plomero' },
  { categoryLabel: 'una parte del cuerpo', letter: 'C', answer: 'codo' },
  { categoryLabel: 'algo de la cocina', letter: 'O', answer: 'olla' },
]

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 3, pool: L1_PROMPTS },
  { n: 2, name: 'Nivel 2', rounds: 4, pool: L2_PROMPTS },
  { n: 3, name: 'Nivel 3', rounds: 6, pool: L3_PROMPTS },
]

// Fixed total of rounds across the whole day (3+4+6) — every round resolves
// on "Ya la tengo" (never wrong — see module doc), so this is a derivable
// constant rather than a piece of state.
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

const FACES = [1, 2, 3, 4, 5, 6]

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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Big tappable die, pips on the classic 3×3 layout — same drawing approach
 * as CuantoSuma's Die, just scaled up to fill its (much bigger) button. */
function Die({ face }: { face: number }) {
  const spots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
  }
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#fff" stroke="#cbd5e1" strokeWidth="5" />
      {spots[face].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#1B6FC4" />
      ))}
    </svg>
  )
}

/** Ready screen, once per opening of the day (see module doc) — same shape
 * as TelaranaMatematica.tsx's HowToPlay: numbered steps, a worked example,
 * the pencil-and-paper note, "Empezar". */
function HowToPlay({ onStart }: { onStart: () => void }) {
  const steps = [
    'Tocá el dado. Va a aparecer una categoría y una letra, como «una verdura que empiece con Z».',
    'Pensá una palabra que corresponda. Podés decirla en voz alta o escribirla en un papel.',
    'Cuando la tengas, tocá «Ya la tengo» y sigue el próximo dado.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-tiam-blue/15 bg-white p-3">
        <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
        <p className="text-base leading-snug text-slate-700">
          Tené a mano lápiz y papel: podés anotar ahí cada palabra que se te ocurra.
        </p>
      </div>

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']

const ROLL_TICK_MS = 90
// 6 ticks × 90ms ≈ 540ms, safely under the 700ms cap — it's decoration, not
// a countdown, so it only needs to read as "tumbling", not last any specific
// length.
const ROLL_TICKS = 6

export function TiraElDado({ day: _day, onComplete }: GameProps) {
  // How-to screen, once per opening of the day — "Repetir" never sets it
  // back, same convention as TelaranaMatematica.tsx.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Six prompts assigned to the six faces, per level. Decided once — at
  // mount — never re-drawn just because the player re-visits a level, so
  // "Repetir" can hand back the exact same six prompts deterministically
  // (which face the die actually lands on each roll stays random — see
  // `roll` below, that's the mechanic).
  const [epoch] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, 6)))
  const facePrompts = epoch[levelIdx]

  const [usedFaces, setUsedFaces] = useState<Set<number>>(new Set())
  const [solvedCount, setSolvedCount] = useState(0)
  const [currentFace, setCurrentFace] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [displayFace, setDisplayFace] = useState(1)
  const [praise, setPraise] = useState(PRAISE[0])

  const rollIntervalRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current !== null) window.clearInterval(rollIntervalRef.current)
    }
  }, [])

  const activePrompt = currentFace !== null ? facePrompts[currentFace - 1] : null
  const done = solvedCount >= level.rounds

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function roll() {
    if (rolling || currentFace !== null) return
    // The landing face is chosen BEFORE the animation starts, sampled only
    // from faces not yet played this level attempt. This is what "reroll
    // silently" means in practice: a literal roll → check → reroll loop would
    // let the player see the die settle on an already-played face and then
    // watch it change again, which reads as a broken die. Restricting the
    // SAMPLE POOL up front gives the same guarantee — every face plays at
    // most once per level — without ever visibly landing on a repeat.
    const available = FACES.filter((f) => !usedFaces.has(f))
    if (available.length === 0) return
    const finalFace = pickOne(available)

    const land = () => {
      setUsedFaces((prev) => new Set(prev).add(finalFace))
      setCurrentFace(finalFace)
      setDisplayFace(finalFace)
      setRolling(false)
      rollIntervalRef.current = null
    }

    if (prefersReducedMotion()) {
      land()
      return
    }

    setRolling(true)
    let tick = 0
    rollIntervalRef.current = window.setInterval(() => {
      tick++
      setDisplayFace(1 + Math.floor(Math.random() * 6))
      if (tick >= ROLL_TICKS) {
        if (rollIntervalRef.current !== null) window.clearInterval(rollIntervalRef.current)
        land()
      }
    }, ROLL_TICK_MS)
  }

  // "Ya la tengo" closes the round straight away — see module doc for why
  // there's nothing here to check.
  function gotIt() {
    if (!activePrompt) return
    setSolvedCount((c) => c + 1)
    setCurrentFace(null)
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on levelIdx — an effect-based reset lags one
  // render behind, so `done` (derived straight from solvedCount) would read
  // the previous level's stale-true value on the very render that arrives at
  // the new level and fire onComplete with garbage. Same reasoning as
  // ElVuelto.tsx / SumaHastaDiez.tsx.
  function nextLevel() {
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setUsedFaces(new Set())
    setSolvedCount(0)
    setCurrentFace(null)
    setRolling(false)
    setDisplayFace(1)
  }

  // Fires once per roundKey when the last level's last round resolves. A
  // genuine full-day restart (the wrap back to level 1) gets a new roundKey,
  // so it can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      // Always 0 mistakes — see module doc: nothing here is ever graded.
      onComplete({ mistakes: 0, totalAttempts: TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const dieLabel = rolling
    ? 'Tirando el dado…'
    : currentFace === null
      ? 'Tirar el dado'
      : `El dado mostró el número ${currentFace}`

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
            {level.name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tirá el dado y pensá una palabra</h2>
        </div>
        <HowToPlay onStart={() => setPhase('playing')} />
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tirá el dado y pensá una palabra</h2>
        {!done && (
          <p className="mt-2 text-base font-medium text-tiam-blue">
            {currentFace === null ? 'Tocá el dado para tirar.' : 'Decila en voz alta o escribila en un papel.'}
          </p>
        )}
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Llevás {solvedCount} de {level.rounds}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${(solvedCount / level.rounds) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {!done && (
        <>
          {/* Die */}
          <div className="mt-5 flex justify-center sm:mt-6">
            <button
              type="button"
              onClick={roll}
              disabled={rolling || currentFace !== null}
              aria-label={dieLabel}
              className={[
                'flex h-24 w-24 items-center justify-center rounded-3xl transition sm:h-32 sm:w-32',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2',
                rolling ? 'motion-safe:animate-bounce' : '',
                currentFace === null
                  ? 'hover:-translate-y-0.5 hover:scale-105 active:translate-y-0'
                  : 'opacity-90',
              ].join(' ')}
            >
              <Die face={displayFace} />
            </button>
          </div>

          {/* Prompt + confirm */}
          {currentFace !== null && activePrompt && (
            <>
              <p className="mt-4 text-center text-xl font-bold text-slate-800 sm:text-2xl">
                Buscá {activePrompt.categoryLabel} que empiece con
                <span className="ml-2 inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl bg-tiam-blue px-2 align-middle text-2xl font-black text-white">
                  {activePrompt.letter}
                </span>
              </p>

              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={gotIt}
                  className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-tiam-green px-8 text-lg font-bold text-white transition hover:opacity-90 active:translate-y-0"
                >
                  Ya la tengo
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Tiraste el dado {level.rounds} veces y pensaste una palabra para cada una — ¡completaste el{' '}
            {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
