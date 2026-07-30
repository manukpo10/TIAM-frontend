import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La intrusa" — a visual-search / selective-attention mini-game, pure text.
 *
 * A dense grid repeats the SAME word dozens of times; exactly one cell holds
 * a DIFFERENT word (the "intrusa") — tap it. No illustration needed: the
 * difficulty engine here is grid density + how visually close the intruder is
 * to the repeated word, the same escalation strategy CazadorDeLetras uses for
 * single letters, just one level up at word granularity:
 *   L1 completely different word (pops out by shape/length alone)
 *   L2 same length, several letters shared (SOLO vs SOLA)
 *   L3 longer word, exactly ONE letter differs, placed mid-word (hardest to
 *      notice — start/end letters are what peripheral vision catches first)
 *
 * VARIAS rondas por nivel (mismo patrón que EncontraLaFiguraIgual): cada
 * ronda es un par (palabra repetida, intrusa) sorteado sin reemplazo de un
 * pool curado por nivel. A wrong tap only wiggles (never permanently grays a
 * cell) — same convention as BuscarLosRojos/CazadorDeLetras, since graying
 * out dozens of cells as the player scans would look cluttered and would
 * quietly shrink the search space for them.
 */

interface WordPair {
  base: string
  intruder: string
}

// Curated, not random — a randomly-generated "different word" can't guarantee
// a controlled similarity level (that's the whole difficulty axis here).
const L1_PAIRS: WordPair[] = [
  { base: 'CASA', intruder: 'AVION' },
  { base: 'FLOR', intruder: 'LIBRO' },
  { base: 'NUBE', intruder: 'PEINE' },
  { base: 'MESA', intruder: 'CAMION' },
  { base: 'SILLA', intruder: 'ZAPATO' },
]
const L2_PAIRS: WordPair[] = [
  { base: 'CASA', intruder: 'CAZA' },
  { base: 'SOLO', intruder: 'SOLA' },
  { base: 'ROSA', intruder: 'ROJA' },
  { base: 'MOTO', intruder: 'MODO' },
  { base: 'PATO', intruder: 'PASO' },
]
const L3_PAIRS: WordPair[] = [
  { base: 'VENTANA', intruder: 'VENTASA' },
  { base: 'CAMINO', intruder: 'CAMENO' },
  { base: 'ZAPATO', intruder: 'ZAPETO' },
  { base: 'PALOMA', intruder: 'PALEMA' },
  { base: 'CUCHARA', intruder: 'CUCHASA' },
]

interface Level {
  n: number
  name: string
  instruction: string
  rounds: number
  pool: WordPair[]
  cells: number
  boardClass: string
  textClass: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    instruction: 'Tocá la palabra diferente',
    rounds: 3,
    pool: L1_PAIRS,
    cells: 16,
    boardClass: 'grid-cols-4 gap-2 sm:gap-3',
    textClass: 'text-base sm:text-lg',
  },
  {
    n: 2,
    name: 'Nivel 2',
    instruction: 'Tocá la palabra diferente (¡se parecen!)',
    rounds: 3,
    pool: L2_PAIRS,
    cells: 30,
    boardClass: 'grid-cols-5 gap-1.5 sm:gap-2.5',
    textClass: 'text-sm sm:text-base',
  },
  {
    n: 3,
    name: 'Nivel 3',
    instruction: 'Tocá la palabra diferente (fijate bien, letra por letra)',
    rounds: 4,
    pool: L3_PAIRS,
    cells: 42,
    boardClass: 'grid-cols-6 gap-1 sm:gap-2',
    textClass: 'text-[11px] sm:text-sm',
  },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)

interface Round {
  pair: WordPair
  intruderIdx: number
  cells: string[]
}

function buildRounds(level: Level): Round[] {
  return pick(level.pool, level.rounds).map((pair) => {
    const intruderIdx = Math.floor(Math.random() * level.cells)
    const cells = Array.from({ length: level.cells }, (_, i) => (i === intruderIdx ? pair.intruder : pair.base))
    return { pair, intruderIdx, cells }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué atención!']

export function LaIntrusa({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `level.rounds` rondas armadas una sola vez por nivel/roundKey — mismo
  // patrón que EncontraLaFiguraIgual (no se regeneran al avanzar roundIdx).
  const rounds = useMemo(
    () => buildRounds(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [found, setFound] = useState(false)
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Mistakes, accumulated across levels 1→2→3 and only zeroed on a genuine
  // day restart (wrap from level 3 back to level 1) — see nextLevel below.
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
  }, [done])

  function handleTap(idx: number) {
    if (!round || found) return
    if (idx === round.intruderIdx) {
      setFound(true)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setFound(false)
      }, 700)
      return
    }
    setWrongIdx(idx)
    setMistakes((m) => m + 1)
    window.setTimeout(() => setWrongIdx((w) => (w === idx ? null : w)), 500)
  }

  // Resets happen HERE, synchronously with the level/round change — an
  // effect keyed on [levelIdx, roundKey] lags one render behind and would
  // let `done` read the previous level's stale true right as levelIdx
  // reaches the last level, firing onComplete with garbage (same trap
  // documented in every other game in this folder).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setFound(false)
    setWrongIdx(null)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setFound(false)
    setWrongIdx(null)
  }

  // Fires once per roundKey when level 3's last round resolves. A full day
  // restart (wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire
  // twice. totalAttempts = accumulated mistakes + one correct find per round
  // across every level played (level.rounds summed, not just level 3's).
  const totalRoundsAllLevels = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + totalRoundsAllLevels })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{level.instruction}</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Board */}
      {!done && round && (
        <div className={`mx-auto mt-5 grid max-w-lg ${level.boardClass}`}>
          {round.cells.map((word, i) => {
            const isIntruder = i === round.intruderIdx
            const isFoundCell = found && isIntruder
            const isWrong = wrongIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleTap(i)}
                disabled={found}
                aria-label={`palabra ${word}`}
                className={[
                  'relative flex min-h-[44px] items-center justify-center rounded-xl border-2 bg-white px-1 py-2 font-bold uppercase tracking-wide text-slate-700 transition sm:min-h-[48px]',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  level.textClass,
                  isFoundCell
                    ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                    : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  // Wiggle alone marks a wrong tap — never a red border, same
                  // convention as every other search game in this folder.
                  isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300' : '',
                ].join(' ')}
              >
                {word}
              </button>
            )
          })}
        </div>
      )}

      {/* Wrong-tap hint */}
      {!done && wrongIdx !== null && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">Esa se repite, ¡seguí buscando! 🙂</p>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">¡Encontraste todas las intrusas — completaste el {level.name.toLowerCase()}!</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Jugar esta ronda otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
