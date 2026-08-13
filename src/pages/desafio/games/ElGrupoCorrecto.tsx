import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Boxes } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El grupo correcto" — día 29, ejecutivas. En el estilo de
 * CadaCosaEnSuGrupo.tsx (día 7): una palabra a la vez, tocá la categoría a
 * la que pertenece. Categorías y contenido completamente nuevos.
 *
 * Igual que el original: NO es un flujo de dos fases "tocar palabra, tocar
 * destino" — un solo toque es un juicio verificable al instante (correcto
 * avanza a la próxima palabra; incorrecto solo destella y reintenta, sin
 * penalidad que bloquee el avance).
 *
 * Nivel 3 reutiliza las mismas "Comidas" de nivel 1/2 pero las re-parte en 4
 * categorías más finas (Frutas / Lácteos / Panificados / Comida rápida) —
 * mismo giro que el original con los animales: las palabras ya conocidas
 * ahora piden una distinción real, no vocabulario nuevo.
 *
 * DIFERENCIA con el original en los botones de cierre: acá se sigue la
 * convención de todo este lote — nivel 1/2 completos muestran solo
 * "Siguiente nivel"; nivel 3 completo muestra "Repetir" (misma
 * distribución de palabras) y "Hacer otro" (una nueva), con onComplete
 * disparando una sola vez ahí. mistakes/correctCount se acumulan a través
 * de los 3 niveles y solo se ponen en cero en un reinicio real del día.
 *
 * Pantalla "¿Listo?" única vez al principio del día (mismo motivo de layout
 * que el original: el "cómo se juega" repetido en cada ronda, sumado a los
 * 4 botones apilados de nivel 3 más el recap "ordenado hasta ahora" (hasta
 * 20 palabras), desbordaba 375×812 — por eso el recap tiene su propio
 * scroll acotado en vez de empujar los botones fuera de pantalla.
 */

interface CategoryItem {
  word: string
  category: string
}
interface GroupLevel {
  n: number
  name: string
  categories: string[]
  items: CategoryItem[]
  hint?: string
}

const LEVELS: GroupLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    categories: ['Comidas', 'Muebles'],
    items: [
      { word: 'manzana', category: 'Comidas' },
      { word: 'pan', category: 'Comidas' },
      { word: 'queso', category: 'Comidas' },
      { word: 'torta', category: 'Comidas' },
      { word: 'pizza', category: 'Comidas' },
      { word: 'mesa', category: 'Muebles' },
      { word: 'silla', category: 'Muebles' },
      { word: 'sofá', category: 'Muebles' },
      { word: 'cama', category: 'Muebles' },
      { word: 'ropero', category: 'Muebles' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    categories: ['Comidas', 'Muebles', 'Herramientas'],
    items: [
      { word: 'manzana', category: 'Comidas' },
      { word: 'pan', category: 'Comidas' },
      { word: 'queso', category: 'Comidas' },
      { word: 'torta', category: 'Comidas' },
      { word: 'mesa', category: 'Muebles' },
      { word: 'silla', category: 'Muebles' },
      { word: 'sofá', category: 'Muebles' },
      { word: 'cama', category: 'Muebles' },
      { word: 'martillo', category: 'Herramientas' },
      { word: 'destornillador', category: 'Herramientas' },
      { word: 'taladro', category: 'Herramientas' },
      { word: 'serrucho', category: 'Herramientas' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    categories: ['Frutas', 'Lácteos', 'Panificados', 'Comida rápida'],
    hint: 'Ahora las comidas se dividen en 4 grupos más finos. ¡Fijate bien en cada uno!',
    items: [
      { word: 'manzana', category: 'Frutas' },
      { word: 'banana', category: 'Frutas' },
      { word: 'naranja', category: 'Frutas' },
      { word: 'pera', category: 'Frutas' },
      { word: 'uva', category: 'Frutas' },
      { word: 'queso', category: 'Lácteos' },
      { word: 'manteca', category: 'Lácteos' },
      { word: 'yogur', category: 'Lácteos' },
      { word: 'leche', category: 'Lácteos' },
      { word: 'crema', category: 'Lácteos' },
      { word: 'pan', category: 'Panificados' },
      { word: 'torta', category: 'Panificados' },
      { word: 'factura', category: 'Panificados' },
      { word: 'bizcochuelo', category: 'Panificados' },
      { word: 'galleta', category: 'Panificados' },
      { word: 'pizza', category: 'Comida rápida' },
      { word: 'hamburguesa', category: 'Comida rápida' },
      { word: 'sándwich', category: 'Comida rápida' },
      { word: 'empanada', category: 'Comida rápida' },
      { word: 'choripán', category: 'Comida rápida' },
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

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo!']
const ACCENT = '#4F46E5' // índigo

export function ElGrupoCorrecto({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Orden de palabras de cada nivel para ESTA epoch (las 3 niveles) —
  // decidido una vez al montar, y de nuevo solo en "Hacer otro". Nunca se
  // re-mezcla por revisitar un nivel, así "Repetir" devuelve exactamente el
  // mismo orden.
  const [epochOrder, setEpochOrder] = useState(() => LEVELS.map((lvl) => shuffle(lvl.items)))
  const level = LEVELS[levelIdx]
  const order = epochOrder[levelIdx]

  const [currentIndex, setCurrentIndex] = useState(0)
  const [sorted, setSorted] = useState<Record<string, string[]>>({})
  const [wrongCategory, setWrongCategory] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Acumulado a través de los 3 niveles; solo se pone en cero en un
  // reinicio real del día (ver restartEpoch) — igual criterio que el resto
  // de este lote.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const current = order[currentIndex]
  const done = currentIndex >= order.length

  const handleTapCategory = useCallback(
    (category: string) => {
      if (!current) return
      if (current.category === category) {
        setSorted((prev) => ({ ...prev, [category]: [...(prev[category] ?? []), current.word] }))
        setCurrentIndex((i) => i + 1)
        setCorrectCount((c) => c + 1)
        setWrongCategory(null)
      } else {
        setWrongCategory(category)
        setMistakes((m) => m + 1)
        window.setTimeout(() => setWrongCategory((w) => (w === category ? null : w)), 500)
      }
    },
    [current],
  )

  useEffect(() => {
    if (done) setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
  }, [done])

  // "Siguiente nivel" — avanza dentro del MISMO intento. epochOrder queda
  // como está: el orden del nivel i+1 ya se decidió al empezar esta epoch.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setCurrentIndex(0)
    setSorted({})
    setWrongCategory(null)
  }
  // Compartido por los dos botones de la tarjeta final de nivel 3 (solo se
  // ve una vez completado el nivel 3, así que siempre es un reinicio real
  // del día). roundKey siempre avanza acá: es el contador de "qué intento
  // es este" que usa el efecto de onComplete para disparar de nuevo en una
  // repetición, sin importar si el orden cambió.
  function restartEpoch() {
    setLevelIdx(0)
    setCurrentIndex(0)
    setSorted({})
    setWrongCategory(null)
    setMistakes(0)
    setCorrectCount(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — mismo orden de palabras que el intento recién terminado.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — un orden nuevo por nivel.
  function restartDifferent() {
    restartEpoch()
    setEpochOrder(LEVELS.map((lvl) => shuffle(lvl.items)))
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
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(currentIndex / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Boxes className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">Tocá el grupo correcto para cada palabra que aparezca.</p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && !done && current && (
        <>
          {/* Palabra actual */}
          <div className="mt-6 text-center">
            <span className="inline-block rounded-2xl border-2 border-slate-200 bg-white px-8 py-5 text-3xl font-extrabold capitalize text-slate-800 sm:text-4xl">
              {current.word}
            </span>
          </div>

          {/* Botones de categoría — piso de 56px, la grilla colapsa a 1
              columna en mobile (nivel 3 apila 4 filas), por eso 56px y no
              64px: alcanza y sobra para el mínimo de 44-48px de toque. */}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {level.categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleTapCategory(cat)}
                className={[
                  'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  wrongCategory === cat
                    ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300 text-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                ].join(' ')}
              >
                {cat}
                {(sorted[cat]?.length ?? 0) > 0 && (
                  <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-tiam-green/15 px-1.5 text-sm font-bold text-tiam-green">
                    {sorted[cat]?.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Ordenado hasta ahora — con su propio scroll: es lo único del
              archivo que crece sin límite a lo largo de una ronda (hasta 20
              palabras / 4 líneas en nivel 3), así que tiene techo de altura
              en vez de empujar los botones fuera de pantalla. */}
          {level.categories.some((cat) => (sorted[cat]?.length ?? 0) > 0) && (
            <div className="mt-4 flex max-h-32 flex-col gap-2 overflow-y-auto pr-1">
              {level.categories.map(
                (cat) =>
                  (sorted[cat]?.length ?? 0) > 0 && (
                    <p key={cat} className="text-sm text-slate-500">
                      <span className="font-semibold text-slate-700">{cat}:</span> {sorted[cat]?.join(', ')}
                    </p>
                  ),
              )}
            </div>
          )}

          {wrongCategory && <p className="mt-4 text-center text-base font-medium text-slate-500">Ese no va ahí, ¡probá con otro grupo!</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            ¡Agrupaste las {order.length} palabras — completaste el {level.name.toLowerCase()}!
          </p>
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
