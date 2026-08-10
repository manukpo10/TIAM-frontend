import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Es esta sombra" — día 17 (Mes 2), agnosias. A colored reference object is
 * shown; among 4-5 black silhouette candidates (same rough scale/pose —
 * single centered everyday object, nothing rotated or resized to cheat with),
 * only one is actually that object. Tap the matching silhouette.
 *
 * Silhouettes are DERIVED, not separately generated: every candidate reuses
 * the exact same colored asset as the reference option, rendered with
 * Tailwind's `brightness-0` filter utility (`filter: brightness(0)`), which
 * zeroes RGB while preserving alpha — a crisp black cutout with no separate
 * "shadow" art to keep in sync. This only works because the `es-esta-sombra/`
 * assets are matted to real alpha transparency (a border-seeded flood fill
 * so enclosed pale regions — a sneaker's white sole — stay opaque instead of
 * being punched through by a same-color-as-background heuristic).
 *
 * Same eliminate-and-retry mechanic as EncontraLaFiguraIgual.tsx (this app's
 * closest sibling: one target, several tappable options, a wrong tap just
 * eliminates that option and nudges, never ends the round) — so
 * totalAttempts = mistakes + a fixed round count, same accounting.
 *
 * REBUILT per professional feedback ("muy fácil, muy infantil") + explicit
 * user request to harden rather than replace the exercise. Two independent
 * problems, two independent fixes:
 * (1) "Infantil": the original 10 objects were flat cartoon-sticker icons
 *     (bold uniform outline, candy-flat colors) — a visibly different, more
 *     childish genre than the photorealistic style everywhere else in this
 *     app. Regenerated all objects as photorealistic studio product photos.
 * (2) "Fácil": decoys were picked uniform-random from a small pool of
 *     maximally-DIFFERENT silhouette shapes (a shoe vs a guitar vs a fish),
 *     so matching was trivial by rough outline category with zero real
 *     discrimination needed. Fixed by expanding the pool to 18 objects
 *     organized into 9 deliberately-confusable SILHOUETTE PAIRS (same rough
 *     outline family, genuinely different only on close inspection — see
 *     SIBLING below) and biasing L2/L3 decoys to always include the
 *     target's pair-sibling, so the harder levels force a real look instead
 *     of eliminating options by category at a glance. L1 stays fully random
 *     (gentle intro), matching this app's usual easy-first ramp.
 */

const POOL_IDS = [
  'zapatilla', 'bota',
  'sombrero', 'gorra',
  'paraguas', 'baston',
  'guitarra', 'violin',
  'taza', 'jarra',
  'tijera', 'pinza',
  'pez', 'hoja',
  'llave', 'destornillador',
  'pelota', 'manzana',
]
const LABELS: Record<string, string> = {
  zapatilla: 'la zapatilla',
  bota: 'la bota',
  sombrero: 'el sombrero',
  gorra: 'la gorra',
  paraguas: 'el paraguas',
  baston: 'el bastón',
  guitarra: 'la guitarra',
  violin: 'el violín',
  taza: 'la taza',
  jarra: 'la jarra',
  tijera: 'la tijera',
  pinza: 'la pinza',
  pez: 'el pez',
  hoja: 'la hoja',
  llave: 'la llave',
  destornillador: 'el destornillador',
  pelota: 'la pelota',
  manzana: 'la manzana',
}

// Deliberately confusable silhouette pairs (same rough outline family —
// footwear, headwear, handled vessel, hinged tool, curvy string instrument,
// etc.) — see the file header. Symmetric: every id maps to exactly one
// sibling and vice versa.
const SIBLING: Record<string, string> = {
  zapatilla: 'bota', bota: 'zapatilla',
  sombrero: 'gorra', gorra: 'sombrero',
  paraguas: 'baston', baston: 'paraguas',
  guitarra: 'violin', violin: 'guitarra',
  taza: 'jarra', jarra: 'taza',
  tijera: 'pinza', pinza: 'tijera',
  pez: 'hoja', hoja: 'pez',
  llave: 'destornillador', destornillador: 'llave',
  pelota: 'manzana', manzana: 'pelota',
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/es-esta-sombra/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

interface Level {
  n: number
  name: string
  rounds: number
  options: number
  // Force the target's confusable SIBLING into the decoy set (see SIBLING
  // above) instead of picking decoys fully at random. Off for nivel 1 so
  // the day still opens with an easy, unambiguous warm-up round.
  biasSibling: boolean
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, options: 4, biasSibling: false },
  { n: 2, name: 'Nivel 2', rounds: 3, options: 4, biasSibling: true },
  { n: 3, name: 'Nivel 3', rounds: 3, options: 5, biasSibling: true },
]
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

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

interface Round {
  targetId: string
  optionIds: string[]
}
function makeRound(level: Level): Round {
  const targetId = pickOne(POOL_IDS)
  const rest = POOL_IDS.filter((id) => id !== targetId)
  let decoys: string[]
  if (level.biasSibling) {
    // Guarantee the target's look-alike sibling is one of the decoys, then
    // fill the rest at random — the sibling is what actually makes this
    // round require a careful look instead of a glance.
    const sibling = SIBLING[targetId]
    const others = shuffle(rest.filter((id) => id !== sibling))
    decoys = [sibling, ...others].slice(0, level.options - 1)
  } else {
    decoys = shuffle(rest).slice(0, level.options - 1)
  }
  return { targetId, optionIds: shuffle([targetId, ...decoys]) }
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!']
const HINTS = ['Esa sombra no es — fijate bien en la forma.', 'Casi. Compará el contorno con cuidado.', 'No es esa — mirá bien la silueta de arriba.']
const ACCENT = '#DB2777' // rose

export function EsEstaSombra({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which rounds (target + decoy silhouettes, one per round) are playing for
  // level i THIS "epoch" (a full 3-level pass). Decided once per epoch — at
  // mount, and again on "Hacer otro" — never re-rolled just because the
  // player re-visits a level, so "Repetir" can hand back the exact same
  // rounds deterministically instead of re-generating and accidentally
  // landing on something new.
  const [epochRounds, setEpochRounds] = useState(() =>
    LEVELS.map((lvl) => Array.from({ length: lvl.rounds }, () => makeRound(lvl))),
  )
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3, only zeroed on a true
  // day restart (restartEpoch below) — same policy as every sibling game.
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(optionId: string) {
    if (!round || resolved || eliminated.has(optionId)) return
    if (optionId === round.targetId) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(optionId))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level/round change — see
  // ElVuelto.tsx for why an effect-based reset would let `done` read stale
  // right as levelIdx reaches the last level, firing onComplete with garbage.
  // "Siguiente nivel" — advance within the SAME attempt. epochRounds is left
  // alone: level i+1's rounds were already generated when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }
  // Shared by both restart buttons on the final level's complete card.
  // roundKey always bumps here: it's the "which attempt is this" generation
  // counter the onComplete effect uses to fire again on a replay,
  // independent of whether the rounds themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same rounds as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh set of rounds per level.
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => Array.from({ length: lvl.rounds }, () => makeRound(lvl))))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(219, 39, 119, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuál es esta sombra?</h2>
            <p className="mt-2 text-base text-slate-500">Tocá la sombra que es igual al objeto de arriba.</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%`, backgroundColor: ACCENT }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Reference: the object in full color */}
          <div className="relative mx-auto mt-3 aspect-square w-28 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-2 sm:mt-6 sm:w-32">
            {imgFor(round.targetId) && (
              <img src={imgFor(round.targetId)} alt={LABELS[round.targetId] ?? ''} className="h-full w-full object-contain" draggable={false} />
            )}
          </div>

          {/* Candidates: same assets, rendered as pure black silhouettes */}
          <div className={`mt-4 grid gap-3 sm:mt-6 ${level.options <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {round.optionIds.map((optId) => {
              const isEliminated = eliminated.has(optId)
              const isCorrectShown = resolved && optId === round.targetId
              return (
                <button
                  key={optId}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(optId)}
                  aria-label="Sombra"
                  className={[
                    'relative flex h-24 items-center justify-center rounded-2xl border-2 bg-white p-2 transition sm:h-28',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-30' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {imgFor(optId) && (
                    <img
                      src={imgFor(optId)}
                      alt=""
                      className="h-full w-full object-contain brightness-0"
                      draggable={false}
                    />
                  )}
                  {isCorrectShown && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste las {level.rounds} sombras — completaste el {level.name.toLowerCase()}!
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
