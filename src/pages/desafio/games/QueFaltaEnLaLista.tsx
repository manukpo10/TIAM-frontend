import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Search, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Qué falta en la lista" — memoria, discriminación de categoría. Motor
 * distinto de los otros 3 días de esta tanda (ListaConParecidas/
 * RecordaLosDetalles/FluenciaConRecuerdo son todos estudio-de-lista-completa
 * + un único tablero de reconocimiento): acá cada RONDA es su propia lista
 * chica de una categoría (frutas, útiles escolares…), a la que se le saca UN
 * elemento — el jugador tiene que reconocer, entre 3 opciones (el que falta +
 * 2 señuelos de la MISMA categoría, nunca mostrados), cuál era.
 *
 * Sigue el patrón "VARIAS rondas por nivel" de ElVuelto/ElDescuento/
 * ElPasoAPaso (ROUNDS_PER_LEVEL = [2, 2, 2], igual al estándar por defecto
 * del catálogo) en vez del "un solo pase por nivel" de mis otros 3 hermanos
 * de esta tanda — acá cada ronda SÍ es una unidad chica y autocontenida (una
 * lista de 4-6 palabras + una pregunta de una sola respuesta), del mismo
 * porte que las rondas de esos juegos, así que no hace falta la excepción
 * que uso en ListaConParecidas.tsx.
 *
 * Reconocer cuál falta usa el mismo patrón de QuienEsQuien.tsx: acierto único
 * garantizado por toque-y-reintentá (un toque incorrecto sólo elimina esa
 * opción + pista suave, nunca termina la ronda), así que
 * totalAttempts = mistakes + TOTAL_ROUNDS (6 rondas con éxito garantizado).
 *
 * Pantalla "¿Listo?" de una sola vez con las instrucciones generales; el
 * temporizador de estudio (uno por RONDA, no por nivel) queda gateado a
 * `phase === 'study'`, mismo motivo que mis otros 3 hermanos de esta tanda.
 *
 * Contenido bien liviano por ronda (4-6 palabras + 3 opciones) — el juego más
 * chico de mobile-budget de los 4, sin riesgo de scroll.
 */

interface CategoryPool {
  name: string
  items: string[]
}

const CATEGORIES: CategoryPool[] = [
  { name: 'frutas', items: ['manzana', 'banana', 'naranja', 'pera', 'uva', 'durazno', 'ciruela', 'kiwi', 'sandía'] },
  {
    name: 'útiles escolares',
    items: ['lápiz', 'goma', 'regla', 'tijera', 'cartuchera', 'cuaderno', 'sacapuntas', 'plasticola', 'compás'],
  },
  { name: 'ropa de invierno', items: ['campera', 'bufanda', 'guantes', 'gorro', 'botas', 'pulóver', 'poncho', 'polar'] },
  { name: 'herramientas', items: ['martillo', 'destornillador', 'alicate', 'serrucho', 'taladro', 'tenaza', 'pinza', 'clavo'] },
  { name: 'animales de granja', items: ['vaca', 'chancho', 'oveja', 'gallina', 'caballo', 'pato', 'cabra', 'conejo'] },
  { name: 'muebles', items: ['silla', 'mesa', 'sillón', 'ropero', 'estante', 'escritorio', 'cómoda', 'banqueta'] },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface RoundContent {
  categoryName: string
  shown: string[] // los N-1 elementos que se vuelven a mostrar en la fase de test
  missing: string // el elemento sacado — respuesta correcta
  options: string[] // missing + 2 señuelos de la misma categoría, mezclados
}

function buildRoundContent(category: CategoryPool, n: number): RoundContent {
  const chosen = pick(category.items, n)
  const missingIdx = Math.floor(Math.random() * chosen.length)
  const missing = chosen[missingIdx]
  const shown = chosen.filter((_, i) => i !== missingIdx)
  const remaining = category.items.filter((it) => !chosen.includes(it))
  const decoys = pick(remaining, 2)
  const options = shuffle([missing, ...decoys])
  return { categoryName: category.name, shown, missing, options }
}

// 2 rondas por nivel — el default del catálogo (ver ElDescuento.tsx) — 6
// rondas en total, cada una con una categoría DISTINTA (exactamente las 6
// definidas arriba, sin repetir dentro del epoch).
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
const N_BY_LEVEL = [4, 5, 6]

function buildEpoch(): RoundContent[][] {
  const categoryOrder = shuffle(CATEGORIES)
  let catIdx = 0
  return N_BY_LEVEL.map((n, levelIdx) => {
    const roundsForLevel: RoundContent[] = []
    for (let r = 0; r < ROUNDS_PER_LEVEL[levelIdx]; r++) {
      roundsForLevel.push(buildRoundContent(categoryOrder[catIdx], n))
      catIdx++
    }
    return roundsForLevel
  })
}

interface Level {
  n: number
  name: string
  studySeconds: number
  minEarlySeconds: number
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', studySeconds: 10, minEarlySeconds: 4 },
  { n: 2, name: 'Nivel 2', studySeconds: 12, minEarlySeconds: 5 },
  { n: 3, name: 'Nivel 3', studySeconds: 14, minEarlySeconds: 6 },
]

const HINTS = ['Ese no era — pensá de nuevo.', 'Casi. Fijate bien en la lista.', 'No era ese — probá con otra opción.']
const PRAISE_PERFECT = ['¡Perfecto, sin ayuda!', '¡Excelente memoria!', '¡Así se hace!']
const PRAISE_GOOD = ['¡Muy bien, completaste el nivel!', '¡Bien ahí, seguís mejorando!']

type Phase = 'ready' | 'study' | 'test'

export function QueFaltaEnLaLista({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundIdx, setRoundIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Las 6 rondas (2 por nivel), decididas una vez por epoch, al montar —
  // así "Repetir" devuelve exactamente las
  // mismas listas y la misma pregunta.
  const [epochRounds] = useState(() => buildEpoch())
  const current = epochRounds[levelIdx][roundIdx]
  const roundsInLevel = ROUNDS_PER_LEVEL[levelIdx]
  const levelDone = roundIdx >= roundsInLevel

  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE_PERFECT[0])
  const [levelMistakes, setLevelMistakes] = useState(0)
  // Acumulado a través de los 3 niveles, sólo se pone en cero en
  // restartEpoch (un reinicio real del día).
  const [mistakes, setMistakes] = useState(0)

  // Gateado a `phase === 'study'` — mismo motivo que en mis otros 3 hermanos
  // de esta tanda: que no corra ni un segundo antes de tocar "Empezar".
  const autoTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (phase !== 'study' || levelDone) return
    const floorTimer = window.setTimeout(() => setCanContinueEarly(true), level.minEarlySeconds * 1000)
    const autoTimer = window.setTimeout(() => setPhase('test'), level.studySeconds * 1000)
    autoTimerRef.current = autoTimer
    return () => {
      window.clearTimeout(floorTimer)
      window.clearTimeout(autoTimer)
    }
  }, [phase, levelIdx, roundIdx, roundKey, levelDone, level.minEarlySeconds, level.studySeconds])

  // Avanza a la próxima ronda (o marca el nivel como terminado) 900ms después
  // de acertar — mismo patrón que QuienEsQuien.tsx: una pausa breve con
  // feedback visual claro (la opción correcta se resalta en verde, ver JSX),
  // nunca un temporizador silencioso.
  function advance(justSolvedLevel: boolean) {
    window.setTimeout(() => {
      const nextRoundIdx = roundIdx + 1
      setRoundIdx(nextRoundIdx)
      if (nextRoundIdx < roundsInLevel) {
        setPhase('study')
        setCanContinueEarly(false)
      }
      setEliminated(new Set())
      setSolved(false)
      setHint(null)
      if (justSolvedLevel) {
        setLevelPraise(levelMistakes === 0 ? pickOne(PRAISE_PERFECT) : pickOne(PRAISE_GOOD))
      }
    }, 900)
  }

  function guess(option: string) {
    if (phase !== 'test' || solved || eliminated.has(option)) return
    if (option === current.missing) {
      setSolved(true)
      setHint(null)
      advance(roundIdx + 1 >= roundsInLevel)
    } else {
      setEliminated((prev) => new Set(prev).add(option))
      setMistakes((m) => m + 1)
      setLevelMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx.

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPhase('study')
    setCanContinueEarly(false)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setLevelMistakes(0)
  }

  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setRoundKey((k) => k + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setLevelMistakes(0)
    setMistakes(0)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (levelDone && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelDone, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>

        {!levelDone && phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Memorizá la lista</h2>
            <p className="mt-2 text-base text-slate-500">
              Ronda {roundIdx + 1} de {roundsInLevel} — {current.categoryName}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-blue"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {!levelDone && phase === 'test' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">A esta lista le falta uno</h2>
            <p className="mt-2 text-base text-slate-500">
              Ronda {roundIdx + 1} de {roundsInLevel} — ¿cuál de las opciones era el que faltaba?
            </p>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez, instrucciones generales. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Search className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a memorizar una lista corta de palabras. Después te la voy a mostrar de nuevo, pero con una menos —
            tenés que reconocer, entre tres opciones, cuál era la que faltaba.
          </p>
          <button
            type="button"
            onClick={() => setPhase('study')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Fase de estudio: lista completa de la ronda. */}
      {!levelDone && phase === 'study' && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...current.shown, current.missing].map((word) => (
            <div
              key={word}
              className="flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-slate-100 bg-white px-3 py-2.5 text-center"
            >
              <span className="text-base font-semibold text-slate-900 sm:text-lg">{word}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fase de test: la lista sin el elemento que falta, de referencia. */}
      {!levelDone && phase === 'test' && (
        <>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {current.shown.map((word) => (
              <span
                key={word}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-base text-slate-500"
              >
                {word}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5">
            {current.options.map((option) => {
              const isEliminated = eliminated.has(option)
              const isCorrectAndSolved = solved && option === current.missing
              return (
                <button
                  key={option}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(option)}
                  className={[
                    'relative min-h-[52px] rounded-2xl border-2 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectAndSolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {option}
                  {isCorrectAndSolved && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Estudio: botón de continuar anticipado. */}
      {!levelDone && phase === 'study' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={!canContinueEarly}
            onClick={() => {
              window.clearTimeout(autoTimerRef.current)
              setPhase('test')
            }}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ya estoy list@, continuar
          </button>
        </div>
      )}

      {/* Nivel completo */}
      {levelDone && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">Completaste el {level.name.toLowerCase()}.</p>
          {levelIdx < LEVELS.length - 1 ? (
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
    </div>
  )
}
