import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Grid3x3, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cruce de letras" — día 1, lenguaje. A word-square puzzle: the player taps
 * fichas (whole words at niveles 1-2, 2-letter fragments at nivel 3) in the
 * order they belong so that, once the grid fills, BOTH the rows and the
 * columns spell valid Spanish words. Every grid below is a genuine symmetric
 * word square (grid[i][j] === grid[j][i]), hand-verified letter by letter —
 * that symmetry is what guarantees the columns spell real words too, since
 * column i is then identical to row i.
 *
 * FILA 0 VIENE DADA (pre-llena, no interactiva) — no es sólo un adorno, es lo
 * que hace el rompecabezas resoluble de verdad. Antes la fila 0 era una ficha
 * más para ordenar y el jugador no tenía NINGUNA forma de deducir el orden
 * correcto sin probar a ciegas las N! combinaciones (imposible en nivel 3,
 * con 8 fragmentos). Por la simetría grid[i][j] === grid[j][i], la columna 0
 * es idéntica a la fila 0 — así que la letra i de la fila 0 dice, siempre,
 * con qué letra tiene que EMPEZAR la fila i. Mostrar la fila 0 convierte "ir
 * probando a ciegas" en una estrategia real y enseñable (ver `pistaTexto`),
 * y reduce el espacio de búsqueda de N! a (N-1)!.
 *
 * Placement es tap-to-append sólo para las filas 1..N-1 (tap una ficha del
 * banco → llena el próximo casillero vacío en orden de lectura; tap una
 * ficha puesta → vuelve al banco), misma disciplina que QuePalabraSeEsconde/
 * DosPistas generalizada de letras sueltas a fichas de palabra o de 2 letras.
 * Auto-checks el instante en que se llena el último casillero jugable, mismo
 * checkedRef guard que los juegos hermanos. Un intento incorrecto da un aviso
 * suave y las fichas quedan donde estaban (nunca se barren), así el jugador
 * puede deshacer sólo la que ve mal.
 *
 * Nivel 1 (3×3, mode 'word'): each row IS one ficha — a 3-letter word can't
 * split into two >=2-letter fragments, so the whole-word ficha is the only
 * shape that fits "fragmentos de 2-4 letras." Nivel 2 (4×4, mode 'word')
 * keeps whole-word fichas but a bigger grid (4 to order instead of 3).
 * Nivel 3 (4×4, mode 'fragment') splits each 4-letter row into two 2-letter
 * fichas (8 total instead of 4), which is where "más ambigüedad" actually
 * comes from — more, smaller pieces to place correctly.
 *
 * ROUNDS_PER_LEVEL is [2, 1, 1], not the usual 2-per-level: a valid 4×4
 * SYMMETRIC word square in Spanish is a hard constraint (four crossing
 * words, hand-verified), and shipping a second, hastily-checked one risks
 * teaching a wrong "word." One well-verified grid per 4×4 level is safer
 * than two rushed ones. Nivel 1's 3×3 squares are far easier to verify by
 * hand, so it keeps 2 rounds. Every round still resolves via a genuine
 * correct check (no give-up path), so totalAttempts = mistakes + TOTAL_ROUNDS.
 */

interface SquareGrid {
  rows: string[]
}
interface SquareLevel {
  n: number
  name: string
  size: 3 | 4
  mode: 'word' | 'fragment'
  grids: SquareGrid[]
}

const LEVELS: SquareLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    size: 3,
    mode: 'word',
    grids: [{ rows: ['ASA', 'SOL', 'ALA'] }, { rows: ['OSO', 'SUR', 'ORO'] }],
  },
  {
    n: 2,
    name: 'Nivel 2',
    size: 4,
    mode: 'word',
    grids: [{ rows: ['AMOR', 'MESA', 'OSAR', 'RARO'] }],
  },
  {
    n: 3,
    name: 'Nivel 3',
    size: 4,
    mode: 'fragment',
    grids: [{ rows: ['SALA', 'AJOS', 'LOMA', 'ASAS'] }],
  },
]

// Deviates from the 2-rounds-per-level default — ver el comentario de
// cabecera: el costo de verificar a mano una grilla 4×4 simétrica adicional
// no vale la pena frente al riesgo de un error de contenido.
const ROUNDS_PER_LEVEL = [2, 1, 1]
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

// La secuencia CANÓNICA en la que hay que tocar las fichas: en 'word', una
// por fila; en 'fragment', las dos mitades de cada fila en orden.
function fragmentsFor(grid: SquareGrid, mode: 'word' | 'fragment'): string[] {
  if (mode === 'word') return grid.rows
  return grid.rows.flatMap((r) => [r.slice(0, 2), r.slice(2)])
}
function slotsPerRowFor(mode: 'word' | 'fragment'): number {
  return mode === 'word' ? 1 : 2
}

interface Tile {
  id: number
  value: string
}
function buildTiles(sequence: string[]): Tile[] {
  return shuffle(sequence.map((value, id) => ({ id, value })))
}

const PRAISE_GOOD = ['¡Grilla completa!', '¡Así se arma!', '¡Muy bien resuelto!', '¡Perfecto, encajó todo!']
// Nunca roja: un intento incorrecto siempre es reintentable.
const NUDGE_MESSAGES = [
  'Todavía no encajan. Mirá la primera fila: te dice con qué letra tiene que empezar cada una de las otras.',
  'Casi. Alguna ficha no fue al lugar correcto — tocala para sacarla y probá de nuevo.',
  'Esa combinación no arma las palabras. Fijate la letra de la primera fila que está en esa misma columna.',
]

export function CruceDeLetras({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Qué grilla(s) juega cada nivel esta "época" — decidido una vez por época,
  // al montar, nunca al re-visitar un nivel, así "Repetir" siempre devuelve
  // la misma grilla.
  const [epochEntries] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.grids).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const roundEntries = epochEntries[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const entry = roundEntries[roundIdx]

  const canonicalSequence = useMemo(() => fragmentsFor(entry, level.mode), [entry, level.mode])
  const slotsPerRow = slotsPerRowFor(level.mode)
  // Fila 0 viene dada (ver comentario de cabecera) — sólo las filas 1..N-1
  // son fichas para tocar.
  const givenSequence = useMemo(() => canonicalSequence.slice(0, slotsPerRow), [canonicalSequence, slotsPerRow])
  const playableSequence = useMemo(() => canonicalSequence.slice(slotsPerRow), [canonicalSequence, slotsPerRow])
  // Fichas de la ronda, estables dentro de ella; se rearman al cambiar de
  // ronda/nivel. `placedIds` se resetea SINCRÓNICAMENTE en los handlers de
  // abajo, nunca en un efecto — misma disciplina que QuePalabraSeEsconde.tsx.
  const tiles = useMemo(
    () => buildTiles(playableSequence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )
  const [placedIds, setPlacedIds] = useState<number[]>([])
  const placed = placedIds.map((id) => tiles.find((t) => t.id === id)).filter((t): t is Tile => !!t)
  const bank = tiles.filter((t) => !placedIds.includes(t.id))
  const readyToCheck = placed.length === playableSequence.length

  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [mistakes, setMistakes] = useState(0)

  const done = resolved && roundIdx >= roundsForLevel - 1

  function handlePlace(item: Tile) {
    if (resolved || placed.length >= playableSequence.length) return
    setHint(null)
    setPlacedIds((ids) => [...ids, item.id])
  }
  function handleUnplace(item: Tile) {
    if (resolved) return
    setHint(null)
    setPlacedIds((ids) => ids.filter((i) => i !== item.id))
  }

  function check() {
    if (!readyToCheck) return
    const ok = placed.every((item, i) => item.value === playableSequence[i])
    if (ok) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE_MESSAGES))
      setMistakes((m) => m + 1)
      // Las fichas quedan donde están — un error no barre todo lo puesto.
    }
  }

  const checkedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!readyToCheck) {
      checkedRef.current = null
      return
    }
    const key = placedIds.join(',')
    if (checkedRef.current === key) return
    checkedRef.current = key
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedIds, readyToCheck])

  function nextRound() {
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setRoundIdx((i) => i + 1)
  }
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setRoundIdx(0)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setResolved(false)
    setHint(null)
    setPlacedIds([])
    setRoundIdx(0)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }
  function restartSame() {
    restartEpoch()
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  const lettersPerSlot = level.mode === 'word' ? level.size : 2

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {phase === 'playing' && !done && roundsForLevel > 1 && (
          <>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {roundsForLevel}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez por día, saca la instrucción general del
          header persistente — mismo motivo que QuePalabraSeEsconde.tsx: es
          lo que le deja aire a nivel 3 (4×4 en modo fragmento, el estado más
          cargado) para entrar en 375×812 sin scroll. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Grid3x3 className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a armar una grilla de letras. La primera fila ya está puesta, de pista. Tocá las fichas para que las
            demás filas, leídas hacia abajo en cada columna, formen la MISMA palabra que esa primera fila — por eso
            cada letra de la primera fila te dice con qué letra tiene que empezar la fila de esa columna. Si te
            equivocás no pasa nada: tocá una ficha puesta para sacarla y probá otro orden.
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
          {/* Grilla: se queda visible (y en verde) cuando resolved, igual que
              el renglón de palabra de QuePalabraSeEsconde/DosPistas — sólo
              desaparece al completar el nivel entero. Fila 0 viene dada
              (ver comentario de cabecera) — no es una ficha para tocar, es
              la pista que hace el resto deducible. */}
          <p className="mt-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
            Primera fila — pista
          </p>
          <div className="mt-4 flex flex-col items-center gap-1.5">
            {Array.from({ length: level.size }).map((_, r) => (
              <div key={r} className="flex gap-2">
                {Array.from({ length: slotsPerRow }).map((_, h) => {
                  if (r === 0) {
                    const value = givenSequence[h]
                    return (
                      <span key={h} className="flex gap-1">
                        {value.split('').map((ch, k) => (
                          <span
                            key={k}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-slate-300 bg-slate-100 text-lg font-extrabold uppercase text-slate-500"
                          >
                            {ch}
                          </span>
                        ))}
                      </span>
                    )
                  }
                  const slotIdx = (r - 1) * slotsPerRow + h
                  const tile = placed[slotIdx]
                  if (!tile) {
                    return (
                      <span key={h} className="flex gap-1">
                        {Array.from({ length: lettersPerSlot }).map((_, k) => (
                          <span
                            key={k}
                            aria-hidden="true"
                            className="h-11 w-11 rounded-lg border-2 border-dashed border-slate-300 bg-white"
                          />
                        ))}
                      </span>
                    )
                  }
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={resolved}
                      onClick={() => handleUnplace(tile)}
                      aria-label={`Quitar ${tile.value}`}
                      className="flex gap-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                    >
                      {tile.value.split('').map((ch, k) => (
                        <span
                          key={k}
                          className={[
                            'flex h-11 w-11 items-center justify-center rounded-lg border-2 text-lg font-extrabold uppercase transition',
                            resolved
                              ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                              : 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10',
                          ].join(' ')}
                        >
                          {ch}
                        </span>
                      ))}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Tarjeta "todavía no" — mismo contrato que los hermanos: nunca
              roja, se queda hasta que tocan una ficha. */}
          {hint && !resolved && (
            <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                <RotateCcw className="h-6 w-6 text-tiam-orange" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">Todavía no encajan</p>
              <p className="mt-1 text-slate-600">{hint}</p>
            </div>
          )}

          {!resolved && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlace(item)}
                  aria-label={`Ficha ${item.value}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-xl font-extrabold uppercase text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Result */}
      {resolved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Las palabras eran <span className="font-semibold text-slate-800">{entry.rows.join(', ')}</span> — se leen
            igual en las filas y en las columnas.
          </p>
          {done && <p className="mt-1 text-slate-600">Completaste el nivel {levelIdx + 1}.</p>}
          {!done ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente grilla
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
