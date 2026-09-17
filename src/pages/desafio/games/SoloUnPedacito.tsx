import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Sólo un pedacito" — visual closure. A small patch of an animal is shown
 * and the player names it. Recognising a whole from a fragment is the classic
 * agnosia exercise and the one month 4's reference sheet illustrates with
 * cut-up animal drawings.
 *
 * No new art: the crop is done in CSS over the animal photos the catalog
 * already ships for "Animal por letra". A zoom plus an offset from centre
 * turns one asset into an endless supply of fragments, and the difficulty
 * knob is just how far in you zoom.
 *
 * The offset stays modest on purpose. These assets are single subjects on a
 * plain ground, so a crop near the edge lands on empty background and the
 * round becomes unanswerable — staying within ±12% of centre keeps the patch
 * on the animal at every zoom level.
 *
 * Relative to día 29 of month 1 ("¿Qué será?"), which reveals a line drawing
 * progressively until you recognise it: this one never reveals more. What you
 * get is what you get, which makes it a static-closure task rather than a
 * race between recognition and disclosure.
 */

interface Animal {
  id: string
  label: string
  group: string
}

const ANIMALS: Animal[] = [
  { id: 'gato', label: 'gato', group: 'mamifero' },
  { id: 'vaca', label: 'vaca', group: 'mamifero' },
  { id: 'chancho', label: 'chancho', group: 'mamifero' },
  { id: 'burro', label: 'burro', group: 'mamifero' },
  { id: 'oso', label: 'oso', group: 'mamifero' },
  { id: 'zorro', label: 'zorro', group: 'mamifero' },
  { id: 'mono', label: 'mono', group: 'mamifero' },
  { id: 'llama', label: 'llama', group: 'mamifero' },
  { id: 'nutria', label: 'nutria', group: 'mamifero' },
  { id: 'cebra', label: 'cebra', group: 'mamifero-grande' },
  { id: 'jirafa', label: 'jirafa', group: 'mamifero-grande' },
  { id: 'elefante', label: 'elefante', group: 'mamifero-grande' },
  { id: 'hipopotamo', label: 'hipopótamo', group: 'mamifero-grande' },
  { id: 'leon', label: 'león', group: 'mamifero-grande' },
  { id: 'pato', label: 'pato', group: 'ave' },
  { id: 'flamenco', label: 'flamenco', group: 'ave' },
  { id: 'nandu', label: 'ñandú', group: 'ave' },
  { id: 'rana', label: 'rana', group: 'reptil' },
  { id: 'tortuga', label: 'tortuga', group: 'reptil' },
  { id: 'serpiente', label: 'serpiente', group: 'reptil' },
  { id: 'yacare', label: 'yacaré', group: 'reptil' },
  { id: 'delfin', label: 'delfín', group: 'agua' },
  { id: 'cangrejo', label: 'cangrejo', group: 'agua' },
  { id: 'abeja', label: 'abeja', group: 'insecto' },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/animal-por-letra/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

interface Level {
  n: number
  name: string
  rounds: number
  /** How far into the photo the crop zooms — bigger means a smaller patch. */
  zoom: number
  /** When true, the three decoys come from the target's own group. */
  sameGroupDecoys: boolean
}

// Zoom factors are deliberately high. The unzoomed frame already shows the
// animal filling the box (object-cover), so anything under ~2× just trims the
// edges and hands over the whole animal — verified in the browser, where 2×
// showed a fully recognisable bear and made the round free.
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 3, zoom: 2.6, sameGroupDecoys: false },
  { n: 2, name: 'Nivel 2', rounds: 4, zoom: 3.6, sameGroupDecoys: false },
  { n: 3, name: 'Nivel 3', rounds: 5, zoom: 4.6, sameGroupDecoys: true },
]

const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
/**
 * Max drift of the zoom origin from centre, in percent. Small on purpose: at
 * 4.6× a larger drift walks the window clean off the subject and onto empty
 * ground, and a patch of background is not a puzzle.
 */
const MAX_OFFSET = 8

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
const offset = () => 50 + Math.round((Math.random() * 2 - 1) * MAX_OFFSET)

interface Round {
  target: Animal
  options: Animal[]
  posX: number
  posY: number
}

function buildRounds(level: Level): Round[] {
  return shuffle(ANIMALS)
    .slice(0, level.rounds)
    .map((target) => {
      // Decoys sampled WITHOUT replacement from a pool that already excludes
      // the target, so the four options can never repeat an animal.
      const others = ANIMALS.filter((a) => a.id !== target.id)
      const preferred = level.sameGroupDecoys ? others.filter((a) => a.group === target.group) : []
      const rest = others.filter((a) => !preferred.includes(a))
      const decoys = [...shuffle(preferred), ...shuffle(rest)].slice(0, 3)
      return { target, options: shuffle([target, ...decoys]), posX: offset(), posY: offset() }
    })
}

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa no es. Mirá bien el color y la textura del pedacito.',
  'No es ese animal — probá con otro.',
  'Casi. Fijate si se ve pelo, plumas o escamas.',
]

export function SoloUnPedacito({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Which animals/crops each level's rounds show — decided once, at mount,
  // and never re-rolled afterward: not on revisiting a level, and not on
  // "Repetir" either (same content-freezing convention as CruceDeLetras.tsx's
  // epochEntries), so "Repetir" always shows the exact same fragments.
  const [epochRounds] = useState(() => LEVELS.map((lvl) => buildRounds(lvl)))
  const rounds = epochRounds[levelIdx]

  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= rounds.length

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function guess(animal: Animal) {
    if (!round || resolved || eliminated.has(animal.id)) return
    if (animal.id === round.target.id) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 900)
      return
    }
    setEliminated((prev) => new Set(prev).add(animal.id))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` would read the
  // previous level's stale-true value on the very render that arrives at the
  // new level and fire onComplete with garbage. Same as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level's last round resolves. A
  // genuine full-day restart (the wrap to level 1) gets a new roundKey so it
  // can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const src = round ? imgFor(round.target.id) : undefined

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(124, 58, 237, 0.1)', color: '#7C3AED' }}
        >
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              ¿De qué animal es este pedacito?
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {rounds.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${rounds.length ? (roundIdx / rounds.length) * 100 : 0}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* The fragment. `object-cover` while cropping so the animal fills
              the frame before the zoom is applied — with `object-contain` the
              photo sits letterboxed and the zoom spends itself eating the
              margin instead of closing in. On resolve it switches to
              `object-contain` at scale 1 so the whole animal, uncropped,
              slides into view — the reveal is the reward. */}
          <div className="mx-auto mt-5 aspect-square w-40 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:w-48">
            {src && (
              <img
                src={src}
                alt=""
                draggable={false}
                className={[
                  'h-full w-full transition-transform duration-500',
                  resolved ? 'object-contain' : 'object-cover',
                ].join(' ')}
                style={{
                  transform: resolved ? 'scale(1)' : `scale(${level.zoom})`,
                  transformOrigin: `${round.posX}% ${round.posY}%`,
                }}
              />
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {round.options.map((option) => {
              const isEliminated = eliminated.has(option.id)
              const isCorrectShown = resolved && option.id === round.target.id
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 px-3 py-2 text-center text-base font-semibold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-60' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {option.label}
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
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Reconociste los {rounds.length} — ¡completaste el {level.name.toLowerCase()}!
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
