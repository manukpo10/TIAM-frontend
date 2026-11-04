import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El esqueleto" — día 6, mes 6, memoria. A study → recall game on a drawing of a skeleton. First the skeleton is
 * shown with a label on each bone of the level (3 / 4 / 4 bones) for as long as the player wants, until "Ya lo miré"
 * (no clock: looking speed varies a lot in this audience). Then the labels are gone: the same drawing carries one empty
 * round pin on each of those bones, and the game asks for them one at a time ("Tocá el punto donde está… Cráneo"): the
 * player taps the pin where that bone is. In level 3 it is the FUNCTION that is studied and asked ("Tocá el punto
 * que corresponde a esto: Se mueve para masticar y para hablar."), a harder way to hold the same kind of fact. It comes from a worksheet
 * on the skeleton where the bones are named from a box of names and matched to their function; none of its text or its
 * drawing is here.
 *
 * ONE QUESTION AT A TIME, ON TOP OF THE DRAWING. The drawing takes most of a phone's screen, so a list of names under it
 * would fall below the fold, where someone who does not scroll never finds it: the question sits above the drawing.
 *
 * ORIGINAL CONTENT AND IMAGE. The skeleton is TIAM's own Flux illustration (src/assets/desafio/games/el-esqueleto,
 * soft flat style, nothing written on it), and each pin was checked by laying the circles over the picture. The names
 * are plain anatomy and the functions are written for this game: none contains the name of its bone (a throwaway
 * script, not committed, also checks that no bone repeats in the day, that every pin is far enough from the others of
 * its level to be tapped apart on a phone 320px wide and that the labels sit inside the picture; the labels were also
 * measured in the browser at 375 and 320px).
 *
 * EVERYTHING NEEDED IS ON THE STUDY SCREEN (a memory game never depends on what the player already knows): the recall
 * only asks for what was just shown. A wrong pin costs ONE mistake and is greyed out for that question (muted gray, never
 * red); the hint says where the bone is in the body, and from the third wrong pin on the right one pulses gently, so
 * nobody is left stuck. Nothing is timed but a short pause so the right pin is seen before the next question.
 *
 * The order of the questions of each level is chosen ONCE at mount (`epoch`), so "Repetir" replays exactly the same
 * bones in the same order. Per-level state lives in <LevelView>, keyed by run + level. Double taps: every tap within
 * SETTLE_MS of the tap that brought the screen here (judged by the click's own timeStamp) is ignored, so a double tap on
 * "Siguiente nivel" does not press "Ya lo miré" and a double tap on "Ya lo miré" does not choose a pin; a pin already
 * tried for the question is ignored.
 *
 * totalAttempts = mistakes + every bone of the day (TOTAL_BONES, derived).
 */

// ── data:start ──
type BoneId =
  | 'craneo'
  | 'costillas'
  | 'femur'
  | 'clavicula'
  | 'columna'
  | 'pelvis'
  | 'humero'
  | 'mandibula'
  | 'antebrazo'
  | 'mano'
  | 'pie'

interface BoneDef {
  id: BoneId
  name: string
  /** What it is for: studied and asked in level 3. It never contains the name. */
  fn: string
  /** Where it is in the body, for the hint after a miss. */
  tip: string
  /** The pin, on the bone, in the coordinates of the 832 x 1216 drawing. */
  pin: [number, number]
  /** The label of the study screen: which side of the drawing, the edge it hangs from and its height, same coordinates. */
  label: { side: 'l' | 'r'; edge: number; y: number }
}
const IMG_W = 832
const IMG_H = 1216

const BONES: Record<BoneId, BoneDef> = {
  craneo: { id: 'craneo', name: 'Cráneo', fn: 'Protege el cerebro.', tip: 'Está en la parte de arriba de la cabeza.', pin: [420, 105], label: { side: 'r', edge: 540, y: 105 } },
  costillas: { id: 'costillas', name: 'Costillas', fn: 'Protegen el corazón y los pulmones.', tip: 'Están en el pecho.', pin: [375, 410], label: { side: 'r', edge: 600, y: 395 } },
  femur: { id: 'femur', name: 'Fémur', fn: 'Es el hueso más largo del cuerpo.', tip: 'Está en el muslo, entre la cadera y la rodilla.', pin: [345, 740], label: { side: 'l', edge: 290, y: 800 } },
  clavicula: { id: 'clavicula', name: 'Clavícula', fn: 'Une el hombro con el pecho.', tip: 'Está en la base del cuello, hacia el hombro.', pin: [365, 277], label: { side: 'l', edge: 330, y: 190 } },
  columna: { id: 'columna', name: 'Columna vertebral', fn: 'Sostiene el cuerpo y protege la médula.', tip: 'Baja por el medio de la espalda.', pin: [418, 465], label: { side: 'r', edge: 600, y: 480 } },
  pelvis: { id: 'pelvis', name: 'Pelvis', fn: 'Une las piernas con el tronco.', tip: 'Está en la cadera.', pin: [335, 590], label: { side: 'l', edge: 290, y: 770 } },
  humero: { id: 'humero', name: 'Húmero', fn: 'Es el hueso del brazo, entre el hombro y el codo.', tip: 'Está en la parte de arriba del brazo.', pin: [268, 385], label: { side: 'l', edge: 215, y: 330 } },
  mandibula: { id: 'mandibula', name: 'Mandíbula', fn: 'Se mueve para masticar y para hablar.', tip: 'Está en la cara, abajo de la boca.', pin: [420, 210], label: { side: 'r', edge: 540, y: 215 } },
  antebrazo: { id: 'antebrazo', name: 'Radio y cúbito', fn: 'Forman el antebrazo y permiten girar la muñeca.', tip: 'Están entre el codo y la muñeca.', pin: [235, 548], label: { side: 'l', edge: 222, y: 495 } },
  mano: { id: 'mano', name: 'Mano', fn: 'Permiten agarrar objetos, escribir y tejer.', tip: 'Están al final del brazo.', pin: [222, 695], label: { side: 'l', edge: 150, y: 715 } },
  pie: { id: 'pie', name: 'Pie', fn: 'Sostienen el peso del cuerpo y permiten caminar.', tip: 'Están abajo de todo, donde apoyás en el piso.', pin: [335, 1118], label: { side: 'l', edge: 255, y: 1130 } },
}

interface LevelDef {
  name: string
  /** What the recall asks: the name of the bone, or what it is for. */
  asks: 'name' | 'function'
  bones: BoneId[]
}

const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', asks: 'name', bones: ['craneo', 'costillas', 'femur'] },
  { name: 'Nivel 2', asks: 'name', bones: ['clavicula', 'columna', 'pelvis', 'humero'] },
  { name: 'Nivel 3', asks: 'function', bones: ['mandibula', 'antebrazo', 'mano', 'pie'] },
]
const TOTAL_BONES = LEVELS.reduce((sum, lvl) => sum + lvl.bones.length, 0)
// ── data:end ──

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

const IMAGES = import.meta.glob('../../../assets/desafio/games/el-esqueleto/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const SKELETON = Object.entries(IMAGES).find(([path]) => path.endsWith('/esqueleto.webp'))?.[1]

/** The order the names (or functions) show in the recall, per level: decided once, at mount. */
function buildEpoch(): BoneId[][] {
  return LEVELS.map((lvl) => shuffle(lvl.bones))
}

const PRAISE = ['¡Qué buena memoria!', '¡Los recordaste todos!', '¡Así se hace!', '¡Excelente!']
const TIPS_AFTER = 3
/** The pause after the right pin, with it on screen, before the next question. */
const ADVANCE_MS = 1100
/** A tap this soon after the screen changed is the second tap of a double tap on the button that brought the player
 * here ("Siguiente nivel", "Ya lo miré", "Repetir"): it must not be judged against what is now under the finger. */
const SETTLE_MS = 400

const pct = (v: number, of: number) => `${(v / of) * 100}%`

interface LevelViewProps {
  levelIdx: number
  order: BoneId[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when the day just opened). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, order, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.bones.length
  const byFunction = level.asks === 'function'

  const [phase, setPhase] = useState<'study' | 'recall' | 'done'>('study')
  const [qIdx, setQIdx] = useState(0)
  const [matched, setMatched] = useState<BoneId[]>([])
  // Pins already tried wrong for the current question.
  const [tried, setTried] = useState<BoneId[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same pins, but readable at once: a double tap lands before React has repainted.
  const triedRef = useRef<Set<string>>(new Set())
  // When the screen last changed because of a tap (that tap's own timeStamp): every tap within SETTLE_MS is ignored.
  const settleFromRef = useRef(since)
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level, and the recall that follows the study, open at the top, not wherever the previous button left the scroll.
  useEffect(() => {
    if (phase !== 'done') topRef.current?.scrollIntoView({ block: 'start' })
  }, [phase])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (phase !== 'done' || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [phase])

  function startRecall(at: number) {
    if (at - settleFromRef.current < SETTLE_MS) return
    settleFromRef.current = at
    setPhase('recall')
  }

  const current = BONES[order[qIdx]]

  function tapPin(id: BoneId, at: number) {
    if (phase !== 'recall' || advancing || matched.includes(id) || at - settleFromRef.current < SETTLE_MS) return
    const key = `${qIdx}|${id}`
    if (triedRef.current.has(key)) return
    triedRef.current.add(key)
    if (id === current.id) {
      setMatched((m) => [...m, id])
      setAdvancing(true)
      setHint({ text: `¡Eso es! ${current.name}.`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setTried([])
          setHint(null)
          setAdvancing(false)
        } else {
          setPraise(pickOne(PRAISE))
          setPhase('done')
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    const n = tried.length + 1
    setTried((t) => [...t, id])
    setHint({
      text: n >= TIPS_AFTER ? 'Mirá el punto que late: ahí está.' : `${n === 1 ? 'Ahí no es.' : 'Ahí tampoco.'} ${current.tip}`,
      ok: false,
    })
    onMistake()
  }

  // From the third wrong pin on, the right one pulses gently.
  const revealed = phase === 'recall' && !advancing && tried.length >= TIPS_AFTER

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {phase === 'recall' && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Hueso {qIdx + 1} de {total}
          </span>
        )}

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Mirá bien el esqueleto</h2>
            <p className="mt-2 text-base text-slate-500">
              {byFunction
                ? 'Fijate dónde está cada hueso y para qué sirve. Después te preguntamos por el hueso de cada función, sin los nombres.'
                : 'Fijate dónde está cada hueso y cómo se llama. Después te preguntamos dónde está cada uno, sin las etiquetas.'}
            </p>
          </>
        )}
        {phase === 'done' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¡Completaste el {level.name.toLowerCase()}!</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Recall: the one question, always on top of the drawing */}
      {phase === 'recall' && (
        <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-tiam-blue">
            {byFunction ? 'Tocá el punto que corresponde a esto:' : 'Tocá el punto donde está…'}
          </p>
          <p className="mt-1 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{byFunction ? current.fn : current.name}</p>
        </div>
      )}

      {phase !== 'done' && (
        <div className="relative mx-auto mt-3 w-full max-w-[340px] overflow-hidden rounded-2xl border-2 border-slate-100 bg-[#cce5ea]" style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}>
          <img src={SKELETON} alt="Ilustración de un esqueleto humano visto de frente" className="absolute inset-0 h-full w-full object-cover" />

          {/* Study: a label on each bone, joined to it by a thin line */}
          {phase === 'study' && (
            <>
              <svg viewBox={`0 0 ${IMG_W} ${IMG_H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                {level.bones.map((id) => {
                  const b = BONES[id]
                  return (
                    <g key={id}>
                      <line x1={b.label.edge} y1={b.label.y} x2={b.pin[0]} y2={b.pin[1]} stroke="#fff" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      <line x1={b.label.edge} y1={b.label.y} x2={b.pin[0]} y2={b.pin[1]} stroke="#1B6FC4" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      <circle cx={b.pin[0]} cy={b.pin[1]} r="11" fill="#1B6FC4" stroke="#fff" strokeWidth="4" />
                    </g>
                  )
                })}
              </svg>
              {level.bones.map((id) => {
                const b = BONES[id]
                return (
                  <span
                    key={id}
                    className="absolute max-w-[78px] -translate-y-1/2 rounded-lg border-2 border-tiam-blue bg-white px-1 py-1 text-center text-[13px] font-bold leading-tight text-slate-900 shadow-sm"
                    style={{
                      top: pct(b.label.y, IMG_H),
                      ...(b.label.side === 'l' ? { right: pct(IMG_W - b.label.edge, IMG_W) } : { left: pct(b.label.edge, IMG_W) }),
                    }}
                  >
                    {b.name}
                  </span>
                )
              })}
            </>
          )}

          {/* Recall: an empty pin on each bone */}
          {phase === 'recall' &&
            level.bones.map((id) => {
              const b = BONES[id]
              const isMatched = matched.includes(id)
              const isTried = tried.includes(id)
              const isRevealed = revealed && id === current.id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isMatched || advancing || isTried}
                  aria-label={isMatched ? `Hueso encontrado: ${b.name}` : 'Punto sobre un hueso'}
                  onClick={(e) => tapPin(id, e.timeStamp)}
                  className={[
                    'absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] text-lg font-extrabold transition',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/60 focus-visible:ring-offset-2',
                    isMatched
                      ? 'border-tiam-green bg-tiam-green text-white'
                      : isTried
                        ? 'cursor-not-allowed border-slate-300 bg-slate-200/80 text-slate-400'
                        : 'border-tiam-blue bg-white/90 text-tiam-blue hover:bg-white',
                    isRevealed ? 'ring-4 ring-tiam-blue/40 motion-safe:animate-pulse' : '',
                  ].join(' ')}
                  style={{ left: pct(b.pin[0], IMG_W), top: pct(b.pin[1], IMG_H) }}
                >
                  {isMatched ? <Check className="h-5 w-5" strokeWidth={3.5} aria-hidden="true" /> : '?'}
                </button>
              )
            })}
        </div>
      )}

      {/* Study: for level 3 the functions are part of what is studied */}
      {phase === 'study' && byFunction && (
        <ul className="mx-auto mt-3 max-w-[340px] space-y-1.5 text-left text-base text-slate-700">
          {level.bones.map((id) => (
            <li key={id} className="rounded-xl bg-slate-50 px-3 py-2">
              <span className="font-bold text-slate-900">{BONES[id].name}:</span> {BONES[id].fn}
            </li>
          ))}
        </ul>
      )}
      {phase === 'study' && (
        <div className="sticky bottom-3 z-10 mt-4 text-center">
          <button
            type="button"
            onClick={(e) => startRecall(e.timeStamp)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
          >
            Ya lo miré
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'recall' && (
        <p
          role="status"
          className={`mx-auto mt-2 min-h-[3rem] max-w-md text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
        >
          {hint?.text}
        </p>
      )}

      {/* Level complete: the names come back as a recap, now that nothing is at stake */}
      {phase === 'done' && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-slate-600">Los huesos de este nivel:</p>
          <ul className="mt-2 space-y-1.5 text-left text-base text-slate-700">
            {level.bones.map((id) => (
              <li key={id} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{BONES[id].name}</span>
                  <span className="text-slate-500"> — {BONES[id].fn}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ElEsqueleto({ onComplete }: GameProps) {
  // The order of the names (or functions) of each recall — decided once, at mount, so "Repetir" replays exactly the
  // same content.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_BONES })
  }
  function handleNext(at: number) {
    setSince(at)
    setLevelIdx((i) => i + 1)
  }
  function handleRepeat(at: number) {
    setSince(at)
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      order={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
