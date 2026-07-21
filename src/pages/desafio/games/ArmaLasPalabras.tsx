import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Armá las palabras" — día 1. A hybrid opener in two acts:
 *
 * 1) FECHA — a quick MMSE-style orientation check (day of week, then month,
 *    against the real current date). Día 1 is the challenge's ONLY orientación
 *    day, and orientation-to-date is clinically central for this population —
 *    replacing the old game outright would have zeroed the area, so the date
 *    check stays as the warm-up and the day keeps its 'orientacion' area (no
 *    backend change).
 *
 * 2) PALABRAS — the main game, inspired by a competitor worksheet TYPE
 *    (combine letter-fragment squares to deduce words; content entirely ours):
 *    a bank of 3-letter tiles, and the player taps tiles into slots to build
 *    each hidden word. Which words exist is not told — deducing them from the
 *    fragments is the executive/lexical work. Levels ramp 3×2-tile words →
 *    3×3-tile → 4×3-tile (the reference's full size). Every cross-combination
 *    of tiles was checked offline so no unintended valid Spanish word can be
 *    formed (the JAR+DIN+ERA trap) — a rejected attempt is always genuinely
 *    not a word of the set.
 *
 * Double-tap safety (the ClaveDeSimbolos lesson): the tile bank is DERIVED
 * (level tiles minus placed minus consumed-by-found-words) and every state
 * transition is a functional update with an idempotent guard, so two taps
 * landing in one React batch can't place a tile twice or desync the check.
 * Wrong "Revisar" nudges and leaves tiles placed (día-3 contract: a wrong
 * check never undoes the player's work). No timer, never red.
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
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    chunksPerWord: 2,
    sets: [
      [
        { word: 'CAMINO', chunks: ['CAM', 'INO'] },
        { word: 'PALOMA', chunks: ['PAL', 'OMA'] },
        { word: 'FUTURO', chunks: ['FUT', 'URO'] },
      ],
      [
        { word: 'PELOTA', chunks: ['PEL', 'OTA'] },
        { word: 'CARTON', chunks: ['CAR', 'TON'] },
        { word: 'CAMISA', chunks: ['CAM', 'ISA'] },
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
        { word: 'CHOCOLATE', chunks: ['CHO', 'COL', 'ATE'] },
        { word: 'PANADERIA', chunks: ['PAN', 'ADE', 'RIA'] },
      ],
      [
        { word: 'CARNICERO', chunks: ['CAR', 'NIC', 'ERO'] },
        { word: 'ALMANAQUE', chunks: ['ALM', 'ANA', 'QUE'] },
        { word: 'COLECTIVO', chunks: ['COL', 'ECT', 'IVO'] },
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
        { word: 'TELEVISOR', chunks: ['TEL', 'EVI', 'SOR'] },
        { word: 'MEDIALUNA', chunks: ['MED', 'IAL', 'UNA'] },
        { word: 'BICICLETA', chunks: ['BIC', 'ICL', 'ETA'] },
      ],
      [
        { word: 'CARAMELOS', chunks: ['CAR', 'AME', 'LOS'] },
        { word: 'MARIPOSAS', chunks: ['MAR', 'IPO', 'SAS'] },
        { word: 'VERDULERO', chunks: ['VER', 'DUL', 'ERO'] },
        { word: 'TELEGRAMA', chunks: ['TEL', 'EGR', 'AMA'] },
      ],
    ],
  },
]
// Every set within a level has the same word count, so this sum is
// draw-independent (3 + 3 + 4).
const TOTAL_WORDS = LEVELS.reduce((s, l) => s + l.sets[0].length, 0)
const FECHA_QUESTIONS = 2 // día de la semana + mes

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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

const NUDGES_FECHA = [
  'Ese no es — pensalo con calma, no hay apuro.',
  'Casi. Tomate un momento y probá de nuevo.',
]
const NUDGES_WORD = [
  'Esa combinación no forma una de las palabras. Tocá una ficha para sacarla y probá otro orden.',
  'Todavía no. Probá juntar otras fichas.',
  'Esa palabra no es. Reacomodá las fichas y volvé a intentar.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']

type Phase = 'fecha' | 'juego'

interface Tile {
  id: number
  text: string
}

export function ArmaLasPalabras({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('fecha')
  const [fechaStep, setFechaStep] = useState(0) // 0 = día de la semana, 1 = mes
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())

  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Real current date — the orientación anchor. Computed once per mount.
  const [today] = useState(() => new Date())
  const correctDay = DAY_NAMES[today.getDay()]
  const correctMonth = MONTH_NAMES[today.getMonth()]
  // Month options: correct + prev + next + one distant, shuffled once.
  const [monthOptions] = useState(() => {
    const m = today.getMonth()
    const prev = MONTH_NAMES[(m + 11) % 12]
    const next = MONTH_NAMES[(m + 1) % 12]
    const far = MONTH_NAMES[(m + 6) % 12]
    return shuffle([MONTH_NAMES[m], prev, next, far])
  })

  // One word-set drawn at random per visit to the level — a replay (new
  // roundKey) or a fresh open serves different words, same as every other
  // game's pool-and-shuffle pattern.
  const words = useMemo(
    () => pickOne(level.sets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

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
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // No success counter needed: every fecha question and every word always
  // resolves, so the success total is the constant FECHA_QUESTIONS + TOTAL_WORDS
  // (same fixed-sum reasoning as QuePalabraSeEsconde).
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

  // ── fecha handlers ──────────────────────────────────────────────────────
  function answerFecha(option: string) {
    const correct = fechaStep === 0 ? correctDay : correctMonth
    if (option === correct) {
      setHint(null)
      setEliminated(new Set())
      if (fechaStep === 0) setFechaStep(1)
      else setPhase('juego')
    } else {
      // Idempotent: adding an already-eliminated option changes nothing, so a
      // same-batch double tap can't double-count the mistake.
      setEliminated((prev) => {
        if (prev.has(option)) return prev
        return new Set(prev).add(option)
      })
      setMistakes((m) => m + 1)
      setHint(pickOne(NUDGES_FECHA))
    }
  }

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
  function check() {
    if (placed.length !== level.chunksPerWord) return
    const attempt = placed.map((id) => tiles.find((t) => t.id === id)?.text ?? '').join('')
    const target = words.find((w) => w.word === attempt)
    if (target && !found.includes(target.word)) {
      setFound((prev) => (prev.includes(target.word) ? prev : [...prev, target.word]))
      setPlaced([])
      setHint(null)
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(NUDGES_WORD))
      // Tiles stay where the player put them — adjust, don't restart.
    }
  }

  // Synchronous resets in the handler (never a [levelIdx]-keyed effect).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPlaced([])
    setFound([])
    setHint(null)
    if (isWrap) {
      // Genuine day restart: back to the date warm-up, zero the accumulators.
      setPhase('fecha')
      setFechaStep(0)
      setEliminated(new Set())
      setMistakes(0)
    }
  }

  // Fires once per roundKey when level 3's last word is found.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      // Scored successes: 2 fecha questions + every word found across levels.
      onComplete({ mistakes, totalAttempts: mistakes + FECHA_QUESTIONS + TOTAL_WORDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const fechaOptions = fechaStep === 0 ? DAY_NAMES : monthOptions

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {phase === 'fecha' && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            <CalendarDays className="h-3.5 w-3.5" />
            Para empezar
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">
            {fechaStep === 0 ? '¿Qué día de la semana es hoy?' : '¿En qué mes estamos?'}
          </h2>
          <p className="mt-2 text-base text-slate-500">Ubicarse en el día de hoy también es ejercitar la cabeza.</p>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2.5">
            {fechaOptions.map((opt) => {
              const isEliminated = eliminated.has(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isEliminated}
                  onClick={() => answerFecha(opt)}
                  className={[
                    'min-h-[48px] rounded-xl border-2 px-3 text-base font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {hint && <p className="mt-4 text-sm font-medium text-slate-500">{hint}</p>}
        </div>
      )}

      {phase === 'juego' && (
        <>
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
              {level.name}
            </span>
            {!done && (
              <>
                <p className="mt-2 text-sm font-medium text-tiam-blue">
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

              {/* Ranura de armado */}
              <div className="mt-4 flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                {placed.length === 0 && (
                  <span className="text-sm text-slate-400">Tocá las fichas de abajo para armar una palabra</span>
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

              {/* Revisar */}
              {placed.length === level.chunksPerWord && (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={check}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
                  >
                    Revisar
                  </button>
                </div>
              )}

              {hint && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
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
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={nextLevel}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
                >
                  {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
