import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Almacén de sílabas" — día 19 (mes 2), lenguaje. Un banco chico de fichas
 * de sílabas (algunas se repiten, otras son señuelos) que hay que unir, en
 * orden, para armar 4 nombres de animales escondidos.
 *
 * Motor calcado de "Armá las palabras" (ArmaLasPalabras.tsx, día 1 del mes
 * 1): TODAS las fichas del nivel se vuelcan a un mismo banco compartido; el
 * banco es DERIVADO (fichas del nivel menos las puestas menos las ya
 * consumidas por palabras encontradas), y cada palabra hallada "consume" sus
 * fichas del banco — así es como una sílaba puede aparecer en más de una
 * palabra (p. ej. "JO" en CONEJO y CANGREJO): son dos fichas físicas
 * distintas con el mismo texto, ids distintos, ninguna lógica especial hace
 * falta. Nunca cronómetro, nunca rojo; un chequeo incorrecto no reinicia el
 * banco (las fichas quedan puestas) — mismo contrato.
 *
 * Sin botón "Revisar": el chequeo se dispara solo apenas se llena la ranura,
 * igual que en ArmaLasPalabras — checkedRef evita que un doble-invoke de
 * React 18 cuente el mismo intento dos veces. Correcto: tarjeta "¡Correcto!"
 * breve que auto-avanza (~1.2s). Incorrecto: tarjeta naranja "Todavía no es
 * ese", nunca roja, que se queda hasta que el jugador toca una ficha.
 *
 * A diferencia de ArmaLasPalabras (fragmentos arbitrarios de 3 letras
 * verificados para no formar palabras reales por accidente), acá los
 * fragmentos son SÍLABAS reales de 2-3 letras (GA, TO, CO, NE, JO...), mucho
 * más "combinables" entre sí en español — un chequeo cruzado manual de nivel
 * 1 encontró que combinaciones tan inocentes como CA+GA formaban una palabra
 * real vulgar, y CA+CA otra real de tono infantil/vulgar. Por eso el set de
 * nivel 1 fue rediseñado específicamente para minimizar sílabas
 * "promiscuas" (se evitan sílabas ultra-comunes como CA/GA/TO/PA/NO/MO como
 * fichas duplicadas) — las únicas palabras reales que emergen de combinar
 * fichas fuera de las 4 palabras objetivo son sustantivos comunes e
 * inofensivos (RARO, MULO, MURO, LANA, LORA, LONA), nunca vulgares. Niveles
 * 2 y 3 usan sílabas de 3 letras, con mucho menos riesgo de choque porque
 * hacen falta 3 fragmentos alineados para deletrear algo real por accidente.
 *
 * UN solo set de palabras por nivel (sin variantes para reintentos, mismo
 * criterio que TuResumen.tsx/LasMismasLetras.tsx: rejugar sólo rebaraja el
 * orden de las fichas, no cambia qué animales hay que armar).
 *
 * Señuelos (DECOYS_PER_LEVEL/DECOY_POOL_PER_LEVEL, ver más abajo): de más en
 * el banco, ramping 1/2/3 por nivel — mismo objetivo que DECOYS_PER_LEVEL de
 * UnaLetraDeCadaUno.tsx (día 23), pero acá el pool es POR NIVEL en vez de
 * uno solo compartido. Cada sílaba señuelo es real en español pero NINGUNA
 * es sílaba real de este juego, y cada una fue chequeada a mano contra TODAS
 * las sílabas reales de su nivel (en ambos órdenes) para no repetir el
 * problema de CA+GA/CA+CA de arriba — dos señuelos quedaron afuera de un
 * nivel puntual por el mismo motivo (detalle junto a la constante). El
 * chequeo de completado sigue comparando el string armado contra la lista
 * de palabras, nunca la identidad de la ficha, así que un señuelo nunca
 * bloquea una respuesta correcta.
 */

interface AnimalEntry {
  word: string
  syllables: string[]
}
interface Level {
  n: number
  name: string
  syllablesPerWord: number
  words: AnimalEntry[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    syllablesPerWord: 2,
    words: [
      { word: 'BURRO', syllables: ['BU', 'RRO'] },
      { word: 'RANA', syllables: ['RA', 'NA'] },
      { word: 'MULA', syllables: ['MU', 'LA'] },
      { word: 'LORO', syllables: ['LO', 'RO'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    syllablesPerWord: 3,
    words: [
      { word: 'CONEJO', syllables: ['CO', 'NE', 'JO'] },
      { word: 'TORTUGA', syllables: ['TOR', 'TU', 'GA'] },
      { word: 'CANGREJO', syllables: ['CAN', 'GRE', 'JO'] },
      { word: 'JIRAFA', syllables: ['JI', 'RA', 'FA'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    syllablesPerWord: 4,
    words: [
      { word: 'ELEFANTE', syllables: ['E', 'LE', 'FAN', 'TE'] },
      { word: 'COCODRILO', syllables: ['CO', 'CO', 'DRI', 'LO'] },
      { word: 'MARIPOSA', syllables: ['MA', 'RI', 'PO', 'SA'] },
      { word: 'ARMADILLO', syllables: ['AR', 'MA', 'DI', 'LLO'] },
    ],
  },
]
// Cada nivel tiene la misma cantidad de palabras (4), así que esta suma es
// una constante fija (4+4+4).
const TOTAL_WORDS = LEVELS.reduce((s, l) => s + l.words.length, 0)

// Sílabas señuelo — de más en el banco, ramping por nivel. A diferencia de
// DECOY_POOL en UnaLetraDeCadaUno.tsx (letras sueltas, un solo pool
// compartido) acá el pool es POR NIVEL: cada sílaba señuelo es real en
// español pero NINGUNA es sílaba real de este juego (no pisa ninguna de las
// listas de arriba), y cada una fue chequeada a mano contra TODAS las
// sílabas reales de su nivel, en ambos órdenes, para que ninguna combinación
// arme una palabra real inapropiada — mismo cuidado que llevó a rediseñar el
// set de nivel 1 (ver comentario de archivo sobre CA+GA/CA+CA). FI queda
// afuera del pool de nivel 2 (FI+GA se acerca a un vulgarismo regional) y ZO
// afuera del de nivel 3 (ZO+TE arma "zote", insulto leve). Bajo a propósito
// en nivel 1: fragmentos de 2 letras son los que más fácil chocan.
const DECOYS_PER_LEVEL = [1, 2, 3]
const DECOY_POOL_PER_LEVEL: string[][] = [
  ['FE', 'VI', 'ZO', 'FI'], // nivel 1
  ['FE', 'VI', 'ZO'], // nivel 2
  ['FE', 'VI', 'FI'], // nivel 3
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

const NUDGES_WORD = [
  'Esa combinación no forma el nombre de un animal. Tocá una ficha para sacarla y probá otro orden.',
  'Todavía no. Probá juntar otras sílabas.',
  'Ese animal no es. Reacomodá las fichas y volvé a intentar.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']

interface Tile {
  id: number
  text: string
}

export function AlmacenDeSilabas({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const words = level.words

  // Todas las fichas del nivel: sílabas reales + señuelos, ids estables.
  const tiles: Tile[] = useMemo(() => {
    const real = words.flatMap((w) => w.syllables)
    const decoys = shuffle(DECOY_POOL_PER_LEVEL[levelIdx]).slice(0, DECOYS_PER_LEVEL[levelIdx])
    return [...real, ...decoys].map((text, id) => ({ id, text }))
  }, [words, levelIdx])
  const tileOrder = useMemo(
    () => shuffle(tiles.map((t) => t.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [placed, setPlaced] = useState<number[]>([]) // ids de fichas, en orden de ranura
  const [found, setFound] = useState<string[]>([]) // animales encontrados este nivel
  const [hint, setHint] = useState<string | null>(null)
  const [correctWord, setCorrectWord] = useState<string | null>(null) // tarjeta breve "¡Correcto!"
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // No hace falta contador de aciertos: cada animal siempre se resuelve, así
  // que el total de aciertos es la constante fija TOTAL_WORDS (mismo
  // razonamiento de suma fija que QuePalabraSeEsconde).
  const [mistakes, setMistakes] = useState(0)

  // Banco DERIVADO: fichas del nivel menos puestas menos consumidas por
  // animales ya encontrados.
  const consumedIds = useMemo(() => {
    const ids = new Set<number>()
    for (const w of found) {
      const entry = words.find((e) => e.word === w)
      entry?.syllables.forEach((s) => {
        const t = tiles.find((tl) => tl.text === s && !ids.has(tl.id))
        if (t) ids.add(t.id)
      })
    }
    return ids
  }, [found, words, tiles])
  const bank = tileOrder.filter((id) => !placed.includes(id) && !consumedIds.has(id))

  const done = found.length === words.length
  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  // ── handlers (todos funcionales + idempotentes, misma disciplina que
  // ArmaLasPalabras para que un doble-toque en el mismo batch de React no
  // desincronice el estado) ──────────────────────────────────────────────
  function place(id: number) {
    setHint(null)
    setPlaced((prev) => {
      if (prev.includes(id) || prev.length >= level.syllablesPerWord || consumedIds.has(id)) return prev
      return [...prev, id]
    })
  }
  function unplace(id: number) {
    setHint(null)
    setPlaced((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev))
  }
  // Auto-revisa apenas se llena la ranura — sin botón "Revisar" que el
  // jugador deba descubrir (mismo criterio anti-confusión de
  // ArmaLasPalabras.tsx, día 1, cuyo motor este juego clona). checkedRef
  // recuerda qué combinación exacta ya se revisó para que un doble-invoke de
  // React 18 no cuente el mismo error dos veces.
  const checkedRef = useRef<string | null>(null)
  useEffect(() => {
    if (placed.length !== level.syllablesPerWord) {
      checkedRef.current = null
      return
    }
    const attemptKey = placed.join(',')
    if (checkedRef.current === attemptKey) return
    checkedRef.current = attemptKey

    const attempt = placed.map((id) => tiles.find((t) => t.id === id)?.text ?? '').join('')
    const target = words.find((w) => w.word === attempt)
    if (target && !found.includes(target.word)) {
      setCorrectWord(target.word)
      const timer = setTimeout(() => {
        setFound((prev) => (prev.includes(target.word) ? prev : [...prev, target.word]))
        setPlaced([])
        setCorrectWord(null)
      }, 1200)
      return () => clearTimeout(timer)
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(NUDGES_WORD))
    // Las fichas quedan donde están — ajustar, no reiniciar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, level.syllablesPerWord])

  // Resets sincrónicos en el handler (nunca en un efecto keyed on [levelIdx]).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPlaced([])
    setFound([])
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Dispara una vez por roundKey cuando se encuentra el último animal del
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
            <p className="mt-2 text-base font-medium text-tiam-blue">
              Uní {level.syllablesPerWord} sílabas para formar el nombre de un animal. Hay {words.length} escondidos.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {found.length} de {words.length}
            </p>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Animales encontrados */}
          {found.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {found.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 rounded-full border border-tiam-green/30 bg-tiam-green/10 px-3 py-1 text-sm font-bold tracking-wide text-slate-800"
                >
                  <Check className="h-3.5 w-3.5 text-tiam-green" strokeWidth={3} />
                  {w}
                </span>
              ))}
            </div>
          )}

          {/* Tarjeta "¡Correcto!" — reemplaza la ranura mientras se confirma
              el animal solo, sin pedir ningún toque más (mismo patrón que
              ArmaLasPalabras.tsx, día 1). */}
          {correctWord ? (
            <div className="mt-4 rounded-2xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
                <CheckCircle2 className="h-7 w-7 text-tiam-green" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">¡Correcto!</p>
              <p className="mt-1 text-slate-600">Armaste {correctWord}.</p>
            </div>
          ) : (
            <>
              {/* Ranura de armado */}
              <div className="mt-4 flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                {placed.length === 0 && (
                  <span className="text-base text-slate-400">Tocá las sílabas de abajo para armar un animal</span>
                )}
                {placed.map((id) => {
                  const t = tiles.find((tl) => tl.id === id)!
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => unplace(id)}
                      aria-label={`Quitar sílaba ${t.text}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-4 text-xl font-extrabold tracking-wide text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                    >
                      {t.text}
                    </button>
                  )
                })}
              </div>

              {/* Tarjeta "todavía no" — tan visible como la de "¡Correcto!",
                  nunca roja: naranja suave + ícono de reintentar. Se queda
                  hasta que el jugador toca una ficha (place/unplace ya
                  limpian el hint). */}
              {hint && (
                <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                    <RotateCcw className="h-6 w-6 text-tiam-orange" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-slate-900">Todavía no es ese</p>
                  <p className="mt-1 text-slate-600">{hint}</p>
                </div>
              )}

              {/* Banco de sílabas */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {bank.map((id) => {
                  const t = tiles.find((tl) => tl.id === id)!
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => place(id)}
                      aria-label={`Sílaba ${t.text}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 text-xl font-extrabold tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                    >
                      {t.text}
                    </button>
                  )
                })}
              </div>
            </>
          )}
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
            Encontraste los {words.length} animales: {words.map((w) => w.word).join(', ')}.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
