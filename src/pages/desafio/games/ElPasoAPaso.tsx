import { useEffect, useRef, useState } from 'react'
import {
  RotateCcw,
  ArrowRight,
  Sparkles,
  Flame,
  Leaf,
  Droplets,
  Coffee,
  Sun,
  Shirt,
  Footprints,
  Key,
  Sparkles as CleanSparkle,
  Utensils,
  ShowerHead,
  AlarmClock,
  Bed,
  Moon,
  Pencil,
  Wallet,
  ShoppingCart,
  CreditCard,
  Backpack,
  Car,
  Stethoscope,
  Pill,
  Mail,
  MapPin,
  Tag,
  Send,
  Home,
  Droplet,
  Scissors,
  Package,
  Bus,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El paso a paso" — día 12 del Mes 2, praxias (secuenciación de una rutina
 * cotidiana). Reutiliza el hook compartido `useSequencingPuzzle` (el mismo
 * motor tap-to-order de OrdenarLaFrase/PlanificaLaManana, mes 1) en vez de
 * reinventar la mecánica: acá los "ítems" son pasos de una rutina (icono +
 * frase corta) en lugar de palabras o tareas de la mañana — mismo patrón de
 * "juegos chicos y enfocados" del resto del codebase antes que una
 * abstracción genérica.
 *
 * Sin distractor (a diferencia de OrdenarLaFrase/PlanificaLaManana): acá el
 * desafío es puramente el ORDEN, no detectar un intruso — más cerca del
 * pedido original ("ordená estos pasos") y más simple de seguir para una
 * rutina motriz concreta.
 *
 * Cada paso incluye una pista temporal explícita ("mientras", "ya", "recién
 * a partir de") para que el orden correcto sea siempre único y verificable
 * — mismo criterio que PlanificaLaManana usa para sus tareas (nunca un
 * empate de "a vos te parece" entre dos órdenes igual de razonables).
 *
 * Resultado sólo se revela con "Revisar" (no auto-avanza): cada paso es una
 * frase que hay que LEER, igual que en OrdenarLaFrase/PlanificaLaManana, así
 * que avanzar de ronda queda detrás de un botón explícito en vez de un
 * timeout — un timeout apuraría esa lectura, contra la regla de "sin
 * cronómetro" de esta app.
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" que ElVuelto/OrdenarLaFrase/PlanificaLaManana. Pasos por
 * rutina suben con el nivel (4 → 5 → 6), como pide el brief.
 */

interface Step {
  label: string
  Icon: LucideIcon
}
interface Routine {
  title: string
  steps: Step[]
}
interface Level {
  n: number
  name: string
  rounds: number
  routines: Routine[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    routines: [
      {
        title: 'Cebar unos mates',
        steps: [
          { label: 'Poner a calentar el agua en la pava.', Icon: Flame },
          { label: 'Colocar la yerba en el mate mientras el agua se calienta.', Icon: Leaf },
          { label: 'Cebar el mate con el agua ya caliente.', Icon: Droplets },
          { label: 'Tomar el primer mate.', Icon: Coffee },
        ],
      },
      {
        title: 'Vestirse para salir',
        steps: [
          { label: 'Levantarse de la cama apenas suena el despertador.', Icon: AlarmClock },
          { label: 'Ponerse la ropa que dejaste lista la noche anterior.', Icon: Shirt },
          { label: 'Ponerse los zapatos, ya vestido.', Icon: Footprints },
          { label: 'Salir de casa con las llaves en la mano.', Icon: Key },
        ],
      },
      {
        title: 'Lavarse las manos antes de comer',
        steps: [
          { label: 'Mojarse las manos con agua.', Icon: Droplets },
          { label: 'Poner jabón y frotar bien las manos mojadas.', Icon: Droplet },
          { label: 'Enjuagar el jabón con agua limpia.', Icon: Droplets },
          { label: 'Secarse las manos con la toalla, ya limpias.', Icon: CleanSparkle },
        ],
      },
      {
        title: 'Preparar un café instantáneo',
        steps: [
          { label: 'Calentar agua en la pava.', Icon: Flame },
          { label: 'Poner una cucharadita de café en la taza vacía.', Icon: Coffee },
          { label: 'Agregar el agua ya caliente en la taza.', Icon: Droplets },
          { label: 'Revolver con la cucharita antes de tomarlo.', Icon: Utensils },
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    routines: [
      {
        title: 'Ducharse',
        steps: [
          { label: 'Abrir la ducha y probar la temperatura del agua.', Icon: ShowerHead },
          { label: 'Mojarse todo el cuerpo bajo el agua.', Icon: Droplets },
          { label: 'Enjabonarse de pies a cabeza.', Icon: Droplet },
          { label: 'Enjuagar bien todo el jabón.', Icon: Droplets },
          { label: 'Cerrar la ducha y secarse con la toalla.', Icon: CleanSparkle },
        ],
      },
      {
        title: 'Prepararse para dormir',
        steps: [
          { label: 'Lavarse la cara y los dientes antes de acostarte.', Icon: Droplet },
          { label: 'Ponerse el pijama.', Icon: Shirt },
          { label: 'Programar el despertador para el día siguiente.', Icon: AlarmClock },
          { label: 'Acostarse en la cama.', Icon: Bed },
          { label: 'Apagar la luz de la mesita de luz.', Icon: Moon },
        ],
      },
      {
        title: 'Salir a hacer las compras',
        steps: [
          { label: 'Anotar en una lista lo que hace falta comprar.', Icon: Pencil },
          { label: 'Agarrar la billetera con el dinero.', Icon: Wallet },
          { label: 'Ir hasta el negocio más cercano.', Icon: Car },
          { label: 'Elegir los productos de la lista.', Icon: ShoppingCart },
          { label: 'Pagar en la caja y volver a casa.', Icon: CreditCard },
        ],
      },
      {
        title: 'Ir a control con el médico',
        steps: [
          { label: 'Sacar el turno por teléfono con unos días de anticipación.', Icon: AlarmClock },
          { label: 'Preparar los estudios y análisis que pidió la última vez.', Icon: Backpack },
          { label: 'Viajar hasta el consultorio el día del turno.', Icon: Car },
          { label: 'Contarle al médico cómo te sentiste este último tiempo.', Icon: Stethoscope },
          { label: 'Comprar en la farmacia los remedios que te recetó.', Icon: Pill },
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    routines: [
      {
        title: 'Escribir y mandar una carta',
        steps: [
          { label: 'Escribir la carta con lo que le querés contar.', Icon: Pencil },
          { label: 'Doblarla y meterla dentro del sobre.', Icon: Mail },
          { label: 'Anotar en el sobre la dirección de quien la recibe.', Icon: MapPin },
          { label: 'Pegarle la estampilla en la esquina de arriba.', Icon: Tag },
          { label: 'Llevar la carta hasta el correo.', Icon: Send },
          { label: 'Volver a tu casa tranquila, ya hecho el trámite.', Icon: Home },
        ],
      },
      {
        title: 'Cobrar la jubilación en el banco',
        steps: [
          { label: 'Fijarte en el calendario qué día del mes te toca cobrar.', Icon: AlarmClock },
          { label: 'Llevar el documento y la tarjeta antes de salir.', Icon: Wallet },
          { label: 'Viajar hasta la sucursal del banco.', Icon: Car },
          { label: 'Esperar tu turno hasta que te llamen.', Icon: Clock },
          { label: 'Cobrar el dinero en la caja.', Icon: CreditCard },
          { label: 'Volver a tu casa con el dinero guardado.', Icon: Home },
        ],
      },
      {
        title: 'Cuidar las plantas de la casa',
        steps: [
          { label: 'Llenar la regadera con agua limpia.', Icon: Droplet },
          { label: 'Fijarte cuáles plantas están secas y necesitan agua ya mismo.', Icon: Leaf },
          { label: 'Regar esas plantas con la regadera llena.', Icon: Droplets },
          { label: 'Cortar con la tijera las hojas secas o rotas.', Icon: Scissors },
          { label: 'Ubicar cada planta donde le dé bien la luz del sol.', Icon: Sun },
          { label: 'Guardar la regadera vacía hasta la próxima vez.', Icon: Package },
        ],
      },
      {
        title: 'Preparar la valija para un viaje corto',
        steps: [
          { label: 'Elegir la ropa que vas a llevar según los días de viaje.', Icon: Shirt },
          { label: 'Doblar la ropa y acomodarla dentro de la valija.', Icon: Backpack },
          { label: 'Guardar los remedios que tomás todos los días.', Icon: Pill },
          { label: 'Agregar el cargador del celular y las llaves de repuesto.', Icon: Key },
          { label: 'Cerrar bien la valija antes de salir.', Icon: Package },
          { label: 'Subir a la valija al colectivo o al auto.', Icon: Bus },
        ],
      },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Muy bien ordenado!', '¡Así se hace!', '¡Excelente!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo queda el orden correcto.',
  '¡Casi! Con la práctica te sale cada vez mejor.',
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

export function ElPasoAPaso({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` rutinas distintas por nivel para ESTA "epoch" (una pasada
  // completa de 3 niveles) — elegidas una sola vez por epoch, al montar,
  // nunca vueltas a tirar por "Repetir" ni por re-visitar un nivel a mitad
  // de epoch. Look-up plano (NO useMemo): un useMemo acá quedaría
  // invalidado igual porque levelIdx cicla 0→1→2→0 en cada restart, sin
  // importar roundKey.
  const [routineChoices] = useState(() => LEVELS.map((lvl) => shuffle(lvl.routines).slice(0, lvl.rounds)))
  const roundRoutines = routineChoices[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const routine = roundRoutines[roundIdx]
  const pool = routine.steps

  const { bank, placed, place, unplace } = useSequencingPuzzle(pool, `${levelIdx}-${roundKey}-${roundIdx}`)
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Acumulado a través de niveles 1→2→3 (y de cualquier repetición en el
  // mismo nivel — toda revisión cuenta), sólo en cero en un reinicio real
  // del día (ver restartEpoch). Mismo modelo que OrdenarLaFrase.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const isCorrect = bank.length === 0 && placed.every((item, i) => item.id === i)
  const readyToCheck = bank.length === 0
  // nivel 3 tiene rutinas de 6 pasos (vs. 4-5 en niveles 1-2) — con las 6
  // oraciones completas ya colocadas (banco vacío, justo antes de tocar
  // "Revisar") esto desbordaba 375×812 por 48px (medido en vivo). Achica
  // el padding/gap de las filas sólo en ese nivel.
  const tight = level.n === 3

  // True recién cuando se revisó la ÚLTIMA ronda del nivel — habilita la
  // pantalla de nivel completo (advanceLevel / restartSame) en vez del
  // botón de "siguiente ronda" común. Derivado de `checked` +
  // `roundIdx`, ambos reset sincrónicos más abajo — nunca desde un valor
  // puesto en cero dentro de un useEffect (ver el comentario de
  // restartEpoch() para el motivo).
  const done = checked && roundIdx >= level.rounds - 1

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    // Un paso fuera de su lugar correcto es un error, derivado del estado que
    // ya tiene el componente (igual que OrdenarLaFrase/PlanificaLaManana).
    const stepMistakes = placed.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + stepMistakes)
    setAccAttempts((a) => a + pool.length)
  }
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }
  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.

  // "Siguiente nivel" — avanza dentro del MISMO intento. routineChoices
  // queda intacto: las rutinas del nivel i+1 ya se decidieron al empezar
  // esta epoch.
  function advanceLevel() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
  }
  // Respalda el botón de reinicio "Repetir" en la tarjeta final de nivel
  // (sólo se muestra al completar el nivel 3, siempre un reinicio real del
  // día). roundKey siempre avanza acá: es el contador de "qué intento es
  // este" que usa el efecto de onComplete para dispararse otra vez en una
  // repetición.
  function restartEpoch() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  // "Repetir" — mismas rutinas que el intento recién terminado.
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Ordená los pasos: {routine.title}</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-600 transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día, no por ronda —
          saca la instrucción fija del header persistente (antes se repetía
          en cada ronda) para recuperar espacio vertical; nivel 3 apila hasta
          6 pasos a 375px de ancho. `phase` nunca vuelve a 'ready' — mismo
          patrón que Encaminada.tsx. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Footprints className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver los pasos de una rutina cotidiana, desordenados. Tocalos en el orden que creas correcto para
            armar la secuencia.
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

      {phase === 'playing' && !done && (
        <>
          {/* Secuencia en construcción — se oculta al revisar para que la
              tarjeta de Resultado no tenga que competir por espacio (acá los
              pasos son oraciones completas; varias filas empujan bastante
              hacia abajo). El listado "El orden correcto era" de esa tarjeta
              ya repite el orden completo cuando la respuesta está mal. */}
          {!checked && (
            <div
              className={
                tight
                  ? 'mt-3 min-h-[64px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-2'
                  : 'mt-4 min-h-[64px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-2.5'
              }
            >
              {placed.length === 0 && (
                <p className="text-center text-base text-slate-400">Tocá los pasos de abajo para empezar</p>
              )}
              <div className={tight ? 'flex flex-col gap-1' : 'flex flex-col gap-1.5'}>
                {placed.map((item, i) => {
                  const StepIcon = item.value.Icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => unplace(item)}
                      className={
                        tight
                          ? 'flex items-start gap-2.5 rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-4 py-1.5 text-left text-base text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40'
                          : 'flex items-start gap-2.5 rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-4 py-2 text-left text-base text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40'
                      }
                    >
                      <span className="mt-0.5 shrink-0 font-bold text-slate-400">{i + 1}.</span>
                      <StepIcon className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                      <span>{item.value.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Banco de pasos — no renderiza el wrapper (ni su mt) una vez
              vacío: con nivel 3 ya al límite del alto disponible, un margen
              "flotando" sobre 0 elementos era espacio desperdiciado justo
              antes del botón Revisar. */}
          {!checked && bank.length > 0 && (
            <div className={tight ? 'mt-3 flex flex-col gap-1' : 'mt-4 flex flex-col gap-1.5'}>
              {bank.map((item) => {
                const StepIcon = item.value.Icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => place(item)}
                    className={
                      tight
                        ? 'flex items-start gap-2.5 rounded-xl border-2 border-slate-200 bg-white px-4 py-1.5 text-left text-base text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                        : 'flex items-start gap-2.5 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-left text-base text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                    }
                  >
                    <StepIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <span>{item.value.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Botón Revisar */}
          {readyToCheck && !checked && (
            <div className={tight ? 'mt-3 text-center' : 'mt-4 text-center'}>
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Resultado */}
      {checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <div className="mt-3 text-left text-base text-slate-600">
              <p className="font-semibold text-slate-700">El orden correcto era:</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {routine.steps.map((step) => (
                  <li key={step.label}>{step.label}</li>
                ))}
              </ol>
            </div>
          )}
          {!done ? (
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente rutina
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : levelIdx < LEVELS.length - 1 ? (
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
