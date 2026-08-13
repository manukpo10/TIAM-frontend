import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Search } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Sopa de letras" — buscador de palabras clásico, pure text, tema
 * instrumentos musicales (elegido por no repetir comida/mercado/transporte,
 * ya usados en otros días del catálogo).
 *
 * Una sola grilla por nivel — la mecánica de sopa de letras YA es "encontrar
 * N palabras en un tablero", el equivalente natural a "rondas" acá (ver
 * REGLAS del batch: "salvo que la mecánica pida otra cosa"). Nivel 1 y 2
 * solo horizontal/vertical; nivel 3 suma diagonal, con grilla 10×10 (techo
 * duro del presupuesto mobile). El tablero se arma una vez por epoch (al
 * montar y de nuevo en "Hacer otro"), nunca se vuelve a sortear por
 * revisitar un nivel, así "Repetir" devuelve exactamente el mismo tablero —
 * mismo patrón que LaIntrusa.
 *
 * Selección: tocar-y-arrastrar con Pointer Events SIN pointer capture — así
 * los eventos de pointermove/pointerup siguen naturalmente a la celda real
 * bajo el dedo/mouse, resuelta en cada movimiento con elementFromPoint. Un
 * arrastre que no coincide con ninguna palabra pendiente hace un wiggle
 * suave (nunca rojo, siempre reintentable) y se libera solo — jamás bloquea
 * el tablero ni resta intentos futuros.
 */

const L1_WORDS = ['ARPA', 'TUBA', 'PIANO', 'CAJON', 'TAMBOR']
const L2_WORDS = ['OBOE', 'BOMBO', 'FLAUTA', 'ORGANO', 'VIOLIN', 'SAXOFON']
const L3_WORDS = ['BATERIA', 'MARACAS', 'GUITARRA', 'TROMPETA', 'ACORDEON', 'CHARANGO', 'BANDONEON']

interface Level {
  n: number
  name: string
  instruction: string
  words: string[]
  size: number
  allowDiagonal: boolean
  boardClass: string
  textClass: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    instruction: 'Las palabras están en horizontal o vertical.',
    words: L1_WORDS,
    size: 8,
    allowDiagonal: false,
    boardClass: 'grid-cols-8 gap-1',
    textClass: 'text-sm',
  },
  {
    n: 2,
    name: 'Nivel 2',
    instruction: 'Ahora hay más palabras para encontrar.',
    words: L2_WORDS,
    size: 9,
    allowDiagonal: false,
    boardClass: 'grid-cols-9 gap-1',
    textClass: 'text-xs sm:text-sm',
  },
  {
    n: 3,
    name: 'Nivel 3',
    instruction: 'Atención: ¡ahora también hay palabras en diagonal!',
    words: L3_WORDS,
    size: 10,
    allowDiagonal: true,
    boardClass: 'grid-cols-10 gap-1',
    textClass: 'text-xs',
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

const DIRS_STRAIGHT: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
]
const DIRS_DIAGONAL: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
const FILLER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

interface Board {
  letters: string[]
  solutions: Record<string, number[]>
}

// Backtracking placement: prueba las palabras en orden aleatorio, cada una
// en una dirección/inicio al azar, reintenta ante choque de letras. Los
// tamaños de grilla vs. largo de palabras (definidos arriba) dejan margen
// de sobra para que el fallback (tablero todo 'A') nunca se dispare en la
// práctica.
function buildBoard(words: string[], size: number, allowDiagonal: boolean): Board {
  const dirs = allowDiagonal ? [...DIRS_STRAIGHT, ...DIRS_DIAGONAL] : DIRS_STRAIGHT
  for (let attempt = 0; attempt < 60; attempt++) {
    const cells: (string | null)[] = Array(size * size).fill(null)
    const solutions: Record<string, number[]> = {}
    let ok = true
    for (const word of shuffle(words)) {
      let placed = false
      for (let t = 0; t < 150 && !placed; t++) {
        const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)]
        const row = Math.floor(Math.random() * size)
        const col = Math.floor(Math.random() * size)
        const endRow = row + dr * (word.length - 1)
        const endCol = col + dc * (word.length - 1)
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue
        const path: number[] = []
        let fits = true
        for (let i = 0; i < word.length; i++) {
          const idx = (row + dr * i) * size + (col + dc * i)
          const existing = cells[idx]
          if (existing !== null && existing !== word[i]) {
            fits = false
            break
          }
          path.push(idx)
        }
        if (!fits) continue
        path.forEach((idx, i) => {
          cells[idx] = word[i]
        })
        solutions[word] = path
        placed = true
      }
      if (!placed) {
        ok = false
        break
      }
    }
    if (ok) {
      const letters = cells.map((c) => c ?? FILLER_LETTERS[Math.floor(Math.random() * FILLER_LETTERS.length)])
      return { letters, solutions }
    }
  }
  return { letters: Array(size * size).fill('A'), solutions: {} }
}

// Línea recta entre dos celdas (horizontal, vertical o diagonal si se
// permite) — null si a/b no están alineadas en una dirección válida.
function lineBetween(a: number, b: number, size: number, allowDiagonal: boolean): number[] | null {
  const r1 = Math.floor(a / size)
  const c1 = a % size
  const r2 = Math.floor(b / size)
  const c2 = b % size
  const dr = r2 - r1
  const dc = c2 - c1
  if (dr === 0 && dc === 0) return [a]
  const horizontal = dr === 0
  const vertical = dc === 0
  const diagonal = Math.abs(dr) === Math.abs(dc)
  if (!horizontal && !vertical && !(allowDiagonal && diagonal)) return null
  const steps = Math.max(Math.abs(dr), Math.abs(dc))
  const stepR = dr / steps
  const stepC = dc / steps
  const path: number[] = []
  for (let i = 0; i <= steps; i++) {
    path.push((r1 + stepR * i) * size + (c1 + stepC * i))
  }
  return path
}

function samePath(a: number[], b: number[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false
  const forward = a.every((v, i) => v === b[i])
  const backward = a.every((v, i) => v === b[b.length - 1 - i])
  return forward || backward
}

function cellIdxFromPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  const cell = el.closest('[data-cell-idx]') as HTMLElement | null
  if (!cell) return null
  const idx = Number(cell.dataset.cellIdx)
  return Number.isNaN(idx) ? null : idx
}

const PRAISE = ['¡Muy bien!', '¡Excelente búsqueda!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo!']

export function SopaDeLetras({ day: _day, onComplete }: GameProps) {
  // Pantalla previa de una sola vez para todo el día — nunca vuelve a
  // 'ready' al avanzar de nivel o repetir (mismo patrón que ABuscarYEncontrar).
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Un tablero armado por nivel, decidido una vez por epoch — ver comentario
  // del encabezado del archivo.
  const [epochBoards, setEpochBoards] = useState(() => LEVELS.map((lvl) => buildBoard(lvl.words, lvl.size, lvl.allowDiagonal)))
  const level = LEVELS[levelIdx]
  const board = epochBoards[levelIdx]

  const [foundWords, setFoundWords] = useState<string[]>([])
  const [dragPath, setDragPath] = useState<number[]>([])
  const [dragging, setDragging] = useState(false)
  const [missFlash, setMissFlash] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  // Errores, acumulados a través de niveles 1→2→3 y solo puestos en cero en
  // un reinicio real del día (vuelta de nivel 3 a nivel 1).
  const [mistakes, setMistakes] = useState(0)

  const dragStartRef = useRef<number | null>(null)
  const dragPathRef = useRef<number[]>([])
  const missTimeoutRef = useRef<number | null>(null)

  const done = foundWords.length === level.words.length

  useEffect(() => {
    if (done) setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
  }, [done])

  const foundCells = useMemo(() => {
    const set = new Set<number>()
    foundWords.forEach((w) => board.solutions[w]?.forEach((idx) => set.add(idx)))
    return set
  }, [foundWords, board])

  function setPath(path: number[]) {
    dragPathRef.current = path
    setDragPath(path)
  }

  function clearMissTimer() {
    if (missTimeoutRef.current !== null) {
      window.clearTimeout(missTimeoutRef.current)
      missTimeoutRef.current = null
    }
  }

  function startDrag(idx: number) {
    if (done) return
    clearMissTimer()
    setMissFlash(false)
    dragStartRef.current = idx
    setPath([idx])
    setDragging(true)
  }

  function finishDrag() {
    const path = dragPathRef.current
    dragStartRef.current = null
    setDragging(false)
    if (path.length < 2) {
      setPath([])
      return
    }
    const matchWord = level.words.find((w) => !foundWords.includes(w) && samePath(board.solutions[w] ?? [], path))
    if (matchWord) {
      setFoundWords((prev) => [...prev, matchWord])
      setPath([])
      return
    }
    // Volver a marcar una palabra ya encontrada no cuenta como error — solo
    // se libera la selección en silencio.
    const alreadyFound = foundWords.some((w) => samePath(board.solutions[w] ?? [], path))
    if (alreadyFound) {
      setPath([])
      return
    }
    setMistakes((m) => m + 1)
    setMissFlash(true)
    // El tramo tocado queda resaltado (wiggle suave) durante el flash, así
    // el jugador ve qué seleccionó antes de que se limpie — mismo tiempo
    // que usa LaIntrusa para su wrongIdx (500ms).
    missTimeoutRef.current = window.setTimeout(() => {
      setMissFlash(false)
      setPath([])
      missTimeoutRef.current = null
    }, 500)
  }

  // Sin pointer capture a propósito: pointermove/pointerup deben seguir a la
  // celda real bajo el dedo, no quedar pegados a la celda donde empezó el
  // arrastre. Los listeners van en window (no en el grid) para no perder el
  // gesto si el dedo se sale unos píxeles del tablero.
  useEffect(() => {
    if (!dragging) return
    function onMove(e: PointerEvent) {
      if (dragStartRef.current === null) return
      const idx = cellIdxFromPoint(e.clientX, e.clientY)
      if (idx === null) return
      const path = lineBetween(dragStartRef.current, idx, level.size, level.allowDiagonal)
      if (path) setPath(path)
    }
    function onUp() {
      finishDrag()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  function advanceLevel() {
    clearMissTimer()
    setMissFlash(false)
    setLevelIdx((i) => i + 1)
    setFoundWords([])
    setPath([])
  }
  function restartEpoch() {
    clearMissTimer()
    setMissFlash(false)
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setFoundWords([])
    setPath([])
    setMistakes(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochBoards(LEVELS.map((lvl) => buildBoard(lvl.words, lvl.size, lvl.allowDiagonal)))
  }

  const totalWordsAllLevels = LEVELS.reduce((sum, l) => sum + l.words.length, 0)
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + totalWordsAllLevels })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}
        >
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá las palabras escondidas</h2>
        {phase === 'playing' && !done && <p className="mt-1 text-base font-semibold text-slate-500">{level.instruction}</p>}
        {phase === 'playing' && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              {foundWords.length} de {level.words.length}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(foundWords.length / level.words.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pantalla previa: única vez, al principio del día */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Search className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Buscá en la grilla las palabras de la lista de abajo. Tocá la primera letra, arrastrá hasta la última y soltá.
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

      {/* Tablero + lista de palabras */}
      {phase === 'playing' && !done && (
        <>
          <div className={`mx-auto mt-3 grid max-w-xs touch-none select-none ${level.boardClass}`}>
            {board.letters.map((letter, i) => {
              const isFound = foundCells.has(i)
              const isSelected = dragPath.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  data-cell-idx={i}
                  onPointerDown={() => startDrag(i)}
                  aria-label={`letra ${letter}`}
                  className={[
                    'flex aspect-square items-center justify-center rounded-md border font-bold uppercase text-slate-700 transition',
                    level.textClass,
                    isFound
                      ? 'border-tiam-green bg-tiam-green/10 text-tiam-green'
                      : isSelected
                        ? missFlash
                          ? 'border-slate-300 bg-slate-100 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                          : 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue'
                        : 'border-slate-200 bg-white',
                  ].join(' ')}
                >
                  {letter}
                </button>
              )
            })}
          </div>

          <div className="mx-auto mt-3 flex max-w-xs flex-wrap justify-center gap-2">
            {level.words.map((w) => {
              const isFound = foundWords.includes(w)
              return (
                <span
                  key={w}
                  className={[
                    'rounded-full border-2 px-3 py-1 text-base font-bold uppercase tracking-wide transition',
                    isFound ? 'border-tiam-green bg-tiam-green/10 text-tiam-green line-through' : 'border-slate-200 bg-white text-slate-700',
                  ].join(' ')}
                >
                  {w}
                </span>
              )
            })}
          </div>

          {missFlash && <p className="mt-2 text-center text-base font-medium text-slate-500">Esa no es, ¡seguí buscando! 🙂</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">¡Encontraste todas las palabras — completaste el {level.name.toLowerCase()}!</p>
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
