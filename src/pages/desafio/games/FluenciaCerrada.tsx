import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Fluencia cerrada" — día 14 (mes 2), lenguaje. Versión de RECONOCIMIENTO
 * (closed-set) de una tarea de fluencia verbal: en vez de pedir que la
 * persona GENERE palabras que contengan una combinación de letras (fluencia
 * libre, con el sesgo de "no se me ocurre nada" que eso trae), se muestran
 * 12 palabras candidatas y hay que tocar TODAS las que contienen la
 * combinación pedida (p. ej. "RA"). Deliberadamente NO es texto libre — así
 * lo pide el brief para este día en particular.
 *
 * Motor calcado de "Buscá los rojos" (BuscarLosRojos.tsx, día 24 del mes 1):
 * mismo mecanismo de selección múltiple sobre una grilla (tocar todos los
 * que cumplen el criterio), sin cronómetro nunca, un toque incorrecto sólo
 * hace un `wiggle` (nunca pinta de rojo) y queda completo cuando
 * `found.size === targetIds.size`. Acá el "criterio de búsqueda" es léxico
 * (contiene la sub-cadena X) en vez de visual (es rojo), así que el tablero
 * es texto puro — no hace falta ilustrar nada.
 *
 * Cada nivel trae un pool de 8 palabras-objetivo y 8 señuelos; cada partida
 * sortea 6 + 6 = 12 candidatas (igual que BuscarLosRojos, para que una
 * repetición del día no muestre siempre las mismas 12). La dificultad escala
 * con la "cercanía" de los señuelos: nivel 1 casi no tiene señuelos con
 * letras parecidas a la combinación pedida, nivel 3 mete señuelos que
 * terminan en el mismo par de letras invertido (TERRENO/ENANO/NOCHE/CANOA
 * todas tienen "NO" pero no "ON") para que no alcance con un vistazo rápido.
 * Todas las palabras fueron verificadas letra por letra para confirmar que
 * SÍ (u objetivamente NO) contienen la combinación pedida.
 */

interface Level {
  n: number
  name: string
  target: string
  targetPool: string[]
  distractorPool: string[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    target: 'RA',
    targetPool: ['CARA', 'GRANDE', 'TRABAJO', 'NARANJA', 'BARATO', 'RATON', 'DRAGON', 'TRAJE'],
    distractorPool: ['CARTA', 'PARQUE', 'MESA', 'LIBRO', 'PERRO', 'TIGRE', 'CAMPO', 'TORRE'],
  },
  {
    n: 2,
    name: 'Nivel 2',
    target: 'AL',
    targetPool: ['SALTO', 'ANIMAL', 'CALOR', 'HOSPITAL', 'MALETA', 'ALTO', 'SALIDA', 'REGALO'],
    distractorPool: ['LATA', 'PLATO', 'SILLA', 'COLOR', 'FIESTA', 'LUNA', 'CIELO', 'ABUELA'],
  },
  {
    n: 3,
    name: 'Nivel 3',
    target: 'ON',
    targetPool: ['BOMBON', 'CORAZON', 'LEON', 'JABON', 'CAMION', 'BOTON', 'MELON', 'LIMON'],
    distractorPool: ['TERRENO', 'ENANO', 'NOCHE', 'CANOA', 'MUNDO', 'PARED', 'VECINO', 'CAMINO'],
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
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena búsqueda!']

export function FluenciaCerrada({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // 6 objetivo + 6 señuelos, sorteados de los pools de 8 — una repetición del
  // nivel sirve una mezcla distinta (mismo criterio que BuscarLosRojos).
  const board = useMemo(
    () => shuffle([...pick(level.targetPool, 6), ...pick(level.distractorPool, 6)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const targetIds = useMemo(() => new Set(board.filter((w) => level.targetPool.includes(w))), [board, level])

  const [found, setFound] = useState<Set<string>>(new Set())
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Mistakes + aciertos, acumulados a través de los niveles 1→2→3 y sólo
  // puestos en cero en un reinicio real del día (ver isWrap en nextLevel).
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)

  const done = found.size === targetIds.size && targetIds.size > 0

  const reset = useCallback(() => {
    setFound(new Set())
    setWrongKey(null)
  }, [])

  const handleTap = useCallback(
    (word: string, cellKey: string) => {
      if (targetIds.has(word)) {
        setFound((prev) => {
          if (prev.has(cellKey)) return prev
          const next = new Set(prev)
          next.add(cellKey)
          return next
        })
      } else {
        setWrongKey(cellKey)
        setMistakes((m) => m + 1)
        window.setTimeout(() => setWrongKey((w) => (w === cellKey ? null : w)), 500)
      }
    },
    [targetIds],
  )

  useEffect(() => {
    if (targetIds.size > 0 && found.size === targetIds.size) {
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    }
  }, [found, targetIds])

  // isWrap resets sincrónicos acá mismo, en el mismo handler que cambia
  // levelIdx/roundKey — nunca en un efecto separado (que llegaría un render
  // tarde y dejaría `done` leyendo el estado viejo justo al llegar al nuevo
  // nivel, disparando onComplete con basura antes de que la persona toque
  // nada — misma disciplina que BuscarLosRojos).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setFoundAcrossLevels((f) => f + found.size)
    reset()
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    if (isWrap) {
      setMistakes(0)
      setFoundAcrossLevels(0)
    }
  }
  function replay() {
    reset()
    setRoundKey((k) => k + 1)
  }

  // Dispara una vez por roundKey cuando el nivel 3 se completa.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + foundAcrossLevels + found.size })
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
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          Tocá todas las palabras que tienen <span className="text-tiam-blue">&quot;{level.target}&quot;</span>
        </h2>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Encontraste {found.size} de {targetIds.size}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${targetIds.size ? (found.size / targetIds.size) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {board.map((word, i) => {
          const cellKey = `${word}-${i}`
          const isFound = found.has(cellKey)
          const isWrong = wrongKey === cellKey
          return (
            <button
              key={cellKey}
              type="button"
              onClick={() => handleTap(word, cellKey)}
              aria-pressed={isFound}
              className={[
                'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 bg-white p-2 text-center transition sm:min-h-[64px]',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                isFound
                  ? 'border-tiam-green ring-2 ring-tiam-green/30'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out]' : '',
              ].join(' ')}
            >
              <span className="text-base font-bold text-slate-700 sm:text-lg">{word}</span>
              {isFound && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {wrongKey && !done && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">
          Esa no tiene &quot;{level.target}&quot;, ¡probá con otra!
        </p>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste las {targetIds.size} — ¡completaste el {level.name.toLowerCase()}!
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
              Jugar esta ronda otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
