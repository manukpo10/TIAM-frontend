import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Caras y emociones" — emotion recognition from facial expression, TIAM's
 * first agnosias game built around reading a FACE rather than an object
 * (día 26). Two round types alternate every round so the task never goes
 * stale: FACE→WORD shows one face and asks for its name among 4 words;
 * WORD→FACE shows a name and asks for the matching face among 4.
 *
 * Faces are drawn live in SVG from a small parameter set instead of shipped
 * as photographs — the same rationale ElReloj/EncontraLaFiguraIgual already
 * established for geometry (crisp at any size, zero art assets), plus two
 * reasons specific to faces: a photo of a real person raises likeness/
 * consent problems this app has no business taking on, and a simple line
 * face is exactly the register of the paper exercise this adapts (older
 * adults are shown a handful of schematic expressions, not stock photos).
 *
 * FaceParams model (see FACE_PARAMS below — ONE fixed set per emotion;
 * these are never randomized per round, only which 4 emotions appear as
 * options and their order are):
 *   - browTilt: the inner end of each brow relative to the outer end.
 *     Positive lifts the inner end (worried/sad — think puppy eyebrows);
 *     negative drops it (furrowed/angry). Both brows move off one shared
 *     value, which is what makes them read as ONE expression instead of two
 *     independently-drawn lines.
 *   - browRaise: shifts the whole brow pair up (surprise/fear) or down
 *     toward the eyes (furrowed anger). Deliberately a SEPARATE parameter
 *     from browTilt — "raised" is a vertical shift, not a tilt, and a
 *     single "browAngle" scalar can't express both independently. Splitting
 *     them keeps surprise (raised, flat) and sadness (not raised, tilted)
 *     cleanly distinguishable instead of fighting over the same number.
 *   - eyeOpenness: a multiplier on the eye ellipse's vertical radius — under
 *     1 narrows/squints, over 1 widens.
 *   - mouthCurve / mouthOpen / mouthOpenAmount: a curved-line mouth whose
 *     control point bows below the baseline for a smile or above it for a
 *     frown (see the quadratic path in <Face>), OR — when mouthOpen is set —
 *     a round open "O" instead, sized by mouthOpenAmount, for sorpresa/miedo.
 *
 * Difficulty ramp (L1 far apart → L3 genuinely confusable) is driven by
 * CONFUSION_PARTNER, a fixed pairing of the emotion each one is easiest to
 * mistake for (alegría/tranquilidad, tristeza/enojo, sorpresa/miedo — each
 * pair shares its mouth family and only differs by brow tilt/raise or curve
 * intensity). L1's distractor pool excludes the target's partner outright;
 * L3's always INCLUDES it as a forced distractor. Levels sample their
 * targets as `count` DISTINCT emotions out of the 6 total (never more than
 * 5 are ever needed), so at most one emotion is left out per level — at
 * level 3 (5 of 6 targets) no confusion pair can ever be excluded entirely:
 * whichever emotion ends up as a target, its partner is guaranteed to
 * surface as that round's hard distractor. That is what actually realizes
 * "L3 includes sorpresa/miedo and enojo/tristeza" — a structural guarantee
 * from 5-out-of-6 sampling, not a hardcoded round.
 *
 * A wrong tap eliminates that option (muted grey, never red — the
 * catalog's standard) and never ends the round, same as
 * EncontraLaFiguraIgual/QueObjetoEs.
 */

type EmotionId = 'alegria' | 'tristeza' | 'enojo' | 'sorpresa' | 'miedo' | 'tranquilidad'
type RoundType = 'faceToWord' | 'wordToFace'

interface FaceParams {
  /** px: + inner end raised (worried/sad), - inner end lowered (furrowed/angry), 0 flat. */
  browTilt: number
  /** px: + whole brow shifted up (surprise/fear), - drawn down toward the eyes (anger), 0 neutral. */
  browRaise: number
  /** Eye ellipse ry multiplier: <1 narrowed/squinting, 1 normal, >1 wide open. */
  eyeOpenness: number
  /** -1..1, ignored when mouthOpen: negative = frown, 0 = flat, positive = smile. */
  mouthCurve: number
  /** True renders a round open mouth (surprise/fear) instead of the curved-line mouth. */
  mouthOpen: boolean
  /** 0..1, only meaningful when mouthOpen — how wide the "O" is. */
  mouthOpenAmount: number
}

const EMOTIONS: EmotionId[] = ['alegria', 'tristeza', 'enojo', 'sorpresa', 'miedo', 'tranquilidad']

const EMOTION_LABEL: Record<EmotionId, string> = {
  alegria: 'Alegría',
  tristeza: 'Tristeza',
  enojo: 'Enojo',
  sorpresa: 'Sorpresa',
  miedo: 'Miedo',
  tranquilidad: 'Tranquilidad',
}

// One hand-picked, fixed parameter set per emotion — see the file header for
// what each field means. Every set below differs from every other in at
// least three fields, so no two emotions can ever render as the same face.
const FACE_PARAMS: Record<EmotionId, FaceParams> = {
  alegria: { browTilt: 0, browRaise: 2, eyeOpenness: 0.85, mouthCurve: 1, mouthOpen: false, mouthOpenAmount: 0 },
  tranquilidad: {
    browTilt: 0,
    browRaise: 0,
    eyeOpenness: 0.8,
    mouthCurve: 0.35,
    mouthOpen: false,
    mouthOpenAmount: 0,
  },
  tristeza: { browTilt: 14, browRaise: 0, eyeOpenness: 0.75, mouthCurve: -0.8, mouthOpen: false, mouthOpenAmount: 0 },
  enojo: { browTilt: -10, browRaise: -2, eyeOpenness: 0.55, mouthCurve: -0.3, mouthOpen: false, mouthOpenAmount: 0 },
  sorpresa: { browTilt: 0, browRaise: 10, eyeOpenness: 1.4, mouthCurve: 0, mouthOpen: true, mouthOpenAmount: 0.9 },
  miedo: { browTilt: 8, browRaise: 7, eyeOpenness: 1.25, mouthCurve: 0, mouthOpen: true, mouthOpenAmount: 0.4 },
}

// The emotion each one is easiest to mistake for — see file header. Kept as
// an explicit table (not derived from FACE_PARAMS) so the "genuinely
// confusable" pairs the spec calls out are exactly the ones this produces.
const CONFUSION_PARTNER: Record<EmotionId, EmotionId> = {
  alegria: 'tranquilidad',
  tranquilidad: 'alegria',
  tristeza: 'enojo',
  enojo: 'tristeza',
  sorpresa: 'miedo',
  miedo: 'sorpresa',
}

const FACE_FILL = '#FFF7ED' // warm neutral cream — not a skin tone, just a friendly warm backdrop
const FACE_STROKE = '#334155' // slate-700 — the house rule explicitly allows plain dark slate for face strokes

// Describes what a face LOOKS like, purely from its parameters — never its
// emotion id — so a screen-reader user gets the same "read the face"
// challenge a sighted player gets, instead of the answer handed to them via
// the accessible name. Graded by magnitude (bien/apenas) so that visually
// close pairs like alegría/tranquilidad still get textually distinct labels.
function describeFace(emotion: EmotionId): string {
  const p = FACE_PARAMS[emotion]

  const browTilt =
    p.browTilt > 5
      ? 'con la punta de adentro más alta que la de afuera'
      : p.browTilt < -5
        ? 'con la punta de adentro más baja que la de afuera, como frunciendo el ceño'
        : 'rectas'
  const browRaise = p.browRaise > 4 ? ', bien levantadas' : p.browRaise < -3 ? ', bajas y juntas' : ''

  const eyes =
    p.eyeOpenness < 0.65
      ? 'ojos bien entrecerrados'
      : p.eyeOpenness < 0.9
        ? 'ojos apenas entrecerrados'
        : p.eyeOpenness > 1.3
          ? 'ojos bien abiertos'
          : p.eyeOpenness > 1.05
            ? 'ojos abiertos'
            : 'ojos normales'

  const mouth = p.mouthOpen
    ? p.mouthOpenAmount > 0.65
      ? 'boca bien abierta, redonda y grande'
      : 'boca apenas abierta, en un círculo chico'
    : Math.abs(p.mouthCurve) < 0.15
      ? 'boca en línea recta'
      : `boca ${Math.abs(p.mouthCurve) < 0.6 ? 'apenas' : 'bien'} curvada hacia ${p.mouthCurve > 0 ? 'arriba' : 'abajo'}`

  return `Cara con cejas ${browTilt}${browRaise}, ${eyes} y ${mouth}.`
}

// A plain line face: circle, two brows, two eyes with pupils, one mouth.
// Every coordinate is chosen so the geometry never clips the 200×200 viewBox
// and the brows never reach far enough down to overlap the eyes at any of
// the 6 parameter sets above (checked by hand against each one).
function Face({ emotion }: { emotion: EmotionId }) {
  const p = FACE_PARAMS[emotion]
  const eyeY = 96
  const leftEyeX = 66
  const rightEyeX = 134
  const eyeRy = 14 * p.eyeOpenness
  // Both brows share one baseline (shifted by browRaise) and one inner-end
  // offset (browTilt), so they move as a single coherent expression instead
  // of two independently-tuned lines.
  const browBaseY = 64 - p.browRaise
  const browInnerY = browBaseY - p.browTilt
  const mouthY = 144
  const mouthHalfWidth = 32

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <circle cx={100} cy={104} r={86} fill={FACE_FILL} stroke={FACE_STROKE} strokeWidth={5} />
      {/* Left brow: outer end at (leftEyeX-20), inner end at (leftEyeX+18). */}
      <line
        x1={leftEyeX - 20}
        y1={browBaseY}
        x2={leftEyeX + 18}
        y2={browInnerY}
        stroke={FACE_STROKE}
        strokeWidth={7}
        strokeLinecap="round"
      />
      {/* Right brow: mirrored — outer end at (rightEyeX+20), inner at (rightEyeX-18). */}
      <line
        x1={rightEyeX + 20}
        y1={browBaseY}
        x2={rightEyeX - 18}
        y2={browInnerY}
        stroke={FACE_STROKE}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <ellipse cx={leftEyeX} cy={eyeY} rx={14} ry={eyeRy} fill="#FFFFFF" stroke={FACE_STROKE} strokeWidth={4} />
      <ellipse cx={rightEyeX} cy={eyeY} rx={14} ry={eyeRy} fill="#FFFFFF" stroke={FACE_STROKE} strokeWidth={4} />
      <circle cx={leftEyeX} cy={eyeY} r={5} fill={FACE_STROKE} />
      <circle cx={rightEyeX} cy={eyeY} r={5} fill={FACE_STROKE} />
      {p.mouthOpen ? (
        <ellipse
          cx={100}
          cy={mouthY + 6}
          rx={10 + 14 * p.mouthOpenAmount}
          ry={12 + 18 * p.mouthOpenAmount}
          fill={FACE_STROKE}
        />
      ) : (
        // Quadratic bezier: pulling the control point BELOW the baseline
        // (positive mouthCurve) bows the middle down and the corners read as
        // raised — a smile. Pulling it ABOVE (negative) does the opposite —
        // a frown. Endpoints stay level; only the control point moves.
        <path
          d={`M ${100 - mouthHalfWidth},${mouthY} Q 100,${mouthY + p.mouthCurve * 34} ${100 + mouthHalfWidth},${mouthY}`}
          fill="none"
          stroke={FACE_STROKE}
          strokeWidth={7}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

interface Round {
  type: RoundType
  target: EmotionId
  options: EmotionId[]
}
interface Level {
  n: number
  name: string
  rounds: number
  hint?: string
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 3 },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    hint: 'Algunas opciones se parecen — mirá la cara completa, no solo un detalle.',
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    hint: 'Hay emociones bien parecidas entre sí. Fijate bien en las cejas y en la boca.',
  },
]

// Every round resolves via a genuine correct tap (no give-up path here), so
// totalAttempts = mistakes + this fixed total — same shape as EncontraLaFiguraIgual.
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa no es — fijate bien en las cejas y en la boca.',
  'Casi. Mirá la expresión completa antes de elegir de nuevo.',
  'No es esa — probá con otra opción.',
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

// L1: excludes the target's confusion partner from the pool entirely (far
// apart). L2: unconstrained sample of the rest (a natural mixed difficulty —
// the partner may or may not turn up). L3: the partner is ALWAYS one of the
// 3 distractors (genuinely confusable), plus 2 more random picks. Every
// branch samples without replacement from a pool that never contains the
// target, so the 3 distractors are always distinct from the target AND from
// each other by construction — no runtime retry needed.
function distractorsFor(target: EmotionId, levelIdx: number): EmotionId[] {
  const partner = CONFUSION_PARTNER[target]
  const others = EMOTIONS.filter((e) => e !== target)
  if (levelIdx === 0) {
    const farPool = others.filter((e) => e !== partner)
    return shuffle(farPool).slice(0, 3)
  }
  if (levelIdx === 1) {
    return shuffle(others).slice(0, 3)
  }
  const rest = others.filter((e) => e !== partner)
  return shuffle([partner, ...shuffle(rest).slice(0, 2)])
}

function makeRound(target: EmotionId, levelIdx: number, type: RoundType): Round {
  return { type, target, options: shuffle([target, ...distractorsFor(target, levelIdx)]) }
}

function makeRounds(levelIdx: number, count: number): Round[] {
  // `count` (max 5) is always <= EMOTIONS.length (6), so every level's
  // targets are distinct — see the file header for why this also guarantees
  // level 3 always exercises both named confusable pairs.
  const targets = shuffle(EMOTIONS).slice(0, count)
  const startType: RoundType = pickOne(['faceToWord', 'wordToFace'])
  return targets.map((target, i) => {
    const type: RoundType = i % 2 === 0 ? startType : startType === 'faceToWord' ? 'wordToFace' : 'faceToWord'
    return makeRound(target, levelIdx, type)
  })
}

export function CarasYEmociones({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `level.rounds` rondas generadas al azar, una sola vez por nivel/roundKey
  // — no en cada avance de roundIdx (mismo patrón que EncontraLaFiguraIgual).
  const rounds = useMemo(
    () => makeRounds(levelIdx, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<EmotionId>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(option: EmotionId) {
    if (!round || resolved || eliminated.has(option)) return
    if (option === round.target) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(option))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see EncontraLaFiguraIgual.tsx
  // for why: an effect-based reset lags one render behind, letting `done`
  // read stale-true right as levelIdx reaches the last level and firing
  // onComplete with garbage data.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra ronda" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when level 3's last round resolves. A full day
  // restart (the wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && round && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              {round.type === 'faceToWord' ? '¿Qué emoción muestra esta cara?' : 'Tocá la cara que muestra esta emoción'}
            </h2>
            {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {round.type === 'faceToWord' ? (
            <div
              className="relative mx-auto mt-3 aspect-square w-28 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-2 sm:mt-6 sm:w-36"
              role="img"
              aria-label={describeFace(round.target)}
            >
              <Face emotion={round.target} />
            </div>
          ) : (
            <div className="mx-auto mt-3 w-fit rounded-3xl border-2 border-slate-100 bg-white px-8 py-6 sm:mt-6">
              <p className="text-2xl font-bold text-tiam-blue sm:text-3xl">{EMOTION_LABEL[round.target]}</p>
            </div>
          )}

          {/* Options — either 4 words or 4 faces, same underlying EmotionId[]. */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-6">
            {round.options.map((option) => {
              const isEliminated = eliminated.has(option)
              const isCorrectShown = resolved && option === round.target
              return round.type === 'faceToWord' ? (
                <button
                  key={option}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 bg-white px-3 py-3 text-base font-bold transition sm:min-h-[64px] sm:text-lg',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 text-tiam-green ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 text-slate-400 opacity-50' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 text-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {EMOTION_LABEL[option]}
                  {isCorrectShown && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              ) : (
                <button
                  key={option}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  aria-label={describeFace(option)}
                  className={[
                    // Capped height, not aspect-square — same fix EncontraLaFiguraIgual
                    // uses: aspect-square tiles in a 2-col grid push the second row
                    // below the fold on a 375-wide phone. The face's own viewBox
                    // letterboxes to the shorter side, so it stays circular regardless.
                    'relative flex h-24 items-center justify-center rounded-2xl border-2 bg-white p-1 transition sm:h-32 sm:p-2',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 grayscale' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  <Face emotion={option} />
                  {isCorrectShown && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Reconociste las {level.rounds} emociones — ¡completaste el {level.name.toLowerCase()}!
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
            {levelIdx === LEVELS.length - 1 && (
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Otra ronda
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
