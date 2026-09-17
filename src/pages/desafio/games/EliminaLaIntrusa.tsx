import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Elimina la intrusa" — categorisation. A sheet of rows, three words each;
 * in every row two words share something and one doesn't. Tap the intruder.
 *
 * A known repeat, kept on purpose: the odd-one-out mechanic already exists as
 * "¿Cuál no va?" (mes 1, día 11) and "La que no encaja" (mes 3, día 16), and
 * the product owner chose to reuse it here to close the month. What differs is
 * the shape — the whole sheet is on screen at once, the way the paper exercise
 * is, instead of one question at a time — so rows solved earlier stay visible
 * and the player can move around the page.
 *
 * Every row is authored so exactly ONE word is defensibly out. That was
 * checked row by row, and several obvious candidates were thrown out for
 * having a second reading: agua/leche/queso looks like "the solid one", but
 * leche and queso are both dairy, so agua is just as out. A row with two
 * right answers marks a correct player wrong.
 *
 * A short reason appears under each solved row. It is feedback, not a lecture:
 * someone who got it by feel gets to see why, and someone who guessed learns.
 */

interface Row {
  words: [string, string, string]
  intruder: string
  why: string
}

const POOL_L1: Row[] = [
  { words: ['perro', 'gato', 'mesa'], intruder: 'mesa', why: 'Perro y gato son animales; la mesa es un mueble.' },
  { words: ['sol', 'luna', 'auto'], intruder: 'auto', why: 'El sol y la luna están en el cielo; el auto no.' },
  { words: ['lunes', 'jueves', 'abril'], intruder: 'abril', why: 'Lunes y jueves son días; abril es un mes.' },
  { words: ['cuchara', 'tenedor', 'zapato'], intruder: 'zapato', why: 'Cuchara y tenedor son cubiertos; el zapato se usa en el pie.' },
  { words: ['camisa', 'pantalón', 'manzana'], intruder: 'manzana', why: 'Camisa y pantalón son ropa; la manzana es una fruta.' },
  { words: ['uno', 'dos', 'casa'], intruder: 'casa', why: 'Uno y dos son números; la casa no.' },
]

const POOL_L2: Row[] = [
  { words: ['manzana', 'banana', 'zanahoria'], intruder: 'zanahoria', why: 'Manzana y banana son frutas; la zanahoria es una verdura.' },
  { words: ['colectivo', 'tren', 'puente'], intruder: 'puente', why: 'Colectivo y tren son medios de transporte; el puente no se mueve.' },
  { words: ['guitarra', 'piano', 'pincel'], intruder: 'pincel', why: 'Guitarra y piano son instrumentos; el pincel es para pintar.' },
  { words: ['enero', 'marzo', 'verano'], intruder: 'verano', why: 'Enero y marzo son meses; el verano es una estación.' },
  { words: ['doctor', 'maestra', 'hospital'], intruder: 'hospital', why: 'Doctor y maestra son oficios; el hospital es un lugar.' },
  { words: ['leche', 'jugo', 'pan'], intruder: 'pan', why: 'La leche y el jugo se toman; el pan se come.' },
  { words: ['bufanda', 'guantes', 'sombrilla'], intruder: 'sombrilla', why: 'Bufanda y guantes abrigan en invierno; la sombrilla es para el sol.' },
  { words: ['martillo', 'serrucho', 'peine'], intruder: 'peine', why: 'Martillo y serrucho son herramientas; el peine es para el pelo.' },
]

// The hardest rows put the intruder close to the group, so it only stands out
// once you name what the other two actually share.
const POOL_L3: Row[] = [
  { words: ['hielo', 'vapor', 'piedra'], intruder: 'piedra', why: 'El hielo y el vapor son agua; la piedra no.' },
  { words: ['primavera', 'otoño', 'lluvia'], intruder: 'lluvia', why: 'Primavera y otoño son estaciones; la lluvia es algo del clima.' },
  { words: ['multiplicar', 'dividir', 'planchar'], intruder: 'planchar', why: 'Multiplicar y dividir son cuentas; planchar es una tarea de la casa.' },
  { words: ['sábado', 'septiembre', 'domingo'], intruder: 'septiembre', why: 'Sábado y domingo son días; septiembre es un mes.' },
  { words: ['rosa', 'clavel', 'roble'], intruder: 'roble', why: 'La rosa y el clavel son flores; el roble es un árbol.' },
  { words: ['río', 'lago', 'montaña'], intruder: 'montaña', why: 'El río y el lago son agua; la montaña no.' },
  { words: ['kilo', 'gramo', 'metro'], intruder: 'metro', why: 'El kilo y el gramo miden peso; el metro mide largo.' },
  { words: ['triángulo', 'cuadrado', 'cubo'], intruder: 'cubo', why: 'El triángulo y el cuadrado son planos; el cubo tiene volumen.' },
  { words: ['ayer', 'hoy', 'nunca'], intruder: 'nunca', why: 'Ayer y hoy son días; nunca habla de cuántas veces.' },
  { words: ['codo', 'rodilla', 'uña'], intruder: 'uña', why: 'El codo y la rodilla son articulaciones; la uña no.' },
]

interface Level {
  n: number
  name: string
  rows: number
  pool: Row[]
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rows: 4, pool: POOL_L1 },
  { n: 2, name: 'Nivel 2', rows: 6, pool: POOL_L2 },
  { n: 3, name: 'Nivel 3', rows: 8, pool: POOL_L3 },
]

const TOTAL_ROWS = LEVELS.reduce((sum, l) => sum + l.rows, 0)

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

interface SheetRow extends Row {
  /** Display order — shuffled so the intruder is not always last. */
  shown: string[]
}

// Which `level.rows` rows this level plays — picked once per level, at
// mount, and never re-rolled (see `epochRows` below), so "Repetir" always
// shows the same intruders.
function pickRows(level: Level): Row[] {
  return shuffle(level.pool).slice(0, level.rows)
}
// On-screen row order plus each row's word order — free to reshuffle on
// every round/level/roundKey change, since WHICH rows appear is already
// fixed by `epochRows`.
function buildSheet(rows: Row[]): SheetRow[] {
  return shuffle(rows).map((row) => ({ ...row, shown: shuffle([...row.words]) }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa pertenece al grupo. Buscá la que no comparte nada con las otras dos.',
  'Esa no es. Pensá qué tienen en común las otras.',
  'Casi. Fijate cuál de las tres queda sola.',
]

export function EliminaLaIntrusa({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Which rows each level plays, decided once — at mount — never re-rolled
  // just because the player re-visits a level, so "Repetir" always shows
  // the same intruders (same content-freezing convention as
  // CruceDeLetras.tsx's epochEntries). Row order and each row's word order
  // still rebuild on every round/level/roundKey change.
  const [epochRows] = useState(() => LEVELS.map((lvl) => pickRows(lvl)))
  const sheet = useMemo(
    () => buildSheet(epochRows[levelIdx]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [solved, setSolved] = useState<Set<number>>(new Set())
  /** `${row}:${word}` for words already tapped wrongly — greyed and disabled. */
  const [wrong, setWrong] = useState<Set<string>>(new Set())
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  const done = solved.size === sheet.length

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function tap(rowIdx: number, word: string) {
    if (solved.has(rowIdx) || wrong.has(`${rowIdx}:${word}`)) return
    if (word === sheet[rowIdx].intruder) {
      setSolved((prev) => new Set(prev).add(rowIdx))
      setHint(null)
      return
    }
    setWrong((prev) => new Set(prev).add(`${rowIdx}:${word}`))
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` (derived from
  // `solved`) would read the previous level's stale-true value on the very
  // render that arrives at the new level and fire onComplete with garbage.
  // Same reasoning as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setSolved(new Set())
    setWrong(new Set())
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level's sheet is complete. A genuine
  // full-day restart (the wrap to level 1) gets a new roundKey so it can
  // report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROWS })
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
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          En cada fila hay una palabra que no va
        </h2>
        <p className="mt-2 text-base text-slate-500">Tocala para sacarla.</p>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Llevás {solved.size} de {sheet.length}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${sheet.length ? (solved.size / sheet.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* The sheet */}
      <ol className="mt-5 flex flex-col gap-2.5">
        {sheet.map((row, rowIdx) => {
          const isSolved = solved.has(rowIdx)
          return (
            <li
              key={`${roundKey}-${rowIdx}`}
              className={[
                'rounded-2xl border-2 p-2 transition',
                isSolved ? 'border-tiam-green/40 bg-tiam-green/5' : 'border-slate-100 bg-white',
              ].join(' ')}
            >
              <div className="grid grid-cols-3 gap-2">
                {row.shown.map((word) => {
                  const isIntruder = word === row.intruder
                  const isWrong = wrong.has(`${rowIdx}:${word}`)
                  return (
                    <button
                      key={word}
                      type="button"
                      disabled={isSolved || isWrong}
                      onClick={() => tap(rowIdx, word)}
                      className={[
                        'relative flex min-h-[48px] items-center justify-center rounded-xl border-2 px-1 py-2 text-center text-sm font-bold leading-tight transition sm:text-base',
                        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                        isSolved && isIntruder ? 'border-tiam-green bg-white text-slate-400 line-through' : '',
                        isSolved && !isIntruder ? 'border-transparent bg-transparent text-slate-700' : '',
                        !isSolved && isWrong ? 'border-slate-200 bg-slate-50 text-slate-300' : '',
                        !isSolved && !isWrong
                          ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                          : '',
                      ].join(' ')}
                    >
                      {word}
                      {isSolved && isIntruder && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {isSolved && <p className="mt-2 px-1 text-sm leading-snug text-slate-600">{row.why}</p>}
            </li>
          )
        })}
      </ol>

      {hint && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Sacaste las {sheet.length} intrusas — ¡completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
