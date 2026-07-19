import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Oraciones a medida" — día 12, ejecutivas. A generative writing exercise: each
 * prompt is a sequence of numbers, and every number is the letter-count of a word
 * the person must invent, so the whole line becomes a sentence built to a size
 * pattern (e.g. 3-2-7 → "hoy es domingo"). It is deliberately the ONE exercise in
 * the challenge that asks the person to PRODUCE original language under a
 * constraint — holding the pattern in mind while retrieving words of an exact
 * length and stitching them into something that makes sense. That constraint
 * satisfaction is executive work first (plan, generate, self-monitor), language
 * second, which is why it lives on an ejecutivas day.
 *
 * Like día 6 (movement), día 18 (Stroop) and día 30 (cipher), this is a PAPEL Y
 * LÁPIZ day — solved off the phone, on paper. The phone shows how to read the
 * numbers plus the prompts; the person writes their sentences and then covers and
 * recalls them. Opens with "hoy es día de papel y lápiz" and closes with a single
 * "Ya lo hice" that reports a trivial completion — computeStars treats
 * totalAttempts === 0 as full accuracy, so the day counts toward the streak (3
 * estrellas por participar) without inventing a score for an open-ended task that
 * has no single right answer.
 *
 * The prompts are fixed and ordered easy→hard (three words → five words). Every
 * pattern was verified offline to be solvable with a natural Argentine-Spanish
 * sentence (scratchpad/verify_patterns.py) — reference worksheets carry real
 * errors, so our content is checked, not trusted. The format is inspired by a
 * paper worksheet; the patterns and the example are ours.
 */

// Cada patrón: la cantidad de letras de cada palabra de la oración a inventar.
// Ordenados de más fácil (3 palabras) a más difícil (5 palabras). Verificados
// como resolubles en scratchpad/verify_patterns.py.
const PATTERNS: number[][] = [
  [2, 5, 4],
  [3, 4, 6],
  [4, 2, 7],
  [2, 6, 3, 5],
  [3, 5, 4, 6],
  [2, 4, 3, 7, 5],
]

// Ejemplo mostrado en la consigna (patrón distinto a los de la lista, para no
// regalar ninguna respuesta). 3-2-7 → "hoy es domingo".
const EXAMPLE = { pattern: [3, 2, 7], sentence: 'Hoy es domingo' }

const fmt = (p: number[]) => p.join('   -   ')

type Phase = 'intro' | 'card' | 'done'

export function OracionesAMedida({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('intro')

  // Reporta una vez, al tocar "Ya lo hice". No hay puntaje — es un ejercicio de
  // papel, sin respuesta única — así que reporta una finalización trivial;
  // computeStars trata totalAttempts === 0 como acierto pleno (3 estrellas por
  // participar).
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
          <h2 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">Hoy se escribe: una oración a la medida.</h2>
          <p className="mx-auto mt-3 max-w-sm text-base text-slate-600">
            Cada renglón es una serie de números, y cada número te dice cuántas letras tiene que tener esa palabra. Con
            esas medidas, armá una oración que tenga sentido. Tené papel y lápiz cerca.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setPhase('card')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Empezar
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {phase === 'card' && (
        <div>
          {/* Cómo se lee: un ejemplo. */}
          <div className="rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3 text-center">
            <p className="text-[13px] font-semibold text-slate-500">
              Cada número es una palabra, y dice cuántas letras tiene:
            </p>
            <p className="mt-1.5 flex items-center justify-center gap-2 text-base">
              <span className="font-extrabold tracking-wider text-tiam-blue">{fmt(EXAMPLE.pattern)}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="font-bold uppercase tracking-wide text-slate-800">{EXAMPLE.sentence}</span>
            </p>
          </div>

          {/* Los patrones a resolver, de más corto a más largo. */}
          <ol className="mt-2.5 space-y-1">
            {PATTERNS.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-1.5"
              >
                <span className="w-4 shrink-0 text-sm font-bold text-slate-300">{i + 1}</span>
                <span className="text-xl font-extrabold tracking-wider text-tiam-blue">{fmt(p)}</span>
              </li>
            ))}
          </ol>

          {/* Consigna en dos pasos. */}
          <div className="mt-3 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3">
            <p className="text-sm font-semibold text-slate-600">
              <span className="font-bold text-tiam-blue">1.</span> Escribí una oración para cada renglón.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              <span className="font-bold text-tiam-blue">2.</span> Tapala y anotá las que recuerdes.
            </p>
          </div>

          <div className="mt-3 text-center">
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
          <p className="mt-4 text-2xl font-bold text-slate-900">¡Muy bien!</p>
          <p className="mt-2 text-base text-slate-600">
            Buscar palabras de la medida justa y armar con ellas una oración con sentido hace trabajar a la cabeza en dos
            cosas a la vez: planear y elegir. Ese esfuerzo es justamente el ejercicio.
          </p>
        </div>
      )}
    </div>
  )
}
