import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "A viajar" — día 24, ejecutivas (replaces "¿Cómo se llamaba?", which stays
 * on disk unused per this catalog's convention — see registry.ts). A table
 * with one row per person and two answer columns, TRANSPORTE and DESTINO,
 * plus two separate word banks below the table (one per column:
 * "Transportes" and "Destinos"). Tap a word in either bank, then tap the
 * matching-type blank cell to place it — tapping an already-placed cell
 * sends its word back to its own bank. The clue list above the table
 * (always visible) is the only way to deduce the full assignment. Checked
 * automatically once every cell in the table has a word: all correct solves
 * the level; otherwise it's one mistake, a gentle hint, and only the WRONG
 * placements return to their bank (correct ones stay put, so the player
 * never loses progress they already earned).
 *
 * SAME FAMILY AS CasasDelBarrio.tsx (día 29, orientación) — both are small
 * CONSTRAINT-SATISFACTION puzzles where several clues have to be held in
 * mind and combined (often chained) to deduce a full assignment, closer to a
 * mini logic-grid puzzle than a lookup or a recognition check. The shapes
 * differ: CasasDelBarrio assigns ONE attribute (a name) to a fixed grid
 * position. This game assigns TWO independent attributes (a transporte AND
 * a destino) to each person, so every row has two separate blanks that must
 * each be solved on their own — hence two banks instead of one, each scoped
 * to its own column (a transporte word never fits a destino cell, and a
 * destino word never fits a transporte cell; each person's own name is
 * never a tap target, same as CasasDelBarrio's row/column headers).
 *
 * CONTENT: hand-authored, ONE puzzle per level — unlike CasasDelBarrio's
 * 2-puzzle pool per level, there is nothing to randomize level-to-level
 * here, since the difficulty ramp (3 people/4 clues → 4 people/6 clues → 4
 * people/7 clues) IS the content. Only the banks' DISPLAY order is shuffled
 * (cosmetic only, via `useMemo`, same mechanism as CasasDelBarrio's
 * `shuffledNames`) — which puzzle plays at each level never varies, so
 * "Repetir" always replays the exact same 3 puzzles.
 *
 * Nivel 3 is a faithful digitization of the requester's own reference
 * worksheet. Its source phrased two facts as one sentence ("Pedro va a
 * Salamanca, pero no va en moto."); they're split into two plain bullets
 * here for a shorter read at this reading level — same information, nothing
 * lost. Its closing line ("Uno de ellos va a Valencia.") renders AFTER the
 * deduction clues in a visibly softer/lighter style: it's true by
 * construction once the table is filled, not a fact needed to solve the
 * puzzle, and must never be mistaken for an 8th deduction clue.
 *
 * UNIQUENESS: all 3 puzzles were verified by the author with a brute-force
 * script over every permutation of modos × destinos before this file
 * existed — exactly one assignment satisfies every clue in each puzzle, and
 * it matches the `solution` shipped below. A second throwaway Node script
 * (TypeScript's transpileModule against this file's own LEVELS data)
 * confirmed the transcription: each level's word banks are each used by
 * exactly one solution slot (no leftover/duplicate), and the shipped
 * solution matches the author's given answer verbatim. Neither script is
 * part of this commit — see the PR/session notes.
 *
 * One puzzle solved = one level done (no rounds within a level, same shape
 * as CasasDelBarrio) — `totalAttempts` is mistakes plus a FIXED total of
 * table cells across all three levels: (3 + 4 + 4) people × 2 columns = 22.
 */

interface Puzzle {
  people: string[]
  modos: string[]
  destinos: string[]
  /** person -> correct { modo, destino }. */
  solution: Record<string, { modo: string; destino: string }>
  clues: string[]
  /** Nivel 3 only — a purely decorative line shown after the clues, true by
   * construction once the table is filled, never needed to solve it. */
  flavor?: string
}

interface Level {
  n: number
  name: string
  puzzle: Puzzle
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

// ── Puzzles — hand-authored, one per level, pre-verified by the requester
// (brute-force over every modo × destino permutation) to have exactly one
// solution, matching what's shipped here. See file header for how that was
// re-checked for transcription accuracy.

const PUZZLE_L1: Puzzle = {
  people: ['Mora', 'Bruno', 'Nico'],
  modos: ['Bici', 'Auto', 'Tren'],
  destinos: ['Luján', 'Tandil', 'Mar del Plata'],
  solution: {
    Mora: { modo: 'Bici', destino: 'Tandil' },
    Bruno: { modo: 'Auto', destino: 'Mar del Plata' },
    Nico: { modo: 'Tren', destino: 'Luján' },
  },
  clues: [
    'Mora va en bici.',
    'Bruno va en auto.',
    'Mora va a Tandil.',
    'Quien va en auto va a Mar del Plata.',
  ],
}

const PUZZLE_L2: Puzzle = {
  people: ['Lucía', 'Martín', 'Darío', 'Vale'],
  modos: ['Barco', 'Tren', 'Bici', 'Auto'],
  destinos: ['Rosario', 'Córdoba', 'Neuquén', 'Salta'],
  solution: {
    Lucía: { modo: 'Barco', destino: 'Rosario' },
    Martín: { modo: 'Tren', destino: 'Neuquén' },
    Darío: { modo: 'Auto', destino: 'Córdoba' },
    Vale: { modo: 'Bici', destino: 'Salta' },
  },
  clues: [
    'Lucía va en barco.',
    'Martín va en tren.',
    'Darío no viaja en bici.',
    'Vale va a Salta.',
    'Lucía va a Rosario.',
    'Quien va en auto va a Córdoba.',
  ],
}

const PUZZLE_L3: Puzzle = {
  people: ['Juan', 'Pedro', 'María', 'Elisa'],
  modos: ['Avión', 'Bicicleta', 'Moto', 'Coche'],
  destinos: ['Salamanca', 'Sevilla', 'Aranjuez', 'Valencia'],
  solution: {
    Juan: { modo: 'Moto', destino: 'Valencia' },
    Pedro: { modo: 'Coche', destino: 'Salamanca' },
    María: { modo: 'Bicicleta', destino: 'Aranjuez' },
    Elisa: { modo: 'Avión', destino: 'Sevilla' },
  },
  clues: [
    'Ni Juan ni Pedro van en avión.',
    'Pedro va a Salamanca.',
    'Pedro no va en moto.',
    'Quien va en bicicleta va a Aranjuez.',
    'Juan no va en coche.',
    'Ni Juan, ni Elisa ni Pedro van en bicicleta.',
    'A Sevilla se va en avión.',
  ],
  // Decorative only — see file header. Rendered in a visibly softer style,
  // never inside the clue <ul>, so it can't be mistaken for an 8th clue.
  flavor: 'Uno de ellos va a Valencia.',
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', puzzle: PUZZLE_L1 },
  { n: 2, name: 'Nivel 2', puzzle: PUZZLE_L2 },
  { n: 3, name: 'Nivel 3', puzzle: PUZZLE_L3 },
]

// Fixed total of table cells across all three levels ((3+4+4) people × 2
// columns = 22) — derived from the data rather than a bare literal, so it
// can't silently drift if a puzzle's people count ever changes.
const TOTAL_BLANKS = LEVELS.reduce((sum, lvl) => sum + lvl.puzzle.people.length * 2, 0)

const PRAISE = ['¡Muy bien!', '¡Excelente sentido de la orientación!', '¡Así se viaja!', '¡Perfecto!']
const HINTS = [
  'Algo de eso no va ahí — volvió a la lista. Repasá las pistas y probá de nuevo.',
  'Casi. Uno de los datos no corresponde a esa persona — fijate bien en las pistas.',
  'Esa combinación no cierra. Uno volvió a la lista — pensalo de nuevo con calma.',
]

export function AViajar({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const puzzle = level.puzzle

  // Cosmetic only — WHICH puzzle plays at each level never varies (see file
  // header), only the banks' display order does, recomputed whenever the
  // level (and so `puzzle`'s reference) changes — same mechanism as
  // CasasDelBarrio's `shuffledNames`.
  const shuffledModos = useMemo(() => shuffle(puzzle.modos), [puzzle])
  const shuffledDestinos = useMemo(() => shuffle(puzzle.destinos), [puzzle])

  // person -> word currently placed in that column. Two independent maps
  // since a transporte word and a destino word are never interchangeable.
  const [modoPlacements, setModoPlacements] = useState<Record<string, string>>({})
  const [destinoPlacements, setDestinoPlacements] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<{ kind: 'modo' | 'destino'; value: string } | null>(null)
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates 1→2→3 across levels; zeroed ONLY on the genuine day restart
  // (wrap from level 3 back to level 1).
  const [mistakes, setMistakes] = useState(0)

  const modoBank = shuffledModos.filter((word) => !Object.values(modoPlacements).includes(word))
  const destinoBank = shuffledDestinos.filter((word) => !Object.values(destinoPlacements).includes(word))

  function isComplete(modo: Record<string, string>, destino: Record<string, string>) {
    return puzzle.people.every((person) => modo[person] && destino[person])
  }

  function validate(finalModo: Record<string, string>, finalDestino: Record<string, string>) {
    const allCorrect = puzzle.people.every(
      (person) =>
        finalModo[person] === puzzle.solution[person].modo &&
        finalDestino[person] === puzzle.solution[person].destino,
    )
    if (allCorrect) {
      setSolved(true)
      setPraise(pickOne(PRAISE))
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    // Only the WRONG placements return to their bank — correct ones stay put.
    const clearedModo = { ...finalModo }
    const clearedDestino = { ...finalDestino }
    for (const person of puzzle.people) {
      if (clearedModo[person] !== puzzle.solution[person].modo) delete clearedModo[person]
      if (clearedDestino[person] !== puzzle.solution[person].destino) delete clearedDestino[person]
    }
    setModoPlacements(clearedModo)
    setDestinoPlacements(clearedDestino)
  }

  function placeModo(person: string) {
    if (!selected || selected.kind !== 'modo' || solved) return
    setHint(null)
    const next = { ...modoPlacements, [person]: selected.value }
    setModoPlacements(next)
    setSelected(null)
    if (isComplete(next, destinoPlacements)) validate(next, destinoPlacements)
  }

  function placeDestino(person: string) {
    if (!selected || selected.kind !== 'destino' || solved) return
    setHint(null)
    const next = { ...destinoPlacements, [person]: selected.value }
    setDestinoPlacements(next)
    setSelected(null)
    if (isComplete(modoPlacements, next)) validate(modoPlacements, next)
  }

  function unplaceModo(person: string) {
    if (solved) return
    setHint(null)
    setModoPlacements((prev) => {
      if (!(person in prev)) return prev
      const next = { ...prev }
      delete next[person]
      return next
    })
  }

  function unplaceDestino(person: string) {
    if (solved) return
    setHint(null)
    setDestinoPlacements((prev) => {
      if (!(person in prev)) return prev
      const next = { ...prev }
      delete next[person]
      return next
    })
  }

  // Resets happen HERE, synchronously with the level/puzzle change, never in
  // a useEffect keyed on levelIdx — an effect lags one render behind, so the
  // onComplete-reporting effect below would read the PREVIOUS puzzle's
  // stale `solved === true` on the render that just arrived at the new
  // level, and fire onComplete with garbage. Same reasoning as
  // CasasDelBarrio/SumaHastaDiez/Coordenadas.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setModoPlacements({})
    setDestinoPlacements({})
    setSelected(null)
    setHint(null)
    setSolved(false)
    if (isWrap) {
      // Genuine day restart — the mistake counter zeroes. Puzzle content
      // never varies by level anyway (see file header), so there's nothing
      // to re-roll: "Repetir" always replays the exact same 3 puzzles.
      setMistakes(0)
    }
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey when the LAST level is solved. A genuine day
  // restart gets a new roundKey (via nextLevel's wrap branch), so a full
  // replay of the day can report again; re-rendering while already solved
  // on level 3 cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (solved && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_BLANKS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, levelIdx, roundKey, mistakes])

  const totalForLevel = puzzle.people.length * 2
  const filledCount = Object.keys(modoPlacements).length + Object.keys(destinoPlacements).length

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">A viajar</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá una palabra de la lista y después la casilla donde creas que va, según las pistas.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Colocaste {filledCount} de {totalForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                  style={{ width: `${(filledCount / totalForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Table — one row per person, two answer columns. Stays visible once
          solved too, as a read-only recap, same convention as
          CasasDelBarrio's house grid. A narrow fixed name column plus two
          equal-width flex columns keeps this legible at 375px without any
          column-specific arbitrary widths. */}
      <div className="mx-auto mt-5 w-full max-w-[440px]">
        <div className="flex items-end gap-1.5 sm:gap-2.5">
          <div className="w-14 shrink-0 sm:w-16" />
          <p className="flex-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">
            Transporte
          </p>
          <p className="flex-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">
            Destino
          </p>
        </div>
        {puzzle.people.map((person) => {
          const placedModo = modoPlacements[person]
          const placedDestino = destinoPlacements[person]
          const modoFilled = Boolean(placedModo)
          const destinoFilled = Boolean(placedDestino)
          const modoInteractive = !solved && (modoFilled || (selected !== null && selected.kind === 'modo'))
          const destinoInteractive = !solved && (destinoFilled || (selected !== null && selected.kind === 'destino'))
          return (
            <div key={person} className="mt-1.5 flex items-stretch gap-1.5 sm:gap-2.5">
              {/* The person's own name — a row header, never a tap target,
                  same as CasasDelBarrio's anchors. */}
              <div className="flex w-14 shrink-0 items-center justify-end pr-1 text-right text-xs font-bold leading-tight text-slate-800 sm:w-16 sm:text-sm">
                {person}
              </div>
              <button
                type="button"
                disabled={!modoInteractive}
                onClick={() => (modoFilled ? unplaceModo(person) : placeModo(person))}
                aria-label={
                  modoFilled
                    ? `${placedModo} — tocá para sacarlo`
                    : selected !== null && selected.kind === 'modo'
                      ? `Poner ${selected.value} en el transporte de ${person}`
                      : `Transporte de ${person}, vacío`
                }
                className={[
                  'relative flex min-h-[44px] flex-1 items-center justify-center rounded-xl border-2 px-1.5 py-2 text-center text-xs font-semibold leading-tight text-slate-700 transition sm:text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  modoFilled && solved ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                  modoFilled && !solved ? 'border-tiam-blue/50 bg-tiam-blue/5' : '',
                  !modoFilled ? 'border-dashed border-slate-300 bg-white' : '',
                  modoInteractive ? 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                ].join(' ')}
              >
                {placedModo ?? '?'}
                {modoFilled && solved && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={!destinoInteractive}
                onClick={() => (destinoFilled ? unplaceDestino(person) : placeDestino(person))}
                aria-label={
                  destinoFilled
                    ? `${placedDestino} — tocá para sacarlo`
                    : selected !== null && selected.kind === 'destino'
                      ? `Poner ${selected.value} en el destino de ${person}`
                      : `Destino de ${person}, vacío`
                }
                className={[
                  'relative flex min-h-[44px] flex-1 items-center justify-center rounded-xl border-2 px-1.5 py-2 text-center text-xs font-semibold leading-tight text-slate-700 transition sm:text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  destinoFilled && solved ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                  destinoFilled && !solved ? 'border-tiam-blue/50 bg-tiam-blue/5' : '',
                  !destinoFilled ? 'border-dashed border-slate-300 bg-white' : '',
                  destinoInteractive ? 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                ].join(' ')}
              >
                {placedDestino ?? '?'}
                {destinoFilled && solved && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {!solved && (
        <>
          {/* Two banks, kept visually separate so each word's TYPE (and so
              which column it can land on) is always obvious at a glance. */}
          <div className="mt-5">
            <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-500">Transportes</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {modoBank.map((word) => {
                const isSelected = selected !== null && selected.kind === 'modo' && selected.value === word
                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() =>
                      setSelected((cur) => (cur?.kind === 'modo' && cur.value === word ? null : { kind: 'modo', value: word }))
                    }
                    className={[
                      'min-h-[44px] rounded-xl border-2 px-3 py-2 text-sm font-semibold transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      isSelected
                        ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                    ].join(' ')}
                  >
                    {word}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-500">Destinos</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {destinoBank.map((word) => {
                const isSelected = selected !== null && selected.kind === 'destino' && selected.value === word
                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() =>
                      setSelected((cur) =>
                        cur?.kind === 'destino' && cur.value === word ? null : { kind: 'destino', value: word },
                      )
                    }
                    className={[
                      'min-h-[44px] rounded-xl border-2 px-3 py-2 text-sm font-semibold transition',
                      'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                      isSelected
                        ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                    ].join(' ')}
                  >
                    {word}
                  </button>
                )
              })}
            </div>
          </div>

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

          {/* Clues — always visible, per spec. */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Pistas</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-base text-slate-700">
              {puzzle.clues.map((clue, i) => (
                <li key={i}>{clue}</li>
              ))}
            </ul>
            {/* Decorative flavor line (Nivel 3 only) — visibly softer than the
                clues above, and deliberately OUTSIDE the <ul> so it never
                reads as an 8th deduction clue. */}
            {puzzle.flavor && <p className="mt-3 text-sm italic text-slate-400">{puzzle.flavor}</p>}
          </div>
        </>
      )}

      {/* Completion */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Completaste el transporte y el destino de las {puzzle.people.length} personas del {level.name.toLowerCase()} — ¡buena
            deducción!
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
