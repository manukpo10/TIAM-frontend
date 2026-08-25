import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Marcá los números" — día 6, Mes 3, atención. Reemplaza a
 * NumerosTorcidos.tsx: pedido explícito del usuario a partir de una
 * referencia externa (ejercicio de "atención sostenida" de una guía
 * clínica) — una grilla de números en círculos, tocar todos los que
 * cumplen una regla. Reutiliza el motor de BuscarLosRojos.tsx (un solo
 * tablero por nivel, sin capa de rondas adentro, Set de "encontrados",
 * toque incorrecto = viboreo suave y nunca rojo) cambiando "objeto con
 * color/categoría" por "número con una propiedad".
 *
 * Área cambiada de agnosias (el día 6 original, "Números torcidos", un
 * juego de reconocimiento de números espejados) a atención: escanear una
 * grilla buscando una propiedad es atención sostenida, no reconocimiento
 * perceptivo.
 *
 * SÓLO 2 NIVELES (no los 3 de siempre) — pedido explícito: nivel 1 usa la
 * consigna original de la referencia tal cual ("contiene un 5"); nivel 2
 * usa la MISMA plantilla (grilla de igual tamaño, 6 columnas × 48
 * números) pero cambia la consigna a "es capicúa" (ej. 66). No se agregó
 * un tercer nivel de cosecha propia — no fue pedido.
 *
 * La grilla de la referencia era 10×10 (100 números) — a ese tamaño cada
 * celda mediría ~33px en 375px de ancho, por debajo del mínimo táctil de
 * 44px que usa todo este catálogo (ver BuscarLosRojos.tsx: "Every tile
 * stays at or above the 44px minimum tap target"). Se adaptó a 6 columnas
 * × 8 filas (48 números) — mismo tipo de tarea de escaneo sostenido, en
 * un tamaño que entra cómodo en mobile sin sacrificar el tap target.
 *
 * Los números de nivel 2 reutilizan varios que SÍ contienen un 5 (15, 25,
 * 35, 45, 51-54) como señuelos — es intencional: prueba que el jugador
 * cambió de regla de verdad (atención/flexibilidad cognitiva) y no sigue
 * buscando "cualquier 5" por inercia del nivel anterior. Sólo existen 9
 * capicúas de 2 cifras (11, 22, ..., 99), así que el pool de nivel 2 las
 * repite un par de veces para llegar al mismo total de 48 — es la única
 * forma de mantener "misma plantilla" en tamaño con esta consigna.
 *
 * Ambos pools verificados con un script descartable (mismo criterio que
 * el resto del catálogo): nivel 1 confirma que todo target contiene un 5
 * y ningún señuelo lo contiene; nivel 2 confirma que todo target es
 * capicúa y ningún señuelo lo es, y que ambos suman 48 sin duplicar
 * números dentro del propio pool de señuelos.
 */

interface Level {
  n: number
  name: string
  instruction: string
  wrongHint: string
  isTarget: (value: number) => boolean
  targets: number[]
  decoys: number[]
}

// Todo número de 2 cifras (10-99) que tiene un 5 en cualquier posición.
const N1_TARGETS = [15, 25, 35, 45, 50, 52, 54, 56, 58, 65, 75, 85, 95, 51, 53, 59]
// Ningún 5 en ninguna posición.
const N1_DECOYS = [
  12, 23, 34, 46, 67, 78, 89, 90, 11, 22, 33, 44, 66, 77, 88, 99, 10, 20, 30, 40, 60, 70, 80, 13, 24, 36, 47, 68, 79,
  91, 82, 93,
]

// Las 9 capicúas de 2 cifras posibles, repetidas para llegar a 14 (ver
// comentario de cabecera sobre por qué no hay 16 valores ÚNICOS posibles).
const N2_TARGETS = [11, 22, 33, 44, 55, 66, 77, 88, 99, 11, 22, 33, 44, 66]
// Ninguno es capicúa — incluye a propósito varios "contiene un 5" (15, 25,
// 35, 45, 51-54) como señuelos de cambio de regla (ver cabecera).
const N2_DECOYS = [
  12, 13, 15, 17, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29, 31, 32, 34, 35, 36, 37, 38, 39, 41, 42, 43, 45, 46, 47, 48,
  49, 51, 52, 53, 54,
]

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    instruction: 'Tocá los números que tienen un 5',
    wrongHint: 'Ese número no tiene ningún 5.',
    isTarget: (v) => String(v).includes('5'),
    targets: N1_TARGETS,
    decoys: N1_DECOYS,
  },
  {
    n: 2,
    name: 'Nivel 2',
    instruction: 'Tocá los números capicúa (se leen igual de los dos lados, como 66)',
    wrongHint: 'Ese no es capicúa — las dos cifras tienen que ser iguales.',
    isTarget: (v) => {
      const s = String(v)
      return s.length === 2 && s[0] === s[1]
    },
    targets: N2_TARGETS,
    decoys: N2_DECOYS,
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

const PRAISE = ['¡Muy bien!', '¡Excelente atención!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo!']

export function MarcaLosNumeros({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Tablero (targets + señuelos, barajados juntos) para ESTE nivel, decidido
  // una sola vez al montar — nunca vuelto a barajar por revisitar un nivel,
  // así "Repetir" siempre devuelve el mismo tablero.
  const [epochBoards] = useState(() => LEVELS.map((lvl) => shuffle([...lvl.targets, ...lvl.decoys])))
  const level = LEVELS[levelIdx]
  const board = epochBoards[levelIdx]
  const targetCellKeys = useMemo(() => {
    const keys = new Set<string>()
    board.forEach((value, i) => {
      if (level.isTarget(value)) keys.add(`${value}-${i}`)
    })
    return keys
  }, [board, level])

  const [found, setFound] = useState<Set<string>>(new Set())
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Errores + aciertos, acumulados a través de niveles 1→2 y sólo en cero en
  // un reinicio real del día (restartEpoch) — mismo patrón que BuscarLosRojos.
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)

  const done = found.size === targetCellKeys.size && targetCellKeys.size > 0

  const reset = useCallback(() => {
    setFound(new Set())
    setWrongKey(null)
  }, [])

  const handleTap = useCallback(
    (cellKey: string) => {
      if (targetCellKeys.has(cellKey)) {
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
    [targetCellKeys],
  )

  useEffect(() => {
    if (targetCellKeys.size > 0 && found.size === targetCellKeys.size) {
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    }
  }, [found, targetCellKeys])

  // Resets sincrónicos con el cambio de nivel/ronda — ver BuscarLosRojos.tsx
  // para el motivo de no hacerlo en un efecto separado.
  function advanceLevel() {
    setFoundAcrossLevels((f) => f + found.size)
    reset()
    setLevelIdx((i) => i + 1)
  }
  function restartEpoch() {
    setLevelIdx(0)
    reset()
    setMistakes(0)
    setFoundAcrossLevels(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }

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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{level.instruction}</h2>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Encontraste {found.size} de {targetCellKeys.size}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${targetCellKeys.size ? (found.size / targetCellKeys.size) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tablero */}
      {!done && (
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-6 gap-1.5">
          {board.map((value, i) => {
            const cellKey = `${value}-${i}`
            const isFound = found.has(cellKey)
            const isWrong = wrongKey === cellKey
            return (
              <button
                key={cellKey}
                type="button"
                onClick={() => handleTap(cellKey)}
                aria-label={`Número ${value}`}
                aria-pressed={isFound}
                className={[
                  'relative flex aspect-square min-h-[44px] items-center justify-center rounded-full border-2 bg-white text-sm font-extrabold text-slate-700 transition sm:text-base',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                  isFound
                    ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                    : 'border-tiam-blue/30 hover:-translate-y-0.5 hover:border-tiam-blue/60 hover:shadow-md active:translate-y-0',
                  isWrong ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-300' : '',
                ].join(' ')}
              >
                {value}
                {isFound && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Aviso de toque equivocado */}
      {wrongKey && !done && (
        <p className="mt-4 text-center text-base font-medium text-slate-500">{level.wrongHint} 🙂</p>
      )}

      {/* Resultado */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste los {targetCellKeys.size} — ¡completaste el {level.name.toLowerCase()}!
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
