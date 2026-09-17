import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Flor de palabra" — día 1, lenguaje. A ring of 5-7 letters (a "flower")
 * around a centre hub, and a clue with one empty box per letter of the word
 * it describes. Tapping ring letters fills the boxes; once they're full,
 * "Listo" checks the word. A level ends once every clued word is found.
 *
 * CLUES, NOT AN OPEN SEARCH. The paper original asks for any word you can
 * spell from the ring, and the first version of this game did the same over
 * a closed answer list, with no sign of which words were on it or how long
 * they were. That proved too hard: after the one or two obvious words there
 * was nothing to go on, and a real word missing from the list (MES, CIMA) was
 * rejected like a made-up one. Now every word of the round comes with a short,
 * concrete clue, and its boxes show the length. One clue shows at a time and
 * "Otra pista" moves on to the next unfound one. Any unfound word of the round
 * is accepted whichever clue is showing: SAL and SOL, or CAMION and CAMINO,
 * fit the same boxes, so forming the other one still counts ("¡También
 * vale!") instead of reading as a mistake.
 *
 * Each ring letter is a single physical position and greys out once used in
 * the boxes — each letter usable once per word, same rule as the paper
 * original. "Borrar" takes back the last letter. Checking waits for "Listo"
 * instead of firing the moment the boxes fill, so a mis-tapped last letter
 * can be fixed before it counts as a mistake.
 *
 * Letters and words are always plain A-Z (no accents, no Ñ), same convention
 * as the rest of the catalog — deaccenting keeps the match a straight string
 * comparison (CAMION, not CAMIÓN).
 */

interface ClueWord {
  word: string
  /** Short and concrete — it must point to this word and no other of its round. */
  clue: string
}

interface WordSet {
  /** Distinct ring letters — no repeats, so "each letter used at most once
   * per word" reduces to "no word may repeat a letter", checked offline. */
  letters: string[]
  /** Every word the round asks for, in the order their clues come up
   * (shortest first). */
  words: ClueWord[]
}

interface Level {
  n: number
  name: string
  /** One round per level, two authored word sets. The day's first play uses
   * sets[0] at every level and each "Repetir" restart switches to the
   * other set, so a replay never asks for the words just found. Both sets of
   * a level ask for the same number of words, so the star maths doesn't
   * depend on which one was played. */
  sets: [WordSet, WordSet]
}

// L1 = 5 letters / 3 words, L2 = 6 / 4, L3 = 7 / 5. Every word uses only
// letters of its ring, each at most once (checked with a script).
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    sets: [
      {
        letters: ['S', 'A', 'L', 'O', 'R'],
        words: [
          { word: 'SAL', clue: 'Se le pone a la comida para darle gusto' },
          { word: 'SOL', clue: 'Nos da luz y calor durante el día' },
          { word: 'ROSA', clue: 'Flor que tiene espinas' },
        ],
      },
      {
        letters: ['M', 'E', 'S', 'A', 'R'],
        words: [
          { word: 'MAR', clue: 'Agua salada, con olas y playa' },
          { word: 'MES', clue: 'El año tiene doce' },
          { word: 'MESA', clue: 'Mueble donde nos sentamos a comer' },
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    sets: [
      {
        letters: ['C', 'A', 'M', 'I', 'N', 'O'],
        words: [
          { word: 'MANO', clue: 'Tiene cinco dedos' },
          { word: 'CIMA', clue: 'La parte más alta de una montaña' },
          { word: 'CAMION', clue: 'Vehículo grande que lleva mercadería' },
          { word: 'CAMINO', clue: 'Por donde vamos de un lugar a otro' },
        ],
      },
      {
        letters: ['T', 'A', 'R', 'D', 'E', 'S'],
        words: [
          { word: 'SED', clue: 'Lo que sentimos cuando necesitamos tomar agua' },
          { word: 'TRES', clue: 'El número que sigue al dos' },
          { word: 'SEDA', clue: 'Tela muy suave y brillante' },
          { word: 'TARDE', clue: 'Parte del día que sigue al mediodía' },
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    sets: [
      {
        letters: ['C', 'A', 'D', 'E', 'R', 'N', 'O'],
        words: [
          { word: 'CENA', clue: 'La comida de la noche' },
          { word: 'CARNE', clue: 'Con ella se hace la milanesa' },
          { word: 'CERDO', clue: 'Animal de granja al que también le decimos chancho' },
          { word: 'RONDA', clue: 'Juego de chicos que giran tomados de la mano' },
          { word: 'DOCENA', clue: 'Doce huevos forman una' },
        ],
      },
      {
        letters: ['P', 'E', 'S', 'C', 'A', 'D', 'O'],
        words: [
          { word: 'PESO', clue: 'La moneda de la Argentina' },
          { word: 'SAPO', clue: 'Animal parecido a la rana' },
          { word: 'COPA', clue: 'Vaso con pie para brindar' },
          { word: 'PASEO', clue: 'Salida para caminar y distraerse' },
          { word: 'PESCADO', clue: 'La merluza es uno' },
        ],
      },
    ],
  },
]
// Every level always resolves (the player must find every clued word to clear
// it), so — same fixed-sum reasoning as ArmaLasPalabras' TOTAL_WORDS — the
// success total is this constant, not a runtime counter. sets[0] stands for
// both sets of its level, which always ask for the same number of words.
const TOTAL_WORDS = LEVELS.reduce((sum, l) => sum + l.sets[0].words.length, 0)

// Distance (px) from the ring's centre to each letter tile's centre. Chosen
// against the SMALLEST container size below (h-56/w-56 = 224px, 112px
// half-width): 84 + a 24px tile half-width = 108px, inside 112px even at 7
// letters, where neighbouring tiles still sit ~73px apart. The flower is that
// small on phones so the clue, the ring and the buttons fit one screen.
const RING_RADIUS = 84

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
// Kept to one line at phone width: the feedback line has a fixed height so a
// message never pushes the flower down.
const HINTS = ['No es esa. Leé la pista de nuevo.', 'Todavía no. Probá otra combinación.', 'Casi. Pensá otra vez en la pista.']
const NUDGES_REPEAT = ['Esa ya la encontraste. Probá otra.', 'Ya la tenés. Buscá otra palabra.']

export function FlorDePalabra({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  // Which of each level's two word sets this playthrough uses — bumped only
  // by the day restart, see Level.sets.
  const [playthrough, setPlaythrough] = useState(0)
  // Epoch counter (house pattern): reshuffles the ring's on-screen letter
  // order on every level change and restart, and gates the onComplete guard
  // below so a genuine day restart can report again.
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const wordSet = level.sets[playthrough % level.sets.length]
  const target = wordSet.words.length

  // Index permutation, not the letters themselves — keeps `building` (which
  // stores indices into wordSet.letters) simple and stable while the ring's
  // visual arrangement varies per attempt.
  const ringOrder = useMemo(
    () => shuffle(wordSet.letters.map((_, i) => i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, playthrough, roundKey],
  )

  const [building, setBuilding] = useState<number[]>([]) // indices into wordSet.letters, tap order
  const [found, setFound] = useState<string[]>([]) // words found this round
  // Where the clue search starts; the clue on screen is the first unfound word
  // from here on, so finding the current word moves to the next clue by itself.
  const [clueIdx, setClueIdx] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [correctWord, setCorrectWord] = useState<string | null>(null) // brief "¡Correcto!" pause before it locks in
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across the whole day, zeroed only on the genuine day restart
  // (replayDay) — never on a mid-day round/level advance.
  const [mistakes, setMistakes] = useState(0)

  const consumed = new Set(building) // letters already used by the word being built — cheap, no memo needed
  const roundDone = found.length >= target
  const isLastLevel = levelIdx === LEVELS.length - 1
  const dayDone = roundDone && isLastLevel

  let currentClue: ClueWord | null = null
  for (let k = 0; k < target; k++) {
    const candidate = wordSet.words[(clueIdx + k) % target]
    if (!found.includes(candidate.word)) {
      currentClue = candidate
      break
    }
  }
  const unfoundCount = target - found.length
  const boxesFull = currentClue !== null && building.length === currentClue.word.length
  const builtSoFar = building.map((i) => wordSet.letters[i]).join('')

  useEffect(() => {
    if (roundDone) setPraise(pickOne(PRAISE))
  }, [roundDone])

  // Commits a correct word after a short, house-capped pause so the player
  // sees the confirmation before the boxes clear. Cancelled on unmount/rapid
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
    if (correctWord || !currentClue || consumed.has(i) || building.length >= currentClue.word.length) return
    setHint(null)
    setBuilding((prev) => (prev.includes(i) ? prev : [...prev, i]))
  }
  function eraseLast() {
    if (correctWord) return
    setHint(null)
    setBuilding((prev) => prev.slice(0, -1))
  }
  function submit() {
    if (!boxesFull || correctWord) return
    if (found.includes(builtSoFar)) {
      setHint(pickOne(NUDGES_REPEAT))
      setBuilding([])
      return
    }
    if (wordSet.words.some((w) => w.word === builtSoFar)) {
      setHint(null)
      setCorrectWord(builtSoFar)
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    setBuilding([])
  }
  function nextClue() {
    if (!currentClue || correctWord) return
    setClueIdx((wordSet.words.indexOf(currentClue) + 1) % target)
    setBuilding([])
    setHint(null)
  }

  // Resets happen HERE, synchronously with the transition, never in an effect
  // keyed on levelIdx — an effect lags one render behind, so `roundDone`
  // (derived straight from `found`) would read the previous level's stale-true
  // value on the very render that arrives at the new level and fire onComplete
  // with garbage. Same reasoning as SumaHastaDiez.tsx and ArmaLasPalabras.tsx.
  function nextLevel() {
    setLevelIdx((i) => i + 1)
    setRoundKey((k) => k + 1)
    setBuilding([])
    setFound([])
    setClueIdx(0)
    setHint(null)
    setCorrectWord(null)
  }
  function replayDay() {
    setLevelIdx(0)
    setPlaythrough((p) => p + 1)
    setRoundKey((k) => k + 1)
    setBuilding([])
    setFound([])
    setClueIdx(0)
    setHint(null)
    setCorrectWord(null)
    setMistakes(0) // only zeroed here — the genuine day restart
  }

  // Fires once per roundKey when the last level finishes. A
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Formá la palabra de la pista</h2>
            <p className="mt-1 text-base font-semibold text-slate-500">
              Llevás {found.length} de {target}
            </p>
          </>
        )}
      </div>

      {!roundDone && currentClue && (
        <>
          {/* Palabras encontradas */}
          {found.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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

          {/* Pista + casilleros */}
          <div className="mx-auto mt-3 max-w-sm rounded-2xl border-2 border-tiam-blue/15 bg-tiam-blue/5 px-4 pb-2 pt-3 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-tiam-blue">Pista</p>
            <p className="mt-1 text-lg font-semibold leading-snug text-slate-800">{currentClue.clue}</p>
            <div
              className="mt-3 flex justify-center gap-1.5"
              role="img"
              aria-label={`Palabra de ${currentClue.word.length} letras${builtSoFar ? `: ${builtSoFar}` : ''}`}
            >
              {currentClue.word.split('').map((_, i) => {
                const letterIdx = building[i]
                return (
                  <span
                    key={i}
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-white text-lg font-extrabold text-slate-900',
                      letterIdx === undefined
                        ? 'border-dashed border-slate-300'
                        : correctWord
                          ? 'border-tiam-green'
                          : 'border-tiam-blue',
                    ].join(' ')}
                  >
                    {letterIdx === undefined ? '' : wordSet.letters[letterIdx]}
                  </span>
                )
              })}
            </div>
            <p className="mt-2 flex min-h-[24px] items-center justify-center gap-1 text-base font-medium text-slate-500">
              {correctWord ? (
                <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                  <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                  {correctWord === currentClue.word ? '¡Correcto!' : '¡También vale!'} Formaste {correctWord}.
                </span>
              ) : (
                hint
              )}
            </p>
          </div>

          {/* La flor */}
          <div className="relative mx-auto mt-3 h-56 w-56 sm:h-72 sm:w-72">
            <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-tiam-blue/10">
              <span className="text-lg font-extrabold text-tiam-blue">
                {found.length}/{target}
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

          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={eraseLast}
              disabled={building.length === 0 || !!correctWord}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 px-4 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
            >
              Borrar
            </button>
            {unfoundCount > 1 && (
              <button
                type="button"
                onClick={nextClue}
                disabled={!!correctWord}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 px-4 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
              >
                Otra pista
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!boxesFull || !!correctWord}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark disabled:cursor-default disabled:opacity-40"
            >
              Listo
            </button>
          </div>
        </>
      )}

      {/* Nivel / día completo */}
      {roundDone && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste las {target} palabras: {found.join(', ')}.
            {isLastLevel ? ' ¡Completaste los 3 niveles de hoy!' : ` ¡Completaste el ${level.name.toLowerCase()}!`}
          </p>
          <div className="mt-5 flex justify-center">
            {isLastLevel ? (
              <button
                type="button"
                onClick={replayDay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={nextLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
