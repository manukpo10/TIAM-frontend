import { useEffect, useRef, useState } from 'react'
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
 *
 * Nivel 3's board now matches nivel 2's size (30 cells, 5 columns) exactly —
 * cell WIDTH is set by column count, not total cell count, so a denser
 * 6-column grid would still render cramped even with fewer cells. Nivel 3's
 * difficulty still comes entirely from the word pairs, not from the grid.
 *
 * Nivel 3's LAST round is the one exception to "find THE intruder"
 * (singular): it hides TWO different intruder words at once (see
 * `lastRoundIntruders` on Level / the plural `intruderIdxs` on Round) and
 * only resolves once both are tapped.
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
  /** How many intruders the LAST round of this level requires. Default 1. */
  lastRoundIntruders?: number
  /** Instruction shown only during the last round, when it differs from the
   *  level's usual "find the one different word" (e.g. nivel 3's final round
   *  needs the player to know TWO intruders are hiding). */
  lastRoundInstruction?: string
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
    rounds: 2,
    pool: L3_PAIRS,
    // Same cells/boardClass/textClass as nivel 2 on purpose — see the file
    // header comment. Do not shrink textClass or grow columns past 5 here.
    cells: 30,
    boardClass: 'grid-cols-5 gap-1.5 sm:gap-2.5',
    textClass: 'text-sm sm:text-base',
    lastRoundIntruders: 2,
    lastRoundInstruction: 'Tocá las DOS palabras diferentes (hay dos intrusas)',
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
  intruderIdxs: number[]
  cells: string[]
}

function buildRounds(level: Level): Round[] {
  // Normally 1 intruder per round, sourced from that round's own pair. A
  // level can require MORE intruders on its last round only (nivel 3 here).
  // The extra intruder WORD(S) are drawn from additional pairs pulled from
  // the pool in this same shuffle, so the whole epoch still respects "sin
  // reemplazo" — no pair backs two different rounds, or a round and its own
  // extra intruder.
  const intrudersOnLastRound = level.lastRoundIntruders ?? 1
  const extraPairsNeeded = Math.max(0, intrudersOnLastRound - 1)
  const drawn = pick(level.pool, level.rounds + extraPairsNeeded)
  const roundPairs = drawn.slice(0, level.rounds)
  const extraIntruderWords = drawn.slice(level.rounds).map((p) => p.intruder)

  return roundPairs.map((pair, i) => {
    const isLastRound = i === level.rounds - 1
    const intruderCount = isLastRound ? intrudersOnLastRound : 1
    const intruderWords = [pair.intruder, ...extraIntruderWords.slice(0, intruderCount - 1)]
    const intruderIdxs = pick(
      Array.from({ length: level.cells }, (_, idx) => idx),
      intruderCount,
    )
    const cells = Array.from({ length: level.cells }, (_, idx) => {
      const slot = intruderIdxs.indexOf(idx)
      return slot === -1 ? pair.base : intruderWords[slot]
    })
    return { pair, intruderIdxs, cells }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué atención!']

export function LaIntrusa({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Rondas armadas (pares sorteados Y su posición de intrusa, juntos como una
  // sola unidad) para CADA nivel a la vez — decididas una sola vez, al
  // montar, nunca vueltas a sortear por revisitar un nivel, así "Repetir"
  // devuelve exactamente las mismas rondas de forma determinística.
  const [epochRounds] = useState(() => LEVELS.map((lvl) => buildRounds(lvl)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  // Indices (within round.cells) of intruders tapped so far THIS round — 1
  // slot fills up for every round except nivel 3's last, which needs 2.
  const [foundIdxs, setFoundIdxs] = useState<number[]>([])
  // `round` is undefined once `done` (roundIdx runs one past the last valid
  // index) — guard here since this recomputes on every render regardless.
  const isRoundSolved = !!round && foundIdxs.length === round.intruderIdxs.length
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Mistakes, accumulated across levels 1→2→3 and only zeroed on a genuine
  // day restart (wrap from level 3 back to level 1) — see restartEpoch below.
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
  }, [done])

  function handleTap(idx: number) {
    if (!round || isRoundSolved) return
    if (round.intruderIdxs.includes(idx)) {
      if (foundIdxs.includes(idx)) return // already-found intruder cell, no-op
      const nextFound = [...foundIdxs, idx]
      setFoundIdxs(nextFound)
      // Only advance once EVERY intruder this round needs has been tapped —
      // 1 for every round today except nivel 3's last round, which needs 2.
      if (nextFound.length === round.intruderIdxs.length) {
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setFoundIdxs([])
        }, 700)
      }
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

  // "Siguiente nivel" — avanza dentro de la MISMA epoch. Solo se llama
  // mientras levelIdx < LEVELS.length - 1; epochRounds queda intacto — las
  // rondas del nivel siguiente ya se armaron al empezar esta epoch.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setFoundIdxs([])
    setWrongIdx(null)
  }

  // roundKey siempre avanza acá: es el contador de "qué intento es este" que
  // usa el efecto de onComplete para volver a dispararse en una repetición,
  // más allá de si las rondas cambiaron o no. Sólo se muestra cuando el
  // nivel 3 está completo, así que siempre es un reinicio real del día — se
  // pone en cero el contador de errores.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setFoundIdxs([])
    setWrongIdx(null)
    setMistakes(0)
  }
  // "Repetir" — las mismas rondas del intento que acaba de terminar.
  function restartSame() {
    restartEpoch()
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              {roundIdx === level.rounds - 1 && level.lastRoundInstruction ? level.lastRoundInstruction : level.instruction}
            </h2>
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
            const isFoundCell = foundIdxs.includes(i)
            const isWrong = wrongIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleTap(i)}
                disabled={isRoundSolved || isFoundCell}
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
        <p className="mt-4 text-center text-base font-medium text-slate-500">Esa se repite, ¡seguí buscando! 🙂</p>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">¡Encontraste todas las intrusas — completaste el {level.name.toLowerCase()}!</p>
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
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
