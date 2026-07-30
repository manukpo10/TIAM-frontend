import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Mesa de cartas" — día 29 del Mes 2, cierre del área cálculo. Una grilla
 * de cartas españolas... no, de baraja francesa (♥♦♣♠) renderizadas 100% en
 * SVG/CSS (sin ningún asset), y una pregunta a la vez de un pool que rota:
 * contar un palo/color/valor, sumar una fila o columna, o encontrar la
 * única carta repetida. Selección múltiple, nunca teclado.
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
 * "¿cuántos corazones hay?" un distractor es el conteo de OTRO palo (el
 * error de confundir de cuál palo se preguntaba); para una suma de fila, un
 * distractor es la suma de OTRA fila. Ver fillDecoys().
 *
 * La grilla crece con el nivel (2×3 → 3×3 → 3×4, 6/9/12 cartas) y el pool de
 * preguntas se amplía: nivel 1 sólo cuenta (palo/color/valor); nivel 2 suma
 * una fila o columna; nivel 3 agrega la carta repetida — la pregunta más
 * exigente porque obliga a comparar la grilla entera, no sólo escanearla.
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" del resto del lote (ver ElDescuento.tsx).
 */

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
type Rank = (typeof RANKS)[number]

interface CardData {
  rank: Rank
  suit: Suit
}

const SUIT_PLURAL: Record<Suit, string> = { hearts: 'corazones', diamonds: 'diamantes', clubs: 'tréboles', spades: 'picas' }
const RANK_SIMPLE: Record<Rank, string> = {
  A: 'As', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  J: 'Jota', Q: 'Reina', K: 'Rey',
}
const RANK_ARTICLE: Record<Rank, string> = {
  A: 'el', '2': 'el', '3': 'el', '4': 'el', '5': 'el', '6': 'el', '7': 'el', '8': 'el', '9': 'el', '10': 'el',
  J: 'la', Q: 'la', K: 'el',
}

function cardValue(rank: Rank): number {
  if (rank === 'A') return 1
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  return Number(rank)
}
function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds'
}
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

type QuestionType = 'countSuit' | 'countColor' | 'countRank' | 'rowSum' | 'colSum' | 'repeated'

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
  ['countSuit', 'countColor', 'countRank'],
  ['countSuit', 'countColor', 'countRank', 'rowSum'],
  ['countSuit', 'countColor', 'countRank', 'rowSum', 'colSum', 'repeated'],
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
  } else if (type === 'countColor') {
    const wantRed = Math.random() < 0.5
    correctValue = grid.filter((c) => isRed(c.suit) === wantRed).length
    prompt = `¿Cuántas cartas ${wantRed ? 'rojas' : 'negras'} hay?`
    const seeds = [grid.filter((c) => isRed(c.suit) !== wantRed).length]
    numericOptions = shuffle([correctValue, ...fillDecoys(correctValue, seeds, 3)])
  } else if (type === 'countRank') {
    const rank = pickOne(RANKS)
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

function SuitGlyph({ suit, size, color }: { suit: Suit; size: number; color: string }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      {suit === 'diamonds' && (
        <polygon points={`${s * 0.5},${s * 0.05} ${s * 0.92},${s * 0.5} ${s * 0.5},${s * 0.95} ${s * 0.08},${s * 0.5}`} fill={color} />
      )}
      {suit === 'hearts' && (
        <>
          <circle cx={s * 0.32} cy={s * 0.36} r={s * 0.22} fill={color} />
          <circle cx={s * 0.68} cy={s * 0.36} r={s * 0.22} fill={color} />
          <polygon points={`${s * 0.06},${s * 0.42} ${s * 0.94},${s * 0.42} ${s * 0.5},${s * 0.94}`} fill={color} />
        </>
      )}
      {suit === 'spades' && (
        <>
          <circle cx={s * 0.32} cy={s * 0.62} r={s * 0.2} fill={color} />
          <circle cx={s * 0.68} cy={s * 0.62} r={s * 0.2} fill={color} />
          <polygon points={`${s * 0.5},${s * 0.04} ${s * 0.92},${s * 0.6} ${s * 0.08},${s * 0.6}`} fill={color} />
          <polygon points={`${s * 0.42},${s * 0.68} ${s * 0.58},${s * 0.68} ${s * 0.5},${s * 0.96}`} fill={color} />
        </>
      )}
      {suit === 'clubs' && (
        <>
          <circle cx={s * 0.5} cy={s * 0.28} r={s * 0.2} fill={color} />
          <circle cx={s * 0.3} cy={s * 0.54} r={s * 0.2} fill={color} />
          <circle cx={s * 0.7} cy={s * 0.54} r={s * 0.2} fill={color} />
          <polygon points={`${s * 0.4},${s * 0.62} ${s * 0.6},${s * 0.62} ${s * 0.5},${s * 0.96}`} fill={color} />
        </>
      )}
    </svg>
  )
}

function PlayingCard({ card, width }: { card: CardData; width: number }) {
  const color = isRed(card.suit) ? '#dc2626' : '#1e293b'
  const height = Math.round(width * 1.42)
  const corner = (
    <div className="flex flex-col items-center leading-none" style={{ color }}>
      <span className="font-extrabold" style={{ fontSize: width * 0.26 }}>
        {card.rank}
      </span>
      <SuitGlyph suit={card.suit} size={width * 0.18} color={color} />
    </div>
  )
  return (
    <div className="relative shrink-0 rounded-md border border-slate-200 bg-white shadow-sm" style={{ width, height }}>
      <div className="absolute left-1 top-0.5">{corner}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <SuitGlyph suit={card.suit} size={width * 0.42} color={color} />
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

  const rounds = useMemo(
    () => Array.from({ length: roundsForLevel }, () => generateRound(levelIdx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Toques equivocados, acumulados a través de niveles 1→2→3 y sólo en cero
  // en un reinicio real del día (ver la rama isWrap de nextLevel).
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
  function nextLevel() {
    const isWrap = levelIdx === LEVEL_NAMES.length - 1
    setLevelIdx((i) => (i < LEVEL_NAMES.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
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

          {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-4 text-center text-sm font-semibold text-tiam-green">{praise}</p>}
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
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVEL_NAMES.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra mesa
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
