import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Delete as BackspaceIcon, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Nombres escondidos" — día 7, mes 6, lenguaje. A heap of loose letters and a category (herramientas, árboles, aves): the
 * letters hide THREE names of that category, and each name comes with a clue and its boxes (so its length is visible).
 * The player taps letters, in order, to fill the boxes of a name, then taps "Listo"; the letters of a name that is right
 * are used up, so the heap that is left is the one of the names still to be found. The mechanic comes from a worksheet
 * with a block of loose letters and the instruction to name flowers that can be formed by mixing them; here the
 * letters come from three names written for the level, each with a clue and a length.
 *
 * ORIGINAL CONTENT. Only the idea is borrowed. The categories (hardware-store things, trees, birds), the names and the
 * clues are TIAM's own, and the category of the worksheet (flowers) is not used. Level 1 is NOT fruits: month 4's
 * "Anagramas por categoría" already has a fruits band (PERA, KIWI…), and none of the names here is in that game. A
 * throwaway script (not committed) checks that the loose letters are exactly the letters of the three names, that no
 * name of the worksheet is here and, the important one, that the letters of a level cannot also form ANOTHER name of
 * the category from a list of about eighty hardware-store things, trees and birds: a word that is one of them too would be a right answer
 * the game could not accept.
 *
 * CLUES, NOT A BLIND GUESS (a word game never asks for a word from a hidden list with nothing to go on): each name has
 * its clue and one box per letter. The three clues are tabs and any of them can be opened first, and a
 * name is accepted whichever of the three clues was being answered: the player may have built the name of ANOTHER
 * clue, and that is a right answer too. A wrong name costs ONE mistake (a double tap on "Listo" cannot count twice: the
 * first tap empties the boxes and "Listo" is off until they fill again), puts the letters back in the heap and the clue
 * grows with the misses on the same row: a nudge, then the first letter, then the name itself. Nothing is red and
 * nothing is timed but a short pause so the last name is seen.
 *
 * THREE NAMES A LEVEL, as the tallerista likes the days short. The ramp is the category and the length: three hardware-store things of
 * four, four and four letters (12 letters), three trees of five letters (15) and three birds of four, four and seven (15).
 * Every heap is three rows of tiles on a 320px phone, which is what lets the letters and the "Listo" bar share the card.
 * Only the clue being answered shows, with its boxes (a found name takes its tab), so the heap of
 * letters is on screen on a short phone, and the "Listo" bar sticks to the bottom of the card.
 * Every level has ONE authored set, and the order of the letters in the heap is chosen ONCE at mount (`epoch`), so
 * "Repetir" replays exactly the same nine names.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored (the
 * letters sit where that button was), and a letter cannot be placed twice.
 *
 * totalAttempts = mistakes + every name of the day (TOTAL_NAMES, derived).
 */

// ── data:start ──
interface NameDef {
  /** Plain capital letters (A-Z, no accent): what the tiles can write. */
  word: string
  /** The name as it is written, with its accent: shown once it is found. */
  display: string
  /** What it is. It never contains the name. */
  clue: string
  /** A second clue, for after the first miss. */
  tip: string
}
interface LevelDef {
  name: string
  /** The category the names belong to. */
  category: string
  names: NameDef[]
}

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    category: 'Cosas de ferretería',
    names: [
      { word: 'PALA', display: 'pala', clue: 'Herramienta de mango largo para cavar la tierra.', tip: 'Se usa en la huerta y en la obra.' },
      { word: 'SOGA', display: 'soga', clue: 'Cuerda gruesa que sirve para atar o arrastrar cosas pesadas.', tip: 'Es más gruesa que un hilo y se guarda enrollada.' },
      { word: 'LIJA', display: 'lija', clue: 'Papel áspero, con arena pegada, que se usa para alisar la madera.', tip: 'Se frota sobre la superficie antes de pintarla.' },
    ],
  },
  {
    name: 'Nivel 2',
    category: 'Árboles',
    names: [
      { word: 'ROBLE', display: 'roble', clue: 'Árbol de tronco grueso y madera muy dura; da bellotas.', tip: 'Con su madera se hacen muebles y barriles.' },
      { word: 'CEIBO', display: 'ceibo', clue: 'Árbol de flores rojas: es la flor nacional de la Argentina.', tip: 'Crece cerca de los ríos.' },
      { word: 'OLIVO', display: 'olivo', clue: 'Árbol del que se sacan las aceitunas.', tip: 'Con sus frutos se hace un aceite muy usado en la cocina.' },
    ],
  },
  {
    name: 'Nivel 3',
    category: 'Aves',
    names: [
      { word: 'HORNERO', display: 'hornero', clue: 'Ave nacional; su nido de barro parece una casita.', tip: 'Es de color marrón y se la ve en los postes.' },
      { word: 'PAVO', display: 'pavo', clue: 'Ave de granja con papada roja, que se come en Navidad.', tip: 'Hace «glu glu» y es más grande que una gallina.' },
      { word: 'BUHO', display: 'búho', clue: 'Ave de ojos enormes que de noche caza ratones.', tip: 'Casi puede girar la cabeza hasta atrás.' },
    ],
  },
]
const TOTAL_NAMES = LEVELS.reduce((sum, lvl) => sum + lvl.names.length, 0)

/** The name of the how-to screen: it is not in the game. */
const EXAMPLE = { clue: 'Herramienta de filo ancho que sirve para cortar leña', word: 'HACHA' }
// ── data:end ──

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

interface Tile {
  id: number
  ch: string
}
/** The heap of each level: the letters of its three names, mixed ONCE at mount. */
function buildEpoch(): Tile[][] {
  return LEVELS.map((lvl) => shuffle([...lvl.names.map((n) => n.word).join('')]).map((ch, id) => ({ id, ch })))
}

/** The hint after a wrong name: it grows with every miss on the same row, and from the third one it says the name. */
function missHint(n: NameDef, misses: number): string {
  if (misses === 1) return `No es. ${n.tip}`
  if (misses === 2) return `No es. Empieza con «${n.word[0]}».`
  return `Es «${n.display}»: armala para seguir.`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen vocabulario!', '¡Perfecto!']
/** The pause after the last name, with it on screen, before the result card. */
const ADVANCE_MS = 1300
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not place a letter: the letters sit where that button was. */
const SETTLE_MS = 400

/** One box per letter of a name. */
function Boxes({ word, letters, right }: { word: string; letters: string[]; right: boolean }) {
  const long = word.length > 6
  return (
    <div className="flex flex-wrap justify-center gap-1" aria-hidden="true">
      {[...word].map((_, i) => (
        <span
          key={i}
          className={[
            'flex h-9 items-center justify-center rounded-lg border-2 font-extrabold',
            long ? 'w-7 text-lg' : 'w-8 text-xl',
            right
              ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
              : letters[i]
                ? 'border-slate-400 bg-white text-slate-900'
                : 'border-dashed border-slate-300 bg-white',
          ].join(' ')}
        >
          {letters[i]}
        </span>
      ))}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Entre las letras sueltas se esconden tres nombres de la categoría que te decimos.',
    'Leé una pista, tocá las letras en orden para armar el nombre y apretá «Listo». Cada letra se usa una sola vez.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-base font-semibold text-slate-500">Por ejemplo:</p>
        <p className="mt-1 text-lg font-bold leading-snug text-slate-900">«{EXAMPLE.clue}»</p>
        <div className="mt-2">
          <Boxes word={EXAMPLE.word} letters={[...EXAMPLE.word]} right={false} />
        </div>
      </div>
      <div className="sticky bottom-3 z-10 mt-4 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface LevelViewProps {
  levelIdx: number
  tiles: Tile[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, tiles, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = level.names.length

  // The tile ids typed in each row, the row being filled, the rows found and the wrong names each row has had.
  const [typed, setTyped] = useState<number[][]>(() => level.names.map(() => []))
  const [active, setActive] = useState(0)
  const [found, setFound] = useState<number[]>([])
  const [misses, setMisses] = useState<number[]>(() => level.names.map(() => 0))
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const lastTileRef = useRef({ id: -1, at: -Infinity })
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const busy = advancing || done
  // 44px tiles: five to a row on a 320px phone, six on a 375px one. Every level has 14 or 15 letters, three rows at 320.
  const compact = tiles.length > 12
  const used = new Set(typed.flat())
  const tileChar = (id: number) => tiles.find((t) => t.id === id)?.ch ?? ''
  const activeWord = level.names[active]
  const activeFull = typed[active].length === activeWord.word.length
  const rowOpen = !found.includes(active)

  function tapTile(id: number, at: number) {
    if (busy || !rowOpen || at - since < SETTLE_MS) return
    const last = lastTileRef.current
    if (last.id === id && at - last.at < SETTLE_MS) return
    lastTileRef.current = { id, at }
    if (used.has(id)) return
    setTyped((rows) => rows.map((r, i) => (i === active && r.length < activeWord.word.length ? [...r, id] : r)))
    setHint(null)
  }
  function backspace(at: number) {
    if (busy || !rowOpen || at - since < SETTLE_MS) return
    setTyped((rows) => rows.map((r, i) => (i === active ? r.slice(0, -1) : r)))
  }
  function pickRow(i: number, at: number) {
    if (busy || found.includes(i) || at - since < SETTLE_MS) return
    setActive(i)
    setHint(null)
  }
  function submit(at: number) {
    if (busy || !rowOpen || !activeFull || at - since < SETTLE_MS) return
    const built = typed[active].map(tileChar).join('')
    // A name is right whichever clue was being answered: it may be the name of another row that is still open.
    const hit = level.names.findIndex((n, i) => n.word === built && !found.includes(i))
    if (hit >= 0) {
      const nextFound = [...found, hit]
      setTyped((rows) => rows.map((r, i) => (i === hit ? typed[active] : i === active ? [] : r)))
      setFound(nextFound)
      setHint({ text: `¡Eso es! «${level.names[hit].display}».`, ok: true })
      if (nextFound.length === total) {
        setAdvancing(true)
        advanceTimerRef.current = window.setTimeout(() => {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }, ADVANCE_MS)
      } else {
        const nextOpen = level.names.findIndex((_, i) => !nextFound.includes(i))
        setActive(nextOpen)
      }
      return
    }
    const n = misses[active] + 1
    setMisses((m) => m.map((x, i) => (i === active ? n : x)))
    setTyped((rows) => rows.map((r, i) => (i === active ? [] : r)))
    setHint({ text: missHint(activeWord, n), ok: false })
    onMistake()
  }

  return (
    <div ref={topRef} className="px-5 pb-2 pt-2.5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            {level.category}: llevás {found.length} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>


          {/* The three clues as tabs (a found name takes its tab), and the clue being answered with its boxes: one clue at
              a time keeps the letters and "Listo" on screen on a short phone. Any tab can be opened first. */}
          <div className="mx-auto mt-1.5 grid max-w-md grid-cols-3 gap-1.5" role="group" aria-label="Pistas">
            {level.names.map((n, i) => {
              const isFound = found.includes(i)
              const isActive = active === i && !busy
              return (
                <button
                  key={n.word}
                  type="button"
                  disabled={busy || isFound}
                  aria-pressed={isActive}
                  aria-label={isFound ? `Pista ${i + 1}: ${n.display}` : `Pista ${i + 1}, ${n.word.length} letras`}
                  onClick={(e) => pickRow(i, e.timeStamp)}
                  className={[
                    'flex min-h-[44px] items-center justify-center rounded-2xl border-2 px-1 text-base font-bold transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isFound
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isActive
                        ? 'border-tiam-blue bg-tiam-blue text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-tiam-blue/40',
                  ].join(' ')}
                >
                  {isFound ? n.display : `Pista ${i + 1}`}
                </button>
              )
            })}
          </div>
          <div className="mx-auto mt-1 max-w-md rounded-2xl border-2 border-tiam-blue bg-tiam-blue/5 px-3 py-1 text-center">
            <span className="block text-base font-semibold leading-snug text-slate-800">{level.names[active].clue}</span>
            <span className="mt-1 block">
              <Boxes word={level.names[active].word} letters={typed[active].map(tileChar)} right={found.includes(active)} />
            </span>
          </div>

          <p
            role="status"
            className={`mx-auto mt-0.5 min-h-[2.75rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? (found.length === 0 ? 'Tocá las letras para armar un nombre.' : '')}
          </p>

          {/* The heap of letters: a letter in a box, or in a name already found, is used up */}
          <div role="group" aria-label="Letras sueltas" className={`mx-auto flex max-w-md flex-wrap justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
            {tiles.map((t) => {
              const isUsed = used.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy || isUsed || !rowOpen}
                  aria-label={`Letra ${t.ch}`}
                  onClick={(e) => tapTile(t.id, e.timeStamp)}
                  className={[
                    'flex items-center justify-center rounded-xl border-2 font-bold transition',
                    compact ? 'h-11 w-11 text-lg' : 'h-12 w-12 text-xl',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50',
                    isUsed ? 'border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-300 bg-white text-slate-800 hover:border-tiam-blue/40 active:bg-tiam-blue/10',
                  ].join(' ')}
                >
                  {t.ch}
                </button>
              )
            })}
          </div>

          <div className="sticky bottom-0 z-10 mx-auto mt-1 flex max-w-md gap-2 bg-white/95 pb-0.5 pt-1">
            <button
              type="button"
              aria-label="Borrar la última letra"
              disabled={busy || !rowOpen || typed[active].length === 0}
              onClick={(e) => backspace(e.timeStamp)}
              className="flex min-h-[48px] w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-slate-700 transition hover:border-tiam-blue/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 disabled:border-slate-200 disabled:text-slate-300"
            >
              <BackspaceIcon className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={busy || !rowOpen || !activeFull}
              onClick={(e) => submit(e.timeStamp)}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-tiam-blue px-4 text-xl font-bold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/50 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-500"
            >
              Listo
            </button>
          </div>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Encontraste los {total} nombres. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {level.names.map((n) => (
              <li key={n.word} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{n.display}</span>
                  <span className="text-slate-500"> — {n.clue}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function NombresEscondidos({ onComplete }: GameProps) {
  // The order of the loose letters of each level — decided once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_NAMES })
  }
  function handleStart(at: number) {
    setSince(at)
    setPhase('playing')
  }
  function handleNext(at: number) {
    setSince(at)
    setLevelIdx((i) => i + 1)
  }
  function handleRepeat(at: number) {
    setSince(at)
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Letras con sorpresa</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      tiles={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
