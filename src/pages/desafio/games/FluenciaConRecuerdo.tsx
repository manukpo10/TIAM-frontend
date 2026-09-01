import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Fluencia con reglas" (nombre de archivo sin cambiar: sigue siendo día 17)
 * — atención. Selección directa por regla de letras: la lista de
 * combinaciones sustantivo + adjetivo (algunas cumplen "sustantivo con P +
 * adjetivo con C", otras no — mezcladas a propósito para que responder
 * exija leer las DOS palabras, no sólo la primera) está TODA a la vista al
 * mismo tiempo, y el jugador toca, de opción múltiple, las que cumplen la
 * regla.
 *
 * A pedido explícito del usuario ("que no tenga que memorizar, simplemente
 * que sea de selección") se sacó el diseño original de este archivo: una
 * fase de estudio cronometrada + dos preguntas de recuerdo (reconocer
 * cuáles se vieron, después cuáles cumplían la regla). Ya no hay nada que
 * memorizar, así que `area` pasó de 'memoria' a 'atencion' en
 * challengeContent.ts — la tarea ahora es comparar letras con atención, no
 * recordar una lista que ya no está a la vista.
 *
 * Conteos de combos por nivel (validCount/invalidACount/etc., ver `Level`)
 * quedaron igual que antes del cambio — la rampa 1→2→3 ya era razonable
 * para leer y comparar, no hacía falta retocarla sólo porque se sacó la
 * memoria.
 *
 * 2 rondas por nivel (ROUNDS_PER_LEVEL, el default del catálogo): la
 * primera versión de este cambio dejó 1 sola lista por nivel porque venía
 * de colapsar las DOS preguntas de memoria en una — pero esa razón (era la
 * mecánica de memoria la que pedía la excepción, no el nivel en sí) dejó de
 * aplicar apenas se sacó la memoria. Restaurado al estándar del resto del
 * catálogo a pedido del usuario.
 *
 * Sin cronómetro ni señuelos "nunca mostrados" (esos sólo tenían sentido
 * para la pregunta de reconocimiento que ya no existe).
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
  validCount: number
  invalidACount: number // sustantivo correcto, adjetivo cambiado
  invalidBCount: number // adjetivo correcto, sustantivo cambiado
  invalidCCount: number // ninguno de los dos
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
    validCount: 3,
    invalidACount: 1,
    invalidBCount: 1,
    invalidCCount: 0,
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
    validCount: 4,
    invalidACount: 1,
    invalidBCount: 1,
    invalidCCount: 0,
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
    validCount: 4,
    invalidACount: 1,
    invalidBCount: 1,
    invalidCCount: 1,
  },
]

interface RoundData {
  options: Combo[]
  ruleTargets: Set<string>
}

// Combos de la ronda: la mayoría cumple la regla, unas pocas "casi cumplen"
// (sustantivo correcto con adjetivo cambiado, o al revés, o ninguno de los
// dos) — esa mezcla es la que exige atención real a las DOS palabras, no
// sólo mirar la primera letra de una. Los conteos vienen del nivel (ver
// comentario en `Level`).
function buildRound(level: Level): RoundData {
  const { bank, rule, validCount, invalidACount, invalidBCount, invalidCCount } = level
  const valid = buildUniqueCombos(validCount, () => randomCombo(bank.ruleNouns, bank.ruleAdjs, rule))
  const validIds = new Set(valid.map((c) => c.id))
  const invalidA = buildUniqueCombos(invalidACount, () => randomCombo(bank.ruleNouns, bank.otherAdjs, rule), validIds)
  const invalidB = buildUniqueCombos(
    invalidBCount,
    () => randomCombo(bank.otherNouns, bank.ruleAdjs, rule),
    new Set([...validIds, ...invalidA.map((c) => c.id)]),
  )
  const invalidC = buildUniqueCombos(
    invalidCCount,
    () => randomCombo(bank.otherNouns, bank.otherAdjs, rule),
    new Set([...validIds, ...invalidA.map((c) => c.id), ...invalidB.map((c) => c.id)]),
  )
  const options = shuffle([...valid, ...invalidA, ...invalidB, ...invalidC])
  const ruleTargets = new Set(options.filter((c) => c.followsRule).map((c) => c.id))
  return { options, ruleTargets }
}

const ROUNDS_PER_LEVEL = [2, 2, 2]

const PRAISE_GOOD = ['¡Qué buena atención!', '¡Excelente!', '¡Así se hace!', '¡Le diste con todo!']
const PRAISE_OK = [
  '¡Buen intento! Prestar atención a dos palabras a la vez no es fácil.',
  '¡Bien ahí! Con la práctica, la regla se sigue cada vez mejor.',
]

interface Score {
  correct: number
  total: number
}

type Phase = 'ready' | 'select' | 'results'

export function FluenciaConRecuerdo({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  // ROUNDS_PER_LEVEL[i] RoundData por nivel, decididas una vez por epoch, al
  // montar — así "Repetir" devuelve exactamente las mismas listas.
  const [epochRounds] = useState(() =>
    LEVELS.map((lvl, i) => Array.from({ length: ROUNDS_PER_LEVEL[i] }, () => buildRound(lvl))),
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const round = epochRounds[levelIdx][roundIdx]
  const done = phase === 'results' && roundIdx >= roundsForLevel - 1

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [score, setScore] = useState<Score>({ correct: 0, total: 0 })
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    const targets = round.ruleTargets
    const correct = [...selected].filter((id) => targets.has(id)).length
    const missed = targets.size - correct
    const falsePositives = selected.size - correct
    setScore({ correct, total: targets.size })
    setAccMistakes((m) => m + missed + falsePositives)
    setAccAttempts((a) => a + round.options.length)

    const ratio = targets.size ? correct / targets.size : 1
    const pool = ratio >= 0.6 ? PRAISE_GOOD : PRAISE_OK
    setLevelPraise(pool[Math.floor(Math.random() * pool.length)])
    setPhase('results')
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx.

  // "Siguiente lista" — avanza a la ronda 2 del MISMO nivel (sólo se
  // muestra cuando !done, así que roundIdx nunca pasa de roundsForLevel-1).
  function nextRound() {
    setRoundIdx((i) => i + 1)
    setPhase('select')
    setSelected(new Set())
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPhase('select')
    setSelected(new Set())
  }

  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setRoundKey((k) => k + 1)
    setPhase('select')
    setSelected(new Set())
    setAccMistakes(0)
    setAccAttempts(0)
  }
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

  function comboChip(combo: Combo, isSelected: boolean, onToggle: () => void) {
    return (
      <button
        key={combo.id}
        type="button"
        onClick={onToggle}
        aria-pressed={isSelected}
        aria-label={`${combo.noun} ${combo.adj}`}
        className={[
          'flex min-h-[52px] cursor-pointer items-center justify-center rounded-2xl border-2 bg-white px-3 py-2.5 text-center transition',
          'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
          isSelected ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : 'border-slate-200',
        ].join(' ')}
      >
        <span className="text-base font-semibold leading-tight text-slate-700 sm:text-lg">
          <span className="text-tiam-blue">{combo.noun[0]}</span>
          {combo.noun.slice(1)} <span className="text-tiam-blue">{combo.adj[0]}</span>
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

        {phase === 'select' && (
          <>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Ronda {roundIdx + 1} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuáles cumplen la regla?</h2>
            <p className="mt-2 text-base text-slate-500">
              Regla de hoy: <span className="font-semibold text-slate-700">{level.rule.label}</span>. Tocá las
              combinaciones que la cumplen.
            </p>
          </>
        )}

        {phase === 'results' && <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{levelPraise}</h2>}
      </div>

      {/* Pantalla previa: única vez, instrucciones generales — la regla de
          cada nivel se muestra recién en la fase de selección de ESE nivel. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Lightbulb className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver una lista de combinaciones de dos palabras. Cada nivel tiene su propia regla de letras — tocá
            las combinaciones que la cumplen.
          </p>
          <button
            type="button"
            onClick={() => setPhase('select')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Selección — toda la lista visible a la vez, sin fase previa de
          estudio (ver comentario de cabecera). */}
      {phase === 'select' && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {round.options.map((combo) => comboChip(combo, selected.has(combo.id), () => toggleSelect(combo.id)))}
        </div>
      )}

      {/* Resultados */}
      {phase === 'results' && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-base text-slate-600">
            Acertaste{' '}
            <span className="font-bold text-slate-900">
              {score.correct} de {score.total}
            </span>{' '}
            combinaciones que cumplían la regla
          </p>
        </div>
      )}

      {phase === 'select' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={submit}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Listo, ya elegí
          </button>
        </div>
      )}

      {/* Resultados: "Siguiente lista" si queda otra ronda en este nivel;
          si no, avance de nivel/epoch. */}
      {phase === 'results' && !done && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={nextRound}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
          >
            Siguiente lista
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {done && (
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
