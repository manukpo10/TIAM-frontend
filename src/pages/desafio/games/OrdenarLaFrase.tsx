import { useMemo, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'

/**
 * "Ordená la frase" — a word-order reconstruction / sentence-building game.
 *
 * Tap words from the bank, in the order you think they go, to build the
 * sentence — tap a placed word to undo it. No live right/wrong per tap: a
 * partial order isn't meaningful until complete, so feedback only reveals
 * on "Revisar," and even then it's warm either way — the correct sentence
 * shows as a gentle reference, never a hard "you failed."
 */

interface SentenceEntry {
  words: string[]
  distractor?: string
}
interface SentenceLevel {
  n: number
  name: string
  sentences: SentenceEntry[]
}

const LEVELS: SentenceLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    sentences: [
      { words: ['El', 'mate', 'está', 'listo'] },
      { words: ['Mi', 'nieta', 'llegó', 'temprano'] },
      { words: ['Hoy', 'hace', 'mucho', 'frío'] },
      { words: ['El', 'perro', 'perdió', 'la', 'pelota'] },
      { words: ['Compré', 'pan', 'en', 'la', 'panadería'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    sentences: [
      { words: ['Los', 'chicos', 'juegan', 'a', 'la', 'pelota', 'en', 'el', 'parque'] },
      { words: ['El', 'colectivo', 'pasó', 'antes', 'de', 'tiempo', 'esta', 'mañana'] },
      { words: ['Guardé', 'las', 'fotos', 'viejas', 'en', 'una', 'caja', 'de', 'cartón'] },
      { words: ['Mañana', 'temprano', 'visitamos', 'a', 'la', 'abuela', 'en', 'su', 'casa'] },
      { words: ['El', 'sol', 'entra', 'muy', 'fuerte', 'por', 'la', 'ventana', 'grande'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    sentences: [
      {
        words: ['Mi', 'hermano', 'trabaja', 'en', 'una', 'farmacia', 'del', 'centro', 'desde', 'hace', 'diez', 'años'],
        distractor: 'paraguas',
      },
      {
        words: ['El', 'técnico', 'vino', 'a', 'arreglar', 'la', 'heladera', 'esta', 'mañana', 'bien', 'temprano'],
        distractor: 'chocolate',
      },
      {
        words: ['La', 'radio', 'anunció', 'esta', 'mañana', 'que', 'después', 'va', 'a', 'llover'],
        distractor: 'semáforo',
      },
      {
        words: ['Ayer', 'a', 'la', 'tarde', 'tomamos', 'mate', 'con', 'las', 'vecinas', 'de', 'al', 'lado'],
        distractor: 'computadora',
      },
      {
        words: ['Encontré', 'una', 'carta', 'vieja', 'en', 'el', 'fondo', 'del', 'placard', 'de', 'mi', 'cuarto'],
        distractor: 'zapatillas',
      },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Muy bien armada!', '¡Así se hace!', '¡Excelente!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo queda la frase correcta.',
  '¡Casi! Con la práctica te sale cada vez mejor.',
]

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function OrdenarLaFrase() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const sentence = useMemo(
    () => pickOne(level.sentences),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const pool = useMemo(
    () => (sentence.distractor ? [...sentence.words, sentence.distractor] : sentence.words),
    [sentence],
  )
  const distractorId = sentence.distractor ? sentence.words.length : null

  const { bank, placed, place, unplace } = useSequencingPuzzle(pool, `${levelIdx}-${roundKey}`)
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])

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

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
  }
  function nextLevel() {
    setChecked(false)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setChecked(false)
    setRoundKey((k) => k + 1)
  }

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          Lenguaje · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          {sentence.distractor
            ? 'Ordená la frase — ¡una de estas palabras no pertenece!'
            : 'Ordená las palabras para armar la frase'}
        </h2>
        <p className="mt-2 text-base text-slate-500">Tocalas en el orden que creas correcto.</p>
      </div>

      {/* Sentence being built */}
      <div className="mt-6 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
        {placed.length === 0 && (
          <span className="text-sm text-slate-400">Tocá las palabras de abajo para empezar</span>
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
          </div>
        </div>
      )}
    </div>
  )
}
