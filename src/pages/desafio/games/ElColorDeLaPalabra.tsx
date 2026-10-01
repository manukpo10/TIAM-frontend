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
 * Difficulty ramps with how many inks are in play (4 → 5 → 6) and with the
 * size of the board (12 → 15 → 18 tiles) — NOT with lookalike colours. An
 * earlier version added lookalikes on purpose (azul/celeste, gris/negro,
 * rojo/rosa, naranja/rojo, verde/turquesa) and the facilitator, testing with
 * older adults wearing glasses, could not tell several of them apart: she
 * tapped NARANJA and was marked wrong because the ink was a red. Marrón had
 * already gone the same way (it was swapped for turquesa). A task that
 * punishes the player for how their eyes work is not an attention task, so
 * the lookalikes are gone and every ink has a hue of its own.
 *
 * THE INKS ARE FAR APART, AND THAT WAS MEASURED, NOT EYEBALLED. Every pair of
 * inks that can share a level is >= 35 apart in CIEDE2000 (the colour
 * difference formula that tracks human vision best; a difference of about 2
 * is barely noticeable). The closest pair is NEGRO/VIOLETA at 35.2 (level 1's
 * closest is VERDE/NEGRO at 39.3, level 2's VERDE/DORADO at 37.3); in plain
 * CIELAB the closest is 57.9. The palette this replaces bottomed out at 13.7
 * (azul/celeste), with rojo/naranja at 14.8 and negro/gris at 21.2. Six inks
 * is the ceiling: with a named hue per ink and the contrast floor below, a
 * seventh (naranja, rosa, celeste, turquesa...) lands inside that margin of
 * one already there.
 *
 * Every ink is also >= 3:1 against the white tile — the bar for large bold
 * text — which is why the "yellow" is DORADO #B8860B (3.25:1): a plain bright
 * yellow on white is about 1.1:1 and simply disappears. At that contrast it
 * is honestly a gold, not a lemon yellow, so it is called what it looks like
 * (and the shorter word lets the type stay larger). ROJO is the deeper
 * #D0021B for a second reason too: it keeps rojo/verde and rojo/dorado
 * further apart for red-green colour-blind players. Hex values are
 * hand-picked, not the brand tokens, because the ink IS the content here; the
 * catalog's tiam-orange (documented as failing AA contrast) is deliberately
 * not used.
 *
 * THE WORD IS DRAWN LARGER AND HEAVIER than before, because the ink is the
 * thing the player has to see. index.html only loads Plus Jakarta Sans at
 * weights 400-700, so `font-extrabold` / `font-black` quietly render as plain
 * bold; the extra weight comes from a thin text stroke in the ink's own
 * colour (`WebkitTextStrokeWidth`, in em so it scales with the size). The
 * board is three columns on every level — the old four-column levels left
 * ~52px per tile at 311px, narrower than the old "TURQUESA" itself.
 */

interface Ink {
  name: string
  hex: string
}

// Six hues, each far from every other — see the file header for the numbers.
// The first four are level 1; levels 2 and 3 each add ONE new hue, never a
// lookalike of anything already in play.
const BASE_INKS: Ink[] = [
  { name: 'ROJO', hex: '#D0021B' },
  { name: 'AZUL', hex: '#1678D4' },
  { name: 'VERDE', hex: '#05741C' },
  { name: 'NEGRO', hex: '#000000' },
]
const LEVEL_2_INK: Ink = { name: 'DORADO', hex: '#B8860B' }
const LEVEL_3_INK: Ink = { name: 'VIOLETA', hex: '#7E0197' }

interface Level {
  n: number
  name: string
  palette: Ink[]
  tiles: number
  matching: number
}

// Tiles are a multiple of 3 so every row of the 3-column board is full.
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', palette: BASE_INKS, tiles: 12, matching: 4 },
  { n: 2, name: 'Nivel 2', palette: [...BASE_INKS, LEVEL_2_INK], tiles: 15, matching: 5 },
  { n: 3, name: 'Nivel 3', palette: [...BASE_INKS, LEVEL_2_INK, LEVEL_3_INK], tiles: 18, matching: 6 },
]

// Same 3 columns on every level. Word sizes were fitted to the real glyph
// widths (Plus Jakarta Sans 700, in em: NEGRO 3.68, DORADO 4.61, VIOLETA
// 4.20) against ~86px of room per tile at 311px: level 1's longest word is
// NEGRO at 22px = 81px, levels 2-3's is DORADO at 18px = 83px. The
// max-[350px] step down keeps the longest word inside its tile on the
// narrowest phones; `sm:` scales up in the wide modal.
const GRID_CLASS = 'grid-cols-3 gap-2 sm:gap-3'
const TILE_CLASS: Record<number, string> = {
  1: 'min-h-[68px] text-[22px] max-[350px]:text-base sm:text-3xl',
  2: 'min-h-[60px] text-lg max-[350px]:text-sm sm:text-2xl',
  3: 'min-h-[60px] text-lg max-[350px]:text-sm sm:text-2xl',
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

  // Every level's board, decided once — at mount — never re-rolled just
  // because the player re-visits a level or hits "Repetir", so a replay
  // always shows the same tiles (same content-freezing convention as
  // SumaHastaDiez.tsx's `epoch`).
  const [epoch] = useState(() => LEVELS.map((lvl) => buildBoard(lvl)))
  const board = epoch[levelIdx]
  const targetCount = useMemo(() => board.filter((t) => t.matches).length, [board])

  const [found, setFound] = useState<Set<number>>(new Set())
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Both accumulate across levels 1→2→3 and only zero on a genuine day
  // restart (see nextLevel's wrap branch).
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
      <div className={`mt-5 grid ${GRID_CLASS}`}>
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
                'relative flex items-center justify-center rounded-2xl border-2 bg-white px-1 py-2 transition',
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
              {/* The ink. font-black asks for the heaviest weight, but only
                  400-700 are loaded (see file header), so the stroke — which
                  defaults to the text's own colour — is what actually adds
                  weight. */}
              <span className="font-black leading-none" style={{ color: tile.hex, WebkitTextStrokeWidth: '0.045em' }}>
                {tile.word}
              </span>
              {/* Anchored to the tile, not to the word: the words now nearly
                  fill their tile, so a badge hanging off the word's corner
                  could poke out of the board. */}
              {isFound && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
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
