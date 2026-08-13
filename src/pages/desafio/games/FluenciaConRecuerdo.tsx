import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Fluencia con recuerdo" — memoria + atención. Fase de estudio: una lista de
 * 9 combinaciones sustantivo+adjetivo, algunas cumplen la regla de letras del
 * nivel (p. ej. "sustantivo con P + adjetivo con C") y otras no — mezcladas a
 * propósito para que leer la lista exija atención real, no sólo memorizar
 * texto. Fase de reconocimiento: DOS preguntas cortas, ambas de opción
 * múltiple por toque (nunca texto libre, como pide el brief):
 *   P1 — ¿cuáles combinaciones viste? (reconocimiento puro, con señuelos
 *        nuevos que nunca estuvieron en la lista)
 *   P2 — ¿cuáles cumplían la regla? (vuelve a mostrar SÓLO las 9 estudiadas,
 *        con un recordatorio chico de la regla — sigue siendo memoria de
 *        CUÁLES la cumplían, no un ejercicio de lógica en limpio)
 *
 * Motor propio (no comparte código con ListaConParecidas/RecordaLosDetalles):
 * dos rondas de selección múltiple encadenadas por nivel en vez de una sola,
 * así que el estado y el puntaje no calzan con el patrón study→test→results
 * de ésos. Sin capa de "rondas" extra tampoco acá — la mecánica ya tiene DOS
 * preguntas por nivel, que es precisamente la variación que pide la regla de
 * "2 rondas por nivel salvo que la mecánica pida otra cosa".
 *
 * Resultados sin remostrar el tablero (a diferencia de ListaConParecidas):
 * acá no hay grilla que "revelar" con medallitas, así que la pantalla de
 * resultados es sólo un resumen de las dos preguntas — más liviana, sin
 * necesidad del gate `resultsSeen` que usan los juegos con tablero.
 *
 * Pantalla "¿Listo?" de una sola vez con las instrucciones generales; el
 * temporizador de estudio queda gateado a `phase === 'study'` (mismo motivo
 * que ListaConParecidas.tsx).
 *
 * Tablero tope: P1 muestra 12 chips (9 estudiadas + 3 señuelos, ≤ el techo
 * probado de 12 de ListaConParecidas), P2 sólo 9 — ambos livianos de sobra
 * para 375×812 sin scroll.
 */

interface LetterRule {
  nounLetter: string
  adjLetter: string
  label: string
}

interface WordBank {
  ruleNouns: string[]
  otherNouns: string[]
  ruleAdjs: string[]
  otherAdjs: string[]
}

interface Combo {
  id: string
  noun: string
  adj: string
  followsRule: boolean
}

function makeCombo(noun: string, adj: string, rule: LetterRule): Combo {
  const followsRule = noun[0].toLowerCase() === rule.nounLetter && adj[0].toLowerCase() === rule.adjLetter
  return { id: `${noun}-${adj}`, noun, adj, followsRule }
}

function randomCombo(nounPool: string[], adjPool: string[], rule: LetterRule): Combo {
  const noun = nounPool[Math.floor(Math.random() * nounPool.length)]
  const adj = adjPool[Math.floor(Math.random() * adjPool.length)]
  return makeCombo(noun, adj, rule)
}

// Genera hasta `count` combos ÚNICOS (por id) probando al azar con `generator`
// — los bancos de palabras son chicos (8 por lista) así que la chance de
// colisión es baja; el guard corta a las 200 vueltas por las dudas.
function buildUniqueCombos(count: number, generator: () => Combo, exclude: Set<string> = new Set()): Combo[] {
  const result: Combo[] = []
  const seen = new Set(exclude)
  let guard = 0
  while (result.length < count && guard < 200) {
    guard++
    const combo = generator()
    if (seen.has(combo.id)) continue
    seen.add(combo.id)
    result.push(combo)
  }
  return result
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Level {
  n: number
  name: string
  rule: LetterRule
  bank: WordBank
  studySeconds: number
  minEarlySeconds: number
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rule: { nounLetter: 'p', adjLetter: 'c', label: 'sustantivo con P + adjetivo con C' },
    bank: {
      ruleNouns: ['perro', 'plato', 'papel', 'poste', 'piso', 'pollo', 'puente', 'peine'],
      otherNouns: ['mesa', 'silla', 'taza', 'sillón', 'farol', 'jarrón', 'cajón', 'ratón'],
      ruleAdjs: ['claro', 'cómodo', 'curioso', 'caro', 'cuadrado', 'colorido', 'cansado', 'corto'],
      otherAdjs: ['grande', 'roto', 'rojo', 'azul', 'viejo', 'nuevo', 'largo', 'suave'],
    },
    studySeconds: 30,
    minEarlySeconds: 12,
  },
  {
    n: 2,
    name: 'Nivel 2',
    rule: { nounLetter: 'c', adjLetter: 'a', label: 'sustantivo con C + adjetivo con A' },
    bank: {
      ruleNouns: ['camión', 'cuchara', 'cartel', 'camisa', 'cofre', 'cuaderno', 'corazón', 'camino'],
      otherNouns: ['libro', 'botella', 'ventana', 'espejo', 'reloj', 'sombrero', 'tenedor', 'farol'],
      ruleAdjs: ['amarillo', 'alto', 'ancho', 'amable', 'antiguo', 'alegre', 'apretado', 'agotado'],
      otherAdjs: ['verde', 'bajo', 'oscuro', 'tibio', 'suave', 'fuerte', 'liviano', 'pesado'],
    },
    studySeconds: 34,
    minEarlySeconds: 14,
  },
  {
    n: 3,
    name: 'Nivel 3',
    rule: { nounLetter: 'm', adjLetter: 's', label: 'sustantivo con M + adjetivo con S' },
    bank: {
      ruleNouns: ['mesa', 'mochila', 'martillo', 'molino', 'mantel', 'muñeca', 'maceta', 'medias'],
      otherNouns: ['cortina', 'pizarra', 'cinturón', 'escalera', 'balcón', 'tijera', 'cesto', 'farol'],
      ruleAdjs: ['suave', 'seco', 'salado', 'sucio', 'sabroso', 'silencioso', 'simpático', 'sólido'],
      otherAdjs: ['dulce', 'húmedo', 'ruidoso', 'tierno', 'brillante', 'pesado', 'veloz', 'frágil'],
    },
    studySeconds: 38,
    minEarlySeconds: 16,
  },
]

interface RoundData {
  studied: Combo[]
  q1Options: Combo[]
  q2Targets: Set<string>
}

// 9 combos estudiadas: 5 que cumplen la regla + 4 que no (2 con el sustantivo
// correcto y el adjetivo cambiado, 1 al revés, 1 con ninguno de los dos) —
// la mezcla de "casi cumple" es la que de verdad exige atención a las DOS
// palabras. P1 agrega 3 señuelos nuevos armados con el mismo banco, nunca
// mostrados, para que el reconocimiento tenga interferencia real.
function buildRound(level: Level): RoundData {
  const { bank, rule } = level
  const valid = buildUniqueCombos(5, () => randomCombo(bank.ruleNouns, bank.ruleAdjs, rule))
  const validIds = new Set(valid.map((c) => c.id))
  const invalidA = buildUniqueCombos(2, () => randomCombo(bank.ruleNouns, bank.otherAdjs, rule), validIds)
  const invalidB = buildUniqueCombos(
    1,
    () => randomCombo(bank.otherNouns, bank.ruleAdjs, rule),
    new Set([...validIds, ...invalidA.map((c) => c.id)]),
  )
  const invalidC = buildUniqueCombos(
    1,
    () => randomCombo(bank.otherNouns, bank.otherAdjs, rule),
    new Set([...validIds, ...invalidA.map((c) => c.id), ...invalidB.map((c) => c.id)]),
  )
  const studied = shuffle([...valid, ...invalidA, ...invalidB, ...invalidC])
  const studiedIds = new Set(studied.map((c) => c.id))

  const foils = buildUniqueCombos(
    3,
    () => {
      const nounPool = Math.random() < 0.5 ? bank.ruleNouns : bank.otherNouns
      const adjPool = Math.random() < 0.5 ? bank.ruleAdjs : bank.otherAdjs
      return randomCombo(nounPool, adjPool, rule)
    },
    studiedIds,
  )

  const q1Options = shuffle([...studied, ...foils])
  const q2Targets = new Set(studied.filter((c) => c.followsRule).map((c) => c.id))
  return { studied, q1Options, q2Targets }
}

const PRAISE_GOOD = ['¡Qué buena atención!', '¡Excelente!', '¡Así se hace!', '¡Le diste con todo!']
const PRAISE_OK = [
  '¡Buen intento! Prestar atención a dos palabras a la vez no es fácil.',
  '¡Bien ahí! Con la práctica, la regla se sigue cada vez mejor.',
]

interface Score {
  correct: number
  total: number
}

type Phase = 'ready' | 'study' | 'q1' | 'q2' | 'results'

export function FluenciaConRecuerdo({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Una RoundData por nivel, decidida una vez por epoch — al montar y de
  // nuevo sólo en restartDifferent() — así "Repetir" devuelve exactamente la
  // misma lista y las mismas preguntas.
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => buildRound(lvl)))
  const round = epochRounds[levelIdx]
  const studiedIds = useMemo(() => new Set(round.studied.map((c) => c.id)), [round])

  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [q1Selected, setQ1Selected] = useState<Set<string>>(new Set())
  const [q2Selected, setQ2Selected] = useState<Set<string>>(new Set())
  const [q1Score, setQ1Score] = useState<Score>({ correct: 0, total: 0 })
  const [q2Score, setQ2Score] = useState<Score>({ correct: 0, total: 0 })
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // Gateado a `phase === 'study'` — ver ListaConParecidas.tsx para el motivo.
  const autoTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (phase !== 'study') return
    const floorTimer = window.setTimeout(() => setCanContinueEarly(true), level.minEarlySeconds * 1000)
    const autoTimer = window.setTimeout(() => setPhase('q1'), level.studySeconds * 1000)
    autoTimerRef.current = autoTimer
    return () => {
      window.clearTimeout(floorTimer)
      window.clearTimeout(autoTimer)
    }
  }, [phase, levelIdx, roundKey, level.minEarlySeconds, level.studySeconds])

  function toggleQ1(id: string) {
    setQ1Selected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleQ2(id: string) {
    setQ2Selected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submitQ1() {
    const correct = [...q1Selected].filter((id) => studiedIds.has(id)).length
    const missed = studiedIds.size - correct
    const falsePositives = q1Selected.size - correct
    setQ1Score({ correct, total: studiedIds.size })
    setAccMistakes((m) => m + missed + falsePositives)
    setAccAttempts((a) => a + round.q1Options.length)
    setPhase('q2')
  }

  function submitQ2() {
    const targets = round.q2Targets
    const correct = [...q2Selected].filter((id) => targets.has(id)).length
    const missed = targets.size - correct
    const falsePositives = q2Selected.size - correct
    setQ2Score({ correct, total: targets.size })
    setAccMistakes((m) => m + missed + falsePositives)
    setAccAttempts((a) => a + round.studied.length)

    const q1Ratio = q1Score.total ? q1Score.correct / q1Score.total : 1
    const q2Ratio = targets.size ? correct / targets.size : 1
    const pool = (q1Ratio + q2Ratio) / 2 >= 0.6 ? PRAISE_GOOD : PRAISE_OK
    setLevelPraise(pool[Math.floor(Math.random() * pool.length)])
    setPhase('results')
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx.

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setQ1Selected(new Set())
    setQ2Selected(new Set())
  }

  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setPhase('study')
    setCanContinueEarly(false)
    setQ1Selected(new Set())
    setQ2Selected(new Set())
    setAccMistakes(0)
    setAccAttempts(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => buildRound(lvl)))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (phase === 'results' && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levelIdx, roundKey, accMistakes, accAttempts])

  // Clases Tailwind siempre como strings LITERALES completos (nunca
  // interpoladas tipo `border-${ring}`) — el JIT de Tailwind escanea el
  // código fuente buscando el nombre de clase completo; una clase armada por
  // interpolación no aparece nunca en el CSS generado.
  function comboChip(combo: Combo, selected: boolean, onToggle: () => void, color: 'blue' | 'green') {
    const isBlue = color === 'blue'
    return (
      <button
        key={combo.id}
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`${combo.noun} ${combo.adj}`}
        className={[
          'flex min-h-[52px] cursor-pointer items-center justify-center rounded-2xl border-2 bg-white px-3 py-2.5 text-center transition',
          'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus:outline-none focus:ring-offset-1',
          isBlue ? 'focus:ring-2 focus:ring-tiam-blue/40' : 'focus:ring-2 focus:ring-tiam-green/40',
          selected
            ? isBlue
              ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
              : 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
            : 'border-slate-200',
        ].join(' ')}
      >
        <span className="text-base font-semibold leading-tight text-slate-700 sm:text-lg">
          <span className={isBlue ? 'text-tiam-blue' : 'text-tiam-green'}>{combo.noun[0]}</span>
          {combo.noun.slice(1)} <span className={isBlue ? 'text-tiam-blue' : 'text-tiam-green'}>{combo.adj[0]}</span>
          {combo.adj.slice(1)}
        </span>
      </button>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>

        {phase === 'study' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Leé la lista</h2>
            <p className="mt-2 text-base text-slate-500">
              Regla de hoy: <span className="font-semibold text-slate-700">{level.rule.label}</span>. Algunas
              combinaciones la cumplen, otras no.
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-blue"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {phase === 'q1' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuáles combinaciones viste?</h2>
            <p className="mt-2 text-base text-slate-500">Tocá sólo las que estaban en la lista original.</p>
          </>
        )}

        {phase === 'q2' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuáles cumplían la regla?</h2>
            <p className="mt-2 text-base text-slate-500">
              Recordá: <span className="font-semibold text-slate-700">{level.rule.label}</span>.
            </p>
          </>
        )}

        {phase === 'results' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{levelPraise}</h2>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez, instrucciones generales — la regla de
          cada nivel se muestra recién en la fase de estudio de ESE nivel. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Lightbulb className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a leer una lista de combinaciones de dos palabras. Cada nivel tiene su propia regla de letras —
            algunas combinaciones la cumplen, otras no. Después te voy a hacer dos preguntas cortas: cuáles viste, y
            cuáles cumplían la regla.
          </p>
          <button
            type="button"
            onClick={() => setPhase('study')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Fase de estudio */}
      {phase === 'study' && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {round.studied.map((combo) => (
            <div
              key={combo.id}
              className="flex min-h-[52px] items-center justify-center rounded-2xl border-2 border-slate-100 bg-white px-3 py-2.5 text-center"
            >
              <span className="text-base font-semibold leading-tight text-slate-700 sm:text-lg">
                <span className="text-tiam-blue">{combo.noun[0]}</span>
                {combo.noun.slice(1)} <span className="text-tiam-blue">{combo.adj[0]}</span>
                {combo.adj.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* P1: reconocimiento */}
      {phase === 'q1' && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {round.q1Options.map((combo) => comboChip(combo, q1Selected.has(combo.id), () => toggleQ1(combo.id), 'blue'))}
        </div>
      )}

      {/* P2: cumple la regla — sólo las 9 estudiadas, sin señuelos nuevos. */}
      {phase === 'q2' && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {round.studied.map((combo) => comboChip(combo, q2Selected.has(combo.id), () => toggleQ2(combo.id), 'green'))}
        </div>
      )}

      {/* Resultados: resumen de las dos preguntas, sin remostrar tablero. */}
      {phase === 'results' && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-base text-slate-600">
            Pregunta 1 — reconociste{' '}
            <span className="font-bold text-slate-900">
              {q1Score.correct} de {q1Score.total}
            </span>
          </p>
          <p className="mt-1 text-base text-slate-600">
            Pregunta 2 — acertaste{' '}
            <span className="font-bold text-slate-900">
              {q2Score.correct} de {q2Score.total}
            </span>{' '}
            con la regla
          </p>
        </div>
      )}

      {/* Estudio: botón de continuar anticipado. */}
      {phase === 'study' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={!canContinueEarly}
            onClick={() => {
              window.clearTimeout(autoTimerRef.current)
              setPhase('q1')
            }}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ya estoy list@, continuar
          </button>
        </div>
      )}

      {phase === 'q1' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={submitQ1}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Listo, ya elegí
          </button>
        </div>
      )}

      {phase === 'q2' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={submitQ2}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-green px-6 font-semibold text-white transition hover:opacity-90"
          >
            Listo, ya elegí
          </button>
        </div>
      )}

      {/* Resultados: avance de nivel/epoch */}
      {phase === 'results' && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
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
