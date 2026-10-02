import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Partes del cuerpo" — día 18, mes 5, agnosias (reconocimiento). A drawing of a
 * woman (frente.webp / espalda.webp, same pose) and one question at a time:
 * "Tocá la rodilla". Tap the body part on the picture. Recognising where the
 * parts of the body are, on someone else's body, is the skill; nothing is timed
 * and no tap is ever red.
 *
 * ZONES. Everything is defined in the picture's own pixels (1024×1536). The
 * box that shows it has the same 2:3 shape and its frame is a ring, not a border,
 * so the box is the whole 311px of the game box on a 375px phone and a point of
 * the box maps straight onto a point of the picture (a percentage of the box is
 * the same percentage of the picture). Each part has two sets of shapes:
 *   - `target`: the GENEROUS zones, used when that part is the one asked. On a
 *     short phone the picture is capped to what leaves the knees and feet on
 *     screen (pictureMaxWidth: 263px wide in levels 1-2 and 244px in level 3 on a
 *     375x667 phone, 245px and 226px on a 320x640 one, never under 224px), so every
 *     zone is sized for THAT width: each holds a disc of ZONE (204) image px or
 *     more, which is 44 CSS px even on the 224px floor, 44.4 on 320x640 (back
 *     view), 48 on 375x667 and 61 on 375x812 (311px). A zone is not always
 *     centred on its part: where parts are close (ear, neck, shoulder and elbow;
 *     the calf and the heel, which share the last 400px of the picture) the zones
 *     lean away from each other so all of them can be wide without touching. Both
 *     hands / knees / ears / elbows / shoulders / feet are zones of the same part:
 *     either one is right.
 *   - `body`: the TIGHT shapes of where the part really is, used to NAME a wrong
 *     tap ("Eso es el hombro"). They are checked in priority order (small, specific
 *     parts first), never the part being asked, and a tap that lands on no part
 *     at all says so.
 * The parts asked in the SAME level never overlap each other (checked by a
 * throwaway Node script, not committed, which also measures the biggest disc
 * inside every zone and draws the zones over the images to look at the
 * alignment). The generosity has one honest cost: a body part smaller than 44px
 * on the phone (the ear, the heel) gets a zone that also covers some of what is
 * around it (the ear zone reaches up into the hair, the heel one up to the ankle).
 *
 * The level is a view: levels 1 and 2 show her from the FRONT, level 3 from the
 * BACK (espalda, nuca, talón, pantorrilla, codo). Ramp: big parts (cabeza,
 * mano, pie) → finer ones (oreja, cuello, hombro, codo, rodilla) → the back
 * view. The questions of a level are shuffled ONCE at mount (`epoch`), so
 * "Repetir" asks exactly the same questions in the same order. Per-level state
 * lives in <LevelView>, keyed by run + level.
 *
 * Feedback: a wrong tap puts a gray marker where the finger landed, outlines the
 * part that was touched in gray and says its name; the hint then names what to
 * look for. A correct tap rings the part in green (both hands, both knees) and
 * moves on after a short pause (the only timer in the game). The second tap of
 * a double tap never counts, whatever it lands on: taps are ignored for
 * SETTLE_MS (judged by the click's own timeStamp) after the tap that brought the
 * level on screen ("Siguiente nivel", "Repetir": the whole picture is a target),
 * while the right spot shows its ring, and when a tap lands almost on top of the
 * last wrong one (that is ONE mistake). A solved level scrolls its result card
 * into view on a short phone.
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived).
 */

// ── data:start ──
type Pt = [number, number]
type Shape =
  | { k: 'e'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'r'; x: number; y: number; w: number; h: number }
  | { k: 'p'; pts: Pt[] }

const IMG_W = 1024
const IMG_H = 1536

const ell = (cx: number, cy: number, rx: number, ry: number): Shape => ({ k: 'e', cx, cy, rx, ry })
const rect = (x: number, y: number, w: number, h: number): Shape => ({ k: 'r', x, y, w, h })
const poly = (...pts: Pt[]): Shape => ({ k: 'p', pts })

/** The same shape on the other side of the body (the figure is symmetric about x = 512). */
function mirror(s: Shape): Shape {
  if (s.k === 'e') return { ...s, cx: IMG_W - s.cx }
  if (s.k === 'r') return { ...s, x: IMG_W - s.x - s.w }
  return { k: 'p', pts: s.pts.map(([x, y]): Pt => [IMG_W - x, y]).reverse() }
}
/** Left-side shapes plus their mirror: the two hands, the two knees… */
const pair = (...left: Shape[]): Shape[] => [...left, ...left.map(mirror)]

function inShape(s: Shape, x: number, y: number): boolean {
  if (s.k === 'e') return ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1
  if (s.k === 'r') return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h
  // even-odd ray casting
  let inside = false
  for (let i = 0, j = s.pts.length - 1; i < s.pts.length; j = i++) {
    const [xi, yi] = s.pts[i]
    const [xj, yj] = s.pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The middle of a shape. */
function centre(s: Shape): Pt {
  if (s.k === 'e') return [s.cx, s.cy]
  if (s.k === 'r') return [s.x + s.w / 2, s.y + s.h / 2]
  return [s.pts.reduce((sum, p) => sum + p[0], 0) / s.pts.length, s.pts.reduce((sum, p) => sum + p[1], 0) / s.pts.length]
}

interface PartDef {
  id: string
  label: string
  article: 'el' | 'la'
  /** Generous zones: what counts when this part is the one asked. */
  target?: Shape[]
  /** Where the part really is: used to name a wrong tap. */
  body: Shape[]
}

// Left-arm outlines read off the silhouette of the picture (the right arm is the mirror).
const UPPER_ARM = poly([340, 415], [392, 430], [392, 520], [374, 550], [365, 575], [355, 605], [272, 605], [290, 575], [298, 550], [305, 525], [312, 500], [316, 450])
const FOREARM = poly([273, 610], [352, 610], [345, 625], [334, 650], [318, 675], [298, 700], [275, 725], [251, 750], [228, 768], [175, 768], [182, 750], [201, 725], [217, 700], [229, 675], [241, 650], [255, 625])

// Shared by both views: the pose is the same, only the head, neck, torso and feet change.
// Every `target` below is a disc (or a box) of ZONE image px across or more: 44 CSS px on the narrowest picture
// a phone ever shows (the 14rem = 224px floor of pictureMaxWidth). Where two parts of a level are close, the zones
// lean away from the part they belong to so that they never touch.
const ZONE = 204
const ELBOW: PartDef = { id: 'codo', label: 'codo', article: 'el', target: pair(ell(296, 642, ZONE / 2, ZONE / 2)), body: pair(ell(307, 612, 38, 38)) }
// From behind the back is next to the elbow: the zone leans outward so it stays clear of it.
const BACK_ELBOW: PartDef = { ...ELBOW, target: pair(ell(282, 612, ZONE / 2, ZONE / 2)) }
const HAND: PartDef = {
  id: 'mano',
  label: 'mano',
  article: 'la',
  // A disc around the whole hand (wrist included); the tight outline below names a wrong tap.
  target: pair(ell(155, 836, ZONE / 2 + 2, ZONE / 2 + 2)),
  body: pair(poly([88, 880], [97, 777], [215, 774], [190, 900], [150, 914], [118, 912], [98, 898])),
}
const KNEE: PartDef = { id: 'rodilla', label: 'rodilla', article: 'la', target: pair(ell(438, 1125, ZONE / 2, ZONE / 2)), body: pair(ell(438, 1125, 52, 55)) }
const SHOULDER: PartDef = { id: 'hombro', label: 'hombro', article: 'el', target: pair(ell(312, 428, ZONE / 2, ZONE / 2)), body: pair(ell(380, 385, 62, 50)) }
const ARM: PartDef = { id: 'brazo', label: 'brazo', article: 'el', body: pair(UPPER_ARM) }
const FOREARM_PART: PartDef = { id: 'antebrazo', label: 'antebrazo', article: 'el', body: pair(FOREARM) }
const HIP: PartDef = { id: 'cadera', label: 'cadera', article: 'la', body: [rect(352, 790, 317, 120)] }
const THIGH: PartDef = { id: 'muslo', label: 'muslo', article: 'el', body: pair(rect(372, 905, 130, 185)) }

// The shirt from the collar down, following the slope of the shoulders (the shoulder
// and arm shapes come first in the priority order, so they win where they overlap).
const SHIRT_TOP: Pt[] = [[440, 330], [584, 330], [609, 340], [661, 360], [680, 380], [640, 420], [384, 420], [346, 380], [367, 360], [418, 340]]
const chestPolygon = (bottom: number): Shape => poly(...SHIRT_TOP.slice(0, 6), [632, bottom], [392, bottom], ...SHIRT_TOP.slice(6))

// The back from the shoulder line down. Its top edge dips into a V under the
// nape (the 'nuca' zone sits there), so the two never overlap.
const backPolygon = (bottom: number): Shape =>
  poly([346, 380], [367, 360], [418, 340], [440, 334], [470, 358], [512, 372], [554, 358], [584, 334], [609, 340], [661, 360], [680, 380], [634, 420], [634, bottom], [386, bottom], [386, 420])

// Priority order = the order of the array (small and specific parts first).
const FRONT_PARTS: PartDef[] = [
  { id: 'oreja', label: 'oreja', article: 'la', target: pair(ell(396, 174, ZONE / 2, ZONE / 2)), body: pair(ell(436, 222, 22, 36)) },
  { id: 'cara', label: 'cara', article: 'la', body: [ell(512, 232, 64, 80)] },
  { id: 'cuello', label: 'cuello', article: 'el', target: [ell(512, 354, ZONE / 2, ZONE / 2)], body: [ell(512, 335, 50, 40)] },
  ELBOW,
  HAND,
  KNEE,
  { id: 'pie', label: 'pie', article: 'el', target: pair(ell(422, 1432, ZONE / 2, ZONE / 2)), body: pair(ell(422, 1436, 56, 56)) },
  SHOULDER,
  ARM,
  FOREARM_PART,
  { id: 'cabeza', label: 'cabeza', article: 'la', target: [ell(512, 185, 104, 130)], body: [ell(512, 185, 96, 126)] },
  { id: 'pecho', label: 'pecho', article: 'el', body: [chestPolygon(560)] },
  { id: 'panza', label: 'panza', article: 'la', body: [rect(372, 560, 280, 230)] },
  HIP,
  THIGH,
  { id: 'pierna', label: 'pierna', article: 'la', body: pair(rect(385, 1172, 100, 200)) },
]

const BACK_PARTS: PartDef[] = [
  { id: 'oreja', label: 'oreja', article: 'la', body: pair(ell(434, 214, 20, 36)) },
  { id: 'nuca', label: 'nuca', article: 'la', target: [ell(512, 258, ZONE / 2, ZONE / 2)], body: [ell(512, 302, 64, 56)] },
  BACK_ELBOW,
  HAND,
  KNEE,
  // The heel is the last 204px of the picture (it ends at the bottom edge) and the calf zone stops right above it.
  { id: 'talon', label: 'talón', article: 'el', target: pair(ell(437, IMG_H - ZONE / 2, ZONE / 2, ZONE / 2)), body: pair(ell(437, 1458, 38, 30)) },
  { id: 'pie', label: 'pie', article: 'el', body: pair(ell(422, 1436, 56, 56)) },
  SHOULDER,
  ARM,
  FOREARM_PART,
  { id: 'cabeza', label: 'cabeza', article: 'la', body: [ell(512, 175, 95, 118)] },
  { id: 'cintura', label: 'cintura', article: 'la', body: [rect(372, 705, 280, 85)] },
  { id: 'espalda', label: 'espalda', article: 'la', target: [backPolygon(760)], body: [backPolygon(705)] },
  HIP,
  THIGH,
  { id: 'pantorrilla', label: 'pantorrilla', article: 'la', target: pair(rect(325, 1125, 215, ZONE)), body: pair(rect(385, 1172, 100, 200)) },
]

type ViewId = 'frente' | 'espalda'
const VIEWS: Record<ViewId, PartDef[]> = { frente: FRONT_PARTS, espalda: BACK_PARTS }

interface LevelDef {
  name: string
  view: ViewId
  /** The parts to find, as ids of that view's parts. */
  asks: string[]
}

const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', view: 'frente', asks: ['cabeza', 'mano', 'pie'] },
  { name: 'Nivel 2', view: 'frente', asks: ['oreja', 'cuello', 'hombro', 'codo', 'rodilla'] },
  { name: 'Nivel 3', view: 'espalda', asks: ['nuca', 'espalda', 'codo', 'talon', 'pantorrilla'] },
]

const TOTAL_QUESTIONS = LEVELS.reduce((sum, lvl) => sum + lvl.asks.length, 0)

/** The widest the picture may be so that it, the question above it and the status line fit the modal of a
 * short phone: the modal leaves 100dvh - 95px of scroll area, and above the picture there are 150px (178px in
 * the back view, which adds a line) and below it 20px (+ 8px of safety). The picture is 2:3, so its width is
 * two thirds of the room. Never narrower than 14rem (the zones would be too small to hit) nor wider than
 * 340px, so on a phone that is tall enough nothing changes. Taps are measured against the box itself
 * (getBoundingClientRect), so any size works. */
function pictureMaxWidth(view: ViewId): string {
  const room = 95 + (view === 'espalda' ? 178 : 150) + 20 + 8
  return `min(340px, max(14rem, calc((100dvh - ${room}px) * 2 / 3)))`
}

function partOf(view: ViewId, id: string): PartDef {
  return VIEWS[view].find((p) => p.id === id) as PartDef
}

type Hit =
  | { kind: 'target'; zone: number }
  | { kind: 'part'; part: PartDef; shape: number }
  | { kind: 'none' }

/** The part of the body at (x, y) — image px — by its tight shapes, in priority order, skipping `skipId`. */
function nameAt(view: ViewId, x: number, y: number, skipId?: string): { part: PartDef; shape: number } | null {
  for (const part of VIEWS[view]) {
    if (part.id === skipId) continue
    const shape = part.body.findIndex((s) => inShape(s, x, y))
    if (shape >= 0) return { part, shape }
  }
  return null
}

/** What a tap at (x, y) — image px — means when `askedId` is the part being asked. */
function hitTest(view: ViewId, askedId: string, x: number, y: number): Hit {
  const asked = partOf(view, askedId)
  const zone = (asked.target ?? []).findIndex((s) => inShape(s, x, y))
  if (zone >= 0) return { kind: 'target', zone }
  const named = nameAt(view, x, y, askedId)
  return named ? { kind: 'part', ...named } : { kind: 'none' }
}
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
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/partes-del-cuerpo/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imageFor(view: ViewId): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${view}.webp`))?.[1]
}

interface LevelContent {
  /** The parts to find, in their (frozen) order for this mount. */
  asks: string[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => ({ asks: shuffle(lvl.asks) }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena vista!', '¡Perfecto!']
/** A tap this soon after the tap that brought the level on screen ("Siguiente nivel", "Repetir") is
 * the second tap of a double tap on that button, and the whole screen is now one big target: it must
 * not be judged as an answer. The same window swallows a second tap almost on top of the last wrong
 * one (DOUBLE_TAP_DIST, image px). Long enough to swallow a double tap, short enough that nobody who
 * means it notices. */
const SETTLE_MS = 400
const DOUBLE_TAP_DIST = 60

/** Where to look next, from a wrong tap: toward the nearest zone of the part asked. */
function directionHint(asked: PartDef, x: number, y: number): string {
  const centres = (asked.target ?? []).map(centre)
  if (centres.length === 0) return ''
  const [cx, cy] = centres.reduce((best, c) =>
    Math.hypot(c[0] - x, c[1] - y) < Math.hypot(best[0] - x, best[1] - y) ? c : best,
  )
  const dx = cx - x
  const dy = cy - y
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'está más arriba' : 'está más abajo'
  return Math.abs(cx - IMG_W / 2) > Math.abs(x - IMG_W / 2) ? 'está más hacia el costado' : 'está más hacia el centro'
}

type Feedback =
  | { kind: 'right'; zone: number }
  | { kind: 'wrong'; x: number; y: number; named: { part: PartDef; shape: number } | null }

const GRAY = '#6E7E96'
const GREEN = '#4CA52E'

interface ShapeSvgProps {
  shape: Shape
  fill: string
  stroke: string
  strokeWidth: number
  dashed?: boolean
}

function ShapeSvg({ shape, fill, stroke, strokeWidth, dashed }: ShapeSvgProps) {
  const common = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray: dashed ? '14 10' : undefined,
    strokeLinejoin: 'round' as const,
  }
  if (shape.k === 'e') return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />
  if (shape.k === 'r') return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={14} {...common} />
  return <polygon points={shape.pts.map((p) => p.join(',')).join(' ')} {...common} />
}

interface LevelViewProps {
  levelIdx: number
  content: LevelContent
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, content, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = content.asks.length

  const [questionIdx, setQuestionIdx] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [wrongInQuestion, setWrongInQuestion] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const lastWrongRef = useRef<{ x: number; y: number; at: number }>({ x: -999, y: -999, at: -999999 })
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const askedId = content.asks[questionIdx]
  const asked = partOf(level.view, askedId)

  function handleFigureTap(e: MouseEvent<HTMLButtonElement>) {
    // A keyboard "click" has no position on the picture: this is a game for fingers.
    // While the right answer shows its ring (`advancing`) taps are off, which is what swallows a double
    // tap on the RIGHT spot; the settle window swallows the one that follows the button that brought
    // the level here.
    if (advancing || done || e.detail === 0 || e.timeStamp - since < SETTLE_MS) return
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * IMG_W
    const y = ((e.clientY - box.top) / box.height) * IMG_H
    const hit = hitTest(level.view, askedId, x, y)

    if (hit.kind === 'target') {
      setFeedback({ kind: 'right', zone: hit.zone })
      setHint(`¡Eso es! Encontraste ${asked.article} ${asked.label}.`)
      setAdvancing(true)
      // The only timer in the game: a short pause so the green ring registers.
      advanceTimerRef.current = window.setTimeout(() => {
        if (questionIdx < total - 1) {
          setQuestionIdx((i) => i + 1)
          setFeedback(null)
          setHint(null)
          setWrongInQuestion(0)
          setAdvancing(false)
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, 1100)
      return
    }

    // A second tap almost on top of the last wrong one, a moment later, is a double tap.
    const last = lastWrongRef.current
    if (e.timeStamp - last.at < SETTLE_MS && Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP_DIST) return
    lastWrongRef.current = { x, y, at: e.timeStamp }

    const named = hit.kind === 'part' ? { part: hit.part, shape: hit.shape } : null
    const misses = wrongInQuestion + 1
    const look = `Buscá ${asked.article} ${asked.label}`
    // From the second miss on, point the way.
    const where = misses >= 2 ? directionHint(asked, x, y) : ''
    setFeedback({ kind: 'wrong', x, y, named })
    setWrongInQuestion(misses)
    setHint(
      named
        ? `Eso es ${named.part.article} ${named.part.label}. ${look}${where ? `: ${where}` : ''}.`
        : `Ahí no hay ninguna parte del cuerpo. ${look}${where ? `: ${where}` : ''}.`,
    )
    onMistake()
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-pink-700">
          {level.name}
        </span>
        {!done && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Pregunta {questionIdx + 1} de {total}
            </span>
            <h2 className="mt-2.5 text-balance text-2xl font-bold leading-snug text-slate-900">
              Tocá {asked.article}{' '}
              <span className="inline-block rounded-lg border-2 border-tiam-blue bg-tiam-blue/5 px-2 text-tiam-blue">
                {asked.label}
              </span>
            </h2>
            {level.view === 'espalda' && <p className="mt-1 text-base text-slate-500">Ahora la vemos de espaldas.</p>}
          </>
        )}
      </div>

      {!done && (
        <>
          <p
            role="status"
            className={`mt-2 min-h-[3rem] text-center text-base font-medium ${advancing ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint}
          </p>

          {/* The picture is one big button: where the tap lands decides what was touched. */}
          <div
            className="mx-auto mt-1 w-full overflow-hidden rounded-2xl bg-slate-50 ring-2 ring-slate-100"
            style={{ maxWidth: pictureMaxWidth(level.view) }}
          >
            <div className="relative aspect-[2/3] w-full">
              <img
                src={imageFor(level.view)}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
              />
              <svg
                viewBox={`0 0 ${IMG_W} ${IMG_H}`}
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
                focusable="false"
              >
                {feedback?.kind === 'right' && (
                  <>
                    {asked.body.map((shape, i) => (
                      <ShapeSvg key={i} shape={shape} fill="rgba(76,165,46,0.28)" stroke={GREEN} strokeWidth={9} />
                    ))}
                    <CheckBadge at={centre(asked.body[Math.min(feedback.zone, asked.body.length - 1)])} />
                  </>
                )}
                {feedback?.kind === 'wrong' && (
                  <>
                    {feedback.named && (
                      <ShapeSvg
                        shape={feedback.named.part.body[feedback.named.shape]}
                        fill="rgba(110,126,150,0.22)"
                        stroke={GRAY}
                        strokeWidth={7}
                        dashed
                      />
                    )}
                    <circle cx={feedback.x} cy={feedback.y} r={30} fill="rgba(255,255,255,0.55)" stroke="#ffffff" strokeWidth={14} />
                    <circle cx={feedback.x} cy={feedback.y} r={30} fill="none" stroke={GRAY} strokeWidth={8} />
                  </>
                )}
              </svg>
              <button
                type="button"
                onClick={handleFigureTap}
                aria-label={`Figura de una mujer vista ${level.view === 'espalda' ? 'de espaldas' : 'de frente'}. Tocá ${asked.article} ${asked.label}.`}
                className="absolute inset-0 h-full w-full cursor-pointer touch-manipulation select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tiam-blue/40"
              />
            </div>
          </div>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste las {total} partes del cuerpo. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {content.asks.map((id) => (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white py-1 pl-2 pr-3 text-base font-semibold text-slate-800"
              >
                <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                {capitalize(partOf(level.view, id).label)}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
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

/** A green disc with a white check, drawn in image px on top of the picture. */
function CheckBadge({ at: [x, y] }: { at: Pt }) {
  return (
    <g>
      <circle cx={x} cy={y} r={38} fill={GREEN} stroke="#ffffff" strokeWidth={7} />
      <polyline
        points={`${x - 17},${y + 1} ${x - 5},${y + 13} ${x + 18},${y - 12}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

export function PartesDelCuerpo({ onComplete }: GameProps) {
  // The order of the questions of each level — decided once, at mount, so
  // "Repetir" asks exactly the same questions in the same order.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
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
      content={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
