import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Anagramas por categoría" — día 13, área lenguaje. Adapted from a paper
 * exercise where a category heading ("NOMBRES DE ANIMALES", "COLORES"...)
 * primes a set of scrambled words that all belong to it, and the patient
 * unscrambles the whole set before moving to the next category.
 *
 * This is the THIRD anagram game in the catalog — deliberately differentiated
 * from the other two, not a reskin of either:
 *   - QuePalabraSeEsconde.tsx: ONE word per round, disambiguated by a PHOTO
 *     clue, built from a tile bank that mixes the answer's own letters with
 *     decoy letters (so "gather every tile" isn't enough on its own).
 *   - LetrasRevueltas.tsx: ONE word per round, evoked from a RIDDLE clue,
 *     spelled via useSequencingPuzzle's tap-to-order engine.
 *   - THIS game: no clue at all — the category heading is the only prime —
 *     and THREE words are live at once, listed together under that heading.
 *     The task isn't "find this one word", it's "work a themed set": pick
 *     which scrambled word to tackle, solve it, watch it lock in as real
 *     spelling next to its still-scrambled siblings, then move to the next.
 *     That's the mechanic the spec asked for, and it's what neither existing
 *     anagram game exercises.
 *
 * Hand-rolled tap state, NOT useSequencingPuzzle — two independent reasons:
 *   1. useSequencingPuzzle tracks correctness by a tile's ORIGINAL INDEX
 *      (`item.id === i`), not by letter value. That's exactly right for a
 *      pool with no repeated letters (LetrasRevueltas' own file header
 *      explains why its word pairs were hand-picked to avoid repeats, for
 *      this same reason). A category word pool can't make that promise —
 *      BANANA, ELEFANTE, MANZANA, GUANABANA etc. all repeat a letter, and a
 *      real category vocabulary means accepting that. So correctness here
 *      is checked the same way QuePalabraSeEsconde checks it: comparing the
 *      SPELLED STRING to the answer, never tile identity — the "other"
 *      instance of a repeated letter is just as correct in that slot.
 *   2. The hook manages ONE sequence per call and resets itself whole on a
 *      roundKey change. This game needs THREE independent puzzles alive at
 *      once (one per word), each individually solved and individually
 *      "locked" without disturbing the other two, plus a shared "which one
 *      is focused right now" pointer — a shape the hook isn't built for.
 *
 * Category + word selection is an "epoch" decided once at mount (same
 * pattern as QuePalabraSeEsconde's epochEntries / LetrasRevueltas'
 * epochOrder): per level, 2 DISTINCT categories are drawn from the pool of
 * six, and each round draws 3 distinct words from that category's own
 * per-level band. Every (category, level) pool keeps at least 6 candidates
 * on purpose — insurance in case a level's two rounds ever land on the same
 * category, and what gives "Repetir" (which reuses the same epoch, see
 * below) room to feel different across levels even though categories can
 * repeat across them. "Repetir" — only reachable after level 3 — replays
 * the SAME epoch (same categories/words) but bumps `roundKey`, which forces
 * `tilesByWord` to re-scramble: same words, fresh scrambles, same contract
 * as the other two anagram games.
 *
 * Difficulty ramps by word length, not round count: L1 draws from each
 * category's 4-5 letter band, L2 from 6-7, L3 from 8+. Rounds per level are
 * fixed at 2 (spec), so TOTAL_WORDS = 2 rounds x 3 levels x 3 words = 18;
 * every word is guaranteed to resolve correctly eventually (no fail/skip
 * path), so totalAttempts = mistakes + TOTAL_WORDS — same formula and same
 * reasoning as QuePalabraSeEsconde.
 *
 * Spelling is uppercase with NO accents and no Ñ anywhere in the pools —
 * same convention QuePalabraSeEsconde/LetrasRevueltas already use (see
 * their CARBON/CRANEO, deaccented from carbón/cráneo): it keeps letter
 * tiles a plain, unambiguous A-Z alphabet with no accent-matching edge case
 * to get wrong.
 *
 * A solved word stays visible in its real spelling, ticked, next to its
 * still-scrambled siblings — the category heading and the three-word list
 * never leave the screen while the round plays, per spec. That means the
 * round-complete card is APPENDED below the (now fully ticked) list rather
 * than swapping it out for a separate result screen the way the other two
 * anagram games do — a deliberate deviation from their pattern, made to
 * satisfy "the category stays on screen the whole time."
 *
 * No timers anywhere, including no auto-advance once a round completes —
 * same call QuePalabraSeEsconde/LetrasRevueltas make and for the same
 * reason: there's a three-word recap to read, and a clock would rush it.
 * The only thing that happens automatically is the FOCUS shift from a
 * just-solved word to the next unsolved one, and that's a synchronous
 * state update, not a timer.
 *
 * Reset on round/level/epoch transitions happens synchronously inside
 * nextRound/advanceLevel/restartEpoch, never in a useEffect keyed on
 * levelIdx — an effect would lag one render, so `allSolved`/`done` (derived
 * straight from `placedByWord`) would still read the previous round's
 * stale-true value on the render that lands on the new one, firing
 * onComplete early. Same discipline as every other game in this catalog.
 */

type CategoryId = 'animales' | 'frutas' | 'colores' | 'ropa' | 'cocina' | 'oficios'

interface CategoryDef {
  heading: string
  /** [L1 pool (4-5 letters), L2 pool (6-7), L3 pool (8+)] — every band keeps
   * at least 6 candidates so a level never has to reuse a word within an
   * epoch, even if both of its rounds happen to draw the same category. */
  wordsByLevel: [string[], string[], string[]]
}

const CATEGORIES: Record<CategoryId, CategoryDef> = {
  animales: {
    heading: 'NOMBRES DE ANIMALES',
    wordsByLevel: [
      ['GATO', 'PERRO', 'LORO', 'VACA', 'CABRA', 'PATO', 'TIGRE', 'MONO'],
      ['CONEJO', 'CABALLO', 'JIRAFA', 'VENADO', 'CAMELLO', 'GORILA', 'TORTUGA', 'CANGURO'],
      ['ELEFANTE', 'COCODRILO', 'MURCIELAGO', 'RINOCERONTE', 'HIPOPOTAMO', 'MARIPOSA', 'ARMADILLO', 'SALAMANDRA'],
    ],
  },
  frutas: {
    heading: 'NOMBRES DE FRUTAS',
    wordsByLevel: [
      ['PERA', 'MELON', 'LIMON', 'MANGO', 'COCO', 'KIWI', 'DATIL', 'ANANA'],
      [
        'NARANJA', 'CEREZA', 'SANDIA', 'DURAZNO', 'BANANA', 'CIRUELA',
        'GRANADA', 'MANZANA', 'TORONJA', 'POMELO', 'DAMASCO', 'PAPAYA',
      ],
      ['FRUTILLA', 'MEMBRILLO', 'MANDARINA', 'ARANDANO', 'MARACUYA', 'GUANABANA'],
    ],
  },
  colores: {
    heading: 'COLORES',
    wordsByLevel: [
      ['ROJO', 'AZUL', 'VERDE', 'NEGRO', 'GRIS', 'ROSA', 'LILA', 'BEIGE', 'BORDO', 'OCRE'],
      ['BLANCO', 'MARRON', 'VIOLETA', 'CELESTE', 'DORADO', 'MORADO', 'PURPURA'],
      ['AMARILLO', 'ANARANJADO', 'TURQUESA', 'PLATEADO', 'GRISACEO', 'VIOLACEO'],
    ],
  },
  ropa: {
    heading: 'PRENDAS DE ROPA',
    wordsByLevel: [
      ['SACO', 'GORRA', 'BOTAS', 'FALDA', 'BUZO', 'TRAJE', 'CALZA'],
      ['GUANTE', 'REMERA', 'ZAPATO', 'VESTIDO', 'CAMPERA', 'POLLERA', 'CHALECO', 'BUFANDA', 'PIJAMA'],
      ['CINTURON', 'ZAPATILLA', 'PANTALON', 'CAMISETA', 'SOMBRERO', 'MOCASINES'],
    ],
  },
  cocina: {
    heading: 'COSAS DE LA COCINA',
    wordsByLevel: [
      ['OLLA', 'TAZA', 'PLATO', 'VASO', 'JARRA', 'MOLDE', 'TABLA', 'PAVA'],
      ['CUCHARA', 'SARTEN', 'TENEDOR', 'FUENTE', 'BATIDOR', 'COLADOR', 'MORTERO', 'ASADERA'],
      ['CUCHILLO', 'ESPATULA', 'RALLADOR', 'HELADERA', 'LICUADORA', 'TOSTADORA', 'CAFETERA'],
    ],
  },
  oficios: {
    heading: 'NOMBRES DE OFICIOS',
    wordsByLevel: [
      ['JUEZ', 'PEON', 'ACTOR', 'MOZO', 'GUIA', 'CURA', 'MONJA'],
      ['PINTOR', 'PILOTO', 'MEDICO', 'MAESTRO', 'PLOMERO', 'PORTERO', 'CARTERO', 'BOMBERO', 'ABOGADO'],
      ['CANTANTE', 'ESCRITOR', 'PANADERO', 'COCINERO', 'PELUQUERO', 'CARPINTERO', 'ENFERMERO'],
    ],
  },
}
const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[]

interface Level {
  n: number
  name: string
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1' },
  { n: 2, name: 'Nivel 2' },
  { n: 3, name: 'Nivel 3' },
]
// 2 rounds per level (spec), 3 words per round.
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
const WORDS_PER_ROUND = 3
// Every word is guaranteed to resolve correctly eventually (no fail/skip
// path), so totalAttempts = mistakes + TOTAL_WORDS when reporting.
const TOTAL_WORDS = TOTAL_ROUNDS * WORDS_PER_ROUND

interface RoundPlan {
  categoryId: CategoryId
  words: string[]
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

// 2 distinct categories per level, each contributing one round. Distinct on
// purpose: it's more varied for the player, and it means the >=6-word pool
// per (category, level) is pure insurance rather than something every round
// leans on.
function buildLevelPlan(levelIdx: number, roundsForLevel: number): RoundPlan[] {
  const categoryIds = shuffle(CATEGORY_IDS).slice(0, roundsForLevel)
  return categoryIds.map((categoryId) => {
    const pool = CATEGORIES[categoryId].wordsByLevel[levelIdx]
    const words = shuffle(pool).slice(0, WORDS_PER_ROUND)
    return { categoryId, words }
  })
}

interface Tile {
  id: number
  value: string
}

// Shuffles a word's letters, guaranteeing the scramble is never the word
// itself. The retry loop succeeds almost immediately for real multi-letter
// words; the rotate-by-one fallback makes the guarantee absolute (a single
// rotation only reproduces the original when every letter is identical,
// which never happens in these pools).
function scrambleToTiles(word: string): Tile[] {
  const letters = word.split('')
  let attempt = shuffle(letters)
  let guard = 0
  while (attempt.join('') === word && guard < 20) {
    attempt = shuffle(letters)
    guard++
  }
  if (attempt.join('') === word) {
    attempt = [...letters.slice(1), letters[0]]
  }
  return attempt.map((value, id) => ({ id, value }))
}

const PRAISE_GOOD = ['¡Las tres armadas!', '¡Muy bien, categoría completa!', '¡Excelente trabajo!', '¡Así se hace!']
// Muted slate, never red/orange — a wrong attempt is always retryable, never
// a hard fail.
const NUDGE_MESSAGES = [
  'Todavía no. Fijate bien en las letras y probá de nuevo.',
  'Casi. Mirá el orden y volvé a intentar.',
  'Esa combinación no es. Tocá una letra para sacarla y probar otra.',
]

export function AnagramasPorCategoria({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [roundIdx, setRoundIdx] = useState(0)

  // Categories + words for the whole day, decided once at mount and never
  // re-rolled by "Repetir" (see file header) — same epoch pattern as
  // QuePalabraSeEsconde/LetrasRevueltas.
  const [epoch] = useState<RoundPlan[][]>(() => LEVELS.map((_, i) => buildLevelPlan(i, ROUNDS_PER_LEVEL[i])))

  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const round = epoch[levelIdx][roundIdx]
  const category = CATEGORIES[round.categoryId]

  // Scrambles for the 3 words of this round — fresh on every level/round
  // change AND on "Repetir" (roundKey), even though the words themselves
  // (the epoch) stay fixed.
  const tilesByWord = useMemo(
    () => round.words.map((w) => scrambleToTiles(w)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )

  // Which tile ids are placed, per word (index 0-2), in tap order. Reset
  // SYNCHRONOUSLY in the transition handlers below, never in an effect.
  const [placedByWord, setPlacedByWord] = useState<number[][]>([[], [], []])
  const [focusedIdx, setFocusedIdx] = useState(0)
  const [wordHint, setWordHint] = useState<Record<number, string | null>>({})
  const [mistakes, setMistakes] = useState(0)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])

  const placedTiles = tilesByWord.map((tiles, i) =>
    placedByWord[i].map((id) => tiles.find((t) => t.id === id)).filter((t): t is Tile => !!t),
  )
  const bankTiles = tilesByWord.map((tiles, i) => tiles.filter((t) => !placedByWord[i].includes(t.id)))
  const spelledWords = placedTiles.map((tiles) => tiles.map((t) => t.value).join(''))
  // Correctness compares the SPELLED STRING to the answer, never tile
  // identity/position — see the file header for why (repeated letters).
  const solvedFlags = round.words.map((answer, i) => placedByWord[i].length === answer.length && spelledWords[i] === answer)
  const allSolved = solvedFlags.every(Boolean)
  const done = allSolved && roundIdx >= roundsForLevel - 1

  function focusWord(wordIdx: number) {
    if (solvedFlags[wordIdx]) return
    setFocusedIdx(wordIdx)
  }
  function placeLetter(wordIdx: number, tile: Tile) {
    if (solvedFlags[wordIdx] || placedByWord[wordIdx].length >= round.words[wordIdx].length) return
    setWordHint((h) => ({ ...h, [wordIdx]: null }))
    setPlacedByWord((prev) => prev.map((ids, i) => (i === wordIdx ? [...ids, tile.id] : ids)))
  }
  function unplaceLetter(wordIdx: number, tile: Tile) {
    if (solvedFlags[wordIdx]) return
    setWordHint((h) => ({ ...h, [wordIdx]: null }))
    setPlacedByWord((prev) => prev.map((ids, i) => (i === wordIdx ? ids.filter((id) => id !== tile.id) : ids)))
  }

  // Auto-checks each word the instant its slots fill up — no "Revisar" tap.
  // checkedRef remembers the last-checked placement per word so a stray
  // double-invoke (React 18 effect re-run) can't double-count a mistake,
  // same guard QuePalabraSeEsconde uses.
  const checkedRef = useRef<(string | null)[]>([null, null, null])
  useEffect(() => {
    round.words.forEach((answer, i) => {
      const ids = placedByWord[i]
      if (ids.length !== answer.length) {
        checkedRef.current[i] = null
        return
      }
      const key = ids.join(',')
      if (checkedRef.current[i] === key) return
      checkedRef.current[i] = key
      if (solvedFlags[i]) {
        // Correct: if this word had focus, hand focus to the next unsolved
        // one so the player never has to tap a ticked word to move on.
        setFocusedIdx((cur) => {
          if (cur !== i) return cur
          const next = solvedFlags.findIndex((solved, j) => j !== i && !solved)
          return next === -1 ? cur : next
        })
      } else {
        // Wrong: tiles deliberately STAY placed (see NUDGE_MESSAGES copy) —
        // the player can see their attempt and fix just the letter that's off.
        setMistakes((m) => m + 1)
        setWordHint((h) => ({ ...h, [i]: pickOne(NUDGE_MESSAGES) }))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedByWord])

  useEffect(() => {
    if (allSolved) setPraise(pickOne(PRAISE_GOOD))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSolved])

  function nextRound() {
    setPlacedByWord([[], [], []])
    setWordHint({})
    setFocusedIdx(0)
    setRoundIdx((i) => i + 1)
  }
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPlacedByWord([[], [], []])
    setWordHint({})
    setFocusedIdx(0)
  }
  // Only reachable after level 3 — always a genuine day restart, so the
  // mistake accumulator zeroes here and nowhere else.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setPlacedByWord([[], [], []])
    setWordHint({})
    setFocusedIdx(0)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {phase === 'playing' && (
          <>
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

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que el resto del catálogo. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Sparkles className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Cada ronda te muestra una categoría y tres palabras revueltas de esa categoría. Tocá una palabra para
            elegirla y armala tocando sus letras en el orden correcto. Cuando completes las tres, pasás a la próxima
            categoría.
          </p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          {/* Category heading — stays on screen for the whole round. */}
          <div className="mt-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Categoría</p>
            <p className="mt-1 text-2xl font-black tracking-wide text-slate-900">{category.heading}</p>
          </div>

          {/* The three words of the round, listed together. */}
          <div className="mt-4 space-y-3">
            {round.words.map((answer, i) => {
              const isSolved = solvedFlags[i]
              const isFocused = !isSolved && focusedIdx === i

              if (isSolved) {
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl border border-tiam-green/25 bg-tiam-green/5 px-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <span className="text-xl font-extrabold tracking-widest text-slate-900">{answer}</span>
                  </div>
                )
              }

              if (!isFocused) {
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => focusWord(i)}
                    aria-label="Tocá para elegir esta palabra"
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left transition hover:border-tiam-blue/40 hover:shadow-md"
                  >
                    <span className="text-xl font-extrabold tracking-widest text-slate-500">
                      {tilesByWord[i].map((t) => t.value).join('')}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-tiam-blue">Tocá para armar</span>
                  </button>
                )
              }

              // Focused and not yet solved: full slot + letter-bank UI.
              return (
                <div key={i} className="rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 p-4">
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {answer.split('').map((_, slotIdx) => {
                      const tile = placedTiles[i][slotIdx]
                      if (!tile) {
                        return (
                          <div
                            key={slotIdx}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-dashed border-tiam-blue/30 bg-white"
                          />
                        )
                      }
                      return (
                        <button
                          key={slotIdx}
                          type="button"
                          onClick={() => unplaceLetter(i, tile)}
                          aria-label={`Quitar letra ${tile.value}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-tiam-blue bg-white text-xl font-extrabold uppercase text-slate-900 transition hover:-translate-y-0.5"
                        >
                          {tile.value}
                        </button>
                      )
                    })}
                  </div>

                  {wordHint[i] && <p className="mt-3 text-center text-sm font-medium text-slate-500">{wordHint[i]}</p>}

                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {bankTiles[i].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => placeLetter(i, t)}
                        aria-label={`Letra ${t.value}`}
                        className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-xl font-extrabold uppercase text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                      >
                        {t.value}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Round-complete card, APPENDED below the (fully ticked) word
              list rather than replacing it — see file header: the category
              and its three words stay on screen the whole time. */}
          {allSolved && (
            <div className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
                <Sparkles className="h-6 w-6 text-tiam-green" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
              <p className="mt-1 text-slate-600">Armaste las tres palabras de {category.heading.toLowerCase()}.</p>
              {done && <p className="mt-1 text-slate-600">Completaste el nivel {levelIdx + 1}.</p>}
              {!done ? (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={nextRound}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
                  >
                    Siguiente categoría
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : levelIdx < LEVELS.length - 1 ? (
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
        </>
      )}
    </div>
  )
}
