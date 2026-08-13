import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, ListOrdered } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Ordená la frase" — a word-order reconstruction / sentence-building game.
 *
 * Tap words from the bank, in the order you think they go, to build the
 * sentence — tap a placed word to undo it. No live right/wrong per tap: a
 * partial order isn't meaningful until complete, so feedback only reveals
 * on "Revisar," and even then it's warm either way — the correct sentence
 * shows as a gentle reference, never a hard "you failed."
 *
 * MULTIPLE rounds per level (same pattern as "Los opuestos" / "La canción
 * de tu juventud"): each level draws `rounds` distinct sentences from its
 * own pool (shuffle + slice), never repeating within a level. Unlike those
 * two games — which resolve each round with a single tap and auto-advance
 * after a timeout — here the result only reveals once you tap "Revisar,"
 * and a wrong answer needs to be READ (the correct sentence, spelled out).
 * So advancing to the next round sits behind an explicit "Siguiente frase"
 * button instead of a timeout: auto-advancing on a clock here would rush
 * that reading, which conflicts with this app's "no timer" rule.
 *
 * A one-time "¿Listo?" ready screen gates the START of the day (component
 * mount), not every round — same pattern as Encaminada.tsx. The header used
 * to carry the "how to play" h2 + caption on EVERY round (bare `{!done &&
 * (...)}`), which with nivel 3's 12-word sentence pushed the word tiles
 * below the fold on a 375×812 screen. Moving that text out reclaims ~90px
 * from the persistent header; wrapped word-tile rows cost ~44px/line, so
 * nivel 3 fits with margin to spare here — no tile/font shrinking needed
 * (unlike Encaminada's 5×5 grid, which is far more expensive per pixel of
 * width — see that file for when shrinking IS actually necessary). `phase`
 * flips to 'playing' once and never resets — not on level-advance, not on
 * "Otra frase" — those are a replay by someone who already knows the rules.
 */

interface SentenceEntry {
  words: string[]
  distractor?: string
}
interface SentenceLevel {
  n: number
  name: string
  rounds: number
  sentences: SentenceEntry[]
}

// Cada nivel tenía un pool de 5 frases (rounds=2/3/3, al azar); recortado a
// las 2 frases más largas/complejas de cada pool (rounds=2 parejo), a pedido
// del usuario ("dos ejercicios por nivel, deja los más difíciles") — no un
// recorte al azar, así siempre quedan las mismas dos, las más exigentes.
const LEVELS: SentenceLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    sentences: [
      { words: ['El', 'perro', 'perdió', 'la', 'pelota'] },
      { words: ['Compré', 'pan', 'en', 'la', 'panadería'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    sentences: [
      { words: ['Mañana', 'temprano', 'visitamos', 'a', 'la', 'abuela', 'en', 'su', 'casa'] },
      { words: ['El', 'sol', 'entra', 'muy', 'fuerte', 'por', 'la', 'ventana', 'grande'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    // No distractor word here anymore: the 12-word length is already the
    // step up from nivel 2 (9 words) — stacking "also spot the foreign
    // word" on top made this level a bigger jump than the app's usual pace.
    sentences: [
      { words: ['Mi', 'hermano', 'trabaja', 'en', 'una', 'farmacia', 'del', 'centro', 'desde', 'hace', 'diez', 'años'] },
      { words: ['Encontré', 'una', 'carta', 'vieja', 'en', 'el', 'fondo', 'del', 'placard', 'de', 'mi', 'cuarto'] },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Muy bien armada!', '¡Así se hace!', '¡Excelente!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo queda la frase correcta.',
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

export function OrdenarLaFrase({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` distinct sentences for this level, chosen once per
  // level/roundKey — never repeats within a single level.
  const roundSentences = useMemo(
    () => shuffle(level.sentences).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const sentence = roundSentences[roundIdx]
  const pool = useMemo(
    () => (sentence.distractor ? [...sentence.words, sentence.distractor] : sentence.words),
    [sentence],
  )
  const distractorId = sentence.distractor ? sentence.words.length : null

  const { bank, placed, place, unplace } = useSequencingPuzzle(pool, `${levelIdx}-${roundKey}-${roundIdx}`)
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across any same-level replay —
  // every submission counts), only zeroed on a true day restart (see
  // nextLevel's wrap branch). Same model as CuantosHay.tsx.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // "Done" isn't just "bank empty" here — if the sentence has a distractor
  // word, the player is also done the moment only the distractor is left
  // un-placed (that's the correct outcome). Deliberately NOT part of the
  // shared hook: this rule only makes sense for sentences with a foreign word.
  const readyToCheck =
    bank.length === 0 || (distractorId !== null && bank.length === 1 && bank[0].id === distractorId)

  const includedDistractor = distractorId !== null && placed.some((item) => item.id === distractorId)
  const placedReal = placed.filter((item) => item.id !== distractorId)
  const isCorrect =
    !includedDistractor &&
    placedReal.length === sentence.words.length &&
    placedReal.every((item, i) => item.id === i)

  // True once the LAST round of the level has been checked — gates the
  // level-complete screen (nextLevel/replay) instead of the plain "next
  // round" button. Derived from `checked` + `roundIdx`, both real state
  // reset synchronously below — never from a value reset inside a
  // useEffect (see nextLevel()'s comment for why that matters).
  const done = checked && roundIdx >= level.rounds - 1

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    // Per-word mistake count, derived from state the component already has:
    // every placed real word sitting outside its correct slot is a mistake,
    // plus one more if the distractor got placed at all (that alone can make
    // a round wrong even when every real word is otherwise in order).
    const wordMistakes = placedReal.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + wordMistakes + (includedDistractor ? 1 : 0))
    setAccAttempts((a) => a + pool.length)
  }
  // Advance to the next round within the level. Only reachable while
  // `!done` — the button that calls this doesn't render once the level is
  // complete.
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }
  // Resets happen HERE, synchronously with the level/round change (checked
  // was already reset this way before this retrofit) — keeping it that way
  // means the onComplete-reporting effect below never sees a stale `checked`
  // (or `roundIdx`) paired with a fresh `levelIdx` on the same render.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulator — a same-round replay must NOT, even on level 1.
    if (isWrap) {
      setAccMistakes(0)
      setAccAttempts(0)
    }
  }
  function replay() {
    setChecked(false)
    setRoundIdx(0)
    setRoundKey((k) => k + 1)
  }

  // Reports the SUM across levels 1→2→3, not just level 3: check() already
  // folded this level's numbers into accMistakes/accAttempts above. Fires
  // once per roundKey so a genuine full-day restart (wrap to level 1, new
  // roundKey) can report again.
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pantalla previa: única vez, al principio del día — mismo patrón que
          Encaminada.tsx. Saca el "cómo se juega" del header persistente (antes
          se repetía en cada ronda) para que la frase de 12 palabras de nivel 3
          no empuje las fichas fuera de la pantalla en 375×812. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <ListOrdered className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver las palabras de una frase, desordenadas. Tocalas en el orden que creas correcto para armarla.
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
          {/* Sentence being built */}
          <div className="mt-6 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
            {placed.length === 0 && (
              <span className="text-base text-slate-400">Tocá las palabras de abajo para empezar</span>
            )}
            {placed.map((item, i) => {
              const isDistractor = item.id === distractorId
              const isRight = checked && !isDistractor && item.id === i
              const isWrong = checked && (isDistractor || item.id !== i)
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={checked}
                  onClick={() => unplace(item)}
                  className={[
                    'min-h-[44px] rounded-xl border-2 px-4 py-2 text-base font-semibold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isRight ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : '',
                    isWrong ? 'border-slate-300 bg-white text-slate-500' : '',
                    !checked ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10' : '',
                  ].join(' ')}
                >
                  {item.value}
                </button>
              )
            })}
          </div>

          {/* Word bank */}
          {!checked && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => place(item)}
                  className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value}
                </button>
              ))}
            </div>
          )}

          {/* Check button */}
          {readyToCheck && !checked && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Result */}
      {checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <p className="mt-2 text-slate-600">
              La frase correcta era:{' '}
              <span className="font-semibold text-slate-800">"{sentence.words.join(' ')}."</span>
              {sentence.distractor && (
                <> Y esta palabra no pertenecía a la frase: "{sentence.distractor}".</>
              )}
            </p>
          )}
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
                  Otra frase
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente frase
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
