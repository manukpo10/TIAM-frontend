import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Tirá el dado" — categorical word-retrieval with a starting-letter
 * constraint, from the paper exercise's six prompts (one per die face): "un
 * medio de transporte que empiece con C", "una verdura que empiece con Z"…
 * Writing isn't tap-validatable, so retrieval is converted to recognition:
 * the die decides the prompt, four words are offered, tap the one that fits.
 *
 * INVARIANT: for every prompt, exactly one of the 4 shown options satisfies
 * BOTH the category and the starting letter. Each of the 3 decoys is built
 * to break exactly one of the two rules — either the right category with
 * the wrong letter, or the right letter from the wrong category — never
 * both at once (which would make it a second correct answer) and never
 * neither. The `breaks` tag on each decoy is the single source of truth for
 * this: a wrong tap's hint is derived from that tag rather than hand-typed
 * per word, so the hint can never claim a rule was broken that wasn't.
 *
 * Differs from the retired AnimalPorLetra (see that file's header) in three
 * ways. AnimalPorLetra fixed the category — always "animal" — and only the
 * letter varied; here the DIE chooses category AND letter together, so the
 * shape of the challenge changes every round. AnimalPorLetra's options were
 * illustrations of animals; these are words, because most of these
 * categories (país, oficio, mes) have no clean single-glyph illustration.
 * And AnimalPorLetra eliminated wrong taps into a shared decoy pool behind a
 * fixed, auto-advancing trial queue; here each die face is its own
 * independent round, gated by a roll rather than an index.
 */

type Break = { kind: 'letter' } | { kind: 'category'; label: string }

interface Decoy {
  word: string
  /** Which single rule this word breaks relative to its prompt. */
  breaks: Break
}

interface Prompt {
  /** Category phrase WITH its article, e.g. 'una verdura' — used verbatim in
   * both the big prompt sentence and any hint that names the right category. */
  categoryLabel: string
  letter: string
  answer: string
  decoys: [Decoy, Decoy, Decoy]
}

interface Level {
  n: number
  name: string
  rounds: number
  /** Candidate prompts this level draws 6 of (one per face) from, per roundKey
   * — a pool bigger than the 6 faces so a replay doesn't always ask the exact
   * same six things. */
  pool: Prompt[]
}

// ── Level 1 — common letters, far distractors ──────────────────────────────
const L1_PROMPTS: Prompt[] = [
  {
    categoryLabel: 'un medio de transporte',
    letter: 'C',
    answer: 'colectivo',
    decoys: [
      { word: 'tren', breaks: { kind: 'letter' } },
      { word: 'camisa', breaks: { kind: 'category', label: 'una prenda de ropa' } },
      { word: 'cuchara', breaks: { kind: 'category', label: 'algo de la cocina' } },
    ],
  },
  {
    categoryLabel: 'una verdura',
    letter: 'Z',
    answer: 'zapallo',
    decoys: [
      { word: 'papa', breaks: { kind: 'letter' } },
      { word: 'zapatilla', breaks: { kind: 'category', label: 'una prenda de ropa' } },
      { word: 'cebolla', breaks: { kind: 'letter' } },
    ],
  },
  {
    categoryLabel: 'una fruta',
    letter: 'D',
    answer: 'durazno',
    decoys: [
      { word: 'banana', breaks: { kind: 'letter' } },
      { word: 'delfín', breaks: { kind: 'category', label: 'un animal' } },
      { word: 'manzana', breaks: { kind: 'letter' } },
    ],
  },
  {
    categoryLabel: 'un país',
    letter: 'B',
    answer: 'Bolivia',
    decoys: [
      { word: 'Chile', breaks: { kind: 'letter' } },
      { word: 'banana', breaks: { kind: 'category', label: 'una fruta' } },
      { word: 'Perú', breaks: { kind: 'letter' } },
    ],
  },
  {
    categoryLabel: 'un deporte',
    letter: 'F',
    answer: 'fútbol',
    decoys: [
      { word: 'tenis', breaks: { kind: 'letter' } },
      { word: 'frutilla', breaks: { kind: 'category', label: 'una fruta' } },
      { word: 'básquet', breaks: { kind: 'letter' } },
    ],
  },
  {
    categoryLabel: 'un mes',
    letter: 'A',
    answer: 'abril',
    decoys: [
      { word: 'julio', breaks: { kind: 'letter' } },
      { word: 'auto', breaks: { kind: 'category', label: 'un medio de transporte' } },
      { word: 'mayo', breaks: { kind: 'letter' } },
    ],
  },
  {
    categoryLabel: 'un animal',
    letter: 'G',
    answer: 'gato',
    decoys: [
      { word: 'perro', breaks: { kind: 'letter' } },
      { word: 'guante', breaks: { kind: 'category', label: 'una prenda de ropa' } },
      { word: 'vaca', breaks: { kind: 'letter' } },
    ],
  },
  {
    categoryLabel: 'un color',
    letter: 'N',
    answer: 'negro',
    decoys: [
      { word: 'rojo', breaks: { kind: 'letter' } },
      { word: 'nariz', breaks: { kind: 'category', label: 'una parte del cuerpo' } },
      { word: 'verde', breaks: { kind: 'letter' } },
    ],
  },
]

// ── Level 2 — medium letters, some same-family distractors ─────────────────
const L2_PROMPTS: Prompt[] = [
  {
    categoryLabel: 'un medio de transporte',
    letter: 'A',
    answer: 'avión',
    decoys: [
      { word: 'barco', breaks: { kind: 'letter' } },
      { word: 'arveja', breaks: { kind: 'category', label: 'una verdura' } },
      { word: 'abrigo', breaks: { kind: 'category', label: 'una prenda de ropa' } },
    ],
  },
  {
    categoryLabel: 'una verdura',
    letter: 'P',
    answer: 'papa',
    decoys: [
      { word: 'zapallo', breaks: { kind: 'letter' } },
      { word: 'pollera', breaks: { kind: 'category', label: 'una prenda de ropa' } },
      { word: 'pera', breaks: { kind: 'category', label: 'una fruta' } },
    ],
  },
  {
    categoryLabel: 'una fruta',
    letter: 'M',
    answer: 'manzana',
    decoys: [
      { word: 'durazno', breaks: { kind: 'letter' } },
      { word: 'mono', breaks: { kind: 'category', label: 'un animal' } },
      { word: 'morrón', breaks: { kind: 'category', label: 'una verdura' } },
    ],
  },
  {
    categoryLabel: 'un país',
    letter: 'P',
    answer: 'Perú',
    decoys: [
      { word: 'Chile', breaks: { kind: 'letter' } },
      { word: 'pulóver', breaks: { kind: 'category', label: 'una prenda de ropa' } },
      { word: 'papa', breaks: { kind: 'category', label: 'una verdura' } },
    ],
  },
  {
    categoryLabel: 'un deporte',
    letter: 'N',
    answer: 'natación',
    decoys: [
      { word: 'vóley', breaks: { kind: 'letter' } },
      { word: 'nuez', breaks: { kind: 'category', label: 'algo de la cocina' } },
      { word: 'nariz', breaks: { kind: 'category', label: 'una parte del cuerpo' } },
    ],
  },
  {
    categoryLabel: 'un mes',
    letter: 'J',
    answer: 'junio',
    decoys: [
      { word: 'marzo', breaks: { kind: 'letter' } },
      { word: 'jirafa', breaks: { kind: 'category', label: 'un animal' } },
      { word: 'jamón', breaks: { kind: 'category', label: 'algo de la cocina' } },
    ],
  },
  {
    categoryLabel: 'un animal',
    letter: 'L',
    answer: 'león',
    decoys: [
      { word: 'gato', breaks: { kind: 'letter' } },
      { word: 'limón', breaks: { kind: 'category', label: 'una fruta' } },
      { word: 'lechuga', breaks: { kind: 'category', label: 'una verdura' } },
    ],
  },
  {
    categoryLabel: 'un oficio',
    letter: 'M',
    answer: 'médico',
    decoys: [
      { word: 'plomero', breaks: { kind: 'letter' } },
      { word: 'manzana', breaks: { kind: 'category', label: 'una fruta' } },
      { word: 'muñeca', breaks: { kind: 'category', label: 'una parte del cuerpo' } },
    ],
  },
]

// ── Level 3 — less common letters, distractors from neighbouring categories ─
const L3_PROMPTS: Prompt[] = [
  {
    categoryLabel: 'una verdura',
    letter: 'R',
    answer: 'remolacha',
    decoys: [
      { word: 'berenjena', breaks: { kind: 'letter' } },
      { word: 'remera', breaks: { kind: 'category', label: 'una prenda de ropa' } },
      { word: 'ratón', breaks: { kind: 'category', label: 'un animal' } },
    ],
  },
  {
    categoryLabel: 'una fruta',
    letter: 'F',
    answer: 'frutilla',
    decoys: [
      { word: 'banana', breaks: { kind: 'letter' } },
      { word: 'fútbol', breaks: { kind: 'category', label: 'un deporte' } },
      { word: 'fideos', breaks: { kind: 'category', label: 'algo de la cocina' } },
    ],
  },
  {
    categoryLabel: 'un país',
    letter: 'U',
    answer: 'Uruguay',
    decoys: [
      { word: 'Chile', breaks: { kind: 'letter' } },
      { word: 'uva', breaks: { kind: 'category', label: 'una fruta' } },
      { word: 'uniforme', breaks: { kind: 'category', label: 'una prenda de ropa' } },
    ],
  },
  {
    categoryLabel: 'un animal',
    letter: 'J',
    answer: 'jirafa',
    decoys: [
      { word: 'león', breaks: { kind: 'letter' } },
      { word: 'junio', breaks: { kind: 'category', label: 'un mes' } },
      { word: 'jamón', breaks: { kind: 'category', label: 'algo de la cocina' } },
    ],
  },
  {
    categoryLabel: 'una prenda de ropa',
    letter: 'B',
    answer: 'bufanda',
    decoys: [
      { word: 'pollera', breaks: { kind: 'letter' } },
      { word: 'berenjena', breaks: { kind: 'category', label: 'una verdura' } },
      { word: 'banana', breaks: { kind: 'category', label: 'una fruta' } },
    ],
  },
  {
    categoryLabel: 'un oficio',
    letter: 'P',
    answer: 'plomero',
    decoys: [
      { word: 'médico', breaks: { kind: 'letter' } },
      { word: 'pepino', breaks: { kind: 'category', label: 'una verdura' } },
      { word: 'pera', breaks: { kind: 'category', label: 'una fruta' } },
    ],
  },
  {
    categoryLabel: 'una parte del cuerpo',
    letter: 'C',
    answer: 'codo',
    decoys: [
      { word: 'brazo', breaks: { kind: 'letter' } },
      { word: 'colectivo', breaks: { kind: 'category', label: 'un medio de transporte' } },
      { word: 'cebolla', breaks: { kind: 'category', label: 'una verdura' } },
    ],
  },
  {
    categoryLabel: 'algo de la cocina',
    letter: 'O',
    answer: 'olla',
    decoys: [
      { word: 'cuchara', breaks: { kind: 'letter' } },
      { word: 'oso', breaks: { kind: 'category', label: 'un animal' } },
      { word: 'oreja', breaks: { kind: 'category', label: 'una parte del cuerpo' } },
    ],
  },
]

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 3, pool: L1_PROMPTS },
  { n: 2, name: 'Nivel 2', rounds: 4, pool: L2_PROMPTS },
  { n: 3, name: 'Nivel 3', rounds: 6, pool: L3_PROMPTS },
]

// Fixed total of rounds across the whole day (3+4+6) — every round resolves
// with exactly one correct tap no matter how many wrong taps happen first, so
// this is a derivable constant rather than a piece of state.
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

/** A wrong tap's hint is derived from the decoy's own `breaks` tag rather
 * than hand-typed per word — the "no {category}" half always names the
 * ACTIVE prompt's real category, so a hint can never drift out of sync with
 * the prompt it belongs to. */
function hintFor(decoy: Decoy, prompt: Prompt): string {
  const word = `«${display(decoy.word)}»`
  return decoy.breaks.kind === 'letter'
    ? `${word} no empieza con ${prompt.letter}.`
    : `${word} es ${decoy.breaks.label}, no ${prompt.categoryLabel}.`
}

// Countries are proper nouns, so written as-is they'd be the only capitalised
// options and a "país" prompt would give itself away at a glance. Every option
// gets a leading capital instead, so capitalisation carries no clue.
function display(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
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

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']

const ROLL_TICK_MS = 90
// 6 ticks × 90ms ≈ 540ms, safely under the 700ms cap — it's decoration, not
// a countdown, so it only needs to read as "tumbling", not last any specific
// length.
const ROLL_TICKS = 6

export function TiraElDado({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Six prompts assigned to the six faces, redrawn from the level's pool each
  // time a level starts or is replayed — see the file header on why the pool
  // is bigger than 6.
  const facePrompts = useMemo(
    () => shuffle(level.pool).slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [usedFaces, setUsedFaces] = useState<Set<number>>(new Set())
  const [solvedCount, setSolvedCount] = useState(0)
  const [currentFace, setCurrentFace] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [displayFace, setDisplayFace] = useState(1)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch) — a same-level replay keeps it.
  const [mistakes, setMistakes] = useState(0)

  const rollIntervalRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current !== null) window.clearInterval(rollIntervalRef.current)
    }
  }, [])

  const activePrompt = currentFace !== null ? facePrompts[currentFace - 1] : null
  const done = solvedCount >= level.rounds

  // Re-shuffled only when the active round actually changes (a new face
  // lands, or a level/replay redraws the pool) — keyed on the PRIMITIVES that
  // determine the active prompt, not on `activePrompt` itself, which is a
  // fresh object reference every render and would reshuffle the options on
  // every keystroke-unrelated re-render (e.g. a wrong tap) otherwise.
  const options = useMemo(
    () => (activePrompt ? shuffle([activePrompt.answer, ...activePrompt.decoys.map((d) => d.word)]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFace, roundKey, levelIdx],
  )

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
      setEliminated(new Set())
      setHint(null)
      setSolved(false)
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

  function guess(word: string) {
    if (!activePrompt || solved || eliminated.has(word)) return
    if (word === activePrompt.answer) {
      setSolved(true)
      setHint(null)
      window.setTimeout(() => {
        setSolvedCount((c) => c + 1)
        setCurrentFace(null)
        setEliminated(new Set())
        setSolved(false)
      }, 500)
    } else {
      const decoy = activePrompt.decoys.find((d) => d.word === word)
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(word))
      setHint(decoy ? hintFor(decoy, activePrompt) : null)
    }
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on levelIdx — an effect-based reset lags one
  // render behind, so `done` (derived straight from solvedCount) would read
  // the previous level's stale-true value on the very render that arrives at
  // the new level and fire onComplete with garbage. Same reasoning as
  // ElVuelto.tsx / SumaHastaDiez.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setUsedFaces(new Set())
    setSolvedCount(0)
    setCurrentFace(null)
    setRolling(false)
    setDisplayFace(1)
    setEliminated(new Set())
    setHint(null)
    setSolved(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setUsedFaces(new Set())
    setSolvedCount(0)
    setCurrentFace(null)
    setRolling(false)
    setDisplayFace(1)
    setEliminated(new Set())
    setHint(null)
    setSolved(false)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when the last level's last round resolves. A
  // genuine full-day restart (the wrap back to level 1) gets a new roundKey,
  // so it can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const dieLabel = rolling
    ? 'Tirando el dado…'
    : currentFace === null
      ? 'Tirar el dado'
      : `El dado mostró el número ${currentFace}`

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tirá el dado y encontrá la palabra</h2>
        {!done && (
          <p className="mt-2 text-base font-medium text-tiam-blue">
            {currentFace === null ? 'Tocá el dado para tirar.' : 'Elegí la palabra que corresponda.'}
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

          {/* Prompt + options */}
          {currentFace !== null && activePrompt && (
            <>
              <p className="mt-4 text-center text-xl font-bold text-slate-800 sm:text-2xl">
                Buscá {activePrompt.categoryLabel} que empiece con
                <span className="ml-2 inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl bg-tiam-blue px-2 align-middle text-2xl font-black text-white">
                  {activePrompt.letter}
                </span>
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {options.map((word) => {
                  const isEliminated = eliminated.has(word)
                  const isSolved = solved && word === activePrompt.answer
                  return (
                    <button
                      key={word}
                      type="button"
                      disabled={solved || isEliminated}
                      onClick={() => guess(word)}
                      className={[
                        'relative min-h-[64px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition sm:text-xl',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                        isSolved
                          ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
                          : isEliminated
                            ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                            : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      {display(word)}
                      {isSolved && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
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
            Tiraste el dado {level.rounds} veces y encontraste todas las palabras — ¡completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {levelIdx === LEVELS.length - 1 && (
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Otra tirada
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
