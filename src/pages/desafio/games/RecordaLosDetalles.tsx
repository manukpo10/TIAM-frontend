import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Brain, Check, Eye, Minus, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Recordá los detalles" — memoria, ligada al detalle (attribute binding).
 * Mismo motor que ListaDelMercado.tsx (estudio cronometrado → tablero oculto
 * → reconocimiento con señuelos), elegido en vez del motor de Memotest.tsx
 * porque el día 2 (ListaConParecidas.tsx) ya cubre memoria de reconocimiento
 * puro — acá la dificultad no es "¿viste esta palabra?" sino "¿el objeto que
 * viste tenía ESTE detalle o uno distinto?": cada objeto (paraguas, bufanda,
 * reloj...) tiene 3 variantes de detalle posibles, se estudia UNA, y los
 * señuelos más difíciles son el MISMO objeto con el detalle cambiado — un
 * fenómeno de memoria distinto (ligar un atributo a un objeto) del que pide
 * el día 2 (discriminar palabras parecidas entre sí), aunque comparten motor.
 *
 * Pantalla "¿Listo?" de una sola vez (nunca vuelve a 'ready'); el temporizador
 * de estudio queda gateado a `phase === 'study'` por la misma razón que en
 * ListaConParecidas.tsx: que no corra mientras se lee la pantalla previa.
 *
 * Sin capa de "rondas" dentro del nivel, mismo criterio que ListaConParecidas/
 * ListaDelMercado/QuienEsQuien: un nivel completo (estudiar la lista + un
 * único tablero de reconocimiento) ya es la unidad de juego.
 *
 * Tablero tope en 12 casilleros (chips de texto, min-h-48px) — mismo techo
 * probado que ListaDelMercado/ListaConParecidas para entrar sin scroll en
 * 375×812.
 */

interface DetailItem {
  id: string
  object: string
  detail: string
  label: string
}

// 15 objetos, cada uno con 3 variantes de detalle posibles. Sólo UNA variante
// por objeto se estudia por ronda — las otras dos quedan disponibles como
// señuelos "mismo objeto, detalle cambiado" (ver buildL3).
const OBJECT_DETAILS: Record<string, string[]> = {
  paraguas: ['rojo', 'azul', 'a lunares'],
  bufanda: ['a rayas', 'celeste', 'tejida'],
  reloj: ['dorado', 'plateado', 'digital'],
  cartera: ['de cuero', 'de tela', 'marrón'],
  taza: ['celeste', 'floreada', 'verde'],
  pañuelo: ['bordado', 'de seda', 'a cuadros'],
  boina: ['gris', 'negra', 'marrón'],
  anteojos: ['de sol', 'de lectura', 'negros'],
  billetera: ['marrón', 'negra', 'trenzada'],
  gorro: ['de lana', 'de algodón', 'con borla'],
  cinturón: ['negro', 'marrón', 'ancho'],
  guantes: ['de lana', 'de cuero', 'negros'],
  collar: ['de perlas', 'dorado', 'de piedras'],
  pulsera: ['plateada', 'de cuentas', 'dorada'],
  bastón: ['de madera', 'plegable', 'con mango curvo'],
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const ITEMS: DetailItem[] = Object.entries(OBJECT_DETAILS).flatMap(([object, details]) =>
  details.map((detail) => ({ id: `${object}-${detail}`, object, detail, label: `${capitalize(object)} ${detail}` })),
)
const OBJECTS = Object.keys(OBJECT_DETAILS)
const byObject = (object: string) => ITEMS.filter((it) => it.object === object)

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
  studied: DetailItem[]
  distractors: DetailItem[]
}

// L1: 5 objetos distintos; señuelos son OTROS objetos nunca mostrados —
// fáciles de rechazar porque ni el objeto coincide.
function buildL1(): Round {
  const objects = pick(OBJECTS, 5)
  const studied = objects.map((o) => pick(byObject(o), 1)[0])
  const usedObjects = new Set(objects)
  const otherObjects = OBJECTS.filter((o) => !usedObjects.has(o))
  const distractors = pick(otherObjects, 3).map((o) => pick(byObject(o), 1)[0])
  return { studied, distractors }
}

// L2: 7 objetos distintos; señuelos al azar del resto del pool — pueden
// coincidir por casualidad con el objeto de alguno estudiado (detalle
// cambiado), pero no está garantizado. Paso intermedio, mismo criterio que
// ListaConParecidas.tsx.
function buildL2(): Round {
  const objects = pick(OBJECTS, 7)
  const studied = objects.map((o) => pick(byObject(o), 1)[0])
  const studiedIds = new Set(studied.map((it) => it.id))
  const distractors = pick(
    ITEMS.filter((it) => !studiedIds.has(it.id)),
    3,
  )
  return { studied, distractors }
}

// L3: 8 objetos distintos; señuelos son el MISMO objeto con el detalle
// cambiado siempre que quede una variante libre — la trampa más difícil,
// porque hay que recordar el detalle exacto, no sólo el objeto.
function buildL3(): Round {
  const objects = pick(OBJECTS, 8)
  const studied = objects.map((o) => pick(byObject(o), 1)[0])
  const studiedIds = new Set(studied.map((it) => it.id))
  const distractors: DetailItem[] = []
  for (const item of shuffle(studied)) {
    if (distractors.length >= 4) break
    const siblings = byObject(item.object).filter((it) => !studiedIds.has(it.id))
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
  { n: 1, name: 'Nivel 1', studySeconds: 22, minEarlySeconds: 9, build: buildL1 },
  { n: 2, name: 'Nivel 2', studySeconds: 28, minEarlySeconds: 11, build: buildL2 },
  { n: 3, name: 'Nivel 3', studySeconds: 34, minEarlySeconds: 13, build: buildL3 },
]

const PRAISE_GOOD = ['¡Qué buena memoria para los detalles!', '¡Excelente!', '¡Así se hace!', '¡No se te escapa nada!']
const PRAISE_OK = [
  '¡Buen intento! El detalle exacto cuesta más que el objeto en sí.',
  '¡Bien ahí! Con la práctica se recuerdan cada vez más detalles.',
]

type Phase = 'ready' | 'study' | 'test' | 'results'

export function RecordaLosDetalles({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => lvl.build()))
  const round = epochRounds[levelIdx]
  const testBoard = useMemo(() => shuffle([...round.studied, ...round.distractors]), [round])
  const targetIds = useMemo(() => new Set(round.studied.map((it) => it.id)), [round])

  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [resultsSeen, setResultsSeen] = useState(false)
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // Gateado a `phase === 'study'` — ver ListaConParecidas.tsx para el motivo.
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

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx.

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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Memorizá los objetos</h2>
            <p className="mt-2 text-base text-slate-500">Fijate bien en cada detalle, no sólo en el objeto.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-green"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {phase === 'test' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuáles viste, con su detalle?</h2>
            <p className="mt-2 text-base text-slate-500">
              Ojo: el mismo objeto puede aparecer de nuevo, pero con el detalle cambiado.
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

      {/* Pantalla previa: única vez, instrucciones generales. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Brain className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver una lista de objetos, cada uno con un detalle particular — un color, una forma, un material.
            Después te voy a preguntar cuáles viste, pero ojo: algunas opciones van a tener el mismo objeto con el
            detalle cambiado.
          </p>
          <button
            type="button"
            onClick={() => setPhase('study')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-green px-6 font-semibold text-white transition hover:opacity-90"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tablero — chips de texto, sigue visible durante 'results' hasta
          resultsSeen. */}
      {phase !== 'ready' && (phase !== 'results' || !resultsSeen) && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(phase === 'study' ? round.studied : testBoard).map((it) => {
            const isSelected = selected.has(it.id)
            const isTarget = targetIds.has(it.id)

            let badge: 'hit' | 'missed' | 'false-positive' | null = null
            if (phase === 'results') {
              if (isTarget && isSelected) badge = 'hit'
              else if (isTarget && !isSelected) badge = 'missed'
              else if (!isTarget && isSelected) badge = 'false-positive'
            }

            return (
              <button
                key={it.id}
                type="button"
                disabled={phase !== 'test'}
                onClick={() => toggleSelect(it.id)}
                aria-label={it.label}
                aria-pressed={phase === 'test' ? isSelected : undefined}
                className={[
                  'relative flex min-h-[48px] items-center justify-center rounded-2xl border-2 bg-white px-3 py-2.5 text-center transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-green/40 focus:ring-offset-1',
                  phase === 'test' ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                  badge === 'hit' ? 'border-tiam-green ring-2 ring-tiam-green/30' : '',
                  badge === 'missed' ? 'border-tiam-blue ring-2 ring-tiam-blue/30' : '',
                  badge === 'false-positive' ? 'border-slate-200 opacity-50' : '',
                  !badge && phase === 'results' ? 'border-slate-100' : '',
                  !badge && phase !== 'results' && isSelected ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                  !badge && phase !== 'results' && !isSelected ? 'border-slate-200' : '',
                ].join(' ')}
              >
                <span className="text-base font-semibold leading-tight text-slate-700 sm:text-lg">{it.label}</span>

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
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-green px-6 font-semibold text-white transition hover:opacity-90"
            >
              Ya los vi, continuar
            </button>
          </div>
        </div>
      )}

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

      {phase === 'test' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={submit}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-green px-6 font-semibold text-white transition hover:opacity-90"
          >
            Listo, ya elegí
          </button>
        </div>
      )}

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
