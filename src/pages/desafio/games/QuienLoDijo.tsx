import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Quién lo dijo?" — día 15, memoria. Source memory: remembering not just
 * WHAT was said but WHO said it — a purer test of source attribution than
 * QuienEsQuien.tsx's face↔name recognition. Every character has an illustrated
 * portrait (Flux-generated, same flat line-art style as the quien-es-quien
 * faces), shown on the study cards and next to each name in the test phase.
 * The portraits are NEUTRAL on purpose: no tools, plants, instruments or team
 * colors, nothing that hints at what the person does. The phrases are about
 * exactly that, so a portrait with a prop would let the player match the
 * sentence to the picture instead of remembering — the only way to answer is
 * still to have bound the phrase to its speaker during study.
 *
 * The paper exercise this is loosely inspired by attributes famous quotations
 * to historical figures. That is deliberately NOT what got built here: quote
 * attribution folklore is notoriously unreliable, and a wrong attribution
 * shown to older adults who trust this product as accurate would be a real
 * harm, not a trivia footnote. Every character and every phrase below is
 * invented for this file — nobody real, nothing quoted from anywhere — which
 * exercises the identical (arguably purer) cognitive function: bind content to
 * its source, then retrieve by source alone.
 *
 * Two house patterns, one per phase:
 *   - Study phase: timed reveal + early "ya estoy list@" escape hatch, same
 *     `study-progress-fill` bar as QuienEsQuien.tsx / QueHayEnLaMesa.tsx.
 *   - Test phase: QuienEsQuien's eliminate-and-retry per question — a wrong
 *     tap just greys out that name and hints, never ends the question. Each
 *     phrase has exactly one correct speaker, so totalAttempts = mistakes + a
 *     fixed phrase count (guaranteed-eventual-success), same accounting.
 *
 * Differs from QuienEsQuien in two ways:
 *   1. Each level has TWO hand-authored character sets (`Level.sets`), and
 *      plays only ONE study→test pass: which set a level plays is picked at
 *      random once, at mount (see `epochLevels`), and "Repetir" always
 *      brings back that same set — same content-freezing convention as the
 *      rest of the catalog. One pass per level on purpose — two back-to-back
 *      rounds of the same mechanic made each level too long.
 *   2. The test phase never narrows to a small option subset: every question
 *      offers ALL of the round's studied names, in the same fixed order for
 *      every question in that round (shuffled once per round, not reshuffled
 *      per question) — the task is always "which of these people, exactly,"
 *      never "which of these three."
 *
 * Content is 100% hand-authored, not procedurally generated and not drawn
 * from a shared name pool (unlike QuienEsQuien's 8-face pool): 3 levels × 2
 * sets = 6 character sets, each hand-checked so every phrase maps to
 * exactly one studied character and could not plausibly belong to another
 * (also checked by a throwaway invariant script at authoring time). Each
 * set's card, phrase and button order is shuffled once at mount, so a set
 * looks exactly the same every time "Repetir" brings it back.
 */

interface Character {
  id: string
  name: string
  /** One plain, warm sentence — occupation and/or a concrete everyday detail. */
  fact: string
}
interface Phrase {
  /** First-person line only that one character would plausibly say. */
  text: string
  characterId: string
}
interface RoundContent {
  characters: Character[]
  /** Exactly one phrase per character — see module doc for why. */
  phrases: Phrase[]
}
interface Level {
  n: number
  name: string
  characterCount: number
  studySeconds: number
  minEarlySeconds: number
  /** Two authored character sets; one is picked at random per level, at mount — see module doc. */
  sets: RoundContent[]
}

const PORTRAITS = import.meta.glob('../../../assets/desafio/games/quien-lo-dijo/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function portraitFor(id: string): string | undefined {
  return Object.entries(PORTRAITS).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    characterCount: 3,
    studySeconds: 18,
    minEarlySeconds: 8,
    sets: [
      {
        characters: [
          { id: 'marta', name: 'Marta', fact: 'Marta es jardinera y vive en Rosario.' },
          { id: 'julio', name: 'Don Julio', fact: 'Don Julio tiene una ferretería desde hace cuarenta años.' },
          { id: 'susana', name: 'Susana', fact: 'Susana fue maestra y ahora juega al bingo los jueves.' },
        ],
        phrases: [
          { text: 'Esta semana planté los rosales nuevos.', characterId: 'marta' },
          { text: 'Se me terminaron los tornillos de 8 milímetros, tengo que pedir más.', characterId: 'julio' },
          { text: 'El jueves que viene juego con mis amigas, a ver si por fin gano.', characterId: 'susana' },
        ],
      },
      {
        characters: [
          { id: 'roberto', name: 'Roberto', fact: 'Roberto reparte las cartas del barrio en bicicleta.' },
          { id: 'nelida', name: 'Nélida', fact: 'Nélida hornea tortas por encargo para cumpleaños.' },
          { id: 'pablo', name: 'Pablo', fact: 'Pablo juega al truco en el club todos los viernes.' },
        ],
        phrases: [
          { text: 'Hoy la bicicleta tenía una goma pinchada y llegué tarde con el reparto.', characterId: 'roberto' },
          { text: 'Me encargaron una torta de chocolate para el sábado.', characterId: 'nelida' },
          { text: 'Anoche canté las cuarenta y gané la partida.', characterId: 'pablo' },
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    characterCount: 4,
    studySeconds: 22,
    minEarlySeconds: 10,
    sets: [
      {
        characters: [
          { id: 'elsa', name: 'Elsa', fact: 'Elsa hace flanes caseros y los vende los domingos en la feria.' },
          { id: 'anibal', name: 'Aníbal', fact: 'Aníbal arregla bicicletas en el garaje de su casa.' },
          { id: 'coco', name: 'Coco', fact: 'Coco es hincha de Boca y no se pierde un partido.' },
          { id: 'teresa', name: 'Teresa', fact: 'Teresa ceba mate para todo el edificio en la vereda.' },
        ],
        phrases: [
          { text: 'Este domingo llevo dos flanes más a la feria, se venden rápido.', characterId: 'elsa' },
          { text: 'Le cambié la cadena a la bici del vecino esta mañana.', characterId: 'anibal' },
          { text: 'El domingo hay clásico y no me lo pierdo por nada.', characterId: 'coco' },
          { text: 'Puse la pava y ya tengo la bombilla lista para todos.', characterId: 'teresa' },
        ],
      },
      {
        characters: [
          { id: 'walter', name: 'Walter', fact: 'Walter es plomero y anda siempre con la caja de herramientas en la moto.' },
          { id: 'gladys', name: 'Gladys', fact: 'Gladys teje pulóveres para todos los nietos cuando llega el invierno.' },
          { id: 'oscar', name: 'Oscar', fact: 'Oscar arregla relojes viejos en un tallercito atrás de su casa.' },
          { id: 'corina', name: 'Corina', fact: 'Corina tiene un nieto que juega al fútbol en las inferiores de un club.' },
        ],
        phrases: [
          { text: 'Se me tapó un caño en lo de un cliente y tuve que volver a buscar otra herramienta.', characterId: 'walter' },
          { text: 'Ya terminé la manga del pulóver, me falta la otra y el cuello.', characterId: 'gladys' },
          { text: 'Este reloj de péndulo tiene un engranaje gastado, va a llevarme unos días.', characterId: 'oscar' },
          { text: 'El sábado mi nieto tiene partido y no me lo pierdo por nada del mundo.', characterId: 'corina' },
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    characterCount: 4,
    studySeconds: 24,
    minEarlySeconds: 11,
    sets: [
      {
        characters: [
          { id: 'hugo', name: 'Hugo', fact: 'Hugo organiza los torneos de bochas los martes en el club de jubilados.' },
          { id: 'marisa', name: 'Marisa', fact: 'Marisa da clases de gimnasia los lunes y miércoles en el club de jubilados.' },
          { id: 'ricardo', name: 'Ricardo', fact: 'Ricardo arma las mesas de dominó los viernes a la tarde en el club de jubilados.' },
          { id: 'delia', name: 'Delia', fact: 'Delia prepara las empanadas para la fiesta de fin de año del club de jubilados.' },
        ],
        phrases: [
          { text: 'Este martes anoté quince parejas para el torneo de bochas.', characterId: 'hugo' },
          { text: 'Mañana lunes empiezo la clase de gimnasia una hora más temprano.', characterId: 'marisa' },
          { text: 'El viernes a la tarde ya tengo armadas las cuatro mesas de dominó.', characterId: 'ricardo' },
          { text: 'Para la fiesta de fin de año voy a hacer el doble de empanadas de carne.', characterId: 'delia' },
        ],
      },
      {
        characters: [
          { id: 'beba', name: 'Beba', fact: 'Beba vive en el primer piso y riega las plantas del pasillo todas las mañanas.' },
          { id: 'nestor', name: 'Néstor', fact: 'Néstor vive en el segundo piso y saca a pasear a su perro Fideo todas las tardes.' },
          { id: 'amanda', name: 'Amanda', fact: 'Amanda vive en el tercer piso y toca el bandoneón los domingos a la siesta.' },
          { id: 'silvio', name: 'Silvio', fact: 'Silvio vive en el cuarto piso y arregla las bicicletas de los chicos del edificio.' },
        ],
        phrases: [
          { text: 'Esta mañana les puse agua a los helechos del pasillo antes de que saliera el sol.', characterId: 'beba' },
          { text: 'A la tardecita Fideo ya me estaba esperando en la puerta con la correa.', characterId: 'nestor' },
          { text: 'El domingo a la siesta toqué dos tangos nuevos con el bandoneón.', characterId: 'amanda' },
          { text: 'Le solté un poco los frenos a la bici del más chico, le quedaban muy duros.', characterId: 'silvio' },
        ],
      },
    ],
  },
]

// One study→test pass per level, and every set has one phrase per character.
const TOTAL_PHRASES = LEVELS.reduce((sum, l) => sum + l.characterCount, 0)

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

interface EpochRound {
  /** Study-phase card order. */
  characters: Character[]
  /** Test-phase question order. */
  phraseOrder: Phrase[]
  /** Test-phase button order — fixed for every question in the round, so names
   * don't hop around between questions (see module doc, point 2). */
  optionOrder: Character[]
}
function buildEpochRound(round: RoundContent): EpochRound {
  return {
    characters: shuffle(round.characters),
    phraseOrder: shuffle(round.phrases),
    optionOrder: shuffle(round.characters),
  }
}

const HINTS = [
  'No fue esa persona — pensá bien quién lo diría.',
  'Casi. Fijate qué te contó cada uno.',
  'No era — probá con otro nombre.',
]
const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente memoria!', '¡Así se hace!', '¡Qué buena memoria!']
const PRAISE_OK = ['¡Buen intento! Con la práctica se recuerda cada vez más.', '¡Bien ahí! Seguí practicando.']

export function QuienLoDijo({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which of each level's two authored character sets this "época" plays,
  // chosen once at random per level, at mount, plus that set's study/
  // question/option order built at the same time — content is fully
  // hand-authored (no pool to re-sample from), so freezing both here means a
  // level looks exactly the same every time "Repetir" brings it back, same
  // rationale as QuienEsQuien.tsx.
  const [epochLevels] = useState(() => LEVELS.map((lvl) => buildEpochRound(pickOne(lvl.sets))))
  const level = LEVELS[levelIdx]
  const epochRound = epochLevels[levelIdx]

  const [phase, setPhase] = useState<'study' | 'test'>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  const [correctInLevel, setCorrectInLevel] = useState(0)
  // Accumulates across levels 1→2→3, zeroed only by replay()'s genuine day
  // restart — see the comment there.
  const [mistakes, setMistakes] = useState(0)

  // True once every phrase of the level's single study→test pass has been
  // answered.
  const done = phraseIdx >= epochRound.phraseOrder.length
  const totalInLevel = level.characterCount

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctInLevel / totalInLevel >= 0.6 ? PRAISE_GOOD : PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // Timed study reveal + early-continue escape hatch — same shape as
  // QuienEsQuien.tsx, re-armed on every level change and on "Repetir" (both
  // bring a fresh set of people to study).
  const autoTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    const floorTimer = window.setTimeout(() => setCanContinueEarly(true), level.minEarlySeconds * 1000)
    const autoTimer = window.setTimeout(() => setPhase('test'), level.studySeconds * 1000)
    autoTimerRef.current = autoTimer
    return () => {
      window.clearTimeout(floorTimer)
      window.clearTimeout(autoTimer)
    }
  }, [levelIdx, roundKey, level.minEarlySeconds, level.studySeconds])

  // After a correct tap, move on to the next phrase (after the last one, that
  // is the level card) once the green check has shown for a moment, resetting
  // every per-question piece of state together so nothing stale leaks into
  // the next question.
  function advanceToNext() {
    window.setTimeout(() => {
      setPhraseIdx((i) => i + 1)
      setEliminated(new Set())
      setSolved(false)
      setHint(null)
    }, 900)
  }

  function guess(characterId: string) {
    if (phase !== 'test' || solved || eliminated.has(characterId)) return
    const phrase = epochRound.phraseOrder[phraseIdx]
    if (characterId === phrase.characterId) {
      setSolved(true)
      setHint(null)
      setCorrectInLevel((c) => c + 1)
      advanceToNext()
    } else {
      setEliminated((prev) => (prev.has(characterId) ? prev : new Set(prev).add(characterId)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render behind, so `done` (derived
  // straight from phraseIdx) would read the previous level's stale-true value
  // on the very render that arrives at the new level and fire the completion
  // card (or onComplete) with garbage. Same discipline as SumaHastaDiez.tsx /
  // ElVuelto.tsx.
  function nextLevel() {
    setLevelIdx((i) => i + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setPhraseIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectInLevel(0)
  }

  // Only reachable from the FINAL level's completion card — a genuine day
  // restart, same idea as QuienEsQuien.tsx's restartEpoch(): back to level 1,
  // mistakes zeroed, and a bumped roundKey so the reportedRoundKeyRef guard
  // below lets onComplete fire again (also re-arms the study timer, since
  // that effect is keyed on roundKey too). epochLevels itself is never
  // touched, so every level replays the exact same character set — and the
  // same presentation order — it got at mount.
  function replay() {
    setLevelIdx(0)
    setPhase('study')
    setCanContinueEarly(false)
    setPhraseIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectInLevel(0)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PHRASES })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const currentPhrase = !done ? epochRound.phraseOrder[phraseIdx] : undefined

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Conocé a esta gente</h2>
            <p className="mt-2 text-base text-slate-500">Después te voy a preguntar quién dijo cada frase.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-green"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {phase === 'test' && !done && (
          <>
            <p className="mt-2 text-base text-slate-500">¿Quién lo dijo?</p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                {phraseIdx} de {epochRound.phraseOrder.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(phraseIdx / epochRound.phraseOrder.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Study phase: character cards — neutral portrait + name + fact (see module doc) */}
      {phase === 'study' && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {epochRound.characters.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-3">
              <img src={portraitFor(c.id)} alt="" className="h-16 w-16 shrink-0 rounded-full bg-slate-50" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900">{c.name}</p>
                <p className="mt-0.5 text-base leading-snug text-slate-500">{c.fact}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Study phase: early-continue button */}
      {phase === 'study' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={!canContinueEarly}
            onClick={() => {
              window.clearTimeout(autoTimerRef.current)
              setPhase('test')
            }}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-green px-6 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ya estoy list@, continuar
          </button>
        </div>
      )}

      {/* Test phase: phrase + tap targets */}
      {phase === 'test' && !done && currentPhrase && (
        <>
          <div className="mx-auto mt-4 max-w-sm rounded-3xl border-2 border-tiam-blue/15 bg-tiam-blue/5 p-5 text-center">
            <p className="text-lg font-semibold text-slate-800">«{currentPhrase.text}»</p>
          </div>
          <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5">
            {epochRound.optionOrder.map((c) => {
              const isEliminated = eliminated.has(c.id)
              const isCorrectShown = solved && c.id === currentPhrase.characterId
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(c.id)}
                  className={[
                    'flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-3 py-1.5 text-left text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-green/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-green/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <img
                    src={portraitFor(c.id)}
                    alt=""
                    className={['h-11 w-11 shrink-0 rounded-full bg-slate-50', isEliminated ? 'opacity-40 grayscale' : ''].join(' ')}
                  />
                  <span className="flex-1">{c.name}</span>
                  {isCorrectShown && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {hint && !solved && !done && phase === 'test' && (
        <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Acertaste {correctInLevel} de {totalInLevel} — completaste el {level.name.toLowerCase()}.
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextLevel}
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
                onClick={replay}
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
