import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, Minus, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Unite con pista" — día 23 (Mes 2), memoria. Two mechanics chained per
 * level, both reusing existing house patterns rather than inventing new UI:
 *
 *   Fase 1 (armar): a category clue ("MÚSICA") names the family a hidden
 *   word belongs to; the player spells it by tapping letter tiles from a
 *   bank that carries decoy letters (más letras de las justas), same local
 *   bank + DECOYS_PER_LEVEL idea as DosPistas.tsx día 28 — but ONE text clue
 *   instead of two image clues, so this needs zero new art.
 *
 *   Fase 2 (repaso): once every word for the level is solved, a shuffled
 *   set of words appears — the ones just solved PLUS foils that never
 *   appeared — and the player taps only the ones from fase 1. Grading and
 *   visual language (hit=green check / missed=blue eye / false-positive=
 *   grey minus, never red) are copied from QueHayEnLaMesa.tsx's recognition
 *   phase, applied to words instead of photos.
 *
 * Both fases run per level (not once for the whole day): each level is its
 * own self-contained "solve then recognize" round, matching every other
 * game's 3-independent-levels shape rather than a single day-spanning flow.
 *
 * All answers are lowercase/accent-free (letter tiles carry no accent — the
 * DosPistas/día-3 lesson), even where the natural spelling has one.
 */

interface Entry {
  clue: string
  answer: string
}
interface Level {
  n: number
  name: string
  entries: Entry[]
  foils: string[]
  decoys: number
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    entries: [
      { clue: 'MÚSICA', answer: 'piano' },
      { clue: 'COCINA', answer: 'olla' },
    ],
    foils: ['taza', 'silla', 'llave'],
    decoys: 2,
  },
  {
    n: 2,
    name: 'Nivel 2',
    entries: [
      { clue: 'ANIMALES', answer: 'tigre' },
      { clue: 'FRUTAS', answer: 'banana' },
      { clue: 'ROPA', answer: 'camisa' },
    ],
    foils: ['leon', 'manzana', 'pantalon', 'zapato'],
    decoys: 3,
  },
  {
    n: 3,
    name: 'Nivel 3',
    entries: [
      { clue: 'DEPORTES', answer: 'futbol' },
      { clue: 'MUEBLES', answer: 'armario' },
      { clue: 'PROFESIONES', answer: 'medico' },
    ],
    foils: ['tenis', 'sofa', 'abogado', 'guitarra', 'cocinero'],
    decoys: 4,
  },
]
const TOTAL_PAIRS = LEVELS.reduce((sum, l) => sum + l.entries.length, 0)
const TOTAL_CHIPS = LEVELS.reduce((sum, l) => sum + l.entries.length + l.foils.length, 0)
const TOTAL_ATTEMPTS = TOTAL_PAIRS + TOTAL_CHIPS

const DECOY_POOL = 'aeiosrntldcumpb'.split('')

interface Tile {
  id: number
  value: string
}
function buildTiles(answer: string, decoys: number): Tile[] {
  const values = answer.split('')
  for (let i = 0; i < decoys; i++) values.push(pickOne(DECOY_POOL))
  return shuffle(values).map((value, id) => ({ id, value }))
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

const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const NUDGE = ['Casi. Pensá en la pista y probá de nuevo.', 'No es esa palabra. Revisá el orden de las letras.', 'Con calma — fijate qué palabra tiene que ver con la pista.']
const ACCENT = '#0D9488' // teal

type SubPhase = 'build' | 'recognize'

export function UniteConPista({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const [subPhase, setSubPhase] = useState<SubPhase>('build')
  const [pairIdx, setPairIdx] = useState(0)
  const entry = level.entries[pairIdx]

  const tiles = useMemo(
    () => buildTiles(entry.answer, level.decoys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, pairIdx],
  )
  const [placedIds, setPlacedIds] = useState<number[]>([])
  const placed = placedIds.map((id) => tiles.find((t) => t.id === id)).filter((t): t is Tile => !!t)
  const bank = tiles.filter((t) => !placedIds.includes(t.id))
  const readyToCheck = placed.length === entry.answer.length

  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])

  // Recognition-phase state (fase 2), built once per level/roundKey.
  const recognitionOptions = useMemo(
    () => shuffle([...level.entries.map((e) => e.answer), ...level.foils]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const targetWords = useMemo(() => new Set(level.entries.map((e) => e.answer)), [level])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [graded, setGraded] = useState(false)
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])

  // Mistakes accumulate across both fases and across levels 1→2→3, only
  // zeroed on a true day restart (nextLevel's wrap branch) — same policy as
  // every sibling game. totalAttempts is a fixed derived constant (every
  // word is eventually spelled correctly; every level is graded exactly
  // once), same "mistakes + fixed total" shape as DosPistas/QueHayEnLaMesa.
  const [mistakes, setMistakes] = useState(0)

  const done = subPhase === 'recognize' && graded

  useEffect(() => {
    if (done) {
      const correctFound = [...selected].filter((w) => targetWords.has(w)).length
      setLevelPraise(pickOne(correctFound / targetWords.size >= 0.6 ? PRAISE_GOOD : ['¡Buen intento! Con la práctica se recuerda cada vez más.']))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function handlePlace(item: Tile) {
    if (resolved || placed.length >= entry.answer.length) return
    setHint(null)
    setPlacedIds((ids) => [...ids, item.id])
  }
  function handleUnplace(item: Tile) {
    if (resolved) return
    setHint(null)
    setPlacedIds((ids) => ids.filter((i) => i !== item.id))
  }
  function check() {
    if (!readyToCheck) return
    const spelled = placed.map((t) => t.value).join('')
    if (spelled === entry.answer) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE))
      setMistakes((m) => m + 1)
    }
  }
  function nextPair() {
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setPairIdx((i) => i + 1)
  }
  function goToRecognize() {
    setSubPhase('recognize')
  }
  function toggleWord(word: string) {
    if (graded) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }
  function gradeRecognition() {
    if (graded) return
    const correctFound = [...selected].filter((w) => targetWords.has(w)).length
    const missed = targetWords.size - correctFound
    const falsePositives = selected.size - correctFound
    setMistakes((m) => m + missed + falsePositives)
    setGraded(true)
  }

  // Resets happen HERE, synchronously with the level/round change — the same
  // discipline every sibling game follows (see ElVuelto.tsx for the bug this
  // avoids: an effect-based reset reads `done` stale on the very render that
  // reaches the last level, firing onComplete with garbage).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setSubPhase('build')
    setPairIdx(0)
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setSelected(new Set())
    setGraded(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setSubPhase('build')
    setPairIdx(0)
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setSelected(new Set())
    setGraded(false)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: TOTAL_ATTEMPTS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const isLastPair = pairIdx >= level.entries.length - 1

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>

        {!done && subPhase === 'build' && (
          <>
            <p className="mt-2 text-base text-slate-500">La pista te dice de qué familia es la palabra. Armala con las letras.</p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {pairIdx} de {level.entries.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${(pairIdx / level.entries.length) * 100}%`, backgroundColor: ACCENT }}
                />
              </div>
            </div>
          </>
        )}

        {!done && subPhase === 'recognize' && (
          <p className="mt-2 text-base text-slate-500">Tocá solo las palabras que armaste recién en este nivel.</p>
        )}
      </div>

      {/* Fase 1: armar la palabra */}
      {!done && subPhase === 'build' && (
        <>
          {!resolved && (
            <p
              className="mt-4 text-center text-2xl font-extrabold tracking-wide"
              style={{ color: ACCENT }}
            >
              {entry.clue}
            </p>
          )}

          <div className="mt-4 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {Array.from({ length: entry.answer.length }).map((_, i) => {
              const item = placed[i]
              if (!item) {
                return (
                  <span
                    key={`slot-${i}`}
                    aria-hidden="true"
                    className="h-[44px] w-[36px] rounded-xl border-2 border-dashed border-slate-300 bg-white"
                  />
                )
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={resolved}
                  onClick={() => handleUnplace(item)}
                  aria-label={`Quitar letra ${item.value}`}
                  className={[
                    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 px-2 text-xl font-extrabold uppercase transition',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    resolved ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : 'bg-white/60 text-slate-900',
                  ].join(' ')}
                  style={!resolved ? { borderColor: ACCENT, backgroundColor: 'rgba(13,148,136,0.06)' } : undefined}
                >
                  {item.value}
                </button>
              )
            })}
          </div>

          {!resolved && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlace(item)}
                  aria-label={`Letra ${item.value}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-2 text-xl font-extrabold uppercase text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {!resolved && (
            <div className="mt-4 flex flex-col items-center gap-2">
              {readyToCheck && (
                <button
                  type="button"
                  onClick={check}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white transition"
                  style={{ backgroundColor: ACCENT }}
                >
                  Revisar
                </button>
              )}
              {hint && <p className="text-center text-sm font-medium text-slate-500">{hint}</p>}
            </div>
          )}

          {resolved && (
            <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
                <Sparkles className="h-6 w-6 text-tiam-green" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
              <p className="mt-1 text-slate-600">
                La palabra era <span className="font-semibold uppercase text-slate-800">{entry.answer}</span>.
              </p>
              <button
                type="button"
                onClick={isLastPair ? goToRecognize : nextPair}
                className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white transition"
                style={{ backgroundColor: ACCENT }}
              >
                {isLastPair ? 'Ir al repaso' : 'Siguiente palabra'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Fase 2: repaso / reconocimiento. Stays visible (with its graded
          badges) even after `done` flips true, so the hit/missed/false-
          positive feedback is actually seen — the "Nivel completo" card
          below is additional, not a replacement (same layered structure as
          QueHayEnLaMesa's results phase: graded board + progression card
          together, never one instead of the other). */}
      {subPhase === 'recognize' && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {recognitionOptions.map((word) => {
              const isSelected = selected.has(word)
              const isTarget = targetWords.has(word)
              let badge: 'hit' | 'missed' | 'false-positive' | null = null
              if (graded) {
                if (isTarget && isSelected) badge = 'hit'
                else if (isTarget && !isSelected) badge = 'missed'
                else if (!isTarget && isSelected) badge = 'false-positive'
              }
              return (
                <button
                  key={word}
                  type="button"
                  disabled={graded}
                  onClick={() => toggleWord(word)}
                  aria-pressed={isSelected}
                  className={[
                    'relative min-h-[48px] rounded-2xl border-2 bg-white px-4 text-lg font-bold uppercase transition',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    badge === 'hit' ? 'border-tiam-green bg-tiam-green/5 text-slate-900' : '',
                    badge === 'missed' ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900' : '',
                    badge === 'false-positive' ? 'border-slate-200 text-slate-400 opacity-60' : '',
                    !badge && isSelected ? 'text-slate-900' : '',
                    !badge && !isSelected ? 'border-slate-200 text-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                  ].join(' ')}
                  style={!badge && isSelected ? { borderColor: ACCENT, backgroundColor: 'rgba(13,148,136,0.06)' } : undefined}
                >
                  {word}
                  {badge === 'hit' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                  {badge === 'missed' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-blue text-white shadow">
                      <Eye className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                  {badge === 'false-positive' && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-white shadow">
                      <Minus className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {!graded && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={gradeRecognition}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 font-semibold text-white transition"
                style={{ backgroundColor: ACCENT }}
              >
                Revisar
              </button>
            </div>
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
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              Acertaste
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-blue text-white">
                <Eye className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              Se te pasó
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-white">
                <Minus className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              No era ésta
            </span>
          </div>
          <p className="mt-3 text-slate-600">Completaste el {level.name.toLowerCase()}.</p>
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
