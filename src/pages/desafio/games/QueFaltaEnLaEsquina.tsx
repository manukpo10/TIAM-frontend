import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check, Puzzle } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué falta en la esquina?" — día 22, agnosias.
 *
 * A pedido explícito del usuario ("quiero que sea un rompecabezas y que lo
 * arme") se pasó de una tarea de reconocimiento (elegir, entre 3 recortes,
 * cuál completa la ÚNICA esquina tapada) a una de armado real: la foto
 * completa se corta en piezas y el jugador arma el rompecabezas entero,
 * tocando una pieza del banco y después el casillero donde cree que va. El
 * banco mezcla las piezas reales con señuelos — piezas de OTROS objetos —
 * así armar sigue exigiendo distinguir "¿es esta foto o no?" además de
 * "¿en qué lugar va?".
 *
 * Grilla variable por nivel (`gridRows`×`gridCols`, ver `Level`) — a pedido
 * explícito ("que sean más difíciles, pueden ser con más imágenes"): nivel 1
 * sigue en 2×2 (4 piezas), nivel 2 sube a 2×3 (6) y nivel 3 a 3×3 (9). La
 * dificultad ya no viene sólo de qué tan parecidos son los señuelos (eso
 * sigue igual: misma familia de color = más difícil) sino TAMBIÉN de cuántas
 * piezas hay que ubicar.
 *
 * Catálogo de fotos (`OBJECTS`) curado a mano — ver el comentario ahí mismo:
 * 4 objetos (frutilla, pepino, maíz, calabaza) se sacaron porque sus fotos
 * dejaban piezas ENTERAS en blanco al cortar en grillas finas. Se probó
 * agrandar el recorte con zoom en vez de sacarlas, pero cambiaba el
 * encuadre de TODAS las piezas (no sólo las rotas) y no era el resultado
 * buscado — a pedido explícito se volvió al recorte 1:1 de siempre y se
 * arregló el catálogo, no el recorte.
 *
 * Las piezas se cortan en el momento con CSS, directamente de la foto
 * completa que YA existe (`imgFor`) — no hace falta ningún asset nuevo. Una
 * pieza es un <img> de tamaño `cols`×`rows` veces el de su casillero (mismo
 * recorte `object-cover` que usa el resto de la app para estas fotos, así
 * respeta el encuadre real sin depender de que la foto sea cuadrada) puesto
 * dentro de un contenedor `overflow-hidden` del tamaño de un casillero,
 * desplazado con margin negativo según fila/columna. (Los recortes
 * -corner-*.webp pre-generados que usaba la versión anterior quedaron sin
 * usar en este archivo — no se tocaron, por si algo más los necesita.)
 *
 * Colocación de a una pieza por vez, validada al toque (mismo patrón que
 * CrucigramaDeCifras): tocás una pieza del banco y después el casillero —
 * si es la pieza real Y el casillero correcto, encaja; si no, un aviso
 * suave y la pieza vuelve al banco (nunca desaparece — los señuelos se
 * quedan disponibles para TODAS las colocaciones, no sólo la primera).
 *
 * Instrucción dinámica de 2 pasos ("Primero tocá una pieza" / "Ahora tocá
 * dónde va", ver el texto justo arriba del marco) — a pedido explícito del
 * usuario, para que quede claro el orden de los dos toques sin depender de
 * que el adulto mayor recuerde la explicación de la pantalla "¿Listo?".
 *
 * Nunca rojo, sin timer, siempre reintentable.
 */

interface ImgObject {
  slug: string
  category: 'rojo' | 'verde' | 'amarillo' | 'naranja' | 'marron'
}

// frutilla, pepino, maíz y calabaza SACADOS a propósito: sus fotos tienen
// el objeto chico/angosto sobre fondo blanco, y al cortarlas en grillas
// finas (2×3, 3×3) quedaban columnas o esquinas ENTERAS en blanco — piezas
// sin ningún contenido real, imposibles de distinguir entre sí. Se probó
// (y se descartó) agrandar el recorte con zoom antes de cortar: funcionaba
// pero cambiaba cómo se ve cada pieza en TODAS las fotos, no sólo en las
// rotas, y no era el resultado que se quería. No hay fotos de repuesto para
// esas 4 categorías en este set (ver carpeta de assets) — hasta que haya
// una foto nueva con el objeto llenando más el cuadro, quedan afuera.
const OBJECTS: ImgObject[] = [
  { slug: 'manzana-roja', category: 'rojo' },
  { slug: 'tomate', category: 'rojo' },
  { slug: 'pimiento-rojo', category: 'rojo' },

  { slug: 'manzana-verde', category: 'verde' },
  { slug: 'pimiento-verde', category: 'verde' },
  { slug: 'lima', category: 'verde' },

  { slug: 'banana', category: 'amarillo' },
  { slug: 'limon', category: 'amarillo' },
  { slug: 'pimiento-amarillo', category: 'amarillo' },

  { slug: 'naranja', category: 'naranja' },
  { slug: 'zanahoria', category: 'naranja' },
  { slug: 'damasco', category: 'naranja' },

  { slug: 'nuez', category: 'marron' },
  { slug: 'castana', category: 'marron' },
  { slug: 'papa', category: 'marron' },
  { slug: 'pan', category: 'marron' },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-falta-en-la-esquina/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(slug: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${slug}.webp`))?.[1]
}

interface GridPos {
  row: number
  col: number
}
function posKey(pos: GridPos): string {
  return `${pos.row}-${pos.col}`
}
function allPositions(rows: number, cols: number): GridPos[] {
  const out: GridPos[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out.push({ row: r, col: c })
  }
  return out
}

// Tamaño fijo de casillero/pieza, en los 3 niveles — así nivel 3 (3×3 = 9
// piezas + hasta 3 señuelos en el banco) entra sin scroll en 375×812.
const PIECE_SIZE = 68

function PieceImage({ slug, row, col, rows, cols }: { slug: string; row: number; col: number; rows: number; cols: number }) {
  return (
    <div style={{ width: PIECE_SIZE, height: PIECE_SIZE }} className="overflow-hidden">
      <img
        src={imgFor(slug)}
        alt=""
        draggable={false}
        style={{
          width: PIECE_SIZE * cols,
          height: PIECE_SIZE * rows,
          marginLeft: -PIECE_SIZE * col,
          marginTop: -PIECE_SIZE * row,
        }}
        className="max-w-none max-h-none object-cover"
      />
    </div>
  )
}

type Difficulty = 'easy' | 'mixed' | 'hard'
interface Level {
  n: number
  name: string
  rounds: number
  difficulty: Difficulty
  gridRows: number
  gridCols: number
  decoyCount: number
}
// decoyCount de nivel 3 en 2, no 3: 'hard' saca señuelos SÓLO de la misma
// familia de color, y tras sacar los 4 objetos con fragmentos en blanco
// (ver comentario de OBJECTS) la familia más chica quedó en 3 miembros —
// el objetivo + 2 disponibles. Pedir 3 señuelos ahí dejaría a esas familias
// con un señuelo menos que las demás; 2 es el máximo que TODAS soportan
// parejo.
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, difficulty: 'easy', gridRows: 2, gridCols: 2, decoyCount: 2 },
  { n: 2, name: 'Nivel 2', rounds: 2, difficulty: 'mixed', gridRows: 2, gridCols: 3, decoyCount: 3 },
  { n: 3, name: 'Nivel 3', rounds: 2, difficulty: 'hard', gridRows: 3, gridCols: 3, decoyCount: 2 },
]
// Cada ronda exige tantas colocaciones correctas como piezas tenga su
// grilla — el denominador de "intentos totales" tiene que sumar eso por
// nivel (4, 6 y 9), no un número fijo, ahora que la grilla escala.
const TOTAL_REQUIRED_PLACEMENTS = LEVELS.reduce((sum, l) => sum + l.rounds * l.gridRows * l.gridCols, 0)
const ACCENT = '#D97706' // ámbar

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface DecoyPiece {
  obj: ImgObject
  pos: GridPos
}
interface Round {
  target: ImgObject
  decoyPieces: DecoyPiece[]
  key: string
}
// Nivel 1: señuelos de otra familia de color (fácil, saltan a la vista).
// Nivel 3: señuelos de la MISMA familia (difícil, el color no alcanza).
function pickDecoys(target: ImgObject, difficulty: Difficulty, count: number): ImgObject[] {
  const others = OBJECTS.filter((o) => o.slug !== target.slug)
  const same = others.filter((o) => o.category === target.category)
  const diff = others.filter((o) => o.category !== target.category)
  if (difficulty === 'easy') return pick(diff, count)
  if (difficulty === 'hard') return pick(same, count)
  const sameCount = Math.ceil(count / 2)
  return [...pick(same, sameCount), ...pick(diff, count - sameCount)]
}
function buildOnce(level: Level): Round {
  const target = pickOne(OBJECTS)
  const decoyObjs = pickDecoys(target, level.difficulty, level.decoyCount)
  const positions = allPositions(level.gridRows, level.gridCols)
  const decoyPieces = decoyObjs.map((obj) => ({ obj, pos: pickOne(positions) }))
  return { target, decoyPieces, key: target.slug }
}
function makeRound(level: Level, avoidKey?: string): Round {
  let round = buildOnce(level)
  let guard = 0
  while (avoidKey && round.key === avoidKey && guard < 10) {
    round = buildOnce(level)
    guard++
  }
  return round
}
function makeLevelRounds(level: Level): Round[] {
  const rounds: Round[] = []
  for (let i = 0; i < level.rounds; i++) {
    rounds.push(makeRound(level, rounds[i - 1]?.key))
  }
  return rounds
}

interface BankPiece {
  id: string
  slug: string
  pos: GridPos
  isReal: boolean
}
function buildBank(round: Round, level: Level): BankPiece[] {
  const real: BankPiece[] = allPositions(level.gridRows, level.gridCols).map((pos) => ({
    id: `real-${posKey(pos)}`,
    slug: round.target.slug,
    pos,
    isReal: true,
  }))
  const decoys: BankPiece[] = round.decoyPieces.map((d, i) => ({
    id: `decoy-${i}`,
    slug: d.obj.slug,
    pos: d.pos,
    isReal: false,
  }))
  return shuffle([...real, ...decoys])
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!']
const HINTS = [
  'Ese pedacito no va ahí — fijate el color y la forma.',
  'Casi. Mirá bien de qué parte de la foto es ese pedacito.',
  'No es ese lugar — pensá qué parte de la foto le corresponde.',
]

export function QueFaltaEnLaEsquina({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochRounds] = useState(() => LEVELS.map((lvl) => makeLevelRounds(lvl)))
  const level = LEVELS[levelIdx]
  const rounds = epochRounds[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= level.rounds
  const totalPieces = level.gridRows * level.gridCols

  // Banco estable por ronda: `round` sólo cambia de referencia cuando
  // levelIdx/roundIdx avanzan (epochRounds, más abajo, se decide una única
  // vez al montar) — mismo patrón que CruceDeLetras.tsx.
  const allPieces = useMemo(() => (round ? buildBank(round, level) : []), [round, level])

  const [placedPositions, setPlacedPositions] = useState<Set<string>>(new Set())
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)

  const resolved = placedPositions.size === totalPieces
  // Sólo las piezas reales YA colocadas salen del banco — los señuelos se
  // quedan siempre (ver comentario de cabecera).
  const bank = allPieces.filter((p) => !(p.isReal && placedPositions.has(posKey(p.pos))))

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function selectPiece(id: string) {
    if (resolved) return
    setSelectedPieceId((prev) => (prev === id ? null : id))
  }

  function attemptSlot(slotPos: GridPos) {
    if (!round || resolved || placedPositions.has(posKey(slotPos)) || !selectedPieceId) return
    const piece = bank.find((p) => p.id === selectedPieceId)
    if (!piece) return
    if (piece.isReal && piece.pos.row === slotPos.row && piece.pos.col === slotPos.col) {
      setHint(null)
      setSelectedPieceId(null)
      const next = new Set(placedPositions).add(posKey(slotPos))
      setPlacedPositions(next)
      if (next.size === totalPieces) {
        // Un poco más que el resto del catálogo: da tiempo a ver el
        // rompecabezas completo armado antes de pasar a la próxima ronda.
        window.setTimeout(() => {
          setRoundIdx((i) => i + 1)
          setPlacedPositions(new Set())
          setSelectedPieceId(null)
          setHint(null)
        }, 900)
      }
      return
    }
    setSelectedPieceId(null)
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setRoundIdx(0)
    setPlacedPositions(new Set())
    setSelectedPieceId(null)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundIdx(0)
    setPlacedPositions(new Set())
    setSelectedPieceId(null)
    setHint(null)
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
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_REQUIRED_PLACEMENTS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: ACCENT }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Armá el rompecabezas</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%`, backgroundColor: ACCENT }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Puzzle className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a armar una foto en pedacitos. Primero tocá un pedacito del banco de abajo. Después tocá el lugar del
            rompecabezas donde creas que va. Ojo: hay pedacitos de otras fotos mezclados, para despistar.
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

      {phase === 'playing' && !done && round && (
        <>
          {/* Instrucción de 2 pasos, dinámica según si hay una pieza
              seleccionada — refuerza el orden del toque en cada ronda, no
              sólo una vez en la pantalla "¿Listo?". */}
          {!resolved && (
            <p className="mt-4 text-center text-sm font-semibold text-tiam-blue">
              {selectedPieceId ? 'Ahora tocá el lugar del rompecabezas donde va' : 'Primero tocá un pedacito del banco'}
            </p>
          )}

          {/* Marco del rompecabezas: casilleros vacíos que se van llenando. */}
          <div
            className="mx-auto mt-3 grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${level.gridCols}, ${PIECE_SIZE}px)`,
              width: level.gridCols * PIECE_SIZE + (level.gridCols - 1) * 4,
            }}
          >
            {allPositions(level.gridRows, level.gridCols).map((pos) => {
              const key = posKey(pos)
              const filled = placedPositions.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={filled || resolved}
                  onClick={() => attemptSlot(pos)}
                  aria-label={filled ? 'Casillero completo' : 'Casillero vacío'}
                  style={{ width: PIECE_SIZE, height: PIECE_SIZE }}
                  className={[
                    'relative flex items-center justify-center overflow-hidden rounded-xl border-2 transition',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    filled ? 'border-tiam-green' : 'border-dashed border-slate-300 bg-slate-50 hover:border-tiam-blue/40',
                  ].join(' ')}
                >
                  {filled && (
                    <>
                      <PieceImage slug={round.target.slug} row={pos.row} col={pos.col} rows={level.gridRows} cols={level.gridCols} />
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {/* Banco de piezas: reales + señuelos, mezclados. */}
          {!resolved && (
            <div className="mx-auto mt-5 flex max-w-xs flex-wrap items-center justify-center gap-2 sm:mt-6">
              {bank.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => selectPiece(piece.id)}
                  aria-label="Pedacito de rompecabezas"
                  style={{ width: PIECE_SIZE, height: PIECE_SIZE }}
                  className={[
                    'relative overflow-hidden rounded-xl border-2 bg-white transition',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1',
                    selectedPieceId === piece.id
                      ? 'border-tiam-blue ring-2 ring-tiam-blue/30'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <PieceImage slug={piece.slug} row={piece.pos.row} col={piece.pos.col} rows={level.gridRows} cols={level.gridCols} />
                </button>
              ))}
            </div>
          )}

          {hint && !resolved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {phase === 'playing' && done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Armaste los {level.rounds} rompecabezas — terminaste el {level.name.toLowerCase()}!
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
