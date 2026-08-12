import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles, Search } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "A buscar y encontrar" — a hidden-object / sustained visual-search game.
 *
 * ONE cluttered illustrated attic scene (Flux, flat-vector, matches the
 * project's thick-outline style — see escena-desvan.webp), reused across
 * all 3 levels per the brief ("one scene reused across levels with
 * different target sets is enough, don't over-produce"): only WHICH objects
 * are the current level's targets — and how small they render — changes.
 *
 * The 9 findable objects are separately-generated flat-vector icons
 * (transparent background) laid out at HAND-CURATED (x%, y%) positions over
 * the scene. This is deliberate, not a shortcut: a single AI-painted scene
 * can't guarantee where a "findable" object actually sits pixel-for-pixel
 * (Flux isn't regionally controllable), so baking the targets into the
 * painting would make exact, fair tap hit-boxes impossible. Overlaying
 * independently-positioned icons keeps every tap target exact and testable,
 * the same tradeoff QueCambio/QueHayEnLaMesa make by keeping their
 * findable items as discrete images rather than one flattened photo.
 *
 * A strip at the top shows this level's target icons as a "find these"
 * legend (per the brief) — each grays out with a check once found. Unlike
 * BuscarLosRojos/CazadorDeLetras, there are no decoy TAP TARGETS in the
 * scene (every rendered icon is a real target for this level) — the
 * "wrong tap" case here is tapping empty scene space, which is exactly what
 * happens in a real hidden-object game and gives a fair, level-agnostic
 * mistake signal even at level 3 (which uses all 9 objects, leaving no
 * spare icons to use as in-scene decoys).
 */

interface ObjectDef {
  label: string
  x: number // % of scene width, center of the icon
  y: number // % of scene height, center of the icon
}

// Fixed positions, scattered across the scene once and reused by every
// level — only the ACTIVE SUBSET (level.targetIds) and icon size change.
const OBJECT_POOL: Record<string, ObjectDef> = {
  llave: { label: 'llave', x: 22, y: 68 },
  anteojos: { label: 'anteojos', x: 50, y: 62 },
  paraguas: { label: 'paraguas', x: 84, y: 44 },
  campana: { label: 'campana', x: 15, y: 39 },
  vela: { label: 'vela', x: 58, y: 65 },
  'ovillo-lana': { label: 'ovillo de lana', x: 71, y: 80 },
  martillo: { label: 'martillo', x: 30, y: 83 },
  tetera: { label: 'tetera', x: 86, y: 69 },
  'reloj-bolsillo': { label: 'reloj de bolsillo', x: 40, y: 29 },
}

interface Level {
  n: number
  name: string
  targetIds: string[]
  iconPct: number // icon width, % of scene width — shrinks as targets grow
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', targetIds: ['llave', 'anteojos', 'vela'], iconPct: 15 },
  { n: 2, name: 'Nivel 2', targetIds: ['llave', 'anteojos', 'vela', 'paraguas', 'campana'], iconPct: 12 },
  {
    n: 3,
    name: 'Nivel 3',
    targetIds: ['llave', 'anteojos', 'vela', 'paraguas', 'campana', 'ovillo-lana', 'martillo', 'tetera', 'reloj-bolsillo'],
    iconPct: 9.5,
  },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/a-buscar-y-encontrar/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena búsqueda!']

export function ABuscarYEncontrar({ day: _day, onComplete }: GameProps) {
  // One-time gate for the day (never resets on level-advance/replay) — moves
  // the "how to play" sentence out of the persistent per-round area to
  // reclaim height at 375×812. Same pattern as Encaminada; see the ready
  // screen and the scene's comment below for why nivel 3 still needed more.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const targetIds = useMemo(() => new Set(level.targetIds), [level])
  const sceneSrc = imgFor('escena-desvan')

  const [found, setFound] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE[0])
  // Mistakes + correct finds, accumulated across levels 1→2→3 and only
  // zeroed on a genuine day restart (wrap from level 3 back to level 1) —
  // same convention as BuscarLosRojos/CazadorDeLetras.
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)
  const [missFlash, setMissFlash] = useState(false)

  const done = found.size === targetIds.size && targetIds.size > 0

  const reset = useCallback(() => {
    setFound(new Set())
  }, [])

  function tapObject(id: string) {
    if (found.has(id)) return
    setFound((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  // Tapping empty scene space (not one of the rendered icon buttons) is the
  // only "wrong tap" this game has — every icon actually on screen belongs
  // to this level's target list, so there's nothing else to mis-tap. Stops
  // propagation on each icon button below so a successful find never also
  // triggers this handler on the same click.
  function handleSceneMiss() {
    if (done) return
    setMistakes((m) => m + 1)
    setMissFlash(true)
    window.setTimeout(() => setMissFlash(false), 400)
  }

  useEffect(() => {
    if (targetIds.size > 0 && found.size === targetIds.size) {
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    }
  }, [found, targetIds])

  // isWrap resets happen synchronously HERE, in the same handler that
  // changes levelIdx/roundKey — not in a separate effect keyed on them (see
  // BuscarLosRojos for why: an effect lags one render behind and would let
  // `done` read the previous level's stale-true completion state right as
  // levelIdx reaches the new level, firing onComplete with garbage).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setFoundAcrossLevels((f) => f + found.size)
    reset()
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    if (isWrap) {
      setMistakes(0)
      setFoundAcrossLevels(0)
    }
  }
  function replay() {
    reset()
    setRoundKey((k) => k + 1)
  }

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
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá estos objetos escondidos</h2>
        {phase === 'playing' && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Encontraste {found.size} de {targetIds.size}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${targetIds.size ? (found.size / targetIds.size) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pantalla previa: única vez, al principio del día — ver el comentario
          de `phase` más arriba y el de Encaminada para el porqué no se
          repite en cada ronda ni se resetea al avanzar de nivel. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Search className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Tocá cada objeto de la lista de arriba donde lo veas en la escena.
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
          {/* "Find these" strip — purely a visual legend, never tappable
              (the real hit-targets are the buttons inside the scene below),
              so nivel 3's 9 icons can shrink with zero touch-target cost.
              Still overflowed 375×812 by 81px after the ready-screen fix
              alone (measured live) — nivel1/2's 3-5 icons fit fine at the
              accessibility-standard size, only nivel3 needs the smaller cap.
              h-14 got it down to 9px (measured live); h-12 clears it. */}
          <div className="mx-auto mt-3 flex max-w-md flex-wrap justify-center gap-2">
            {level.targetIds.map((id) => {
              const def = OBJECT_POOL[id]
              const img = imgFor(id)
              const isFound = found.has(id)
              return (
                <div
                  key={id}
                  className={[
                    level.targetIds.length >= 7
                      ? 'relative flex h-12 w-12 items-center justify-center rounded-xl border-2 bg-white p-1 transition sm:h-24 sm:w-24 sm:p-1.5'
                      : 'relative flex h-20 w-20 items-center justify-center rounded-xl border-2 bg-white p-1.5 transition sm:h-24 sm:w-24',
                    isFound ? 'border-tiam-green/40 opacity-50' : 'border-slate-200',
                  ].join(' ')}
                  aria-label={def.label}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                  {isFound && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Scene — reference image is constant-size across levels (only the
              tap-target icons inside it shrink via iconPct). Aspect trimmed
              on mobile (7/8 vs the original 4/5) to claw back height for
              nivel 3's 9-icon strip at 375×812; sm: restores the original,
              more generous portrait ratio once there's room to spare. */}
          <div
            className={[
              'relative mx-auto mt-3 aspect-[7/8] w-full max-w-md overflow-hidden rounded-3xl border-2 bg-slate-50 transition sm:aspect-[4/5]',
              missFlash ? 'border-slate-300' : 'border-slate-200',
            ].join(' ')}
            onClick={handleSceneMiss}
            role="presentation"
          >
            {sceneSrc && (
              <img
                src={sceneSrc}
                alt="Un desván lleno de estantes, cajas y objetos"
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                draggable={false}
              />
            )}

            {level.targetIds.map((id) => {
              const def = OBJECT_POOL[id]
              const img = imgFor(id)
              const isFound = found.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    tapObject(id)
                  }}
                  aria-label={def.label}
                  aria-pressed={isFound}
                  className={[
                    'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/60 focus:ring-offset-1',
                    'min-h-[44px] min-w-[44px]',
                    isFound ? 'drop-shadow-none' : 'hover:scale-110 active:scale-95',
                  ].join(' ')}
                  style={{
                    left: `${def.x}%`,
                    top: `${def.y}%`,
                    width: `max(44px, ${level.iconPct}%)`,
                    height: `max(44px, ${level.iconPct}%)`,
                  }}
                >
                  {img && (
                    <img
                      src={img}
                      alt=""
                      className={['h-full w-full object-contain drop-shadow-md transition', isFound ? 'opacity-40 saturate-50' : ''].join(' ')}
                      draggable={false}
                    />
                  )}
                  {isFound && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste los {targetIds.size} — ¡completaste el {level.name.toLowerCase()}!
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
              Jugar esta ronda otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
