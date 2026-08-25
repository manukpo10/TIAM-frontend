import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Scale } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Puente de opuestos" — día 15, ejecutivas. Se muestran dos conceptos
 * opuestos (ej. Calor / Frío) y el jugador toca, entre 4 opciones, cuál es
 * el concepto INTERMEDIO que los mide o regula (ej. Termómetro). No alcanza
 * con pensar en el antónimo directo — hay que encontrar el tercer concepto
 * que se para "en el medio" de los dos.
 *
 * Ramp de dificultad por nivel (18 pares originales, 6 por nivel, se juegan
 * 2 por partida — igual criterio de pool que el resto del lote):
 *   Nivel 1: opuestos físicos concretos, el intermedio es un instrumento de
 *     medición literal (Calor/Frío → Termómetro, Rápido/Lento →
 *     Velocímetro) — la relación es casi automática.
 *   Nivel 2: opuestos de situaciones cotidianas, el intermedio ya no es un
 *     objeto sino una actividad o recurso que regula el paso de uno al otro
 *     (Trabajo/Descanso → Horario, Pobre/Rico → Dinero).
 *   Nivel 3: pares de opuestos más sutiles (rasgos, estados internos), el
 *     intermedio es un concepto abstracto, y varios decoys son sinónimos
 *     cercanos del correcto a propósito — obliga a pensar cuál de los
 *     parecidos es realmente el que "regula" el par, no solo el que suena
 *     bien (ej. Pasado/Futuro → Presente, con "Regalo" como decoy que juega
 *     con el otro significado de "presente" en español).
 *
 * Estilo de la casa: toque incorrecto elimina esa opción (gris, nunca rojo)
 * y da una pista para releer el par; la ronda queda abierta hasta acertar.
 * Sin timer. Pantalla "¿Listo?" única vez al principio del día.
 */

interface Puzzle {
  pair: [string, string]
  answer: string
  options: string[]
}
interface Level {
  n: number
  name: string
  rounds: number
  pool: Puzzle[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    pool: [
      { answer: 'TERMÓMETRO', pair: ['Calor', 'Frío'], options: ['TERMÓMETRO', 'ABRIGO', 'VENTILADOR', 'ESTUFA'] },
      { answer: 'VELOCÍMETRO', pair: ['Rápido', 'Lento'], options: ['VELOCÍMETRO', 'AUTO', 'CAMINO', 'MOTOR'] },
      { answer: 'BALANZA', pair: ['Pesado', 'Liviano'], options: ['BALANZA', 'CAJA', 'MOCHILA', 'CARGA'] },
      { answer: 'INDICADOR', pair: ['Lleno', 'Vacío'], options: ['INDICADOR', 'BOTELLA', 'VASO', 'TANQUE'] },
      { answer: 'REGLA', pair: ['Alto', 'Bajo'], options: ['REGLA', 'ESCALERA', 'TECHO', 'PISO'] },
      { answer: 'RELOJ', pair: ['Día', 'Noche'], options: ['RELOJ', 'SOL', 'LUNA', 'CALENDARIO'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    pool: [
      { answer: 'TRATADO', pair: ['Guerra', 'Paz'], options: ['TRATADO', 'EJÉRCITO', 'BANDERA', 'VICTORIA'] },
      { answer: 'DINERO', pair: ['Pobre', 'Rico'], options: ['DINERO', 'TRABAJO', 'SUERTE', 'HERENCIA'] },
      { answer: 'HORARIO', pair: ['Trabajo', 'Descanso'], options: ['HORARIO', 'RELOJ', 'CALENDARIO', 'AGENDA'] },
      { answer: 'CUIDADO', pair: ['Salud', 'Enfermedad'], options: ['CUIDADO', 'HOSPITAL', 'REMEDIO', 'DOCTOR'] },
      { answer: 'LIMPIEZA', pair: ['Orden', 'Desorden'], options: ['LIMPIEZA', 'ESCOBA', 'BASURA', 'ORGANIZACIÓN'] },
      { answer: 'COMIDA', pair: ['Hambre', 'Saciedad'], options: ['COMIDA', 'COCINA', 'PLATO', 'NUTRICIÓN'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    pool: [
      { answer: 'CONFIANZA', pair: ['Certeza', 'Duda'], options: ['CONFIANZA', 'SEGURIDAD', 'ESPERANZA', 'VERDAD'] },
      { answer: 'PRESENTE', pair: ['Pasado', 'Futuro'], options: ['PRESENTE', 'MOMENTO', 'REGALO', 'TIEMPO'] },
      { answer: 'COMUNIDAD', pair: ['Individual', 'Colectivo'], options: ['COMUNIDAD', 'FAMILIA', 'GRUPO', 'EQUIPO'] },
      { answer: 'VOLUMEN', pair: ['Silencio', 'Ruido'], options: ['VOLUMEN', 'SONIDO', 'MÚSICA', 'ALTAVOZ'] },
      { answer: 'RESPONSABILIDAD', pair: ['Libertad', 'Disciplina'], options: ['RESPONSABILIDAD', 'OBLIGACIÓN', 'REGLA', 'CONTROL'] },
      { answer: 'EQUILIBRIO', pair: ['Generosidad', 'Egoísmo'], options: ['EQUILIBRIO', 'BONDAD', 'JUSTICIA', 'ARMONÍA'] },
    ],
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
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const HINTS = [
  'Esa no es — pensá qué concepto se para justo en el medio de los dos.',
  'No es esa. Releé el par de opuestos con calma.',
  'Casi. Pensá qué palabra mide o regula el paso de uno al otro.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente puente!', '¡Así se piensa!', '¡Perfecto!']

export function PuenteDeOpuestos({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochOrder] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
  const level = LEVELS[levelIdx]
  const order = epochOrder[levelIdx]

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const puzzle = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (puzzle ? shuffle(puzzle.options) : []), [puzzle])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(word: string) {
    if (!puzzle || solved || eliminated.has(word)) return
    if (word === puzzle.answer) {
      setSolved(word)
      setHint(null)
      setCorrectCount((c) => c + 1)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(null)
      }, 650)
    } else {
      setEliminated((prev) => (prev.has(word) ? prev : new Set(prev).add(word)))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(null)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(null)
    setHint(null)
    setMistakes(0)
    setCorrectCount(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, correctCount])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(8, 145, 178, 0.1)', color: '#0891B2' }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <p className="mt-2 text-base font-semibold text-slate-500">
            Llevás {currentIndex} de {order.length}
          </p>
        )}
      </div>

      {/* Pantalla previa: única vez, al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Scale className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver dos conceptos opuestos. Tocá, entre las opciones, cuál es el concepto que está en el medio y los mide o regula.
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

      {phase === 'playing' && !done && puzzle && (
        <>
          {/* Par de opuestos */}
          <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-5">
            <span className="text-xl font-extrabold text-slate-800 sm:text-2xl">{puzzle.pair[0]}</span>
            <span className="text-lg font-bold text-slate-300">/</span>
            <span className="text-xl font-extrabold text-slate-800 sm:text-2xl">{puzzle.pair[1]}</span>
          </div>

          {/* Opciones */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {options.map((word) => {
              const isEliminated = eliminated.has(word)
              const isSolved = solved === word
              return (
                <button
                  key={word}
                  type="button"
                  disabled={solved !== null || isEliminated}
                  onClick={() => guess(word)}
                  className={[
                    'min-h-[48px] rounded-2xl border-2 px-3 py-2 text-base font-bold tracking-wide transition sm:text-lg',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {word}
                </button>
              )
            })}
          </div>

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
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
            Tendiste los {order.length} puentes — completaste el nivel {levelIdx + 1}.
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
