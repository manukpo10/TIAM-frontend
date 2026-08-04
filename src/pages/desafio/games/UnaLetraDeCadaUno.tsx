import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Una letra de cada uno" — día 23, reconocimiento. Reemplaza "¿Qué sonido
 * es?" (el juego de audio) en este slot.
 *
 * Cada ronda muestra una fila de fotos numeradas. Debajo de cada una hay una
 * REGLA distinta ("1ª letra", "2ª vocal", "consonante repetida"…). Sacás una
 * letra de cada objeto siguiendo su regla y, en ese orden, las letras arman
 * una palabra escondida que se escribe con fichas.
 *
 * Inspirado en un TIPO de ejercicio de tarjeta que usa la competencia
 * (extraer una letra por dibujo según una regla posicional); las reglas, los
 * objetos y todas las palabras son nuestros.
 *
 * Por qué vive en el área de RECONOCIMIENTO y no en lenguaje: los nombres de
 * los objetos NO se muestran. El primer paso real es mirar la foto y nombrar
 * el objeto — sin eso no hay letra que sacar, así que el reconocimiento es
 * lo que habilita todo lo demás. "Dame una idea" revela los nombres para
 * quien se trabe ahí, igual que el hint de día 28.
 *
 * El pool de objetos está filtrado a los que tienen UN nombre dominante en
 * Rioplatense. Quedaron afuera a propósito:
 *   · botón  — lleva tilde, y su 4ª letra sería Ó (las fichas no llevan acento,
 *              misma lección que MONJA→JAMÓN en día 3)
 *   · llaves — la foto admite "llave" o "llaves", y eso cambia la última letra
 *   · ovillo — se dice también "ovillo de lana" o directamente "lana"
 * Un sinónimo que cambia la letra deja al jugador trabado sin entender por
 * qué, que es exactamente el tipo de fracaso que esta app no puede permitirse.
 *
 * La palabra de cada ronda NO se guarda como dato: se DERIVA aplicando las
 * reglas a los nombres (ver `palabraDe`). Así es imposible que el contenido y
 * la respuesta se desincronicen — el bug clásico de tener dos fuentes de
 * verdad. Los puzzles fueron generados y verificados por script antes de
 * escribirlos acá (cada letra recomputada desde cero).
 *
 * Fichas con señuelos (DECOYS_PER_LEVEL) y comparación por STRING armado, no
 * por posición: varias respuestas repiten letra (MESA no, pero MADERA sí tiene
 * dos A) y un señuelo puede repetir una letra de la respuesta, así que dos
 * fichas distintas pueden mostrar lo mismo. Mismo contrato que día 3/28.
 *
 * Nunca rojo, sin timer, siempre reintentable.
 */

// ── Objetos: id de asset -> nombre que hay que evocar ────────────────────
const OBJETOS = {
  banana: 'BANANA',
  bicicleta: 'BICICLETA',
  bufanda: 'BUFANDA',
  cuaderno: 'CUADERNO',
  cuchara: 'CUCHARA',
  dado: 'DADO',
  flamenco: 'FLAMENCO',
  galleta: 'GALLETA',
  guitarra: 'GUITARRA',
  ladrillo: 'LADRILLO',
  maceta: 'MACETA',
  mariposa: 'MARIPOSA',
  mate: 'MATE',
  pan: 'PAN',
  paraguas: 'PARAGUAS',
  pato: 'PATO',
  pelota: 'PELOTA',
  perro: 'PERRO',
  rana: 'RANA',
  tijera: 'TIJERA',
  tortuga: 'TORTUGA',
  vaso: 'VASO',
  vela: 'VELA',
  zanahoria: 'ZANAHORIA',
} as const
type ObjetoId = keyof typeof OBJETOS

// ── Reglas de extracción ─────────────────────────────────────────────────
type Regla =
  | 'primera'
  | 'segunda'
  | 'tercera'
  | 'cuarta'
  | 'ultima'
  | 'primeraVocal'
  | 'segundaVocal'
  | 'consonanteRepetida'
  | 'vocalRepetida'

const REGLA_LABEL: Record<Regla, string> = {
  primera: '1ª letra',
  segunda: '2ª letra',
  tercera: '3ª letra',
  cuarta: '4ª letra',
  ultima: 'última letra',
  primeraVocal: '1ª vocal',
  segundaVocal: '2ª vocal',
  consonanteRepetida: 'consonante repetida',
  vocalRepetida: 'vocal repetida',
}

const VOCALES = 'AEIOU'
const esVocal = (c: string) => VOCALES.includes(c)
// La única letra de su clase que aparece más de una vez. Los puzzles de abajo
// solo usan estas reglas sobre nombres donde esa letra es única (verificado
// por script), así que nunca hay dos respuestas posibles.
function repetida(nombre: string, vocal: boolean): string {
  const rep = [...new Set(nombre)].filter(
    (c) => esVocal(c) === vocal && nombre.split(c).length - 1 > 1,
  )
  return rep[0] ?? ''
}

function extraer(nombre: string, regla: Regla): string {
  switch (regla) {
    case 'primera':
      return nombre[0]
    case 'segunda':
      return nombre[1]
    case 'tercera':
      return nombre[2]
    case 'cuarta':
      return nombre[3]
    case 'ultima':
      return nombre[nombre.length - 1]
    case 'primeraVocal':
      return [...nombre].filter(esVocal)[0]
    case 'segundaVocal':
      return [...nombre].filter(esVocal)[1]
    case 'consonanteRepetida':
      return repetida(nombre, false)
    case 'vocalRepetida':
      return repetida(nombre, true)
  }
}

interface Paso {
  obj: ObjetoId
  regla: Regla
}
/** La respuesta se deriva de los pasos — nunca se escribe a mano. */
const palabraDe = (pasos: Paso[]) => pasos.map((p) => extraer(OBJETOS[p.obj], p.regla)).join('')

interface Level {
  n: number
  name: string
  /** Texto de ayuda propio del nivel, explica qué reglas entran en juego. */
  hint: string
  puzzles: Paso[][]
}

// Los comentarios al final de cada línea son documentación: la verdad es lo
// que devuelve palabraDe(). Generados y verificados por script.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    hint: 'Acá solo hay que mirar la primera o la última letra de cada palabra.',
    puzzles: [
      [{ obj: 'mariposa', regla: 'primera' }, { obj: 'mate', regla: 'ultima' }, { obj: 'paraguas', regla: 'ultima' }, { obj: 'cuchara', regla: 'ultima' }], // MESA
      [{ obj: 'paraguas', regla: 'ultima' }, { obj: 'vaso', regla: 'ultima' }, { obj: 'pato', regla: 'primera' }, { obj: 'bufanda', regla: 'ultima' }], // SOPA
      [{ obj: 'mariposa', regla: 'primera' }, { obj: 'pelota', regla: 'ultima' }, { obj: 'pan', regla: 'ultima' }, { obj: 'cuaderno', regla: 'ultima' }], // MANO
      [{ obj: 'rana', regla: 'primera' }, { obj: 'pelota', regla: 'ultima' }, { obj: 'mariposa', regla: 'primera' }, { obj: 'cuaderno', regla: 'ultima' }], // RAMO
      [{ obj: 'pan', regla: 'primera' }, { obj: 'mate', regla: 'ultima' }, { obj: 'rana', regla: 'primera' }, { obj: 'cuchara', regla: 'ultima' }], // PERA
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    hint: 'Ahora también hay que contar letras, y aparecen las vocales.',
    puzzles: [
      [{ obj: 'paraguas', regla: 'primera' }, { obj: 'flamenco', regla: 'segunda' }, { obj: 'rana', regla: 'primeraVocal' }, { obj: 'mate', regla: 'tercera' }, { obj: 'cuaderno', regla: 'ultima' }], // PLATO
      [{ obj: 'cuchara', regla: 'tercera' }, { obj: 'mariposa', regla: 'segunda' }, { obj: 'rana', regla: 'primera' }, { obj: 'mate', regla: 'tercera' }, { obj: 'maceta', regla: 'ultima' }], // CARTA
      [{ obj: 'pan', regla: 'tercera' }, { obj: 'bicicleta', regla: 'segunda' }, { obj: 'pelota', regla: 'primeraVocal' }, { obj: 'tijera', regla: 'primera' }, { obj: 'ladrillo', regla: 'ultima' }], // NIETO
      [{ obj: 'vaso', regla: 'primera' }, { obj: 'perro', regla: 'primeraVocal' }, { obj: 'tortuga', regla: 'tercera' }, { obj: 'dado', regla: 'primera' }, { obj: 'pelota', regla: 'segunda' }], // VERDE
      [{ obj: 'tortuga', regla: 'primera' }, { obj: 'zanahoria', regla: 'ultima' }, { obj: 'perro', regla: 'tercera' }, { obj: 'dado', regla: 'primera' }, { obj: 'vela', regla: 'segunda' }], // TARDE
      [{ obj: 'vaso', regla: 'tercera' }, { obj: 'bicicleta', regla: 'primeraVocal' }, { obj: 'flamenco', regla: 'segunda' }, { obj: 'ladrillo', regla: 'primera' }, { obj: 'galleta', regla: 'ultima' }], // SILLA
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    hint: 'Se suman las letras que se repiten. Fijate bien: la consonante repetida es la que aparece dos veces.',
    puzzles: [
      [{ obj: 'vela', regla: 'primera' }, { obj: 'tijera', regla: 'cuarta' }, { obj: 'mariposa', regla: 'tercera' }, { obj: 'zanahoria', regla: 'vocalRepetida' }, { obj: 'banana', regla: 'consonanteRepetida' }, { obj: 'tortuga', regla: 'segunda' }], // VERANO
      [{ obj: 'tijera', regla: 'tercera' }, { obj: 'rana', regla: 'segundaVocal' }, { obj: 'guitarra', regla: 'consonanteRepetida' }, { obj: 'cuaderno', regla: 'cuarta' }, { obj: 'ladrillo', regla: 'segundaVocal' }, { obj: 'pan', regla: 'ultima' }], // JARDIN
      [{ obj: 'flamenco', regla: 'cuarta' }, { obj: 'galleta', regla: 'ultima' }, { obj: 'rana', regla: 'tercera' }, { obj: 'tortuga', regla: 'consonanteRepetida' }, { obj: 'perro', regla: 'segunda' }, { obj: 'ladrillo', regla: 'primera' }], // MANTEL
      [{ obj: 'paraguas', regla: 'ultima' }, { obj: 'bicicleta', regla: 'vocalRepetida' }, { obj: 'galleta', regla: 'tercera' }, { obj: 'ladrillo', regla: 'primera' }, { obj: 'tortuga', regla: 'segunda' }, { obj: 'banana', regla: 'consonanteRepetida' }], // SILLON
      [{ obj: 'bicicleta', regla: 'consonanteRepetida' }, { obj: 'guitarra', regla: 'tercera' }, { obj: 'cuchara', regla: 'segunda' }, { obj: 'dado', regla: 'primera' }, { obj: 'galleta', regla: 'vocalRepetida' }, { obj: 'cuaderno', regla: 'cuarta' }], // CIUDAD
      [{ obj: 'cuchara', regla: 'tercera' }, { obj: 'rana', regla: 'vocalRepetida' }, { obj: 'maceta', regla: 'primera' }, { obj: 'mariposa', regla: 'cuarta' }, { obj: 'banana', regla: 'consonanteRepetida' }, { obj: 'cuaderno', regla: 'ultima' }], // CAMINO
      [{ obj: 'flamenco', regla: 'segundaVocal' }, { obj: 'vaso', regla: 'tercera' }, { obj: 'bicicleta', regla: 'consonanteRepetida' }, { obj: 'pelota', regla: 'cuarta' }, { obj: 'bufanda', regla: 'primera' }, { obj: 'maceta', regla: 'ultima' }], // ESCOBA
      [{ obj: 'maceta', regla: 'primera' }, { obj: 'mariposa', regla: 'vocalRepetida' }, { obj: 'dado', regla: 'tercera' }, { obj: 'mate', regla: 'segundaVocal' }, { obj: 'ladrillo', regla: 'cuarta' }, { obj: 'galleta', regla: 'segunda' }], // MADERA
      [{ obj: 'rana', regla: 'cuarta' }, { obj: 'bufanda', regla: 'primera' }, { obj: 'cuaderno', regla: 'segunda' }, { obj: 'galleta', regla: 'segundaVocal' }, { obj: 'vela', regla: 'tercera' }, { obj: 'cuchara', regla: 'vocalRepetida' }], // ABUELA
    ],
  },
]

// 2 por nivel, igual que el resto de los días ajustados en esta tanda.
const ROUNDS_PER_LEVEL = [2, 2, 2]
// Toda ronda termina resolviéndose bien (no hay "me rindo"), así que
// totalAttempts = mistakes + esta suma.
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
// Letras de más en el montón — juntar solo las justas no alcanza.
const DECOYS_PER_LEVEL = [2, 3, 4]
const DECOY_POOL = 'AEIOSRNTLDCUMPB'.split('')

const IMAGES = import.meta.glob('../../../assets/desafio/games/una-letra-de-cada-uno/*.webp', {
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

interface Tile {
  id: number
  value: string
}
function buildTiles(answer: string, decoys: number): Tile[] {
  const values = answer.split('')
  for (let i = 0; i < decoys; i++) values.push(pickOne(DECOY_POOL))
  return shuffle(values).map((value, id) => ({ id, value }))
}

const PRAISE_GOOD = ['¡Muy bien!', '¡Esa es la palabra!', '¡Así se hace!', '¡Perfecto!']
const NUDGE_MESSAGES = [
  'Todavía no. Repasá objeto por objeto qué letra te pide cada uno.',
  'Casi. Fijate que las letras van en el mismo orden que los dibujos.',
  'Esa no es. Tocá una letra puesta para sacarla y probá de nuevo.',
]

export function UnaLetraDeCadaUno({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which puzzle subset (drawn from the level's pool) is playing for level i
  // THIS "epoch" (a full 3-level pass). Decided once per epoch — at mount,
  // and again on "Hacer otro" — never re-rolled just because the player
  // re-visits a level, so "Repetir" can hand back the exact same puzzles
  // deterministically instead of re-randomizing and accidentally landing on
  // something new.
  const [epochPuzzles, setEpochPuzzles] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.puzzles).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const roundPuzzles = epochPuzzles[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const pasos = roundPuzzles[roundIdx]
  const answer = useMemo(() => palabraDe(pasos), [pasos])

  // Fichas de la ronda (respuesta + señuelos). `placedIds` se resetea
  // SINCRÓNICAMENTE en los handlers, nunca en un efecto — misma disciplina
  // que día 3/28: un efecto llega un render tarde y el onComplete de abajo
  // leería un `done` viejo.
  const tiles = useMemo(
    () => buildTiles(answer, DECOYS_PER_LEVEL[levelIdx]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )
  const [placedIds, setPlacedIds] = useState<number[]>([])
  const placed = placedIds.map((id) => tiles.find((t) => t.id === id)).filter((t): t is Tile => !!t)
  const bank = tiles.filter((t) => !placedIds.includes(t.id))
  const readyToCheck = placed.length === answer.length

  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [showNames, setShowNames] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Acumulado a través de los 3 niveles; solo se pone en cero en un reinicio
  // real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  const done = resolved && roundIdx >= roundsForLevel - 1

  function handlePlace(item: Tile) {
    if (resolved || placed.length >= answer.length) return
    setHint(null)
    setPlacedIds((ids) => [...ids, item.id])
  }
  function handleUnplace(item: Tile) {
    if (resolved) return
    setHint(null)
    setPlacedIds((ids) => ids.filter((i) => i !== item.id))
  }

  // Auto-revisa apenas se llenan las letras del banco — sin botón "Revisar"
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

    // Compara el STRING armado, no la posición: dos fichas pueden mostrar la
    // misma letra (respuesta con letra repetida, o señuelo que la repite) y
    // el jugador no puede distinguirlas.
    const spelled = placed.map((item) => item.value).join('')
    if (spelled === answer) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE_MESSAGES))
      setMistakes((m) => m + 1)
      // Las fichas quedan donde están: un error no barre todo lo puesto.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToCheck, placedIds])

  function nextRound() {
    setResolved(false)
    setHint(null)
    setShowNames(false)
    setPlacedIds([])
    setRoundIdx((i) => i + 1)
  }
  // "Siguiente nivel" — advance within the SAME attempt. epochPuzzles is left
  // alone: level i+1's puzzle subset was already decided when this epoch
  // started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setResolved(false)
    setHint(null)
    setShowNames(false)
    setPlacedIds([])
    setRoundIdx(0)
  }

  // Shared by both restart buttons on level 3's complete card (only ever
  // shown once the final level is done, so always a genuine day restart —
  // zero the mistake accumulator either way). roundKey always bumps here:
  // it's the "which attempt is this" generation counter the onComplete
  // effect uses to fire again on a replay, independent of whether the
  // puzzles themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setResolved(false)
    setHint(null)
    setShowNames(false)
    setPlacedIds([])
    setRoundIdx(0)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same puzzle subsets as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random puzzle subset per level.
  function restartDifferent() {
    restartEpoch()
    setEpochPuzzles(LEVELS.map((lvl, i) => shuffle(lvl.puzzles).slice(0, ROUNDS_PER_LEVEL[i])))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base text-slate-500">
              Sacá una letra de cada dibujo, como dice abajo de cada uno, y armá la palabra.
            </p>
            <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {roundsForLevel}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-orange transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Fila de objetos. Cada celda va numerada porque en pantallas chicas
              la fila envuelve, y el ORDEN de las letras es parte del ejercicio:
              sin el número no se sabría por dónde sigue. */}
          {!resolved && (
            <div className="mt-5 flex flex-wrap items-start justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3">
              {pasos.map((paso, i) => {
                const img = imgFor(paso.obj)
                return (
                  <div key={i} className="flex w-[68px] shrink-0 flex-col items-center sm:w-[84px]">
                    <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 sm:h-16 sm:w-16">
                      {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                      <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-orange text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                    </div>
                    {showNames && (
                      <span className="mt-1 text-center text-xs font-bold uppercase leading-tight text-slate-700">
                        {OBJETOS[paso.obj]}
                      </span>
                    )}
                    <span className="mt-1 text-center text-xs font-semibold leading-tight text-slate-500">
                      {REGLA_LABEL[paso.regla]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Palabra que se está armando */}
          <div className="mt-4 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {placed.length === 0 && (
              <span className="text-base text-slate-400">Tocá las letras de abajo para empezar</span>
            )}
            {placed.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={resolved}
                onClick={() => handleUnplace(item)}
                aria-label={`Quitar letra ${item.value}`}
                className={[
                  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 px-2 text-xl font-extrabold uppercase transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  resolved
                    ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                    : 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10',
                ].join(' ')}
              >
                {item.value}
              </button>
            ))}
          </div>

          {/* Montón de letras */}
          {!resolved && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlace(item)}
                  aria-label={`Letra ${item.value}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-2 text-xl font-extrabold uppercase text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {/* Tarjeta "todavía no" — tan visible como la de acierto. Nunca
              roja: naranja suave + ícono de reintentar. Se queda hasta que
              el jugador toca una letra (handlePlace/handleUnplace ya limpian
              el hint), sin timer. */}
          {hint && !resolved && (
            <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                <RotateCcw className="h-6 w-6 text-tiam-orange" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">Todavía no es esa</p>
              <p className="mt-1 text-slate-600">{hint}</p>
            </div>
          )}

          {/* La ayuda revela los NOMBRES, que es donde se traba quien no
              reconoce un dibujo — no revela ninguna letra. */}
          {!resolved && !showNames && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowNames(true)}
                className="text-base font-semibold text-tiam-blue underline underline-offset-4"
              >
                Dame una idea
              </button>
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
            La palabra escondida era <span className="font-semibold text-slate-800">{answer}</span>.
          </p>
          {/* Recap: de dónde salió cada letra. Es la parte que enseña — sin
              esto, quien acertó por tanteo no aprende la regla. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {pasos.map((paso, i) => (
              <span key={i}>
                <span className="font-bold text-slate-700">{extraer(OBJETOS[paso.obj], paso.regla)}</span>{' '}
                = {REGLA_LABEL[paso.regla]} de {OBJETOS[paso.obj]}
              </span>
            ))}
          </div>
          {done && <p className="mt-2 text-slate-600">Completaste el nivel {levelIdx + 1}.</p>}
          {done ? (
            levelIdx < LEVELS.length - 1 ? (
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
              // Two ways to go again: "Repetir" replays the identical
              // puzzles, "Hacer otro" draws a fresh set per level — same
              // choice ArmaLasPalabras.tsx (día 1) offers at epoch's end.
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
            )
          ) : (
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente palabra
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
