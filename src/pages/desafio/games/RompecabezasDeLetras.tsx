import { useEffect, useMemo, useRef, useState } from 'react'
import { Puzzle, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Rompecabezas de letras" — día 5, orientación. Simplified mobile take on an
 * irregular-piece letter-fragment jigsaw: instead of dragging odd-shaped
 * pieces into a frame (uncomfortable on a touchscreen, and this app never
 * uses drag — see useSequencingPuzzle's own reasoning, ~78% success tapping
 * vs ~45% drag-and-drop for older adults), the frame is rendered as a row of
 * fixed "huecos" (one per letter/syllable fragment) and the player TAPS
 * fragments from a bank, in order, to snap them into the next open hueco —
 * same tap-to-place mechanic as OrdenarLaFrase.tsx, just at fragment
 * granularity instead of whole-word granularity.
 *
 * Free-order placement + explicit "Revisar" (not per-tap validation): this
 * generalizes OrdenarLaFrase's single optional `distractor` to a `decoys`
 * array (nivel 2/3 only, per the brief) — a pool item is "real" if its id is
 * < fragments.length, a "decoy" otherwise. `readyToCheck` therefore fires
 * once the bank holds nothing but decoys, exactly mirroring OrdenarLaFrase's
 * own bank.length===1-distractor-left special case, just generalized to N.
 *
 * Rendering split: the hueco row shows exactly `fragments.length` boxes,
 * filled left-to-right by `placedReal` (real fragments only, in the order
 * THEY were tapped — decoy taps don't consume a hueco). Any tapped decoy
 * renders as an extra pill-shaped chip appended after the huecos — round,
 * dashed, visually "doesn't fit the square frame," rather than a hidden
 * distractor the player only discovers via a wrong Revisar (reinforces rule
 * 1's "soft, never a dead end" without ever turning red). Tapping it again
 * still un-places it (unplace works by id, not by role).
 *
 * EVERY level targets a full PHRASE, always 2 words — never a single word
 * (that would blur this game into AlmacenDeSilabas' territory, whole-word-
 * per-target) — via a `groups: string[][]` shape: one sub-array of
 * fragments per word, so the hueco row can insert a wider gap between
 * groups (the visual "space" in the phrase) without ever baking a literal
 * " " character into a fragment's tap label. `groups.flat()` is the real
 * fragment order; group boundaries are fixed by the pool data and don't
 * depend on tap order, only real-fragment PLACEMENT ORDER does.
 *
 * No timer, wrong taps never turn red (mirrors the whole folder). Difficulty
 * ramps fragment count AND decoy count together: nivel 1 is a 2-word phrase,
 * 3 fragments (one short unsplit word + one 2-syllable word), 0 decoys;
 * nivel 2 is a 2-word phrase, 3 fragments, 2 decoys; nivel 3 is a 2-word
 * phrase, 4 fragments, 3 decoys — the same [0, 2, 3] decoy ramp
 * AlmacenDeSilabas uses, for the same "couple → more" pacing. ROUNDS_PER_LEVEL
 * is [2, 2, 2] — same reasoning as Coordenadas: each round is already a
 * multi-tap sequence, not a single tap, so three rounds at the top levels
 * would make one level unreasonably long.
 *
 * A one-time "¿Listo?" ready screen (same pattern as Encaminada/Coordenadas/
 * OrdenarLaFrase) gates the START of the day, moving the "how to play"
 * sentence out of the persistent header. This game's heaviest state (nivel
 * 3: 4 huecos + a 7-chip bank) is much lighter than Encaminada's 5×5 grid or
 * Coordenadas' 6×6 board, so no extra nivel-3 shrinking was needed beyond
 * the ready screen itself — verified by the same box/row height accounting
 * those two files used before their own fix, with comfortable margin to
 * spare here. `phase` flips to 'playing' once and never resets.
 */

interface FragmentEntry {
  /** Full target phrase text (its `groups` words joined with a single
   * space) — only ever shown after Revisar, never before. */
  target: string
  /** One sub-array per word; concatenating a group's own fragments (no
   * separator) reproduces that word. `groups.flat()` is the real tap order. */
  groups: string[][]
  /** Decoy fragments shown in the bank alongside the real ones. Must not
   * equal any real fragment's text in the SAME round (bank ambiguity) —
   * verified by hand for every entry below. Omitted on nivel 1. */
  decoys?: string[]
}
interface Level {
  n: number
  name: string
  pool: FragmentEntry[]
}

// Each round is a multi-tap sequence already — same reasoning as
// Coordenadas' own [2, 2, 2] (not this app's usual [2, 3, 3] default).
const ROUNDS_PER_LEVEL = [2, 2, 2]

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    pool: [
      { target: 'MI GATO', groups: [['MI'], ['GA', 'TO']] },
      { target: 'LA ROSA', groups: [['LA'], ['RO', 'SA']] },
      { target: 'MI PERRO', groups: [['MI'], ['PE', 'RRO']] },
      { target: 'SU NIETO', groups: [['SU'], ['NIE', 'TO']] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    pool: [
      { target: 'MI CASA', groups: [['MI'], ['CA', 'SA']], decoys: ['TA', 'RI'] },
      { target: 'TU MANO', groups: [['TU'], ['MA', 'NO']], decoys: ['RI', 'DO'] },
      { target: 'LA LUNA', groups: [['LA'], ['LU', 'NA']], decoys: ['DO', 'TA'] },
      { target: 'TU NOMBRE', groups: [['TU'], ['NOM', 'BRE']], decoys: ['CA', 'SI'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    pool: [
      { target: 'MUCHO GUSTO', groups: [['MU', 'CHO'], ['GUS', 'TO']], decoys: ['RA', 'LI', 'SE'] },
      { target: 'BUENOS DIAS', groups: [['BUE', 'NOS'], ['DI', 'AS']], decoys: ['TA', 'MO', 'PE'] },
      { target: 'AGUA FRESCA', groups: [['A', 'GUA'], ['FRES', 'CA']], decoys: ['NI', 'DO', 'LU'] },
      { target: 'CIELO AZUL', groups: [['CIE', 'LO'], ['A', 'ZUL']], decoys: ['RE', 'SO', 'MA'] },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Muy bien armado!', '¡Así se hace!', '¡Excelente!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo queda armada la frase.',
  '¡Casi! Con la práctica te sale cada vez mejor.',
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

export function RompecabezasDeLetras({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  // `ROUNDS_PER_LEVEL[i]` entries drawn at random from level i's own pool,
  // for EVERY level at once — decided once per "epoch" (a full 1→2→3 pass),
  // at mount, never re-rolled by revisiting a
  // level, so "Repetir" hands back the exact same words deterministically
  // (same pattern as Encaminada/Coordenadas' epochOrder).
  const [epochOrder] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.pool).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const entry = order[roundIdx]

  const fragments = useMemo(() => entry.groups.flat(), [entry])
  // Index (into the flattened `fragments`) where each group AFTER the first
  // starts — used only to widen the gap between groups in the hueco row.
  const groupStarts = useMemo(() => {
    const starts = new Set<number>()
    let acc = 0
    for (const g of entry.groups) {
      if (acc > 0) starts.add(acc)
      acc += g.length
    }
    return starts
  }, [entry])
  const pool = useMemo(() => [...fragments, ...(entry.decoys ?? [])], [fragments, entry])
  const decoyIds = useMemo(() => new Set(pool.map((_, i) => i).filter((i) => i >= fragments.length)), [pool, fragments])

  const { bank, placed, place, unplace } = useSequencingPuzzle(pool, `${levelIdx}-${roundKey}-${roundIdx}`)
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3, only zeroed on a genuine day restart —
  // same model as OrdenarLaFrase/CuantosHay.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const placedReal = placed.filter((item) => !decoyIds.has(item.id))
  const placedDecoys = placed.filter((item) => decoyIds.has(item.id))
  // Done placing once the bank holds nothing but decoys — generalizes
  // OrdenarLaFrase's single-distractor bank.length===1 special case to N.
  const readyToCheck = bank.every((item) => decoyIds.has(item.id))
  const includedDecoy = placedDecoys.length > 0
  const isCorrect = !includedDecoy && placedReal.length === fragments.length && placedReal.every((item, i) => item.id === i)

  const done = checked && roundIdx >= roundsForLevel - 1
  // A soft nudge once every real fragment is sitting in a hueco (only decoys
  // left in the bank) — purely DERIVED from current state, not a separate
  // state+effect pair: unplacing a hueco after this becomes true must make
  // the nudge disappear again immediately, which only a derived value
  // guarantees (a state+effect version would need every place/unplace call
  // to also clear it, and miss one).
  const showReadyNudge = !checked && readyToCheck && placedReal.length === fragments.length

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    // Per-fragment mistake count: every real fragment sitting outside its
    // correct hueco, plus one per decoy that got placed at all.
    const fragmentMistakes = placedReal.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + fragmentMistakes + placedDecoys.length)
    setAccAttempts((a) => a + pool.length)
  }
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }
  // Resets happen HERE, synchronously with the level/round change — not in a
  // separate effect keyed on them, which would let the onComplete effect
  // below read a stale `done`/`checked` on the render that just arrived at
  // the new level (same discipline as every other multi-level game here).

  // "Siguiente nivel" — advance within the SAME epoch. Only ever called
  // while levelIdx < LEVELS.length - 1; epochOrder is left alone — level
  // i+1's entries were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setChecked(false)
  }
  // Runs on the "Repetir" button on the FINAL level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — it
  // zeroes the mistake accumulator).
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setChecked(false)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  // "Repetir" — same words as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }

  // Reports the SUM across levels 1→2→3 once per roundKey, so a genuine full
  // day restart (wrap to level 1, new roundKey) can report again.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
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

      {/* Pantalla previa: única vez, al principio del día — mismo patrón que
          Encaminada/Coordenadas/OrdenarLaFrase, ver el comentario del
          encabezado del archivo. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Puzzle className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver un marco vacío con espacios para las piezas. Tocá los fragmentos de letras, en el orden que
            creas correcto, para completar la frase escondida.
          </p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && !done && (
        <>
          {/* Frame — exactly `fragments.length` huecos, filled left-to-right
              by placedReal (real fragments only, in tap order). A wider gap
              is inserted at each `groupStarts` index to hint the phrase's
              word boundary without baking a literal space into any fragment. */}
          <div className="mt-6 flex min-h-[56px] flex-wrap items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {fragments.map((_, i) => {
              const item = placedReal[i]
              const isRight = checked && item && item.id === i
              const isWrong = checked && item && item.id !== i
              return (
                <button
                  key={i}
                  type="button"
                  disabled={checked || !item}
                  onClick={() => item && unplace(item)}
                  className={[
                    'flex h-12 min-w-[52px] items-center justify-center rounded-xl border-2 px-2 text-lg font-extrabold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    groupStarts.has(i) ? 'ml-2.5' : '',
                    !item ? 'border-dashed border-slate-300 bg-white text-slate-300' : '',
                    item && isRight ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : '',
                    item && isWrong ? 'border-slate-300 bg-white text-slate-500' : '',
                    item && !checked ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10' : '',
                  ].join(' ')}
                >
                  {item ? item.value : ''}
                </button>
              )
            })}
            {/* Decoys that got tapped — round pills, not square huecos, so
                they visually read as "doesn't fit the frame" instead of a
                hidden trap only revealed at Revisar (rule: never a dead
                end). Still tappable to undo. */}
            {placedDecoys.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={checked}
                onClick={() => unplace(item)}
                className={[
                  'ml-1 flex h-12 min-w-[52px] items-center justify-center rounded-full border-2 border-dashed px-3 text-lg font-extrabold transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  checked ? 'border-slate-300 bg-white text-slate-500' : 'border-tiam-orange/50 bg-tiam-orange/5 text-slate-600 hover:bg-tiam-orange/10',
                ].join(' ')}
              >
                {item.value}
              </button>
            ))}
          </div>

          {/* Fragment bank */}
          {!checked && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => place(item)}
                  className="min-h-[44px] min-w-[52px] rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-lg font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {showReadyNudge && (
            <p className="mt-4 text-center text-base font-medium text-slate-500">
              Ya armaste todas las piezas reales. Tocá "Revisar" cuando quieras.
            </p>
          )}

          {/* Check button */}
          {readyToCheck && !checked && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Result */}
      {checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <p className="mt-2 text-slate-600">
              La frase correcta era: <span className="font-semibold text-slate-800">"{entry.target}"</span>.
              {placedDecoys.length > 0 && (
                <>
                  {' '}
                  Y {placedDecoys.length === 1 ? 'esta pieza no pertenecía' : 'estas piezas no pertenecían'}:{' '}
                  {placedDecoys.map((d) => `"${d.value}"`).join(', ')}.
                </>
              )}
            </p>
          )}
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {!done && (
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente frase
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {done && levelIdx < LEVELS.length - 1 && (
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {done && levelIdx === LEVELS.length - 1 && (
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
