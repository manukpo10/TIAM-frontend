import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿A qué se dedicaba?" — memory for name ↔ occupation pairs of well-known
 * public figures. Adapted from a paper exercise: a list of famous names, and
 * for each you name the job, craft or role that made them famous.
 *
 * STUDY FIRST, THEN ASK. Each level opens on a study screen — every person
 * in the round with their occupation and one short fact — and only then
 * asks, one name at a time, to tap the occupation among 4. The first version
 * went straight to the questions, to be answered from general knowledge, and
 * that left a player who didn't know who Nicolino Locche or Luis Puenzo was
 * with nothing to answer from; the instructions never said the answer was
 * meant to come from what you already know. Studying first makes it
 * encode-then-recall, which is what a memory day should be, and nobody
 * depends on knowing the person beforehand — knowing them just helps. The
 * study screen is the house pattern shared with ListaDelMercado.tsx and
 * QuienLoDijo.tsx: a timed reveal with a progress bar and an early
 * "ya estoy list@" button. Questions come in a different order than the
 * study list, so position alone can't answer them.
 *
 * NAMES ONLY, NO PHOTOGRAPHS. This sidesteps likeness/rights questions
 * entirely, and it matches the paper original, which is a list of names
 * too. It also keeps the task about binding a job to a name instead of
 * turning it into face-recognition, which is a different skill and would
 * need a photo library this app doesn't have.
 *
 * ACCURACY POLICY — this is the whole point of the exercise, so it shaped
 * every entry in PEOPLE below. Only people whose defining public occupation
 * is singular and beyond dispute made the cut (Gabriela Sabatini → tenista,
 * no asterisk needed). Anyone genuinely known for two separate things — a
 * singer who became a career politician, an actor with an equally famous
 * parallel career as a director — was left out rather than force a pick;
 * teaching this audience a wrong fact about someone they grew up with is a
 * real harm, not a trivia slip. Two names that could look like exceptions
 * but aren't: Carlos Gardel and Niní Marshall both appeared on screen, but
 * Gardel's films were vehicles built around his songs (he is never
 * remembered as "cantante y actor", only as the definitive tango singer)
 * and Marshall's screen work IS her acting career (she originated Catita
 * there) — neither is a real second identity competing with the first.
 * The same bar applied to the short fact shown on the study screen and
 * again after a correct answer: every fact below is something ordinary and
 * independently checkable (a title, a year, a nickname), and any person the
 * author could not back with full confidence was either dropped from the
 * roster entirely or kept with `fact` left undefined rather than guessed at.
 *
 * DIFFICULTY — distractor occupations are drawn from OCCUPATIONS by
 * `cluster` (a broad professional field). Level 1 prefers a FAR cluster (a
 * singer against a footballer), level 3 prefers the SAME cluster as the
 * correct answer (a singer against a musician and an actor — the case
 * `pickDistractors` favours whenever the cluster is large enough), and
 * level 2 draws from the unrestricted pool. A cluster with too few peers
 * (e.g. "oficio", which holds only cocinero) gracefully tops up from the
 * far pool instead of failing to fill 3 distractors — see the comment on
 * `pickDistractors`.
 */

type ClusterId = 'deporte' | 'espectaculo' | 'letras' | 'visual' | 'oficio'

interface Occupation {
  id: string
  label: string
  /**
   * Feminine form, where the word has one. Masculine and feminine used to be
   * two separate occupations, which let a male name draw "Escritora" as a
   * distractor: it reads wrong, and it hands the player a free elimination —
   * nobody picks the feminine option for Carlos Monzón.
   */
  labelF?: string
  cluster: ClusterId
}

const OCCUPATIONS: Occupation[] = [
  { id: 'futbolista', label: 'futbolista', cluster: 'deporte' },
  { id: 'tenista', label: 'tenista', cluster: 'deporte' },
  { id: 'boxeador', label: 'boxeador', labelF: 'boxeadora', cluster: 'deporte' },
  { id: 'cantante', label: 'cantante', cluster: 'espectaculo' },
  { id: 'musico', label: 'músico', labelF: 'música', cluster: 'espectaculo' },
  { id: 'actor', label: 'actor', labelF: 'actriz', cluster: 'espectaculo' },
  { id: 'humorista', label: 'humorista', cluster: 'espectaculo' },
  { id: 'director', label: 'director de cine', labelF: 'directora de cine', cluster: 'espectaculo' },
  { id: 'escritor', label: 'escritor', labelF: 'escritora', cluster: 'letras' },
  { id: 'pintor', label: 'pintor', labelF: 'pintora', cluster: 'visual' },
  { id: 'dibujante', label: 'dibujante', cluster: 'visual' },
  { id: 'cocinero', label: 'cocinero', labelF: 'cocinera', cluster: 'oficio' },
]

/** Every option in a round takes the gender of the person being asked about. */
const labelFor = (o: Occupation, female: boolean) => (female && o.labelF ? o.labelF : o.label)

const OCCUPATION_BY_ID: Record<string, Occupation> = Object.fromEntries(OCCUPATIONS.map((o) => [o.id, o]))

interface Person {
  id: string
  name: string
  occupationId: string
  /** Drives which grammatical form every option in the round is shown in. */
  female?: true
  /** Short, independently-checkable fact — omitted (undefined) for anyone
   * the author would otherwise have to guess about. See file header. */
  fact?: string
}

// 30 people, each with a single undisputed defining occupation. See the
// file header for the accuracy policy that shaped this list, and the
// roster confidence notes returned alongside this change for the
// per-person review.
const PEOPLE: Person[] = [
  { id: 'maradona', name: 'Diego Maradona', occupationId: 'futbolista', fact: 'Fue campeón del mundo con la Selección Argentina en 1986.' },
  { id: 'messi', name: 'Lionel Messi', occupationId: 'futbolista', fact: 'Ganó el Mundial con la Selección Argentina en 2022.' },
  { id: 'kempes', name: 'Mario Kempes', occupationId: 'futbolista', fact: 'Fue la gran figura del Mundial 78, campeón con Argentina.' },
  { id: 'sabatini', female: true, name: 'Gabriela Sabatini', occupationId: 'tenista', fact: 'Ganó el US Open en 1990.' },
  { id: 'vilas', name: 'Guillermo Vilas', occupationId: 'tenista', fact: 'Ganó Roland Garros en 1977.' },
  { id: 'delpotro', name: 'Juan Martín del Potro', occupationId: 'tenista', fact: 'Ganó el US Open en 2009.' },
  { id: 'sosa', female: true, name: 'Mercedes Sosa', occupationId: 'cantante', fact: "La llamaban 'La Voz de América'." },
  { id: 'gardel', name: 'Carlos Gardel', occupationId: 'cantante', fact: 'Está considerado el mejor cantor de tango de la historia.' },
  { id: 'iglesias', name: 'Julio Iglesias', occupationId: 'cantante', fact: 'Vendió millones de discos por todo el mundo.' },
  { id: 'marshall', female: true, name: 'Niní Marshall', occupationId: 'actor', fact: 'Creó a Catita, uno de sus personajes más recordados.' },
  { id: 'sandrini', name: 'Luis Sandrini', occupationId: 'actor', fact: 'Fue uno de los actores cómicos más populares del cine argentino.' },
  { id: 'soriano', name: 'Pepe Soriano', occupationId: 'actor', fact: "Interpretó a 'La Nona' en cine y teatro." },
  { id: 'borges', name: 'Jorge Luis Borges', occupationId: 'escritor', fact: "Escribió libros como 'Ficciones' y 'El Aleph'." },
  { id: 'cortazar', name: 'Julio Cortázar', occupationId: 'escritor', fact: "Escribió la famosa novela 'Rayuela'." },
  { id: 'garciamarquez', name: 'Gabriel García Márquez', occupationId: 'escritor', fact: "Escribió 'Cien años de soledad' y ganó el Premio Nobel en 1982." },
  { id: 'sabato', name: 'Ernesto Sabato', occupationId: 'escritor', fact: "Escribió la novela 'El túnel'." },
  { id: 'storni', female: true, name: 'Alfonsina Storni', occupationId: 'escritor', fact: "Escribió poemas como 'Tú me quieres blanca'." },
  { id: 'mistral', female: true, name: 'Gabriela Mistral', occupationId: 'escritor', fact: 'Ganó el Premio Nobel de Literatura en 1945.' },
  { id: 'quinquela', name: 'Benito Quinquela Martín', occupationId: 'pintor', fact: 'Pintó el puerto y los barcos del barrio de La Boca.' },
  { id: 'soldi', name: 'Raúl Soldi', occupationId: 'pintor', fact: 'Pintó la cúpula del Teatro Colón.' },
  { id: 'monzon', name: 'Carlos Monzón', occupationId: 'boxeador', fact: 'Fue campeón mundial de los pesos medianos en los años 70.' },
  { id: 'locche', name: 'Nicolino Locche', occupationId: 'boxeador', fact: "Le decían 'El Intocable' porque nadie lo podía tocar en el ring." },
  { id: 'piazzolla', name: 'Astor Piazzolla', occupationId: 'musico', fact: 'Revolucionó el tango con el bandoneón.' },
  { id: 'troilo', name: 'Aníbal Troilo', occupationId: 'musico', fact: "Era un maestro del bandoneón al que apodaban 'Pichuco'." },
  { id: 'olmedo', name: 'Alberto Olmedo', occupationId: 'humorista', fact: 'Fue uno de los humoristas más queridos de la tele argentina.' },
  { id: 'tatobores', name: 'Tato Bores', occupationId: 'humorista', fact: 'Hacía sus famosos monólogos de humor político en la tele.' },
  { id: 'puenzo', name: 'Luis Puenzo', occupationId: 'director', fact: "Dirigió 'La historia oficial', que ganó el Oscar en 1986." },
  { id: 'campanella', name: 'Juan José Campanella', occupationId: 'director', fact: "Dirigió 'El secreto de sus ojos', que ganó el Oscar en 2010." },
  { id: 'mallmann', name: 'Francis Mallmann', occupationId: 'cocinero', fact: 'Es un chef argentino famoso en el mundo por su cocina a fuego.' },
  { id: 'quino', name: 'Quino', occupationId: 'dibujante', fact: 'Creó a Mafalda, la nena más famosa de las historietas.' },
]

interface Level {
  n: number
  name: string
  rounds: number
  mode: 'far' | 'mixed' | 'close'
  hint: string
  /** The study screen moves on to the questions by itself after this long. */
  studySeconds: number
  /** The early-continue button unlocks after this long. */
  minEarlySeconds: number
}

const LEVELS: Level[] = [
  // Study times sit a little above ListaDelMercado / RecordaLosDetalles for
  // the same card count, because every card here also carries a fact.
  { n: 1, name: 'Nivel 1', rounds: 3, mode: 'far', studySeconds: 24, minEarlySeconds: 8, hint: 'Acordate de lo que leíste y elegí a qué se dedicaba.' },
  { n: 2, name: 'Nivel 2', rounds: 4, mode: 'mixed', studySeconds: 30, minEarlySeconds: 10, hint: 'Fijate bien: las opciones ya no son tan distintas entre sí.' },
  { n: 3, name: 'Nivel 3', rounds: 5, mode: 'close', studySeconds: 36, minEarlySeconds: 12, hint: 'Acá los oficios se parecen mucho — pensalo bien antes de tocar.' },
]
// Every round is eventually answered correctly (a wrong tap never ends it),
// so the correct-answer count at completion always equals this fixed total
// — no need to track it as separate running state.
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
/** "director de cine" → "Director de cine". CSS `capitalize` would title-case
 * every word ("Director De Cine"), which isn't how Spanish is written. */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function pickPeople(n: number): Person[] {
  return shuffle(PEOPLE).slice(0, n)
}

/**
 * Picks 3 distinct wrong occupations for `occupationId`, biased by `mode`.
 * 'close' prefers the SAME cluster first (adjacent field — a singer against
 * a musician and an actor), 'far' prefers every OTHER cluster first (a
 * singer against a footballer), 'mixed' doesn't bias at all. `same` and
 * `far` are a disjoint partition of every other occupation, so
 * concatenating them and slicing 3 can never repeat an item — and a small
 * cluster still always yields 3 by falling through to `far`. Two clusters
 * hit that: "oficio" (only cocinero) and "letras" (only escritor, which
 * covers 6 people). Level 3 is therefore easier for the writers, on
 * purpose: their natural peers — poeta, periodista, traductor — are true of
 * several of these same writers (Borges, Storni, García Márquez, Cortázar),
 * so adding them would plant a second right answer.
 */
function pickDistractors(occupationId: string, mode: Level['mode']): Occupation[] {
  const correct = OCCUPATION_BY_ID[occupationId]
  const others = OCCUPATIONS.filter((o) => o.id !== occupationId)
  if (mode === 'mixed') return shuffle(others).slice(0, 3)

  const same = shuffle(others.filter((o) => o.cluster === correct.cluster))
  const far = shuffle(others.filter((o) => o.cluster !== correct.cluster))
  const ordered = mode === 'close' ? [...same, ...far] : [...far, ...same]
  return ordered.slice(0, 3)
}

interface Round {
  person: Person
  options: Occupation[]
}

function buildRounds(people: Person[], mode: Level['mode']): Round[] {
  return people.map((person) => {
    const correct = OCCUPATION_BY_ID[person.occupationId]
    const distractors = pickDistractors(person.occupationId, mode)
    return { person, options: shuffle([correct, ...distractors]) }
  })
}

interface LevelSet {
  /** Study-screen order: alphabetical, like a list you'd read top to bottom. */
  study: Person[]
  /** Question order: reshuffled until it differs from the study order. */
  rounds: Round[]
}

function buildLevelSet(level: Level): LevelSet {
  const people = pickPeople(level.rounds)
  const study = [...people].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  let asked = shuffle(people)
  while (people.length > 1 && asked.every((person, i) => person.id === study[i].id)) asked = shuffle(people)
  return { study, rounds: buildRounds(asked, level.mode) }
}

const PRAISE = ['¡Muy bien!', '¡Excelente memoria!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']
const HINTS = [
  'Esa persona no se dedicaba a eso — probá con otra opción.',
  'No es esa. Pensá bien quién era.',
  'Casi. Fijate de nuevo y probá otra vez.',
]

export function OficiosDeFamosos({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const { study, rounds } = useMemo(
    () => buildLevelSet(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [phase, setPhase] = useState<'study' | 'test'>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3, zeroed only on a genuine day restart
  // (see nextLevel's wrap branch) — a same-level replay keeps it.
  const [mistakes, setMistakes] = useState(0)

  const round = rounds[currentIndex]
  const done = currentIndex >= rounds.length

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  // Timed study reveal + early-continue escape hatch — same shape as
  // QuienLoDijo.tsx. Re-armed on every level change and replay (both bump
  // roundKey), since each one brings a fresh set of people to study.
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

  // Fires once per roundKey when level 3's last round resolves. A genuine
  // full-day restart (the wrap back to level 1) gets a new roundKey, so it
  // can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  function guess(occId: string) {
    if (phase !== 'test' || !round || solved || eliminated.has(occId)) return
    if (occId === round.person.occupationId) {
      setSolved(occId)
      setHint(null)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(null)
      }, 900)
    } else {
      setEliminated((prev) => new Set(prev).add(occId))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  // Resets happen HERE, synchronously with the level/round change — NOT in
  // a useEffect keyed on levelIdx. An effect only catches up on the render
  // AFTER levelIdx changes, so `done` (currentIndex vs. the NEW level's
  // rounds.length, already updated via useMemo) would read the previous
  // level's stale currentIndex on the very render that arrives at the new
  // level, and fire onComplete with garbage. Same reasoning as
  // SumaHastaDiez.tsx / QueOficioEs.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(null)
    setHint(null)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(null)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {phase === 'study' ? (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Mirá a qué se dedicaba cada persona</h2>
            <p className="mt-2 text-base text-slate-500">Leé con calma: después te voy a preguntar el oficio de cada una.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-green"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Elegí a qué se dedicaba cada persona</h2>
            {!done && (
              <>
                {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
                <p className="mt-2 text-base font-semibold text-slate-500">
                  Llevás {currentIndex} de {rounds.length}
                </p>
                <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                    style={{ width: `${(currentIndex / rounds.length) * 100}%` }}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Study phase: who did what — typography only, no photos (see module doc) */}
      {phase === 'study' && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {study.map((person) => (
              <div key={person.id} className="rounded-2xl border-2 border-slate-100 bg-white p-4">
                <p className="text-lg font-bold text-slate-900">{person.name}</p>
                <p className="mt-0.5 text-base font-semibold text-tiam-blue">
                  {capitalizeFirst(labelFor(OCCUPATION_BY_ID[person.occupationId], !!person.female))}
                </p>
                {person.fact && <p className="mt-1 text-base text-slate-500">{person.fact}</p>}
              </div>
            ))}
          </div>
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
        </>
      )}

      {phase === 'test' && !done && round && (
        <>
          {/* Name card */}
          <div className="mt-6 rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">¿A qué se dedicaba?</p>
            <p className="mt-2 text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">{round.person.name}</p>
          </div>

          {/* Options */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {round.options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              const isSolved = solved === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={solved !== null || isEliminated}
                  onClick={() => guess(opt.id)}
                  className={[
                    'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition sm:text-xl',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 opacity-70 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {isSolved && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
                    {capitalizeFirst(labelFor(opt, !!round.person.female))}
                  </span>
                </button>
              )
            })}
          </div>

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
          {solved && round.person.fact && (
            <p className="mt-4 text-center text-base font-medium text-tiam-blue">{round.person.fact}</p>
          )}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Acertaste a las {rounds.length} personas — ¡completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {levelIdx === LEVELS.length - 1 && (
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Otras personas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
