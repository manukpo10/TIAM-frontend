import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Minus, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cuatro palabras" — a word-based recognition-memory mini-game.
 *
 * Same engine shape as "¿Qué hay en la mesa?" (study → hidden test → warm
 * reveal, no live feedback during the test, never red/orange), but pure
 * typography instead of illustrations — words are abstract enough that
 * pictures would either mismatch or add nothing, and this app already
 * proved pure-typography games work well (CazadorDeLetras).
 *
 * Deliberately NOT sharing a hook with QueHayEnLaMesa.tsx: that component
 * is already live in production, and retrofitting a shared abstraction
 * onto shipped, verified code is a real regression risk for a purely
 * internal code-cleanliness win nobody using the app would ever notice.
 * Same call already made for CazadorDeLetras vs. BuscarLosRojos.
 */

interface WordItem {
  id: string
  label: string
  category: string
}

const WORDS: WordItem[] = [
  // ── Herramientas (5) ──
  { id: 'martillo', label: 'martillo', category: 'herramientas' },
  { id: 'taladro', label: 'taladro', category: 'herramientas' },
  { id: 'pinza', label: 'pinza', category: 'herramientas' },
  { id: 'sierra', label: 'sierra', category: 'herramientas' },
  { id: 'destornillador', label: 'destornillador', category: 'herramientas' },
  // ── Colores (5) ──
  { id: 'azul', label: 'azul', category: 'colores' },
  { id: 'celeste', label: 'celeste', category: 'colores' },
  { id: 'verde', label: 'verde', category: 'colores' },
  { id: 'amarillo', label: 'amarillo', category: 'colores' },
  { id: 'violeta', label: 'violeta', category: 'colores' },
  // ── Días de la semana (5) ──
  { id: 'domingo', label: 'domingo', category: 'dias' },
  { id: 'sabado', label: 'sábado', category: 'dias' },
  { id: 'lunes', label: 'lunes', category: 'dias' },
  { id: 'jueves', label: 'jueves', category: 'dias' },
  { id: 'miercoles', label: 'miércoles', category: 'dias' },
  // ── Naturaleza / agua (5) ──
  { id: 'rio', label: 'río', category: 'naturaleza' },
  { id: 'arroyo', label: 'arroyo', category: 'naturaleza' },
  { id: 'laguna', label: 'laguna', category: 'naturaleza' },
  { id: 'montana', label: 'montaña', category: 'naturaleza' },
  { id: 'bosque', label: 'bosque', category: 'naturaleza' },
  // ── Ropa (5) ──
  { id: 'camisa', label: 'camisa', category: 'ropa' },
  { id: 'pantalon', label: 'pantalón', category: 'ropa' },
  { id: 'bufanda', label: 'bufanda', category: 'ropa' },
  { id: 'pollera', label: 'pollera', category: 'ropa' },
  { id: 'sombrero', label: 'sombrero', category: 'ropa' },
  // ── Transporte (5) ──
  { id: 'colectivo', label: 'colectivo', category: 'transporte' },
  { id: 'bicicleta', label: 'bicicleta', category: 'transporte' },
  { id: 'tren', label: 'tren', category: 'transporte' },
  { id: 'barco', label: 'barco', category: 'transporte' },
  { id: 'avion', label: 'avión', category: 'transporte' },
]

// Level-1 distractors — unrelated to every category above (easy rejects).
const FAR_DOMAIN: WordItem[] = [
  { id: 'elefante', label: 'elefante', category: 'lejano' },
  { id: 'jirafa', label: 'jirafa', category: 'lejano' },
  { id: 'guitarra', label: 'guitarra', category: 'lejano' },
  { id: 'espejo', label: 'espejo', category: 'lejano' },
  { id: 'tambor', label: 'tambor', category: 'lejano' },
  { id: 'cometa', label: 'cometa', category: 'lejano' },
]

const CATEGORIES = [...new Set(WORDS.map((w) => w.category))]
const byCategory = (cat: string) => WORDS.filter((w) => w.category === cat)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)

interface Round {
  studied: WordItem[]
  distractors: WordItem[]
}

function buildL1(): Round {
  return { studied: CATEGORIES.map((cat) => pick(byCategory(cat), 1)[0]), distractors: pick(FAR_DOMAIN, 6) }
}

function buildL2(): Round {
  const studied = pick(WORDS, 9)
  const studiedIds = new Set(studied.map((w) => w.id))
  const distractors = pick(WORDS.filter((w) => !studiedIds.has(w.id)), 9)
  return { studied, distractors }
}

function buildL3(): Round {
  const studied = pick(WORDS, 15)
  const studiedIds = new Set(studied.map((w) => w.id))
  const usedLureIds = new Set<string>()
  const distractors: WordItem[] = []
  for (const item of shuffle(studied)) {
    const siblings = byCategory(item.category).filter((w) => !studiedIds.has(w.id) && !usedLureIds.has(w.id))
    if (siblings.length > 0) {
      const lure = pick(siblings, 1)[0]
      usedLureIds.add(lure.id)
      distractors.push(lure)
    }
  }
  while (distractors.length < studied.length) {
    const leftover = WORDS.filter((w) => !studiedIds.has(w.id) && !usedLureIds.has(w.id))
    if (leftover.length === 0) break
    const extra = pick(leftover, 1)[0]
    usedLureIds.add(extra.id)
    distractors.push(extra)
  }
  return { studied, distractors }
}

interface Level {
  n: number
  name: string
  studySeconds: number
  minEarlySeconds: number
  build: () => Round
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', studySeconds: 20, minEarlySeconds: 8, build: buildL1 },
  { n: 2, name: 'Nivel 2', studySeconds: 25, minEarlySeconds: 8, build: buildL2 },
  { n: 3, name: 'Nivel 3', studySeconds: 18, minEarlySeconds: 8, build: buildL3 },
]

const PRAISE_GOOD = ['¡Excelente memoria!', '¡Muy bien!', '¡Así se hace!', '¡Qué buena atención!']
const PRAISE_OK = [
  '¡Buen intento! Con la práctica, cada vez vas a recordar más.',
  '¡Bien ahí! La memoria es como un músculo, se entrena.',
]

type Phase = 'study' | 'test' | 'results'

export function CuatroPalabras({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const round = useMemo(
    () => level.build(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const testBoard = useMemo(() => shuffle([...round.studied, ...round.distractors]), [round])
  const targetIds = useMemo(() => new Set(round.studied.map((w) => w.id)), [round])

  const [phase, setPhase] = useState<Phase>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across any same-level replay —
  // every submission counts, same model as CuantosHay.tsx), only zeroed
  // on a true day restart (see nextLevel's wrap branch).
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // Arms the auto-advance + early-continue timers for whichever level/round
  // is now current. `phase`/`selected`/`canContinueEarly` are deliberately
  // NOT reset here — they're reset SYNCHRONOUSLY inside nextLevel()/replay()
  // themselves (same handler that sets levelIdx/roundKey). An effect only
  // catches up on the render AFTER levelIdx changes, so the onComplete-
  // reporting effect below (which watches `phase`) would still see the
  // previous level's stale 'results' on the very render that just arrived
  // at the new level — firing onComplete instantly with garbage. Keeping
  // only the timer side-effect here (with its cleanup clearing stale
  // timers) avoids that.
  // Held outside the effect so the early-continue button (below) can cancel
  // it directly: without this, clicking "continuar" only sets phase to
  // 'test' but leaves this timeout armed — it fires later regardless of
  // whatever phase the player has since reached (possibly 'results', after
  // already submitting), snapping `phase` back to 'test' with `selected`
  // still populated and inviting a second `submit()` that double-counts
  // that level's mistakes/attempts.
  const autoTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    const floorTimer = window.setTimeout(() => setCanContinueEarly(true), level.minEarlySeconds * 1000)
    const autoTimer = window.setTimeout(() => setPhase('test'), level.studySeconds * 1000)
    autoTimerRef.current = autoTimer
    return () => {
      window.clearTimeout(floorTimer)
      window.clearTimeout(autoTimer)
    }
  }, [levelIdx, roundKey, level.minEarlySeconds, level.studySeconds])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const correctFound = useMemo(
    () => [...selected].filter((id) => targetIds.has(id)).length,
    [selected, targetIds],
  )

  function submit() {
    const ratio = targetIds.size ? correctFound / targetIds.size : 0
    const pool = ratio >= 0.6 ? PRAISE_GOOD : PRAISE_OK
    setPraise(pool[Math.floor(Math.random() * pool.length)])
    setPhase('results')
    const missed = targetIds.size - correctFound
    const falsePositives = selected.size - correctFound
    setAccMistakes((m) => m + missed + falsePositives)
    setAccAttempts((a) => a + testBoard.length)
  }

  // Resets happen HERE, synchronously with the level/round change — see the
  // comment on the timer effect above for why.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPhase('study')
    setSelected(new Set())
    setCanContinueEarly(false)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulator — a same-round replay must NOT, even on level 1.
    if (isWrap) {
      setAccMistakes(0)
      setAccAttempts(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setPhase('study')
    setSelected(new Set())
    setCanContinueEarly(false)
  }

  // Reports the SUM across levels 1→2→3, not just level 3: submit() already
  // folded this level's numbers into accMistakes/accAttempts above. Fires
  // once per roundKey so a genuine full-day restart (wrap to level 1, new
  // roundKey) can report again.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (phase === 'results' && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levelIdx, roundKey, accMistakes, accAttempts])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Memorizá estas palabras</h2>
            <p className="mt-2 text-base text-slate-500">Dentro de un rato te voy a preguntar cuáles había.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-blue"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {phase === 'test' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuáles palabras eran?</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá las que recordás. No hay apuro, ni respuestas que se marcan al toque.
            </p>
          </>
        )}

        {phase === 'results' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Encontraste {correctFound} de {targetIds.size}
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Board */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
        {(phase === 'study' ? round.studied : testBoard).map((w) => {
          const isSelected = selected.has(w.id)
          const isTarget = targetIds.has(w.id)

          let badge: 'hit' | 'missed' | 'false-positive' | null = null
          if (phase === 'results') {
            if (isTarget && isSelected) badge = 'hit'
            else if (isTarget && !isSelected) badge = 'missed'
            else if (!isTarget && isSelected) badge = 'false-positive'
          }

          return (
            <button
              key={w.id}
              type="button"
              disabled={phase !== 'test'}
              onClick={() => toggleSelect(w.id)}
              aria-label={w.label}
              aria-pressed={phase === 'test' ? isSelected : undefined}
              className={[
                'relative flex min-h-[64px] items-center justify-center rounded-2xl border-2 bg-white p-3 text-center transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                phase === 'test' ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                badge === 'hit' ? 'border-tiam-green ring-2 ring-tiam-green/30' : '',
                badge === 'missed' ? 'border-tiam-blue ring-2 ring-tiam-blue/30' : '',
                badge === 'false-positive' ? 'border-slate-200 opacity-50' : '',
                !badge && phase === 'results' ? 'border-slate-100' : '',
                !badge && phase !== 'results' && isSelected ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                !badge && phase !== 'results' && !isSelected ? 'border-slate-200' : '',
              ].join(' ')}
            >
              <span className="text-base font-bold text-slate-700 sm:text-lg">{w.label}</span>

              {badge === 'hit' && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
              {badge === 'missed' && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-blue text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              )}
              {badge === 'false-positive' && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-white shadow">
                  <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Study phase: early-continue button */}
      {phase === 'study' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={!canContinueEarly}
            onClick={() => {
              window.clearTimeout(autoTimerRef.current)
              setPhase('test')
            }}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ya estoy list@, continuar
          </button>
        </div>
      )}

      {/* Test phase: submit */}
      {phase === 'test' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={submit}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Listo, ya elegí
          </button>
        </div>
      )}

      {/* Results phase: legend + progression */}
      {phase === 'results' && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              Encontrada
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-tiam-blue text-white">
                <Eye className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              También estaba
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-white">
                <Minus className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              No estaba
            </span>
          </div>
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
              Jugar esta ronda otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
