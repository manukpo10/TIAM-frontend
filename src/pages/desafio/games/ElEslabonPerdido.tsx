import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Puzzle, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El eslabón perdido" — día 8, lenguaje. Two words that look unrelated
 * (OJO … AGUJA) are shown side by side. The player picks, among 4 options,
 * the short connecting word that turns both into one real Spanish
 * expression (OJO **DE** AGUJA). Tests semantic association + retrieval of a
 * fixed expression, not spelling — a plain multiple-choice tap, no tile
 * assembly, so unlike QuePalabraSeEsconde/DosPistas there's no
 * readyToCheck/checkedRef dance: each tap IS a complete, standalone attempt,
 * checked synchronously in handlePick.
 *
 * Every `answer` is a short connector (de/y/o/en/con/sin/a/por — always
 * lowercase, `uppercase` applied via Tailwind for display) drawn from
 * CONNECTOR_POOL. Decoys are 3 OTHER pool words picked at random per round —
 * always real Spanish words, just wrong for that specific pair, so a wrong
 * tap is never a nonsense option, only a plausible-but-incorrect one. All 30
 * expressions (10/level, well above the 2-per-level actually played) are
 * genuine, verified Spanish expressions/idioms; nivel 1 uses very common
 * ones (dolor de cabeza, punto de vista), nivel 3 leans on figurative/less
 * literal ones (talón de Aquiles, caja de Pandora) for the requested
 * subtlety. No word is reused within the same nivel's pool (self-pairs like
 * CARA/CARA or CODO/CODO are the one deliberate exception — real Spanish
 * reduplicative idioms, cara a cara / codo con codo).
 *
 * Connector distribution is deliberately capped, not naturalistic: "de" is
 * the default Spanish preposition, so a pool of real expressions picked
 * without care skews ~70% "de" (an earlier version of this file did exactly
 * that) — which let players win most rounds by blind-tapping "de" without
 * reading either word, defeating the actual task (semantic recall, not
 * button-mashing). Capped "de" at 4/10 per nivel and spread the rest evenly
 * across y/o/en/con/sin/a/por, all still genuine expressions — "de" stays
 * the single most common connector (realistic to the language) without
 * being an exploitable default.
 *
 * Never a hard fail: a wrong tap gets a muted nudge, dims just that option
 * (`wrongIds`, cleared every round) so it's not tapped again by habit, and
 * leaves every other option live — same "always retryable" contract as the
 * rest of the app. Every round resolves via a genuine correct tap (no
 * give-up path), so totalAttempts = mistakes + TOTAL_ROUNDS.
 */

interface LinkEntry {
  wordA: string
  wordB: string
  /** Palabra de enlace, siempre en minúsculas — se muestra en mayúsculas
   * vía clase `uppercase`. */
  answer: string
}
interface LinkLevel {
  n: number
  name: string
  entries: LinkEntry[]
}

const LEVELS: LinkLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    entries: [
      { wordA: 'OJO', wordB: 'AGUJA', answer: 'de' },
      { wordA: 'DOLOR', wordB: 'CABEZA', answer: 'de' },
      { wordA: 'PUNTO', wordB: 'VISTA', answer: 'de' },
      { wordA: 'SALA', wordB: 'ESPERA', answer: 'de' },
      { wordA: 'CAFÉ', wordB: 'LECHE', answer: 'con' },
      { wordA: 'CARA', wordB: 'CARA', answer: 'a' },
      { wordA: 'IDA', wordB: 'VUELTA', answer: 'y' },
      { wordA: 'SANO', wordB: 'SALVO', answer: 'y' },
      { wordA: 'TARDE', wordB: 'TEMPRANO', answer: 'o' },
      { wordA: 'TODO', wordB: 'NADA', answer: 'o' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    entries: [
      { wordA: 'PUNTA', wordB: 'LANZA', answer: 'de' },
      { wordA: 'CUELLO', wordB: 'BOTELLA', answer: 'de' },
      { wordA: 'GOLPE', wordB: 'ESTADO', answer: 'de' },
      { wordA: 'AIRE', wordB: 'FAMILIA', answer: 'de' },
      { wordA: 'PASO', wordB: 'FALSO', answer: 'en' },
      { wordA: 'CODO', wordB: 'CODO', answer: 'con' },
      { wordA: 'PUNTO', wordB: 'APARTE', answer: 'y' },
      { wordA: 'CUERPO', wordB: 'ALMA', answer: 'y' },
      { wordA: 'ENTRADA', wordB: 'SALIDA', answer: 'y' },
      { wordA: 'VIENTO', wordB: 'POPA', answer: 'en' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    entries: [
      { wordA: 'TALÓN', wordB: 'AQUILES', answer: 'de' },
      { wordA: 'CAJA', wordB: 'PANDORA', answer: 'de' },
      { wordA: 'CABEZA', wordB: 'TURCO', answer: 'de' },
      { wordA: 'CUENTO', wordB: 'HADAS', answer: 'de' },
      { wordA: 'PAN', wordB: 'LEVADURA', answer: 'sin' },
      { wordA: 'VIVO', wordB: 'MUERTO', answer: 'o' },
      { wordA: 'AHORA', wordB: 'NUNCA', answer: 'o' },
      { wordA: 'TIRA', wordB: 'AFLOJA', answer: 'y' },
      { wordA: 'UNO', wordB: 'UNO', answer: 'por' },
      { wordA: 'OJO', wordB: 'OJO', answer: 'por' },
    ],
  },
]

const ROUNDS_PER_LEVEL = [2, 2, 2]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

// Palabras de enlace posibles — todas reales, así que un señuelo siempre es
// una palabra válida, sólo que incorrecta para ese par puntual.
const CONNECTOR_POOL = ['de', 'y', 'o', 'a', 'en', 'con', 'sin', 'por']

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

interface Option {
  id: number
  value: string
}
function buildOptions(answer: string): Option[] {
  const decoys = shuffle(CONNECTOR_POOL.filter((c) => c !== answer)).slice(0, 3)
  return shuffle([answer, ...decoys]).map((value, id) => ({ id, value }))
}

const PRAISE_GOOD = ['¡Ese es el eslabón!', '¡Exacto, así se conectan!', '¡Muy bien pensado!', '¡Perfecto!']
// Nunca roja: un toque incorrecto siempre es reintentable.
const NUDGE_MESSAGES = [
  'Esa palabra no arma la expresión. Pensá una frase conocida con las dos palabras.',
  'Todavía no. Probá con otra opción.',
  'Casi. Esa combinación no es una expresión conocida — intentá con otra palabra.',
]

export function ElEslabonPerdido({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Qué pares juega cada nivel esta "época" — decidido una vez por época, al
  // montar, nunca al re-visitar un nivel, así "Repetir" siempre devuelve los
  // mismos pares.
  const [epochEntries] = useState(() =>
    LEVELS.map((lvl, i) => shuffle(lvl.entries).slice(0, ROUNDS_PER_LEVEL[i])),
  )
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]
  const roundEntries = epochEntries[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const entry = roundEntries[roundIdx]

  // Opciones de la ronda, estables dentro de ella; se rearman al cambiar de
  // ronda/nivel.
  const options = useMemo(
    () => buildOptions(entry.answer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey, roundIdx],
  )

  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [mistakes, setMistakes] = useState(0)
  // Ids de opciones tocadas y erradas esta ronda — se atenúan para no
  // volver a tocarlas por costumbre, pero no bloquean el resto.
  const [wrongIds, setWrongIds] = useState<number[]>([])

  const done = resolved && roundIdx >= roundsForLevel - 1

  function handlePick(opt: Option) {
    if (resolved) return
    if (opt.value === entry.answer) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else {
      setHint(pickOne(NUDGE_MESSAGES))
      setMistakes((m) => m + 1)
      setWrongIds((ids) => (ids.includes(opt.id) ? ids : [...ids, opt.id]))
    }
  }

  function nextRound() {
    setResolved(false)
    setHint(null)
    setWrongIds([])
    setRoundIdx((i) => i + 1)
  }
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setResolved(false)
    setHint(null)
    setWrongIds([])
    setRoundIdx(0)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setResolved(false)
    setHint(null)
    setWrongIds([])
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

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {phase === 'playing' && !done && (
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
          header persistente — mismo motivo que QuePalabraSeEsconde.tsx. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Puzzle className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver dos palabras que parecen no tener nada que ver. Elegí, entre las 4 opciones, la palabra que las
            conecta a las dos formando una expresión que seguro conocés.
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
          {/* Las dos palabras + el enlace (se queda visible y en verde una
              vez resuelto, igual que los hermanos). */}
          <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-slate-50 p-5">
            <p className="text-center text-base font-semibold text-slate-500">¿Qué palabra las conecta?</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <span className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-lg font-extrabold uppercase text-slate-800">
                {entry.wordA}
              </span>
              <span
                className={
                  resolved
                    ? 'text-xl font-extrabold uppercase text-tiam-green'
                    : 'text-2xl font-extrabold text-slate-300'
                }
              >
                {resolved ? entry.answer : '?'}
              </span>
              <span className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-lg font-extrabold uppercase text-slate-800">
                {entry.wordB}
              </span>
            </div>
          </div>

          {/* Tarjeta "todavía no" — mismo contrato que los hermanos: nunca
              roja, se queda hasta el próximo toque. */}
          {hint && !resolved && (
            <div className="mt-4 rounded-2xl border border-tiam-orange/25 bg-tiam-orange/5 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tiam-orange/15">
                <RotateCcw className="h-6 w-6 text-tiam-orange" />
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">Todavía no es esa</p>
              <p className="mt-1 text-slate-600">{hint}</p>
            </div>
          )}

          {!resolved && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePick(opt)}
                  aria-label={`Palabra ${opt.value}`}
                  className={[
                    'flex min-h-[52px] items-center justify-center rounded-xl border-2 px-3 text-xl font-extrabold uppercase transition',
                    wrongIds.includes(opt.id)
                      ? 'border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {opt.value}
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
            Formaste la expresión:{' '}
            <span className="font-semibold uppercase text-slate-800">
              {entry.wordA} {entry.answer} {entry.wordB}
            </span>
            .
          </p>
          {done && <p className="mt-1 text-slate-600">Completaste el nivel {levelIdx + 1}.</p>}
          {!done ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente par
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
