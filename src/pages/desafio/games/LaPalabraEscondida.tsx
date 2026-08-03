import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La palabra escondida" — a sustained-attention / visual-scanning mini-game.
 *
 * A long run-on string of a repeated filler syllable (no spaces, same case
 * throughout so nothing pops by casing) hides ONE real word seamlessly
 * inside it. Below, 4-5 candidate words — tap the one that's actually hidden
 * in the text.
 *
 * Implemented as multiple-choice rather than free-span text selection (the
 * brief explicitly sanctions this simplification): selecting an exact
 * character range reliably on a phone, across long wrapped lines with no
 * spaces, is a real touch-target trap, while tapping one of 4-5 clear
 * buttons is unambiguous on any screen size and still requires reading the
 * whole string carefully to find the word before answering.
 *
 * Difficulty ramps via three independent levers, not just string length:
 *   L1 short string, common short word, unrelated candidates
 *   L2 longer string, filler syllable that ECHOES the target's own ending
 *      (e.g. filler "sa" + "camisa", which itself ends in "sa") so the word
 *      doesn't visually "stop" cleanly against the filler
 *   L3 longest string, candidates share the same ending/rubro as each other
 *      (bicicleta/calculadora/carretilla/calendario) so length/shape alone
 *      can't eliminate any of them — the player has to actually find the
 *      word in the text, not guess-and-check by candidate shape
 *
 * VARIAS rondas por nivel, mismo patrón que EncontraLaFiguraIgual/LaIntrusa:
 * un pool curado por nivel (no generado al azar — el relleno tiene que
 * quedar prolijo letra a letra, no hay forma de garantizar eso con sílabas
 * random), sorteado sin reemplazo.
 */

interface HiddenWordRound {
  filler: string
  fillerRepeats: number
  target: string
  candidates: string[] // includes target, in a fixed order — shuffled at render
}

const L1_ROUNDS: HiddenWordRound[] = [
  { filler: 'to', fillerRepeats: 8, target: 'gato', candidates: ['gato', 'pato', 'mesa', 'sol', 'luna'] },
  { filler: 'la', fillerRepeats: 8, target: 'mano', candidates: ['mano', 'dedo', 'pie', 'ojo', 'boca'] },
  { filler: 'ra', fillerRepeats: 8, target: 'casa', candidates: ['casa', 'cama', 'ropa', 'taza', 'silla'] },
  { filler: 'pi', fillerRepeats: 8, target: 'perro', candidates: ['perro', 'gato', 'pollo', 'cerdo', 'conejo'] },
]
const L2_ROUNDS: HiddenWordRound[] = [
  { filler: 'sa', fillerRepeats: 12, target: 'camisa', candidates: ['camisa', 'cortina', 'sombrero', 'pantalon', 'bufanda'] },
  { filler: 'no', fillerRepeats: 12, target: 'sillon', candidates: ['sillon', 'cajon', 'ventana', 'cortina', 'mueble'] },
  { filler: 'ta', fillerRepeats: 12, target: 'maceta', candidates: ['maceta', 'cortina', 'alfombra', 'cuadro', 'lampara'] },
  { filler: 'da', fillerRepeats: 12, target: 'cocina', candidates: ['cocina', 'terraza', 'galeria', 'entrada', 'pasillo'] },
]
const L3_ROUNDS: HiddenWordRound[] = [
  { filler: 'mo', fillerRepeats: 16, target: 'tambor', candidates: ['tambor', 'timbre', 'tabaco', 'tornado', 'tornillo'] },
  { filler: 'ca', fillerRepeats: 16, target: 'bicicleta', candidates: ['bicicleta', 'calculadora', 'chimenea', 'carretilla', 'calendario'] },
  {
    filler: 'ri',
    fillerRepeats: 16,
    target: 'escritorio',
    candidates: ['escritorio', 'dormitorio', 'laboratorio', 'repertorio', 'territorio'],
  },
  { filler: 'lo', fillerRepeats: 16, target: 'calendario', candidates: ['calendario', 'escenario', 'vocabulario', 'itinerario', 'laboratorio'] },
]

interface Level {
  n: number
  name: string
  rounds: number
  pool: HiddenWordRound[]
  hint?: string
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 3, pool: L1_ROUNDS },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 3,
    pool: L2_ROUNDS,
    hint: 'Leé despacio, letra por letra — la palabra está pegada al resto del texto.',
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 4,
    pool: L3_ROUNDS,
    hint: 'Las opciones se parecen mucho entre sí — no alcanza con adivinar por el tamaño.',
  },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface BuiltRound {
  text: string
  target: string
  options: string[]
}

function buildRounds(level: Level): BuiltRound[] {
  return pick(level.pool, level.rounds).map((r) => {
    const filler = r.filler.repeat(r.fillerRepeats)
    return { text: filler + r.target + filler, target: r.target, options: shuffle(r.candidates) }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente lectura!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena atención!']
const HINTS = [
  'Esa no es — releé el texto con calma.',
  'No, esa no. Fijate letra por letra, sin apurarte.',
  'Casi. Probá con otra opción.',
]

export function LaPalabraEscondida({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which rounds (3-of-4 pool entries drawn, already built into full
  // BuiltRound objects) are playing for level i THIS "epoch" (a full
  // 3-level pass). Decided once per epoch — at mount, and again on "Hacer
  // otro" — never re-rolled just because the player re-visits a level, so
  // "Repetir" can hand back the exact same rounds deterministically instead
  // of re-randomizing.
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => buildRounds(lvl)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see restartEpoch below).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(option: string) {
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

  // Resets happen synchronously HERE, with the level/round change itself —
  // not in a separate effect (see every other game in this folder for why:
  // an effect lags one render behind and lets `done` read stale-true right
  // as levelIdx reaches the last level, firing onComplete with garbage).

  // "Siguiente nivel" — advance within the SAME epoch. epochRounds is left
  // alone: level i+1's drawn rounds were already decided when this epoch started.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }

  // Shared by both restart buttons on the final level's complete card.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  // "Repetir" — same rounds, same order, as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — a fresh random draw per level, same as before this
  // feature existed (the only option there used to be). Note: level 3's
  // rounds count equals its pool size, so for that level this only reshuffles
  // ORDER, not which entries are drawn — an accurate reflection of the data,
  // not a bug.
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => buildRounds(lvl)))
  }

  // Fires once per roundKey when level 3's last round resolves. totalAttempts
  // = accumulated mistakes + one correct guess per round across every level
  // (same shape as EncontraLaFiguraIgual/LaIntrusa).
  const totalRoundsAllLevels = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + totalRoundsAllLevels })
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
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué palabra está escondida?</h2>
            {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {level.rounds}
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
          {/* The hidden-word string — break-all is load-bearing: there are no
              spaces anywhere, so the browser has no other place to wrap a
              long line on a narrow phone screen. Monospace keeps every
              letter the same width, which is what makes the target word
              blend into the filler rhythm instead of standing out by its
              own letter-spacing. */}
          <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 sm:p-6">
            <p className="break-all font-mono text-lg uppercase leading-relaxed tracking-wide text-slate-700 sm:text-xl">
              {round.text}
            </p>
          </div>

          {/* Options */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {round.options.map((option) => {
              const isEliminated = eliminated.has(option)
              const isCorrectShown = resolved && option === round.target
              return (
                <button
                  key={option}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(option)}
                  className={[
                    'relative flex min-h-[48px] items-center justify-center rounded-xl border-2 bg-white px-4 font-semibold capitalize text-slate-700 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 line-through' : '',
                    !isCorrectShown && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {option}
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
          <p className="mt-1 text-slate-600">¡Encontraste todas las palabras — completaste el {level.name.toLowerCase()}!</p>
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
