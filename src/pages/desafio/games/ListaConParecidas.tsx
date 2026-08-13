import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, Minus, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Lista con parecidas" — memoria, discriminación fina. Mismo motor de
 * estudio → tablero oculto → reconocimiento que ListaDelMercado.tsx (y su
 * `buildWithLures`), pero el contenido son PALABRAS de 15 "familias"
 * fonéticamente parecidas (p. ej. cigarro/cigarrillo/colilla) en vez de
 * categorías de objetos — el juego no es memoria bruta, es notar que la
 * palabra que tenés enfrente NO es la que viste, aunque se le parezca mucho.
 *
 * Pantalla "¿Listo?" de una sola vez (nunca vuelve a 'ready') con las
 * instrucciones generales — el temporizador de estudio queda gateado a
 * `phase === 'study'` (a diferencia de ListaDelMercado, que arranca su
 * temporizador apenas monta) para que no corra un solo segundo mientras el
 * jugador todavía está leyendo la pantalla previa.
 *
 * Sin capa de "rondas" dentro del nivel — mismo criterio que ListaDelMercado/
 * QuienEsQuien (mis 2 hermanos de referencia con esta mecánica exacta):
 * una lista de 5-8 palabras para estudiar más un tablero de reconocimiento de
 * hasta 12 casilleros ya son bastantes más interacciones que la "1 pregunta
 * por ronda" que calibró el estándar de 2 rondas/nivel en otros juegos del
 * catálogo (ver comentario de ROUNDS_PER_LEVEL en ElDescuento.tsx) — así que
 * un nivel completo ES la ronda acá, no hace falta duplicar el ciclo.
 *
 * Tablero tope en 12 casilleros (igual que el techo probado de
 * ListaDelMercado) para entrar sin scroll en 375×812 — los casilleros acá son
 * chips de texto (min-h-48px) en vez de tarjetas con imagen (min-h-76px), así
 * que hay más margen, pero el techo se mantiene igual por las dudas.
 */

interface WordItem {
  id: string
  label: string
  clusterId: number
}

// 15 familias de palabras que arrancan/suenan muy parecido pero significan
// cosas distintas. El pool completo sirve tanto para estudiar como para
// generar señuelos "trampa" del mismo clúster (ver buildL3).
const CLUSTERS: string[][] = [
  ['cigarro', 'cigarrillo', 'colilla'],
  ['malvón', 'manzana', 'mantel'],
  ['cuchara', 'cuchillo', 'cuchilla'],
  ['camino', 'camión', 'camiseta'],
  ['pastilla', 'pastel', 'pasillo'],
  ['hermano', 'hermoso', 'hebilla'],
  ['cartera', 'carpeta', 'carreta'],
  ['botón', 'botella', 'bombilla'],
  ['almohada', 'almeja', 'almendra'],
  ['ventana', 'ventilador', 'ventaja'],
  ['cocina', 'cocinero', 'colchón'],
  ['zapato', 'zapallo', 'zapatilla'],
  ['peluche', 'peluca', 'pelusa'],
  ['limón', 'limpio', 'limosna'],
  ['jarra', 'jardín', 'jamón'],
]

const WORDS: WordItem[] = CLUSTERS.flatMap((cluster, clusterId) =>
  cluster.map((label) => ({ id: label, label, clusterId })),
)
const byCluster = (clusterId: number) => WORDS.filter((w) => w.clusterId === clusterId)
const CLUSTER_IDS = WORDS.reduce<number[]>((ids, w) => (ids.includes(w.clusterId) ? ids : [...ids, w.clusterId]), [])

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)

interface Round {
  studied: WordItem[]
  distractors: WordItem[]
}

// L1: 5 palabras de 5 clústeres distintos; señuelos de clústeres NO tocados
// — suenan totalmente distinto, rechazo fácil que genera confianza.
function buildL1(): Round {
  const clusterIds = pick(CLUSTER_IDS, 5)
  const studied = clusterIds.map((cid) => pick(byCluster(cid), 1)[0])
  const usedIds = new Set(clusterIds)
  const otherClusterIds = CLUSTER_IDS.filter((cid) => !usedIds.has(cid))
  const distractors = pick(otherClusterIds, 3).map((cid) => pick(byCluster(cid), 1)[0])
  return { studied, distractors }
}

// L2: 7 palabras al azar de todo el pool; señuelos también al azar del resto
// — sin apuntar todavía a parecidos, mismo paso intermedio que ListaDelMercado
// entre su L1 fácil y su L3 con señuelos deliberados.
function buildL2(): Round {
  const studied = pick(WORDS, 7)
  const studiedIds = new Set(studied.map((w) => w.id))
  const distractors = pick(
    WORDS.filter((w) => !studiedIds.has(w.id)),
    3,
  )
  return { studied, distractors }
}

// L3: 8 palabras de 8 clústeres distintos; señuelos son la palabra HERMANA de
// ese mismo clúster (nunca mostrada) — el par "trampa" que pide el brief.
// Adaptado de buildWithLures en ListaDelMercado.tsx, a nivel de clúster de
// palabra en vez de categoría de producto.
function buildL3(): Round {
  const clusterIds = pick(CLUSTER_IDS, 8)
  const studied = clusterIds.map((cid) => pick(byCluster(cid), 1)[0])
  const studiedIds = new Set(studied.map((w) => w.id))
  const distractors: WordItem[] = []
  for (const word of shuffle(studied)) {
    if (distractors.length >= 4) break
    const siblings = byCluster(word.clusterId).filter((w) => !studiedIds.has(w.id))
    if (siblings.length > 0) distractors.push(pick(siblings, 1)[0])
  }
  return { studied, distractors }
}

interface Level {
  n: number
  name: string
  studySeconds: number
  minEarlySeconds: number
  build: () => Round
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', studySeconds: 20, minEarlySeconds: 8, build: buildL1 },
  { n: 2, name: 'Nivel 2', studySeconds: 26, minEarlySeconds: 10, build: buildL2 },
  { n: 3, name: 'Nivel 3', studySeconds: 32, minEarlySeconds: 12, build: buildL3 },
]

const PRAISE_GOOD = ['¡Excelente ojo!', '¡Muy bien!', '¡Así se hace!', '¡Qué buena atención al detalle!']
const PRAISE_OK = [
  '¡Buen intento! Estas palabras son bien parecidas entre sí, así que cuesta.',
  '¡Bien ahí! Con la práctica se distinguen cada vez mejor.',
]

type Phase = 'ready' | 'study' | 'test' | 'results'

export function ListaConParecidas({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Una Round (estudiadas + señuelos) por nivel, decidida una vez por epoch —
  // al montar y de nuevo sólo en restartDifferent() — nunca al revisitar un
  // nivel, así "Repetir" devuelve exactamente la misma lista.
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => lvl.build()))
  const round = epochRounds[levelIdx]
  const testBoard = useMemo(() => shuffle([...round.studied, ...round.distractors]), [round])
  const targetIds = useMemo(() => new Set(round.studied.map((w) => w.id)), [round])

  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // El tablero de resultados (acierto/faltó/no-estaba) se ve primero; la
  // tarjeta de nivel completo (con "siguiente nivel"/reinicio) espera a que
  // esto sea true — sólo lo pone el botón "ya las vi, continuar", sin
  // temporizador, al ritmo del jugador.
  const [resultsSeen, setResultsSeen] = useState(false)
  // Acumulado a través de los 3 niveles (y de cualquier repetición del mismo
  // nivel — toda entrega cuenta), sólo se pone en cero en restartEpoch (un
  // reinicio real del día).
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // Temporizador de estudio + botón de continuar anticipado. A diferencia de
  // ListaDelMercado (arranca apenas monta), acá queda gateado a
  // `phase === 'study'`: mientras `phase` es 'ready' el efecto no arma nada,
  // así ni un segundo corre antes de que el jugador toque "Empezar". Vuelve a
  // dispararse cada vez que se entra a 'study' de nuevo (siguiente nivel o
  // reinicio) porque `phase`/`levelIdx`/`roundKey` están en las dependencias.
  const autoTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (phase !== 'study') return
    const floorTimer = window.setTimeout(() => setCanContinueEarly(true), level.minEarlySeconds * 1000)
    const autoTimer = window.setTimeout(() => setPhase('test'), level.studySeconds * 1000)
    autoTimerRef.current = autoTimer
    return () => {
      window.clearTimeout(floorTimer)
      window.clearTimeout(autoTimer)
    }
  }, [phase, levelIdx, roundKey, level.minEarlySeconds, level.studySeconds])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const correctFound = useMemo(() => [...selected].filter((id) => targetIds.has(id)).length, [selected, targetIds])

  function submit() {
    const ratio = targetIds.size ? correctFound / targetIds.size : 0
    const pool = ratio >= 0.6 ? PRAISE_GOOD : PRAISE_OK
    setPraise(pool[Math.floor(Math.random() * pool.length)])
    setPhase('results')
    const missed = targetIds.size - correctFound
    const falsePositives = selected.size - correctFound
    setAccMistakes((m) => m + missed + falsePositives)
    setAccAttempts((a) => a + testBoard.length)
  }

  // Los resets pasan ACÁ, sincrónicos con el cambio de nivel/ronda — un
  // efecto separado llega un render tarde y podría leer estado del nivel
  // anterior como si fuera del nuevo (mismo motivo que ElVuelto.tsx).

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setPhase('study')
    setSelected(new Set())
    setCanContinueEarly(false)
    setResultsSeen(false)
  }

  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setPhase('study')
    setSelected(new Set())
    setCanContinueEarly(false)
    setResultsSeen(false)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => lvl.build()))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (phase === 'results' && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levelIdx, roundKey, accMistakes, accAttempts])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Memorizá la lista</h2>
            <p className="mt-2 text-base text-slate-500">Fijate bien, algunas palabras se parecen entre sí.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-blue"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {phase === 'test' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuáles palabras viste?</h2>
            <p className="mt-2 text-base text-slate-500">
              Ojo con las parecidas: tocá sólo las que estaban en la lista original.
            </p>
          </>
        )}

        {phase === 'results' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Encontraste {correctFound} de {targetIds.size}
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez, saca las instrucciones generales del
          header persistente (ver encabezado del archivo). */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Eye className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a memorizar una lista de palabras. Después te voy a mostrar otras muy parecidas mezcladas con las
            verdaderas, y vas a tener que reconocer cuáles eran las que realmente estaban en la lista.
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

      {/* Tablero — chips de texto, sigue visible durante 'results' hasta que
          resultsSeen también sea true, para que las medallitas de abajo se
          alcancen a ver antes de pasar a la tarjeta de nivel completo. */}
      {phase !== 'ready' && (phase !== 'results' || !resultsSeen) && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(phase === 'study' ? round.studied : testBoard).map((w) => {
            const isSelected = selected.has(w.id)
            const isTarget = targetIds.has(w.id)

            let badge: 'hit' | 'missed' | 'false-positive' | null = null
            if (phase === 'results') {
              if (isTarget && isSelected) badge = 'hit'
              else if (isTarget && !isSelected) badge = 'missed'
              else if (!isTarget && isSelected) badge = 'false-positive'
            }

            return (
              <button
                key={w.id}
                type="button"
                disabled={phase !== 'test'}
                onClick={() => toggleSelect(w.id)}
                aria-label={w.label}
                aria-pressed={phase === 'test' ? isSelected : undefined}
                className={[
                  'relative flex min-h-[48px] items-center justify-center rounded-2xl border-2 bg-white px-3 py-2.5 text-center transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  phase === 'test' ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                  badge === 'hit' ? 'border-tiam-green ring-2 ring-tiam-green/30' : '',
                  badge === 'missed' ? 'border-tiam-blue ring-2 ring-tiam-blue/30' : '',
                  badge === 'false-positive' ? 'border-slate-200 opacity-50' : '',
                  !badge && phase === 'results' ? 'border-slate-100' : '',
                  !badge && phase !== 'results' && isSelected ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                  !badge && phase !== 'results' && !isSelected ? 'border-slate-200' : '',
                ].join(' ')}
              >
                <span className="text-base font-semibold leading-tight text-slate-700 sm:text-lg">{w.label}</span>

                {badge === 'hit' && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
                {badge === 'missed' && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-blue text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                )}
                {badge === 'false-positive' && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-white shadow">
                    <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Resultados: leyenda + continuar explícito, sin temporizador. */}
      {phase === 'results' && !resultsSeen && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              Acertaste
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-blue text-white">
                <Eye className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              También estaba
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-white">
                <Minus className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              No estaba
            </span>
          </div>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setResultsSeen(true)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Ya las vi, continuar
            </button>
          </div>
        </div>
      )}

      {/* Estudio: botón de continuar anticipado. */}
      {phase === 'study' && (
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

      {/* Test: entregar */}
      {phase === 'test' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={submit}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Listo, ya elegí
          </button>
        </div>
      )}

      {/* Resultados: avance de nivel/epoch */}
      {phase === 'results' && resultsSeen && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
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
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Hacer otro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
