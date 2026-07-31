import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Familia de palabras" — día 25 (mes 2), lenguaje. Una raíz (p. ej. PAN) y
 * 4 palabras derivadas de esa familia (panadero, panadería, panera,
 * panecillo); cada una se muestra casi completa, con sólo 2-3 letras finales
 * en blanco para completar tocando fichas de letra (nunca texto libre).
 *
 * Motor calcado de "¿Qué palabra se esconde?" (QuePalabraSeEsconde.tsx, día
 * 3 del mes 1): banco de fichas CON señuelos, tocar para ubicar en la ranura
 * siguiente, tocar una ficha puesta para sacarla, el chequeo compara el
 * STRING armado (nunca posición/identidad de ficha). Única diferencia real:
 * ahí la ranura era la palabra ENTERA vacía; acá la mayor parte de la
 * palabra ya está fija e impresa, y sólo el tramo final (2-3 casilleros)
 * es interactivo — el "banco" de cada palabra es chico (las letras
 * correctas del tramo + 1 señuelo) porque sólo hace falta llenar ese tramo.
 *
 * A diferencia de QuePalabraSeEsconde, acá el chequeo se dispara solo apenas
 * se llena el tramo — sin botón "Revisar" que el jugador deba descubrir por
 * su cuenta (mismo criterio anti-confusión de ArmaLasPalabras.tsx, día 1).
 * checkedRef evita que un doble-invoke de React 18 cuente el mismo intento
 * dos veces. Un intento incorrecto se avisa con una tarjeta naranja
 * prominente (nunca roja) en vez de texto chico gris — igual visibilidad que
 * el acierto.
 *
 * Cada palabra fue verificada para que NINGUNA reordenación de sus letras
 * correctas + el señuelo arme otra palabra real distinta (no sólo "no forme
 * una palabra fea": p. ej. el primer intento de ATERRIZAR con señuelo "N"
 * permitía leer Z-A-N como "aterrizan", una conjugación real — se cambió el
 * señuelo a "L" para evitarlo). Mismo cuidado que QuePalabraSeEsconde puso
 * en que ningún señuelo formara una palabra real por accidente.
 *
 * TODAS las palabras de un nivel se juegan en cada pasada, en orden
 * aleatorio (mismo criterio que QuePalabraSeEsconde, sin sub-muestreo: acá
 * el pool de cada nivel ES exactamente sus 4 palabras). La dificultad
 * escala por la raíz/derivación (PAN muy concreta → LIBRO cotidiana → TIERRA
 * con alternancia vocálica tierra/terr-, más abstracta), no por más
 * señuelos — 1 señuelo alcanza en los 3 niveles dado que el tramo en blanco
 * ya es corto (2-3 letras).
 */

interface DerivedWord {
  word: string
  fixed: string
  blank: string
  decoy: string
}
interface Level {
  n: number
  name: string
  root: string
  words: DerivedWord[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    root: 'PAN',
    words: [
      { word: 'PANADERO', fixed: 'PANADE', blank: 'RO', decoy: 'S' },
      { word: 'PANADERIA', fixed: 'PANADER', blank: 'IA', decoy: 'E' },
      { word: 'PANERA', fixed: 'PAN', blank: 'ERA', decoy: 'O' },
      { word: 'PANECILLO', fixed: 'PANECI', blank: 'LLO', decoy: 'S' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    root: 'LIBRO',
    words: [
      { word: 'LIBRERO', fixed: 'LIBRE', blank: 'RO', decoy: 'S' },
      { word: 'LIBRERIA', fixed: 'LIBRER', blank: 'IA', decoy: 'E' },
      { word: 'LIBRETA', fixed: 'LIBRE', blank: 'TA', decoy: 'S' },
      { word: 'LIBRETO', fixed: 'LIBRE', blank: 'TO', decoy: 'S' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    root: 'TIERRA',
    words: [
      { word: 'TERRENO', fixed: 'TERR', blank: 'ENO', decoy: 'I' },
      { word: 'TERRESTRE', fixed: 'TERRES', blank: 'TRE', decoy: 'A' },
      { word: 'ATERRIZAR', fixed: 'ATERRI', blank: 'ZAR', decoy: 'L' },
      { word: 'ENTERRAR', fixed: 'ENTERR', blank: 'AR', decoy: 'O' },
    ],
  },
]
// Cada nivel tiene la misma cantidad de palabras (4) — constante fija (4+4+4).
const TOTAL_WORDS = LEVELS.reduce((s, l) => s + l.words.length, 0)

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

interface Tile {
  id: number
  value: string
}
// Letras del tramo en blanco + 1 señuelo, todo barajado. Ids únicos por
// ficha para poder distinguir dos fichas del mismo valor.
function buildTiles(blank: string, decoy: string): Tile[] {
  const values = [...blank.split(''), decoy]
  return shuffle(values).map((value, id) => ({ id, value }))
}

const PRAISE_GOOD = ['¡Muy bien completada!', '¡Excelente, esa es la palabra!', '¡Así se hace!', '¡Perfecto!']
const NUDGE_MESSAGES = [
  'Todavía no. Fijate en la raíz y probá otro orden.',
  'Casi. Mirá qué letras faltan y volvé a intentar.',
  'Esa combinación no completa la palabra. Tocá una letra para sacarla y probá de nuevo.',
]

export function FamiliaDePalabras({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Orden aleatorio de las 4 palabras del nivel — no hay sub-muestreo, el
  // pool del nivel ES sus 4 palabras.
  const order = useMemo(
    () => shuffle(level.words),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [wordIdx, setWordIdx] = useState(0)
  const entry = order[wordIdx]

  // Fichas de la palabra actual (tramo en blanco + señuelo), estables dentro
  // de la palabra; se rearman al cambiar de palabra/nivel. `placedIds` se
  // resetea SINCRÓNICAMENTE en los handlers de abajo, nunca en un efecto —
  // misma disciplina que QuePalabraSeEsconde.tsx.
  const tiles = useMemo(
    () => buildTiles(entry.blank, entry.decoy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, wordIdx],
  )
  const [placedIds, setPlacedIds] = useState<number[]>([])
  const placed = placedIds.map((id) => tiles.find((t) => t.id === id)).filter((t): t is Tile => !!t)
  const bank = tiles.filter((t) => !placedIds.includes(t.id))
  const readyToCheck = placed.length === entry.blank.length

  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Errores acumulados a través de los niveles 1→2→3, sólo se ponen en cero
  // en un reinicio real del día (ver la rama isWrap de nextLevel). No hace
  // falta contador de aciertos aparte: totalAttempts se deriva como mistakes
  // + TOTAL_WORDS, ya que toda palabra termina resolviéndose bien.
  const [mistakes, setMistakes] = useState(0)

  const done = resolved && wordIdx >= order.length - 1

  function handlePlace(item: Tile) {
    if (resolved || placed.length >= entry.blank.length) return
    setHint(null)
    setPlacedIds((ids) => [...ids, item.id])
  }
  function handleUnplace(item: Tile) {
    if (resolved) return
    setHint(null)
    setPlacedIds((ids) => ids.filter((i) => i !== item.id))
  }

  // Auto-revisa apenas se llena el tramo en blanco — sin botón "Revisar"
  // que el jugador deba descubrir (mismo criterio anti-confusión de
  // ArmaLasPalabras.tsx, día 1). checkedRef recuerda qué combinación exacta
  // ya se revisó para que un doble-invoke de React 18 no cuente el mismo
  // intento dos veces.
  const checkedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!readyToCheck) {
      checkedRef.current = null
      return
    }
    const attemptKey = placedIds.join(',')
    if (checkedRef.current === attemptKey) return
    checkedRef.current = attemptKey

    const spelled = placed.map((item) => item.value).join('')
    if (spelled === entry.blank) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE_MESSAGES))
      setMistakes((m) => m + 1)
      // Las fichas quedan donde están — un error no borra lo ya puesto.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToCheck, placedIds])

  function nextWord() {
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setWordIdx((i) => i + 1)
  }
  // Resets sincrónicos acá mismo, nunca en un efecto separado keyed on
  // [levelIdx, roundKey] — llegaría un render tarde y el onComplete de abajo
  // leería `done` viejo justo al arrancar el nuevo nivel (misma disciplina
  // que QuePalabraSeEsconde).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setWordIdx(0)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setWordIdx(0)
    setRoundKey((k) => k + 1)
  }

  // Dispara una vez por roundKey cuando se resuelve la última palabra del
  // nivel 3.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base text-slate-500">
              Completá las palabras de la familia de{' '}
              <span className="font-bold text-tiam-blue">{level.root}</span>.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {wordIdx} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(wordIdx / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Palabra: letras fijas + tramo en blanco */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            {entry.fixed.split('').map((ch, i) => (
              <span
                key={`f-${i}`}
                className="flex h-11 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-100 text-xl font-extrabold uppercase text-slate-500"
              >
                {ch}
              </span>
            ))}
            {Array.from({ length: entry.blank.length }).map((_, i) => {
              const item = placed[i]
              if (!item) {
                return (
                  <span
                    key={`b-${i}`}
                    aria-hidden="true"
                    className="h-11 w-9 rounded-lg border-2 border-dashed border-slate-300 bg-white"
                  />
                )
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={resolved}
                  onClick={() => handleUnplace(item)}
                  aria-label={`Quitar letra ${item.value}`}
                  className={[
                    'flex h-11 w-9 items-center justify-center rounded-lg border-2 text-xl font-extrabold uppercase transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    resolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10',
                  ].join(' ')}
                >
                  {item.value}
                </button>
              )
            })}
          </div>

          {/* Banco de letras */}
          {!resolved && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlace(item)}
                  aria-label={`Letra ${item.value}`}
                  className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-2 text-xl font-extrabold uppercase text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {/* Tarjeta "todavía no" — tan visible como la de acierto, pegada al
              banco de letras. Nunca roja: naranja suave + ícono de
              reintentar. Se queda hasta que el jugador toca una ficha
              (handlePlace/handleUnplace ya limpian el hint), sin timer. */}
          {hint && !resolved && (
            <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                <RotateCcw className="h-6 w-6 text-tiam-orange" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">Todavía no es esa</p>
              <p className="mt-1 text-slate-600">{hint}</p>
            </div>
          )}
        </>
      )}

      {/* Resultado */}
      {resolved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Completaste <span className="font-semibold text-slate-800">{entry.word}</span>.
          </p>
          {done && <p className="mt-1 text-slate-600">Completaste el nivel {levelIdx + 1}.</p>}
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {done ? (
              <>
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
                  Otra palabra
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={nextWord}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente palabra
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
