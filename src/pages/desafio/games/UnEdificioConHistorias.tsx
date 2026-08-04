import { useEffect, useMemo, useRef, useState } from 'react'
import {
  User, Users, Cat, Dog, Coffee, Tv, Flower2,
  RotateCcw, ArrowRight, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Un edificio con historias" — a sustained-attention / counting mini-game.
 *
 * The building is rendered LIVE (CSS grid + SVG roof + lucide icons), not as
 * a single AI-generated illustration — same precedent ElReloj/
 * EncontraLaFiguraIgual set for anything where the ground truth has to be
 * exact: a generated painting can't guarantee "exactly 3 people in this
 * window" the way live-rendered content can, and this game's questions
 * ("¿cuántas personas hay en total?") are only fair if the count is
 * actually, verifiably correct. Each window pairs an icon with a short
 * caption (not icon-only) — this audience shouldn't have to infer "2" vs
 * "3" from how many little silhouettes are drawn; the caption says it
 * plainly, and the icon just adds visual charm.
 *
 * The building STAYS VISIBLE for the whole level (unlike QueHayEnLaMesa,
 * which hides studied items during its test phase) — this is a scanning/
 * counting task, not delayed recall, so the answer is meant to be found by
 * looking, not remembered. One scene per level; the level's 4-5 questions
 * are answered one at a time against that same unchanging scene.
 *
 * Difficulty ramps by apartment count AND question type:
 *   L1 6 deptos, straight lookups ("¿en qué depto está...?", one total count)
 *   L2 8 deptos, adds an exact-match count ("¿qué depto tiene EXACTO 3
 *      personas?") and a category count (animales)
 *   L3 9 deptos, adds genuine comparison ("¿dónde hay MÁS personas?" — all
 *      options actually have people, so skimming isn't enough) and a
 *      negative count ("¿cuántos deptos NO tienen personas?")
 *
 * Questions are hand-authored per level, not derived programmatically from
 * the apartment list — same convention as QueOficioEs/BuscarLosRojos'
 * curated content pools, and the only way to guarantee every answer is
 * hand-verified against the scene instead of trusting an on-the-fly count.
 */

interface Apartment {
  id: number
  Icon: LucideIcon
  caption: string
}
interface Question {
  prompt: string
  options: string[]
  correct: string
}
interface Level {
  n: number
  name: string
  gridCols: string
  apartments: Apartment[]
  questions: Question[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    gridCols: 'grid-cols-2',
    apartments: [
      { id: 1, Icon: User, caption: 'leyendo' },
      { id: 2, Icon: Cat, caption: 'un gato' },
      { id: 3, Icon: Users, caption: '2 personas' },
      { id: 4, Icon: Coffee, caption: 'café' },
      { id: 5, Icon: Dog, caption: 'un perro' },
      { id: 6, Icon: Tv, caption: 'tele prendida' },
    ],
    // Total personas: depto1 (1) + depto3 (2) = 3.
    questions: [
      { prompt: '¿En qué depto está el gato?', options: ['Depto 1', 'Depto 2', 'Depto 5', 'Depto 6'], correct: 'Depto 2' },
      { prompt: '¿Cuántas personas hay en total en el edificio?', options: ['2', '3', '4', '5'], correct: '3' },
      { prompt: '¿En qué depto hay una taza de café?', options: ['Depto 3', 'Depto 4', 'Depto 6', 'Depto 1'], correct: 'Depto 4' },
      { prompt: '¿En qué depto está el perro?', options: ['Depto 2', 'Depto 5', 'Depto 6', 'Depto 3'], correct: 'Depto 5' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    gridCols: 'grid-cols-2',
    apartments: [
      { id: 1, Icon: User, caption: 'leyendo' },
      { id: 2, Icon: Cat, caption: 'un gato' },
      { id: 3, Icon: Users, caption: '2 personas charlando' },
      { id: 4, Icon: Coffee, caption: 'café' },
      { id: 5, Icon: Dog, caption: 'un perro' },
      { id: 6, Icon: Tv, caption: 'tele prendida' },
      { id: 7, Icon: Users, caption: '3 personas reunidas' },
      { id: 8, Icon: Flower2, caption: 'una planta' },
    ],
    // Total personas: depto1 (1) + depto3 (2) + depto7 (3) = 6. Animales: depto2 + depto5 = 2.
    questions: [
      { prompt: '¿En qué depto está la planta?', options: ['Depto 6', 'Depto 8', 'Depto 4', 'Depto 1'], correct: 'Depto 8' },
      { prompt: '¿Cuántas personas hay en total en el edificio?', options: ['5', '6', '7', '8'], correct: '6' },
      { prompt: '¿En qué depto hay exactamente 3 personas?', options: ['Depto 3', 'Depto 7', 'Depto 1', 'Depto 8'], correct: 'Depto 7' },
      { prompt: '¿En qué depto está el perro?', options: ['Depto 2', 'Depto 5', 'Depto 6', 'Depto 7'], correct: 'Depto 5' },
      { prompt: '¿Cuántos deptos tienen animales (perro o gato)?', options: ['1', '2', '3', '4'], correct: '2' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    gridCols: 'grid-cols-3',
    apartments: [
      { id: 1, Icon: User, caption: 'leyendo' },
      { id: 2, Icon: Cat, caption: 'un gato' },
      { id: 3, Icon: Users, caption: '2 personas charlando' },
      { id: 4, Icon: Coffee, caption: 'café' },
      { id: 5, Icon: Dog, caption: 'un perro' },
      { id: 6, Icon: Tv, caption: 'tele prendida' },
      { id: 7, Icon: Users, caption: '4 personas reunidas' },
      { id: 8, Icon: Flower2, caption: 'una planta' },
      { id: 9, Icon: User, caption: 'durmiendo' },
    ],
    // Total personas: depto1(1)+depto3(2)+depto7(4)+depto9(1) = 8.
    // Deptos con personas: 1,3,7,9 (4) — sin personas: 2,4,5,6,8 (5).
    questions: [
      { prompt: '¿En qué depto hay MÁS personas?', options: ['Depto 1', 'Depto 3', 'Depto 7', 'Depto 9'], correct: 'Depto 7' },
      { prompt: '¿Cuántas personas hay en total en el edificio?', options: ['6', '7', '8', '9'], correct: '8' },
      { prompt: '¿Cuántos deptos NO tienen personas?', options: ['3', '4', '5', '6'], correct: '5' },
      { prompt: '¿En qué depto está el gato?', options: ['Depto 2', 'Depto 5', 'Depto 6', 'Depto 8'], correct: 'Depto 2' },
      { prompt: '¿En qué depto hay una planta?', options: ['Depto 4', 'Depto 6', 'Depto 8', 'Depto 9'], correct: 'Depto 8' },
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

const PRAISE = ['¡Muy bien!', '¡Excelente atención!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']
const HINTS = ['Esa no es — repasá el edificio con calma.', 'No, esa no. Volvé a mirar cada depto.', 'Casi. Fijate bien y probá otra vez.']

export function UnEdificioConHistorias({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // The building itself is fixed per level (hand-authored, ground-truth
  // content) — only the ORDER of its questions is shuffled per playthrough,
  // same "keep content curated, vary presentation" approach LaIntrusa/
  // LaPalabraEscondida use for their word pools. Rebuilt once per
  // level/roundKey, same useMemo pattern as every rounds-per-level game in
  // this folder (EncontraLaFiguraIgual, LaIntrusa, LaPalabraEscondida).
  const questions = useMemo(
    () => shuffle(level.questions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const question = questions[roundIdx]
  const done = roundIdx >= level.questions.length

  // Re-shuffled per question (object identity changes whenever roundIdx
  // advances to a different question OR the level/round changes).
  const options = useMemo(() => shuffle(question?.options ?? []), [question])

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Mistakes, accumulated across levels 1→2→3 and only zeroed on a genuine
  // day restart (wrap from level 3 back to level 1) — see nextLevel below.
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(option: string) {
    if (!question || resolved || eliminated.has(option)) return
    if (option === question.correct) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(option))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen synchronously HERE, with the level/round change itself —
  // see every other game in this folder for why a separate effect can't
  // safely own this.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }

  const totalQuestionsAllLevels = LEVELS.reduce((sum, l) => sum + l.questions.length, 0)
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + totalQuestionsAllLevels })
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
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Observá el edificio</h2>
      </div>

      {/* The building — persistent scene, stays on screen for every question
          in this level. Roof drawn as a flat SVG triangle (brand navy), body
          as a plain bordered panel holding the apartment grid. */}
      {!done && (
        <div className="mx-auto mt-4 max-w-sm">
          <svg viewBox="0 0 200 36" className="w-full" preserveAspectRatio="none" aria-hidden="true">
            <polygon points="0,36 100,0 200,36" fill="#15436F" />
          </svg>
          <div className="rounded-b-2xl border-2 border-t-0 border-slate-200 bg-white p-2.5 sm:p-3">
            <div className={`grid gap-2 sm:gap-2.5 ${level.gridCols}`}>
              {level.apartments.map((apt) => {
                const Icon = apt.Icon
                return (
                  <div
                    key={apt.id}
                    className="relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-slate-200 bg-tiam-blue/5 px-2 py-2.5"
                  >
                    <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-blue-dark text-[10px] font-bold text-white shadow">
                      {apt.id}
                    </span>
                    <Icon className="h-7 w-7 text-tiam-blue sm:h-8 sm:w-8" strokeWidth={2} />
                    <p className="text-center text-xs font-medium leading-tight text-slate-600 sm:text-sm">{apt.caption}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Question */}
      {!done && question && (
        <>
          <div className="mt-6 text-center">
            <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{question.prompt}</h3>
            <p className="mt-1 text-base font-semibold text-slate-500">
              Pregunta {roundIdx + 1} de {level.questions.length}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {options.map((option) => {
              const isEliminated = eliminated.has(option)
              const isCorrectShown = resolved && option === question.correct
              return (
                <button
                  key={option}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  className={[
                    'relative flex min-h-[48px] items-center justify-center rounded-xl border-2 bg-white px-3 font-semibold text-slate-700 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 line-through' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">¡Respondiste todo — completaste el {level.name.toLowerCase()}!</p>
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
