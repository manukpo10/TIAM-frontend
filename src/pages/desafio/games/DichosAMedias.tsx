import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Dichos a medias" — día 1 (mes 2), lenguaje. Completá el refrán/dicho
 * popular al que le falta la última palabra, eligiéndola entre 4 opciones —
 * nunca texto libre, tal como pide el brief para este batch.
 *
 * Mecánicamente es el motor de "Los opuestos" (LosOpuestos.tsx, día 14 del
 * mes 1) en su variante NO ilustrada: una tarjeta con el estímulo (acá, la
 * frase con el hueco) + una grilla de 4 opciones de solo texto; tocar una
 * incorrecta la elimina (gris, tachada, nunca roja) y deja retocar; tocar la
 * correcta resuelve la ronda y avanza. Se reutiliza esa variante tal cual
 * porque el estímulo es una frase larga, no una palabra sola fotografiable —
 * no hace falta ilustrar nada (todos los juegos de este batch son de
 * texto/palabra, ninguno necesita arte nuevo).
 *
 * El refranero es folclore de dominio público — no hay autoría ni copyright
 * sobre un dicho tradicional, así que el texto de cada refrán es el dicho
 * real tal como se conoce; las opciones-señuelo son nuestras. La obscuridad
 * escala con el nivel: nivel 1 son dichos de uso diario muy conocidos, nivel
 * 3 son más largos o menos frecuentes en el habla cotidiana (siguen siendo
 * dichos reales y verificados, ninguno inventado).
 *
 * TODOS los dichos de un nivel se juegan en cada pasada, sólo se baraja el
 * ORDEN (mismo criterio que LosOpuestos: `shuffle(level.rounds)` completo,
 * sin sub-muestreo tipo ROUNDS_PER_LEVEL) — 6 dichos por nivel, 18 en total.
 */

interface Round {
  before: string
  answer: string
  decoys: string[]
}
interface Level {
  n: number
  name: string
  rounds: Round[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: [
      { before: 'Más vale pájaro en mano que cien', answer: 'volando', decoys: ['cantando', 'corriendo', 'durmiendo'] },
      { before: 'Camarón que se duerme, se lo lleva la', answer: 'corriente', decoys: ['marea', 'ola', 'tormenta'] },
      { before: 'A caballo regalado, no se le mira el', answer: 'diente', decoys: ['pelo', 'ojo', 'casco'] },
      { before: 'En boca cerrada no entran', answer: 'moscas', decoys: ['hormigas', 'abejas', 'mosquitos'] },
      { before: 'Al mal tiempo, buena', answer: 'cara', decoys: ['suerte', 'actitud', 'onda'] },
      { before: 'Perro que ladra no', answer: 'muerde', decoys: ['corre', 'ataca', 'asusta'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: [
      { before: 'Cría cuervos y te sacarán los', answer: 'ojos', decoys: ['dientes', 'brazos', 'dedos'] },
      { before: 'No hay mal que por bien no', answer: 'venga', decoys: ['pase', 'llegue', 'dure'] },
      { before: 'Dime con quién andas y te diré quién', answer: 'eres', decoys: ['serás', 'fuiste', 'vives'] },
      { before: 'El que mucho abarca, poco', answer: 'aprieta', decoys: ['gana', 'tiene', 'alcanza'] },
      { before: 'A palabras necias, oídos', answer: 'sordos', decoys: ['cerrados', 'atentos', 'curiosos'] },
      { before: 'Ojos que no ven, corazón que no', answer: 'siente', decoys: ['sufre', 'llora', 'duele'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: [
      { before: 'Cuando el río suena, agua', answer: 'lleva', decoys: ['trae', 'tiene', 'corre'] },
      { before: 'No por mucho madrugar amanece más', answer: 'temprano', decoys: ['rápido', 'pronto', 'lindo'] },
      { before: 'Genio y figura, hasta la', answer: 'sepultura', decoys: ['muerte', 'vejez', 'tumba'] },
      { before: 'El que se fue a Sevilla, perdió su', answer: 'silla', decoys: ['casa', 'lugar', 'puesto'] },
      { before: 'Árbol que nace torcido, jamás su tronco', answer: 'endereza', decoys: ['mejora', 'arregla', 'cambia'] },
      { before: 'Más sabe el diablo por viejo que por', answer: 'diablo', decoys: ['sabio', 'malo', 'listo'] },
    ],
  },
]

// Total de dichos a través de los 3 niveles — cada ronda se resuelve tras el
// toque correcto (no hay forma de "rendirse"), así que totalAttempts =
// mistakes + esta constante.
const TOTAL_ROUNDS = LEVELS.reduce((sum, lvl) => sum + lvl.rounds.length, 0)

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

const HINTS = ['Esa no completa el dicho — probá con otra.', 'Casi. Pensá cómo sigue el dicho.', 'No es esa, ¡fijate de nuevo!']
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']

export function DichosAMedias({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Acumulado a través de los niveles 1→2→3, sólo se pone en cero en un
  // reinicio real del día (ver la rama isWrap de nextLevel más abajo).
  const [mistakes, setMistakes] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (round ? shuffle([round.answer, ...round.decoys]) : []), [round])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(word: string) {
    if (!round || solved || eliminated.has(word)) return
    if (word === round.answer) {
      setSolved(true)
      setHint(null)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
      }, 500)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(word))
      setHint(pickOne(HINTS))
    }
  }

  // Resets sincrónicos acá mismo, nunca en un efecto separado keyed on
  // [levelIdx, roundKey] — un reset por efecto llega un render tarde y el
  // onComplete de abajo leería `done` viejo justo al llegar al nivel 3 (misma
  // disciplina que LosOpuestos/QuePalabraSeEsconde).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
  }

  // Dispara una vez por roundKey cuando se resuelve el último dicho del
  // nivel 3. Un reinicio completo del día (wrap a nivel 1) trae un roundKey
  // nuevo, así que una repetición genuina vuelve a reportar.
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cómo termina el dicho?</h2>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {currentIndex} de {order.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(currentIndex / order.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Dicho con el hueco */}
          <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-center sm:mt-6">
            <p className="text-lg font-bold leading-snug text-slate-800 sm:text-xl">
              {round.before}{' '}
              <span
                aria-hidden="true"
                className="inline-block h-6 w-20 translate-y-1 rounded-md border-b-4 border-dashed border-tiam-blue/50 align-middle"
              />
              .
            </p>
          </div>

          {/* Opciones */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {options.map((word) => {
              const isEliminated = eliminated.has(word)
              const isSolved = solved && word === round.answer
              return (
                <button
                  key={word}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(word)}
                  className={[
                    'min-h-[64px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
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

          {hint && !solved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Completaste los {order.length} dichos — ¡terminaste el {level.name.toLowerCase()}!
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
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
