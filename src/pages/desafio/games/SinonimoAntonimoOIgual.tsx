import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Sinónimo, antónimo o igual" — a word shown with a visual mark decides
 * what to pick from a multiple-choice set: underlined → find a SYNONYM,
 * colored → find an ANTONYM, no mark → pick the SAME word. Adapted from the
 * classic voice-driven synonym/antonym/same drill to tap-only multiple
 * choice (3-4 options), since there's no free-text/voice input here.
 *
 * The mark is the only in-round signal (no per-round text ever states "find
 * the synonym") — reading it correctly IS half the exercise. The ready
 * screen and a persistent per-level hint line teach/reinforce the 3-way code
 * so players aren't relying purely on memory of the initial instructions.
 *
 * Antonym mark uses tiam-orange text on the prompt word only: at text-3xl+
 * font-extrabold this qualifies as WCAG "large text" (>=18.66px bold), whose
 * AA contrast threshold is 3:1 — tiam-orange on white (~3.6:1) clears that,
 * even though it fails the 4.5:1 small-text/badge threshold noted elsewhere
 * in this codebase. Never used here on body text or badges.
 *
 * Decoys are always same-dimension traps (a near-synonym of the prompt when
 * the answer is its antonym, a near-synonym when the answer is the identical
 * word, etc.) — same "plausible but wrong" philosophy as LosOpuestos.
 *
 * Content is fixed (2 curated rounds per level, no larger pool to sample
 * from), so "Repetir"/"Hacer otro" only differ in shuffle order — same
 * epochRounds/restart architecture as LaIntrusa, kept so both buttons are
 * always present and meaningfully different on the final completion card.
 */

type Mode = 'synonym' | 'antonym' | 'same'
interface Round {
  mode: Mode
  word: string
  answer: string
  decoys: string[]
}
interface Level {
  n: number
  name: string
  hint: string
  rounds: Round[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    hint: 'Subrayada = sinónimo · De color = antónimo · Sin marca = la misma palabra',
    rounds: [
      { mode: 'synonym', word: 'ALEGRE', answer: 'CONTENTO', decoys: ['TRISTE', 'ENOJADO'] },
      { mode: 'antonym', word: 'GRANDE', answer: 'CHICO', decoys: ['ENORME', 'ALTO'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    hint: 'Subrayada = sinónimo · De color = antónimo · Sin marca = la misma palabra',
    rounds: [
      { mode: 'same', word: 'CASA', answer: 'CASA', decoys: ['HOGAR', 'CABAÑA', 'EDIFICIO'] },
      { mode: 'synonym', word: 'RÁPIDO', answer: 'VELOZ', decoys: ['LENTO', 'FUERTE', 'SUAVE'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    hint: 'Subrayada = sinónimo · De color = antónimo · Sin marca = la misma palabra',
    rounds: [
      { mode: 'antonym', word: 'FÁCIL', answer: 'DIFÍCIL', decoys: ['SIMPLE', 'VALIENTE', 'PACIENTE'] },
      { mode: 'same', word: 'LIBERTAD', answer: 'LIBERTAD', decoys: ['INDEPENDENCIA', 'JUSTICIA', 'IGUALDAD'] },
    ],
  },
]

const TOTAL_ROUNDS = LEVELS.reduce((sum, lvl) => sum + lvl.rounds.length, 0)

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

const HINTS = ['Fijate bien en la marca de la palabra.', '¿Está subrayada, de color, o sin marca?', 'Probá con otra opción.']
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']

export function SinonimoAntonimoOIgual({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => shuffle(lvl.rounds)))
  const level = LEVELS[levelIdx]
  const order = epochRounds[levelIdx]
  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see restartEpoch below).
  const [mistakes, setMistakes] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (round ? shuffle([round.answer, ...round.decoys]) : []), [round])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(word: string) {
    if (!round || solved || eliminated.has(word)) return
    if (word === round.answer) {
      setSolved(true)
      setHint(null)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
      }, 500)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(word))
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level/round change — see
  // LaIntrusa.tsx for why an effect-based reset is unsafe (lags one render
  // behind, letting `done` read stale-true right as levelIdx hits the last
  // level and firing onComplete with garbage data).
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setMistakes(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => shuffle(lvl.rounds)))
  }

  // Fires once per roundKey when level 3's last round resolves. A full day
  // restart (wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire
  // twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 text-center sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          Desafío de lenguaje
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Sinónimo, antónimo o igual</h2>
        <p className="mt-3 text-base text-slate-600">Vas a ver una palabra con una marca. Según la marca, elegí la opción correcta:</p>
        <div className="mt-4 flex flex-col gap-2 text-left">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <span className="text-lg font-bold text-slate-800 underline decoration-tiam-blue decoration-4 underline-offset-4">Palabra</span>
            <span className="text-base text-slate-600">→ buscá un SINÓNIMO</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <span className="text-lg font-bold text-tiam-orange">Palabra</span>
            <span className="text-base text-slate-600">→ buscá un ANTÓNIMO</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <span className="text-lg font-bold text-slate-800">Palabra</span>
            <span className="text-base text-slate-600">→ elegí la MISMA palabra</span>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  const markClass =
    round?.mode === 'synonym'
      ? 'underline decoration-tiam-blue decoration-4 underline-offset-4 text-slate-800'
      : round?.mode === 'antonym'
        ? 'text-tiam-orange'
        : 'text-slate-800'

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuál corresponde según la marca?</h2>
            {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {currentIndex} de {order.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(currentIndex / order.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Prompt word */}
          <div className="mt-4 text-center sm:mt-6">
            <span
              className={`inline-block rounded-2xl border-2 border-slate-200 bg-white px-8 py-3 text-3xl font-extrabold tracking-wide sm:py-5 sm:text-4xl ${markClass}`}
            >
              {round.word}
            </span>
          </div>

          {/* Options */}
          <div className={options.length <= 3 ? 'mt-4 flex flex-col gap-3 sm:mt-6' : 'mt-4 grid grid-cols-2 gap-3 sm:mt-6'}>
            {options.map((opt) => {
              const isEliminated = eliminated.has(opt)
              const isSolved = solved && opt === round.answer
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(opt)}
                  aria-label={`palabra ${opt}`}
                  className={[
                    'min-h-[64px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 sm:text-xl',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Resolviste las {order.length} palabras — completaste el {level.name.toLowerCase()}!
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Hacer otro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
