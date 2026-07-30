import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Fotos conectadas" — día 21 (mes 2), ejecutivas. Three photos that look
 * unrelated at first glance, plus a short clue, share ONE connecting
 * concept — tap it from four multiple-choice options. A convergent-thinking
 * / concept-formation task: the opposite direction of CualNoVa's odd-one-out
 * (there: four similar things, find what breaks the pattern; here: three
 * dissimilar things, find what unites them).
 *
 * Structurally reuses CualNoVa/QueOficioEs's proven "eliminate wrong
 * options, keep trying" flow (a wrong tap greys out that option — never
 * red — and the round stays open until the correct one is found; no
 * penalty beyond the mistake count) rather than inventing a new
 * interaction, since the shape is the same: N photo/icon clues, multiple
 * text options, exactly one right answer.
 *
 * Content is a small pool of 3 hand-authored "connection themes" (a
 * country, a continent, a profession — deliberately different concept
 * TYPES so the game doesn't feel like the same puzzle three times), each
 * with its own dedicated photo triad generated via the local Flux instance
 * (nothing in the existing asset library — all single-object photos on
 * plain backgrounds — reads as "3 photos that seem unrelated" the way a
 * landmark/animal/landscape triad does). All 3 themes play every level
 * (the pool IS the round count), and difficulty ramps the same way
 * CualNoVa/QueOficioEs do: the WRONG options get closer to the answer's own
 * category as the level rises (far/obvious → same-region → easily
 * confused), while the photos and correct answer never change.
 */

interface Theme {
  id: string
  clue: string
  photoIds: [string, string, string]
  answer: string
  distractorsByLevel: [string[], string[], string[]]
}

const THEMES: Theme[] = [
  {
    id: 'francia',
    clue: 'Es un país europeo.',
    photoIds: ['francia-torre', 'francia-baguette', 'francia-boina'],
    answer: 'Francia',
    distractorsByLevel: [
      ['Japón', 'Egipto', 'Brasil'],
      ['España', 'Italia', 'Alemania'],
      ['Bélgica', 'Suiza', 'Portugal'],
    ],
  },
  {
    id: 'australia',
    clue: 'Es un país y continente a la vez.',
    photoIds: ['australia-canguro', 'australia-opera', 'australia-desierto'],
    answer: 'Australia',
    distractorsByLevel: [
      ['Egipto', 'Canadá', 'Rusia'],
      ['Sudáfrica', 'Argentina', 'India'],
      ['Nueva Zelanda', 'Indonesia', 'Papúa Nueva Guinea'],
    ],
  },
  {
    id: 'medico',
    clue: 'Es una profesión.',
    photoIds: ['medico-estetoscopio', 'medico-termometro', 'medico-tensiometro'],
    answer: 'Médico/a',
    distractorsByLevel: [
      ['Panadero/a', 'Jardinero/a', 'Mecánico/a'],
      ['Enfermero/a', 'Veterinario/a', 'Farmacéutico/a'],
      ['Enfermero/a', 'Kinesiólogo/a', 'Farmacéutico/a'],
    ],
  },
]

interface Level {
  n: number
  name: string
  hint?: string
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', hint: 'Mirá las tres fotos y pensá qué tienen en común.' },
  { n: 2, name: 'Nivel 2' },
  { n: 3, name: 'Nivel 3', hint: 'Ahora las opciones se parecen más entre sí — fijate bien.' },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/fotos-conectadas/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
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

const HINTS = [
  'Esa no es la conexión — mirá otra vez las tres fotos.',
  'No es esa. ¿Qué tienen en común las tres imágenes?',
  'Casi. Pensá en la pista y volvé a intentar.',
]
const PRAISE = ['¡Muy bien!', '¡Exacto!', '¡Así se conecta!', '¡Perfecto!']

export function FotosConectadas({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // All 3 themes play every level (the pool IS the round count) — only the
  // ORDER is reshuffled per level/replay.
  const order = useMemo(
    () => shuffle(THEMES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (wrap)
  // — same policy as CualNoVa/QueOficioEs, the closest sibling games.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const theme = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(
    () => (theme ? shuffle([theme.answer, ...theme.distractorsByLevel[levelIdx]]) : []),
    [theme, levelIdx],
  )

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(option: string) {
    if (!theme || solved || eliminated.has(option)) return
    if (option === theme.answer) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
      }, 1100)
    } else {
      setEliminated((prev) => (prev.has(option) ? prev : new Set(prev).add(option)))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  // Resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundKey — never in a separate effect keyed on them (the
  // stale-flag hazard fixed across this codebase's other games).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    if (isWrap) {
      setMistakes(0)
      setCorrectCount(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
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
        {!done && (
          <>
            <p className="mt-2 text-base font-semibold text-slate-700">¿Qué conecta a estas tres fotos?</p>
            {level.hint && <p className="mt-1 text-sm font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
          </>
        )}
      </div>

      {!done && theme && (
        <>
          {/* Las tres fotos */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {theme.photoIds.map((id) => {
              const img = imgFor(id)
              return (
                <div
                  key={id}
                  className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-100 bg-white"
                >
                  {img && <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />}
                </div>
              )
            })}
          </div>

          {/* Pista */}
          <p className="mt-3 text-center text-sm font-medium text-slate-500">Pista: {theme.clue}</p>

          {/* Opciones */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {options.map((option) => {
              const isEliminated = eliminated.has(option)
              const isSolved = solved && option === theme.answer
              return (
                <button
                  key={option}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(option)}
                  className={[
                    'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-base font-bold transition sm:text-lg',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {solved && (
            <p className="mt-4 text-center text-sm font-semibold text-tiam-green">
              ¡Eso es! Las tres fotos conectan con "{theme.answer}".
            </p>
          )}
          {hint && !solved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
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
            Encontraste las {order.length} conexiones — completaste el nivel {levelIdx + 1}.
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
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
