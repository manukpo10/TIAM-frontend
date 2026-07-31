import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Es lo mismo decir…" — día 11 (mes 2), lenguaje. Un juego de sinónimos:
 * dos grupos de palabras; tocá una de cada grupo — si significan lo mismo,
 * forman pareja y quedan fijas en verde.
 *
 * Motor calcado de "Las mismas letras" (LasMismasLetras.tsx, día 25 del mes
 * 1) — el juego de emparejamiento por toque más limpio ya existente en la
 * carpeta (brief: "match whichever existing month-1 matching-pairs game's
 * interaction pattern is cleanest to replicate"). Misma máquina de estados
 * de dos toques (elegí uno, elegí un segundo, comparar, fijar o soltar), el
 * mismo derangement garantizado para que ninguna pareja caiga en la misma
 * fila/columna de pura casualidad, y la misma orientación aleatoria por
 * ronda (columnas o filas). Único cambio real: la relación entre las dos
 * palabras es SINONIMIA en vez de anagrama, así que el criterio de acierto
 * sigue siendo comparar por `pairId` — no hay ninguna lógica de letras acá.
 *
 * Sinónimos verificados uno por uno para que ningún par cruzado sea
 * ambiguo (que una palabra de un par también sea sinónimo válido de otro par
 * del mismo tablero) — mismo cuidado que LasMismasLetras puso en que ningún
 * anagrama cruzado calzara por accidente. La abstracción escala con el
 * nivel: nivel 1 son sinónimos de uso diario y muy concretos, nivel 3 son de
 * registro más formal/literario (vetusto, desprendido).
 *
 * ONE board por nivel, sin capa de ronda interna (mismo motivo que
 * LasMismasLetras: un tablero de 4-5 parejas ya son 8-10 toques).
 */

interface WordPair {
  a: string
  b: string
}
interface Level {
  n: number
  name: string
  pairs: WordPair[]
  hint?: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    pairs: [
      { a: 'lindo', b: 'bonito' },
      { a: 'grande', b: 'enorme' },
      { a: 'feliz', b: 'contento' },
      { a: 'rápido', b: 'veloz' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    pairs: [
      { a: 'empezar', b: 'comenzar' },
      { a: 'terminar', b: 'finalizar' },
      { a: 'responder', b: 'contestar' },
      { a: 'mirar', b: 'observar' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    pairs: [
      { a: 'valiente', b: 'audaz' },
      { a: 'triste', b: 'apenado' },
      { a: 'inteligente', b: 'astuto' },
      { a: 'generoso', b: 'desprendido' },
      { a: 'antiguo', b: 'vetusto' },
    ],
    hint: 'Estas palabras son menos comunes en el día a día — pensá en su significado, no en cómo suenan.',
  },
]

// Total de parejas exitosas a través de todo el día (4+4+5) — cada pareja se
// empareja exactamente una vez sin importar cuántos intentos fallidos haya
// en el camino, así que es una constante derivable (mismo patrón que el
// TOTAL_PAIRS de LasMismasLetras).
const TOTAL_PAIRS = LEVELS.reduce((sum, l) => sum + l.pairs.length, 0)

interface WordTile {
  pairId: number
  word: string
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

// 'left'/'right' son sólo los dos identificadores de grupo con los que
// trabaja la lógica de toque — 'columns' los renderiza lado a lado, 'rows'
// apila el grupo "left" completo arriba del grupo "right". Aleatorizado por
// ronda junto con el tablero para que el patrón de toque tampoco sea fijo.
type Orientation = 'columns' | 'rows'

// Aleatoriza qué palabra de cada pareja cae en el grupo izquierdo vs. el
// derecho, después baraja el orden dentro de cada grupo. Barajar de forma
// independiente NO garantiza que una pareja nunca caiga en la misma fila —
// se re-sortea el grupo derecho hasta lograr un derangement real (cero filas
// alineadas con su pareja), mismo motivo/implementación que LasMismasLetras.
function buildBoard(level: Level): { left: WordTile[]; right: WordTile[]; orientation: Orientation } {
  const left: WordTile[] = []
  const right: WordTile[] = []
  level.pairs.forEach((pair, pairId) => {
    const [first, second] = Math.random() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a]
    left.push({ pairId, word: first })
    right.push({ pairId, word: second })
  })
  const shuffledLeft = shuffle(left)
  let shuffledRight = shuffle(right)
  while (shuffledLeft.some((tile, i) => tile.pairId === shuffledRight[i].pairId)) {
    shuffledRight = shuffle(right)
  }
  return { left: shuffledLeft, right: shuffledRight, orientation: Math.random() < 0.5 ? 'columns' : 'rows' }
}

const MISMATCH_LINES = [
  'Esas palabras no significan lo mismo. ¡Probá con otra combinación!',
  'Casi... pero no son sinónimos.',
  '¡Buen intento! Pensá en el significado de cada palabra.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente vocabulario!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria de palabras!']

const DEFAULT_HINTS: Record<Orientation, string> = {
  columns: 'Tocá una palabra de la izquierda y otra de la derecha. Si significan lo mismo, forman pareja.',
  rows: 'Tocá una palabra de arriba y otra de abajo. Si significan lo mismo, forman pareja.',
}

export function EsLoMismoDecir({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const board = useMemo(
    () => buildBoard(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [matchedPairIds, setMatchedPairIds] = useState<Set<number>>(new Set())
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)
  const [selectedRight, setSelectedRight] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [mismatchLine, setMismatchLine] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Acumulado a través de los niveles 1→2→3, sólo se pone en cero en un
  // reinicio real del día (ver la rama isWrap de nextLevel).
  const [mistakes, setMistakes] = useState(0)

  const done = matchedPairIds.size >= level.pairs.length

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  // Dispara una vez por roundKey cuando el tablero del nivel 3 queda
  // completo. totalAttempts = mistakes acumulados + parejas exitosas totales
  // (constante fija: cada pareja se empareja exactamente una vez).
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PAIRS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  // Compara la pareja izquierda/derecha elegida. Una pareja correcta
  // mantiene ambas fichas seleccionadas un instante antes de fijarlas en
  // verde; una incorrecta se sostiene más tiempo con una pista de texto,
  // después ambas se deseleccionan solas — nunca rojo, siempre reintentable.
  function evaluate(leftIdx: number, rightIdx: number) {
    setLocked(true)
    const leftTile = board.left[leftIdx]
    const rightTile = board.right[rightIdx]

    if (leftTile.pairId === rightTile.pairId) {
      window.setTimeout(() => {
        setMatchedPairIds((prev) => new Set(prev).add(leftTile.pairId))
        setSelectedLeft(null)
        setSelectedRight(null)
        setLocked(false)
      }, 500)
    } else {
      setMismatchLine(pickOne(MISMATCH_LINES))
      setMistakes((m) => m + 1)
      window.setTimeout(() => {
        setSelectedLeft(null)
        setSelectedRight(null)
        setLocked(false)
        setMismatchLine(null)
      }, 1200)
    }
  }

  function handleTap(side: 'left' | 'right', index: number) {
    if (locked || done) return
    const tile = (side === 'left' ? board.left : board.right)[index]
    if (matchedPairIds.has(tile.pairId)) return

    const isLeft = side === 'left'
    const ownSelected = isLeft ? selectedLeft : selectedRight
    const otherSelected = isLeft ? selectedRight : selectedLeft
    if (ownSelected === index) return // re-toque en la ficha ya elegida: no hace nada

    if (isLeft) setSelectedLeft(index)
    else setSelectedRight(index)

    if (otherSelected === null) return // todavía falta elegir del otro grupo

    const leftIdx = isLeft ? index : otherSelected
    const rightIdx = isLeft ? otherSelected : index
    evaluate(leftIdx, rightIdx)
  }

  // Resets sincrónicos acá mismo, nunca en un efecto separado — ver el
  // comentario del onComplete de arriba para el motivo.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setMatchedPairIds(new Set())
    setSelectedLeft(null)
    setSelectedRight(null)
    setLocked(false)
    setMismatchLine(null)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setMatchedPairIds(new Set())
    setSelectedLeft(null)
    setSelectedRight(null)
    setLocked(false)
    setMismatchLine(null)
  }

  function renderTile(side: 'left' | 'right', tile: WordTile, index: number) {
    const isMatched = matchedPairIds.has(tile.pairId)
    const isSelected = (side === 'left' ? selectedLeft : selectedRight) === index
    return (
      <button
        key={index}
        type="button"
        disabled={isMatched || locked}
        onClick={() => handleTap(side, index)}
        className={[
          'relative min-h-[44px] w-full rounded-xl border-2 px-3 py-2.5 text-center text-sm font-semibold transition',
          'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 sm:text-base',
          isMatched
            ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
            : isSelected
              ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900 ring-2 ring-tiam-blue/30'
              : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
        ].join(' ')}
      >
        {tile.word}
        {isMatched && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Encontrá las palabras que significan lo mismo
            </h2>
            <p className="mt-2 text-base text-slate-500">
              {level.hint ?? DEFAULT_HINTS[board.orientation]}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Encontraste {matchedPairIds.size} de {level.pairs.length} parejas
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(matchedPairIds.size / level.pairs.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Board */}
      {!done && (
        <>
          <div
            className={
              board.orientation === 'columns'
                ? 'mt-6 grid grid-cols-2 gap-3 sm:gap-4'
                : 'mt-6 flex flex-col gap-4 sm:gap-5'
            }
          >
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {board.left.map((tile, index) => renderTile('left', tile, index))}
            </div>
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {board.right.map((tile, index) => renderTile('right', tile, index))}
            </div>
          </div>

          {mismatchLine && (
            <p className="mt-4 text-center text-base font-medium text-slate-500">{mismatchLine}</p>
          )}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste las {level.pairs.length} parejas — completaste el {level.name.toLowerCase()}!
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
              Otra vuelta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
