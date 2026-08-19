import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Anchor, Bell, Feather, Rocket, Candy, Drum, Gem, Snail, Turtle, Carrot, Cookie, Cake, Pizza,
  Croissant, Coffee, Watch, Backpack, Hammer, Umbrella, Banana, Apple, TreePine, Gift,
  RotateCcw, ArrowRight, Sparkles, Puzzle, type LucideIcon,
} from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Objetos y letras" — día 28, agnosias. En el estilo de UnaLetraDeCadaUno.tsx
 * (día 23): cada ronda muestra una fila de objetos numerados, cada uno con
 * una REGLA distinta debajo ("1ª letra", "3ª letra", "consonante repetida"…).
 * Sacás una letra de cada objeto siguiendo su regla y, en ese orden, arman
 * una palabra escondida que se escribe con fichas. Objetos e íconos
 * completamente nuevos (lucide-react en vez de fotos), mismo mecanismo.
 *
 * Igual que el día 23: los NOMBRES no se muestran de entrada — reconocer el
 * icono es el primer paso real, por eso el juego vive en agnosias y no en
 * lenguaje. "Dame una idea" revela los nombres para quien se traba ahí.
 *
 * El pool de objetos está filtrado a los que tienen un nombre dominante en
 * Rioplatense SIN tilde en ninguna letra (las fichas no llevan acento) y sin
 * riesgo de sinónimo/singular-plural que cambie qué letra sale — mismo
 * criterio que el día 23 (que por eso excluye "botón" y "llaves"). Por
 * ejemplo, se descartó "uva"/"cereza" porque el ícono de lucide-react
 * muestra un RACIMO — "uva" en singular no coincide con lo que se ve.
 *
 * La palabra de cada ronda se DERIVA aplicando las reglas a los nombres (ver
 * `palabraDe`), nunca se escribe a mano — así el contenido y la respuesta no
 * pueden desincronizarse. Cada palabra de abajo fue recalculada letra por
 * letra a mano contra `extraer` antes de escribirla acá.
 *
 * Nunca rojo, sin timer, siempre reintentable. Pantalla previa "¿Listo?"
 * única vez al montar — igual que el día 23, el "cómo se juega" genérico
 * vive ahí y no se repite por ronda; la regla de cada nivel si es contenido
 * nuevo, así que esa sí se muestra, pero solo en la primera ronda del nivel.
 */

// ── Objetos: id -> nombre a evocar + ícono ───────────────────────────────
const OBJETOS: Record<string, { name: string; Icon: LucideIcon; color: string }> = {
  ancla: { name: 'ANCLA', Icon: Anchor, color: '#1B6FC4' },
  campana: { name: 'CAMPANA', Icon: Bell, color: '#E8531E' },
  pluma: { name: 'PLUMA', Icon: Feather, color: '#4CA52E' },
  cohete: { name: 'COHETE', Icon: Rocket, color: '#DB2777' },
  caramelo: { name: 'CARAMELO', Icon: Candy, color: '#D97706' },
  tambor: { name: 'TAMBOR', Icon: Drum, color: '#9333EA' },
  joya: { name: 'JOYA', Icon: Gem, color: '#0D9488' },
  caracol: { name: 'CARACOL', Icon: Snail, color: '#15436F' },
  tortuga: { name: 'TORTUGA', Icon: Turtle, color: '#4CA52E' },
  zanahoria: { name: 'ZANAHORIA', Icon: Carrot, color: '#E8531E' },
  galleta: { name: 'GALLETA', Icon: Cookie, color: '#D97706' },
  torta: { name: 'TORTA', Icon: Cake, color: '#DB2777' },
  pizza: { name: 'PIZZA', Icon: Pizza, color: '#E8531E' },
  medialuna: { name: 'MEDIALUNA', Icon: Croissant, color: '#D97706' },
  taza: { name: 'TAZA', Icon: Coffee, color: '#15436F' },
  reloj: { name: 'RELOJ', Icon: Watch, color: '#9333EA' },
  mochila: { name: 'MOCHILA', Icon: Backpack, color: '#0D9488' },
  martillo: { name: 'MARTILLO', Icon: Hammer, color: '#1B6FC4' },
  paraguas: { name: 'PARAGUAS', Icon: Umbrella, color: '#4CA52E' },
  banana: { name: 'BANANA', Icon: Banana, color: '#D97706' },
  manzana: { name: 'MANZANA', Icon: Apple, color: '#DB2777' },
  pino: { name: 'PINO', Icon: TreePine, color: '#4CA52E' },
  regalo: { name: 'REGALO', Icon: Gift, color: '#9333EA' },
}
type ObjetoId = keyof typeof OBJETOS

const IMAGES = import.meta.glob('../../../assets/desafio/games/objetos-y-letras/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

// ── Reglas de extracción (mismo motor que el día 23) ─────────────────────
type Regla = 'primera' | 'segunda' | 'tercera' | 'cuarta' | 'ultima' | 'segundaVocal' | 'consonanteRepetida' | 'vocalRepetida'

const REGLA_LABEL: Record<Regla, string> = {
  primera: '1ª letra',
  segunda: '2ª letra',
  tercera: '3ª letra',
  cuarta: '4ª letra',
  ultima: 'última letra',
  segundaVocal: '2ª vocal',
  consonanteRepetida: 'consonante repetida',
  vocalRepetida: 'vocal repetida',
}

const VOCALES = 'AEIOU'
const esVocal = (c: string) => VOCALES.includes(c)
function repetida(nombre: string, vocal: boolean): string {
  const rep = [...new Set(nombre)].filter((c) => esVocal(c) === vocal && nombre.split(c).length - 1 > 1)
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
const palabraDe = (pasos: Paso[]) => pasos.map((p) => extraer(OBJETOS[p.obj].name, p.regla)).join('')

interface Level {
  n: number
  name: string
  hint: string
  puzzles: Paso[][]
}

// Cada palabra fue recalculada a mano contra `extraer` antes de escribirse
// acá (el comentario de fin de línea es documentación; la verdad es
// palabraDe()).
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    hint: 'Acá solo hay que mirar la primera o la última letra de cada objeto.',
    puzzles: [
      [{ obj: 'galleta', regla: 'primera' }, { obj: 'ancla', regla: 'ultima' }, { obj: 'tambor', regla: 'primera' }, { obj: 'regalo', regla: 'ultima' }], // GATO
      [{ obj: 'mochila', regla: 'primera' }, { obj: 'cohete', regla: 'ultima' }, { obj: 'paraguas', regla: 'ultima' }, { obj: 'banana', regla: 'ultima' }], // MESA
      [{ obj: 'pluma', regla: 'primera' }, { obj: 'taza', regla: 'ultima' }, { obj: 'torta', regla: 'primera' }, { obj: 'martillo', regla: 'ultima' }], // PATO
      [{ obj: 'paraguas', regla: 'ultima' }, { obj: 'caramelo', regla: 'ultima' }, { obj: 'pino', regla: 'primera' }, { obj: 'campana', regla: 'ultima' }], // SOPA
      [{ obj: 'caracol', regla: 'primera' }, { obj: 'tortuga', regla: 'ultima' }, { obj: 'paraguas', regla: 'ultima' }, { obj: 'manzana', regla: 'ultima' }], // CASA
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    hint: 'Ahora también hay que contar letras: la segunda o la tercera.',
    puzzles: [
      [{ obj: 'pluma', regla: 'primera' }, { obj: 'galleta', regla: 'tercera' }, { obj: 'mochila', regla: 'ultima' }, { obj: 'torta', regla: 'primera' }, { obj: 'caramelo', regla: 'ultima' }], // PLATO
      [{ obj: 'cohete', regla: 'primera' }, { obj: 'campana', regla: 'segunda' }, { obj: 'tambor', regla: 'ultima' }, { obj: 'tortuga', regla: 'primera' }, { obj: 'banana', regla: 'ultima' }], // CARTA
      [{ obj: 'pino', regla: 'primera' }, { obj: 'galleta', regla: 'tercera' }, { obj: 'tambor', regla: 'segunda' }, { obj: 'torta', regla: 'primera' }, { obj: 'zanahoria', regla: 'ultima' }], // PLATA
      [{ obj: 'reloj', regla: 'primera' }, { obj: 'caramelo', regla: 'segunda' }, { obj: 'tambor', regla: 'primera' }, { obj: 'martillo', regla: 'ultima' }, { obj: 'banana', regla: 'tercera' }], // RATON
      [{ obj: 'mochila', regla: 'primera' }, { obj: 'cohete', regla: 'segunda' }, { obj: 'tortuga', regla: 'primera' }, { obj: 'regalo', regla: 'ultima' }, { obj: 'tambor', regla: 'ultima' }], // MOTOR
      [{ obj: 'paraguas', regla: 'primera' }, { obj: 'galleta', regla: 'tercera' }, { obj: 'manzana', regla: 'segunda' }, { obj: 'zanahoria', regla: 'primera' }, { obj: 'joya', regla: 'ultima' }], // PLAZA
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    hint: 'Se suma la cuarta letra y las que se repiten. Fijate bien cuál vocal o consonante aparece dos veces.',
    puzzles: [
      [{ obj: 'cohete', regla: 'primera' }, { obj: 'caramelo', regla: 'vocalRepetida' }, { obj: 'martillo', regla: 'primera' }, { obj: 'mochila', regla: 'segundaVocal' }, { obj: 'regalo', regla: 'ultima' }, { obj: 'banana', regla: 'tercera' }], // CAMION
      [{ obj: 'caracol', regla: 'primera' }, { obj: 'zanahoria', regla: 'vocalRepetida' }, { obj: 'tortuga', regla: 'tercera' }, { obj: 'tambor', regla: 'cuarta' }, { obj: 'martillo', regla: 'ultima' }, { obj: 'manzana', regla: 'consonanteRepetida' }], // CARBON
      [{ obj: 'pizza', regla: 'primera' }, { obj: 'galleta', regla: 'segunda' }, { obj: 'ancla', regla: 'cuarta' }, { obj: 'caramelo', regla: 'ultima' }, { obj: 'medialuna', regla: 'primera' }, { obj: 'banana', regla: 'vocalRepetida' }], // PALOMA
      [{ obj: 'torta', regla: 'primera' }, { obj: 'pizza', regla: 'segunda' }, { obj: 'joya', regla: 'primera' }, { obj: 'reloj', regla: 'segunda' }, { obj: 'tambor', regla: 'ultima' }, { obj: 'taza', regla: 'vocalRepetida' }], // TIJERA
      [{ obj: 'joya', regla: 'primera' }, { obj: 'tambor', regla: 'segunda' }, { obj: 'reloj', regla: 'primera' }, { obj: 'medialuna', regla: 'tercera' }, { obj: 'pizza', regla: 'segunda' }, { obj: 'banana', regla: 'consonanteRepetida' }], // JARDIN
    ],
  },
]

const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
const DECOYS_PER_LEVEL = [2, 3, 4]
const DECOY_POOL = 'AEIOSRNTLDCUMPB'.split('')

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

export function ObjetosYLetras({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochPuzzles, setEpochPuzzles] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.puzzles).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const roundPuzzles = epochPuzzles[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const pasos = roundPuzzles[roundIdx]
  const answer = useMemo(() => palabraDe(pasos), [pasos])

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
  const [mistakes, setMistakes] = useState(0)

  const done = resolved && roundIdx >= roundsForLevel - 1

  // nivel 3 muestra 6 objetos con etiquetas de regla más largas ("consonante
  // repetida"), igual que en el día 23 — angosta las celdas para que entren
  // 3 por fila en vez de 2 y así quepa todo en 375×812 sin scroll.
  const tight = level.n === 3

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
    if (spelled === answer) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE_MESSAGES))
      setMistakes((m) => m + 1)
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
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setResolved(false)
    setHint(null)
    setShowNames(false)
    setPlacedIds([])
    setRoundIdx(0)
  }
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
  function restartSame() {
    restartEpoch()
  }
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
        {phase === 'playing' && !done && (
          <>
            {roundIdx === 0 && (
              <p className={tight ? 'mt-1 text-base font-medium text-tiam-blue' : 'mt-2 text-base font-medium text-tiam-blue'}>{level.hint}</p>
            )}
            <p className={tight ? 'mt-1 text-base font-semibold text-slate-500' : 'mt-2 text-base font-semibold text-slate-500'}>
              Llevás {roundIdx} de {roundsForLevel}
            </p>
            <div
              className={
                tight
                  ? 'mx-auto mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100'
                  : 'mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100'
              }
            >
              <div
                className="h-full rounded-full bg-tiam-orange transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Puzzle className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Sacá una letra de cada dibujo, como dice abajo de cada uno, y armá la palabra escondida con las fichas.
          </p>
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

      {phase === 'playing' && !done && (
        <>
          {/* Fila de objetos */}
          {!resolved && (
            <div
              className={
                tight
                  ? 'mt-2 flex flex-wrap items-start justify-center gap-1.5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-2'
                  : 'mt-4 flex flex-wrap items-start justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3'
              }
            >
              {pasos.map((paso, i) => {
                const obj = OBJETOS[paso.obj]
                const img = imgFor(paso.obj)
                return (
                  <div
                    key={i}
                    className={
                      tight
                        ? 'flex w-[88px] shrink-0 flex-col items-center sm:w-[116px]'
                        : 'flex w-[96px] shrink-0 flex-col items-center sm:w-[116px]'
                    }
                  >
                    <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 sm:h-24 sm:w-24">
                      {img ? (
                        <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />
                      ) : (
                        <obj.Icon className="h-full w-full" style={{ color: obj.color }} strokeWidth={1.75} />
                      )}
                      <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-orange text-xs font-bold text-white">
                        {i + 1}
                      </span>
                    </div>
                    {showNames && (
                      <span className="mt-1 text-center text-xs font-bold uppercase leading-tight text-slate-700">{obj.name}</span>
                    )}
                    <span className="mt-1 text-center text-xs font-semibold leading-tight text-slate-500">{REGLA_LABEL[paso.regla]}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Palabra que se está armando */}
          <div
            className={
              tight
                ? 'mt-2 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3'
                : 'mt-3 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3'
            }
          >
            {placed.length === 0 && <span className="text-base text-slate-400">Tocá las letras de abajo para empezar</span>}
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
                  resolved ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10',
                ].join(' ')}
              >
                {item.value}
              </button>
            ))}
          </div>

          {/* Montón de letras */}
          {!resolved && (
            <div className={tight ? 'mt-2 flex flex-wrap items-center justify-center gap-2' : 'mt-3 flex flex-wrap items-center justify-center gap-2'}>
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

          {/* Tarjeta "todavía no" — nunca roja: naranja suave + reintentar, sin timer. */}
          {hint && !resolved && (
            <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                <RotateCcw className="h-6 w-6 text-tiam-orange" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">Todavía no es esa</p>
              <p className="mt-1 text-slate-600">{hint}</p>
            </div>
          )}

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
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {pasos.map((paso, i) => (
              <span key={i}>
                <span className="font-bold text-slate-700">{extraer(OBJETOS[paso.obj].name, paso.regla)}</span> = {REGLA_LABEL[paso.regla]} de{' '}
                {OBJETOS[paso.obj].name}
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
