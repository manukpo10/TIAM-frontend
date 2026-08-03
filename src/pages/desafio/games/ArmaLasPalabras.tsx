import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Armá las palabras" — día 1, lenguaje. Combine letter-fragment squares to
 * deduce hidden words (TYPE inspired by a competitor worksheet; content ours):
 * a bank of 3-letter tiles, and the player taps tiles into slots to build each
 * hidden word. Which words exist is not told — deducing them from the fragments
 * is the lexical/executive work. Every level builds 3-chunk words now —
 * a 2-chunk nivel 1 read as a different, easier game rather than the same
 * game at an easier step, so the fragment count is uniform across all three
 * levels and only word count (2/2/3, trimmed from the reference's 3/3/4 —
 * a 10-15 min/day product doesn't need that many rounds) and vocabulary
 * ramp the difficulty. Every cross-combination of tiles was checked offline
 * so no unintended valid Spanish word can be formed (the JAR+DIN+ERA trap)
 * — a rejected attempt is always genuinely not a word.
 *
 * This day used to open with a short date-orientation warm-up (an MMSE-style
 * "¿qué día es hoy?"), kept only so the challenge wouldn't lose its single
 * orientación slot. That was a compromise — the full Reality-Orientation game
 * ("Empecemos por hoy") now lives on its own at día 13, so día 1 is a clean
 * word game and its area is lenguaje.
 *
 * Double-tap safety (the ClaveDeSimbolos lesson): the tile bank is DERIVED
 * (level tiles minus placed minus consumed-by-found-words) and every state
 * transition is a functional update with an idempotent guard, so two taps
 * landing in one React batch can't place a tile twice or desync the check.
 * Wrong attempts nudge and leave tiles placed (día-3 contract: a wrong
 * check never undoes the player's work). No timer, never red.
 *
 * No manual "Revisar" button — the check fires automatically the instant
 * the slots fill up. Both outcomes get an equally visible full-width card
 * right under the slots, on purpose: a quiet result is as confusing as no
 * result for this audience. Correct auto-advances after a beat; wrong stays
 * up (never red — orange "try again" framing, not an error) until they tap
 * a tile, since that's a real decision, not something to rush past.
 * checkedRef guards against re-checking the same placement twice (React 18
 * effect re-invoke).
 */

interface WordEntry {
  word: string
  chunks: string[]
}
interface Level {
  n: number
  name: string
  chunksPerWord: number
  /** Pool of word-sets — ONE set is drawn at random per visit to the level
   * (keyed on roundKey), so replaying the day serves different words. Every
   * set in a level has the SAME word count, so the fixed-sum scoring below
   * stays exact no matter which set is drawn. */
  sets: WordEntry[][]
}

// Sets verified offline (chunks concatenate exactly; no duplicate tiles per
// set; cross-combinations checked by hand to not form real words — dropped
// candidates like MANTEL/MANOTA, SALERO/PELERO, TESORO/TESINA, CABEZA/CABINA
// where a stray tile pair spelled something real).
//
// Nivel 1 reuses CHOCOLATE/TELEVISOR/COLECTIVO/CARAMELOS — the four words
// originally trimmed OUT of nivel 2/3 for being too immediately obvious.
// "Too easy for nivel 2" is exactly the bar nivel 1 wants, and their
// 3-chunk breakdown was already offline-verified in their original sets.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    chunksPerWord: 3,
    sets: [
      [
        { word: 'CHOCOLATE', chunks: ['CHO', 'COL', 'ATE'] },
        { word: 'TELEVISOR', chunks: ['TEL', 'EVI', 'SOR'] },
      ],
      [
        { word: 'COLECTIVO', chunks: ['COL', 'ECT', 'IVO'] },
        { word: 'CARAMELOS', chunks: ['CAR', 'AME', 'LOS'] },
      ],
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    chunksPerWord: 3,
    sets: [
      [
        { word: 'PRIMAVERA', chunks: ['PRI', 'MAV', 'ERA'] },
        { word: 'PANADERIA', chunks: ['PAN', 'ADE', 'RIA'] },
      ],
      [
        { word: 'CARNICERO', chunks: ['CAR', 'NIC', 'ERO'] },
        { word: 'ALMANAQUE', chunks: ['ALM', 'ANA', 'QUE'] },
      ],
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    chunksPerWord: 3,
    sets: [
      [
        { word: 'MERMELADA', chunks: ['MER', 'MEL', 'ADA'] },
        { word: 'MEDIALUNA', chunks: ['MED', 'IAL', 'UNA'] },
        { word: 'BICICLETA', chunks: ['BIC', 'ICL', 'ETA'] },
      ],
      [
        { word: 'MARIPOSAS', chunks: ['MAR', 'IPO', 'SAS'] },
        { word: 'VERDULERO', chunks: ['VER', 'DUL', 'ERO'] },
        { word: 'TELEGRAMA', chunks: ['TEL', 'EGR', 'AMA'] },
      ],
    ],
  },
]
// Every set within a level has the same word count, so this sum is
// draw-independent (2 + 2 + 3).
const TOTAL_WORDS = LEVELS.reduce((s, l) => s + l.sets[0].length, 0)

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

const NUDGES_WORD = [
  'Esa combinación no forma una de las palabras. Tocá una ficha para sacarla y probá otro orden.',
  'Todavía no. Probá juntar otras fichas.',
  'Esa palabra no es. Reacomodá las fichas y volvé a intentar.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']

interface Tile {
  id: number
  text: string
}

export function ArmaLasPalabras({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which set (index into LEVELS[i].sets) is playing for level i THIS "epoch"
  // (a full 3-level pass). Decided once per epoch — at mount, and again on
  // "Empezar de nuevo" — never re-rolled just because the player re-visits a
  // level, so "Repetir" can hand back the exact same 3 sets deterministically
  // instead of re-randomizing and accidentally landing on something new.
  const [epochChoices, setEpochChoices] = useState(() => LEVELS.map((lvl) => Math.floor(Math.random() * lvl.sets.length)))
  const level = LEVELS[levelIdx]
  const words = level.sets[epochChoices[levelIdx]]

  // All tiles of the drawn set, stable ids.
  const tiles: Tile[] = useMemo(
    () => words.flatMap((w) => w.chunks).map((text, id) => ({ id, text })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words],
  )
  const tileOrder = useMemo(
    () => shuffle(tiles.map((t) => t.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [placed, setPlaced] = useState<number[]>([]) // tile ids, in slot order
  const [found, setFound] = useState<string[]>([]) // words found this level
  const [hint, setHint] = useState<string | null>(null)
  const [correctWord, setCorrectWord] = useState<string | null>(null) // brief "¡Correcto!" card
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // No success counter needed: every word always resolves, so the success total
  // is the constant TOTAL_WORDS (same fixed-sum reasoning as QuePalabraSeEsconde).
  const [mistakes, setMistakes] = useState(0)

  // DERIVED bank: level tiles minus placed minus consumed by found words.
  const consumedIds = useMemo(() => {
    const ids = new Set<number>()
    for (const w of found) {
      const entry = words.find((e) => e.word === w)
      entry?.chunks.forEach((c) => {
        const t = tiles.find((tl) => tl.text === c && !ids.has(tl.id))
        if (t) ids.add(t.id)
      })
    }
    return ids
  }, [found, words, tiles])
  const bank = tileOrder.filter((id) => !placed.includes(id) && !consumedIds.has(id))

  const done = found.length === words.length
  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  // ── juego handlers (all functional + idempotent) ────────────────────────
  function place(id: number) {
    setHint(null)
    setPlaced((prev) => {
      if (prev.includes(id) || prev.length >= level.chunksPerWord || consumedIds.has(id)) return prev
      return [...prev, id]
    })
  }
  function unplace(id: number) {
    setHint(null)
    setPlaced((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev))
  }
  // Auto-checks the instant the slots fill up — no "Revisar" tap required.
  // checkedRef remembers which exact placement was last checked so a stray
  // double-invoke (React 18 effect re-run) can't double-count a mistake or
  // re-fire the correct-card timer for the same attempt.
  const checkedRef = useRef<string | null>(null)
  useEffect(() => {
    if (placed.length !== level.chunksPerWord) {
      checkedRef.current = null
      return
    }
    const key = placed.join(',')
    if (checkedRef.current === key) return
    checkedRef.current = key

    const attempt = placed.map((id) => tiles.find((t) => t.id === id)?.text ?? '').join('')
    const target = words.find((w) => w.word === attempt)
    if (target && !found.includes(target.word)) {
      setCorrectWord(target.word)
      const timer = setTimeout(() => {
        setFound((prev) => (prev.includes(target.word) ? prev : [...prev, target.word]))
        setPlaced([])
        setCorrectWord(null)
      }, 1200)
      return () => clearTimeout(timer)
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(NUDGES_WORD))
    // Tiles stay where the player put them — adjust, don't restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, level.chunksPerWord])

  // Synchronous resets in the handler (never a [levelIdx]-keyed effect).

  // "Siguiente nivel" — advance within the SAME attempt. epochChoices is left
  // alone: level i+1's word-set was already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setPlaced([])
    setFound([])
    setHint(null)
  }

  // Shared by both restart buttons on the "Empezar de nuevo" screen (only
  // ever shown once level 3 is done, so always a genuine day restart —
  // zero the mistake accumulator either way). roundKey always bumps here:
  // it's the "which attempt is this" generation counter the onComplete
  // effect uses to fire again on a replay, independent of whether the
  // words themselves changed.
  function restartEpoch() {
    setLevelIdx(0)
    setPlaced([])
    setFound([])
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same 3 word-sets as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Empezar de nuevo" — a fresh random word-set per level, same as before
  // this feature existed (the only option there used to be).
  function restartDifferent() {
    restartEpoch()
    setEpochChoices(LEVELS.map((lvl) => Math.floor(Math.random() * lvl.sets.length)))
  }

  // Fires once per roundKey when level 3's last word is found.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      // Scored successes: every word found across levels.
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_WORDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base font-medium text-tiam-blue">
              Uní {level.chunksPerWord} fichas para formar una palabra. Hay {words.length} escondidas.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {found.length} de {words.length}
            </p>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Palabras encontradas */}
          {found.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {found.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 rounded-full border border-tiam-green/30 bg-tiam-green/10 px-3 py-1 text-sm font-bold tracking-wide text-slate-800"
                >
                  <Check className="h-3.5 w-3.5 text-tiam-green" strokeWidth={3} />
                  {w}
                </span>
              ))}
            </div>
          )}

          {/* Tarjeta "¡Correcto!" — reemplaza la ranura mientras se confirma
              la palabra sola, sin pedir ningún toque más. */}
          {correctWord ? (
            <div className="mt-4 rounded-2xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
                <CheckCircle2 className="h-7 w-7 text-tiam-green" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">¡Correcto!</p>
              <p className="mt-1 text-slate-600">Formaste {correctWord}.</p>
            </div>
          ) : (
            <>
              {/* Ranura de armado */}
              <div className="mt-4 flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                {placed.length === 0 && (
                  <span className="text-base text-slate-400">Tocá las fichas de abajo para armar una palabra</span>
                )}
                {placed.map((id) => {
                  const t = tiles.find((tl) => tl.id === id)!
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => unplace(id)}
                      aria-label={`Quitar ficha ${t.text}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-4 text-xl font-extrabold tracking-wide text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                    >
                      {t.text}
                    </button>
                  )
                })}
              </div>

              {/* Tarjeta "todavía no" — tan visible como la de "¡Correcto!",
                  pegada a la ranura para que quede claro a qué se refiere.
                  Nunca roja (día-1 contract): naranja suave + ícono de
                  reintentar, no de error. Se queda hasta que tocan una ficha
                  (place/unplace ya limpian el hint), no hay timer acá porque
                  el jugador tiene que decidir qué cambiar. */}
              {hint && (
                <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                    <RotateCcw className="h-6 w-6 text-tiam-orange" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-slate-900">Todavía no es esa</p>
                  <p className="mt-1 text-slate-600">{hint}</p>
                </div>
              )}

              {/* Banco de fichas */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {bank.map((id) => {
                  const t = tiles.find((tl) => tl.id === id)!
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => place(id)}
                      aria-label={`Ficha ${t.text}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 text-xl font-extrabold tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                    >
                      {t.text}
                    </button>
                  )
                })}
              </div>
            </>
          )}
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
            Encontraste las {words.length} palabras: {words.map((w) => w.word).join(', ')}.
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
            // Two ways to go again, not one: some players want another crack
            // at these exact words, others want fresh ones — "Empezar de
            // nuevo" alone used to always mean the latter with no way to ask
            // for the former.
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir estas palabras
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Empezar de nuevo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
