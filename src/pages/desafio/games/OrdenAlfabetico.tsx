import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Orden alfabético" — día 10 (mes 2), ejecutivas. 6-8 words are shown
 * shuffled; tap them in the order they'd appear in the dictionary. Tapping
 * the correct next word moves it up into a growing numbered list; tapping
 * any other word is a mistake but changes nothing else — it stays on the
 * board and the round keeps going, exactly like this codebase's other
 * "tap the next one in order" games (CaminoNumerico's numbered dots,
 * ClaveDeSimbolos's decoding row): a wrong tap flashes muted (never red),
 * never eliminates, never blocks progress, no timer.
 *
 * Deliberately NOT built on useSequencingPuzzle — that hook is for
 * PLACE-THEN-CHECK-AT-THE-END puzzles (a bank you fill and only find out if
 * it's right once every slot is full). This game validates each tap live,
 * the same family as CaminoNumerico/ClaveDeSimbolos above, not the
 * placement family (PlanificaLaManana/DosPistas).
 *
 * The correct order is derived at runtime via `localeCompare(word, 'es')` —
 * never hand-duplicated alongside the word list — so there is exactly one
 * source of truth. Word sets are authored so the alphabetical order is
 * unambiguous (no pair differs only by an accent): L1 words all start with
 * different letters (order by first letter alone), L2 mixes in one shared-
 * first-letter pair, L3 sets are ALL the same first letter, forcing a real
 * letter-by-letter comparison — the "more steps" ramp this codebase's other
 * multi-level games use (CualNoVa's near/adjacent/abstract intruder,
 * QueOficioEs's one-tool/two-tools/same-rubro decoys).
 */

interface Level {
  n: number
  name: string
  rounds: number
  pool: string[][]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    pool: [
      ['banana', 'casa', 'dado', 'elefante', 'foca', 'gato'],
      ['huevo', 'iglesia', 'jardín', 'kilo', 'limón', 'mango'],
      ['árbol', 'balcón', 'cielo', 'ventana', 'yogur', 'zapallo'],
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    pool: [
      ['árbol', 'cama', 'luna', 'mano', 'mesa', 'perro', 'sol'],
      ['fuego', 'nube', 'oso', 'radio', 'silla', 'taza', 'techo'],
      ['copa', 'dedo', 'diente', 'llave', 'mesa', 'oso', 'río'],
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    pool: [
      ['papa', 'pelota', 'pera', 'perro', 'pino', 'planta', 'pluma', 'primo'],
      ['calle', 'cama', 'campo', 'cara', 'carta', 'casa', 'cielo', 'ciudad'],
      ['madre', 'mano', 'mapa', 'mesa', 'motor', 'mueble', 'mundo', 'museo'],
    ],
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
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se ordena!', '¡Perfecto!', '¡Qué buen abecedario!']

export function OrdenAlfabetico({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which 2 word-sets (and in what order) are playing for level i THIS
  // "epoch" (a full 3-level pass). Decided once per epoch, at mount — never
  // re-rolled just because the player re-visits a level, so "Repetir" can
  // hand back the exact same rounds deterministically instead of
  // re-randomizing.
  const [epochRoundSets] = useState(() =>
    LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)),
  )
  const level = LEVELS[levelIdx]
  const roundSets = epochRoundSets[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const words = roundSets[roundIdx]
  const correctOrder = useMemo(() => [...words].sort((a, b) => a.localeCompare(b, 'es')), [words])
  const bankOrder = useMemo(
    () => shuffle(words),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )

  const [placed, setPlaced] = useState<string[]>([])
  const [wrongWord, setWrongWord] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (wrap
  // from level 3 back to level 1) — same policy as every other game here.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const roundDone = placed.length >= words.length
  const done = roundDone && roundIdx >= level.rounds - 1

  useEffect(() => {
    if (roundDone) setPraise(pickOne(PRAISE))
  }, [roundDone])

  function tapWord(word: string, alreadyPlacedAt: number) {
    if (roundDone || alreadyPlacedAt !== -1) return // already placed, silent no-op
    if (word === correctOrder[placed.length]) {
      setPlaced((p) => [...p, word])
      setWrongWord(null)
      setCorrectCount((c) => c + 1)
    } else {
      setWrongWord(word)
      setMistakes((m) => m + 1)
      window.setTimeout(() => setWrongWord((w) => (w === word ? null : w)), 900)
    }
  }

  // Intra-level round advance (2 rounds per level, drawn from the pool at
  // epoch-start) — a different, existing mid-level mechanic from the
  // whole-epoch restart below, so it's left untouched.
  function nextRound() {
    setPlaced([])
    setWrongWord(null)
    setRoundIdx((i) => i + 1)
  }
  // Resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundKey — never in a separate effect keyed on them (the
  // stale-flag hazard fixed across this codebase's other games).

  // "Siguiente nivel" — advance within the SAME epoch. epochRoundSets is left
  // alone: level i+1's drawn rounds were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPlaced([])
    setWrongWord(null)
  }

  // Shared by both restart buttons on the final level's complete card.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setPlaced([])
    setWrongWord(null)
    setMistakes(0)
    setCorrectCount(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same word-sets, same order, as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, correctCount])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          {level.name}
        </span>
        {!roundDone && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá las palabras en orden alfabético</h2>
            <p className="mt-2 text-base text-slate-500">Como aparecerían en el diccionario.</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {level.rounds}
            </p>
          </>
        )}
      </div>

      {!roundDone && (
        <>
          {/* Lista que se va armando */}
          <div className="mt-5 min-h-[56px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {placed.length === 0 ? (
              <p className="text-center text-base text-slate-400">Tocá las palabras de abajo para empezar</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {placed.map((word, i) => (
                  <span
                    key={word}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-tiam-green bg-tiam-green/10 px-3 text-base font-bold text-slate-900"
                  >
                    <span className="text-slate-400">{i + 1}.</span>
                    {word}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Banco de palabras */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {bankOrder.map((word) => {
              const placedAt = placed.indexOf(word)
              if (placedAt !== -1) return null
              const isWrongFlash = wrongWord === word
              return (
                <button
                  key={word}
                  type="button"
                  onClick={() => tapWord(word, placedAt)}
                  className={[
                    'min-h-[48px] rounded-xl border-2 px-4 py-2 text-base font-bold text-slate-700 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isWrongFlash
                      ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-400 bg-white'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {word}
                </button>
              )
            })}
          </div>

          {wrongWord && (
            <p className="mt-4 text-center text-base font-medium text-slate-500">
              Esa todavía no — pensá cuál empieza antes en el abecedario.
            </p>
          )}
        </>
      )}

      {/* Ronda / nivel completo */}
      {roundDone && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {done
              ? `¡Ordenaste todas las palabras — completaste el ${level.name.toLowerCase()}!`
              : `¡Ordenaste las ${words.length} palabras de esta ronda!`}
          </p>
          {done ? (
            levelIdx < LEVELS.length - 1 ? (
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
            )
          ) : (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente ronda
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
