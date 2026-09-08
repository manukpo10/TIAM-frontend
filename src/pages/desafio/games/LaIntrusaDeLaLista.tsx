import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Search, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La intrusa de la lista" — memoria, discriminación de categoría. Sucesora
 * de QueFaltaEnLaLista.tsx (mecánica invertida a pedido explícito del
 * usuario): en vez de sacar UN elemento de la lista y preguntar cuál falta,
 * la lista completa se vuelve a mostrar entera, reordenada, MÁS una palabra
 * intrusa de la misma categoría que nunca estuvo en la lista original — el
 * jugador tiene que encontrar, tocando directamente sobre la lista
 * reaparecida, cuál de las palabras es la que no vio antes.
 * QueFaltaEnLaLista.tsx queda sin usar en ningún día, mismo criterio que el
 * resto del catálogo con mecánicas retiradas (ver CrucigramaDeCifras.tsx).
 *
 * Reutiliza casi toda la estructura del archivo anterior: mismo
 * ROUNDS_PER_LEVEL = [2, 2, 2], mismo N_BY_LEVEL = [4, 5, 6] (tamaño de la
 * lista a memorizar), mismos LEVELS de timing de estudio. Lo único que
 * cambia es qué se muestra y qué se toca en la fase de test: antes había una
 * lista de referencia (de sólo lectura) + 3 opciones de múltiple choice
 * separadas; ahora la lista reaparecida ENTERA (N+1 palabras) es la única
 * superficie de respuesta — cada palabra es tocable, y encontrar la intrusa
 * es la respuesta correcta. Mismo patrón de toque-y-reintentá que el resto
 * del catálogo: un toque equivocado sólo atenúa esa opción + una pista
 * suave, nunca termina la ronda — así que totalAttempts = mistakes +
 * TOTAL_ROUNDS sigue siendo válido sin cambios (6 rondas con éxito
 * garantizado).
 *
 * Pantalla "¿Listo?" de una sola vez con las instrucciones generales; el
 * temporizador de estudio (uno por ronda, no por nivel) queda gateado a
 * `phase === 'study'`, mismo motivo que el resto de esta tanda de 4 días
 * hermanos (ListaConParecidas/RecordaLosDetalles/FluenciaConRecuerdo).
 *
 * Contenido bien liviano por ronda (4-6 palabras de estudio, 5-7 en la fase
 * de test) — mismo presupuesto de mobile que el archivo anterior, sin
 * riesgo de scroll.
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
  studyList: string[] // los N elementos a memorizar en la fase de estudio
  testList: string[] // los mismos N elementos reordenados + 1 intrusa, mezclados
  intruder: string // la palabra agregada — respuesta correcta
}

function buildRoundContent(category: CategoryPool, n: number): RoundContent {
  const studyList = pick(category.items, n)
  const remaining = category.items.filter((it) => !studyList.includes(it))
  const intruder = pickOne(remaining)
  const testList = shuffle([...studyList, intruder])
  return { categoryName: category.name, studyList, testList, intruder }
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

const HINTS = [
  'Esa palabra ya estaba en la lista — buscá la que no estaba antes.',
  'Casi. Repasá cuáles palabras viste en la lista original.',
  'Esa no es la intrusa — pensá cuál palabra es nueva.',
]
const PRAISE_PERFECT = ['¡Perfecto, sin ayuda!', '¡Excelente memoria!', '¡Así se hace!']
const PRAISE_GOOD = ['¡Muy bien, completaste el nivel!', '¡Bien ahí, seguís mejorando!']

type Phase = 'ready' | 'study' | 'test'

export function LaIntrusaDeLaLista({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundIdx, setRoundIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Las 6 rondas (2 por nivel), decididas una vez por epoch, al montar —
  // así "Repetir" devuelve exactamente las
  // mismas listas y la misma intrusa.
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
  // feedback visual claro (la intrusa se resalta en verde, ver JSX), nunca
  // un temporizador silencioso.
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

  function guess(word: string) {
    if (phase !== 'test' || solved || eliminated.has(word)) return
    if (word === current.intruder) {
      setSolved(true)
      setHint(null)
      advance(roundIdx + 1 >= roundsInLevel)
    } else {
      setEliminated((prev) => new Set(prev).add(word))
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá la intrusa</h2>
            <p className="mt-2 text-base text-slate-500">
              Ronda {roundIdx + 1} de {roundsInLevel} — ¿cuál de estas palabras no estaba en la lista?
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
            Vas a memorizar una lista corta de palabras. Después te la voy a mostrar de nuevo, en otro orden y con una
            palabra de más — tenés que encontrar cuál es la intrusa que no estaba antes.
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
          {current.studyList.map((word) => (
            <div
              key={word}
              className="flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-slate-100 bg-white px-3 py-2.5 text-center"
            >
              <span className="text-base font-semibold text-slate-900 sm:text-lg">{word}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fase de test: la misma lista reordenada + la intrusa — toda la
          grilla es la superficie de respuesta, no hay opciones separadas. */}
      {!levelDone && phase === 'test' && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {current.testList.map((word) => {
              const isEliminated = eliminated.has(word)
              const isCorrectAndSolved = solved && word === current.intruder
              return (
                <button
                  key={word}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(word)}
                  className={[
                    'relative flex min-h-[48px] items-center justify-center rounded-2xl border-2 px-3 py-2.5 text-center transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectAndSolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span className="text-base font-semibold sm:text-lg">{word}</span>
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
