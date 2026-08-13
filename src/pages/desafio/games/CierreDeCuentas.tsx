import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Clock, RotateCcw, Sparkles, Tag, Wallet, type LucideIcon } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cierre de cuentas" — día 30, cálculo, cierre cálido del mes. Un repaso
 * autocontenido de cálculo cotidiano (vueltos, precios con descuento,
 * horarios) con selección múltiple simple — nunca teclado numérico libre,
 * mismo criterio que CalculoEnCuadro. Contenido 100% autoral (pool de
 * escenarios a mano, como ElVuelto/ContadorMasMenos), NO procedural: es el
 * cierre del mes, no hace falta un espacio combinatorio enorme, sino
 * situaciones concretas y bien terminadas.
 *
 * Deliberadamente NO usa el prop `progress` ni el historial real del
 * jugador — mismo criterio que el día 30 del Mes 2 (FigurasSuperpuestas):
 * un cierre autocontenido, no una re-lectura de lo que el jugador jugó. Ver
 * el comentario de `GameProps` en challengeProgress.ts: `progress` es
 * opcional y sólo lo usan los pocos días que explícitamente lo necesitan.
 *
 * 3 niveles, cada uno con su propio color de situación (Nivel 1 vueltos y
 * compras simples; Nivel 2 suma precio-con-descuento y horarios de un paso;
 * Nivel 3 "repaso especial", dos pasos encadenados — ej. descuento y RECIÉN
 * DESPUÉS vuelto sobre ese precio ya rebajado, o dos tramos de tiempo
 * sumados antes de contestar) y números más grandes. El nivel 3 completo
 * cierra con un mensaje distinto al resto (no del pool de aliento genérico)
 * para que el final del mes se sienta como eso: un final.
 */

type Scenario = {
  icon: LucideIcon
  prompt: string
  answer: string
  options: string[]
}
interface Level {
  n: number
  name: string
  theme: string
  scenarios: Scenario[]
}

function money(n: number): string {
  return n.toLocaleString('es-AR')
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    theme: 'Vueltos y compras',
    scenarios: [
      { icon: Wallet, prompt: 'Comprás pan por $350 y pagás con $500. ¿Cuánto te dan de vuelto?', answer: money(150), options: [money(150), money(100), money(200), money(250)] },
      { icon: Wallet, prompt: 'Un café cuesta $420. Pagás con $1.000. ¿Cuánto te dan de vuelto?', answer: money(580), options: [money(580), money(480), money(620), money(500)] },
      { icon: Wallet, prompt: 'Comprás dos alfajores de $180 cada uno. ¿Cuánto pagás en total?', answer: money(360), options: [money(360), money(300), money(320), money(400)] },
      { icon: Wallet, prompt: 'Una docena de facturas cuesta $960. Pagás con $1.000. ¿Cuánto te dan de vuelto?', answer: money(40), options: [money(40), money(60), money(100), money(20)] },
      { icon: Wallet, prompt: 'Comprás fideos por $520 y una salsa por $380. ¿Cuánto pagás en total?', answer: money(900), options: [money(900), money(800), money(950), money(880)] },
      { icon: Wallet, prompt: 'Pagás $700 por dos entradas de cine de $300 cada una. ¿Cuánto te dan de vuelto?', answer: money(100), options: [money(100), money(50), money(150), money(200)] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    theme: 'Precios y horarios',
    scenarios: [
      { icon: Tag, prompt: 'Una remera cuesta $4.500 y tiene $500 de descuento. ¿Cuánto sale?', answer: money(4000), options: [money(4000), money(3500), money(4900), money(5000)] },
      { icon: Clock, prompt: 'Saliste de tu casa a las 15:00 y el viaje duró 40 minutos. ¿A qué hora llegaste?', answer: '15:40', options: ['15:40', '15:20', '16:00', '15:50'] },
      { icon: Tag, prompt: 'Un pantalón cuesta $8.000 con un descuento de $1.200. ¿Cuánto sale?', answer: money(6800), options: [money(6800), money(7200), money(6600), money(7000)] },
      { icon: Clock, prompt: 'Empezaste a cocinar a las 12:10 y tardaste 25 minutos. ¿A qué hora terminaste?', answer: '12:35', options: ['12:35', '12:25', '12:45', '12:30'] },
      { icon: Tag, prompt: 'Una pizza cuesta $6.000 y tiene $600 de descuento. ¿Cuánto sale?', answer: money(5400), options: [money(5400), money(5600), money(5200), money(5000)] },
      { icon: Clock, prompt: 'Llamaste al médico a las 9:15 y esperaste 20 minutos para que te atiendan. ¿A qué hora te atendieron?', answer: '9:35', options: ['9:35', '9:25', '9:45', '9:30'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    theme: 'Un repaso especial',
    scenarios: [
      { icon: Tag, prompt: 'Un libro cuesta $9.000 con $1.500 de descuento. Pagás con $10.000. ¿Cuánto te dan de vuelto?', answer: money(2500), options: [money(2500), money(2000), money(3000), money(1500)] },
      { icon: Clock, prompt: 'Saliste a hacer trámites a las 10:20. El primero duró 35 minutos y el segundo 25 minutos. ¿A qué hora terminaste todo?', answer: '11:20', options: ['11:20', '11:00', '11:10', '11:30'] },
      { icon: Tag, prompt: 'Compraste dos remeras de $3.200 cada una, con $800 de descuento en total. ¿Cuánto pagaste?', answer: money(5600), options: [money(5600), money(5800), money(5400), money(6000)] },
      { icon: Clock, prompt: 'Empezaste a leer a las 18:45 y leíste durante 50 minutos. ¿A qué hora terminaste?', answer: '19:35', options: ['19:35', '19:25', '19:45', '19:15'] },
      { icon: Tag, prompt: 'Una campera cuesta $15.000 con $3.000 de descuento. Pagás con $20.000. ¿Cuánto te dan de vuelto?', answer: money(8000), options: [money(8000), money(7000), money(9000), money(8500)] },
      { icon: Clock, prompt: 'Fuiste al banco a las 9:50. Esperaste 45 minutos y el trámite duró 15 minutos más. ¿A qué hora terminaste?', answer: '10:50', options: ['10:50', '10:40', '11:00', '10:35'] },
    ],
  },
]

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" del resto
// del catálogo de cálculo (ElVuelto/LaPiramide/MesaDeCartas).
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

const PRAISE_GOOD = ['¡Exacto!', '¡Muy bien calculado!', '¡Perfecto!', '¡Así se hace!']
const HINTS = ['Ese no es — volvé a calcular con calma.', 'Casi. Probá con otra opción.', 'No es esa — fijate bien los números del enunciado.']
const CLOSING_MESSAGE =
  'Completaste "Cierre de cuentas". Repasaste vueltos, precios con descuento y horarios — un cierre a la altura de todo lo que practicaste este mes.'

export function CierreDeCuentas({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // `ROUNDS_PER_LEVEL[i]` escenarios elegidos al azar del pool propio de
  // cada nivel, para LOS 3 niveles a la vez — decidido una sola vez por
  // época (al montar y de nuevo en "Hacer otro"), nunca vuelto a tirar por
  // re-visitar un nivel, así "Repetir" devuelve exactamente el mismo intento.
  const [epochScenarios, setEpochScenarios] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.scenarios).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const scenarios = epochScenarios[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const scenario = scenarios[roundIdx]
  const done = roundIdx >= roundsForLevel

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Errores acumulados a través de niveles 1→2→3, sólo en cero en un
  // reinicio real del día (ver restartEpoch).
  const [mistakes, setMistakes] = useState(0)

  function guess(value: string) {
    if (!scenario || resolved || eliminated.has(value)) return
    if (value === scenario.answer) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
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
  // el motivo de no hacerlo en un efecto separado.

  // "Siguiente nivel" — avanza dentro de la MISMA época. epochScenarios
  // queda intacto: los escenarios del nivel i+1 ya se decidieron al empezar
  // la época.
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
  }

  // Compartida por los dos botones de reinicio en la tarjeta final del
  // último nivel (sólo se muestra ahí, así que siempre es un reinicio real
  // del día). roundKey siempre avanza: es el contador de "qué intento es
  // este" que usa el efecto de onComplete para dispararse otra vez en una
  // repetición.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    setMistakes(0)
  }
  // "Repetir" — mismos escenarios del intento recién terminado.
  function restartSame() {
    restartEpoch()
  }
  // "Hacer otro" — escenarios nuevos por nivel.
  function restartDifferent() {
    restartEpoch()
    setEpochScenarios(LEVELS.map((lvl, i) => shuffle(lvl.scenarios).slice(0, ROUNDS_PER_LEVEL[i])))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const Icon = scenario?.icon

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <p className="mt-2 text-base font-semibold text-slate-500">{level.theme}</p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Wallet className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Un repaso de las cuentas de todos los días: vueltos, precios con descuento y horarios. Leé cada situación
            y tocá la respuesta correcta entre las opciones.
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

      {phase === 'playing' && !done && scenario && Icon && (
        <>
          {/* Escenario */}
          <div className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-tiam-blue">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-base text-slate-700">{scenario.prompt}</p>
          </div>

          {/* Opciones */}
          <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-3">
            {scenario.options.map((opt) => {
              const isEliminated = eliminated.has(opt)
              const showAsCorrect = resolved && opt === scenario.answer
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isEliminated || resolved}
                  onClick={() => guess(opt)}
                  className={[
                    'min-h-[52px] rounded-2xl border-2 px-3 py-2 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    showAsCorrect
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-700 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt}
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
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {levelIdx === LEVELS.length - 1 ? CLOSING_MESSAGE : `Resolviste las ${roundsForLevel} situaciones — completaste el nivel ${levelIdx + 1}.`}
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
