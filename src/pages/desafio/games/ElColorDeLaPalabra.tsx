import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El color de la palabra" — a Stroop interference task. A board of colour
 * words is printed in assorted inks; tap only the ones where the word and its
 * ink agree. Reading is automatic, so suppressing it to check the ink instead
 * is the actual exercise.
 *
 * Month 1 día 18 ("Palabras y colores") already adapts Stroop, but as an
 * off-phone card the player reads aloud and then confirms with a single "ya lo
 * hice" — nothing is scored and nothing is tapped. This is the playable
 * version: the app can tell whether the ink actually won over the word.
 *
 * Difficulty ramps by palette confusability, not by board size alone: L1 uses
 * four inks nobody mixes up, L3 adds the pairs that genuinely collide at a
 * glance (azul/celeste, gris/negro, rojo/rosa, naranja/rojo). Hex values are
 * hand-picked rather than taken from the brand tokens because the ink IS the
 * content here and every one of them has to stay legible on white — the
 * catalog's own tiam-orange is documented as failing AA contrast, so it is
 * deliberately not used.
 */

interface Ink {
  name: string
  hex: string
}

const BASE_INKS: Ink[] = [
  { name: 'ROJO', hex: '#D32F2F' },
  { name: 'AZUL', hex: '#1565C0' },
  { name: 'VERDE', hex: '#2E7D32' },
  { name: 'NEGRO', hex: '#212121' },
]
const MID_INKS: Ink[] = [
  { name: 'NARANJA', hex: '#E65100' },
  { name: 'VIOLETA', hex: '#6A1B9A' },
]
// The confusable tail: each of these sits close to a colour already in play.
const HARD_INKS: Ink[] = [
  { name: 'CELESTE', hex: '#0288D1' },
  { name: 'GRIS', hex: '#616161' },
  { name: 'ROSA', hex: '#C2185B' },
  { name: 'MARRÓN', hex: '#5D4037' },
]

interface Level {
  n: number
  name: string
  palette: Ink[]
  tiles: number
  matching: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', palette: BASE_INKS, tiles: 12, matching: 4 },
  { n: 2, name: 'Nivel 2', palette: [...BASE_INKS, ...MID_INKS], tiles: 16, matching: 5 },
  { n: 3, name: 'Nivel 3', palette: [...BASE_INKS, ...MID_INKS, ...HARD_INKS], tiles: 20, matching: 6 },
]

const GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-3 gap-2.5 sm:gap-3',
  2: 'grid-cols-4 gap-2 sm:gap-3',
  3: 'grid-cols-4 gap-2 sm:gap-3',
}
const TILE_CLASS: Record<number, string> = {
  1: 'min-h-[60px] text-base sm:text-lg',
  2: 'min-h-[56px] text-sm sm:text-base',
  3: 'min-h-[56px] text-sm sm:text-base',
}

interface Tile {
  word: string
  /** Ink colour name — carried alongside the hex purely so the tile can name
   * it in its aria-label; the ink is invisible to a screen reader otherwise. */
  ink: string
  hex: string
  matches: boolean
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

function buildBoard(level: Level): Tile[] {
  const tiles: Tile[] = []
  for (let i = 0; i < level.matching; i++) {
    const ink = pickOne(level.palette)
    tiles.push({ word: ink.name, ink: ink.name, hex: ink.hex, matches: true })
  }
  for (let i = tiles.length; i < level.tiles; i++) {
    const word = pickOne(level.palette)
    // The ink must differ from the word, or this "decoy" would silently be
    // another correct answer and the counter could never be satisfied.
    const ink = pickOne(level.palette.filter((c) => c.name !== word.name))
    tiles.push({ word: word.name, ink: ink.name, hex: ink.hex, matches: false })
  }
  return shuffle(tiles)
}

const PRAISE = ['¡Muy bien!', '¡Excelente concentración!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa no: fijate de qué color está escrita, no lo que dice.',
  'Ojo, ahí la palabra y el color no coinciden.',
  'Casi. Leé el color con el que está pintada, no la palabra.',
]

export function ElColorDeLaPalabra({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const board = useMemo(
    () => buildBoard(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const targetCount = useMemo(() => board.filter((t) => t.matches).length, [board])

  const [found, setFound] = useState<Set<number>>(new Set())
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Both accumulate across levels 1→2→3 and only zero on a genuine day
  // restart (see nextLevel's wrap branch) — a same-level replay keeps them.
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)

  const done = targetCount > 0 && found.size === targetCount

  const handleTap = useCallback(
    (tile: Tile, index: number) => {
      if (tile.matches) {
        setFound((prev) => (prev.has(index) ? prev : new Set(prev).add(index)))
        setHint(null)
        return
      }
      setWrongIdx(index)
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
      window.setTimeout(() => setWrongIdx((w) => (w === index ? null : w)), 500)
    },
    [],
  )

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` (derived straight
  // from `found`) would read the previous level's stale-true value on the very
  // render that arrives at the new level and fire onComplete with garbage.
  // Same reasoning as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setFoundAcrossLevels((f) => f + found.size)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setFound(new Set())
    setWrongIdx(null)
    setHint(null)
    if (isWrap) {
      setMistakes(0)
      setFoundAcrossLevels(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setFound(new Set())
    setWrongIdx(null)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (the wrap back to level 1) gets a new roundKey so it can report
  // again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + foundAcrossLevels + found.size })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          Tocá las palabras escritas con su propio color
        </h2>
        <p className="mt-2 text-base text-slate-500">
          Por ejemplo, la palabra VERDE pintada de verde.
        </p>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Llevás {found.size} de {targetCount}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${targetCount ? (found.size / targetCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Board */}
      <div className={`mt-5 grid ${GRID_CLASS[level.n]}`}>
        {board.map((tile, i) => {
          const isFound = found.has(i)
          const isWrong = wrongIdx === i
          return (
            <button
              key={i}
              type="button"
              disabled={isFound}
              onClick={() => handleTap(tile, i)}
              aria-label={`${tile.word}, escrita en color ${tile.ink.toLowerCase()}`}
              aria-pressed={isFound}
              className={[
                'flex items-center justify-center rounded-2xl border-2 bg-white px-2 py-2 transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                TILE_CLASS[level.n],
                isFound
                  ? 'border-tiam-green ring-2 ring-tiam-green/30'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                // The wiggle alone marks a wrong tap — no red anywhere in this
                // catalog, and here red would additionally collide with the
                // game's own content.
                isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out]' : '',
              ].join(' ')}
            >
              <span className="relative font-extrabold leading-none" style={{ color: tile.hex }}>
                {tile.word}
                {isFound && (
                  <span className="absolute -right-3.5 -top-3 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </span>
            </button>
          )
        })}
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
            Encontraste las {targetCount} — ¡completaste el {level.name.toLowerCase()}!
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
            {levelIdx === LEVELS.length - 1 && (
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Otro tablero
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
