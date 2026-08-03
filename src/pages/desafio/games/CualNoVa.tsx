import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Cuál no va?" — día 11, atención/razonamiento. An odd-one-out game
 * (concept-formation / abstraction): a set of object photos where all but one
 * belong to a shared category — tap the intruder. It replaces the recognition-
 * memory game that día 11 previously ran, which was mechanically identical to
 * día 2 (same study→recall engine, different item set) — a genuine duplicate.
 *
 * The puzzle content is CATEGORY-FIRST: clean everyday categories (fruit,
 * animals, clothes, furniture, tools, things-you-drink-from, round things,
 * things-that-fly, things-that-give-light, things-to-write-with) with one
 * unambiguous intruder each. The photos are a purpose-built set for this game
 * (same photoreal white-background style as the rest of the challenge), not a
 * patchwork borrowed from other days — an earlier version reverse-engineered
 * the categories from whatever images happened to exist, which read as forced.
 *
 * Difficulty ramps on two axes at once:
 *   - how NEAR the intruder is: L1 a far domain (a hammer among fruit), L2 an
 *     adjacent category (a carrot among fruit; a food among drinking vessels),
 *     L3 a shared abstract property (the one thing that isn't round; the one
 *     that doesn't fly).
 *   - how MANY items to scan: L1 shows 4 options, L2/L3 show 5.
 * On a correct tap the shared category is named ("Las demás son frutas") so the
 * reasoning is reinforced, not just scored.
 *
 * House style: a wrong tap eliminates that photo (muted grey, never red) and
 * nudges; no timer. Double-tap safe (the eliminated set is an idempotent Set
 * add; a resolved round ignores further taps). Content re-rolls per play (pools
 * per level, drawn at random).
 */

interface Puzzle {
  members: string[]
  intruder: string
  categoria: string // named on solve: "Las demás son {categoria}"
}
interface Level {
  n: number
  name: string
  rounds: number
  pool: Puzzle[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    // Far intruder — a different domain entirely. 4 options (3 + intruder).
    pool: [
      { members: ['manzana', 'naranja', 'uvas'], intruder: 'martillo', categoria: 'frutas' },
      { members: ['perro', 'gato', 'caballo'], intruder: 'pelota', categoria: 'animales' },
      { members: ['camisa', 'pantalon', 'zapato'], intruder: 'banana', categoria: 'ropa' },
      { members: ['silla', 'mesa', 'sillon'], intruder: 'paraguas', categoria: 'muebles' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 3,
    // Adjacent intruder — same broad world, wrong sub-category. 5 options.
    pool: [
      { members: ['manzana', 'pera', 'naranja', 'uvas'], intruder: 'zanahoria', categoria: 'frutas' },
      { members: ['martillo', 'destornillador', 'pinza', 'llave-inglesa'], intruder: 'cuchara', categoria: 'herramientas' },
      { members: ['vaso', 'taza', 'mate', 'botella'], intruder: 'plato', categoria: 'cosas para tomar' },
      { members: ['zanahoria', 'tomate', 'papa', 'cebolla'], intruder: 'manzana', categoria: 'verduras' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 3,
    // Abstract-property intruder — the members share a property, not a label. 5 options.
    pool: [
      { members: ['pelota', 'naranja', 'reloj', 'moneda'], intruder: 'libro', categoria: 'cosas redondas' },
      { members: ['paloma', 'mariposa', 'avion', 'globo'], intruder: 'auto', categoria: 'cosas que vuelan' },
      { members: ['lampara', 'vela', 'linterna', 'farol'], intruder: 'radio', categoria: 'cosas que dan luz' },
      { members: ['lapiz', 'lapicera', 'tiza', 'marcador'], intruder: 'tijera', categoria: 'cosas para escribir' },
    ],
  },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/cual-no-va/*.webp', {
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

const HINTS = [
  'Ese va con los demás. Buscá el que es de otra clase.',
  'No es ese — fijate qué tienen en común casi todos, y cuál sobra.',
  'Casi. Mirá bien: hay uno que no es del mismo grupo.',
]
const PRAISE = ['¡Muy bien!', '¡Exacto!', '¡Así se razona!', '¡Perfecto!']

export function CualNoVa({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which puzzle order (drawn from the level's pool) is playing for level i
  // THIS "epoch" (a full 3-level pass). Decided once per epoch — at mount,
  // and again on "Hacer otro" — never re-rolled just because the player
  // re-visits a level, so "Repetir" can hand back the exact same puzzles
  // deterministically instead of re-randomizing.
  const [epochOrder, setEpochOrder] = useState(() =>
    LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)),
  )
  const level = LEVELS[levelIdx]
  const order = epochOrder[levelIdx]

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const puzzle = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (puzzle ? shuffle([...puzzle.members, puzzle.intruder]) : []), [puzzle])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(id: string) {
    if (!puzzle || solved || eliminated.has(id)) return
    if (id === puzzle.intruder) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
      }, 1100)
    } else {
      setEliminated((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  // "Siguiente nivel" — advance within the SAME attempt. epochOrder is left
  // alone: level i+1's puzzle order was already decided when this epoch
  // started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
  }

  // Shared by both restart buttons on level 3's complete card (only ever
  // shown once the final level is done, so always a genuine day restart —
  // zero the accumulators either way). roundKey always bumps here: it's the
  // "which attempt is this" generation counter the onComplete effect uses
  // to fire again on a replay, independent of whether the puzzles changed.
  function restartEpoch() {
    setLevelIdx(0)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setMistakes(0)
    setCorrectCount(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same puzzles as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random puzzle order per level.
  function restartDifferent() {
    restartEpoch()
    setEpochOrder(LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base font-semibold text-slate-700">Tocá el que NO va con los demás.</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
          </>
        )}
      </div>

      {!done && puzzle && (
        <>
          {/* Opciones (fotos). flex-wrap centra la fila impar (5 opciones = 2+2+1). */}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {options.map((id) => {
              const isEliminated = eliminated.has(id)
              const isIntruder = solved && id === puzzle.intruder
              const img = imgFor(id)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(id)}
                  className={[
                    'relative flex h-24 w-[46%] items-center justify-center rounded-2xl border-2 bg-white p-2 transition sm:h-28',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isIntruder ? 'border-tiam-green ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 grayscale' : '',
                    !isIntruder && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                </button>
              )
            })}
          </div>

          {solved && (
            <p className="mt-4 text-center text-base font-semibold text-tiam-green">
              ¡Ese es! Las demás son {puzzle.categoria}.
            </p>
          )}
          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
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
            Encontraste los {order.length} intrusos — completaste el nivel {levelIdx + 1}.
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
            // Two ways to go again: "Repetir" replays the identical
            // puzzles, "Hacer otro" draws a fresh order per level — same
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
          )}
        </div>
      )}
    </div>
  )
}
