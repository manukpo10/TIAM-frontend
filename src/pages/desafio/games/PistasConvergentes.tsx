import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Lightbulb } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Pistas convergentes" — día 7, ejecutivas. Se muestran 3 pistas cortas
 * (ej. "Reloj, Cuerda, Arena") y 4 opciones de palabra — el jugador toca
 * cuál palabra conecta las 3 pistas a la vez (ej. "Tiempo").
 *
 * DIFERENCIA CLAVE con DeduciLaPalabra.tsx (día 15): ahí se da una LISTA de
 * candidatas y pistas que las van descartando una por una (proceso de
 * eliminación). Acá NO hay lista previa — es asociación convergente
 * directa: las 3 pistas apuntan juntas a UN solo concepto, y el jugador
 * elige ese concepto entre 4 opciones fijas que nunca se muestran como
 * "candidatas a descartar".
 *
 * 10 ternas originales por nivel (30 en total) para que "Hacer otro" tenga
 * variedad real — de las 10 solo se juegan 2 por partida, igual que el pool
 * de puzzles de DeduciLaPalabra. Nivel 1 es asociación directa y concreta;
 * nivel 2 baja un escalón de literalidad (situaciones, no objetos sueltos);
 * nivel 3 es metafórico/abstracto — la conexión ya no es "estos 3 objetos
 * son de tal cosa" sino "estos 3 conceptos son ejemplos de tal IDEA".
 * Ninguna opción de ninguna terna repite una palabra que ya apareció como
 * pista en esa misma terna (evita el spoiler "una opción es literalmente
 * una de las pistas").
 *
 * Estilo de la casa: toque incorrecto elimina esa opción (gris, nunca rojo)
 * y da una pista para releer las 3 claves — nunca termina en fallo duro, la
 * ronda queda abierta hasta acertar. Sin timer. Pantalla "¿Listo?" única
 * vez al principio del día.
 */

interface Puzzle {
  clues: [string, string, string]
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
      { answer: 'TIEMPO', clues: ['Reloj', 'Cuerda', 'Arena'], options: ['TIEMPO', 'HORA', 'EDAD', 'VELOCIDAD'] },
      { answer: 'PERRO', clues: ['Ladrido', 'Correa', 'Hueso'], options: ['PERRO', 'GATO', 'CABALLO', 'PÁJARO'] },
      { answer: 'FESTEJO', clues: ['Vela', 'Torta', 'Cumpleaños'], options: ['FESTEJO', 'REGALO', 'SORPRESA', 'INVITADOS'] },
      { answer: 'PLAYA', clues: ['Sol', 'Arena', 'Mar'], options: ['PLAYA', 'PILETA', 'PARQUE', 'MONTAÑA'] },
      { answer: 'COSTURA', clues: ['Aguja', 'Hilo', 'Botón'], options: ['COSTURA', 'TEJIDO', 'BORDADO', 'ROPA'] },
      { answer: 'BAÑO', clues: ['Espuma', 'Jabón', 'Toalla'], options: ['BAÑO', 'COCINA', 'LAVADERO', 'DORMITORIO'] },
      { answer: 'ESCUELA', clues: ['Pizarrón', 'Tiza', 'Recreo'], options: ['ESCUELA', 'MUSEO', 'HOSPITAL', 'OFICINA'] },
      { answer: 'AUTO', clues: ['Semáforo', 'Volante', 'Bocina'], options: ['AUTO', 'BICICLETA', 'AVIÓN', 'BARCO'] },
      { answer: 'LIBRO', clues: ['Página', 'Tapa', 'Biblioteca'], options: ['LIBRO', 'REVISTA', 'CUADERNO', 'DIARIO'] },
      { answer: 'TORMENTA', clues: ['Nubes', 'Rayo', 'Paraguas'], options: ['TORMENTA', 'LLUVIA', 'VIENTO', 'GRANIZO'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    pool: [
      { answer: 'REY', clues: ['Corona', 'Trono', 'Reino'], options: ['REY', 'PRÍNCIPE', 'CASTILLO', 'GUERRERO'] },
      { answer: 'COCINA', clues: ['Receta', 'Horno', 'Delantal'], options: ['COCINA', 'COCINERO', 'COMEDOR', 'RESTAURANTE'] },
      { answer: 'EXCURSIÓN', clues: ['Brújula', 'Mapa', 'Sendero'], options: ['EXCURSIÓN', 'AVENTURA', 'MONTAÑA', 'CAMPAMENTO'] },
      { answer: 'ORQUESTA', clues: ['Partitura', 'Batuta', 'Escenario'], options: ['ORQUESTA', 'CANTANTE', 'TEATRO', 'BAILE'] },
      { answer: 'CASAMIENTO', clues: ['Anillo', 'Ramo', 'Altar'], options: ['CASAMIENTO', 'NOVIA', 'FIESTA', 'IGLESIA'] },
      { answer: 'GRIPE', clues: ['Termómetro', 'Jarabe', 'Reposo'], options: ['GRIPE', 'DOCTOR', 'FARMACIA', 'DOLOR'] },
      { answer: 'VIAJE', clues: ['Maleta', 'Pasaporte', 'Aeropuerto'], options: ['VIAJE', 'TURISTA', 'HOTEL', 'VACACIONES'] },
      { answer: 'CULTIVO', clues: ['Semilla', 'Riego', 'Cosecha'], options: ['CULTIVO', 'JARDÍN', 'GRANJA', 'AGRICULTOR'] },
      { answer: 'PELUQUERÍA', clues: ['Espejo', 'Peine', 'Tijera'], options: ['PELUQUERÍA', 'BARBERO', 'SALÓN', 'CORTE'] },
      { answer: 'NEGOCIO', clues: ['Balanza', 'Mostrador', 'Vidriera'], options: ['NEGOCIO', 'VENDEDOR', 'PRECIO', 'MERCADO'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    pool: [
      { answer: 'ESFUERZO', clues: ['Semilla', 'Paciencia', 'Cosecha'], options: ['ESFUERZO', 'TIEMPO', 'SUERTE', 'CONSTANCIA'] },
      { answer: 'UNIÓN', clues: ['Puente', 'Abrazo', 'Idioma'], options: ['UNIÓN', 'COMUNICACIÓN', 'AMISTAD', 'DISTANCIA'] },
      { answer: 'REFLEJO', clues: ['Espejo', 'Eco', 'Sombra'], options: ['REFLEJO', 'IMAGEN', 'REPETICIÓN', 'LUZ'] },
      { answer: 'RUMBO', clues: ['Brújula', 'Norte', 'Meta'], options: ['RUMBO', 'DESTINO', 'VIAJE', 'ORIENTACIÓN'] },
      { answer: 'BASE', clues: ['Ancla', 'Raíz', 'Cimiento'], options: ['BASE', 'ORIGEN', 'SOSTÉN', 'FUNDACIÓN'] },
      { answer: 'GUÍA', clues: ['Vela', 'Faro', 'Estrella'], options: ['GUÍA', 'LUZ', 'CAMINO', 'SEÑAL'] },
      { answer: 'ACCESO', clues: ['Llave', 'Puerta', 'Secreto'], options: ['ACCESO', 'ENTRADA', 'MISTERIO', 'PERMISO'] },
      { answer: 'OCASO', clues: ['Otoño', 'Atardecer', 'Vejez'], options: ['OCASO', 'FINAL', 'DECLIVE', 'CAMBIO'] },
      { answer: 'JUSTICIA', clues: ['Balanza', 'Juez', 'Ley'], options: ['JUSTICIA', 'CASTIGO', 'VERDAD', 'TRIBUNAL'] },
      { answer: 'COOPERACIÓN', clues: ['Hormiga', 'Colmena', 'Equipo'], options: ['COOPERACIÓN', 'TRABAJO', 'ORGANIZACIÓN', 'COMUNIDAD'] },
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
  'Esa no conecta las 3 pistas a la vez — volvé a leerlas.',
  'No es esa. Pensá qué palabra tiene que ver con las 3 cosas juntas.',
  'Casi. Releé las pistas una por una antes de tocar otra opción.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente conexión!', '¡Así se piensa!', '¡Perfecto!']

export function PistasConvergentes({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Qué ternas del pool juegan en esta epoch (las 3 niveles) — decidido una
  // vez al montar y de nuevo solo en "Hacer otro", igual que DeduciLaPalabra.
  const [epochOrder, setEpochOrder] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
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
  function restartDifferent() {
    restartEpoch()
    setEpochOrder(LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
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
            <Lightbulb className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">Las 3 pistas apuntan a una sola palabra. Tocá, entre las opciones, cuál es.</p>
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
          {/* Pistas */}
          <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Lightbulb className="h-3.5 w-3.5" />
              Pistas
            </p>
            <ul className="mt-2 space-y-1.5">
              {puzzle.clues.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-base leading-snug text-slate-700">
                  <span className="mt-0.5 font-bold text-tiam-blue">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
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
                    'min-h-[48px] rounded-2xl border-2 px-3 py-2 text-lg font-bold tracking-wide transition sm:text-xl',
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
            Conectaste las {order.length} palabras — completaste el nivel {levelIdx + 1}.
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
