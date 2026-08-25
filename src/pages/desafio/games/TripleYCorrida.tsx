import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Repeat, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Triple y corrida" — día 3, cálculo. Dos reglas de cálculo independientes
 * que se ALTERNAN ronda por ronda: (a) dado un número, tocar su TRIPLE entre
 * 4 opciones; (b) dada una letra, tocar la letra que está N lugares después
 * en el abecedario (N variable, siempre mostrado explícitamente — nunca
 * "adiviná el patrón"). Con ROUNDS_PER_LEVEL=[2,2,2] cada nivel resuelve
 * exactamente 1 ronda de cada regla, en ese orden (triple primero, corrida
 * después) — alternancia perfecta sin depender del azar.
 *
 * Contenido PROCEDURAL, no un pool fijo a mano: el triple y el sucesor
 * alfabético son operaciones puramente aritméticas/de índice con un espacio
 * enorme de variantes válidas (a diferencia de los word-problems narrativos
 * de ElVuelto/ContadorMasMenos, que sí necesitan autoría). Mismo criterio que
 * MesaDeCartas/DesafioDeDeduccion: se genera primero la verdad (el número
 * base, o el índice de arranque + N) y las opciones se derivan de ahí — así
 * el resultado es correcto por construcción, nunca al revés.
 *
 * Abecedario español completo de 27 letras (incluye Ñ, el orden real que se
 * enseña en Argentina) — recortarlo a 26 sería acá sí un error de contenido,
 * ya que la consigna es literalmente "la letra que sigue en el abecedario".
 * El punto de partida siempre se sortea dejando lugar para los N pasos
 * completos hacia adelante, así nunca hace falta decidir qué pasa "después
 * de la Z".
 *
 * La dificultad sube con el tamaño de los números (triple) y con el valor de
 * N (corrida) en cada nivel — ver LEVEL_CONFIGS. Nunca rojo: un toque
 * equivocado elimina esa opción (gris, tachada) y deja un empujoncito suave;
 * la ronda avanza sola recién cuando se toca la opción correcta.
 */

type Round =
  | { kind: 'triple'; n: number; correct: number; options: number[] }
  | { kind: 'alfabeto'; letter: string; steps: number; correct: string; options: string[] }

interface LevelConfig {
  n: number
  name: string
  numberRange: [number, number]
  stepsOptions: number[]
}

const LEVEL_CONFIGS: LevelConfig[] = [
  { n: 1, name: 'Nivel 1', numberRange: [2, 9], stepsOptions: [1, 2] },
  { n: 2, name: 'Nivel 2', numberRange: [10, 30], stepsOptions: [2, 3, 4] },
  { n: 3, name: 'Nivel 3', numberRange: [21, 60], stepsOptions: [3, 4, 5] },
]

// Abecedario español "de toda la vida" (27 letras, incluye Ñ) — ver comentario arriba.
const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')

const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

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
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function fillNumberDecoys(correct: number, seeds: number[], need: number): number[] {
  const set = new Set<number>()
  for (const s of seeds) {
    if (s !== correct && s > 0) set.add(s)
  }
  let offset = 1
  while (set.size < need && offset < 40) {
    if (correct + offset !== correct) set.add(correct + offset)
    if (correct - offset > 0) set.add(correct - offset)
    offset++
  }
  return shuffle(Array.from(set)).slice(0, need)
}

function buildTripleRound(cfg: LevelConfig): Round {
  const n = randInt(cfg.numberRange[0], cfg.numberRange[1])
  const correct = n * 3
  // Errores típicos: duplicar en vez de triplicar, cuadriplicar, sumar en
  // vez de multiplicar, o pasarse/quedarse corto del triple real.
  const seeds = [n * 2, n * 4, n + 3, correct + 3, correct - 3]
  const options = shuffle([correct, ...fillNumberDecoys(correct, seeds, 3)])
  return { kind: 'triple', n, correct, options }
}

function buildAlfabetoRound(cfg: LevelConfig): Round {
  const steps = pickOne(cfg.stepsOptions)
  const maxStart = ALPHABET.length - 1 - steps
  const startIdx = randInt(0, maxStart)
  const letter = ALPHABET[startIdx]
  const correctIdx = startIdx + steps
  const correct = ALPHABET[correctIdx]
  // Errores típicos: un paso de más o de menos, o contar para atrás en vez
  // de para adelante. Nunca la letra de arranque (ya está a la vista arriba
  // como consigna, repetirla como opción confundiría).
  const seedIdxs = [correctIdx - 1, correctIdx + 1, startIdx - steps].filter(
    (i) => i >= 0 && i < ALPHABET.length && i !== correctIdx && i !== startIdx,
  )
  const decoySet = new Set<string>(seedIdxs.map((i) => ALPHABET[i]))
  let guard = 0
  while (decoySet.size < 3 && guard < 60) {
    const candidate = ALPHABET[randInt(0, ALPHABET.length - 1)]
    if (candidate !== correct && candidate !== letter) decoySet.add(candidate)
    guard++
  }
  const options = shuffle([correct, ...shuffle(Array.from(decoySet)).slice(0, 3)])
  return { kind: 'alfabeto', letter, steps, correct, options }
}

// Alternancia estricta dentro del nivel: índice par = triple, impar = corrida.
function buildLevelRounds(cfg: LevelConfig, count: number): Round[] {
  return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? buildTripleRound(cfg) : buildAlfabetoRound(cfg)))
}

const PRAISE_GOOD = ['¡Justo!', '¡Muy bien calculado!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Ese no es — volvé a calcular con calma.',
  'Casi. Probá con otra opción.',
  'No es esa — fijate bien la consigna de arriba.',
]
const LEVEL_PRAISE_GOOD = ['¡Excelente nivel!', '¡Muy bien!', '¡Qué bien calculás!']
const LEVEL_PRAISE_OK = ['¡Buen intento! Con la práctica sale cada vez mejor.', '¡Bien ahí! Seguí practicando.']

export function TripleYCorrida({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Rondas de la época completa (los 3 niveles), decididas una sola vez — al
  // montar — nunca vueltas a tirar por re-visitar
  // un nivel, así "Repetir" devuelve exactamente el mismo intento.
  const [epochRounds] = useState(() =>
    LEVEL_CONFIGS.map((cfg, i) => buildLevelRounds(cfg, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVEL_CONFIGS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= roundsForLevel

  // Derivados una sola vez por ronda: todas las opciones como string (así la
  // comparación y el render no necesitan repetir el chequeo de `kind` cada
  // vez) y el valor correcto, también como string.
  const optionValues: string[] = round ? round.options.map((o) => String(o)) : []
  const correctValue: string | null = round ? (round.kind === 'triple' ? String(round.correct) : round.correct) : null

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  const [correctCount, setCorrectCount] = useState(0)
  // Errores acumulados a través de niveles 1→2→3, sólo en cero en un
  // reinicio real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(correctCount / roundsForLevel >= 0.6 ? LEVEL_PRAISE_GOOD : LEVEL_PRAISE_OK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function guess(value: string) {
    if (!round || resolved || eliminated.has(value)) return
    if (value === correctValue) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 900)
    } else {
      setEliminated((prev) => new Set(prev).add(value))
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado (un efecto llega un render
  // tarde y el onComplete de abajo leería `done` viejo).

  // "Siguiente nivel" — avanza dentro de la MISMA época. epochRounds queda
  // intacto: las rondas del nivel i+1 ya se decidieron al empezar la época.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setCorrectCount(0)
  }

  // Se ejecuta con el botón "Repetir" en la tarjeta final del
  // último nivel (sólo se muestra ahí, así que siempre es un reinicio real
  // del día — mistakes se pone en cero). roundKey siempre
  // avanza acá: es el contador de "qué intento es este" que usa el efecto de
  // onComplete para dispararse otra vez en una repetición.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setCorrectCount(0)
    setMistakes(0)
  }
  // "Repetir" — mismas rondas del intento recién terminado.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVEL_CONFIGS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {roundsForLevel}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día — las dos reglas
          alternan sin previo aviso ronda a ronda, así que vale la pena
          explicarlo acá una vez en vez de repetirlo arriba cada vez. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Repeat className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Este juego alterna dos consignas: a veces te pido el TRIPLE de un número, a veces la letra que sigue en
            el abecedario. Fijate bien qué te pide cada ronda antes de tocar.
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
          {round.kind === 'triple' ? (
            <>
              <p className="mt-5 text-center text-lg font-semibold text-slate-700">Tocá el TRIPLE de este número</p>
              <div className="mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-slate-200 bg-white text-5xl font-black text-tiam-blue">
                {round.n}
              </div>
            </>
          ) : (
            <>
              <p className="mt-5 text-center text-lg font-semibold text-slate-700">
                Tocá la letra que está {round.steps} {round.steps === 1 ? 'lugar' : 'lugares'} después de esta en el
                abecedario
              </p>
              <div className="mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-slate-200 bg-white text-5xl font-black text-tiam-blue">
                {round.letter}
              </div>
            </>
          )}

          {/* Opciones */}
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3">
            {optionValues.map((value) => {
              const isEliminated = eliminated.has(value)
              const showAsCorrect = resolved && value === correctValue
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isEliminated || resolved}
                  onClick={() => guess(value)}
                  className={[
                    'min-h-[56px] rounded-2xl border-2 text-2xl font-extrabold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    showAsCorrect
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-700 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {value}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
          {resolved && <p className="mt-4 text-center text-base font-semibold text-tiam-green">{praise}</p>}
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
            Resolviste las {roundsForLevel} rondas — completaste el nivel {levelIdx + 1}.
          </p>
          {levelIdx < LEVEL_CONFIGS.length - 1 ? (
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
