import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Letras perdidas" — deductive word completion. A word appears with holes in
 * it and one clue: what family it belongs to. Tap letters to fill the gaps.
 *
 * The category is the whole clue, exactly as in the paper sheet ("sólo
 * diremos que todas son nombres de emociones"). Without it a word with four
 * holes has too many readings; with it the search collapses to something a
 * person can actually reason through, which is the point.
 *
 * Correctness is checked on the RECONSTRUCTED WORD, never on which tile went
 * where. Half these pools contain repeated letters (BANANA, MEJILLA,
 * FELICIDAD) and a tile-identity check marks a perfectly good answer wrong
 * whenever the player happens to use the second A instead of the first.
 *
 * The first letter is never hidden: it anchors the word, the reference sheet
 * keeps it, and without it the category clue alone is a guessing game.
 */

interface Category {
  label: string
  words: string[]
}

// Plain uppercase A-Z throughout: no accents, no Ñ. Same deaccenting the rest
// of the catalog's letter-tile games use — a tile with a tilde reads as a
// different letter to a lot of players.
const CATEGORIES: Category[] = [
  {
    label: 'emociones',
    words: ['ENOJO', 'MIEDO', 'CALMA', 'TRISTEZA', 'SORPRESA', 'ORGULLO', 'GRATITUD', 'ALEGRIA', 'FELICIDAD', 'CONFIANZA', 'NOSTALGIA', 'ESPERANZA'],
  },
  {
    label: 'frutas',
    words: ['BANANA', 'SANDIA', 'MELON', 'CIRUELA', 'MANZANA', 'NARANJA', 'DURAZNO', 'FRUTILLA', 'CEREZA', 'MANDARINA'],
  },
  {
    label: 'animales',
    words: ['ZORRO', 'PERRO', 'CONEJO', 'JIRAFA', 'TORTUGA', 'CABALLO', 'ELEFANTE', 'CARPINCHO', 'LAGARTO', 'MULITA'],
  },
  {
    label: 'oficios',
    words: ['MEDICO', 'PINTOR', 'CARTERO', 'HERRERO', 'PLOMERO', 'MAESTRA', 'PANADERO', 'COCINERO', 'MECANICO'],
  },
  {
    label: 'partes del cuerpo',
    // Words carrying an Ñ (muñeca, pestaña, albañil) are left out rather than
    // stripped: "MUNECA" is not a word anyone reads as muñeca, and the tiles
    // in this catalog are plain A-Z by convention.
    words: ['CODO', 'HOMBRO', 'CABEZA', 'RODILLA', 'TOBILLO', 'ESPALDA', 'MEJILLA', 'GARGANTA'],
  },
  {
    label: 'colores',
    words: ['VERDE', 'NEGRO', 'BLANCO', 'MARRON', 'CELESTE', 'VIOLETA', 'AMARILLO', 'TURQUESA', 'DORADO', 'PLATEADO'],
  },
]

const byLabel = (label: string) => CATEGORIES.find((c) => c.label === label)!

interface Level {
  n: number
  name: string
  blanks: number
  minLen: number
  maxLen: number
  /** Extra unneeded letters in the bank — only the hardest level gets them. */
  decoys: number
  /** One round per category, and no category is shared with another level. */
  categories: Category[]
}

/**
 * Each level owns two categories and no level shares one. That partition is
 * what stops a word turning up twice in the same sitting: levels used to draw
 * from the whole pool independently, and ALEGRIA would show up in level 1 and
 * again in level 2 four rounds later, which reads as a bug even though both
 * rounds were internally fine.
 */
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', blanks: 2, minLen: 5, maxLen: 7, decoys: 0, categories: [byLabel('colores'), byLabel('frutas')] },
  { n: 2, name: 'Nivel 2', blanks: 3, minLen: 6, maxLen: 8, decoys: 0, categories: [byLabel('animales'), byLabel('partes del cuerpo')] },
  { n: 3, name: 'Nivel 3', blanks: 4, minLen: 7, maxLen: 9, decoys: 2, categories: [byLabel('emociones'), byLabel('oficios')] },
]

const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.categories.length, 0)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

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

interface Round {
  category: string
  word: string
  /** Indices of the hidden letters, ascending. */
  holes: number[]
  bank: string[]
}

function buildRounds(level: Level): Round[] {
  return shuffle(level.categories).map((cat) => {
    const fits = cat.words.filter((w) => w.length >= level.minLen && w.length <= level.maxLen)
    const word = pickOne(fits.length ? fits : cat.words)
    // Index 0 stays visible; sampling the rest without replacement keeps the
    // hole count exact without a retry loop.
    const holes = shuffle(Array.from({ length: word.length - 1 }, (_, i) => i + 1))
      .slice(0, Math.min(level.blanks, word.length - 2))
      .sort((a, b) => a - b)
    const needed = holes.map((i) => word[i])
    const spare = ALPHABET.filter((c) => !word.includes(c))
    const bank = shuffle([...needed, ...shuffle(spare).slice(0, level.decoys)])
    return { category: cat.label, word, holes, bank }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa no era. Acordate de la pista de arriba.',
  'Todavía no. Probá con otras letras.',
  'Casi. Leé la palabra completa en voz alta a ver cómo suena.',
]

export function LetrasPerdidas({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const rounds = useMemo(
    () => buildRounds(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const round = rounds[roundIdx]
  const done = roundIdx >= rounds.length

  /** Bank positions already used, so a repeated letter still spends one tile. */
  const [used, setUsed] = useState<number[]>([])
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  /**
   * One entry per letter position, '' for a hole still to fill. Deliberately
   * an array and not a joined string: blanking a position with '' and calling
   * join('') silently deletes it, so the word rendered short and every index
   * after a hole shifted — the letters inherited the holes' styling and the
   * gaps themselves never appeared.
   */
  const cells = useMemo(() => {
    if (!round) return []
    const chars = round.word.split('')
    round.holes.forEach((h, i) => {
      chars[h] = used[i] !== undefined ? round.bank[used[i]] : ''
    })
    return chars
  }, [round, used])

  function place(bankIdx: number) {
    if (!round || solved || used.includes(bankIdx) || used.length >= round.holes.length) return
    const next = [...used, bankIdx]
    setUsed(next)
    setHint(null)
    if (next.length < round.holes.length) return
    // Compare the reconstructed word, never the tile order — see file header.
    const built = round.word
      .split('')
      .map((c, i) => {
        const at = round.holes.indexOf(i)
        return at === -1 ? c : round.bank[next[at]]
      })
      .join('')
    if (built === round.word) {
      setSolved(true)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setUsed([])
        setSolved(false)
      }, 850)
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
      setUsed([])
    }
  }
  function undo() {
    if (solved) return
    setUsed((u) => u.slice(0, -1))
    setHint(null)
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` would read the
  // previous level's stale-true value on the very render that arrives at the
  // new level and fire onComplete with garbage. Same as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setUsed([])
    setSolved(false)
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level's last round resolves. A
  // genuine full-day restart (the wrap to level 1) gets a new roundKey so it
  // can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && round && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Completá las letras que faltan
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Pista: todas son <span className="font-bold text-tiam-blue">{round.category}</span>.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Palabra {roundIdx + 1} de {rounds.length}
            </p>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* The word, holes and all */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            {cells.map((c, i) => {
              const isHole = round.holes.includes(i)
              return (
                <span
                  key={i}
                  className={[
                    'flex h-12 w-9 items-center justify-center rounded-lg text-2xl font-extrabold sm:h-14 sm:w-11 sm:text-3xl',
                    isHole && !c ? 'border-b-4 border-tiam-blue/40 text-slate-300' : '',
                    isHole && c ? 'bg-tiam-blue/10 text-tiam-blue-dark' : '',
                    !isHole ? 'text-slate-800' : '',
                    solved ? 'bg-tiam-green/10 text-tiam-green' : '',
                  ].join(' ')}
                >
                  {c || '·'}
                </span>
              )
            })}
          </div>

          {/* Letter bank */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {round.bank.map((letter, i) => {
              const spent = used.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={spent || solved}
                  onClick={() => place(i)}
                  aria-label={`letra ${letter}`}
                  className={[
                    'flex h-12 w-12 items-center justify-center rounded-xl border-2 text-xl font-extrabold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    spent
                      ? 'border-slate-200 bg-slate-50 text-slate-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {letter}
                </button>
              )
            })}
          </div>

          {used.length > 0 && !solved && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={undo}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Sacar la última
              </button>
            </div>
          )}

          {solved && (
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-lg font-bold text-tiam-green">
              <Check className="h-5 w-5" strokeWidth={3} />
              {round.word}
            </p>
          )}

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Recuperaste las {rounds.length} palabras — ¡completaste el {level.name.toLowerCase()}!
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
