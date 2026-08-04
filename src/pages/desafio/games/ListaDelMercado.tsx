import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La lista del mercado" — an illustrated recognition-memory mini-game.
 *
 * Same engine as QueHayEnLaMesa.tsx (study → hidden test → warm reveal, no
 * live feedback, never red/orange), a third independent sibling — grocery
 * items instead of tabletop objects. Deliberately not sharing a hook with
 * QueHayEnLaMesa/CuatroPalabras: both are already live, and retrofitting
 * shared code onto shipped, verified logic is unnecessary regression risk.
 */

interface MercadoItem {
  id: string
  label: string
  category: string
}

const MERCADO_ITEMS: MercadoItem[] = [
  // ── lácteos (5) ──
  { id: 'leche', label: 'leche', category: 'lacteos' },
  { id: 'queso', label: 'queso', category: 'lacteos' },
  { id: 'manteca', label: 'manteca', category: 'lacteos' },
  { id: 'yogur', label: 'yogur', category: 'lacteos' },
  { id: 'huevos', label: 'huevos', category: 'lacteos' },
  // ── panificados (5) ──
  { id: 'pan', label: 'pan', category: 'panificados' },
  { id: 'medialunas', label: 'medialunas', category: 'panificados' },
  { id: 'galletitas', label: 'galletitas', category: 'panificados' },
  { id: 'tostadas', label: 'tostadas', category: 'panificados' },
  { id: 'grisines', label: 'grisines', category: 'panificados' },
  // ── frutas y verduras (5) ──
  { id: 'manzana', label: 'manzana', category: 'frutas' },
  { id: 'banana', label: 'banana', category: 'frutas' },
  { id: 'zanahoria', label: 'zanahoria', category: 'frutas' },
  { id: 'uvas', label: 'uvas', category: 'frutas' },
  { id: 'pera', label: 'pera', category: 'frutas' },
  // ── carnes (5) ──
  { id: 'pollo', label: 'pollo', category: 'carnes' },
  { id: 'milanesa', label: 'milanesa', category: 'carnes' },
  { id: 'jamon', label: 'jamón', category: 'carnes' },
  { id: 'chorizo', label: 'chorizo', category: 'carnes' },
  { id: 'pescado', label: 'pescado', category: 'carnes' },
  // ── limpieza (5) ──
  { id: 'detergente', label: 'detergente', category: 'limpieza' },
  { id: 'lavandina', label: 'lavandina', category: 'limpieza' },
  { id: 'papel-higienico', label: 'papel higiénico', category: 'limpieza' },
  { id: 'esponja', label: 'esponja', category: 'limpieza' },
  { id: 'jabon', label: 'jabón', category: 'limpieza' },
  // ── almacén (5) ──
  { id: 'cafe', label: 'café', category: 'almacen' },
  { id: 'azucar', label: 'azúcar', category: 'almacen' },
  { id: 'yerba', label: 'yerba', category: 'almacen' },
  { id: 'fideos', label: 'fideos', category: 'almacen' },
  { id: 'aceite', label: 'aceite', category: 'almacen' },
]

// Level-1 distractors — obviously NOT groceries (easy, confidence-building rejects).
const FAR_DOMAIN: MercadoItem[] = [
  { id: 'anteojos', label: 'anteojos', category: 'lejano' },
  { id: 'llaves', label: 'llaves', category: 'lejano' },
  { id: 'paraguas', label: 'paraguas', category: 'lejano' },
  { id: 'reloj-pulsera', label: 'reloj de pulsera', category: 'lejano' },
  { id: 'pelota', label: 'pelota', category: 'lejano' },
  { id: 'flamenco', label: 'flamenco', category: 'lejano' },
]

const CATEGORIES = [...new Set(MERCADO_ITEMS.map((o) => o.category))]
const byCategory = (cat: string) => MERCADO_ITEMS.filter((o) => o.category === cat)

const IMAGES = import.meta.glob('../../../assets/desafio/games/lista-mercado/*.webp', {
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
  studied: MercadoItem[]
  distractors: MercadoItem[]
}

function buildL1(): Round {
  const cats = pick(CATEGORIES, 4)
  return { studied: cats.map((cat) => pick(byCategory(cat), 1)[0]), distractors: pick(FAR_DOMAIN, 4) }
}

function buildL2(): Round {
  const studied = pick(MERCADO_ITEMS, 6)
  const studiedIds = new Set(studied.map((o) => o.id))
  const distractors = pick(MERCADO_ITEMS.filter((o) => !studiedIds.has(o.id)), 6)
  return { studied, distractors }
}

// L3's distractors: same-category "lure" items (e.g. studied "leche" -> decoy
// "yogur", both lácteos) — the hardest distractor type, since a lure can't be
// rejected just by noticing it's off-domain.
function buildWithLures(count: number): Round {
  const studied = pick(MERCADO_ITEMS, count)
  const studiedIds = new Set(studied.map((o) => o.id))
  const usedLureIds = new Set<string>()
  const distractors: MercadoItem[] = []
  for (const item of shuffle(studied)) {
    const siblings = byCategory(item.category).filter((o) => !studiedIds.has(o.id) && !usedLureIds.has(o.id))
    if (siblings.length > 0) {
      const lure = pick(siblings, 1)[0]
      usedLureIds.add(lure.id)
      distractors.push(lure)
    }
  }
  while (distractors.length < studied.length) {
    const leftover = MERCADO_ITEMS.filter((o) => !studiedIds.has(o.id) && !usedLureIds.has(o.id))
    if (leftover.length === 0) break
    const extra = pick(leftover, 1)[0]
    usedLureIds.add(extra.id)
    distractors.push(extra)
  }
  return { studied, distractors }
}
// L3 stays at 6 studied (matching L2's board size, not L1's original 8) so
// the test board tops out at 12 images and still fits inside the modal
// without scrolling — some players in this audience don't realize there's
// more below the fold. The difficulty step up from L2 is the lure quality
// (same-category near-misses), not a bigger board.
const buildL3 = () => buildWithLures(6)

interface Level {
  n: number
  name: string
  studySeconds: number
  minEarlySeconds: number
  build: () => Round
}

// Trimmed to 3 levels (a 4th was one level too many for this audience —
// separately, its studied+distractors count also overflowed the modal).
// Studied ramp is 4/6/6, test board 8/12/12 — L3 ties L2's board size on
// purpose (see buildL3 above) instead of growing further.
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', studySeconds: 20, minEarlySeconds: 8, build: buildL1 },
  { n: 2, name: 'Nivel 2', studySeconds: 24, minEarlySeconds: 8, build: buildL2 },
  { n: 3, name: 'Nivel 3', studySeconds: 28, minEarlySeconds: 10, build: buildL3 },
]

const PRAISE_GOOD = ['¡Excelente memoria!', '¡Muy bien!', '¡Así se hace!', '¡Qué buena atención!']
const PRAISE_OK = [
  '¡Buen intento! Con la práctica, cada vez vas a recordar más.',
  '¡Bien ahí! La memoria es como un músculo, se entrena.',
]

type Phase = 'study' | 'test' | 'results'

export function ListaDelMercado({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // The generated Round (studied items + distractors — there's no
  // pre-authored "sets" to index into, the Round itself IS the content) for
  // the WHOLE epoch, one per level — built once at mount, and again only
  // inside restartDifferent(). Never re-rolled just by revisiting a level,
  // so "Repetir" hands back the exact same list.
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => lvl.build()))
  const round = epochRounds[levelIdx]
  const testBoard = useMemo(() => shuffle([...round.studied, ...round.distractors]), [round])
  const targetIds = useMemo(() => new Set(round.studied.map((o) => o.id)), [round])

  const [phase, setPhase] = useState<Phase>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across any same-level replay —
  // every submission counts, same model as CuantosHay.tsx), only zeroed
  // by restartEpoch (a true day restart).
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // Arms the auto-advance + early-continue timers for whichever level/round
  // is now current. `phase`/`selected`/`canContinueEarly` are deliberately
  // NOT reset here — they're reset SYNCHRONOUSLY inside advanceLevel()/
  // restartEpoch() themselves (same handler that sets levelIdx/roundKey).
  // An effect only catches up on the render AFTER levelIdx changes, so the onComplete-
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

  // "Siguiente nivel" — advance within the SAME attempt. epochRounds is left
  // alone: every level's list was already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setPhase('study')
    setSelected(new Set())
    setCanContinueEarly(false)
  }

  // Shared by both restart buttons on the final level's complete card (only
  // ever shown once the last level is done, so always a genuine day restart
  // — zero the accumulators either way; a same-round replay must NOT, which
  // is why this never runs mid-epoch). roundKey always bumps here: it's the
  // "which attempt is this" generation counter the onComplete effect uses to
  // fire again on a replay, independent of whether the list changed.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setPhase('study')
    setSelected(new Set())
    setCanContinueEarly(false)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  // "Repetir" — same list as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random list per level, same as before this
  // feature existed (the only option there used to be).
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => lvl.build()))
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Memorizá la lista</h2>
            <p className="mt-2 text-base text-slate-500">Dentro de un rato te voy a preguntar qué había.</p>
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué había en la lista?</h2>
            <p className="mt-2 text-base text-slate-500">
              Tocá lo que recordás. No hay apuro, ni respuestas que se marcan al toque.
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
      {phase !== 'results' && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
          {(phase === 'study' ? round.studied : testBoard).map((o) => {
            const img = imgFor(o.id)
            const isSelected = selected.has(o.id)

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
                  isSelected ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                  !isSelected ? 'border-slate-200' : '',
                ].join(' ')}
              >
                <div className="flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
                  {img ? (
                    <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">{o.label}</span>
                  )}
                </div>
                <span className="text-center text-xs font-medium leading-tight text-slate-600 sm:text-sm">
                  {o.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

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

      {/* Results phase: progression. No per-item legend here — the board (with
          its hit/missed/false-positive badges) no longer renders during
          results (see the Board block above), so a legend explaining badges
          nobody sees would just be confusing. The header above already gives
          the real feedback ("Encontraste X de Y"). */}
      {phase === 'results' && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
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
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
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
