import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Footprints, MapPin, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Camino secreto" — día 21, orientación. Same family as Encaminada.tsx (día
 * 13, mes 2): a grid with ONE marked starting cell and a row of arrow icons
 * that give an ordered sequence of orthogonal moves. The player computes,
 * step by step, which cell each arrow lands on, then taps the resulting word
 * among 3-4 multiple-choice options — the same hard, unambiguous validation
 * Encaminada uses, and for the same reason: free-text or tap-the-path
 * validation would need fuzzy matching for an accidental extra tap or a
 * plausible-but-wrong path someone traces anyway.
 *
 * The one deliberate mechanical difference from Encaminada: grid cells hold
 * whole SYLLABLES (1-3 letters, e.g. "PA", "NA", "DE", "RÍ", "A"), not single
 * letters — the same building-block granularity "Almacén de sílabas" (día
 * 19) uses, just walked along a fixed arrow path here instead of freely
 * combined from a bank. Path length still tracks Encaminada's own level ramp
 * exactly (3/4/5 cells for nivel 1/2/3, i.e. 2/3/4 arrows), and grid
 * dimensions (3×3/4×4/5×5) and option counts (3/3/4) are all identical to
 * Encaminada's — so the mobile-height math it already solved carries over
 * unchanged. The only real adjustment: grid-cell text is a fixed text-base
 * here (both reference files — Encaminada, Coordenadas — use a level-
 * independent fixed size too, just larger, since their cells only ever hold
 * one character) instead of something like Encaminada's text-xl, because a
 * 2-3 letter syllable needs more horizontal room than a single letter inside
 * the same ~51px nivel-3 cell (5 cols, mobile max-w-280px). Verified against
 * the hardest state — nivel 3, 5×5 grid + 4 arrows + 4 options — at 375×812
 * before finishing this file; nothing scrolls.
 *
 * Puzzle data (paths in-bounds, orthogonal single-step consecutive cells, no
 * self-intersection, no duplicate word within a level) was verified with a
 * throwaway Node script before writing this component, same discipline
 * Encaminada's own header describes for its hand-authored pools.
 *
 * ONLY the start cell is ever visually marked (MapPin badge, same as
 * Encaminada) — every other cell, including the ones the correct path
 * actually lands on, looks identical to a random filler cell. Grid cells are
 * NEVER tap targets here (same as Encaminada, unlike Coordenadas' board): the
 * multiple-choice options are the only interactive answer surface, so two
 * filler syllables happening to sit next to each other and read like a real
 * word is cosmetic noise, not a gameplay or content risk — nobody combines
 * adjacent cells by hand the way "Almacén de sílabas" lets them combine bank
 * tiles (which is precisely why THAT file has to screen filler combinations
 * so carefully and this one doesn't).
 *
 * Decoys favor a same-FIRST-SYLLABLE option whenever the level pool has one
 * (buildOptions below) — the syllable-level analog of Encaminada's
 * same-first-letter rule, so a player can't shortcut by matching just the
 * first grid cell to the only option that starts differently; they have to
 * actually walk the arrows. Every level pool below was authored in pairs so
 * EVERY word has exactly one same-first-syllable partner in its own level
 * (script-verified) — the same full coverage Encaminada's own nivel 3 reaches
 * via its ABEJA/VIAJE additions.
 *
 * Wrong guesses eliminate that option (greyed out, never removed-forever-red)
 * and show a rotating muted hint — Encaminada's exact wrong-tap treatment,
 * mirrored as-is (not OrdenarLaFrase's "reveal after Revisar" pattern, which
 * only fits that game's free word-order mechanic). No timer, ever.
 *
 * A one-time "¿Listo?" ready screen gates the START of the day, exactly like
 * Encaminada — moving the "how to play" sentence out of the persistent
 * header is what keeps nivel 3's fully-loaded state inside the mobile
 * budget. `phase` flips to 'playing' once and never resets — not on
 * level-advance, not on "Repetir"/"Hacer otro".
 *
 * mistakes/totalAttempts semantics copied exactly from Encaminada:
 * `totalAttempts` is the fixed TOTAL_ROUNDS (every round always resolves in
 * exactly one eventual correct pick, since a wrong guess only eliminates an
 * option and lets the player keep trying) plus every wrong tap along the way.
 *
 * Two spots intentionally read larger than either reference file's own pixel
 * choices: the level-name chip and the arrow step-index label are text-xs /
 * text-[10px] in Encaminada and Coordenadas; both are text-base here, to
 * hold a strict "text-base minimum, everywhere" line without exception. The
 * chip's actual COLOR is still mirrored exactly as an inline style (not a
 * brand-token utility class) on purpose: that amber is deliberately NOT
 * tiam-orange, because tiam-orange fails WCAG AA contrast at small sizes
 * (documented project-wide) and a small uppercase level chip is exactly the
 * case that note warns about.
 */

type Dir = 'up' | 'down' | 'left' | 'right'
interface Cell {
  row: number
  col: number
}
interface SyllablePath {
  /** Assembled answer, e.g. 'CAMINO' — what the multiple-choice options show. */
  word: string
  /** One syllable per path cell, in path order; syllables.length === path.length. */
  syllables: string[]
  /** path[0] is the marked start cell. Each consecutive pair is a single orthogonal step. */
  path: Cell[]
}
interface Level {
  n: number
  name: string
  rows: number
  cols: number
  numOptions: number
  pool: SyllablePath[]
}

// App-wide default rounds-per-level ([2, 3, 3], same as Encaminada) — no
// reason to deviate here.
const ROUNDS_PER_LEVEL = [2, 3, 3]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rows: 3,
    cols: 3,
    numOptions: 3,
    pool: [
      { word: 'CAMINO', syllables: ['CA', 'MI', 'NO'], path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }] },
      { word: 'CASITA', syllables: ['CA', 'SI', 'TA'], path: [{ row: 2, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
      { word: 'COCINA', syllables: ['CO', 'CI', 'NA'], path: [{ row: 0, col: 2 }, { row: 1, col: 2 }, { row: 1, col: 1 }] },
      { word: 'COMIDA', syllables: ['CO', 'MI', 'DA'], path: [{ row: 2, col: 2 }, { row: 2, col: 1 }, { row: 1, col: 1 }] },
      { word: 'PALOMA', syllables: ['PA', 'LO', 'MA'], path: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }] },
      { word: 'PASEO', syllables: ['PA', 'SE', 'O'], path: [{ row: 0, col: 2 }, { row: 0, col: 1 }, { row: 1, col: 1 }] },
      { word: 'MANZANA', syllables: ['MAN', 'ZA', 'NA'], path: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 1, col: 1 }] },
      { word: 'MANTECA', syllables: ['MAN', 'TE', 'CA'], path: [{ row: 2, col: 2 }, { row: 1, col: 2 }, { row: 1, col: 1 }] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rows: 4,
    cols: 4,
    numOptions: 3,
    pool: [
      { word: 'MARIPOSA', syllables: ['MA', 'RI', 'PO', 'SA'], path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 }] },
      { word: 'MADRESELVA', syllables: ['MA', 'DRE', 'SEL', 'VA'], path: [{ row: 3, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 1, col: 1 }] },
      { word: 'CARACOLES', syllables: ['CA', 'RA', 'CO', 'LES'], path: [{ row: 0, col: 3 }, { row: 1, col: 3 }, { row: 1, col: 2 }, { row: 2, col: 2 }] },
      { word: 'CALABAZA', syllables: ['CA', 'LA', 'BA', 'ZA'], path: [{ row: 3, col: 3 }, { row: 3, col: 2 }, { row: 2, col: 2 }, { row: 2, col: 1 }] },
      { word: 'ABUELITOS', syllables: ['A', 'BUE', 'LI', 'TOS'], path: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }] },
      { word: 'AMANECER', syllables: ['A', 'MA', 'NE', 'CER'], path: [{ row: 0, col: 3 }, { row: 0, col: 2 }, { row: 0, col: 1 }, { row: 1, col: 1 }] },
      { word: 'SOBREMESA', syllables: ['SO', 'BRE', 'ME', 'SA'], path: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 2 }] },
      { word: 'SOLECITO', syllables: ['SO', 'LE', 'CI', 'TO'], path: [{ row: 3, col: 3 }, { row: 2, col: 3 }, { row: 2, col: 2 }, { row: 3, col: 2 }] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rows: 5,
    cols: 5,
    numOptions: 4,
    pool: [
      { word: 'PANADERÍA', syllables: ['PA', 'NA', 'DE', 'RÍ', 'A'], path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 2 }] },
      { word: 'PAPELERÍA', syllables: ['PA', 'PE', 'LE', 'RÍ', 'A'], path: [{ row: 4, col: 0 }, { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 2 }] },
      { word: 'CARACOLITOS', syllables: ['CA', 'RA', 'CO', 'LI', 'TOS'], path: [{ row: 0, col: 4 }, { row: 1, col: 4 }, { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 2, col: 4 }] },
      { word: 'CAFETERÍA', syllables: ['CA', 'FE', 'TE', 'RÍ', 'A'], path: [{ row: 4, col: 4 }, { row: 4, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 2, col: 4 }] },
      { word: 'ANIVERSARIO', syllables: ['A', 'NI', 'VER', 'SA', 'RIO'], path: [{ row: 0, col: 2 }, { row: 0, col: 3 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 0, col: 4 }] },
      { word: 'ANIMALITOS', syllables: ['A', 'NI', 'MA', 'LI', 'TOS'], path: [{ row: 4, col: 2 }, { row: 4, col: 1 }, { row: 3, col: 1 }, { row: 3, col: 0 }, { row: 2, col: 0 }] },
      { word: 'ENREDADERA', syllables: ['EN', 'RE', 'DA', 'DE', 'RA'], path: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 0 }] },
      { word: 'ENSALADERA', syllables: ['EN', 'SA', 'LA', 'DE', 'RA'], path: [{ row: 4, col: 0 }, { row: 4, col: 1 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 4, col: 2 }] },
    ],
  },
]

const DIR_ICON: Record<Dir, typeof ArrowUp> = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }

function directionBetween(a: Cell, b: Cell): Dir {
  if (b.row === a.row - 1) return 'up'
  if (b.row === a.row + 1) return 'down'
  if (b.col === a.col - 1) return 'left'
  return 'right'
}

// Neutral filler syllables — length-varied (1-3 letters) on purpose, so
// filler cells don't visually stand out from real path syllables just by
// being shorter. Fillers carry no meaning and are never tapped or combined
// by the player (see file header), so this is only about keeping the board
// looking like ordinary Spanish text, same reasoning as Encaminada's own
// FILLER_LETTERS.
const FILLER_SYLLABLES = [
  'A', 'E', 'I', 'O', 'U',
  'TA', 'LE', 'MO', 'RI', 'SA', 'NO', 'DE', 'TE', 'LO', 'ME',
  'SE', 'DA', 'NA', 'RA', 'LI', 'TO', 'VE', 'FA', 'BA', 'DO',
  'RO', 'SO', 'JA', 'LA', 'VA', 'NI', 'MI', 'PO', 'TU', 'DI',
  'BRE', 'DRE', 'TOS', 'MAN', 'VER', 'SEL', 'LES', 'RIO', 'TAS',
]

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

function buildBoard(entry: SyllablePath, rows: number, cols: number): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => pickOne(FILLER_SYLLABLES)),
  )
  entry.path.forEach((cell, i) => {
    grid[cell.row][cell.col] = entry.syllables[i]
  })
  return grid
}
function buildOptions(pool: SyllablePath[], current: SyllablePath, numOptions: number): string[] {
  const decoyPool = pool.filter((p) => p.word !== current.word)
  // At least one decoy shares the answer's first SYLLABLE — the syllable-
  // level analog of Encaminada's same-first-letter rule (see file header).
  // Every level pool above is authored in pairs so this candidate always
  // exists; the random fallback only guards a future pool edit that breaks
  // that invariant.
  const sameFirstSyllable = decoyPool.filter((p) => p.syllables[0] === current.syllables[0])
  if (sameFirstSyllable.length === 0) {
    return shuffle([current.word, ...shuffle(decoyPool.map((p) => p.word)).slice(0, numOptions - 1)])
  }
  const forcedDecoy = pickOne(sameFirstSyllable)
  const otherDecoys = shuffle(decoyPool.filter((p) => p !== forcedDecoy)).slice(0, numOptions - 2)
  return shuffle([current.word, forcedDecoy.word, ...otherDecoys.map((p) => p.word)])
}

const HINTS = [
  'Todavía no — probá de nuevo siguiendo las flechas desde el inicio.',
  'Una sílaba a la vez: fijate a qué celda te lleva cada flecha.',
  'Casi la tenés. Repasá el camino completo antes de elegir.',
]
const LEVEL_PRAISE_GOOD = ['¡Muy bien!', '¡Excelente recorrido!', '¡Así se hace!', '¡Qué buen camino encontraste!']
const LEVEL_PRAISE_OK = ['¡Buen intento! Cada vez vas a reconocer el camino más rápido.', '¡Bien ahí! Seguí practicando el recorrido.']

export function CaminoSecreto({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // `ROUNDS_PER_LEVEL[i]` syllable-paths drawn at random from level i's own
  // pool, for EVERY level at once — decided once per epoch (a full 1→2→3
  // pass), at mount and again on "Hacer otro", never re-rolled by revisiting
  // a level, so "Repetir" hands back the exact same paths deterministically.
  const [epochOrder, setEpochOrder] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= roundsForLevel
  const current = order[roundIdx] as SyllablePath | undefined

  const board = useMemo(
    () => (current ? buildBoard(current, level.rows, level.cols) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current],
  )
  const dirs = useMemo(
    () => (current ? current.path.slice(1).map((cell, i) => directionBetween(current.path[i], cell)) : []),
    [current],
  )
  const options = useMemo(
    () => (current ? buildOptions(level.pool, current, level.numOptions) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current],
  )

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3, only zeroed on a genuine day restart
  // (wrap from level 3 back to level 1) — same policy as every other
  // multi-level game in this folder.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctCount / roundsForLevel >= 0.6 ? LEVEL_PRAISE_GOOD : LEVEL_PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function advance() {
    window.setTimeout(() => {
      setRoundIdx((i) => i + 1)
      setEliminated(new Set())
      setSolved(false)
      setHint(null)
    }, 1000)
  }

  function guess(word: string) {
    if (!current || solved || eliminated.has(word)) return
    if (word === current.word) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      advance()
    } else {
      setEliminated((prev) => (prev.has(word) ? prev : new Set(prev).add(word)))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Synchronous resets happen HERE, in the same handler that changes
  // levelIdx/roundKey — not in a separate effect keyed on them, which would
  // let the onComplete effect below read a stale `done` on the render that
  // just arrived at the new level (same bug class already fixed elsewhere in
  // this folder, e.g. CaminoNumerico/CazadorDeLetras/ClaveDeSimbolos).

  // "Siguiente nivel" — advance within the SAME epoch. Only ever called
  // while levelIdx < LEVELS.length - 1; epochOrder is left alone — level
  // i+1's paths were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
  }

  // Shared by both restart buttons on the FINAL level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — zero
  // the mistake accumulator either way). roundKey always bumps here: it's
  // the "which attempt is this" generation counter the onComplete effect
  // uses to fire again on a replay, independent of whether the paths
  // themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setCorrectCount(0)
    setMistakes(0)
  }
  // "Repetir" — same paths as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random set of paths per level, same as before
  // this feature existed (the only option there used to be).
  function restartDifferent() {
    restartEpoch()
    setEpochOrder(LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])))
  }

  // Fires once per roundKey when level 3 is completed. A full day restart
  // (via restartEpoch, from either restart button) gets a new roundKey, so a
  // genuine replay of the whole day reports again; re-rendering while still
  // done on level 3 does not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const levelName = `Nivel ${levelIdx + 1}`

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {levelName}
        </span>
        {phase === 'playing' && !done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {roundsForLevel}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pantalla previa: única vez, al principio del día — ver el comentario
          del encabezado del archivo sobre por qué (a diferencia de un gate
          por ronda) esto no se repite al avanzar de nivel. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Footprints className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-base text-slate-600">
            Seguí las flechas desde la sílaba marcada, sumalas en el camino y elegí qué palabra se formó entre las
            opciones.
          </p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 text-base font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && !done && current && (
        <>
          {/* Grid — only the start cell is ever marked; every other cell,
              including the ones the real path lands on, looks identical to a
              filler cell (see file header). Nivel 3's 5×5 grid gets the same
              smaller mobile cap as Encaminada's own nivel 3 — cells here are
              purely visual (never tappable, see below), so shrinking the box
              costs nothing accessibility-wise. */}
          <div
            className={
              level.cols >= 5
                ? 'mx-auto mt-4 grid aspect-square w-full max-w-[280px] gap-1.5 sm:max-w-[360px] sm:gap-2'
                : 'mx-auto mt-4 grid aspect-square w-full max-w-[320px] gap-1.5 sm:max-w-[360px] sm:gap-2'
            }
            style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
          >
            {board.map((rowArr, r) =>
              rowArr.map((syllable, c) => {
                const isStart = current.path[0].row === r && current.path[0].col === c
                return (
                  <div
                    key={`${r}-${c}`}
                    className={[
                      'relative flex items-center justify-center rounded-lg border-2 px-0.5 text-center text-base font-extrabold leading-tight sm:text-lg',
                      isStart
                        ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                        : 'border-slate-200 bg-white text-slate-700',
                    ].join(' ')}
                  >
                    {syllable}
                    {isStart && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-blue text-white shadow">
                        <MapPin className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                )
              }),
            )}
          </div>

          {/* Arrow sequence */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {dirs.map((d, i) => {
              const Icon = DIR_ICON[d]
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-base font-bold text-slate-400">{i + 1}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Options */}
          <div className="mx-auto mt-4 flex max-w-sm flex-col gap-2">
            {options.map((word) => {
              const isEliminated = eliminated.has(word)
              const showAsCorrect = solved && word === current.word
              return (
                <button
                  key={word}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(word)}
                  className={[
                    'min-h-[48px] rounded-2xl border-2 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    showAsCorrect
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-700 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {word}
                </button>
              )
            })}
          </div>
        </>
      )}

      {hint && !solved && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-base text-slate-600">
            Recorriste el camino en las {roundsForLevel} rondas — completaste el {levelName.toLowerCase()}.
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 text-base font-semibold text-white hover:bg-tiam-blue-dark"
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
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 text-base font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 text-base font-semibold text-white hover:bg-tiam-blue-dark"
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
