import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué oficio le queda?" — an aptitude-inference / social-reasoning game
 * (ejecutivas), replacing QueOficioEs (día 22) which tested lexical
 * retrieval (tool icon → profession word) — a genuinely different skill
 * from this one: here the clue is a short story about a person's habits or
 * childhood, and the task is inferring which profession fits their traits,
 * not naming an object. All content is original — inspired by a classic
 * "match the person to their job" worksheet FORMAT the user referenced,
 * but the characters, stories and specific decoys are written fresh for
 * this app, same policy as every other game here.
 *
 * Same "eliminate wrong, keep trying" pattern as QueOficioEs/DondeEsta
 * (never red, no timer). Options are shown as icon+label cards instead of
 * bare text — the story is the only clue, so a recognizable picture next
 * to each profession name helps recall it faster than text alone.
 *
 * Difficulty ramp: L1 stories are unambiguous with decoys from an
 * unrelated domain; L2 adds one same-domain "trap" profession per round;
 * L3 leans on decoys from the SAME trade/domain, so telling them apart
 * needs the one specific detail in the story, not just elimination by
 * category (same discipline as QueOficioEs's own L3).
 */

interface OficioRound {
  id: string
  vignette: string
  decoys: string[]
}
interface Level {
  n: number
  name: string
  hint?: string
  rounds: OficioRound[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    hint: 'Leé la historia y pensá qué oficio le queda mejor a esa persona.',
    rounds: [
      { id: 'medico', vignette: 'De chica, Marta jugaba a curar a sus muñecas con un termómetro de juguete y una venda.', decoys: ['cartero', 'panadero', 'carpintero'] },
      { id: 'bombero', vignette: 'Desde muy chico, a Raúl le fascinaban las sirenas y los camiones rojos que pasaban por su calle.', decoys: ['cocinero', 'costurera', 'peluquero'] },
      { id: 'veterinario', vignette: 'Tomás siempre traía a casa algún animal herido para cuidarlo hasta que se recuperara.', decoys: ['albanil', 'electricista', 'juez'] },
      { id: 'cocinero', vignette: 'A Elsa le encantaba ayudar a su mamá en la cocina, mezclando ingredientes para inventar postres nuevos.', decoys: ['bombero', 'carpintero', 'cartero'] },
      { id: 'peluquero', vignette: 'De adolescente, Marcelo le cortaba el pelo a todos sus primos, siempre con paciencia y buena mano.', decoys: ['verdulero', 'plomero', 'medico'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    hint: 'Ahora hay más de una opción parecida — fijate bien en los detalles de la historia.',
    rounds: [
      { id: 'electricista', vignette: 'Héctor siempre fue el que arreglaba todo en casa: un enchufe, un cable pelado, una lámpara que no prendía.', decoys: ['plomero', 'carpintero', 'verdulero'] },
      { id: 'panadero', vignette: 'Osvaldo aprendió a amasar con su abuela, y hasta hoy se despierta antes que nadie por el olor a horno recién prendido.', decoys: ['cocinero', 'costurera', 'juez'] },
      { id: 'juez', vignette: 'Graciela siempre resolvía los conflictos entre sus hermanos con calma, escuchando primero a cada uno antes de decidir.', decoys: ['medico', 'albanil', 'cartero'] },
      { id: 'carpintero', vignette: 'Ramón tenía mano para la madera desde chico — armaba juguetes con los restos que sobraban en el taller de su tío.', decoys: ['albanil', 'plomero', 'peluquero'] },
      { id: 'enfermero', vignette: 'Delia siempre fue la primera en socorrer a cualquiera que se lastimara en el patio del colegio.', decoys: ['medico', 'veterinario', 'bombero'] },
      { id: 'costurera', vignette: 'Beatriz heredó de su madre la costumbre de arreglarle la ropa a toda la familia, puntada por puntada.', decoys: ['peluquero', 'pintor', 'cartero'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    hint: 'Acá los oficios se parecen entre sí — la historia tiene una pista bien específica, buscala.',
    rounds: [
      { id: 'verdulero', vignette: 'Nélida sabía, con solo tocar un tomate, si estaba a punto o si convenía esperar unos días más — los vecinos le pedían consejo antes de comprar.', decoys: ['cocinero', 'panadero', 'peluquero'] },
      { id: 'pintor', vignette: 'Aníbal se pasaba horas mezclando colores hasta encontrar el tono exacto que el cliente le pedía para la pared del living.', decoys: ['albanil', 'carpintero', 'electricista'] },
      { id: 'enfermero', vignette: 'Marisa memorizaba sin esfuerzo la dosis exacta de cada remedio que el médico indicaba, y nunca fallaba al aplicar una inyección.', decoys: ['medico', 'veterinario', 'juez'] },
      { id: 'plomero', vignette: 'Walter reconocía, con solo escuchar el ruido de una canilla, si el problema era una junta floja o un caño roto.', decoys: ['electricista', 'albanil', 'carpintero'] },
      { id: 'costurera', vignette: 'Norma cosía a mano cada dobladillo con una puntada tan pareja que parecía hecha a máquina.', decoys: ['peluquero', 'pintor', 'juez'] },
      { id: 'cartero', vignette: 'Rodolfo memorizaba cada calle y atajo del barrio, y nunca entregaba una carta en la casa equivocada.', decoys: ['bombero', 'medico', 'verdulero'] },
    ],
  },
]

const PROFESSION_LABELS: Record<string, string> = {
  medico: 'Médico/a', enfermero: 'Enfermero/a', veterinario: 'Veterinario/a', bombero: 'Bombero/a',
  peluquero: 'Peluquero/a', panadero: 'Panadero/a', cocinero: 'Cocinero/a', verdulero: 'Verdulero/a',
  carpintero: 'Carpintero/a', albanil: 'Albañil', electricista: 'Electricista', plomero: 'Plomero/a',
  pintor: 'Pintor/a', costurera: 'Costurera', juez: 'Juez/a', cartero: 'Cartero/a',
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/oficio-ideal/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
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

const HINTS = [
  'Ese no es — releé la historia con calma.',
  'No, ese no. ¡Fijate de nuevo en los detalles!',
  'Casi. Pensá qué costumbre o gusto tiene esa persona.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena lectura!']

export function OficioIdeal({ day: _day, onComplete }: GameProps) {
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
  const [roundOk, setRoundOk] = useState(PRAISE[0])
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (see
  // nextLevel's wrap branch below) — same per-round attempt model as
  // QueOficioEs.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, correctCount])

  const options = useMemo(() => (round ? shuffle([round.id, ...round.decoys]) : []), [round])

  // Correct-tap only marks solved and waits for "Seguir" — no auto-advance
  // timer, matching every other per-round reveal in this app.
  function guess(id: string) {
    if (!round || solved || eliminated.has(id)) return
    if (id === round.id) {
      setSolved(true)
      setRoundOk(pickOne(PRAISE))
      setHint(null)
      setCorrectCount((c) => c + 1)
    } else {
      setEliminated((prev) => new Set(prev).add(id))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }
  function nextRound() {
    setCurrentIndex((i) => i + 1)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
  }

  // Resets happen HERE, synchronously with the level/round change — same
  // reasoning as QueOficioEs/ElVuelto: an effect-based reset lags one
  // render behind, letting `done` read stale-true right as levelIdx
  // reaches the last level and firing onComplete with garbage.
  //
  // "Siguiente nivel"/"Otra ronda" are BOTH shown on every level completion
  // (not just the last), same as QueOficioEs — there's no partial-pool
  // "epoch" selection to preserve here (every round in a level always
  // shows, just reshuffled), so "otra ronda" simply reshuffles the current
  // level without touching levelIdx or the accumulators.
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

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
          {level.name}
        </span>
        {!done && (
          <>
            {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                style={{ width: `${(currentIndex / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && !solved && (
        <>
          {/* Vignette clue */}
          <div className="mt-6 rounded-2xl border-2 border-slate-100 bg-slate-50 p-5">
            <p className="text-center text-lg font-medium text-slate-700">{round.vignette}</p>
          </div>

          {/* Options — icon + label cards, 2 columns even on mobile so the
              board never forces a scroll (Scene fixed-px lesson from
              DondeEsta applied from the start here). */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {options.map((id) => {
              const isEliminated = eliminated.has(id)
              const img = imgFor(id)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isEliminated}
                  onClick={() => guess(id)}
                  className={[
                    'flex flex-col items-center gap-1 rounded-2xl border-2 bg-white p-2 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 opacity-40'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <div className="flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
                    {img && (
                      <img
                        src={img}
                        alt=""
                        className={['h-full w-full object-contain', isEliminated ? 'opacity-60 saturate-50' : ''].join(' ')}
                        draggable={false}
                      />
                    )}
                  </div>
                  <span
                    className={[
                      'text-center text-sm font-bold sm:text-base',
                      isEliminated ? 'text-slate-400 line-through' : 'text-slate-700',
                    ].join(' ')}
                  >
                    {PROFESSION_LABELS[id] ?? id}
                  </span>
                </button>
              )
            })}
          </div>

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Round-correct card — explicit "Seguir" button, no timer. */}
      {!done && solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900">{roundOk}</p>
          <button
            type="button"
            onClick={nextRound}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Seguir
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste los {order.length} oficios — completaste el {level.name.toLowerCase()}!
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
