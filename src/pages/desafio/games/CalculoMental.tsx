import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cálculo mental" — place-value arithmetic. One number at the top and a row
 * of cells to fill: add ten, take ten away, add a hundred, take a hundred
 * away. Cells fill left to right; four options for the one in focus.
 *
 * The exercise is not the addition, it is knowing WHICH digit moves. So the
 * decoys are the actual mistakes people make: touching the units instead of
 * the tens, touching the hundreds instead of the tens, or going the wrong
 * direction. A round of random wrong numbers would be easy to eliminate on
 * sight and would test nothing.
 *
 * Level 3 picks numbers whose tens digit is 0 or 9, so the operation has to
 * carry or borrow across a place (194 + 10, 405 − 10). That crossing is where
 * mental arithmetic actually breaks down, and a level of 341 ± 10 would never
 * reach it.
 */

type Op = '+10' | '-10' | '+100' | '-100'

const OP_LABEL: Record<Op, string> = {
  '+10': 'Sumale 10',
  '-10': 'Restale 10',
  '+100': 'Sumale 100',
  '-100': 'Restale 100',
}
const OP_SHORT: Record<Op, string> = {
  '+10': '+ 10',
  '-10': '− 10',
  '+100': '+ 100',
  '-100': '− 100',
}
const DELTA: Record<Op, number> = { '+10': 10, '-10': -10, '+100': 100, '-100': -100 }

interface Level {
  n: number
  name: string
  rounds: number
  ops: Op[]
  /** Level 3 forces a carry/borrow across the tens place. */
  crossing: boolean
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, ops: ['+10', '-10'], crossing: false },
  { n: 2, name: 'Nivel 2', rounds: 2, ops: ['+10', '-10', '+100', '-100'], crossing: false },
  { n: 3, name: 'Nivel 3', rounds: 2, ops: ['+10', '-10', '+100', '-100'], crossing: true },
]

const TOTAL_CELLS = LEVELS.reduce((sum, l) => sum + l.rounds * l.ops.length, 0)

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

/**
 * Range keeps every answer a positive 3-digit number: ±100 must not overflow
 * into four digits or fall below 100, which would change how the number reads
 * mid-round and muddy what the exercise is about.
 */
function pickBase(crossing: boolean): number {
  const hundreds = 2 + Math.floor(Math.random() * 7) // 2..8
  const tens = crossing ? pickOne([0, 9]) : 1 + Math.floor(Math.random() * 8) // 1..8
  const units = Math.floor(Math.random() * 10)
  return hundreds * 100 + tens * 10 + units
}

/**
 * Wrong answers drawn from real error patterns, then topped up from near
 * misses if any collided. Sampling without replacement from a candidate list
 * (rather than re-rolling) means three distinct decoys are always available.
 */
function optionsFor(base: number, op: Op): number[] {
  const answer = base + DELTA[op]
  const wrongPlace = Math.abs(DELTA[op]) === 10 ? [base + 1, base - 1, base + 100, base - 100] : [base + 10, base - 10, base + 1, base - 1]
  const wrongDirection = base - DELTA[op]
  const candidates = [wrongDirection, ...wrongPlace, answer + 10, answer - 10, answer + 1, answer - 1]
  const decoys: number[] = []
  for (const c of candidates) {
    if (decoys.length === 3) break
    if (c > 0 && c !== answer && !decoys.includes(c)) decoys.push(c)
  }
  return shuffle([answer, ...decoys])
}

interface Round {
  base: number
  ops: Op[]
}

function buildRounds(level: Level): Round[] {
  return Array.from({ length: level.rounds }, () => ({
    base: pickBase(level.crossing),
    ops: shuffle(level.ops),
  }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Fijate bien qué cifra tiene que cambiar.',
  'Casi. ¿Qué número se mueve cuando sumás o restás diez?',
  'No es ese. Probá de nuevo mirando la cifra del medio.',
]

export function CalculoMental({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Every round's number and operation order, per level. Decided once — at
  // mount — never re-rolled just because the player re-visits a level, so
  // "Repetir" can hand back the exact same numbers deterministically (the
  // option chips below may still reshuffle their on-screen position).
  const [epoch] = useState(() => LEVELS.map((lvl) => buildRounds(lvl)))
  const rounds = epoch[levelIdx]

  const [roundIdx, setRoundIdx] = useState(0)
  const [cellIdx, setCellIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= rounds.length

  const currentOp = round ? round.ops[cellIdx] : undefined
  const options = useMemo(
    () => (round && currentOp ? optionsFor(round.base, currentOp) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round, cellIdx, roundKey, levelIdx],
  )

  const [eliminated, setEliminated] = useState<Set<number>>(new Set())
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function guess(value: number) {
    if (!round || !currentOp || eliminated.has(value)) return
    if (value === round.base + DELTA[currentOp]) {
      setHint(null)
      setEliminated(new Set())
      if (cellIdx < round.ops.length - 1) {
        setCellIdx((i) => i + 1)
      } else {
        setRoundIdx((i) => i + 1)
        setCellIdx(0)
      }
      return
    }
    setEliminated((prev) => new Set(prev).add(value))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` would read the
  // previous level's stale-true value on the very render that arrives at the
  // new level and fire onComplete with garbage. Same as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setCellIdx(0)
    setEliminated(new Set())
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level's last cell resolves. A
  // genuine full-day restart (the wrap to level 1) gets a new roundKey so it
  // can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_CELLS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && round && currentOp && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{OP_LABEL[currentOp]}</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Número {roundIdx + 1} de {rounds.length}
            </p>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* The number, then the row of cells being filled */}
          <p className="mt-5 text-center text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            {round.base}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
            {round.ops.map((op, i) => {
              const filled = i < cellIdx
              const isCurrent = i === cellIdx
              return (
                <div
                  key={op}
                  className={[
                    'flex min-h-[56px] flex-col items-center justify-center rounded-2xl border-2 px-2 py-1.5',
                    filled ? 'border-tiam-green bg-tiam-green/5' : '',
                    isCurrent ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                    !filled && !isCurrent ? 'border-slate-200 bg-white' : '',
                  ].join(' ')}
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {OP_SHORT[op]}
                  </span>
                  <span className="text-xl font-extrabold text-slate-800">
                    {filled ? round.base + DELTA[op] : isCurrent ? '?' : ''}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Options for the cell in focus */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {options.map((value) => {
              const isEliminated = eliminated.has(value)
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isEliminated}
                  onClick={() => guess(value)}
                  aria-label={`${value}`}
                  className={[
                    'flex min-h-[56px] items-center justify-center rounded-2xl border-2 text-2xl font-extrabold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {value}
                </button>
              )
            })}
          </div>

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Completaste los {rounds.length} números — ¡terminaste el {level.name.toLowerCase()}!
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
