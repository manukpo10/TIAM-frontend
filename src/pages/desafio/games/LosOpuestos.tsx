import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Los opuestos" — an antonyms game (paradigmatic opposition), inspired by
 * the classic opposites/antónimos language exercise. All content original.
 *
 * Antonymy is a distinct lexical relation from category membership
 * (CadaCosaEnSuGrupo) or definition-matching (QueObjetoEs) — no existing game
 * tests it. Decoys are always SAME-DIMENSION-but-not-the-opposite traps
 * (for GRANDE: alto/gordo/ancho, not the true antonym "chico").
 *
 * Illustrated at L1 (image + caption options, where concrete words illustrate
 * cleanly), text-only at L2/L3 as the words turn abstract (bueno/malo,
 * siempre/nunca) — which doubles as the difficulty ramp: pictures at the easy
 * level, pure semantic retrieval once warmed up. A wrong tap eliminates that
 * option (muted grey, never red — word-finding is emotionally loaded).
 */

interface Round {
  prompt: string
  answer: string
  decoys: string[]
}
interface Level {
  n: number
  name: string
  illustrated: boolean
  hint?: string
  rounds: Round[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    illustrated: true,
    hint: 'Tocá el dibujo que significa lo contrario de la palabra.',
    rounds: [
      { prompt: 'GRANDE', answer: 'chico', decoys: ['alto', 'gordo', 'ancho'] },
      { prompt: 'DÍA', answer: 'noche', decoys: ['manana', 'tarde', 'invierno'] },
      { prompt: 'ARRIBA', answer: 'abajo', decoys: ['cerca', 'lejos', 'adelante'] },
      { prompt: 'LLENO', answer: 'vacio', decoys: ['limpio', 'sucio', 'nuevo'] },
      { prompt: 'ABIERTO', answer: 'cerrado', decoys: ['roto', 'nuevo', 'limpio'] },
      { prompt: 'CONTENTO', answer: 'triste', decoys: ['cansado', 'enojado', 'asustado'] },
      { prompt: 'RÁPIDO', answer: 'lento', decoys: ['fuerte', 'suave', 'ruidoso'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    illustrated: false,
    hint: 'A partir de acá, las palabras no tienen dibujo — vos ya sabés lo que significan.',
    rounds: [
      { prompt: 'LIMPIO', answer: 'sucio', decoys: ['roto', 'mojado', 'viejo'] },
      { prompt: 'NUEVO', answer: 'viejo', decoys: ['caro', 'lindo', 'grande'] },
      { prompt: 'CERCA', answer: 'lejos', decoys: ['arriba', 'adentro', 'afuera'] },
      { prompt: 'GORDO', answer: 'flaco', decoys: ['alto', 'joven', 'fuerte'] },
      { prompt: 'FRÍO', answer: 'caliente', decoys: ['mojado', 'seco', 'suave'] },
      { prompt: 'SUBIR', answer: 'bajar', decoys: ['entrar', 'salir', 'caminar'] },
      { prompt: 'ANCHO', answer: 'angosto', decoys: ['alto', 'bajo', 'largo'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    illustrated: false,
    hint: 'Estas palabras son más abstractas — pensalas un poco más antes de tocar.',
    rounds: [
      { prompt: 'BUENO', answer: 'malo', decoys: ['raro', 'aburrido', 'diferente'] },
      { prompt: 'FÁCIL', answer: 'difícil', decoys: ['rápido', 'largo', 'importante'] },
      { prompt: 'SIEMPRE', answer: 'nunca', decoys: ['ahora', 'después', 'antes'] },
      { prompt: 'MUCHO', answer: 'poco', decoys: ['algo', 'nada', 'todo'] },
      { prompt: 'TEMPRANO', answer: 'tarde', decoys: ['rápido', 'despacio', 'ayer'] },
      { prompt: 'IGUAL', answer: 'diferente', decoys: ['parecido', 'similar', 'extraño'] },
      { prompt: 'PRIMERO', answer: 'último', decoys: ['segundo', 'del medio', 'próximo'] },
    ],
  },
]

// Total antonym-round count across all 3 levels — every round resolves after
// its correct tap, so totalAttempts = mistakes + this.
const TOTAL_ROUNDS = LEVELS.reduce((sum, lvl) => sum + lvl.rounds.length, 0)

const IMAGES = import.meta.glob('../../../assets/desafio/games/los-opuestos/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

const LABELS: Record<string, string> = { manana: 'mañana', vacio: 'vacío' }
const labelFor = (id: string) => LABELS[id] ?? id

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

const HINTS = ['Ese no es el opuesto — probá con otro.', 'Casi. Pensá en la palabra contraria.', 'No es ese, ¡fijate de nuevo!']
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen vocabulario!']

export function LosOpuestos({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (round ? shuffle([round.answer, ...round.decoys]) : []), [round])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(id: string) {
    if (!round || solved || eliminated.has(id)) return
    if (id === round.answer) {
      setSolved(true)
      setHint(null)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
      }, 500)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see ElVuelto.tsx for
  // why: an effect-based reset lags one render behind, letting `done` read
  // stale-true right as levelIdx reaches the last level and firing
  // onComplete with garbage data.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra ronda" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when level 3's last antonym round resolves. A
  // full day restart (the wrap to level 1) gets a new roundKey, so a genuine
  // replay reports again; re-rendering while already done on level 3 does
  // not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuál es el opuesto?</h2>
            {level.hint && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
            {/* Count and bar on one row: they say the same thing, and the four
                answer tiles below need the height more than the repetition does. */}
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {currentIndex} de {order.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(currentIndex / order.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Prompt word */}
          <div className="mt-4 text-center sm:mt-6">
            <span className="inline-block rounded-2xl border-2 border-slate-200 bg-white px-8 py-3 text-3xl font-extrabold tracking-wide text-slate-800 sm:py-5 sm:text-4xl">
              {round.prompt}
            </span>
          </div>

          {/* Options */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6">
            {options.map((id) => {
              const isEliminated = eliminated.has(id)
              const isSolved = solved && id === round.answer
              const img = level.illustrated ? imgFor(id) : undefined
              return (
                <button
                  key={id}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(id)}
                  aria-label={labelFor(id)}
                  className={[
                    'transition focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    level.illustrated
                      ? 'flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 sm:min-h-[128px] sm:gap-2 sm:p-4'
                      : 'min-h-[64px] rounded-2xl border-2 px-4 py-3 text-lg font-bold sm:text-xl',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? level.illustrated
                          ? 'border-slate-200 bg-slate-50 opacity-40 grayscale'
                          : 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {level.illustrated && img && (
                    <img src={img} alt="" className="h-16 w-16 object-contain sm:h-20 sm:w-20" draggable={false} />
                  )}
                  <span className={level.illustrated ? 'text-base font-bold text-slate-700' : ''}>{labelFor(id)}</span>
                </button>
              )
            })}
          </div>

          {hint && !solved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
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
            ¡Encontraste los {order.length} opuestos — completaste el {level.name.toLowerCase()}!
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
