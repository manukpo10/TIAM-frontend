import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Flor de palabra" — día 1, lenguaje. A ring of 5-7 letters (a "flower")
 * around a centre hub; the player taps letters to build a word one letter at
 * a time, then taps "Listo" to check it. A correct, not-yet-found word locks
 * into the found list; the round ends once enough words are found.
 *
 * Closed answer set, not a dictionary. The paper original scores ANY word the
 * player can spell from the ring — open-ended. That needs a full Spanish
 * dictionary to validate, and a game that rejects a real word the player
 * actually found is worse than no game at all for this audience. So every
 * round instead ships a FIXED list of valid words for its letter set (see
 * LEVELS below), hand-authored so every word's letters are a subset of its
 * ring with each letter used at most once (verified with a throwaway script
 * against every set before this file was finished — see the PR). A real
 * Spanish word that simply isn't on the list gets the same gentle "not on the
 * list" hint as a nonsense string — a deliberate, disclosed limitation of the
 * closed-set design, not a bug: rejecting an off-list real word is the price
 * of never needing a dictionary this game can't honestly ship.
 *
 * Differs from the other tile word games in the catalog on the core
 * mechanic. ArmaLasPalabras/AlmacenDeSilabas hand out FIXED-length fragments
 * (3-letter chunks / syllables) that auto-check the instant the slots fill,
 * because the target word length is known in advance. Here word length
 * varies round to round AND word to word — SAL is 3 letters, SOLAR is 5,
 * from the very same ring — so there is no "slots full" moment to key an
 * auto-check off. The player decides when they're done building and taps
 * "Listo" explicitly. Each ring letter is a single physical position (not a
 * pre-chunked fragment) and greys out once used by the word being built —
 * each letter usable once per word, same rule as the paper original —
 * ungreying only when the player taps it back out of the building strip.
 *
 * Letters and words are always plain A-Z (no accents, no Ñ), same convention
 * as the rest of the catalog — deaccenting keeps the match a straight string
 * comparison and keeps every ring tile typeable on a bare keyboard.
 */

interface WordSet {
  /** Distinct ring letters — no repeats, so "each letter used at most once
   * per word" reduces to "no word may repeat a letter", checked offline. */
  letters: string[]
  /** Closed set of valid words spellable from `letters`. */
  words: string[]
}

interface Level {
  n: number
  name: string
  /** Words to find, per round, to complete it. */
  target: number
  /** Exactly 2 rounds per level (house spec) — always both played, in order,
   * no pool to draw from. That is also why the day's final replay button can
   * honestly say "Repetir" instead of "Otras letras": there is nothing else
   * to resample, the content is fixed. */
  sets: [WordSet, WordSet]
}

// Every ring is a set of DISTINCT letters (never a repeated letter), and every
// word below was checked to contain only letters present in its ring, each at
// most once — i.e. no word repeats a letter internally either. L1 = 5
// letters/find 3, L2 = 6/find 4, L3 = 7/find 5, all comfortably under each
// set's real word count so the target always leaves slack.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    target: 3,
    sets: [
      {
        letters: ['S', 'A', 'L', 'O', 'R'],
        words: ['SAL', 'SOL', 'ROL', 'OSA', 'ARO', 'ROSA', 'ORAL', 'SOLAR'],
      },
      {
        letters: ['M', 'E', 'S', 'A', 'R'],
        words: ['MESA', 'MAR', 'SER', 'ERA', 'ERAS', 'MARES', 'SEA'],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    target: 4,
    sets: [
      {
        letters: ['C', 'A', 'M', 'I', 'N', 'O'],
        words: ['CAMINO', 'CAMION', 'MANO', 'MINA', 'CANO', 'ANIMO', 'MICA'],
      },
      {
        letters: ['T', 'A', 'R', 'D', 'E', 'S'],
        words: ['TARDE', 'ARTE', 'SEDA', 'DARSE', 'DARTE', 'TRAES', 'TARDES'],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    target: 5,
    sets: [
      {
        letters: ['C', 'A', 'D', 'E', 'R', 'N', 'O'],
        words: ['CARNE', 'CERDO', 'CENA', 'DOCENA', 'RONDA', 'CENAR', 'CANDOR', 'RONCA'],
      },
      {
        letters: ['P', 'E', 'S', 'C', 'A', 'D', 'O'],
        words: ['PESCADO', 'PESCA', 'PESO', 'SAPO', 'COPA', 'PASEO', 'CAPO', 'SECO'],
      },
    ],
  },
]
// Every round always resolves (the player must find exactly `target` words to
// clear it, never more, never fewer), so — same fixed-sum reasoning as
// ArmaLasPalabras' TOTAL_WORDS — the success total is this constant, not a
// runtime counter: 2 rounds per level × each level's target.
const TOTAL_WORDS = LEVELS.reduce((sum, l) => sum + l.target * l.sets.length, 0)

// Distance (px) from the ring's centre to each letter tile's centre. Chosen
// against the SMALLEST container size below (h-64/w-64 = 256px, 128px
// half-width): 92 + a 24px tile half-width = 116px, safely inside 128px even
// at 7 letters, the densest ring this game ever draws.
const RING_RADIUS = 92

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

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa combinación no está en la lista. Fijate bien las letras y probá otra vez.',
  'Todavía no. Probá formar otra palabra con esas mismas letras.',
  'Esa no es ninguna de las palabras escondidas. Animate a probar otra combinación.',
]
const NUDGES_REPEAT = [
  'Esa palabra ya la encontraste. Fijate qué otra podés armar.',
  'Ya la tenés en tu lista — probá con una combinación distinta.',
]

export function FlorDePalabra({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [setIdx, setSetIdx] = useState<0 | 1>(0)
  // Epoch counter (house pattern). Unlike ArmaLasPalabras' epochChoices —
  // which randomly draws ONE word-set per level from a pool — there is no
  // pool here to draw from; letters and words are fixed per level+round. So
  // roundKey doesn't pick content, it only (a) reshuffles the ring's ON-SCREEN
  // letter order for visual freshness on "Repetir", and (b) gates the
  // onComplete guard below so a genuine day restart can report again.
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const wordSet = level.sets[setIdx]

  // Index permutation, not the letters themselves — keeps `building` (which
  // stores indices into wordSet.letters) simple and stable while the ring's
  // visual arrangement varies per attempt.
  const ringOrder = useMemo(
    () => shuffle(wordSet.letters.map((_, i) => i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, setIdx, roundKey],
  )

  const [building, setBuilding] = useState<number[]>([]) // indices into wordSet.letters, tap order
  const [found, setFound] = useState<string[]>([]) // words found this round
  const [hint, setHint] = useState<string | null>(null)
  const [correctWord, setCorrectWord] = useState<string | null>(null) // brief "¡Correcto!" pause before it locks in
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across the whole day, zeroed only on the genuine day restart
  // (replayDay) — never on a mid-day round/level advance.
  const [mistakes, setMistakes] = useState(0)

  const consumed = new Set(building) // letters already used by the word being built — cheap, no memo needed
  const roundDone = found.length >= level.target
  const isLastRound = setIdx === 1
  const isLastLevel = levelIdx === LEVELS.length - 1
  const dayDone = roundDone && isLastRound && isLastLevel

  useEffect(() => {
    if (roundDone) setPraise(pickOne(PRAISE))
  }, [roundDone])

  // Commits a correct word after a short, house-capped pause so the player
  // sees the confirmation before the strip clears. Cancelled on unmount/rapid
  // state change like the tile-game siblings' correct-answer timers.
  useEffect(() => {
    if (!correctWord) return
    const timer = setTimeout(() => {
      setFound((prev) => (prev.includes(correctWord) ? prev : [...prev, correctWord]))
      setBuilding([])
      setCorrectWord(null)
    }, 800)
    return () => clearTimeout(timer)
  }, [correctWord])

  function tapLetter(i: number) {
    if (correctWord || consumed.has(i)) return
    setHint(null)
    setBuilding((prev) => (prev.includes(i) ? prev : [...prev, i]))
  }
  function untapLetter(i: number) {
    if (correctWord) return
    setBuilding((prev) => prev.filter((x) => x !== i))
  }
  function submit() {
    if (building.length === 0 || correctWord) return
    const attempt = building.map((i) => wordSet.letters[i]).join('')
    if (found.includes(attempt)) {
      setHint(pickOne(NUDGES_REPEAT))
      setBuilding([])
      return
    }
    if (wordSet.words.includes(attempt)) {
      setHint(null)
      setCorrectWord(attempt)
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    setBuilding([])
  }

  // Resets happen HERE, synchronously with the transition, never in an effect
  // keyed on levelIdx/setIdx — an effect lags one render behind, so
  // `roundDone` (derived straight from `found`) would read the previous
  // round's stale-true value on the very render that arrives at the new round
  // and fire onComplete with garbage. Same reasoning as SumaHastaDiez.tsx and
  // ArmaLasPalabras.tsx.
  function nextRound() {
    setSetIdx(1)
    setBuilding([])
    setFound([])
    setHint(null)
    setCorrectWord(null)
  }
  function nextLevel() {
    setLevelIdx((i) => i + 1)
    setSetIdx(0)
    setRoundKey((k) => k + 1)
    setBuilding([])
    setFound([])
    setHint(null)
    setCorrectWord(null)
  }
  function replayDay() {
    setLevelIdx(0)
    setSetIdx(0)
    setRoundKey((k) => k + 1)
    setBuilding([])
    setFound([])
    setHint(null)
    setCorrectWord(null)
    setMistakes(0) // only zeroed here — the genuine day restart
  }

  // Fires once per roundKey when the last round of the last level finishes. A
  // genuine day restart (replayDay) bumps roundKey, so it can report again;
  // re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (dayDone && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayDone, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!roundDone && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Tocá las letras de la flor para formar una palabra
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Ronda {setIdx + 1} de 2 · Llevás {found.length} de {level.target}
            </p>
          </>
        )}
      </div>

      {!roundDone && (
        <>
          {/* Palabras encontradas */}
          {found.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {found.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 rounded-full border border-tiam-green/30 bg-tiam-green/10 px-3 py-1 text-sm font-bold tracking-wide text-slate-800"
                >
                  <Check className="h-3.5 w-3.5 text-tiam-green" strokeWidth={3} />
                  {w}
                </span>
              ))}
            </div>
          )}

          {/* La flor */}
          <div className="relative mx-auto mt-5 h-64 w-64 sm:h-72 sm:w-72">
            <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-tiam-blue/10">
              <span className="text-lg font-extrabold text-tiam-blue">
                {found.length}/{level.target}
              </span>
            </div>
            {ringOrder.map((letterIdx, pos) => {
              const angle = -Math.PI / 2 + pos * ((2 * Math.PI) / ringOrder.length)
              const dx = Math.round(Math.cos(angle) * RING_RADIUS)
              const dy = Math.round(Math.sin(angle) * RING_RADIUS)
              const used = consumed.has(letterIdx)
              return (
                <button
                  key={letterIdx}
                  type="button"
                  disabled={used || !!correctWord}
                  onClick={() => tapLetter(letterIdx)}
                  aria-label={`Letra ${wordSet.letters[letterIdx]}`}
                  // Position is inline (computed from angle/radius) rather
                  // than a Tailwind class, so hover/active states below
                  // deliberately avoid any transform utility (translate/
                  // scale) — an inline `transform` always wins over a class
                  // one, so a Tailwind transform utility here would just be
                  // silently dead code.
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px)`,
                  }}
                  className={[
                    'absolute flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl font-extrabold transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1 disabled:cursor-default',
                    used
                      ? 'border-slate-100 bg-slate-50 text-slate-300'
                      : 'border-tiam-blue/30 bg-white text-slate-800 hover:border-tiam-blue/60 hover:shadow-md',
                  ].join(' ')}
                >
                  {wordSet.letters[letterIdx]}
                </button>
              )
            })}
          </div>

          {correctWord ? (
            <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-tiam-green/20 bg-tiam-green/5 p-5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-tiam-green/15">
                <Check className="h-5 w-5 text-tiam-green" strokeWidth={3} />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">¡Correcto!</p>
              <p className="mt-1 text-slate-600">Formaste {correctWord}.</p>
            </div>
          ) : (
            <>
              {/* Tira de armado */}
              <div className="mx-auto mt-5 flex min-h-[56px] max-w-xs flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                {building.length === 0 && (
                  <span className="text-base text-slate-400">Las letras que toques van a aparecer acá</span>
                )}
                {building.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => untapLetter(i)}
                    aria-label={`Quitar letra ${wordSet.letters[i]}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-3 text-xl font-extrabold text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                  >
                    {wordSet.letters[i]}
                  </button>
                ))}
              </div>

              {hint && <p className="mt-3 text-center text-base font-medium text-slate-500">{hint}</p>}

              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={submit}
                  disabled={building.length === 0}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-8 font-semibold text-white transition hover:bg-tiam-blue-dark disabled:cursor-default disabled:opacity-40"
                >
                  Listo
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Ronda / nivel / día completo */}
      {roundDone && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste las {level.target} palabras: {found.join(', ')}.
            {isLastRound && isLastLevel && ' ¡Completaste los 3 niveles de hoy!'}
            {isLastRound && !isLastLevel && ` ¡Completaste el ${level.name.toLowerCase()}!`}
            {!isLastRound && ' Vas por la mitad — seguí con la segunda ronda.'}
          </p>
          <div className="mt-5 flex justify-center">
            {!isLastRound && (
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente ronda
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {isLastRound && !isLastLevel && (
              <button
                type="button"
                onClick={nextLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {isLastRound && isLastLevel && (
              <button
                type="button"
                onClick={replayDay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
