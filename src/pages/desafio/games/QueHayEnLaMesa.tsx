import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, Minus, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué hay en la mesa?" — a recognition-memory mini-game.
 *
 * Study phase (fixed, generous exposure) -> hidden test phase (tap the ones
 * you remember, no live right/wrong feedback) -> results (revealed all at once).
 * Recognition, not free recall: recall shows much steeper age-related decline
 * (meta-analysis: recall d=0.89 vs recognition d=0.54 — recognition supplies
 * the retrieval cue, free recall doesn't). No timer on the response side,
 * ever — only the study phase has a fixed duration, and even that has an
 * early "listo" escape hatch so no one feels rushed.
 */

interface MesaObject {
  id: string
  label: string
  category: string
}

const MESA_OBJECTS: MesaObject[] = [
  // ── bebida (5) ──
  { id: 'mate', label: 'mate', category: 'bebida' },
  { id: 'bombilla', label: 'bombilla', category: 'bebida' },
  { id: 'termo', label: 'termo', category: 'bebida' },
  { id: 'taza', label: 'taza', category: 'bebida' },
  { id: 'vaso', label: 'vaso', category: 'bebida' },
  // ── objetos personales (5) ──
  { id: 'anteojos', label: 'anteojos', category: 'personal' },
  { id: 'llaves', label: 'llaves', category: 'personal' },
  { id: 'billetera', label: 'billetera', category: 'personal' },
  { id: 'reloj-pulsera', label: 'reloj de pulsera', category: 'personal' },
  { id: 'celular', label: 'celular', category: 'personal' },
  // ── escritorio / lectura (5) ──
  { id: 'lapicera', label: 'lapicera', category: 'escritorio' },
  { id: 'lapiz', label: 'lápiz', category: 'escritorio' },
  { id: 'cuaderno', label: 'cuaderno', category: 'escritorio' },
  { id: 'libro', label: 'libro', category: 'escritorio' },
  { id: 'diario', label: 'diario', category: 'escritorio' },
  // ── costura / tejido (5) ──
  { id: 'tijera', label: 'tijera', category: 'costura' },
  { id: 'ovillo-lana', label: 'ovillo de lana', category: 'costura' },
  { id: 'agujas-tejer', label: 'agujas de tejer', category: 'costura' },
  { id: 'boton', label: 'botón', category: 'costura' },
  { id: 'dedal', label: 'dedal', category: 'costura' },
  // ── mesa servida (5) ──
  { id: 'pan', label: 'pan', category: 'servida' },
  { id: 'factura', label: 'factura', category: 'servida' },
  { id: 'galleta', label: 'galleta', category: 'servida' },
  { id: 'azucarera', label: 'azucarera', category: 'servida' },
  { id: 'servilletero', label: 'servilletero', category: 'servida' },
  // ── living chico / decoración (5) ──
  { id: 'vela', label: 'vela', category: 'decoracion' },
  { id: 'florero', label: 'florero', category: 'decoracion' },
  { id: 'portarretrato', label: 'portarretrato', category: 'decoracion' },
  { id: 'maceta', label: 'maceta', category: 'decoracion' },
  { id: 'control-remoto', label: 'control remoto', category: 'decoracion' },
]

// Level-1 distractors — obviously NOT a tabletop item (easy, confidence-building rejects).
const FAR_DOMAIN: MesaObject[] = [
  { id: 'rana', label: 'rana', category: 'lejano' },
  { id: 'camion-bomberos', label: 'camión de bomberos', category: 'lejano' },
  { id: 'flamenco', label: 'flamenco', category: 'lejano' },
  { id: 'pelota', label: 'pelota', category: 'lejano' },
  { id: 'sol', label: 'sol', category: 'lejano' },
  { id: 'paraguas', label: 'paraguas', category: 'lejano' },
]

const CATEGORIES = [...new Set(MESA_OBJECTS.map((o) => o.category))]
const byCategory = (cat: string) => MESA_OBJECTS.filter((o) => o.category === cat)

// Illustrations (Flux) — matched by id. No color-disc fallback here (unlike
// BuscarLosRojos): identity IS the task, so an ambiguous shape would test
// icon-legibility instead of memory. The visible label is the fallback.
const IMAGES = import.meta.glob('../../../assets/desafio/games/que-hay-en-la-mesa/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

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
  studied: MesaObject[]
  distractors: MesaObject[]
}

function buildL1(): Round {
  // One item per category — mirrors the category-cued structuring found in
  // the reference material, and keeps L1 at a gentle, confidence-building size.
  return { studied: CATEGORIES.map((cat) => pick(byCategory(cat), 1)[0]), distractors: pick(FAR_DOMAIN, 6) }
}

function buildL2(): Round {
  const studied = pick(MESA_OBJECTS, 9) // NIH Toolbox's own set size for the 65-85 age band
  const studiedIds = new Set(studied.map((o) => o.id))
  const distractors = pick(MESA_OBJECTS.filter((o) => !studiedIds.has(o.id)), 9)
  return { studied, distractors }
}

function buildL3(): Round {
  const studied = pick(MESA_OBJECTS, 15)
  const studiedIds = new Set(studied.map((o) => o.id))
  const usedLureIds = new Set<string>()
  const distractors: MesaObject[] = []
  // Prefer a same-category "sibling" for every studied item — the hardest,
  // most realistic lure (taza studied -> vaso as the trap).
  for (const item of shuffle(studied)) {
    const siblings = byCategory(item.category).filter((o) => !studiedIds.has(o.id) && !usedLureIds.has(o.id))
    if (siblings.length > 0) {
      const lure = pick(siblings, 1)[0]
      usedLureIds.add(lure.id)
      distractors.push(lure)
    }
  }
  // Safety net: a category fully exhausted by the studied set has no sibling
  // left over — top up from any other unused item so the 1:1 ratio always holds.
  while (distractors.length < studied.length) {
    const leftover = MESA_OBJECTS.filter((o) => !studiedIds.has(o.id) && !usedLureIds.has(o.id))
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

export function QueHayEnLaMesa({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const round = useMemo(
    () => level.build(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const testBoard = useMemo(() => shuffle([...round.studied, ...round.distractors]), [round])
  const targetIds = useMemo(() => new Set(round.studied.map((o) => o.id)), [round])

  const [phase, setPhase] = useState<Phase>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across any same-level replay —
  // every submission counts, same model as QueSeEsconde.tsx), only zeroed
  // on a true day restart (see nextLevel's wrap branch).
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // Arms the auto-advance + early-continue timers for whichever level/round
  // is now current. The progress bar itself is a CSS keyframe animation keyed
  // on [levelIdx, roundKey] (see JSX below), not JS-driven state — restarting
  // a CSS *transition* via a boolean + rAF flip is a known cross-browser trap
  // (relies on the browser committing an intermediate paint before the next
  // state flip, which mobile Safari/Chrome don't reliably guarantee). A fresh
  // DOM node with a keyframe animation always plays from the start.
  //
  // `phase`/`selected`/`canContinueEarly` are deliberately NOT reset here —
  // they're reset SYNCHRONOUSLY inside nextLevel()/replay() themselves (same
  // handler that sets levelIdx/roundKey). An effect only catches up on the
  // render AFTER levelIdx changes, so the onComplete-reporting effect below
  // (which watches `phase`) would still see the previous level's stale
  // 'results' on the very render that just arrived at the new level —
  // firing onComplete instantly with garbage. Keeping only the timer
  // side-effect here (with its cleanup clearing stale timers) avoids that.
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Observá estos objetos</h2>
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuáles estaban en la mesa?</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá los que recordás. No hay apuro, ni respuestas que se marcan al toque.
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
        {(phase === 'study' ? round.studied : testBoard).map((o) => {
          const img = imgFor(o.id)
          const isSelected = selected.has(o.id)
          const isTarget = targetIds.has(o.id)

          // Results-phase visual language: green=hit, blue=missed target
          // (never framed as "wrong" — just "this was also there"), grey=false
          // positive (muted, not red/orange — this audience already fears
          // forgetting, a stray tap shouldn't look like an alarm).
          let badge: 'hit' | 'missed' | 'false-positive' | null = null
          if (phase === 'results') {
            if (isTarget && isSelected) badge = 'hit'
            else if (isTarget && !isSelected) badge = 'missed'
            else if (!isTarget && isSelected) badge = 'false-positive'
          }

          return (
            <button
              key={o.id}
              type="button"
              disabled={phase !== 'test'}
              onClick={() => toggleSelect(o.id)}
              aria-label={o.label}
              aria-pressed={phase === 'test' ? isSelected : undefined}
              className={[
                'relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-white p-2 transition',
                'min-h-[76px] focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                phase === 'test' ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : '',
                badge === 'hit' ? 'border-tiam-green ring-2 ring-tiam-green/30' : '',
                badge === 'missed' ? 'border-tiam-blue ring-2 ring-tiam-blue/30' : '',
                badge === 'false-positive' ? 'border-slate-200 opacity-50' : '',
                !badge && phase === 'results' ? 'border-slate-100' : '',
                !badge && phase !== 'results' && isSelected ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                !badge && phase !== 'results' && !isSelected ? 'border-slate-200' : '',
              ].join(' ')}
            >
              <div className="flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
                {img ? (
                  <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />
                ) : (
                  <span className="text-xs font-semibold text-slate-400">{o.label}</span>
                )}
              </div>
              <span className="text-center text-[11px] font-medium leading-tight text-slate-600 sm:text-xs">
                {o.label}
              </span>

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
              Encontrado
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
