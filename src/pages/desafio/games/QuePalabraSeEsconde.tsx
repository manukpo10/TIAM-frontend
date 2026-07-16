import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import { useSequencingPuzzle, type SequencingItem } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué palabra se esconde?" — an anagram-spelling game, replacing "Un
 * animal por letra" (day 3, lenguaje) after the reviewing professional
 * rejected that game as "muy infantil" for the target audience.
 *
 * Each round shows a SOURCE word and a CLUE for a different word — the
 * ANSWER — built from exactly the same letters (a true anagram pair, e.g.
 * GOTA → GATO). The source word's own letters are shuffled into tappable
 * tiles; the player taps them in the order that spells the ANSWER, tapping
 * a placed tile to send it back to the pool (undo) — same tap-to-place-only
 * interaction as "Ordená la frase," just at the LETTER grain instead of the
 * WORD grain, so `useSequencingPuzzle` is reused as-is: letters are just
 * items, and the hook doesn't care whether an "item" is a word or a letter.
 *
 * The clue is both the disambiguator (a few of these letter sets could spell
 * more than one real word — the clue picks which one) and the difficulty
 * ramp: L1's clue is an ILLUSTRATION of the answer (easiest — the picture
 * gives the word away; the actual challenge is spelling it while resisting
 * the pull of the source word's own familiar letter order). L2/L3's clue is
 * a short TEXT definition instead, with L3 using longer words (6-8 letters).
 *
 * NEVER a hard fail, and no timer anywhere (including no auto-advance
 * timeout on a correct answer — unlike ElVuelto/ContadorMasMenos, this game
 * always waits for an explicit tap, same choice OrdenarLaFrase makes and for
 * the same reason: there's a source→answer recap to read, and a clock here
 * would rush that read for this app's older-adult audience). A wrong
 * "Revisar" tap gets a muted-slate nudge and leaves every tile exactly
 * where the player put it — they keep retrying the same word until it's
 * right, with no "me rindo" path and no losing seven correct letters over
 * one wrong one. Because every round ends in a correct spelling,
 * totalAttempts = mistakes + TOTAL_ROUNDS is exactly right when reporting
 * (same formula/reasoning as ElVuelto.tsx's comment on this).
 *
 * Correctness is checked against the actual SPELLED STRING
 * (`placed.map(i => i.value).join('')`), not the hook's own positional
 * `isCorrect`. Several answers here repeat a letter (LLAMA, VACA, NADAR,
 * RATA, ANIMAR) — the hook tracks tiles by original-index id (by design, so
 * duplicate-VALUE items don't collapse), which means two tiles can show the
 * identical letter but carry different ids. A player who happens to tap the
 * "other" instance of a repeated letter still spells the word correctly and
 * must not be marked wrong for it, so the check compares letters, not tile
 * identity.
 *
 * VARIAS rondas por nivel (mismo patrón que ElVuelto/ContadorMasMenos):
 * ROUNDS_PER_LEVEL = [2, 3, 3], 8 palabras en total — same tuning as every
 * other retrofitted day, after the reviewing professional found 12-round
 * games too tiring for the 10-15 min/day this product promises (see
 * ElVuelto.tsx's note). Word pools are 6/6/5 per level, so every round is a
 * genuinely random, non-repeating subset — no extra content needed.
 */

interface AnagramEntry {
  source: string
  answer: string
  /** Illustration id (L1) or a short descriptive text (L2/L3) — which one
   * applies is decided per-level by `clueType`, not per-entry. */
  clue: string
}
interface AnagramLevel {
  n: number
  name: string
  clueType: 'image' | 'text'
  entries: AnagramEntry[]
}

const LEVELS: AnagramLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    clueType: 'image',
    entries: [
      { source: 'GOTA', answer: 'GATO', clue: 'gato' },
      { source: 'MALLA', answer: 'LLAMA', clue: 'llama' },
      { source: 'CAVA', answer: 'VACA', clue: 'vaca' },
      { source: 'TEMA', answer: 'MATE', clue: 'mate' },
      { source: 'RASO', answer: 'ROSA', clue: 'rosa' },
      { source: 'PARE', answer: 'PERA', clue: 'pera' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    clueType: 'text',
    entries: [
      { source: 'CALVO', answer: 'CLAVO', clue: 'Una herramienta que se clava con el martillo' },
      { source: 'ANDAR', answer: 'NADAR', clue: 'Algo que hacés en el agua' },
      { source: 'ATAR', answer: 'RATA', clue: 'Un animal' },
      { source: 'AMOR', answer: 'RAMO', clue: 'Un montón de flores juntas' },
      { source: 'SOPA', answer: 'PASO', clue: 'Cuando caminás, das uno' },
      { source: 'LUNA', answer: 'NULA', clue: 'Que no vale, que quedó sin efecto' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    clueType: 'text',
    entries: [
      { source: 'SENTIDO', answer: 'DESTINO', clue: 'A dónde llegás cuando viajás' },
      { source: 'MARINA', answer: 'ANIMAR', clue: 'Darle ánimo a alguien' },
      { source: 'CARBON', answer: 'BRONCA', clue: 'Enojo, fastidio' },
      { source: 'CANTOR', answer: 'CONTRA', clue: 'Lo opuesto a estar a favor' },
      { source: 'CORTINAS', answer: 'CRONISTA', clue: 'El que cuenta las noticias' },
    ],
  },
]

// Rounds resolved per level before the level is complete — same shape and
// tuning rationale as ElVuelto/ContadorMasMenos: 8 total (2+3+3),
// comfortably within each level's own pool (6/6/5) so every round is a
// genuinely random, non-repeating subset.
const ROUNDS_PER_LEVEL = [2, 3, 3]
// Every round resolves via a genuine correct "Revisar" (no give-up path),
// so totalAttempts = mistakes + this.
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

// L1 illustrations live across a few sibling game folders, not a folder of
// their own — same multi-folder import.meta.glob pattern as
// ContadorMasMenos.tsx. All copies of a given id are byte-identical
// (verified via checksum), so which folder each id comes from is arbitrary;
// picked mainly to keep the glob list short and avoid id collisions.
const IMAGES = import.meta.glob(
  [
    '../../../assets/desafio/games/animal-por-letra/*.webp',
    '../../../assets/desafio/games/que-sera/*.webp',
    '../../../assets/desafio/games/buscar-rojos/*.webp',
  ],
  { eager: true, import: 'default' },
) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

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

const PRAISE_GOOD = ['¡Muy bien armada!', '¡Excelente, esa es la palabra!', '¡Así se hace!', '¡Perfecto!']
// Muted slate, never red/orange — a wrong attempt is always retryable, never
// a hard fail. Same hint-and-retry tone as ElVuelto/ContadorMasMenos.
const NUDGE_MESSAGES = [
  'Todavía no. Mirá la pista de nuevo y probá otro orden.',
  'Casi. Fijate bien en las letras y volvé a intentar.',
  'Esa palabra no es. Tocá una letra para sacarla y acomodala de nuevo.',
]

export function QuePalabraSeEsconde({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  // `roundsForLevel` distinct entries picked at random from the level's own
  // pool, recalculated once per level/roundKey — never repeats within a level.
  const roundEntries = useMemo(
    () => shuffle(level.entries).slice(0, roundsForLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const entry = roundEntries[roundIdx]
  const answerLetters = useMemo(() => entry.answer.split(''), [entry])

  const { bank, placed, place, unplace } = useSequencingPuzzle(
    answerLetters,
    `${levelIdx}-${roundKey}-${roundIdx}`,
  )
  const readyToCheck = bank.length === 0

  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Wrong-"Revisar" count, accumulated across levels 1→2→3 and only zeroed
  // on a true day restart (see nextLevel's wrap branch) — same policy as
  // ElVuelto/ContadorMasMenos. No separate attempts counter: totalAttempts
  // is derived as mistakes + TOTAL_ROUNDS when reporting (see the effect
  // below), since every round is guaranteed to resolve correctly eventually.
  const [mistakes, setMistakes] = useState(0)

  // True once the LAST round of the level has been resolved correctly —
  // gates the level-complete buttons (nextLevel/replay) instead of the
  // plain "next word" button. Derived from `resolved` + `roundIdx`, both
  // real state reset synchronously below — never from a value reset inside
  // a useEffect (see nextLevel()'s comment for why that matters).
  const done = resolved && roundIdx >= roundsForLevel - 1

  function handlePlace(item: SequencingItem<string>) {
    setHint(null)
    place(item)
  }
  function handleUnplace(item: SequencingItem<string>) {
    setHint(null)
    unplace(item)
  }

  function check() {
    if (!readyToCheck) return
    // See the file header comment: deliberately compares the spelled
    // STRING to the answer, not the hook's own id-based `isCorrect` — a
    // repeated letter in the answer means two tiles can share a value but
    // not an id, and the player can't visually tell them apart.
    const spelled = placed.map((item) => item.value).join('')
    if (spelled === entry.answer) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE_MESSAGES))
      setMistakes((m) => m + 1)
      // The tiles deliberately STAY where they were put. Sweeping them all
      // back would mean one wrong letter in CRONISTA costs you the other
      // seven, which punishes without teaching anything — the player can see
      // their own attempt, spot the letter that looks off, and tap just that
      // one back. Same "a wrong check nudges, it never undoes your work"
      // contract as ElVuelto's bill tray.
    }
  }

  // Advance to the next round within the level. Only reachable while
  // `!done` — the button that calls this doesn't render once the level is
  // complete.
  function nextRound() {
    setResolved(false)
    setHint(null)
    setRoundIdx((i) => i + 1)
  }
  // Resets happen HERE, synchronously with the level/round change — never
  // in a separate useEffect keyed on [levelIdx, roundKey]. An effect only
  // catches up on the render AFTER levelIdx changes, so the onComplete
  // effect below (watching `done`) would still see the previous level's
  // stale `true` on the very render that just arrived at the new level —
  // firing onComplete instantly, before the player has done anything on the
  // new level. Setting `resolved`/`roundIdx` in the same handler that sets
  // `levelIdx`/`roundKey` means React batches them into one render, so
  // they're never observably out of sync (same discipline as ElVuelto.tsx).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setResolved(false)
    setHint(null)
    setRoundIdx(0)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra palabra" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setResolved(false)
    setHint(null)
    setRoundIdx(0)
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey when level 3's last word resolves. A full day
  // restart (the wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire
  // twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const clueImg = level.clueType === 'image' ? imgFor(entry.clue) : undefined

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          Lenguaje · {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué palabra se esconde?</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá las letras en el orden correcto para armar la otra palabra.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {roundsForLevel}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Clue card: source word + image (L1) or text (L2/L3) clue.
              Hidden once resolved — the clue is moot once the word's found. */}
          {!resolved && (
            <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
              <p className="text-center text-sm font-semibold text-slate-500">Con las letras de</p>
              <p className="mt-1 text-center text-3xl font-extrabold tracking-widest text-slate-800">
                {entry.source}
              </p>
              {level.clueType === 'image' ? (
                <div className="mt-3 flex items-center justify-center">
                  {clueImg && (
                    <img src={clueImg} alt="" className="h-28 w-28 object-contain" draggable={false} />
                  )}
                </div>
              ) : (
                <p className="mt-3 text-center text-base text-slate-700">
                  <span className="font-semibold text-slate-500">Pista:</span> {entry.clue}
                </p>
              )}
            </div>
          )}

          {/* Word being built — stays visible (now green) through a
              resolved-but-not-done round, same as OrdenarLaFrase's sentence
              box; disappears only once the whole level is done. */}
          <div className="mt-6 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {placed.length === 0 && (
              <span className="text-sm text-slate-400">Tocá las letras de abajo para empezar</span>
            )}
            {placed.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={resolved}
                onClick={() => handleUnplace(item)}
                aria-label={`Quitar letra ${item.value}`}
                className={[
                  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 px-2 text-xl font-extrabold uppercase transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  resolved
                    ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                    : 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10',
                ].join(' ')}
              >
                {item.value}
              </button>
            ))}
          </div>

          {/* Letter pool */}
          {!resolved && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlace(item)}
                  aria-label={`Letra ${item.value}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-2 text-xl font-extrabold uppercase text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {/* Check button */}
          {readyToCheck && !resolved && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}

          {/* Wrong-attempt nudge — muted slate, never red/orange, always
              retryable. */}
          {hint && !resolved && (
            <p className="mt-3 text-center text-sm font-medium text-slate-500">{hint}</p>
          )}
        </>
      )}

      {/* Result */}
      {resolved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Formaste <span className="font-semibold text-slate-800">{entry.answer}</span> con las letras de{' '}
            {entry.source}.
          </p>
          {done && <p className="mt-1 text-slate-600">Completaste el nivel {levelIdx + 1}.</p>}
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {done ? (
              <>
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
                  Otra palabra
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente palabra
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
