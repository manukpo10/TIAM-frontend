import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'

/**
 * "Memotest" — classic memory-pairs / concentration game, the only game in
 * the app where content actively hides again after being seen.
 *
 * Every other memory game here (QueHayEnLaMesa/CuatroPalabras/ListaDelMercado)
 * is built around a fixed study window followed by a single hidden test with
 * false-positive distractors. Memotest has none of that: no study phase,
 * zero distractors ever (every card has a real partner on the board), and
 * memorizing happens incidentally, turn by turn, while playing — the actual
 * classic-concentration-game feel, structurally the opposite of the
 * recognition-memory engine.
 *
 * Card positions are fixed for the whole round (shuffled once, never
 * reshuffled mid-round) — remembering WHERE you saw something is the point.
 * A mismatch is never penalized: both cards just hold visible long enough to
 * study, then quietly flip back — no red, no wiggle, no error tally, no
 * submit/grade moment. The round only ever ends at 100%.
 */

interface Animal {
  id: string
  label: string
}

const ANIMALS: Animal[] = [
  { id: 'abeja', label: 'abeja' },
  { id: 'burro', label: 'burro' },
  { id: 'delfin', label: 'delfín' },
  { id: 'elefante', label: 'elefante' },
  { id: 'gato', label: 'gato' },
  { id: 'mono', label: 'mono' },
  { id: 'oso', label: 'oso' },
  { id: 'pato', label: 'pato' },
  { id: 'rana', label: 'rana' },
  { id: 'tortuga', label: 'tortuga' },
  { id: 'vaca', label: 'vaca' },
  { id: 'cangrejo', label: 'cangrejo' },
  { id: 'jirafa', label: 'jirafa' },
  { id: 'leon', label: 'león' },
  { id: 'nutria', label: 'nutria' },
  { id: 'flamenco', label: 'flamenco' },
  { id: 'serpiente', label: 'serpiente' },
  { id: 'zorro', label: 'zorro' },
  { id: 'chancho', label: 'chancho' },
  { id: 'llama', label: 'llama' },
  { id: 'hipopotamo', label: 'hipopótamo' },
  { id: 'cebra', label: 'cebra' },
  { id: 'yacare', label: 'yacaré' },
  { id: 'nandu', label: 'ñandú' },
]

// L1 uses a curated, maximally-distinct subset so the very first round of a
// brand-new mechanic never confuses two similar silhouettes (e.g. oso/león).
const L1_IDS = ['gato', 'pato', 'vaca', 'elefante', 'mono', 'tortuga', 'rana', 'cangrejo']
const L1_POOL = ANIMALS.filter((a) => L1_IDS.includes(a.id))

interface Level {
  n: number
  name: string
  pairs: number
  pool: Animal[]
  asymmetric: boolean
  hint?: string
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', pairs: 3, pool: L1_POOL, asymmetric: false },
  { n: 2, name: 'Nivel 2', pairs: 6, pool: ANIMALS, asymmetric: false },
  {
    n: 3,
    name: 'Nivel 3',
    pairs: 9,
    pool: ANIMALS,
    asymmetric: true,
    hint: 'Ahora las parejas son distintas: una carta tiene el dibujo y la otra tiene el nombre. ¡Fijate bien!',
  },
]

interface CardData {
  pairId: string
  kind: 'image' | 'word'
  label: string
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/memotest/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildBoard(level: Level): CardData[] {
  const chosen = pick(level.pool, level.pairs)
  const cards: CardData[] = []
  for (const animal of chosen) {
    cards.push({ pairId: animal.id, kind: 'image', label: animal.label })
    cards.push({ pairId: animal.id, kind: level.asymmetric ? 'word' : 'image', label: animal.label })
  }
  return shuffle(cards)
}

const MISMATCH_LINES = [
  '¡Casi! Memorizalas para la próxima.',
  'No son pareja, pero ya sabés dónde están.',
  '¡Buen intento! Con cada vuelta vas a recordar más.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente memoria!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']

export function Memotest() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const board = useMemo(
    () => buildBoard(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<number[]>([])
  const [locked, setLocked] = useState(false)
  const [mismatchLine, setMismatchLine] = useState<string | null>(null)
  const [turns, setTurns] = useState(0)
  const [praise, setPraise] = useState(PRAISE[0])

  useEffect(() => {
    setMatchedIds(new Set())
    setPending([])
    setLocked(false)
    setMismatchLine(null)
    setTurns(0)
  }, [levelIdx, roundKey])

  const done = matchedIds.size >= level.pairs

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function handleTap(index: number) {
    if (locked || done) return
    const card = board[index]
    if (matchedIds.has(card.pairId)) return
    if (pending.includes(index)) return

    if (pending.length === 0) {
      setPending([index])
      return
    }

    const firstIndex = pending[0]
    setPending([firstIndex, index])
    setLocked(true)
    setTurns((t) => t + 1)

    if (board[firstIndex].pairId === board[index].pairId) {
      window.setTimeout(() => {
        setMatchedIds((prev) => new Set(prev).add(board[firstIndex].pairId))
        setPending([])
        setLocked(false)
      }, 500)
    } else {
      setMismatchLine(pickOne(MISMATCH_LINES))
      window.setTimeout(() => {
        setPending([])
        setLocked(false)
        setMismatchLine(null)
      }, 1200)
    }
  }

  function nextLevel() {
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setRoundKey((k) => k + 1)
  }

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          Memoria · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          {level.asymmetric ? 'Encontrá cada dibujo con su palabra' : 'Encontrá las parejas'}
        </h2>
        {!done && (
          <p className="mt-2 text-base text-slate-500">
            {level.hint ??
              'Tocá dos cartas. Si son iguales, quedan destapadas. Si no, se vuelven a tapar y las volvés a intentar.'}
          </p>
        )}
        <p className="mt-2 text-base font-semibold text-slate-500">
          Encontraste {matchedIds.size} de {level.pairs} parejas
        </p>
        <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
            style={{ width: `${(matchedIds.size / level.pairs) * 100}%` }}
          />
        </div>
      </div>

      {/* Board */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
        {board.map((card, index) => {
          const isMatched = matchedIds.has(card.pairId)
          const isFaceUp = isMatched || pending.includes(index)
          const img = card.kind === 'image' ? imgFor(card.pairId) : undefined

          return (
            <button
              key={index}
              type="button"
              disabled={isMatched || locked}
              onClick={() => handleTap(index)}
              aria-label={isFaceUp ? card.label : 'Carta tapada'}
              className={[
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 p-2 transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                isMatched
                  ? 'border-tiam-green bg-white ring-2 ring-tiam-green/30'
                  : isFaceUp
                    ? 'border-slate-200 bg-white'
                    : 'border-tiam-blue/20 bg-tiam-blue/10 hover:bg-tiam-blue/15 active:scale-95',
              ].join(' ')}
            >
              {isFaceUp &&
                (card.kind === 'image'
                  ? img && <img src={img} alt={card.label} className="h-full w-full object-contain" draggable={false} />
                  : (
                    <span className="text-center text-xs font-bold leading-tight text-slate-700 sm:text-sm">
                      {card.label}
                    </span>
                  ))}

              {isMatched && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {mismatchLine && !done && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">{mismatchLine}</p>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste las {level.pairs} parejas en {turns} vueltas — completaste el {level.name.toLowerCase()}!
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
