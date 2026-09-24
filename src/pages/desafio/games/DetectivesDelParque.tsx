import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Detectives del parque" — día 7, month 4, lenguaje. Tap-the-object
 * adaptation of a paper worksheet where you write one word per letter of the
 * alphabet: a letter appears, and instead of writing a word that starts with
 * it, the player taps something that does inside an illustrated park scene.
 * Nobody types here (no <input> anywhere in this catalog), so 3-4 letters
 * per level is enough — each tap IS the answer.
 *
 * Replaces "El refrán escondido" (ElRefranEscondido.tsx, left on disk but out
 * of registry.ts) as month 4's día 7 — same área (lenguaje), new mechanic.
 *
 * ONE scene for the whole playthrough, and it is ONE illustration: a single
 * Flux picture of a park (escena.webp) with invisible tap zones over the
 * things drawn in it. The first version assembled the scene from separate
 * cut-outs laid on a background and it showed — the objects read as stickers
 * pasted on a picture. Each level only asks for LETTERS drawn from its own
 * pool (LEVELS[].pool); the three pools are disjoint and together cover the
 * scene's 14 letters, so an object is never a valid answer in more than one
 * level — everything a level doesn't ask for is a pure distractor for it.
 *
 * SCENE_OBJECTS therefore holds BOXES read off the picture (x/y/w/h in
 * percent), not drawings. A 14-object scene can't give every zone the 44px
 * minimum tap size — at 375px the whole scene is 343x214, and the picnic
 * corner alone holds five things — so the scene itself catches the taps that
 * miss: `tapScene` resolves a tap to the NEAREST object within a radius of
 * ~9% of the scene's width, which is what makes the ant or the nest
 * comfortably tappable without stealing the space of the thermos beside
 * them. A tap far from everything is a nudge, never a mistake. The per-object
 * buttons stay for direct hits, focus and screen readers, and stop the event
 * so a hit is never counted twice; SCENE_OBJECTS_RENDER_ORDER paints the
 * biggest zones first so a small one inside a big one (the nest in the tree,
 * the ant by the flower) lands later in the DOM and wins.
 *
 * `found` (the green-ring/Check markers on the scene) persists across
 * levels and resets only on the final "Repetir": it's the same literal park
 * image for the whole playthrough, so an object found in level 1 should not
 * look unfound again once level 2 starts. `foundInLevel` is the level-scoped
 * subset (discovery order) that backs the name-chip row and the
 * level-complete card's count — same split as QuienLoDijo.tsx's
 * correctInLevel vs. its across-levels mistakes counter.
 *
 * The wrong-tap wiggle and its hint line are ONE derived value
 * (`wrongObject`/`hint`), not two pieces of state kept in sync by hand: both
 * appear and disappear together off a single `wrongId` + timeout, the same
 * coupling SopaDeMesesYDias.tsx uses for its missFlash + hint paragraph. The
 * hint names the tapped object with its own gendered article ("un árbol",
 * "una flor") via `SceneObject.article` — one field beyond the brief's
 * shape, because "Eso es un flor" is not a sentence a lenguaje game should
 * ship. `termo`'s drawing shows a thermos next to a mate gourd, but the
 * object is named and lettered for the thermos only ("termo", T) — mate
 * isn't in any asked letter pool, and a two-name object would break the
 * one-answer-per-object contract the invariant check (see the throwaway
 * script used to verify this file) relies on.
 *
 * Level praise is computed synchronously inside the correct-tap handler, not
 * in a `useEffect` watching `done` — same fix PuestoDeComida.tsx already
 * applied, avoiding `react-hooks/set-state-in-effect` and the one-render lag
 * of reacting to `done` after the fact (QuienLoDijo.tsx still has the older,
 * effect-based version and fails that lint rule today).
 */

/**
 * Hand-authored scene data: where each thing sits INSIDE the picture, read
 * off a percentage grid laid over escena.webp. `x`/`y` are the box's top-left
 * corner and `w`/`h` its size, all as percentages of the scene, so the zones
 * follow the picture at any width. `article` is needed for a grammatically
 * correct wrong-tap hint ("un árbol", "una flor").
 */
interface SceneObject {
  id: string // stable key, also the name used in messages
  name: string // shown when found, e.g. 'mariposa'
  letter: string // uppercase initial, unique across the scene
  x: number // left edge, % of the scene width
  y: number // top edge, % of the scene height
  w: number // width, % of the scene width
  h: number // height, % of the scene height
  article: 'un' | 'una'
}

// Boxes read off the picture — tune here if a zone ever drifts from what the
// illustration shows.
const SCENE_OBJECTS: SceneObject[] = [
  { id: 'arbol', name: 'árbol', letter: 'A', x: 3, y: 4, w: 37, h: 66, article: 'un' },
  { id: 'nido', name: 'nido', letter: 'N', x: 12, y: 26, w: 8, h: 9, article: 'un' },
  { id: 'banco', name: 'banco', letter: 'B', x: 16, y: 52, w: 20, h: 22, article: 'un' },
  { id: 'perro', name: 'perro', letter: 'P', x: 30, y: 67, w: 11, h: 15, article: 'un' },
  { id: 'canasta', name: 'canasta', letter: 'C', x: 4, y: 75, w: 15, h: 17, article: 'una' },
  { id: 'libro', name: 'libro', letter: 'L', x: 18, y: 84, w: 14, h: 11, article: 'un' },
  { id: 'termo', name: 'termo', letter: 'T', x: 68, y: 65, w: 8, h: 21, article: 'un' },
  { id: 'jarra', name: 'jarra', letter: 'J', x: 77, y: 69, w: 11, h: 14, article: 'una' },
  { id: 'zapatilla', name: 'zapatilla', letter: 'Z', x: 75, y: 83, w: 13, h: 11, article: 'una' },
  { id: 'flor', name: 'flor', letter: 'F', x: 88, y: 68, w: 10, h: 23, article: 'una' },
  { id: 'hormiga', name: 'hormiga', letter: 'H', x: 91, y: 89, w: 7, h: 7, article: 'una' },
  { id: 'globo', name: 'globo', letter: 'G', x: 73, y: 11, w: 10, h: 20, article: 'un' },
  { id: 'mariposa', name: 'mariposa', letter: 'M', x: 60, y: 22, w: 8, h: 9, article: 'una' },
  { id: 'sol', name: 'sol', letter: 'S', x: 84, y: 5, w: 13, h: 16, article: 'un' },
]

/** How far a tap may land from an object's centre and still count as that
 * object, as a share of the scene's width (~31px on a 375px phone). Keeps the
 * small things tappable without a 44px box that would swallow its neighbours. */
const NEAR_TAP_RATIO = 0.09

// Render order only: biggest zone → smallest, so a small zone inside a big
// one (the nest in the tree, the ant by the flower) lands later in the DOM
// and wins the tap — see module doc.
const SCENE_OBJECTS_RENDER_ORDER = [...SCENE_OBJECTS].sort((a, b) => b.w * b.h - a.w * a.h)

const IMAGES = import.meta.glob('../../../assets/desafio/games/detectives-del-parque/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const SCENE_IMAGE = Object.entries(IMAGES).find(([path]) => path.endsWith('/escena.webp'))?.[1]

interface Level {
  n: number
  name: string
  letterCount: number
  /** Letters drawn without repetition from this pool, once at mount — see epoch below. */
  pool: string[]
}

// Three disjoint pools covering the scene's 14 letters — see module doc. The
// last level keeps the small, huddled-together things (the ant, the nest, the
// picnic corner), which is what makes it the hard one.
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', letterCount: 3, pool: ['P', 'S', 'A', 'B'] },
  { n: 2, name: 'Nivel 2', letterCount: 4, pool: ['M', 'G', 'L', 'F', 'C'] },
  { n: 3, name: 'Nivel 3', letterCount: 4, pool: ['H', 'N', 'T', 'Z', 'J'] },
]

// 3 + 4 + 4 — one tap per asked letter, across all three levels.
const TOTAL_TARGETS = LEVELS.reduce((sum, l) => sum + l.letterCount, 0)

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

function hintFor(obj: SceneObject, targetLetter: string): string {
  return `Eso es ${obj.article} ${obj.name} y empieza con ${obj.letter}. Buscá algo que empiece con ${targetLetter}.`
}

const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!']
const PRAISE_OK = ['¡Bien hecho! Con práctica sale cada vez más fácil.', '¡Buen trabajo! Seguí practicando.']

export function DetectivesDelParque({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Letters drawn per level, at mount — see module doc. Never re-rolled, so
  // "Repetir" always asks for the exact same letters in the exact same order.
  const [epoch] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.letterCount)))
  const level = LEVELS[levelIdx]
  const letters = epoch[levelIdx]

  const [targetIdx, setTargetIdx] = useState(0)
  // Persists across levels — see module doc: same literal park scene for the
  // whole playthrough. Only a genuine day restart (replay) clears it.
  const [found, setFound] = useState<Set<string>>(new Set())
  // Current level's finds only, in discovery order — backs the chip row and
  // the level-complete card's count. Reset every level.
  const [foundInLevel, setFoundInLevel] = useState<string[]>([])
  const [solved, setSolved] = useState(false)
  const [wrongId, setWrongId] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  // Per-level mistake count, reset on nextLevel/replay — decides which
  // praise band the level-complete card shows.
  const [levelMistakes, setLevelMistakes] = useState(0)
  // Accumulates across levels 1→2→3, zeroed only by replay()'s genuine day
  // restart — see the comment there.
  const [mistakes, setMistakes] = useState(0)

  // A tap that answered nothing: either it landed far from everything, or it
  // landed on something already found. Both are nudges, never mistakes — the
  // one thing a tap must never do is go unanswered.
  const [sceneNote, setSceneNote] = useState<'' | 'vacio' | 'repetido'>('')

  const done = targetIdx >= letters.length
  const currentLetter = !done ? letters[targetIdx] : undefined
  // Wiggle + hint are ONE derived value off `wrongId` — see module doc.
  const wrongObject = wrongId ? SCENE_OBJECTS.find((o) => o.id === wrongId) : undefined
  const hint = wrongObject && currentLetter
    ? hintFor(wrongObject, currentLetter)
    : sceneNote === 'vacio'
      ? 'Ahí no hay nada. Mirá bien el dibujo y tocá la cosa que buscás.'
      : sceneNote === 'repetido' && currentLetter
        ? `Eso ya lo encontraste. Buscá otra cosa que empiece con ${currentLetter}.`
        : null

  const wrongTimeoutRef = useRef<number | null>(null)
  function clearWrongTimer() {
    if (wrongTimeoutRef.current !== null) {
      window.clearTimeout(wrongTimeoutRef.current)
      wrongTimeoutRef.current = null
    }
  }

  function tapObject(obj: SceneObject) {
    if (!currentLetter || solved) return
    if (found.has(obj.id)) {
      noteScene('repetido')
      return
    }
    if (obj.letter === currentLetter) {
      clearWrongTimer()
      setWrongId(null)
      setSceneNote('')
      setSolved(true)
      setFound((prev) => new Set(prev).add(obj.id))
      setFoundInLevel((prev) => [...prev, obj.id])
      // Level ends on this tap: compute the praise band synchronously, right
      // here, instead of a `useEffect` watching `done` — see module doc.
      if (targetIdx === letters.length - 1) {
        setLevelPraise(pickOne(levelMistakes === 0 ? PRAISE_GOOD : PRAISE_OK))
      }
      window.setTimeout(() => {
        setTargetIdx((i) => i + 1)
        setSolved(false)
      }, 900)
    } else {
      setMistakes((m) => m + 1)
      setLevelMistakes((m) => m + 1)
      clearWrongTimer()
      setSceneNote('')
      setWrongId(obj.id)
      wrongTimeoutRef.current = window.setTimeout(() => {
        setWrongId(null)
        wrongTimeoutRef.current = null
      }, 500)
    }
  }

  // A nudge that answers a tap which resolved to nothing to look for.
  function noteScene(note: 'vacio' | 'repetido') {
    clearWrongTimer()
    setWrongId(null)
    setSceneNote(note)
    wrongTimeoutRef.current = window.setTimeout(() => {
      setSceneNote('')
      wrongTimeoutRef.current = null
    }, 1600)
  }

  // Taps that miss every zone land here: the closest thing STILL TO FIND wins,
  // as long as it is close enough (see NEAR_TAP_RATIO) — that is what keeps
  // the ant and the nest tappable. Things already found are skipped on
  // purpose: once the tree is marked, the blank sky around it should guide the
  // player to whatever is still missing instead of answering for the tree.
  function tapScene(event: React.MouseEvent<HTMLDivElement>) {
    if (!currentLetter || solved) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    let closest: SceneObject | null = null
    let closestDistance = Infinity
    for (const obj of SCENE_OBJECTS) {
      if (found.has(obj.id)) continue
      const cx = ((obj.x + obj.w / 2) / 100) * rect.width
      const cy = ((obj.y + obj.h / 2) / 100) * rect.height
      const distance = Math.hypot(cx - px, cy - py)
      if (distance < closestDistance) {
        closestDistance = distance
        closest = obj
      }
    }
    if (closest && closestDistance <= rect.width * NEAR_TAP_RATIO) {
      tapObject(closest)
      return
    }
    noteScene('vacio')
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render behind, so `done` (derived
  // straight from targetIdx) would read the previous level's stale-true value
  // on the very render that arrives at the new level and fire the completion
  // card (or onComplete) with garbage. Same discipline as QuienLoDijo.tsx /
  // PuestoDeComida.tsx.
  function nextLevel() {
    setLevelIdx((i) => i + 1)
    setTargetIdx(0)
    setFoundInLevel([])
    setSolved(false)
    clearWrongTimer()
    setWrongId(null)
    setSceneNote('')
    setLevelMistakes(0)
  }

  // Only reachable from the FINAL level's completion card — a genuine day
  // restart. `epoch` itself is never touched, so every level asks for the
  // exact same letters, in the exact same order, it got at mount.
  function replay() {
    setLevelIdx(0)
    setTargetIdx(0)
    setFound(new Set())
    setFoundInLevel([])
    setSolved(false)
    clearWrongTimer()
    setWrongId(null)
    setSceneNote('')
    setLevelMistakes(0)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (replay) gets a new roundKey so it can report again;
  // re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_TARGETS })
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué empieza con esta letra?</h2>
            <div className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-tiam-blue/10 text-3xl font-bold text-tiam-blue">
              {currentLetter}
            </div>
            <div className="mx-auto mt-3 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                {targetIdx} de {letters.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(targetIdx / letters.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* The scene — one illustration with invisible zones over what it draws */}
          <div
            className="relative mt-5 aspect-[16/10] w-full overflow-hidden rounded-2xl"
            onClick={tapScene}
          >
            <img src={SCENE_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            {SCENE_OBJECTS_RENDER_ORDER.map((obj) => {
              const isFound = found.has(obj.id)
              const isWrong = wrongId === obj.id
              return (
                <button
                  key={obj.id}
                  type="button"
                  disabled={solved}
                  onClick={(event) => {
                    // The scene below also listens, to catch near misses.
                    event.stopPropagation()
                    tapObject(obj)
                  }}
                  // Unfound zones stay anonymous — naming them would hand a
                  // screen-reader user the answer the game is asking for.
                  aria-label={isFound ? `${obj.name}, ya encontrado` : 'algo del parque'}
                  style={{
                    left: `${obj.x}%`,
                    top: `${obj.y}%`,
                    width: `${obj.w}%`,
                    height: `${obj.h}%`,
                  }}
                  className={[
                    'absolute rounded-xl border-2 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-green/40',
                    isFound
                      ? 'border-tiam-green bg-tiam-green/15 ring-2 ring-tiam-green/30'
                      : isWrong
                        ? 'border-slate-400 bg-slate-500/20 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                        : 'border-transparent bg-transparent',
                  ].join(' ')}
                >
                  {isFound && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Found-so-far chips for this level */}
          {foundInLevel.length > 0 && (
            <div className="mx-auto mt-3 flex max-w-sm flex-wrap justify-center gap-2">
              {foundInLevel.map((id) => {
                const obj = SCENE_OBJECTS.find((o) => o.id === id)
                if (!obj) return null
                return (
                  <span
                    key={id}
                    className="rounded-full border-2 border-tiam-green bg-tiam-green/10 px-3 py-1 text-base font-bold uppercase tracking-wide text-tiam-green"
                  >
                    {obj.name}
                  </span>
                )
              })}
            </div>
          )}

          {hint && <p className="mt-3 text-center text-base font-medium text-slate-500">{hint}</p>}
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
            Encontraste las {letters.length} cosas del nivel {level.n}.
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
