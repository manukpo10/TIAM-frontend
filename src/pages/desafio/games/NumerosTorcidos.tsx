import { useEffect, useRef, useState } from 'react'
import { RotateCw, RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Números torcidos" — día 6, agnosias. Un número aparece girado 180° o
 * espejado horizontalmente (nunca derecho) y el jugador toca, entre 4
 * opciones siempre derechas, cuál número es en realidad. Nunca escritura
 * libre — siempre opción múltiple, según el brief.
 *
 * Los dígitos se dibujan con un glifo de texto + transform CSS (sin SVG, sin
 * assets) — la forma más simple de garantizar una tipografía nítida y
 * on-brand, igual que cualquier otro número de la app.
 *
 * EL PAR DÍGITO/TRANSFORM ES FIJO, NO ALEATORIO, para descartar ambigüedad
 * visual real (esta audiencia no tolera un acertijo que a simple vista no
 * tiene una única respuesta correcta):
 *   - 0, 1 y 8 quedan afuera como TARGET — son casi perfectamente simétricos,
 *     así que "torcidos" se ven igual que derechos, no hay acertijo. (Sí se
 *     usan como opción DECOY derecha, donde la simetría no importa.)
 *   - 6 y 9 quedan afuera de rotate180 — girar uno cae EXACTO sobre el otro,
 *     lo que haría que la respuesta correcta se vea idéntica a una opción
 *     incorrecta. Quedan solo para mirror, donde ese choque no puede pasar
 *     (un 6 o un 9 espejado no es ningún dígito real).
 *   - Cada dígito restante (2,4,7 → rotate180; 3,5,6,9 → mirror) se revisó a
 *     mano contra los otros 9 dígitos buscando un choque de forma bajo su
 *     transform asignado. No se encontró ninguno.
 *
 * Se suma una inclinación extra al azar (0° en nivel 1, hasta ±18° en
 * nivel 2, hasta ±30° en nivel 3) sobre el transform base, así un mismo
 * dígito se ve distinto cada vez que sale y los niveles altos piden mirar
 * con más cuidado — sin que eso cambie nunca qué dígito es en realidad.
 *
 * Estilo de la casa: un toque incorrecto elimina esa opción (gris apagado,
 * nunca rojo) y da un empujoncito para mirar de nuevo; la ronda sigue
 * abierta hasta tocar la correcta. Sin timer. Pantalla "¿Listo?" única vez,
 * según la regla dura de este lote.
 */

type Transform = 'rotate180' | 'mirror'

const DIGIT_TRANSFORM: Record<string, Transform> = {
  '2': 'rotate180',
  '4': 'rotate180',
  '7': 'rotate180',
  '3': 'mirror',
  '5': 'mirror',
  '6': 'mirror',
  '9': 'mirror',
}
const TARGET_DIGITS = Object.keys(DIGIT_TRANSFORM)
const DECOY_POOL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
// Pareja "se podrían confundir a simple vista", usada para sesgar un decoy
// de nivel 3 y que el conjunto de opciones no se resuelva solo por forma —
// mismo propósito que el mapa SIBLING de EsEstaSombra.tsx.
const NEIGHBOR: Record<string, string> = { '2': '7', '7': '2', '3': '8', '8': '3', '5': '6', '6': '5', '9': '4', '4': '9', '0': '8', '1': '7' }

interface Level {
  n: number
  name: string
  rounds: number
  jitter: number // inclinación extra máxima, en grados, sobre el transform base
  biasNeighbor: boolean
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, jitter: 0, biasNeighbor: false },
  { n: 2, name: 'Nivel 2', rounds: 2, jitter: 18, biasNeighbor: false },
  { n: 3, name: 'Nivel 3', rounds: 2, jitter: 30, biasNeighbor: true },
]
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)
const ACCENT = '#0D9488' // teal

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
  digit: string
  transform: Transform
  tilt: number
  optionDigits: string[]
}
function makeRound(level: Level): Round {
  const digit = pickOne(TARGET_DIGITS)
  const transform = DIGIT_TRANSFORM[digit]
  const tilt = Math.round((Math.random() * 2 - 1) * level.jitter)
  const rest = DECOY_POOL.filter((d) => d !== digit)
  let decoys: string[]
  if (level.biasNeighbor) {
    const neighbor = NEIGHBOR[digit]
    const others = shuffle(rest.filter((d) => d !== neighbor))
    decoys = [neighbor, ...others].slice(0, 3)
  } else {
    decoys = shuffle(rest).slice(0, 3)
  }
  return { digit, transform, tilt, optionDigits: shuffle([digit, ...decoys]) }
}

function transformStyle(transform: Transform, tilt: number): string {
  return transform === 'rotate180' ? `rotate(${180 + tilt}deg)` : `scaleX(-1) rotate(${tilt}deg)`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!']
const HINTS = ['Ese no es — imaginate el número girado en tu cabeza.', 'Casi. Probá imaginarlo derecho, sin vuelta.', 'No es ese — mirá con calma la forma del número.']

export function NumerosTorcidos({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Rondas de todo el epoch (los 3 niveles), decididas una vez — al montar y
  // de nuevo solo en "Hacer otro" — nunca se re-generan por revisitar un
  // nivel, así "Repetir" devuelve exactamente las mismas rondas.
  const [epochRounds, setEpochRounds] = useState(() =>
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
  // Acumulado a través de los 3 niveles; solo se pone en cero en un reinicio
  // real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(digit: string) {
    if (!round || resolved || eliminated.has(digit)) return
    if (digit === round.digit) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 700)
      return
    }
    setEliminated((prev) => new Set(prev).add(digit))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets sincrónicos acá mismo, junto con el cambio de nivel/ronda — nunca
  // en un efecto separado (ver EsEstaSombra.tsx para el porqué).
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
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => Array.from({ length: lvl.rounds }, () => makeRound(lvl))))
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
          style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué número es en realidad?</h2>
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
            El número grande está dado vuelta o espejado. Tocá, entre las opciones derechas, cuál es de verdad.
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
          {/* Número torcido */}
          <div className="mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-slate-100 bg-white sm:mt-6 sm:h-32 sm:w-32">
            <span
              className="text-6xl font-extrabold text-slate-800 sm:text-7xl"
              style={{ display: 'inline-block', transform: transformStyle(round.transform, round.tilt) }}
            >
              {round.digit}
            </span>
          </div>

          {/* Opciones: siempre derechas, sin transformar */}
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-4 gap-2.5 sm:mt-6">
            {round.optionDigits.map((digit) => {
              const isEliminated = eliminated.has(digit)
              const isCorrectShown = resolved && digit === round.digit
              return (
                <button
                  key={digit}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(digit)}
                  aria-label={`Número ${digit}`}
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
                  {digit}
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
            ¡Encontraste los {level.rounds} números — completaste el {level.name.toLowerCase()}!
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
