import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Eye } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Buscá la distinta" — variante de LaIntrusa (misma mecánica de búsqueda
 * visual: grilla densa repite la MISMA palabra, una sola celda tiene una
 * palabra DIFERENTE, tocarla) con un pool de pares completamente nuevo, así
 * no repite el contenido de "La intrusa" (atención, día 18 de mes 2):
 *   L1 palabra totalmente distinta (se nota por la forma/largo solo)
 *   L2 mismo largo, una letra cambiada, cerca del principio o el final
 *   L3 palabra más larga, exactamente UNA letra cambiada, escondida en el
 *      medio (más difícil de notar — el ojo capta primero el principio y
 *      el final de una palabra)
 *
 * A diferencia de LaIntrusa, un solo intruso por ronda siempre — sin la
 * ronda final de doble intruso que tiene LaIntrusa. Un toque incorrecto solo
 * hace un wiggle suave (nunca gris permanente, nunca rojo) — apagar celdas
 * de a una mientras el jugador escanea se vería desprolijo y le achicaría el
 * área de búsqueda de arriba.
 *
 * Nivel 1 se queda liviano a propósito (16→20 celdas, 2 rondas) — es la
 * rampa de entrada, misma convención que el resto del catálogo. Nivel 2 y 3
 * eran DEMASIADO livianos (30 celdas, 2 rondas cada uno) — encontrar una
 * palabra distinta entre sólo 30 no exige un escaneo real. Subidos a 45
 * celdas (mismo ancho de columna, más filas — el ancho de celda lo define
 * `grid-cols-N`, no el total de celdas) y 3 rondas, preservando la decisión
 * original de que nivel 2 y 3 compartan densidad de grilla y que la
 * dificultad de nivel 3 salga del PAR de palabras (más larga, letra
 * escondida en el medio), no de la grilla.
 */

interface WordPair {
  base: string
  intruder: string
}

const L1_PAIRS: WordPair[] = [
  { base: 'PERRO', intruder: 'VENTANA' },
  { base: 'LUNA', intruder: 'JARDIN' },
  { base: 'RELOJ', intruder: 'ALMOHADA' },
  { base: 'TIJERA', intruder: 'BOTELLA' },
  { base: 'SILLA', intruder: 'PARAGUAS' },
  { base: 'TAZA', intruder: 'ESCALERA' },
]
const L2_PAIRS: WordPair[] = [
  { base: 'PERA', intruder: 'PENA' },
  { base: 'LOBO', intruder: 'LOMO' },
  { base: 'GATO', intruder: 'GAJO' },
  { base: 'DEDO', intruder: 'DADO' },
  { base: 'MESA', intruder: 'MASA' },
  { base: 'CASA', intruder: 'CAJA' },
]
const L3_PAIRS: WordPair[] = [
  { base: 'CORTINA', intruder: 'CORTENA' },
  { base: 'SOMBRERO', intruder: 'SOMBRARO' },
  { base: 'ESCALERA', intruder: 'ESCARERA' },
  { base: 'MARIPOSA', intruder: 'MARIBOSA' },
  { base: 'VENTANA', intruder: 'VENTONA' },
  { base: 'ALMOHADA', intruder: 'ALMEHADA' },
]

interface Level {
  n: number
  name: string
  instruction: string
  rounds: number
  pool: WordPair[]
  cells: number
  boardClass: string
  textClass: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    instruction: 'Una palabra es distinta a todas las demás.',
    rounds: 2,
    pool: L1_PAIRS,
    cells: 20,
    boardClass: 'grid-cols-4 gap-2 sm:gap-3',
    textClass: 'text-base sm:text-lg',
  },
  {
    n: 2,
    name: 'Nivel 2',
    instruction: 'Esta vez las palabras se parecen mucho — ¡prestá atención!',
    rounds: 3,
    pool: L2_PAIRS,
    cells: 45,
    boardClass: 'grid-cols-5 gap-1.5 sm:gap-2.5',
    textClass: 'text-sm sm:text-base',
  },
  {
    n: 3,
    name: 'Nivel 3',
    instruction: 'La diferencia puede estar escondida en el medio de la palabra.',
    rounds: 3,
    pool: L3_PAIRS,
    // Mismas celdas/columnas que nivel 2 a propósito — el ANCHO de celda lo
    // define la cantidad de columnas, no la cantidad total de celdas, así
    // que una grilla más densa se vería apretada aunque tenga menos celdas.
    // La dificultad del nivel 3 sale del par de palabras, no de la grilla.
    cells: 45,
    boardClass: 'grid-cols-5 gap-1.5 sm:gap-2.5',
    textClass: 'text-sm sm:text-base',
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

interface Round {
  pair: WordPair
  intruderIdx: number
  cells: string[]
}

function buildRounds(level: Level): Round[] {
  const pairs = pick(level.pool, level.rounds)
  return pairs.map((pair) => {
    const intruderIdx = Math.floor(Math.random() * level.cells)
    const cells = Array.from({ length: level.cells }, (_, idx) => (idx === intruderIdx ? pair.intruder : pair.base))
    return { pair, intruderIdx, cells }
  })
}

const PRAISE = ['¡Muy bien!', '¡Qué buen ojo!', '¡Así se hace!', '¡Perfecto!', '¡Excelente atención!']

export function BuscaLaDistinta({ day: _day, onComplete }: GameProps) {
  // Pantalla previa de una sola vez para todo el día — nunca vuelve a
  // 'ready' al avanzar de nivel o repetir.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Rondas armadas (par + posición de la intrusa) para CADA nivel a la vez,
  // decididas una vez por epoch (una pasada completa 1→2→3), al montar y de
  // nuevo en "Hacer otro" — nunca vueltas a sortear por revisitar un nivel,
  // así "Repetir" devuelve exactamente las mismas rondas.
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => buildRounds(lvl)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds

  // true entre el toque correcto y el avance de ronda (pausa breve para que
  // se vea el hallazgo antes de pasar a la próxima).
  const [solved, setSolved] = useState(false)
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Errores, acumulados a través de niveles 1→2→3 y solo puestos en cero en
  // un reinicio real del día (vuelta de nivel 3 a nivel 1).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
  }, [done])

  function handleTap(idx: number) {
    if (!round || solved) return
    if (idx === round.intruderIdx) {
      setSolved(true)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setSolved(false)
      }, 700)
      return
    }
    setWrongIdx(idx)
    setMistakes((m) => m + 1)
    window.setTimeout(() => setWrongIdx((w) => (w === idx ? null : w)), 500)
  }

  // "Siguiente nivel" — avanza dentro de la MISMA epoch, solo se llama
  // mientras levelIdx < LEVELS.length - 1; epochRounds queda intacto.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setSolved(false)
    setWrongIdx(null)
  }

  // Compartida por los dos botones de la tarjeta final. roundKey siempre
  // avanza acá: es el contador de "qué intento es este" que usa el efecto
  // de onComplete para volver a dispararse en una repetición.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setSolved(false)
    setWrongIdx(null)
    setMistakes(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => buildRounds(lvl)))
  }

  // totalAttempts = errores acumulados + un acierto por ronda en cada nivel
  // jugado (mismo criterio que LaIntrusa).
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
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá la palabra distinta</h2>
        {phase === 'playing' && !done && (
          <>
            <p className="mt-1 text-base font-semibold text-slate-500">{level.instruction}</p>
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

      {/* Pantalla previa: única vez, al principio del día */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Eye className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver la misma palabra repetida muchas veces. Una sola es diferente — encontrala y tocala.
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

      {/* Board */}
      {phase === 'playing' && !done && round && (
        <div className={`mx-auto mt-5 grid max-w-lg ${level.boardClass}`}>
          {round.cells.map((word, i) => {
            const isFoundCell = solved && i === round.intruderIdx
            const isWrong = wrongIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleTap(i)}
                disabled={solved}
                aria-label={`palabra ${word}`}
                className={[
                  'relative flex min-h-[44px] items-center justify-center rounded-xl border-2 bg-white px-1 py-2 font-bold uppercase tracking-wide text-slate-700 transition sm:min-h-[48px]',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  level.textClass,
                  isFoundCell
                    ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                    : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  // El wiggle solo marca un toque incorrecto — nunca un
                  // borde rojo, misma convención que LaIntrusa.
                  isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300' : '',
                ].join(' ')}
              >
                {word}
              </button>
            )
          })}
        </div>
      )}

      {/* Wrong-tap hint */}
      {phase === 'playing' && !done && wrongIdx !== null && (
        <p className="mt-4 text-center text-base font-medium text-slate-500">Esa es igual a las demás, ¡probá otra! 🙂</p>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">¡Encontraste la palabra distinta — completaste el {level.name.toLowerCase()}!</p>
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
