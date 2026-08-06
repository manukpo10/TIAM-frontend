import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Dichos a medias" — día 1 (mes 2), lenguaje.
 *
 * Niveles 1 y 2: completá el refrán/dicho popular al que le falta la última
 * palabra, eligiéndola entre 4 opciones — mecánicamente el motor de "Los
 * opuestos" (LosOpuestos.tsx, día 14 del mes 1) en su variante no ilustrada.
 *
 * Nivel 3: mecánica distinta a pedido del profesional que revisó el mes 2 —
 * repetir el mismo "completar con opciones" tres niveles seguidos se sentía
 * repetitivo ("medio aburrido, todo lo mismo"). En vez de eso, el dicho
 * completo aparece desordenado y hay que tocarlo palabra por palabra en el
 * orden correcto — el motor de "Ordená la frase" (OrdenarLaFrase.tsx, día 8
 * del mes 2), vía el mismo hook compartido `useSequencingPuzzle`. Igual que
 * ahí: sin retoque tras "Revisar" (la respuesta correcta se muestra como
 * referencia, nunca como un "fallaste" duro), sin auto-avance por timer.
 *
 * El refranero es folclore de dominio público — no hay autoría ni copyright
 * sobre un dicho tradicional, así que el texto de cada refrán es el dicho
 * real tal como se conoce; las opciones-señuelo son nuestras. La obscuridad
 * escala con el nivel: nivel 1 son dichos de uso diario muy conocidos, nivel
 * 3 son más largos o menos frecuentes en el habla cotidiana (siguen siendo
 * dichos reales y verificados, ninguno inventado).
 *
 * TODOS los dichos de un nivel se juegan en cada pasada, sólo se baraja el
 * ORDEN (mismo criterio que LosOpuestos: se shufflea un array de índices,
 * sin sub-muestreo tipo ROUNDS_PER_LEVEL) — 2/3/3 dichos por nivel (el
 * app-wide default, ver Encaminada.tsx), 8 en total.
 *
 * Conteo de errores unificado entre los dos modos: cada ronda (sea completar
 * con opciones o armar la frase) contribuye como máximo 1 a `mistakes` por
 * intento fallido, así totalAttempts = mistakes + TOTAL_ROUNDS sigue
 * describiendo correctamente las 8 rondas sin importar el modo — no se
 * cuenta por palabra individual en el modo reorder (eso rompería la
 * comparación con el modo fill, que sí cuenta por opción descartada).
 */

interface FillRound {
  before: string
  answer: string
  decoys: string[]
}
interface ReorderRound {
  words: string[]
}
interface FillLevel {
  n: number
  name: string
  mode: 'fill'
  rounds: FillRound[]
}
interface ReorderLevel {
  n: number
  name: string
  mode: 'reorder'
  rounds: ReorderRound[]
}
type Level = FillLevel | ReorderLevel

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    mode: 'fill',
    rounds: [
      { before: 'Más vale pájaro en mano que cien', answer: 'volando', decoys: ['cantando', 'corriendo', 'durmiendo'] },
      { before: 'Perro que ladra no', answer: 'muerde', decoys: ['corre', 'ataca', 'asusta'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    mode: 'fill',
    rounds: [
      { before: 'No hay mal que por bien no', answer: 'venga', decoys: ['pase', 'llegue', 'dure'] },
      { before: 'Dime con quién andas y te diré quién', answer: 'eres', decoys: ['serás', 'fuiste', 'vives'] },
      { before: 'A palabras necias, oídos', answer: 'sordos', decoys: ['cerrados', 'atentos', 'curiosos'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    mode: 'reorder',
    rounds: [
      { words: ['El', 'que', 'se', 'fue', 'a', 'Sevilla', 'perdió', 'su', 'silla'] },
      { words: ['Árbol', 'que', 'nace', 'torcido', 'jamás', 'su', 'tronco', 'endereza'] },
      { words: ['Más', 'sabe', 'el', 'diablo', 'por', 'viejo', 'que', 'por', 'diablo'] },
    ],
  },
]

// Total de dichos a través de los 3 niveles — cada ronda se resuelve tras el
// intento correcto (en el modo fill no hay forma de "rendirse"; en el modo
// reorder no hay reintento tras Revisar), así que totalAttempts = mistakes +
// esta constante.
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
const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria!']
const PRAISE_OK = ['¡Buen intento! Mirá cómo queda el dicho completo.', '¡Casi! Con la práctica te sale cada vez mejor.']

export function DichosAMedias({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Índices barajados, no las rondas en sí — así el mismo memo sirve para
  // cualquiera de los dos modos sin pelear con el union type de Level.
  const order = useMemo(
    () => shuffle(level.rounds.map((_, i) => i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  // Sólo relevante en modo reorder (ver `checked` más abajo) — declarado acá
  // arriba porque `done` lo necesita.
  const [checked, setChecked] = useState(false)
  // "Done" (nivel completo) difiere por modo: en fill, el índice ya avanzó
  // más allá del final apenas se acierta la última ronda (auto-avance con
  // timeout). En reorder no hay auto-avance — el índice de la última ronda
  // se queda quieto hasta que el jugador la revisa, así que done depende de
  // `checked` en vez del índice (mismo criterio que OrdenarLaFrase).
  const done =
    level.mode === 'fill' ? currentIndex >= order.length : checked && currentIndex >= order.length - 1
  const currentRoundIdx = order[currentIndex]

  // ── Estado del modo "fill" (niveles 1-2) ──────────────────────────────
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const fillRound = level.mode === 'fill' && !done ? level.rounds[currentRoundIdx] : null
  const fillOptions = useMemo(
    () => (fillRound ? shuffle([fillRound.answer, ...fillRound.decoys]) : []),
    [fillRound],
  )

  // ── Estado del modo "reorder" (nivel 3) — useSequencingPuzzle se llama
  // siempre (las reglas de hooks lo exigen), con un array vacío cuando el
  // nivel actual no es reorder o ya está done; el resultado simplemente no
  // se usa en ese caso. ─────────────────────────────────────────────────
  const reorderWords = level.mode === 'reorder' && !done ? level.rounds[currentRoundIdx].words : []
  const reorderKey = `${levelIdx}-${roundKey}-${currentIndex}`
  const { bank, placed, place, unplace } = useSequencingPuzzle(reorderWords, reorderKey)
  const [roundPraise, setRoundPraise] = useState(PRAISE_GOOD[0])
  const readyToCheck = level.mode === 'reorder' && bank.length === 0
  const reorderIsCorrect = placed.length > 0 && placed.every((item, i) => item.id === i)

  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  // Acumulado a través de los niveles 1→2→3, sólo se pone en cero en un
  // reinicio real del día (ver la rama isWrap de nextLevel más abajo).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE_GOOD))
  }, [done])

  function guessFill(word: string) {
    if (!fillRound || solved || eliminated.has(word)) return
    if (word === fillRound.answer) {
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

  function checkReorder() {
    const correct = reorderIsCorrect
    setRoundPraise(pickOne(correct ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    if (!correct) setMistakes((m) => m + 1)
  }
  function nextReorderRound() {
    setChecked(false)
    setCurrentIndex((i) => i + 1)
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
    setChecked(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setChecked(false)
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              {level.mode === 'fill' ? '¿Cómo termina el dicho?' : 'Ordená las palabras para armar el dicho'}
            </h2>
            {level.mode === 'reorder' && (
              <p className="mt-2 text-base text-slate-500">Tocalas en el orden que creas correcto.</p>
            )}
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

      {/* ── Modo fill (niveles 1-2) ── */}
      {!done && level.mode === 'fill' && fillRound && (
        <>
          <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-center sm:mt-6">
            <p className="text-lg font-bold leading-snug text-slate-800 sm:text-xl">
              {fillRound.before}{' '}
              <span
                aria-hidden="true"
                className="inline-block h-6 w-20 translate-y-1 rounded-md border-b-4 border-dashed border-tiam-blue/50 align-middle"
              />
              .
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {fillOptions.map((word) => {
              const isEliminated = eliminated.has(word)
              const isSolved = solved && word === fillRound.answer
              return (
                <button
                  key={word}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guessFill(word)}
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

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* ── Modo reorder (nivel 3) ── */}
      {!done && level.mode === 'reorder' && (
        <>
          <div className="mt-6 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {placed.length === 0 && (
              <span className="text-base text-slate-400">Tocá las palabras de abajo para empezar</span>
            )}
            {!checked &&
              placed.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => unplace(item)}
                  className="min-h-[44px] rounded-xl border-2 border-tiam-blue bg-tiam-blue/5 px-4 py-2 text-base font-semibold text-slate-900 transition hover:bg-tiam-blue/10 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                >
                  {item.value}
                </button>
              ))}
            {checked &&
              placed.map((item, i) => {
                const isRight = item.id === i
                return (
                  <span
                    key={item.id}
                    className={[
                      'min-h-[44px] rounded-xl border-2 px-4 py-2 text-base font-semibold',
                      isRight ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : 'border-slate-300 bg-white text-slate-500',
                    ].join(' ')}
                  >
                    {item.value}
                  </span>
                )
              })}
          </div>

          {!checked && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => place(item)}
                  className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {readyToCheck && !checked && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={checkReorder}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Resultado del dicho — igual patrón que OrdenarLaFrase: gateado por
          `checked` solo (no por `!done`), así en la ÚLTIMA ronda del nivel
          (donde `done` ya está activo y el bloque `!done` de arriba dejó de
          renderizar el tablero) este cartel sigue mostrando si ESA ronda
          puntual salió bien o mal — nunca se pierde el resultado individual
          por pasar directo al "nivel completo". */}
      {level.mode === 'reorder' && checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{roundPraise}</p>
          {!reorderIsCorrect && (
            <p className="mt-2 text-slate-600">
              El dicho completo era:{' '}
              <span className="font-semibold text-slate-800">"{level.rounds[currentRoundIdx].words.join(' ')}."</span>
            </p>
          )}
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {done ? (
              <>
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
              </>
            ) : (
              <button
                type="button"
                onClick={nextReorderRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente dicho
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completion — nivel completo, sólo modo fill. En modo reorder el
          cartel de arriba (gateado por `checked`) ya cubre el caso "done"
          mostrando el resultado de la última ronda + los mismos botones. */}
      {done && level.mode === 'fill' && (
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
