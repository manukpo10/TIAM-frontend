import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Dos pistas, una palabra" — día 28, lenguaje. Two images are shown; BOTH mean
 * the same Spanish word, each through a different sense of it (a person's shadow
 * and an eyeshadow palette both = "sombra"). The player finds the word the two
 * clues share and spells it from a pile of scrambled letters, tapping one at a
 * time. It exercises semantic association + word retrieval + spelling, all at
 * once — a "make them think" exercise, which is exactly what the professional
 * asked us to lean into.
 *
 * Letter-tile mechanic like día 3 (tap to place into slots, tap a placed tile to
 * send it back), but with its own local bank instead of `useSequencingPuzzle`,
 * because the pile carries DECOY letters (más letras de las justas) so juntar
 * las que sobran no alcanza — the difficulty the professional asked for. The
 * word-building row shows one slot per answer letter so the length stays visible
 * even though the pile has extras. Structural differences from día 3: TWO image
 * clues instead of one word + one image, no "source word", and the decoys.
 *
 * Correctness compares the SPELLED STRING to the answer, never a
 * positional check: several answers repeat letters (ESTRELLA has two E and
 * two L, SIERRA two R), so two tiles can share a value but not an id and the
 * player can't tell them apart — grading by position would mark a correctly
 * spelled word wrong. All answers are accent-free (letter tiles can't carry an
 * accent — the MONJA→JAMÓN lesson from día 3).
 *
 * Never red on a wrong check, always retryable, and the tiles STAY put on a miss
 * (one wrong letter in ESTRELLA must not sweep the other seven) — same warm
 * contract as día 3.
 */

interface RebusEntry {
  answer: string // minúsculas, sin acentos (las fichas no llevan acento)
  imgA: string // id del asset de la primera pista
  imgB: string // id del asset de la segunda pista
  hint: string // qué comparten las dos imágenes, para el "Dame una idea"
}
interface RebusLevel {
  n: number
  name: string
  entries: RebusEntry[]
}

// Cada palabra: dos imágenes = dos sentidos del mismo término. Agrupadas por
// largo/dificultad (nivel 1 corto y común, nivel 3 más largo).
const LEVELS: RebusLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    entries: [
      { answer: 'hoja', imgA: 'hoja-a', imgB: 'hoja-b', hint: 'la de un árbol y la de papel' },
      { answer: 'gato', imgA: 'gato-a', imgB: 'gato-b', hint: 'el animal y el que levanta el auto' },
      { answer: 'vela', imgA: 'vela-a', imgB: 'vela-b', hint: 'la que se prende y la del barco' },
      { answer: 'cola', imgA: 'cola-a', imgB: 'cola-b', hint: 'la del animal y la de la gente esperando' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    entries: [
      { answer: 'llave', imgA: 'llave-a', imgB: 'llave-b', hint: 'la de la puerta y la herramienta' },
      { answer: 'carta', imgA: 'carta-a', imgB: 'carta-b', hint: 'la que se manda y la de jugar' },
      { answer: 'banco', imgA: 'banco-a', imgB: 'banco-b', hint: 'el de la plaza y el de guardar plata' },
      { answer: 'diente', imgA: 'diente-a', imgB: 'diente-b', hint: 'el de la boca y el de ajo' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    entries: [
      { answer: 'sombra', imgA: 'sombra-a', imgB: 'sombra-b', hint: 'la que hace el cuerpo y la de los ojos' },
      { answer: 'campana', imgA: 'campana-a', imgB: 'campana-b', hint: 'la que suena y la de la cocina' },
      { answer: 'estrella', imgA: 'estrella-a', imgB: 'estrella-b', hint: 'la del cielo y la de mar' },
      { answer: 'sierra', imgA: 'sierra-a', imgB: 'sierra-b', hint: 'la herramienta y la de montañas' },
    ],
  },
]

const ROUNDS_PER_LEVEL = [2, 3, 3]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

// Letras de más en el montón, por nivel — para que no alcance con juntar las
// justas. Sube con la dificultad. No se usa el hook useSequencingPuzzle (que
// sólo baraja las letras exactas): acá el banco lleva señuelos.
const DECOYS_PER_LEVEL = [2, 3, 4]
// Pool de letras comunes en español para los señuelos. Pueden repetir una letra
// que ya está en la palabra — como se compara el STRING armado, da igual qué
// ficha física use la persona.
const DECOY_POOL = 'aeiosrntldcumpb'.split('')

interface Tile {
  id: number
  value: string
}
// Letras de la palabra + `decoys` señuelos, todo barajado. Ids únicos por ficha
// para poder distinguir dos fichas del mismo valor.
function buildTiles(answer: string, decoys: number): Tile[] {
  const values = answer.split('')
  for (let i = 0; i < decoys; i++) values.push(pickOne(DECOY_POOL))
  return shuffle(values).map((value, id) => ({ id, value }))
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/dos-pistas/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

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

const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const NUDGE_MESSAGES = [
  'Casi. Fijate en las dos imágenes y probá de nuevo.',
  'No es esa. ¿Qué tienen en común las dos figuras?',
  'Revisá el orden de las letras y volvé a intentar.',
]

export function DosPistas({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  const roundEntries = useMemo(
    () => shuffle(level.entries).slice(0, roundsForLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const entry = roundEntries[roundIdx]

  // Fichas de la ronda (palabra + señuelos), estables dentro de la ronda; se
  // rearman al cambiar de nivel/ronda. `placedIds` guarda qué fichas están
  // puestas, en orden; se resetea sincrónicamente en los handlers (nunca en un
  // efecto, misma disciplina que el resto del reset — ver nextLevel).
  const tiles = useMemo(
    () => buildTiles(entry.answer, DECOYS_PER_LEVEL[levelIdx]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )
  const [placedIds, setPlacedIds] = useState<number[]>([])
  const placed = placedIds.map((id) => tiles.find((t) => t.id === id)).filter((t): t is Tile => !!t)
  const bank = tiles.filter((t) => !placedIds.includes(t.id))
  // Listo para revisar cuando hay tantas letras puestas como tiene la palabra
  // (los señuelos que sobran quedan en el montón).
  const readyToCheck = placed.length === entry.answer.length

  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [showIdea, setShowIdea] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Errores acumulados a través de los niveles; sólo se ponen en cero en un
  // reinicio real del día (rama isWrap de nextLevel). totalAttempts se deriva
  // como mistakes + TOTAL_ROUNDS, ya que toda ronda termina resolviéndose bien.
  const [mistakes, setMistakes] = useState(0)

  const done = resolved && roundIdx >= roundsForLevel - 1

  const imgA = imgFor(entry.imgA)
  const imgB = imgFor(entry.imgB)

  function handlePlace(item: Tile) {
    if (resolved || placed.length >= entry.answer.length) return
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
    // Compara el STRING armado, no el isCorrect posicional del hook (ver header).
    const spelled = placed.map((item) => item.value).join('')
    if (spelled === entry.answer) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE_MESSAGES))
      setMistakes((m) => m + 1)
      // Las fichas quedan donde están: un error no barre todo lo puesto.
    }
  }

  function nextRound() {
    setResolved(false)
    setHint(null)
    setShowIdea(false)
    setPlacedIds([])
    setRoundIdx((i) => i + 1)
  }
  // Reset sincrónico dentro del handler que cambia levelIdx/roundKey — nunca en
  // un useEffect keyed on [levelIdx, roundKey]: un efecto llega un render tarde
  // y el onComplete de abajo leería `done` viejo (mismo bug resuelto en día 3).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setResolved(false)
    setHint(null)
    setShowIdea(false)
    setPlacedIds([])
    setRoundIdx(0)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setResolved(false)
    setHint(null)
    setShowIdea(false)
    setPlacedIds([])
    setRoundIdx(0)
    setRoundKey((k) => k + 1)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base text-slate-500">
              Las dos imágenes son la misma palabra. Armala con las letras.
            </p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {roundsForLevel}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Las dos pistas, lado a lado. Cada una es un sentido de la palabra. */}
          {!resolved && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[imgA, imgB].map((src, i) => (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-2xl border-2 border-slate-100 bg-white p-2"
                >
                  {src && <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />}
                </div>
              ))}
            </div>
          )}

          {/* Palabra que se va armando. Un casillero por letra de la respuesta,
              para que el largo esté a la vista — clave ahora que en el montón hay
              letras de más y no se puede contar por ahí. Los llenos son botones
              (tocar = sacar); los vacíos, un recuadro punteado. */}
          <div className="mt-4 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {Array.from({ length: entry.answer.length }).map((_, i) => {
              const item = placed[i]
              if (!item) {
                return (
                  <span
                    key={`slot-${i}`}
                    aria-hidden="true"
                    className="h-[44px] w-[36px] rounded-xl border-2 border-dashed border-slate-300 bg-white"
                  />
                )
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={resolved}
                  onClick={() => handleUnplace(item)}
                  aria-label={`Quitar letra ${item.value}`}
                  className={[
                    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 px-2 text-xl font-extrabold uppercase transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    resolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10',
                  ].join(' ')}
                >
                  {item.value}
                </button>
              )
            })}
          </div>

          {/* Montón de letras */}
          {!resolved && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlace(item)}
                  aria-label={`Letra ${item.value}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-2 text-xl font-extrabold uppercase text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {/* Revisar + Dame una idea */}
          {!resolved && (
            <div className="mt-4 flex flex-col items-center gap-2">
              {readyToCheck && (
                <button
                  type="button"
                  onClick={check}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
                >
                  Revisar
                </button>
              )}
              {showIdea ? (
                <p className="text-center text-sm font-medium text-tiam-blue">Pista: {entry.hint}.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowIdea(true)}
                  className="text-sm font-semibold text-tiam-blue transition hover:underline"
                >
                  Dame una idea
                </button>
              )}
              {hint && <p className="text-center text-sm font-medium text-slate-500">{hint}</p>}
            </div>
          )}
        </>
      )}

      {/* Resultado */}
      {resolved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            La palabra era <span className="font-semibold uppercase text-slate-800">{entry.answer}</span>.
          </p>
          {done && <p className="mt-1 text-slate-600">Completaste el nivel {levelIdx + 1}.</p>}
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
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente palabra
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
