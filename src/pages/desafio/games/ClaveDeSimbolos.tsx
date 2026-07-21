import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Square, Triangle, Star, Diamond, Heart, Hexagon, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Clave de símbolos" — día 4, atención. A symbol-digit coding task (the WAIS
 * Digit-Symbol Coding paradigm): a fixed KEY pairs each symbol with a number and
 * stays visible the whole time; the player decodes a row of symbols by tapping
 * each one's number. Coding is the gold-standard attention / processing-speed
 * exercise, and a genuinely different attention sub-skill from the letter-
 * cancellation game it replaces — substitution via a key, not visual search for
 * a target.
 *
 * Each symbol is REDUNDANT-CODED (a distinct shape AND a distinct colour), so the
 * task never hinges on colour discrimination — robust for older eyes and colour
 * blindness, unlike the colour-only reference worksheet that inspired it. Content
 * is original.
 *
 * House style: no timer, a wrong tap only nudges (muted slate, never red), tap-
 * only. Difficulty climbs by key size and row length (5 → 6 → 7).
 */

interface Sym {
  Icon: LucideIcon
  color: string
}
// Number of each symbol = its index + 1. Shape + colour both distinct.
const SYMBOLS: Sym[] = [
  { Icon: Circle, color: '#2563EB' }, // 1 azul
  { Icon: Square, color: '#15803D' }, // 2 verde
  { Icon: Triangle, color: '#C2410C' }, // 3 naranja
  { Icon: Star, color: '#7C3AED' }, // 4 violeta
  { Icon: Diamond, color: '#DC2626' }, // 5 rojo
  { Icon: Heart, color: '#0D9488' }, // 6 verde azulado
  { Icon: Hexagon, color: '#92400E' }, // 7 marrón
]

interface Level {
  n: number
  name: string
  keySize: number
  rowLen: number
  rounds: number
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', keySize: 5, rowLen: 5, rounds: 2 },
  { n: 2, name: 'Nivel 2', keySize: 6, rowLen: 6, rounds: 3 },
  { n: 3, name: 'Nivel 3', keySize: 7, rowLen: 7, rounds: 3 },
]
// Every decoded symbol is a genuine correct tap (no give-up path), so
// totalAttempts = mistakes + correctCount (same shape as QueOficioEs).

function randomRow(keySize: number, rowLen: number): number[] {
  // Random symbols, no immediate repeat (so two identical symbols never sit
  // side by side — keeps each decode a fresh look-up rather than a copy).
  const row: number[] = []
  for (let i = 0; i < rowLen; i++) {
    let s = Math.floor(Math.random() * keySize)
    while (i > 0 && s === row[i - 1]) s = Math.floor(Math.random() * keySize)
    row.push(s)
  }
  return row
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const HINTS = [
  'Ese no. Fijate en la clave qué número le toca a esa figura.',
  'Casi. Mirá arriba: ¿qué número tiene esa figura?',
  'No es ese número. Buscá la figura en la clave y probá de nuevo.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena vista!']

function SymbolMark({ idx, size = 'h-7 w-7' }: { idx: number; size?: string }) {
  const s = SYMBOLS[idx]
  return <s.Icon className={size} style={{ color: s.color }} fill={s.color} strokeWidth={1.5} />
}

export function ClaveDeSimbolos({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const [roundIdx, setRoundIdx] = useState(0)
  const done = roundIdx >= level.rounds

  // The current row to decode — a fresh random sequence per level/round.
  const row = useMemo(
    () => randomRow(level.keySize, level.rowLen),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )

  const [answered, setAnswered] = useState(0) // how many symbols of this row are decoded
  // Ref mirror of `answered`, read inside handleNumber instead of the closure
  // value: two taps landing in the same React batch (a real risk — an older
  // adult's tremor double-tap) would otherwise both read the STALE position,
  // miss the end-of-row check, push `answered` past rowLen and soft-lock the
  // row (row[answered] undefined → every tap "wrong" forever). The ref is
  // always current even within a batch.
  const answeredRef = useRef(0)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (wrap) —
  // same policy as QueObjetoEs.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function handleNumber(num: number) {
    if (done) return
    const pos = answeredRef.current
    if (pos >= level.rowLen) return // defensive: never index past the row
    const correct = row[pos] + 1
    if (num === correct) {
      setCorrectCount((c) => c + 1)
      setHint(null)
      const next = pos + 1
      if (next >= level.rowLen) {
        // Row complete → next row (or, if it was the last, `done` flips true).
        answeredRef.current = 0
        setAnswered(0)
        setRoundIdx((i) => i + 1)
      } else {
        answeredRef.current = next
        setAnswered(next)
      }
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Synchronous resets inside the handlers — never in a separate effect keyed on
  // [levelIdx, roundKey], which would let the onComplete effect below read a
  // stale `done` on the render that just arrived at the new level (the bug fixed
  // in ElVuelto/CuantosHay/QueObjetoEs).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    answeredRef.current = 0
    setAnswered(0)
    setHint(null)
    if (isWrap) {
      setMistakes(0)
      setCorrectCount(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    answeredRef.current = 0
    setAnswered(0)
    setHint(null)
  }

  // Fires once per roundKey when level 3's last row is decoded.
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
            <p className="mt-2 text-sm font-medium text-tiam-blue">
              Para cada figura, tocá el número que le toca según la clave.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Fila {roundIdx + 1} de {level.rounds}
            </p>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Clave (siempre visible) */}
          <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-400">La clave</p>
            <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-2">
              {Array.from({ length: level.keySize }, (_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <SymbolMark idx={i} size="h-6 w-6" />
                  <span className="mt-0.5 text-sm font-extrabold text-slate-700">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fila a decodificar */}
          <div className="mt-4 flex flex-wrap items-start justify-center gap-1.5">
            {row.map((symIdx, i) => {
              const isCurrent = i === answered
              const isDoneCell = i < answered
              return (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={[
                      'flex h-11 w-11 items-center justify-center rounded-lg border-2 transition',
                      isCurrent ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : 'border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    <SymbolMark idx={symIdx} size="h-6 w-6" />
                  </div>
                  <div className="mt-1 flex h-7 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-base font-extrabold text-tiam-green">
                    {isDoneCell ? symIdx + 1 : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Teclado de números */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {Array.from({ length: level.keySize }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumber(num)}
                aria-label={`Número ${num}`}
                className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-xl font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
              >
                {num}
              </button>
            ))}
          </div>

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
            Descifraste las {level.rounds} filas — completaste el nivel {levelIdx + 1}.
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
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
