import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Mesa de cartas" — día 29 del Mes 2, cierre del área cálculo. Una grilla
 * de cartas de baraja ESPAÑOLA (oro/copa/espada/basto) renderizadas 100% en
 * SVG/CSS (sin ningún asset), y una pregunta a la vez de un pool que rota:
 * contar un palo o un valor, sumar una fila o columna, restar entre dos
 * palos, o encontrar la única carta repetida. Selección múltiple, nunca
 * teclado.
 *
 * Cada ronda se genera PROCEDURALMENTE: se elige el tipo de pregunta
 * primero y RECIÉN DESPUÉS se arma la grilla de cartas (para el tipo
 * "repetida" hace falta construir la grilla con exactamente un par
 * duplicado; para el resto, puro azar sin repetir carta). La respuesta
 * correcta y los 3 distractores se calculan siempre a partir de la grilla
 * real ya generada — nunca hay un número "de más" escrito a mano que se
 * pueda desincronizar del contenido.
 *
 * Los distractores son intencionalmente "el error típico": para
 * "¿cuántas copas hay?" un distractor es el conteo de OTRO palo (el error
 * de confundir de cuál palo se preguntaba); para una suma de fila, un
 * distractor es la suma de OTRA fila; para la resta entre palos
 * (suitCrossSum), los distractores típicos son "sumar y olvidarse de
 * restar" y "sumar los dos palos en vez de restar". Ver fillDecoys().
 *
 * La grilla crece con el nivel (2×3 → 3×3 → 3×4, 6/9/12 cartas) y el pool de
 * preguntas se amplía: nivel 1 sólo cuenta (palo/valor); nivel 2 suma una
 * fila o columna y agrega la resta entre dos palos (hay que sumar cada palo
 * por separado y recién después restar — el pedido puntual del play-test:
 * "que sume el palo de copa y reste el palo de oro"); nivel 3 suma también
 * por columna y agrega la carta repetida — la pregunta más exigente porque
 * obliga a comparar la grilla entera, no sólo escanearla.
 *
 * Cada palo tiene su color propio — oro dorado, copa roja, espada azul,
 * basto verde, con detalles en acento dorado (aro/borde/guarda/punta) —
 * como en una baraja española real. A diferencia de la francesa, acá no
 * hay una convención roja/negra COMPARTIDA entre dos palos: cada uno es
 * distinguible por color Y por la silueta del glyph (ver SuitGlyph),
 * pensada para leerse clara en tamaño chico.
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" del resto del lote (ver ElDescuento.tsx).
 */

type Suit = 'oro' | 'copa' | 'espada' | 'basto'
const SUITS: Suit[] = ['oro', 'copa', 'espada', 'basto']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const
type Rank = (typeof RANKS)[number]

interface CardData {
  rank: Rank
  suit: Suit
}

const SUIT_PLURAL: Record<Suit, string> = { oro: 'oros', copa: 'copas', espada: 'espadas', basto: 'bastos' }
// Figuras de la baraja española real: Sota (10), Caballo (11), Rey (12) —
// no hay "Jota"/"Reina"/13, esas son de la baraja francesa y no existen acá.
const RANK_SIMPLE: Record<Rank, string> = {
  A: 'As', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '10': 'Sota', '11': 'Caballo', '12': 'Rey',
}
const RANK_ARTICLE: Record<Rank, string> = {
  A: 'el', '2': 'el', '3': 'el', '4': 'el', '5': 'el', '6': 'el', '7': 'el', '8': 'el', '9': 'el',
  '10': 'la', '11': 'el', '12': 'el',
}
// countRank nunca elige Sota/Caballo/Rey como sujeto de la pregunta ("¿Cuántas
// cartas de Rey hay?") — a pedido explícito del usuario: la carta acá es 100%
// SVG genérico (número + glyph de palo, ver PlayingCard/SuitGlyph), sin
// ninguna ilustración de figura, así que preguntar por una figura por NOMBRE
// le pide al jugador reconocer un dibujo que nunca existió en pantalla. Sí
// pueden seguir apareciendo en la mesa y como respuesta en 'repeated' (ahí el
// nombre sólo describe una carta que el jugador YA vio, no la pide a ciegas).
const COUNTABLE_RANKS = RANKS.filter((r) => r !== '10' && r !== '11' && r !== '12')

function cardValue(rank: Rank): number {
  return rank === 'A' ? 1 : Number(rank)
}
// Tinta neutra para el índice de rango (esquinas) — el palo se distingue
// por color propio (ver SUIT_COLOR), como en una baraja española real
// (oro dorado, copa roja, espada azul, basto verde — a diferencia de la
// francesa, acá no hay una convención compartida roja/negra entre dos
// palos, cada palo tiene el suyo).
const CARD_INK = '#1e293b'
const SUIT_COLOR: Record<Suit, string> = {
  oro: '#D4A017',
  copa: '#B91C1C',
  espada: '#3B6EA5',
  basto: '#3F7D3F',
}
// Acento dorado compartido para los detalles (aro de la moneda, borde del
// cáliz, guarda de la espada, punta del basto) — eco del dorado que domina
// la ornamentación de la baraja española real.
const SUIT_ACCENT = '#B8860B'
function cardLabel(c: CardData): string {
  return `${RANK_ARTICLE[c.rank]} ${RANK_SIMPLE[c.rank]} de ${SUIT_PLURAL[c.suit]}`
}
function cardEq(a: CardData, b: CardData): boolean {
  return a.rank === b.rank && a.suit === b.suit
}
function fullDeck(): CardData[] {
  const deck: CardData[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit })
  return deck
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randomInt(n: number): number {
  return Math.floor(Math.random() * n)
}

/** Arma exactamente `need` distractores distintos de `correct`, prefiriendo
 * los `seeds` "naturales" (conteo de otro palo, suma de otra fila, etc. — el
 * error típico) y completando con desvíos chicos si hacen falta más. */
function fillDecoys(correct: number, seeds: number[], need: number): number[] {
  const set = new Set<number>()
  for (const s of seeds) {
    if (s !== correct && s >= 0) set.add(s)
  }
  let offset = 1
  while (set.size < need && offset < 30) {
    if (correct + offset !== correct) set.add(correct + offset)
    if (correct - offset >= 0) set.add(correct - offset)
    offset++
  }
  return shuffle(Array.from(set)).slice(0, need)
}

type QuestionType = 'countSuit' | 'countRank' | 'rowSum' | 'colSum' | 'repeated' | 'suitCrossSum'

interface Option {
  id: string
  label: string
}
interface Round {
  rows: number
  cols: number
  grid: CardData[] // orden fila por fila (índice = fila*cols + columna)
  prompt: string
  options: Option[]
  correctId: string
}

const ROW_LABEL = (r: number, rows: number) => (r === 0 ? 'de arriba' : r === rows - 1 ? 'de abajo' : 'del medio')
const COL_ORDINAL = ['primera', 'segunda', 'tercera', 'cuarta']

function rowCards(grid: CardData[], cols: number, r: number): CardData[] {
  return grid.filter((_, i) => Math.floor(i / cols) === r)
}
function colCards(grid: CardData[], cols: number, c: number): CardData[] {
  return grid.filter((_, i) => i % cols === c)
}
function sumOf(cards: CardData[]): number {
  return cards.reduce((s, c) => s + cardValue(c.rank), 0)
}

const LEVEL_GRID: [number, number][] = [
  [2, 3],
  [3, 3],
  [3, 4],
]
const LEVEL_QUESTION_TYPES: QuestionType[][] = [
  ['countSuit', 'countRank'],
  ['countSuit', 'countRank', 'rowSum', 'suitCrossSum'],
  ['countSuit', 'countRank', 'rowSum', 'colSum', 'repeated', 'suitCrossSum'],
]

function generateRound(levelIdx: number): Round {
  const [rows, cols] = LEVEL_GRID[levelIdx]
  const total = rows * cols
  const type = pickOne(LEVEL_QUESTION_TYPES[levelIdx])

  let grid: CardData[]
  let repeated: CardData | null = null
  if (type === 'repeated') {
    const unique = shuffle(fullDeck()).slice(0, total - 1)
    repeated = pickOne(unique)
    grid = shuffle([...unique, repeated])
  } else {
    grid = shuffle(fullDeck()).slice(0, total)
  }

  let prompt: string
  let numericOptions: number[] | null = null
  let correctValue = 0
  let cardOptions: CardData[] | null = null

  if (type === 'countSuit') {
    const suit = pickOne(SUITS)
    correctValue = grid.filter((c) => c.suit === suit).length
    prompt = `¿Cuántas cartas de ${SUIT_PLURAL[suit]} hay?`
    const seeds = SUITS.filter((s) => s !== suit).map((s) => grid.filter((c) => c.suit === s).length)
    numericOptions = shuffle([correctValue, ...fillDecoys(correctValue, seeds, 3)])
  } else if (type === 'countRank') {
    const rank = pickOne(COUNTABLE_RANKS)
    correctValue = grid.filter((c) => c.rank === rank).length
    prompt = `¿Cuántas cartas de ${RANK_SIMPLE[rank]} hay?`
    const otherRanks = shuffle(RANKS.filter((r) => r !== rank)).slice(0, 3)
    const seeds = otherRanks.map((r) => grid.filter((c) => c.rank === r).length)
    numericOptions = shuffle([correctValue, ...fillDecoys(correctValue, seeds, 3)])
  } else if (type === 'rowSum') {
    const r = randomInt(rows)
    correctValue = sumOf(rowCards(grid, cols, r))
    prompt = `¿Cuánto suman las cartas de la fila ${ROW_LABEL(r, rows)}?`
    const seeds = Array.from({ length: rows }, (_, i) => i)
      .filter((i) => i !== r)
      .map((i) => sumOf(rowCards(grid, cols, i)))
    numericOptions = shuffle([correctValue, ...fillDecoys(correctValue, seeds, 3)])
  } else if (type === 'colSum') {
    const c = randomInt(cols)
    correctValue = sumOf(colCards(grid, cols, c))
    prompt = `¿Cuánto suman las cartas de la ${COL_ORDINAL[c]} columna?`
    const seeds = Array.from({ length: cols }, (_, i) => i)
      .filter((i) => i !== c)
      .map((i) => sumOf(colCards(grid, cols, i)))
    numericOptions = shuffle([correctValue, ...fillDecoys(correctValue, seeds, 3)])
  } else if (type === 'suitCrossSum') {
    const [suitA, suitB] = shuffle(SUITS)
    const sumA = sumOf(grid.filter((c) => c.suit === suitA))
    const sumB = sumOf(grid.filter((c) => c.suit === suitB))
    // Siempre restamos el palo con menos puntos al de más puntos, así el
    // resultado nunca da negativo — la resta entre palos ya es la parte
    // difícil, no hace falta sumarle números negativos.
    const plusSuit = sumA >= sumB ? suitA : suitB
    const minusSuit = sumA >= sumB ? suitB : suitA
    correctValue = Math.max(sumA, sumB) - Math.min(sumA, sumB)
    prompt = `Sumá las cartas de ${SUIT_PLURAL[plusSuit]} y restá las de ${SUIT_PLURAL[minusSuit]}. ¿Cuánto da?`
    const otherSuits = SUITS.filter((s) => s !== plusSuit && s !== minusSuit)
    const seeds = [
      Math.max(sumA, sumB), // error típico: sumar y olvidarse de restar
      sumA + sumB, // error típico: sumar los dos palos en vez de restar
      ...otherSuits.map((s) => sumOf(grid.filter((c) => c.suit === s))),
    ]
    numericOptions = shuffle([correctValue, ...fillDecoys(correctValue, seeds, 3)])
  } else {
    // repeated
    prompt = '¿Cuál es la única carta que se repite?'
    const decoyPool = shuffle(grid.filter((c) => !cardEq(c, repeated as CardData)))
    const decoys: CardData[] = []
    for (const c of decoyPool) {
      if (decoys.length >= 3) break
      if (!decoys.some((d) => cardEq(d, c))) decoys.push(c)
    }
    cardOptions = shuffle([repeated as CardData, ...decoys])
  }

  const options: Option[] = cardOptions
    ? cardOptions.map((c) => ({ id: `${c.rank}-${c.suit}`, label: cardLabel(c) }))
    : (numericOptions as number[]).map((v) => ({ id: `${v}`, label: `${v}` }))
  const correctId = cardOptions ? `${(repeated as CardData).rank}-${(repeated as CardData).suit}` : `${correctValue}`

  return { rows, cols, grid, prompt, options, correctId }
}

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto del
// lote (ver ElDescuento.tsx).
const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)
const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3']

function SuitGlyph({ suit, size }: { suit: Suit; size: number }) {
  const s = size
  const color = SUIT_COLOR[suit]
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      {suit === 'oro' && (
        <>
          {/* Moneda lisa: disco dorado con un aro más oscuro marcando el
              borde, como en la baraja real (nada de cruces ni emblemas —
              a este tamaño sólo hace falta leerse como "moneda"). */}
          <circle cx={s * 0.5} cy={s * 0.5} r={s * 0.42} fill={color} stroke={SUIT_ACCENT} strokeWidth={s * 0.04} />
        </>
      )}
      {suit === 'copa' && (
        <>
          {/* Cáliz: copa + pie + base, silueta angosta-ancha-angosta-ancha,
              con un borde dorado en la boca (como el aro de la baraja real). */}
          <polygon points={`${s * 0.22},${s * 0.08} ${s * 0.78},${s * 0.08} ${s * 0.6},${s * 0.48} ${s * 0.4},${s * 0.48}`} fill={color} />
          <polygon points={`${s * 0.44},${s * 0.48} ${s * 0.56},${s * 0.48} ${s * 0.56},${s * 0.78} ${s * 0.44},${s * 0.78}`} fill={color} />
          <polygon points={`${s * 0.34},${s * 0.78} ${s * 0.66},${s * 0.78} ${s * 0.74},${s * 0.92} ${s * 0.26},${s * 0.92}`} fill={color} />
          <polygon points={`${s * 0.22},${s * 0.08} ${s * 0.78},${s * 0.08} ${s * 0.76},${s * 0.14} ${s * 0.24},${s * 0.14}`} fill={SUIT_ACCENT} />
        </>
      )}
      {suit === 'espada' && (
        <>
          {/* Espada: hoja azul en punta + guarda/puño/pomo dorados, como el
              acero y la empuñadura de la baraja real. */}
          <polygon
            points={`${s * 0.5},${s * 0.05} ${s * 0.58},${s * 0.24} ${s * 0.58},${s * 0.66} ${s * 0.42},${s * 0.66} ${s * 0.42},${s * 0.24}`}
            fill={color}
          />
          <polygon points={`${s * 0.2},${s * 0.66} ${s * 0.8},${s * 0.66} ${s * 0.8},${s * 0.75} ${s * 0.2},${s * 0.75}`} fill={SUIT_ACCENT} />
          <polygon points={`${s * 0.44},${s * 0.75} ${s * 0.56},${s * 0.75} ${s * 0.56},${s * 0.9} ${s * 0.44},${s * 0.9}`} fill={SUIT_ACCENT} />
          <circle cx={s * 0.5} cy={s * 0.93} r={s * 0.055} fill={SUIT_ACCENT} />
        </>
      )}
      {suit === 'basto' && (
        <>
          {/* Basto: garrote verde, cuerpo levemente cónico con puntas
              redondeadas y la punta superior dorada, como en la baraja real. */}
          <polygon points={`${s * 0.38},${s * 0.1} ${s * 0.62},${s * 0.1} ${s * 0.66},${s * 0.86} ${s * 0.34},${s * 0.86}`} fill={color} />
          <circle cx={s * 0.5} cy={s * 0.1} r={s * 0.15} fill={SUIT_ACCENT} />
          <circle cx={s * 0.5} cy={s * 0.86} r={s * 0.18} fill={color} />
        </>
      )}
    </svg>
  )
}

function PlayingCard({ card, width }: { card: CardData; width: number }) {
  const height = Math.round(width * 1.42)
  // El número de rango queda en tinta neutra (como el índice de esquina de
  // una baraja real); el color va en el glyph del palo, no en el número.
  const corner = (
    <div className="flex flex-col items-center leading-none" style={{ color: CARD_INK }}>
      <span className="font-extrabold" style={{ fontSize: width * 0.26 }}>
        {card.rank}
      </span>
      <SuitGlyph suit={card.suit} size={width * 0.18} />
    </div>
  )
  return (
    <div className="relative shrink-0 rounded-md border border-slate-200 bg-white shadow-sm" style={{ width, height }}>
      <div className="absolute left-1 top-0.5">{corner}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <SuitGlyph suit={card.suit} size={width * 0.42} />
      </div>
      <div className="absolute bottom-0.5 right-1 rotate-180">{corner}</div>
    </div>
  )
}

const PRAISE_GOOD = ['¡Exacto!', '¡Muy bien contado!', '¡Perfecto!', '¡Así se hace!']
const WRONG_HINTS = [
  'Ese no es — volvé a mirar la mesa con calma.',
  'Casi. Contá de nuevo despacito.',
  'No es esa. Probá con otra opción.',
]

export function MesaDeCartas({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  // Rounds for the WHOLE epoch (all 3 levels), generated once at mount —
  // never re-rolled just by revisiting a level, so "Repetir" hands back the
  // exact same tables.
  const [epochRounds] = useState(() =>
    ROUNDS_PER_LEVEL.map((count, lvlIdx) => Array.from({ length: count }, () => generateRound(lvlIdx))),
  )
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Toques equivocados, acumulados a través de niveles 1→2→3 y sólo en cero
  // en restartEpoch (reinicio real del día).
  const [mistakes, setMistakes] = useState(0)

  function guess(id: string) {
    if (!round || resolved) return
    if (id === round.correctId) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 900)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
      setHint(pickOne(WRONG_HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.

  // "Siguiente nivel" — avanza dentro del MISMO intento. epochRounds queda
  // como está: las mesas de cada nivel ya se decidieron al empezar la época.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
  }

  // Respalda el botón de reinicio "Repetir" en la tarjeta final del último
  // nivel (sólo se muestra ahí, así que siempre es un reinicio real del día
  // — mistakes se pone en cero siempre). roundKey siempre avanza acá: es el
  // contador de "qué intento es este" que usa el efecto de onComplete para
  // volver a dispararse en una repetición.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
    setMistakes(0)
  }
  // "Repetir" — las mismas mesas del intento recién terminado.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_NAMES.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const cardWidth = round ? (round.cols >= 4 ? 46 : 58) : 58

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {LEVEL_NAMES[levelIdx]}
        </span>
        {!done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {roundsForLevel}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {!done && round && (
        <>
          {/* Mesa de cartas */}
          <div
            className="mx-auto mt-4 grid w-fit gap-1.5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3"
            style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))` }}
          >
            {round.grid.map((card, i) => (
              <PlayingCard key={i} card={card} width={cardWidth} />
            ))}
          </div>

          <p className="mt-4 text-center text-base font-bold text-slate-900">{round.prompt}</p>

          {/* Opciones */}
          <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-3">
            {round.options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              const isCorrectShown = resolved && opt.id === round.correctId
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt.id)}
                  className={[
                    'min-h-[52px] rounded-2xl border-2 px-3 py-2 text-base font-bold capitalize transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-4 text-center text-base font-semibold text-tiam-green">{praise}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Resolviste las {roundsForLevel} mesas — completaste el nivel {levelIdx + 1}.
          </p>
          {levelIdx < LEVEL_NAMES.length - 1 ? (
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
