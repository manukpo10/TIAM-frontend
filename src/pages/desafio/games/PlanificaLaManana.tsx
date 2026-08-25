import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Sunrise } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Planificá la mañana" — a task-priority sequencing / executive-function
 * game. Order errands into the one correct sequence; every task carries an
 * explicit clue (a deadline, a dependency, a spatial chain) so there's
 * always exactly one right answer — never a "vibes" judgment call between
 * two equally-reasonable orders.
 *
 * Structurally a near-copy of LaCharlaDesordenada.tsx: same
 * useSequencingPuzzle hook, same distractor handling (a task that isn't
 * for today at all, at the hardest level), same stacked-row layout. Kept
 * as a separate component rather than a shared abstraction, matching this
 * codebase's convention of small focused game components over one
 * generic engine.
 *
 * MULTIPLE rounds per level (same pattern as "Los opuestos" / "La canción
 * de tu juventud"): each level draws `rounds` distinct task-sets from its
 * own pool (shuffle + slice), never repeating within a level. Unlike those
 * two games — which resolve each round with a single tap and auto-advance
 * after a timeout — here the result only reveals once you tap "Revisar,"
 * and a wrong answer needs to be READ (the whole ideal order, spelled
 * out). So advancing to the next round sits behind an explicit "Siguiente
 * mañana" button instead of a timeout: auto-advancing on a clock here
 * would rush that reading, which conflicts with this app's "no timer" rule.
 *
 * A one-time "¿Listo?" ready screen (see `phase` below) gates the START of
 * the day, not every round — moving the "how to play" line out of the
 * per-round header is what actually buys nivel 3 the room it needs for its
 * stacked full-sentence tasks. Same one-shot gate as Encaminada: `phase`
 * never resets back to 'ready' once the day is underway.
 */

interface MorningSet {
  tasks: string[]
  distractor?: string
}
interface MorningLevel {
  n: number
  name: string
  rounds: number
  sets: MorningSet[]
}

// rounds uniformed to 2 per level (was 2/3/3) per user request — same fix as
// ElVuelto.tsx (día 5). Pools stay at their original size (3/4/5 sets), so
// every playthrough still draws a genuinely random, non-repeating subset.
const LEVELS: MorningLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    sets: [
      {
        tasks: [
          'Ir a la farmacia de turno antes del mediodía, que después cierra.',
          'Comprar pan en la panadería, podés hacerlo en cualquier momento.',
          'Llamar a tu hermana, tranquila, dejalo para el final de la mañana.',
        ],
      },
      {
        tasks: [
          'Cobrar la jubilación en el banco, que atiende solo hasta la una.',
          'Pasar por el kiosco a comprar el diario, cuando quieras.',
          'Mandarle un mensaje a tu nieto, dejalo para el final.',
        ],
      },
      {
        tasks: [
          'Ir a la verdulería temprano, antes de que se acabe lo mejor.',
          'Cebar unos mates tranquila, como un respiro a media mañana.',
          'Llamar a tu vecina para invitarla al té, ya cerca del mediodía.',
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    sets: [
      {
        tasks: [
          'Llamar a tu nieto por su cumpleaños, apenas te levantes, antes de salir.',
          'Ir al banco a cobrar la jubilación, que cierra a la una.',
          'Retirar los remedios en la farmacia, que se pagan en efectivo: pasá primero por el banco.',
          'Llevarle un tupper a tu hija, ya de vuelta, cuando termines los mandados.',
        ],
      },
      {
        tasks: [
          'Pedir turno con el oculista por teléfono antes de las 9, sin salir de tu casa.',
          'De camino, comprar la carne para el domingo, antes de que se llene la carnicería.',
          'Pasar por la panadería a llevar facturas; queda al lado de la carnicería.',
          'Devolverle el libro a tu vecina cuando ya estés de vuelta en tu casa.',
        ],
        distractor: 'Acordate: el mes que viene vence el carnet de conducir.',
      },
      {
        tasks: [
          'Ir al centro de salud a tomarte la presión, apenas abren a las 8.',
          'Pasar por la farmacia con la receta nueva; queda a la vuelta del centro de salud.',
          'Comprar fideos y salsa en el almacén, en cualquier momento de la mañana.',
          'Contarle a tu marido cómo te fue, cuando llegues a tu casa.',
        ],
      },
      {
        tasks: [
          'Pagar la boleta de la luz en el banco antes de las once, que después se llena de gente.',
          'De paso, pasar por la ferretería a comprar una lamparita; queda enfrente del banco.',
          'Comprar fruta fresca en la verdulería, en cualquier momento de la mañana.',
          'Llamar a tu comadre para invitarla a tomar unos mates, ya de vuelta en tu casa.',
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    sets: [
      {
        tasks: [
          'Ir al laboratorio a que te saquen sangre, en ayunas, bien temprano.',
          'Retirar los resultados del análisis, recién a partir de las 11.',
          'Llevarle los resultados al médico, apenas los tengas en la mano.',
          'Comprar en la farmacia las vitaminas que te recomendó el médico, ya que quedó cerca.',
          'Contarle a tu hija cómo te fue, ya de vuelta en tu casa.',
        ],
        distractor: 'Acordate que el sábado es el cumpleaños de tu nieta.',
      },
      {
        tasks: [
          'Retirar los remedios de la presión en la farmacia; te los guardan solo hasta el mediodía.',
          'Cobrar la jubilación en el banco: hoy es tu día según el DNI, y cierra a la una.',
          'Pagarle el alquiler al encargado en efectivo, recién después de cobrar en el banco.',
          'Guardar el comprobante del alquiler en la carpeta de gastos, apenas se lo pagues al encargado.',
          'Llamar a tu hijo para avisarle que ya hiciste todo, cuando termines.',
        ],
        distractor: 'Recordá separar la ropa de verano para guardarla en el placard.',
      },
      {
        tasks: [
          'Retirar un paquete en el correo, que abre a las 9 y conviene ir apenas abre.',
          'Llevar al perro al veterinario a vacunarlo, con turno pedido justo para las 10.',
          'Pasar por la tintorería a buscar el saco; queda en la esquina del veterinario.',
          'Pagar la cuota del club antes del mediodía, que después cierra la administración.',
          'Contarle a tu comadre cómo te fue, ya de vuelta en tu casa.',
        ],
        distractor: 'Acordate: el jueves que viene vence la factura de la luz.',
      },
      {
        tasks: [
          'Sacar número para el trámite en PAMI antes de las 9:30, se termina el cupo.',
          'Mientras esperás que te llamen, pagar el impuesto municipal en la caja de al lado.',
          'Cuando te llamen, entregar los papeles del medicamento en la ventanilla.',
          'Devolverle el molde de tarta a tu comadre, después de terminar los trámites.',
          'Contarle a tu hijo cómo te fue en PAMI, ya de vuelta en tu casa.',
        ],
      },
      {
        tasks: [
          'Sacar turno en la obra social para el oculista, apenas abren a las 8.',
          'Mientras esperás que te atiendan, pagar la cuota del gas en la caja de al lado.',
          'Cuando te llamen, entregar la orden médica en la ventanilla.',
          'Pasar por la óptica a preguntar por los anteojos nuevos; queda a la vuelta de la obra social.',
          'Contarle a tu nuera cómo te fue, ya de vuelta en tu casa.',
        ],
        distractor: 'Acordate: el viernes vence la garantía de la heladera.',
      },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Muy bien planificado!', '¡Así se organiza la mañana!', '¡Excelente!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo queda el orden ideal.',
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

export function PlanificaLaManana({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` distinct task-sets per level for THIS "epoch" (one full pass
  // through 3 levels) — chosen once per epoch (on mount and on "Hacer
  // otro"), never re-rolled by "Repetir" or by revisiting a level mid-
  // epoch. Plain lookup (NOT useMemo): a useMemo here would get invalidated
  // anyway since levelIdx cycles 0→1→2→0 on every restart, regardless of
  // roundKey.
  const [morningSetChoices] = useState(() =>
    LEVELS.map((lvl) => shuffle(lvl.sets).slice(0, lvl.rounds)),
  )
  const roundSets = morningSetChoices[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const plan = roundSets[roundIdx]
  const pool = useMemo(
    () => (plan.distractor ? [...plan.tasks, plan.distractor] : plan.tasks),
    [plan],
  )
  const distractorId = plan.distractor ? plan.tasks.length : null

  const { bank, placed, place, unplace } = useSequencingPuzzle(pool, `${levelIdx}-${roundKey}-${roundIdx}`)
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across any same-level replay —
  // every submission counts), only zeroed on a true day restart (see
  // restartEpoch). Same model as CuantosHay.tsx.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const readyToCheck =
    bank.length === 0 || (distractorId !== null && bank.length === 1 && bank[0].id === distractorId)

  // nivel 3 stacks 5 full-sentence tasks (up to ~96 chars each) plus an
  // optional distractor — unlike ElPasoAPaso's bank, the distractor means
  // the bank never fully empties, so even the STARTING mount (before any
  // task is placed, all 6 sentences visible in the bank alone) overflowed
  // 375×812 by 56px (measured live). Tightens row padding/gaps only here.
  const tight = level.n === 3

  const includedDistractor = distractorId !== null && placed.some((item) => item.id === distractorId)
  const placedReal = placed.filter((item) => item.id !== distractorId)
  const isCorrect =
    !includedDistractor &&
    placedReal.length === plan.tasks.length &&
    placedReal.every((item, i) => item.id === i)

  // True once the LAST round of the level has been checked — gates the
  // level-complete screen (advanceLevel / restartSame)
  // instead of the plain "next round" button. Derived from `checked` +
  // `roundIdx`, both real state reset synchronously below — never from a
  // value reset inside a useEffect (see restartEpoch()'s comment for why
  // that matters).
  const done = checked && roundIdx >= level.rounds - 1

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    // Per-task mistake count, derived from state the component already has:
    // every placed real task sitting outside its correct slot is a mistake,
    // plus one more if the distractor got placed at all (that alone can make
    // a round wrong even when every real task is otherwise in order).
    const taskMistakes = placedReal.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + taskMistakes + (includedDistractor ? 1 : 0))
    setAccAttempts((a) => a + pool.length)
  }
  // Advance to the next round within the level. Only reachable while
  // `!done` — the button that calls this doesn't render once the level is
  // complete.
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }
  // Resets happen HERE, synchronously with the level/round change (checked
  // was already reset this way before this retrofit) — keeping it that way
  // means the onComplete-reporting effect below never sees a stale `checked`
  // (or `roundIdx`) paired with a fresh `levelIdx` on the same render.

  // "Siguiente nivel" — advance within the SAME attempt, mid-epoch.
  // morningSetChoices is left alone: level i+1's task-sets were already
  // decided when this epoch started.
  function advanceLevel() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
  }
  // Runs on the "Repetir" button on the final level's complete card (only
  // ever shown once level 3 is done, so always a genuine day restart — it
  // zeroes the accumulators). roundKey always bumps here: it's the
  // "which attempt is this" generation counter the onComplete effect uses to
  // fire again on a replay.
  function restartEpoch() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  // "Repetir" — same task-sets as the attempt just finished.
  function restartSame() {
    restartEpoch()
  }

  // Reports the SUM across levels 1→2→3, not just level 3: check() already
  // folded this level's numbers into accMistakes/accAttempts above. Fires
  // once per roundKey so a genuine full-day restart (wrap to level 1, new
  // roundKey) can report again.
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
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <p className={level.n === 3 ? 'mt-1 text-base font-semibold text-slate-500' : 'mt-2 text-base font-semibold text-slate-500'}>
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div
              className={
                level.n === 3
                  ? 'mx-auto mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100'
                  : 'mx-auto mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100'
              }
            >
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez, al principio del día — saca las
          instrucciones del header persistente (antes se repetían en cada
          ronda) para ganar espacio vertical; el nivel 3 llega a apilar 5
          tareas de una oración completa cada una, más el distractor
          opcional. Igual que en Encaminada, `phase` no vuelve a 'ready'
          nunca — ni al subir de nivel ni en "Repetir". */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Sunrise className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Tocá las tareas en el orden que te parezca correcto para organizar la mañana. Ojo: a veces alguna
            no es para hoy.
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
          {/* Sequence being built — hidden once checked so the result card
              below doesn't have to compete with it for space (the tasks
              here are full sentences, several rows of them push a long way
              down). The result card's own "El orden ideal era" listing
              already restates the correct order in full when wrong. */}
          {!checked && (
            <div
              className={
                tight
                  ? 'mt-2 min-h-[64px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-1.5'
                  : 'mt-4 min-h-[64px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3'
              }
            >
              {placed.length === 0 && (
                <p className="text-center text-base text-slate-400">Tocá las tareas de abajo para empezar</p>
              )}
              <div className={tight ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1.5'}>
                {placed.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => unplace(item)}
                    className={
                      tight
                        ? 'flex items-start gap-1.5 rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-3 py-1 text-left text-base leading-tight text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40'
                        : 'flex items-start gap-2 rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-4 py-2.5 text-left text-base text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40'
                    }
                  >
                    <span className="mt-0.5 shrink-0 font-bold text-slate-400">{i + 1}.</span>
                    <span>{item.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bank */}
          {!checked && (
            <div className={tight ? 'mt-1 flex flex-col gap-0.5' : 'mt-3 flex flex-col gap-1.5'}>
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => place(item)}
                  className={
                    tight
                      ? 'rounded-xl border-2 border-slate-200 bg-white px-3 py-1 text-left text-base leading-tight text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                      : 'rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-left text-base text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                  }
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {/* Check button */}
          {readyToCheck && !checked && (
            <div className={tight ? 'mt-2 text-center' : 'mt-4 text-center'}>
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

      {/* Result */}
      {checked && (
        <div className="mt-4 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <div className="mt-2 text-left text-base text-slate-600">
              <p className="font-semibold text-slate-700">El orden ideal era:</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {plan.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ol>
              {plan.distractor && (
                <p className="mt-2 text-slate-500">Y esta no era una tarea de hoy: "{plan.distractor}"</p>
              )}
            </div>
          )}
          {!done ? (
            <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente mañana
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : levelIdx < LEVELS.length - 1 ? (
            <div className="mt-4 flex justify-center">
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
            <div className="mt-4 flex justify-center">
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
