import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Cuál es cuál?" — ejecutivas, capacidad asociativa. Adapts a classic
 * paper worksheet — numbered items down one side, loose items in the
 * middle, draw a line from each loose item to the card it belongs with
 * (vaca↔leche, gallina↔huevo, tornillo↔destornillador…) — to touch: two
 * columns, tap one item on the left and its partner on the right to draw
 * the "arrow" between them. Correct locks the pair in; wrong clears the
 * pick and nudges with a hint, same two-tap resolve/clear flow as
 * CuantoSuma (this game's closest structural sibling — reused rather than
 * inventing a new interaction shape).
 *
 * TEXT, not images: the worksheet's demand is semantic association ("what
 * goes with what"), not visual recognition, and this app's asset folders
 * don't cover concepts like "envelope" or "screwdriver" anyway — plain
 * words carry the exercise fine.
 *
 * Differs from FotosConectadas (three photos converge on ONE shared
 * concept, single multiple-choice pick) and CadaCosaEnSuGrupo (one word
 * at a time sorted into a category bucket that stays open the whole
 * round): here every item has its OWN one-to-one partner, all pairs are
 * visible on screen at once, and the match is between two specific
 * things, not between a thing and a group.
 *
 * Content is a fixed, hand-authored set per level — NOT drawn from a
 * larger pool — because unambiguity has to be verified per ROUND (every
 * left item must have exactly one plausible right-side partner present),
 * and that check only stays valid if the round composition never changes.
 * "Repetir" therefore only reshuffles the on-screen left/right order, never
 * the pairs themselves (see nextLevel below) — the pairs never change, only
 * their arrangement.
 *
 * Difficulty ramps by association tightness, not by pair count alone.
 * Nivel 1's four pairs are each from a totally different domain (mate,
 * weather, mail, hardware) so nothing in the round competes with anything
 * else. Nivel 3 deliberately clusters three animal→product pairs (vaca/
 * leche, gallina/huevo, abeja/miel) so a careless tap can land on a
 * plausible-but-wrong match of the same CATEGORY — but no animal in that
 * round actually produces more than one of the products on screen, so
 * every pair still resolves to exactly one correct partner. Farm-animal
 * pairs are also kept out of any round that also has asado/parrilla or
 * pan/horno — in Argentine cooking almost any animal ends up "a la
 * parrilla" or "al horno" sooner or later, which would make an animal
 * plausibly point at a cooking method instead of its product.
 */

interface Pair {
  id: string
  left: string
  right: string
}
interface Level {
  n: number
  name: string
  pairs: Pair[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    // Four unrelated domains (mate, clima, correo, herramienta) — nothing
    // here shares a category with anything else in the round.
    pairs: [
      { id: 'mate', left: 'mate', right: 'bombilla' },
      { id: 'lluvia', left: 'lluvia', right: 'paraguas' },
      { id: 'carta', left: 'carta', right: 'sobre' },
      { id: 'tornillo', left: 'tornillo', right: 'destornillador' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    // asado/parrilla and pan/horno share a "cocina" flavour, but each
    // word's canonical Argentine partner doesn't cross over (nobody says
    // "asado al horno" or "pan a la parrilla") — no farm animal is in
    // this round, so neither cooking word can pull toward an animal.
    pairs: [
      { id: 'invierno', left: 'invierno', right: 'bufanda' },
      { id: 'lapiz', left: 'lápiz', right: 'sacapuntas' },
      { id: 'perro', left: 'perro', right: 'hueso' },
      { id: 'asado', left: 'asado', right: 'parrilla' },
      { id: 'pan', left: 'pan', right: 'horno' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    // The interference round: vaca/leche, gallina/huevo and abeja/miel
    // are all "animal → product" pairs, so a rushed tap can aim at the
    // right CATEGORY and the wrong specific item (miel for the cow,
    // huevo for the bee…) — genuinely harder, never genuinely ambiguous,
    // since no animal here makes more than one of the three products.
    // aguja/hilo and llave/cerradura add a second, milder "herramienta"
    // echo without tornillo present, so "llave" can't be misread as a
    // wrench reaching for a tornillo that isn't in this round.
    pairs: [
      { id: 'aguja', left: 'aguja', right: 'hilo' },
      { id: 'llave', left: 'llave', right: 'cerradura' },
      { id: 'vaca', left: 'vaca', right: 'leche' },
      { id: 'gallina', left: 'gallina', right: 'huevo' },
      { id: 'abeja', left: 'abeja', right: 'miel' },
      { id: 'cama', left: 'cama', right: 'almohada' },
    ],
  },
]

const TOTAL_PAIRS = LEVELS.reduce((sum, l) => sum + l.pairs.length, 0)

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
/** A shuffle of `pairs` in which no pair keeps the row it holds in
 * `reference` — i.e. the right column never shows a pair's partner at the
 * same height as the pair itself. A clean draw comes up roughly a third of
 * the time for these round sizes, so the retry loop ends in a couple of
 * passes; the fallback shifts `reference` by one row, which cannot collide
 * because the ids are unique. */
function shuffleOffRows(pairs: Pair[], reference: Pair[]): Pair[] {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = shuffle(pairs)
    if (candidate.every((pair, i) => pair.id !== reference[i].id)) return candidate
  }
  return reference.map((_, i) => reference[(i + 1) % reference.length])
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esos dos no van juntos — probá con otra pareja.',
  'Casi. Pensá bien qué va con qué y volvé a intentar.',
  'No es esa pareja. Fijate cuál le corresponde a cada uno.',
]

export function CualEsCual({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // The SET of pairs per level is fixed content (see LEVELS above) — only
  // the on-screen ORDER is reshuffled per level and restart. Shuffling both
  // columns independently was not enough: with four pairs, a pair landing on
  // the same row as its partner happens more often than not, and a row that
  // lines up gives the answer away without reading the words at all. The
  // right column is now drawn AGAINST the left one, so no pair ever shares a
  // row.
  const leftOrder = useMemo(
    () => shuffle(level.pairs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const rightOrder = useMemo(
    () => shuffleOffRows(level.pairs, leftOrder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, leftOrder],
  )

  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [pickedLeft, setPickedLeft] = useState<string | null>(null)
  const [pickedRight, setPickedRight] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3, only zeroed on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  const done = matched.size === level.pairs.length

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function resolve(leftId: string | null, rightId: string | null) {
    if (leftId === null || rightId === null) return
    if (leftId === rightId) {
      setMatched((prev) => new Set(prev).add(leftId))
      setHint(null)
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
    setPickedLeft(null)
    setPickedRight(null)
  }

  function tapLeft(id: string) {
    if (matched.has(id) || done) return
    if (pickedLeft === id) {
      setPickedLeft(null)
      return
    }
    setPickedLeft(id)
    if (pickedRight !== null) resolve(id, pickedRight)
  }
  function tapRight(id: string) {
    if (matched.has(id) || done) return
    if (pickedRight === id) {
      setPickedRight(null)
      return
    }
    setPickedRight(id)
    if (pickedLeft !== null) resolve(pickedLeft, id)
  }

  // Resets happen HERE, synchronously with the level change, not in an
  // effect keyed on levelIdx — an effect lags one render behind, so `done`
  // (derived straight from `matched`) would read the previous level's
  // stale-true value on the very render that arrives at the new level and
  // fire onComplete with garbage. Same reasoning as SumaHastaDiez/CuantoSuma.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setMatched(new Set())
    setPickedLeft(null)
    setPickedRight(null)
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (the wrap back to level 1) gets a new roundKey, so it can report
  // again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PAIRS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Uní cada cosa con su pareja</h2>
        <p className="mt-2 text-base text-slate-500">Tocá uno de la izquierda y después el de la derecha.</p>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Llevás {matched.size} de {level.pairs.length}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${level.pairs.length ? (matched.size / level.pairs.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5">
        <div className="flex flex-col gap-2 sm:gap-3">
          {leftOrder.map((pair) => {
            const isMatched = matched.has(pair.id)
            const isPicked = pickedLeft === pair.id
            return (
              <button
                key={pair.id}
                type="button"
                disabled={isMatched}
                onClick={() => tapLeft(pair.id)}
                aria-pressed={isPicked || isMatched}
                className={[
                  'flex min-h-[52px] items-center justify-center rounded-2xl border-2 bg-white px-2 py-2 text-center text-sm font-bold leading-tight text-slate-700 transition sm:min-h-[60px] sm:text-base',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  isMatched ? 'border-tiam-green bg-tiam-green/5 opacity-60' : '',
                  isPicked ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                  !isMatched && !isPicked
                    ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                    : '',
                ].join(' ')}
              >
                {pair.left}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 sm:gap-3">
          {rightOrder.map((pair) => {
            const isMatched = matched.has(pair.id)
            const isPicked = pickedRight === pair.id
            return (
              <button
                key={pair.id}
                type="button"
                disabled={isMatched}
                onClick={() => tapRight(pair.id)}
                aria-pressed={isPicked || isMatched}
                className={[
                  'relative flex min-h-[52px] items-center justify-center rounded-2xl border-2 bg-white px-2 py-2 text-center text-sm font-bold leading-tight text-slate-700 transition sm:min-h-[60px] sm:text-base',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  isMatched ? 'border-tiam-green bg-tiam-green/5 opacity-60' : '',
                  isPicked ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                  !isMatched && !isPicked
                    ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                    : '',
                ].join(' ')}
              >
                {pair.right}
                {isMatched && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {hint && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Uniste las {level.pairs.length} parejas — ¡completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
