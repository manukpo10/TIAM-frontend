import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué objeto es?" — a riddle-to-image comprehension game.
 *
 * A short riddle stays visible throughout; 4 fully-illustrated options
 * (image only, no caption — a visible label would hand over the answer).
 * A wrong tap eliminates that option (muted grey, never red — a language
 * miss is emotionally close to the memory-lapse anxiety this audience
 * already carries) and nudges the player back to re-read the clue, rather
 * than resolving on the first miss like QueSera does — there's no hidden
 * information to progressively reveal here, so retrying only helps if it
 * sends attention back to the text.
 *
 * VARIAS rondas por nivel (mismo patrón que LosOpuestos/LaCancionDeTuJuventud):
 * cada nivel elige `rounds` adivinanzas distintas al azar de su pool (sin
 * repetir dentro del nivel) — cada tap correcto resuelve la ronda, nunca hay
 * "me rindo" acá, así que totalAttempts es mistakes + un total fijo de
 * rondas (igual que LosOpuestos). El pool de cada nivel ya alcanzaba para
 * 3/4/5 sin necesidad de contenido nuevo. 12 adivinanzas en total.
 */

const LABELS: Record<string, string> = {
  bicicleta: 'bicicleta',
  anteojos: 'anteojos',
  tijera: 'tijera',
  paraguas: 'paraguas',
  'reloj-pulsera': 'reloj de pulsera',
  mate: 'mate',
  billetera: 'billetera',
  celular: 'celular',
  llaves: 'llaves',
  cuaderno: 'cuaderno',
  libro: 'libro',
  diario: 'diario',
  lapicera: 'lapicera',
  'ovillo-lana': 'ovillo de lana',
  'agujas-tejer': 'agujas de tejer',
  boton: 'botón',
  florero: 'florero',
  maceta: 'maceta',
  portarretrato: 'portarretrato',
  vela: 'vela',
  'control-remoto': 'control remoto',
  lapiz: 'lápiz',
  termo: 'termo',
  taza: 'taza',
  vaso: 'vaso',
  banana: 'banana',
  tortuga: 'tortuga',
  pato: 'pato',
  guitarra: 'guitarra',
  mariposa: 'mariposa',
  rana: 'rana',
  zanahoria: 'zanahoria',
}

interface Riddle {
  text: string
  answer: string
  decoys: string[]
}
interface Level {
  n: number
  name: string
  rounds: number
  riddles: Riddle[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 3,
    riddles: [
      {
        text: 'Tiene dos ruedas, pedales y un manubrio; sirve para pasear.',
        answer: 'bicicleta',
        decoys: ['taza', 'banana', 'tortuga'],
      },
      {
        text: 'Tiene dos cristales redondos y dos patitas que se apoyan en las orejas; sirven para ver mejor.',
        answer: 'anteojos',
        decoys: ['banana', 'tortuga', 'pato'],
      },
      {
        text: 'Tiene dos filos que se cruzan en el medio y dos agujeros para los dedos; sirve para cortar.',
        answer: 'tijera',
        decoys: ['rana', 'pato', 'zanahoria'],
      },
      {
        text: 'Tiene varillas debajo de la tela y un mango curvo; lo abrís arriba tuyo cuando llueve.',
        answer: 'paraguas',
        decoys: ['banana', 'guitarra', 'mariposa'],
      },
      {
        text: 'Tiene números en redondo y una correa que se ata a la muñeca; te avisa la hora.',
        answer: 'reloj-pulsera',
        decoys: ['rana', 'sol', 'ovillo-lana'],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    riddles: [
      {
        text: 'Es de calabaza, tiene una bombilla de metal adentro, y se toma bien caliente y amargo.',
        answer: 'mate',
        decoys: ['taza', 'termo', 'vaso'],
      },
      {
        text: 'Se dobla al medio y adentro lleva la plata y las tarjetas; se guarda en el bolsillo.',
        answer: 'billetera',
        decoys: ['celular', 'llaves', 'reloj-pulsera'],
      },
      {
        text: 'Tiene muchas hojas en blanco, cosidas o anilladas, para escribir o anotar lo que necesites.',
        answer: 'cuaderno',
        decoys: ['libro', 'diario', 'lapicera'],
      },
      {
        text: 'Es una bola blanda de hilo enrollado; con dos agujas se convierte en una bufanda.',
        answer: 'ovillo-lana',
        decoys: ['agujas-tejer', 'boton', 'tijera'],
      },
      {
        text: 'Tiene forma de jarrón angosto, se llena de agua, y adentro se ponen flores recién cortadas.',
        answer: 'florero',
        decoys: ['maceta', 'portarretrato', 'vela'],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    riddles: [
      {
        text: 'No sirve para guardar tu plata ni para mandar mensajes: sin moverte del sillón, con este objeto cambiás lo que estás mirando o subís el volumen.',
        answer: 'control-remoto',
        decoys: ['celular', 'billetera', 'reloj-pulsera'],
      },
      {
        text: 'No hay que sacarle punta ni se borra lo que escribís: tiene tinta adentro y con ella firmás papeles importantes.',
        answer: 'lapicera',
        decoys: ['lapiz', 'cuaderno', 'diario'],
      },
      {
        text: 'Es alto y bien cerrado, no tiene bombilla ni asa para agarrar de costado: lo llenás con agua hirviendo a la mañana y sigue así de caliente horas después, lista para cebar.',
        answer: 'termo',
        decoys: ['mate', 'taza', 'vaso'],
      },
      {
        text: 'No se riega ni se le cambia el agua cada tanto: tiene un vidrio adelante que protege lo de atrás, y detrás del vidrio hay una foto de alguien querido, no flores ni tierra.',
        answer: 'portarretrato',
        decoys: ['florero', 'maceta', 'vela'],
      },
      {
        text: 'Es de vidrio transparente, no tiene asa para agarrar ni bombilla adentro, y no guarda el calor por horas como otros: lo llenás con agua o gaseosa y tomás directo, de un trago.',
        answer: 'vaso',
        decoys: ['taza', 'termo', 'mate'],
      },
      {
        text: 'Tiene muchas páginas ya impresas de fábrica con una sola historia o tema, para leer de principio a fin: no escribís vos adentro ni se renueva cada mañana con noticias nuevas.',
        answer: 'libro',
        decoys: ['diario', 'cuaderno', 'lapicera'],
      },
    ],
  },
]

// Cada ronda se resuelve con un único acierto (no hay "me rindo" acá — un tap
// incorrecto solo elimina esa opción y da una pista para releer el texto),
// así que totalAttempts = mistakes + esta suma.
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-objeto-es/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

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
  'Ese no es — volvé a leer la pista.',
  'No es ese, ¡fijate de nuevo en las pistas!',
  'Casi. Repasá la pista y probá otra vez.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']

export function QueObjetoEs({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` adivinanzas distintas del pool del nivel, al azar, recalculadas
  // una sola vez por nivel/roundKey (sin repetir dentro del nivel).
  const order = useMemo(
    () => shuffle(level.riddles).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const riddle = order[roundIdx]
  const done = roundIdx >= level.rounds

  const options = useMemo(() => (riddle ? shuffle([riddle.answer, ...riddle.decoys]) : []), [riddle])

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below) — same policy as
  // ElVuelto.
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(id: string) {
    if (!riddle || resolved || eliminated.has(id)) return
    if (id === riddle.answer) {
      setResolved(true)
      setHint(null)
      // Avanzá a la próxima ronda del nivel tras un breve feedback. Cuando
      // roundIdx llega a level.rounds, `done` pasa a true y se muestra la
      // pantalla de fin de nivel en vez de una adivinanza nueva.
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
        setHint(null)
      }, 900)
      return
    }
    setEliminated((prev) => new Set(prev).add(id))
    setHint(pickOne(HINTS))
    setMistakes((m) => m + 1)
  }

  // Reset sincrónico dentro de nextLevel()/replay() — nunca en un efecto
  // separado sobre [levelIdx, roundKey]: un efecto llega un render tarde,
  // así que `done`/`resolved` podrían leer stale-true justo cuando levelIdx
  // cambia y disparar onComplete con datos viejos/basura — el mismo bug ya
  // resuelto en ElVuelto/CuantosHay.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra ronda" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }

  // Fires once per roundKey when level 3's last riddle resolves.
  // totalAttempts = mistakes + TOTAL_ROUNDS: every round here resolves via a
  // genuine correct tap (no give-up path), so a flat per-round credit is
  // always accurate — same shape as LaCancionDeTuJuventud/LosOpuestos.
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
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
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

      {!done && riddle && (
        <>
          {/* Riddle text — stays visible throughout, re-reading is just glancing up */}
          <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-center">
            <p className="text-lg font-medium leading-relaxed text-slate-700">{riddle.text}</p>
          </div>

          {/* Options */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6">
            {options.map((id) => {
              const isEliminated = eliminated.has(id)
              const isAnswer = resolved && id === riddle.answer
              const img = imgFor(id)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(id)}
                  aria-label={LABELS[id] ?? id}
                  className={[
                    // Capped height instead of aspect-square: two columns on a
                    // phone made each tile ~150px tall, so the bottom row of
                    // options sat below the fold with nothing to hint it existed.
                    // object-contain keeps every illustration whole regardless.
                    'relative flex h-28 items-center justify-center rounded-2xl border-2 bg-white p-2 transition sm:h-36 sm:p-4',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isAnswer ? 'border-tiam-green ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 grayscale' : '',
                    !isAnswer && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Resolviste las {level.rounds} adivinanzas — completaste el nivel {levelIdx + 1}.
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
