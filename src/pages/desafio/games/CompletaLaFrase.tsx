import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, PenLine } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Completá la frase" — día 18 (mes 3), lenguaje. Reemplaza a BuscaLaDistinta
 * (atención) — pedido explícito del usuario a partir de una hoja de
 * ecognitiva.com ("complete las siguientes oraciones", renglones para
 * escribir a mano). Se pidió expresamente que quede DIGITAL, no de papel
 * como día14 — acá no hay problema de validación abierta (a diferencia de
 * "palabras que empiecen con X"), porque cada oración tiene una única
 * respuesta correcta conocida de antemano, así que sí admite una mecánica
 * de juego real. Oraciones propias, distintas a las de la hoja de
 * referencia (que usaba sopa/cuchara, frío/abrigo, etc.).
 *
 * Mecánica: cada ronda muestra 2-3 oraciones con un espacio en blanco y un
 * banco compartido de palabras sueltas — tocá una palabra del banco y
 * después la oración donde creés que va; se auto-valida contra la
 * respuesta EXACTA de esa oración (nunca alcanza con que la palabra
 * "suene bien" en cualquier lugar). Mismo patrón select-then-place que
 * CrucigramaDeCifras (banco + objetivos), adaptado a texto en vez de
 * cifras. Nunca rojo: un intento que no encaja deja un empujoncito suave y
 * no borra nada de lo ya completado.
 *
 * A diferencia de CrucigramaDeCifras (cifras generadas al azar sobre una
 * forma fija), acá TODO el contenido de cada ronda está autorado a mano —
 * no hay nada que generar proceduralmente en una oración con sentido — así
 * que cada nivel es una lista fija de rondas (`rounds`), no un pool del que
 * se recorta un subconjunto al azar; sólo el ORDEN de las rondas y el orden
 * de las palabras dentro del banco se barajan por época/ronda.
 *
 * Ramp de dificultad (2 rondas por nivel, igual criterio que el resto del
 * catálogo):
 *   Nivel 1: 2 oraciones por ronda, banco SIN señuelos — el banco tiene
 *     exactamente las 2 respuestas correctas, así que el desafío es sólo
 *     "cuál va en cuál", casi automático con oraciones tan directas.
 *   Nivel 2: 2 oraciones por ronda + 1 señuelo (una palabra real, de
 *     categoría claramente distinta, que no completa ninguna de las dos
 *     oraciones de esa ronda) — "más opciones para filtrar", mismo ramp que
 *     ElGranObservador/PuenteDeOpuestos.
 *   Nivel 3: 3 oraciones por ronda + 2 señuelos "casi correctos" —
 *     palabras de la MISMA categoría semántica que una respuesta real pero
 *     equivocadas para esa oración puntual (ej. "carnicería" como señuelo
 *     de "verdulería" — ambos son comercios, pero uno vende fruta y el
 *     otro no) — obliga a leer la oración con atención, no alcanza con
 *     reconocer la categoría general. Mismo criterio de señuelo que
 *     PuenteDeOpuestos nivel 3. Verificado por script que ningún señuelo
 *     coincide con la respuesta de otra oración de la misma ronda (lo que
 *     dejaría dos respuestas válidas para el mismo espacio).
 */

interface SentenceBlank {
  id: string
  /** Oración completa con "___" marcando el espacio — se parte en render. */
  text: string
  answer: string
}
interface Round {
  blanks: SentenceBlank[]
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
      {
        blanks: [
          { id: 'r1-a', text: 'Para cortar el papel usamos una ___.', answer: 'TIJERA' },
          { id: 'r1-b', text: 'El sol sale por la ___.', answer: 'MAÑANA' },
        ],
        decoys: [],
      },
      {
        blanks: [
          { id: 'r2-a', text: 'Los pájaros vuelan por el ___.', answer: 'CIELO' },
          { id: 'r2-b', text: 'Para tomar la sopa usamos una ___.', answer: 'CUCHARA' },
        ],
        decoys: [],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: [
      {
        blanks: [
          { id: 'r1-a', text: 'Antes de cruzar la calle hay que mirar para los dos ___.', answer: 'LADOS' },
          { id: 'r1-b', text: 'Si el semáforo está en rojo, los autos deben ___.', answer: 'PARAR' },
        ],
        decoys: ['GUITARRA'],
      },
      {
        blanks: [
          { id: 'r2-a', text: 'Los alumnos van a la escuela para ___.', answer: 'APRENDER' },
          { id: 'r2-b', text: 'El médico atiende a sus pacientes en el ___.', answer: 'CONSULTORIO' },
        ],
        decoys: ['ELEFANTE'],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: [
      {
        blanks: [
          { id: 'r1-a', text: 'Compramos fruta y verdura en la ___.', answer: 'VERDULERÍA' },
          { id: 'r1-b', text: 'Usamos el paraguas cuando ___.', answer: 'LLUEVE' },
          { id: 'r1-c', text: 'Guardamos la comida fría en la ___.', answer: 'HELADERA' },
        ],
        decoys: ['CARNICERÍA', 'NIEVA'],
      },
      {
        blanks: [
          { id: 'r2-a', text: 'Para cepillarnos los dientes usamos un ___.', answer: 'CEPILLO' },
          { id: 'r2-b', text: 'El bombero apaga el ___.', answer: 'INCENDIO' },
          { id: 'r2-c', text: 'Antes de dormir nos ponemos el ___.', answer: 'PIJAMA' },
        ],
        decoys: ['PEINE', 'ABRIGO'],
      },
    ],
  },
]

// Ejemplo de la pantalla previa — no pertenece a ningún pool real.
const EXAMPLE = { text: 'El gato toma ___.', answer: 'LECHE' }

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

const PRAISE = ['¡Justo esa!', '¡Muy bien!', '¡Así se completa!', '¡Perfecto!']
const HINTS = [
  'Esa palabra no completa esa oración — releela con calma.',
  'Todavía no. Fijate bien qué dice la oración.',
  'Casi. Probá con otra palabra del banco.',
]

export function CompletaLaFrase({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Orden de las rondas de cada nivel, decidido una sola vez por época —
  // el CONTENIDO de cada ronda es fijo (ver cabecera), sólo el orden varía.
  const [epochRounds] = useState(() => LEVELS.map((lvl) => shuffle(lvl.rounds)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= rounds.length

  const [filled, setFilled] = useState<Record<string, string>>({}) // blankId -> answer
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Errores, acumulados a través de niveles 1→2→3, sólo en cero en un
  // reinicio real del día — mismo patrón que el resto del catálogo.
  const [mistakes, setMistakes] = useState(0)

  const roundDone = round ? Object.keys(filled).length >= round.blanks.length : false

  // Banco de esta ronda: respuestas + señuelos, barajado una vez por ronda.
  const bank = useMemo(
    () => (round ? shuffle([...round.blanks.map((b) => b.answer), ...round.decoys]) : []),
    [round],
  )

  function attemptPlace(blankId: string) {
    if (!round || !selectedWord || filled[blankId]) return
    const blank = round.blanks.find((b) => b.id === blankId)
    if (!blank) return
    if (blank.answer !== selectedWord) {
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
      return
    }
    setHint(null)
    setSelectedWord(null)
    const next = { ...filled, [blankId]: selectedWord }
    setFilled(next)
    // Ronda completa (con blanks recién llenado) — auto-avanza tras una
    // pausa breve para mostrar el elogio, sea o no la última ronda del
    // nivel: `roundIdx` simplemente cruza `rounds.length` y el render
    // decide solo qué tarjeta mostrar — mismo patrón que CrucigramaDeCifras.
    if (Object.keys(next).length >= round.blanks.length) {
      setPraise(pickOne(PRAISE))
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setFilled({})
        setSelectedWord(null)
        setHint(null)
      }, 1000)
    }
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setFilled({})
    setSelectedWord(null)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setFilled({})
    setSelectedWord(null)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }

  const totalBlanksAllLevels = LEVELS.reduce(
    (sum, lvl) => sum + lvl.rounds.reduce((s, r) => s + r.blanks.length, 0),
    0,
  )
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + totalBlanksAllLevels })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <p className="mt-2 text-base font-semibold text-slate-500">
            Ronda {roundIdx + 1} de {rounds.length}
          </p>
        )}
      </div>

      {/* Pantalla previa: única vez, con un ejemplo resuelto. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <PenLine className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver oraciones con un espacio en blanco. Tocá una palabra del banco de abajo y después la oración
            donde creas que va.
          </p>
          <div className="mx-auto mt-4 max-w-[280px] rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3 text-left">
            <p className="text-base text-slate-700">
              {EXAMPLE.text.split('___')[0]}
              <span className="font-extrabold uppercase text-tiam-blue">{EXAMPLE.answer}</span>
              {EXAMPLE.text.split('___')[1]}
            </p>
          </div>
          <p className="mt-2 text-sm text-slate-400">Por ejemplo: "el gato toma" ¿qué? Leche.</p>
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
          {/* Oraciones de la ronda */}
          <div className="mt-4 space-y-2.5">
            {round.blanks.map((blank) => {
              const isFilled = !!filled[blank.id]
              const [before, after] = blank.text.split('___')
              return (
                <button
                  key={blank.id}
                  type="button"
                  disabled={isFilled || !selectedWord}
                  onClick={() => attemptPlace(blank.id)}
                  className={[
                    'block w-full rounded-2xl border-2 px-4 py-3 text-left text-base leading-relaxed transition sm:text-lg',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isFilled
                      ? 'border-tiam-green bg-tiam-green/5'
                      : selectedWord
                        ? 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                        : 'border-slate-100 bg-slate-50',
                  ].join(' ')}
                >
                  <span className="text-slate-700">{before}</span>
                  {isFilled ? (
                    <span className="font-extrabold uppercase text-tiam-green">{filled[blank.id]}</span>
                  ) : (
                    <span className="font-bold text-slate-300">___</span>
                  )}
                  <span className="text-slate-700">{after}</span>
                </button>
              )
            })}
          </div>

          {/* Banco de palabras */}
          {!roundDone && (
            <>
              <p className="mt-4 text-center text-base font-semibold uppercase tracking-wide text-slate-400">
                Palabras
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                {bank.map((word) => {
                  const isUsed = Object.values(filled).includes(word)
                  return (
                    <button
                      key={word}
                      type="button"
                      disabled={isUsed}
                      onClick={() => setSelectedWord((prev) => (prev === word ? null : word))}
                      className={[
                        'min-h-[44px] rounded-xl border-2 px-4 py-2 text-base font-bold uppercase transition',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                        isUsed
                          ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                          : selectedWord === word
                            ? 'border-tiam-blue bg-tiam-blue/10 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                      ].join(' ')}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-center text-base font-medium text-slate-500">
                {hint ?? (selectedWord ? 'Ahora tocá la oración donde va.' : 'Tocá primero una palabra.')}
              </p>
            </>
          )}

          {roundDone && <p className="mt-5 text-center text-lg font-semibold text-tiam-green">{praise}</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Completaste las {rounds.length} rondas — terminaste el {level.name.toLowerCase()}.
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
