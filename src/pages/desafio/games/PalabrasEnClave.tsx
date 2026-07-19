import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Palabras en clave" — día 30, the challenge's closing exercise. A number
 * cipher: a source word whose letters are all distinct gives each letter a
 * number; number sequences then decode back into new words made only from those
 * letters. Then the player is asked to find MORE words on their own. It layers
 * three demands — decoding (attention / working memory), word formation
 * (language), and cover-and-recall (memory) — which is why it lands here as the
 * finale, and squarely in the "make them think" territory the professional
 * asked us to prioritise.
 *
 * Like día 18 (Stroop), this is a PAPEL Y LÁPIZ day, not an interactive tap
 * game: everything is solved off the phone, on paper. The phone shows the source
 * word + its cipher key + the clues to decode; the person writes their answers.
 * Opens with an explicit "hoy es día de papel y lápiz" screen and closes with a
 * single "Ya lo hice" that reports a trivial completion — computeStars treats
 * totalAttempts === 0 as full accuracy, so the day counts toward the streak
 * without dividing by zero or inventing a score.
 *
 * The number→letter mapping is DELIBERATELY SCRAMBLED (D is not necessarily 1),
 * so it can't be solved by counting position — you have to read the key. All
 * source words have distinct letters (so each maps to a unique digit) and every
 * clue word and its encoding was verified offline to use only the source's
 * letters (reference worksheets carry real errors — the anagram lesson). Content
 * is original: the format is inspired by a paper worksheet, the words are ours.
 */

interface CodeClue {
  word: string
  seq: number[]
}
interface CodePuzzle {
  source: string
  letters: string[]
  numbers: number[] // paralelo a letters — el dígito de cada letra
  clues: CodeClue[]
}

// Puzzles verificados offline (ver scratchpad/codigo.py). Cada palabra madre con
// letras distintas; cada pista usa sólo esas letras; mapeo scrambled fijo.
const PUZZLES: CodePuzzle[] = [
  {
    source: 'descargo',
    letters: ['d', 'e', 's', 'c', 'a', 'r', 'g', 'o'],
    numbers: [2, 1, 3, 6, 4, 5, 7, 8],
    clues: [
      { word: 'casa', seq: [6, 4, 3, 4] },
      { word: 'cosa', seq: [6, 8, 3, 4] },
      { word: 'acero', seq: [4, 6, 1, 5, 8] },
      { word: 'cargo', seq: [6, 4, 5, 7, 8] },
      { word: 'grado', seq: [7, 5, 4, 2, 8] },
      { word: 'rasgo', seq: [5, 4, 3, 7, 8] },
      { word: 'cerdo', seq: [6, 1, 5, 2, 8] },
      { word: 'cedro', seq: [6, 1, 2, 5, 8] },
    ],
  },
  {
    source: 'cuadernos',
    letters: ['c', 'u', 'a', 'd', 'e', 'r', 'n', 'o', 's'],
    numbers: [6, 7, 9, 2, 8, 5, 1, 4, 3],
    clues: [
      { word: 'cena', seq: [6, 8, 1, 9] },
      { word: 'duna', seq: [2, 7, 1, 9] },
      { word: 'nudo', seq: [1, 7, 2, 4] },
      { word: 'causa', seq: [6, 9, 7, 3, 9] },
      { word: 'ronda', seq: [5, 4, 1, 2, 9] },
      { word: 'duros', seq: [2, 7, 5, 4, 3] },
      { word: 'adornos', seq: [9, 2, 4, 5, 1, 4, 3] },
      { word: 'cansado', seq: [6, 9, 1, 3, 9, 2, 4] },
    ],
  },
  {
    source: 'panderos',
    letters: ['p', 'a', 'n', 'd', 'e', 'r', 'o', 's'],
    numbers: [7, 1, 5, 4, 8, 2, 6, 3],
    clues: [
      { word: 'panes', seq: [7, 1, 5, 8, 3] },
      { word: 'sapo', seq: [3, 1, 7, 6] },
      { word: 'ropa', seq: [2, 6, 7, 1] },
      { word: 'peras', seq: [7, 8, 2, 1, 3] },
      { word: 'prendas', seq: [7, 2, 8, 5, 4, 1, 3] },
      { word: 'separo', seq: [3, 8, 7, 1, 2, 6] },
      { word: 'poder', seq: [7, 6, 4, 8, 2] },
      { word: 'repaso', seq: [2, 8, 7, 1, 3, 6] },
    ],
  },
]

type Phase = 'intro' | 'puzzle' | 'done'

export function PalabrasEnClave({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  // Un puzzle al azar del pool, elegido una sola vez al montar — repetir el día
  // da otro distinto.
  const [puzzleIdx] = useState(() => Math.floor(Math.random() * PUZZLES.length))
  const puzzle = PUZZLES[puzzleIdx]

  // Reporta una vez, al tocar "Ya lo hice". No hay puntaje — es un ejercicio de
  // papel — así que reporta una finalización trivial; computeStars trata
  // totalAttempts === 0 como acierto pleno (3 estrellas por participar).
  const reportedRef = useRef(false)
  useEffect(() => {
    if (phase === 'done' && !reportedRef.current) {
      reportedRef.current = true
      onComplete({ mistakes: 0, totalAttempts: 0 })
    }
  }, [phase, onComplete])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {phase === 'intro' && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
            Hoy es día de papel y lápiz
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">
            El último día se juega en voz baja, con lápiz en mano.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-base text-slate-600">
            Una palabra le pone un número a cada letra. Con esos números vas a descubrir palabras escondidas — y después
            a buscar muchas más por tu cuenta. Tené papel y lápiz cerca.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setPhase('puzzle')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Empezar
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {phase === 'puzzle' && (
        <div>
          {/* Clave: la palabra madre y el número de cada letra, en columnas. */}
          <div className="overflow-x-auto">
            <div className="mx-auto flex w-max gap-0.5">
              {puzzle.letters.map((letter, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-t-md border-2 border-slate-300 bg-white text-lg font-extrabold uppercase text-slate-900 sm:h-10 sm:w-10">
                    {letter}
                  </div>
                  <div className="flex h-8 w-9 items-center justify-center rounded-b-md border-2 border-t-0 border-slate-300 bg-slate-50 text-base font-bold text-tiam-blue sm:w-10">
                    {puzzle.numbers[i]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paso 1: decodificar las pistas. */}
          <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-600">
              <span className="font-bold text-tiam-blue">1.</span> Descubrí cada palabra con el código. Tapala y anotá
              las que te acuerdes.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {puzzle.clues.map((clue, i) => (
                <p key={i} className="text-center text-base font-bold tracking-wide text-slate-700">
                  {clue.seq.join(' - ')}
                </p>
              ))}
            </div>
          </div>

          {/* Paso 2: buscar más. */}
          <div className="mt-3 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-600">
              <span className="font-bold text-tiam-blue">2.</span> Ahora buscá al menos 10 palabras más, armando otras
              combinaciones con esas mismas letras (vale repetir una letra). Tapalas y anotá las que recuerdes.
            </p>
          </div>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setPhase('done')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Ya lo hice
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="mt-2 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-8 w-8 text-tiam-green" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">¡Lo lograste!</p>
          <p className="mt-2 text-base text-slate-600">
            Descifrar, armar palabras nuevas y acordarte de ellas puso a trabajar tu cabeza de varias maneras a la vez.
            Un cierre a la altura de estos 30 días. ¡Gracias por dedicarte este tiempo!
          </p>
        </div>
      )}
    </div>
  )
}
