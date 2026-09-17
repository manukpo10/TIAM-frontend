import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Banderas y saludos" — a semantic/world-knowledge task for área orientación:
 * connect a country to its flag, and separately to the everyday greeting used
 * there. Two round types alternate every other round (see `makeRound`):
 *   1. Flag → country: a flag is shown large, tap its country among 4 small
 *      flag+name tiles.
 *   2. Country → greeting: a country name is shown, tap the greeting used
 *      there among 4 plain-text options.
 *
 * FLAGS ARE DRAWN LIVE IN SVG, never shipped as image files — same precedent
 * as ElReloj/EncontraLaFiguraIgual: a flag is just rectangles (plus, for one
 * of them, one plain circle), so procedural geometry is crisper than any
 * fixed art asset and needs zero image pipeline. `Flag` is one small
 * band-renderer shared by all 12 countries (orientation + band colors,
 * optional per-band weight, optional centred disc) — nothing per-country
 * beyond data, see `COUNTRIES` below.
 *
 * WHICH FLAGS WERE LEFT OUT, AND WHY — two different reasons:
 *  - Genuinely NOT renderable honestly as plain bands/a disc: anything whose
 *    identity depends on a crest, star field, union jack, or complex emblem
 *    (Brasil is the spec's own illustrative example for the greeting
 *    mechanic — "Brasil → Bom dia" — but is never actually included here as
 *    a country/flag; its flag needs a globe, stars and a banner, none of
 *    which is a "band or simple disc"). A crude rendering of a real national
 *    flag is worse than not including it.
 *  - Honestly renderable, but left OUT of this particular 12-country roster
 *    to keep it tight and highly recognisable for an Argentine adult, not
 *    because they're hard to draw: Austria (plain red-white-red horizontal —
 *    would've paired nicely with Perú's red-white-red VERTICAL, but Perú
 *    already anchors that shape family on its own), Rusia (plain white/
 *    blue/red horizontal), Bolivia (plain red/yellow/green horizontal) and
 *    España (plain red/yellow/red horizontal, coat of arms correctly
 *    omitted) were all straightforward to draw too. Any of the four can be
 *    added later the exact same way the other 12 are defined, as pure data.
 *
 * The 12 flags actually included: Argentina (celeste/blanco/celeste — the
 * sun is a single plain gold disc, deliberately NOT the 32-ray face), Italia,
 * Francia, Alemania, Irlanda, Bélgica, Países Bajos, Japón (plain red disc on
 * white, no bands at all), Polonia, Ucrania, Colombia (yellow band drawn at
 * its true double height), Perú.
 *
 * GREETING-ACCURACY FILTER — only 6 of these 12 countries also appear in
 * `countryToGreeting` rounds. A wrong word taught as fact to an Argentine
 * grandparent is real harm in an app people trust, so a country is included
 * there ONLY when a single, standard, well-known daytime greeting can be
 * stated with confidence — see the comment directly above `COUNTRIES` for
 * exactly which six qualify and why the other six were left flag-only.
 *
 * DIFFICULTY RAMP (flag rounds only — greeting-round decoys are always drawn
 * uniformly at random, since greeting PHRASES don't have a visual-similarity
 * axis to ramp against the way flags do): each country carries a `cluster`
 * tag. Three pairs share a cluster because they are genuinely confusable —
 * Italia/Irlanda (green-white-X vertical), Francia/Países Bajos (the exact
 * same 3 colours, different orientation), Alemania/Bélgica (black+red+gold-
 * or-yellow, different orientation); every other country is its own
 * singleton cluster (`find` on a singleton's cluster id can only ever match
 * itself, which is already excluded from the candidate pool, so it correctly
 * yields "no cluster-mate"). L1 decoys are drawn from the OPPOSITE band
 * orientation of the target, so silhouette alone tells them apart — no color
 * reading required yet. L2 mixes in one same-orientation-different-cluster
 * decoy, a step harder. L3 always includes the target's own cluster-mate
 * when it has one, filled out with more same-orientation decoys —
 * orientation stops helping and the actual colour order has to be read.
 */

type CountryId =
  | 'argentina'
  | 'italia'
  | 'francia'
  | 'alemania'
  | 'irlanda'
  | 'belgica'
  | 'paisesBajos'
  | 'japon'
  | 'polonia'
  | 'ucrania'
  | 'colombia'
  | 'peru'

interface FlagSpec {
  orientation: 'horizontal' | 'vertical'
  /** Colors in order — top-to-bottom for horizontal, left-to-right for vertical. */
  bands: string[]
  /** Relative band sizes (e.g. Colombia's [2,1,1]) — equal-width bands when omitted. */
  weights?: number[]
  disc?: { color: string; radius: number }
  /** Describes the bands/shape only — NEVER the country. Naming it in the
   * accessible name would hand a screen-reader user the answer for free. */
  ariaLabel: string
}

interface CountryDef {
  name: string
  flag: FlagSpec
  /** Groups genuinely-confusable flags for the L3 decoy pool — see file header. */
  cluster: string
  /** Present ONLY for a confident, standard, well-known daytime greeting. */
  greeting?: string
}

// Fixed 3:2 canvas every flag draws into — real-world flag ratios vary
// slightly, but a shared canvas keeps every option tile the same size
// regardless of which country lands in it, so tile geometry itself never
// hints at the answer.
const FLAG_W = 90
const FLAG_H = 60

/**
 * Country roster. `cluster` groups genuinely-confusable flags for the L3
 * decoy pool (see file header); singletons use their own id so a lookup can
 * never accidentally match a second country.
 *
 * `greeting` is present ONLY for six countries with a confident, single,
 * standard, well-known daytime greeting — spelled the same romanized way a
 * phrasebook would (matching how the brief's own example romanizes Japanese
 * as "Konnichiwa" rather than writing it in kana):
 *   - Italia, Francia, Alemania, Japón — textbook-standard, no ambiguity.
 *   - Países Bajos → "Goedendag": the standard Dutch daytime greeting (a
 *     notch more formal than everyday "Hallo", but it's the one that's
 *     actually specific to Dutch rather than borrowed/generic).
 *   - Polonia → "Dzień dobry": the standard Polish daytime greeting, used
 *     into the evening, no real alternative reading.
 * Left OUT on purpose, not by oversight:
 *   - Argentina, Colombia, Perú: their real greeting is plain Spanish
 *     ("Buenos días"/"Buen día") — identical to the game's own language and,
 *     worse, identical to EACH OTHER, which would put two textually-equal
 *     "correct" and "wrong" buttons in the same round. Flag-only.
 *   - Irlanda: the Irish-language greeting (Dia dhuit) isn't what's actually
 *     said day to day — English "Hello" is — and "Hello" is too generic to
 *     teach anything distinct among 4 options. Flag-only.
 *   - Bélgica: three official languages, no single correct answer, and any
 *     one choice would textually collide with Francia's or Alemania's or
 *     Países Bajos' greeting already in this pool. Flag-only.
 *   - Ucrania: "Добрий день" (good day) is real, but its Latin
 *     transliteration isn't fully standardized — this app's trust bar is too
 *     high to guess at a spelling. Flag-only.
 */
const COUNTRIES: Record<CountryId, CountryDef> = {
  argentina: {
    name: 'Argentina',
    cluster: 'argentina',
    flag: {
      orientation: 'horizontal',
      bands: ['#75AADB', '#FFFFFF', '#75AADB'],
      disc: { color: '#F6B40E', radius: 9 },
      ariaLabel:
        'bandera con tres franjas horizontales celeste, blanca y celeste, con un sol dorado simple en el centro',
    },
  },
  italia: {
    name: 'Italia',
    cluster: 'greenWhiteVertical',
    greeting: 'Buongiorno',
    flag: {
      orientation: 'vertical',
      bands: ['#009246', '#FFFFFF', '#CE2B37'],
      ariaLabel: 'bandera con tres franjas verticales: verde, blanca y roja',
    },
  },
  francia: {
    name: 'Francia',
    cluster: 'blueWhiteRedMix',
    greeting: 'Bonjour',
    flag: {
      orientation: 'vertical',
      bands: ['#0055A4', '#FFFFFF', '#EF4135'],
      ariaLabel: 'bandera con tres franjas verticales: azul, blanca y roja',
    },
  },
  alemania: {
    name: 'Alemania',
    cluster: 'blackRedGoldMix',
    greeting: 'Guten Tag',
    flag: {
      orientation: 'horizontal',
      bands: ['#000000', '#DD0000', '#FFCE00'],
      ariaLabel: 'bandera con tres franjas horizontales: negra, roja y amarilla',
    },
  },
  irlanda: {
    name: 'Irlanda',
    cluster: 'greenWhiteVertical',
    flag: {
      orientation: 'vertical',
      bands: ['#169B62', '#FFFFFF', '#FF883E'],
      ariaLabel: 'bandera con tres franjas verticales: verde, blanca y naranja',
    },
  },
  belgica: {
    name: 'Bélgica',
    cluster: 'blackRedGoldMix',
    flag: {
      orientation: 'vertical',
      bands: ['#000000', '#FAE042', '#ED2939'],
      ariaLabel: 'bandera con tres franjas verticales: negra, amarilla y roja',
    },
  },
  paisesBajos: {
    name: 'Países Bajos',
    cluster: 'blueWhiteRedMix',
    greeting: 'Goedendag',
    flag: {
      orientation: 'horizontal',
      bands: ['#AE1C28', '#FFFFFF', '#21468B'],
      ariaLabel: 'bandera con tres franjas horizontales: roja, blanca y azul',
    },
  },
  japon: {
    name: 'Japón',
    cluster: 'japon',
    greeting: 'Konnichiwa',
    flag: {
      orientation: 'horizontal',
      bands: ['#FFFFFF'],
      disc: { color: '#BC002D', radius: 14 },
      ariaLabel: 'bandera blanca con un círculo rojo en el centro',
    },
  },
  polonia: {
    name: 'Polonia',
    cluster: 'polonia',
    greeting: 'Dzień dobry',
    flag: {
      orientation: 'horizontal',
      bands: ['#FFFFFF', '#DC143C'],
      ariaLabel: 'bandera con dos franjas horizontales: blanca arriba y roja abajo',
    },
  },
  ucrania: {
    name: 'Ucrania',
    cluster: 'ucrania',
    flag: {
      orientation: 'horizontal',
      bands: ['#0057B7', '#FFD700'],
      ariaLabel: 'bandera con dos franjas horizontales: azul arriba y amarilla abajo',
    },
  },
  colombia: {
    name: 'Colombia',
    cluster: 'colombia',
    flag: {
      orientation: 'horizontal',
      bands: ['#FCD116', '#003893', '#CE1126'],
      weights: [2, 1, 1],
      ariaLabel:
        'bandera con tres franjas horizontales: amarilla (el doble de ancha) arriba, azul angosta al medio y roja angosta abajo',
    },
  },
  peru: {
    name: 'Perú',
    cluster: 'peru',
    flag: {
      orientation: 'vertical',
      bands: ['#D91023', '#FFFFFF', '#D91023'],
      ariaLabel: 'bandera con tres franjas verticales: roja, blanca y roja',
    },
  },
}

const ALL_COUNTRY_IDS = Object.keys(COUNTRIES) as CountryId[]
const GREETING_COUNTRY_IDS = ALL_COUNTRY_IDS.filter((id) => COUNTRIES[id].greeting !== undefined)

/** Renders one flag as flat SVG rects (+ an optional centred disc) from a
 * FlagSpec — the only per-country drawing code is the data in COUNTRIES. */
function Flag({ spec, className }: { spec: FlagSpec; className?: string }) {
  const { orientation, bands, weights, disc, ariaLabel } = spec
  const w = weights ?? bands.map(() => 1)
  const total = w.reduce((sum, x) => sum + x, 0)
  let offset = 0
  const rects = bands.map((color, i) => {
    const span = (w[i] / total) * (orientation === 'horizontal' ? FLAG_H : FLAG_W)
    const rect =
      orientation === 'horizontal'
        ? { x: 0, y: offset, width: FLAG_W, height: span }
        : { x: offset, y: 0, width: span, height: FLAG_H }
    offset += span
    return <rect key={i} {...rect} fill={color} />
  })
  return (
    <svg viewBox={`0 0 ${FLAG_W} ${FLAG_H}`} className={className} role="img" aria-label={ariaLabel}>
      {rects}
      {disc && <circle cx={FLAG_W / 2} cy={FLAG_H / 2} r={disc.radius} fill={disc.color} />}
      {/* Thin neutral outline so a white band (Polonia, Japón's field, the
          middle of Argentina/Italia/Francia/Irlanda/Perú) never vanishes
          against the white card behind it. */}
      <rect x={0.5} y={0.5} width={FLAG_W - 1} height={FLAG_H - 1} fill="none" stroke="#CBD5E1" strokeWidth={1} />
    </svg>
  )
}

interface FlagOption {
  key: string
  id: CountryId
  correct: boolean
}
interface GreetingOption {
  key: string
  id: CountryId
  greeting: string
  correct: boolean
}
interface FlagRound {
  kind: 'flagToCountry'
  targetId: CountryId
  options: FlagOption[]
}
interface GreetingRound {
  kind: 'countryToGreeting'
  targetId: CountryId
  options: GreetingOption[]
}
type Round = FlagRound | GreetingRound

interface Level {
  n: number
  name: string
  rounds: number
  hint?: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 3,
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    hint: 'Ahora hay banderas parecidas entre las opciones — fijate bien en los colores.',
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    hint: 'Ojo: hay banderas con los mismos colores en otro orden. Mirá bien las franjas.',
  },
]

// Every round resolves via a genuine correct tap (no give-up path here), so
// totalAttempts = mistakes + this fixed total — same shape as EncontraLaFiguraIgual.
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

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

function pickFlagDistractors(targetId: CountryId, levelIdx: number): CountryId[] {
  const target = COUNTRIES[targetId]
  const others = ALL_COUNTRY_IDS.filter((id) => id !== targetId)
  const sameOrientation = others.filter((id) => COUNTRIES[id].flag.orientation === target.flag.orientation)
  const diffOrientation = others.filter((id) => COUNTRIES[id].flag.orientation !== target.flag.orientation)
  const clusterMate = others.find((id) => COUNTRIES[id].cluster === target.cluster)

  if (levelIdx === 0) {
    // L1: band ORIENTATION alone must tell target and decoys apart — no
    // color-reading needed yet. Falls back to `others` only as a guard: with
    // the current 12-country mix (5 vertical, 7 horizontal) this pool is
    // always >= 3, so the fallback never actually triggers.
    const pool = diffOrientation.length >= 3 ? diffOrientation : others
    return shuffle(pool).slice(0, 3)
  }
  if (levelIdx === 2) {
    // L3: the target's own genuinely-confusable cluster-mate (if it has one)
    // is ALWAYS included first, filled out with more same-orientation decoys
    // — orientation no longer tells them apart, so colors must be read.
    const rest = shuffle(sameOrientation.filter((id) => id !== clusterMate))
    const withMate = clusterMate ? [clusterMate, ...rest] : rest
    const pool = withMate.length >= 3 ? withMate : shuffle(others)
    return pool.slice(0, 3)
  }
  // L2: one same-orientation-but-different-cluster decoy (a step harder than
  // L1) plus two decoys from anywhere else — the same "mix" shape as
  // EncontraLaFiguraIgual's own L2.
  const midDecoy = shuffle(sameOrientation.filter((id) => id !== clusterMate))[0]
  const rest = shuffle(others.filter((id) => id !== midDecoy)).slice(0, 2)
  return midDecoy ? [midDecoy, ...rest] : shuffle(others).slice(0, 3)
}

function makeFlagRound(levelIdx: number): FlagRound {
  const targetId = pickOne(ALL_COUNTRY_IDS)
  const decoys = pickFlagDistractors(targetId, levelIdx)
  const options: FlagOption[] = shuffle([
    { key: targetId, id: targetId, correct: true },
    ...decoys.map((id) => ({ key: id, id, correct: false })),
  ])
  return { kind: 'flagToCountry', targetId, options }
}

function makeGreetingRound(): GreetingRound {
  const targetId = pickOne(GREETING_COUNTRY_IDS)
  const decoys = shuffle(GREETING_COUNTRY_IDS.filter((id) => id !== targetId)).slice(0, 3)
  const options: GreetingOption[] = shuffle([
    { key: targetId, id: targetId, greeting: COUNTRIES[targetId].greeting!, correct: true },
    ...decoys.map((id) => ({ key: id, id, greeting: COUNTRIES[id].greeting!, correct: false })),
  ])
  return { kind: 'countryToGreeting', targetId, options }
}

// Round TYPE alternates flag/greeting purely by position within the level
// (starting with a flag round), independent of the content randomness above
// — a level's rounds always read flag, greeting, flag, … and never e.g. two
// greeting rounds in a row.
function makeRound(levelIdx: number, indexInLevel: number): Round {
  return indexInLevel % 2 === 0 ? makeFlagRound(levelIdx) : makeGreetingRound()
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const FLAG_HINTS = [
  'Esa no es — volvé a mirar los colores de la bandera de arriba.',
  'Casi. Fijate si las franjas son verticales u horizontales.',
  'No es ese país — comparalo de nuevo con la bandera de arriba.',
]
const GREETING_HINTS = [
  'Ese no es el saludo — probá con otra opción.',
  'Casi. Pensalo de nuevo.',
  'No es ese — fijate bien cuál va con ese país.',
]

export function BanderasYSaludos({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `level.rounds` rounds generated once per level/roundKey — same useMemo
  // "epoch" shape as EncontraLaFiguraIgual/SumaHastaDiez, so "Repetir" (which
  // only bumps roundKey) is deterministic and never reshuffles mid-level.
  const rounds = useMemo(
    () => Array.from({ length: level.rounds }, (_, i) => makeRound(levelIdx, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(option: FlagOption | GreetingOption) {
    if (!round || resolved || eliminated.has(option.key)) return
    if (option.correct) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(option.key))
    setMistakes((m) => m + 1)
    setHint(pickOne(round.kind === 'flagToCountry' ? FLAG_HINTS : GREETING_HINTS))
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — an effect-based reset
  // lags one render behind, letting `done` read stale-true right as levelIdx
  // reaches the last level and firing onComplete with garbage data (same
  // reasoning as EncontraLaFiguraIgual.tsx / SumaHastaDiez.tsx).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count.
    if (isWrap) setMistakes(0)
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
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {level.name}
        </span>
        {!done && round && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              {round.kind === 'flagToCountry' ? 'Mirá la bandera y tocá el país' : 'Mirá el país y tocá cómo se saludan ahí'}
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
          {/* Prompt: the flag to identify, or the country to greet */}
          {round.kind === 'flagToCountry' ? (
            <div className="relative mx-auto mt-3 w-36 overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-2 sm:mt-6 sm:w-48">
              <div className="aspect-[3/2] w-full overflow-hidden rounded-lg">
                <Flag spec={COUNTRIES[round.targetId].flag} className="h-full w-full" />
              </div>
            </div>
          ) : (
            <div className="mx-auto mt-3 flex w-full max-w-xs items-center justify-center rounded-2xl border-2 border-slate-100 bg-white px-4 py-5 sm:mt-6 sm:py-6">
              <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{COUNTRIES[round.targetId].name}</p>
            </div>
          )}

          {/* Options */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-6">
            {round.kind === 'flagToCountry'
              ? round.options.map((option) => {
                  const isEliminated = eliminated.has(option.key)
                  const isCorrectShown = resolved && option.correct
                  const country = COUNTRIES[option.id]
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={resolved || isEliminated}
                      onClick={() => guess(option)}
                      aria-label={country.name}
                      className={[
                        'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 bg-white p-3 text-center transition',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                        isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                        isEliminated ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-60' : '',
                        !isCorrectShown && !isEliminated
                          ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                          : '',
                      ].join(' ')}
                    >
                      {/* Names only, deliberately. Repeating each option's flag
                          under its name turns the round into "find the picture
                          that matches the picture above" — the country never
                          has to be recognised at all, which is the one thing
                          the round is for. */}
                      <span className="text-base font-bold leading-tight text-slate-700">
                        {country.name}
                      </span>
                      {isCorrectShown && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })
              : round.options.map((option) => {
                  const isEliminated = eliminated.has(option.key)
                  const isCorrectShown = resolved && option.correct
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={resolved || isEliminated}
                      onClick={() => guess(option)}
                      className={[
                        'relative flex min-h-[64px] items-center justify-center rounded-2xl border-2 bg-white px-3 py-3 text-center transition sm:min-h-[80px]',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                        isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                        isEliminated ? 'border-slate-200 opacity-40 grayscale' : '',
                        !isCorrectShown && !isEliminated
                          ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                          : '',
                      ].join(' ')}
                    >
                      <span className="text-base font-bold text-slate-700 sm:text-lg">{option.greeting}</span>
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
            Completaste las {level.rounds} rondas — ¡terminaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
