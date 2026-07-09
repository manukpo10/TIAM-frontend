import { useMemo, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

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
  sol: 'sol',
  corazon: 'corazón',
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
  riddles: Riddle[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    riddles: [
      {
        text: 'Tiene dos ruedas, pedales y un manubrio; sirve para pasear.',
        answer: 'bicicleta',
        decoys: ['taza', 'sol', 'corazon'],
      },
      {
        text: 'Tiene dos cristales redondos y dos patitas que se apoyan en las orejas; sirven para ver mejor.',
        answer: 'anteojos',
        decoys: ['banana', 'tortuga', 'corazon'],
      },
      {
        text: 'Tiene dos filos que se cruzan en el medio y dos agujeros para los dedos; sirve para cortar.',
        answer: 'tijera',
        decoys: ['sol', 'pato', 'zanahoria'],
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
    riddles: [
      {
        text: 'No es el teléfono ni la billetera: sin moverte del sillón, con este objeto cambiás lo que estás mirando o subís el volumen.',
        answer: 'control-remoto',
        decoys: ['celular', 'billetera', 'reloj-pulsera'],
      },
      {
        text: 'No hay que sacarle punta ni se borra lo que escribís: tiene tinta adentro y con ella firmás papeles importantes.',
        answer: 'lapicera',
        decoys: ['lapiz', 'cuaderno', 'diario'],
      },
      {
        text: 'No es un vaso ni una taza: es alto y cerrado, lo llenás con agua bien caliente a la mañana y la mantiene así por horas para cebar más tarde.',
        answer: 'termo',
        decoys: ['mate', 'taza', 'vaso'],
      },
      {
        text: 'No se riega como una planta ni se llena de agua como un florero: tiene un vidrio adelante y, detrás, la foto de alguien querido.',
        answer: 'portarretrato',
        decoys: ['florero', 'maceta', 'vela'],
      },
    ],
  },
]

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

export function QueObjetoEs() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const riddle = useMemo(
    () => pickOne(level.riddles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const options = useMemo(() => shuffle([riddle.answer, ...riddle.decoys]), [riddle])

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])

  function guess(id: string) {
    if (resolved) return
    if (id === riddle.answer) {
      setPraise(pickOne(PRAISE))
      setResolved(true)
      setHint(null)
      return
    }
    setEliminated((prev) => new Set(prev).add(id))
    setHint(pickOne(HINTS))
  }

  function nextLevel() {
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setRoundKey((k) => k + 1)
  }

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          Lenguaje · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué objeto es?</h2>
      </div>

      {/* Riddle text — stays visible throughout, re-reading is just glancing up */}
      <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-center">
        <p className="text-lg font-medium leading-relaxed text-slate-700">{riddle.text}</p>
      </div>

      {/* Options */}
      <div className="mt-6 grid grid-cols-2 gap-3">
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
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 bg-white p-4 transition',
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

      {/* Completion */}
      {resolved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Era {LABELS[riddle.answer]}.</p>
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
              Otra adivinanza
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
