import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Grid3x3 } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Copiá el patrón" — praxias (praxia construccional), día 26 Mes 3.
 * Reemplaza a ArmaLaEscena.tsx: esa mecánica (tocar partes en un orden que
 * no se veía reflejado en el lienzo) resultó confusa incluso después de dos
 * rondas de arreglos — el jugador no tenía ninguna señal visual ligada al
 * orden real de sus toques hasta tocar "Revisar". Esta es la mecánica
 * clásica de praxia construccional (tipo "diseño con cubos"): un patrón de
 * modelo se mantiene A LA VISTA todo el tiempo al lado de una cuadrícula
 * vacía, y cada toque en la cuadrícula propia se ve en el momento — no hay
 * nada oculto ni ningún orden que adivinar, sólo copiar lo que ya está
 * mirando.
 *
 * Sin banco ni useSequencingPuzzle: acá no hay piezas que colocar en orden,
 * sólo celdas que se prenden o apagan (toggle libre, se puede corregir
 * tocando de nuevo), así que el estado es un Set de claves "fila-columna"
 * en vez de un array ordenado.
 *
 * Los resets van DENTRO de nextRound/advanceLevel/restartEpoch (no en un
 * useEffect aparte) — mismo motivo ya documentado en ElMapaDeLetras.tsx: un
 * efecto separado dependiente de levelIdx dejaría al efecto de onComplete
 * leer un `done` desactualizado justo en el render que llega al nuevo
 * nivel.
 *
 * El área jugable se oculta con `!checked` (no sólo `!done`) para que la
 * cuadrícula no compita por espacio con la tarjeta de Resultado en rondas
 * intermedias — el mismo bug ya corregido en ElPasoAPaso.tsx y ya evitado
 * de entrada en ArmaLaEscena.tsx.
 *
 * Tamaños de cuadrícula fijos (no todo el ancho disponible): el modelo es
 * chico a propósito (es sólo referencia visual, nunca se toca) y la
 * cuadrícula propia se queda con el ancho que necesita para tap targets
 * reales (~44px+) — puestas una al lado de la otra entran cómodas en
 * 375px de ancho sin superponerse ni obligar a hacer scroll.
 */

interface Pattern {
  cells: [number, number][]
}
interface Level {
  n: number
  name: string
  gridSize: number
  rounds: number
  pool: Pattern[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    gridSize: 3,
    rounds: 2,
    pool: [
      { cells: [[0, 0], [1, 1], [2, 2]] },
      { cells: [[0, 2], [1, 1], [2, 0]] },
      { cells: [[0, 0], [0, 1], [0, 2]] },
      { cells: [[2, 0], [2, 1], [2, 2]] },
      { cells: [[0, 0], [1, 0], [2, 0]] },
      { cells: [[0, 2], [1, 2], [2, 2]] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    gridSize: 4,
    rounds: 2,
    pool: [
      { cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
      { cells: [[0, 0], [1, 1], [2, 2], [3, 3]] },
      { cells: [[0, 3], [1, 2], [2, 1], [3, 0]] },
      { cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
      { cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
      { cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    gridSize: 4,
    rounds: 2,
    pool: [
      { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 1], [3, 1]] },
      { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]] },
      { cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]] },
      { cells: [[0, 0], [1, 1], [2, 2], [3, 3], [0, 3], [1, 2], [2, 1], [3, 0]] },
      { cells: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 0], [2, 3], [3, 1], [3, 2]] },
      { cells: [[0, 1], [0, 2], [1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2]] },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Copiaste el patrón exacto!', '¡Excelente ojo!', '¡Así se hace!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo era el patrón correcto.',
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
function cellKey(r: number, c: number): string {
  return `${r}-${c}`
}

const MODEL_WIDTH: Record<number, number> = { 3: 80, 4: 100 }
const PLAYER_WIDTH: Record<number, number> = { 3: 170, 4: 220 }
const ANSWER_WIDTH: Record<number, number> = { 3: 130, 4: 170 }

function PatternGrid({
  gridSize,
  width,
  isOn,
  onTap,
  disabled,
}: {
  gridSize: number
  width: number
  isOn: (r: number, c: number) => boolean
  onTap?: (r: number, c: number) => void
  disabled?: boolean
}) {
  const rows = Array.from({ length: gridSize }, (_, r) => r)
  const cols = Array.from({ length: gridSize }, (_, c) => c)
  return (
    <div
      className={`grid gap-1.5 rounded-xl border-2 p-1.5 ${onTap ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, width }}
    >
      {rows.flatMap((r) =>
        cols.map((c) => {
          const on = isOn(r, c)
          if (!onTap) {
            return (
              <div
                key={cellKey(r, c)}
                className={`aspect-square rounded-sm ${on ? 'bg-tiam-blue' : 'border border-slate-200 bg-white'}`}
              />
            )
          }
          return (
            <button
              key={cellKey(r, c)}
              type="button"
              disabled={disabled}
              onClick={() => onTap(r, c)}
              aria-label={`Celda fila ${r + 1}, columna ${c + 1}`}
              className={[
                'aspect-square min-h-[44px] rounded-md border-2 transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                on
                  ? 'border-tiam-blue bg-tiam-blue'
                  : 'border-slate-200 bg-white hover:border-tiam-blue/40 active:translate-y-0',
              ].join(' ')}
            />
          )
        }),
      )}
    </div>
  )
}

export function CopiaElPatron({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)

  // `rounds` patrones distintos por nivel para ESTA "epoch" — elegidos una
  // sola vez (al montar y en "Hacer otro"), nunca vueltos a tirar por
  // "Repetir" ni por re-visitar un nivel a mitad de epoch. Mismo patrón que
  // ArmaLaEscena.tsx / ElMapaDeLetras.tsx.
  const [epochOrder, setEpochOrder] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
  const level = LEVELS[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const pattern = order[roundIdx]

  const [filled, setFilled] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const targetKeys = useMemo(() => new Set(pattern.cells.map(([r, c]) => cellKey(r, c))), [pattern])
  const mismatchCount = useMemo(() => {
    let m = 0
    for (let r = 0; r < level.gridSize; r++) {
      for (let c = 0; c < level.gridSize; c++) {
        if (targetKeys.has(cellKey(r, c)) !== filled.has(cellKey(r, c))) m++
      }
    }
    return m
  }, [filled, targetKeys, level.gridSize])
  const isCorrect = mismatchCount === 0

  const done = checked && roundIdx >= level.rounds - 1

  function toggleCell(r: number, c: number) {
    if (checked) return
    const key = cellKey(r, c)
    setFilled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    setAccMistakes((m) => m + mismatchCount)
    setAccAttempts((a) => a + level.gridSize * level.gridSize)
  }
  function nextRound() {
    setChecked(false)
    setFilled(new Set())
    setRoundIdx((i) => i + 1)
  }
  function advanceLevel() {
    setChecked(false)
    setFilled(new Set())
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
  }
  function restartEpoch() {
    setChecked(false)
    setFilled(new Set())
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochOrder(LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
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
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Copiá el patrón</h2>
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

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que ArmaLaEscena.tsx. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Grid3x3 className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Mirá el patrón de modelo — se queda a la vista todo el tiempo — y tocá las mismas celdas en tu
            cuadrícula para copiarlo. Cuando estés conforme, tocá &quot;Revisar&quot;.
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

      {phase === 'playing' && !done && !checked && (
        <>
          <div className="mt-4 flex items-start justify-center gap-3">
            <div className="flex flex-col items-center">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Modelo</p>
              <div className="mt-1.5">
                <PatternGrid
                  gridSize={level.gridSize}
                  width={MODEL_WIDTH[level.gridSize]}
                  isOn={(r, c) => targetKeys.has(cellKey(r, c))}
                />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tu cuadrícula</p>
              <div className="mt-1.5">
                <PatternGrid
                  gridSize={level.gridSize}
                  width={PLAYER_WIDTH[level.gridSize]}
                  isOn={(r, c) => filled.has(cellKey(r, c))}
                  onTap={toggleCell}
                  disabled={checked}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={check}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Revisar
            </button>
          </div>
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
            <div className="mt-3 flex flex-col items-center">
              <p className="text-base font-semibold text-slate-700">El patrón correcto era:</p>
              <div className="mt-2">
                <PatternGrid
                  gridSize={level.gridSize}
                  width={ANSWER_WIDTH[level.gridSize]}
                  isOn={(r, c) => targetKeys.has(cellKey(r, c))}
                />
              </div>
            </div>
          )}
          {!done ? (
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente patrón
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
