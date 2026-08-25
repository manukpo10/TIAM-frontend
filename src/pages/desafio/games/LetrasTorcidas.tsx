import { useEffect, useRef, useState } from 'react'
import { RotateCw, RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Letras torcidas" — día 14, agnosias. Misma mecánica que NumerosTorcidos.tsx
 * (día 6) pero con letras mayúsculas en vez de números: una letra aparece
 * girada 180° o espejada horizontalmente y el jugador toca, entre 4 opciones
 * siempre derechas, cuál letra es en realidad. Opción múltiple, nunca
 * escritura libre.
 *
 * EL POOL DE LETRAS ES CHICO Y A MANO, no las 27 del abecedario, por el
 * mismo motivo que el pool de dígitos del día 6 es de 7 y no de 10: hay
 * letras mucho más peligrosas que los dígitos para esto.
 *   - A, H, I, M, O, T, U, V, W, X, Ñ quedan afuera como TARGET — simétricas
 *     (H, I, O, X no cambian con ningún transform) o, peor, con un choque
 *     real: una M girada 180° cae casi exacto sobre una W, y viceversa.
 *   - N, S, Z quedan afuera de rotate180 — las tres tienen simetría de
 *     rotación de 180° (una N/S/Z girada se ve casi igual a sí misma, no
 *     hay acertijo). Sí sirven para mirror, donde espejadas se ven
 *     claramente distintas y no chocan con ninguna otra letra del pool.
 *   - Las 14 letras que quedan (A,D,F,K,U,Y → rotate180; B,C,E,L,N,R,S,Z →
 *     mirror) se revisaron a mano una por una para descartar que la versión
 *     torcida se pareciera a OTRA letra real del alfabeto.
 *
 * Mismo mecanismo de inclinación extra al azar que el día 6 (0°/±8°/±15°
 * por nivel) para que un mismo par letra+transform se sienta distinto en
 * cada repetición sin cambiar nunca qué letra es.
 *
 * Estilo de la casa: toque incorrecto = elimina esa opción (gris, nunca
 * rojo) + empujoncito, ronda siempre reintentable, sin timer. Pantalla
 * "¿Listo?" única vez.
 */

type Transform = 'rotate180' | 'mirror'

const LETTER_TRANSFORM: Record<string, Transform> = {
  A: 'rotate180',
  D: 'rotate180',
  F: 'rotate180',
  K: 'rotate180',
  U: 'rotate180',
  Y: 'rotate180',
  B: 'mirror',
  C: 'mirror',
  E: 'mirror',
  L: 'mirror',
  N: 'mirror',
  R: 'mirror',
  S: 'mirror',
  Z: 'mirror',
}
const TARGET_LETTERS = Object.keys(LETTER_TRANSFORM)
// Más amplio que el pool de targets: como decoy siempre se muestran derechas,
// la simetría/choque bajo transform no importa, así que suman letras extra
// para variar el aspecto de las opciones incorrectas.
const DECOY_POOL = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'Y', 'Z']
// Pareja "se podrían confundir a simple vista" para sesgar un decoy de nivel
// 3 — cubre las 14 letras del pool de targets, una vez cada una.
const NEIGHBOR: Record<string, string> = { B: 'D', D: 'B', E: 'F', F: 'E', K: 'R', R: 'K', S: 'Z', Z: 'S', C: 'L', L: 'C', A: 'Y', Y: 'A', N: 'U', U: 'N' }

interface Level {
  n: number
  name: string
  rounds: number
  jitter: number
  biasNeighbor: boolean
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, jitter: 0, biasNeighbor: false },
  { n: 2, name: 'Nivel 2', rounds: 2, jitter: 8, biasNeighbor: false },
  { n: 3, name: 'Nivel 3', rounds: 2, jitter: 15, biasNeighbor: true },
]
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
const ACCENT = '#9333EA' // violeta

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

interface Round {
  letter: string
  transform: Transform
  tilt: number
  optionLetters: string[]
}
function makeRound(level: Level): Round {
  const letter = pickOne(TARGET_LETTERS)
  const transform = LETTER_TRANSFORM[letter]
  const tilt = Math.round((Math.random() * 2 - 1) * level.jitter)
  const rest = DECOY_POOL.filter((l) => l !== letter)
  let decoys: string[]
  if (level.biasNeighbor) {
    const neighbor = NEIGHBOR[letter]
    const others = shuffle(rest.filter((l) => l !== neighbor))
    decoys = [neighbor, ...others].slice(0, 3)
  } else {
    decoys = shuffle(rest).slice(0, 3)
  }
  return { letter, transform, tilt, optionLetters: shuffle([letter, ...decoys]) }
}

function transformStyle(transform: Transform, tilt: number): string {
  return transform === 'rotate180' ? `rotate(${180 + tilt}deg)` : `scaleX(-1) rotate(${tilt}deg)`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!']
const HINTS = ['Esa no es — imaginate la letra girada en tu cabeza.', 'Casi. Probá imaginarla derecha, sin vuelta.', 'No es esa — mirá con calma la forma de la letra.']

export function LetrasTorcidas({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochRounds] = useState(() =>
    LEVELS.map((lvl) => Array.from({ length: lvl.rounds }, () => makeRound(lvl))),
  )
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(letter: string) {
    if (!round || resolved || eliminated.has(letter)) return
    if (letter === round.letter) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(letter))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué letra es en realidad?</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%`, backgroundColor: ACCENT }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <RotateCw className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            La letra grande está dada vuelta o espejada. Tocá, entre las opciones derechas, cuál es de verdad.
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

      {phase === 'playing' && !done && round && (
        <>
          {/* Letra torcida */}
          <div className="mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-slate-100 bg-white sm:mt-6 sm:h-32 sm:w-32">
            <span
              className="text-6xl font-extrabold text-slate-800 sm:text-7xl"
              style={{ display: 'inline-block', transform: transformStyle(round.transform, round.tilt) }}
            >
              {round.letter}
            </span>
          </div>

          {/* Opciones: siempre derechas, sin transformar */}
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-4 gap-2.5 sm:mt-6">
            {round.optionLetters.map((letter) => {
              const isEliminated = eliminated.has(letter)
              const isCorrectShown = resolved && letter === round.letter
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(letter)}
                  aria-label={`Letra ${letter}`}
                  className={[
                    'relative flex h-16 items-center justify-center rounded-2xl border-2 bg-white text-3xl font-extrabold transition sm:h-20 sm:text-4xl',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 text-slate-300 opacity-40'
                        : 'border-slate-200 text-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {letter}
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

      {/* Nivel completo */}
      {phase === 'playing' && done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste las {level.rounds} letras — completaste el {level.name.toLowerCase()}!
          </p>
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
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={restartSame}
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
