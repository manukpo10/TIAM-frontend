import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Letras en movimiento" — día 6, praxias. A movement-and-spelling exercise: the
 * alphabet is mapped to four body gestures (raise right hand / left hand / both
 * hands / cross arms), and the player spells each word OUT LOUD while doing the
 * gesture for every letter — then covers it and tries to recall the words. It
 * layers ideomotor praxis (performing a gesture on demand — genuinely a praxias
 * task, which is why it belongs on this day), spelling, and memory. It's the one
 * exercise in the whole challenge that gets the person physically MOVING, which
 * for an older adult is worth double.
 *
 * Like día 18 (Stroop) and día 30 (cipher), this is a PAPEL Y LÁPIZ day — solved
 * off the phone, standing up. The phone shows the gesture legend, the
 * alphabet→gesture key and the words; the person does the movements and writes
 * their recalled words on paper. Opens with "hoy es día de papel y lápiz" and
 * closes with a single "Ya lo hice" that reports a trivial completion —
 * computeStars treats totalAttempts === 0 as full accuracy, so the day counts
 * toward the streak (3 estrellas por participar) without a fake score.
 *
 * The alphabet→gesture map is fixed and balanced (~7 letters per gesture); the
 * words are picked at random from a pool each play so repeating the day gives a
 * different set. Content is original (the format is inspired by a paper
 * worksheet, the mapping and words are ours).
 */

type GestureId = 'derecha' | 'izquierda' | 'ambas' | 'cruzo'

interface Gesture {
  id: GestureId
  label: string
  color: string
  shape: 'circle' | 'square' | 'diamond' | 'bar'
}

// Cuatro gestos, cada uno con color Y forma distintos (código redundante para
// que se distingan aun con poca visión). Colores legibles en negrita sobre blanco.
const GESTURES: Gesture[] = [
  { id: 'derecha', label: 'Mano derecha', color: '#2563EB', shape: 'circle' },
  { id: 'izquierda', label: 'Mano izquierda', color: '#15803D', shape: 'square' },
  { id: 'ambas', label: 'Las dos manos', color: '#C2410C', shape: 'diamond' },
  { id: 'cruzo', label: 'Brazos cruzados', color: '#7C3AED', shape: 'bar' },
]
const gestureOf = (id: GestureId) => GESTURES.find((g) => g.id === id)!

// Abecedario → gesto, balanceado (~7 letras por gesto), fijo.
const LETTER_GESTURE: Record<string, GestureId> = {
  A: 'ambas', B: 'izquierda', C: 'cruzo', D: 'derecha', E: 'cruzo',
  F: 'izquierda', G: 'izquierda', H: 'derecha', I: 'derecha', J: 'ambas',
  K: 'derecha', L: 'ambas', M: 'izquierda', N: 'derecha', Ñ: 'ambas',
  O: 'derecha', P: 'ambas', Q: 'izquierda', R: 'cruzo', S: 'izquierda',
  T: 'cruzo', U: 'cruzo', V: 'cruzo', W: 'ambas', X: 'ambas',
  Y: 'derecha', Z: 'izquierda',
}
const ALPHABET = Object.keys(LETTER_GESTURE)

// Pozo de palabras: objetos/animales comunes, sin acento (se deletrean tal cual).
const WORD_POOL = [
  'mariposa',
  'chocolate',
  'bicicleta',
  'ventana',
  'paraguas',
  'mandarina',
  'zapatilla',
  'campana',
  'girasol',
  'tijera',
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Marcador de forma+color del gesto, reutilizado en la leyenda y en el abecedario.
function GestureMark({ id, size = 'h-4 w-4' }: { id: GestureId; size?: string }) {
  const g = gestureOf(id)
  if (g.shape === 'circle') return <span className={`${size} rounded-full`} style={{ backgroundColor: g.color }} />
  if (g.shape === 'square') return <span className={`${size} rounded-[3px]`} style={{ backgroundColor: g.color }} />
  if (g.shape === 'diamond')
    return <span className={`${size} rotate-45 rounded-[2px]`} style={{ backgroundColor: g.color }} />
  // bar
  return <span className={`h-2.5 w-5 rounded-full`} style={{ backgroundColor: g.color }} />
}

type Phase = 'intro' | 'card' | 'done'

export function LetrasEnMovimiento({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  // 6 palabras al azar del pozo, elegidas una vez al montar.
  const [words] = useState(() => shuffle(WORD_POOL).slice(0, 6))

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
            Hoy se juega de pie: cada letra es un movimiento.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-base text-slate-600">
            Cada letra tiene un gesto. Vas a deletrear palabras en voz alta haciendo el gesto de cada letra — y después,
            sin mirar, anotar las que recuerdes. Ponete cómodo, con lugar para mover los brazos.
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
          {/* Leyenda: los cuatro gestos. */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-2.5">
            {GESTURES.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <GestureMark id={g.id} />
                </span>
                <span className="text-[13px] font-semibold leading-tight text-slate-700">{g.label}</span>
              </div>
            ))}
          </div>

          {/* Abecedario con el gesto de cada letra (9 por fila → 3 filas justas). */}
          <div className="mt-2.5 grid grid-cols-9 gap-1">
            {ALPHABET.map((letter) => (
              <div
                key={letter}
                className="flex flex-col items-center rounded-md border border-slate-200 bg-white py-0.5"
              >
                <span className="text-base font-extrabold text-slate-900">{letter}</span>
                <span className="flex h-4 items-center justify-center">
                  <GestureMark id={LETTER_GESTURE[letter]} size="h-3 w-3" />
                </span>
              </div>
            ))}
          </div>

          {/* Palabras a deletrear + consigna. */}
          <div className="mt-2.5 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-2.5">
            <p className="text-sm font-semibold text-slate-600">
              <span className="font-bold text-tiam-blue">1.</span> Deletreá cada palabra en voz alta con el gesto de cada
              letra:
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
              {words.map((w) => (
                <span key={w} className="text-lg font-extrabold uppercase tracking-wide text-slate-800">
                  {w}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-sm font-semibold text-slate-600">
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
            Mover el cuerpo mientras pensás cada letra hace trabajar la cabeza y el cuerpo a la vez. Ese esfuerzo doble
            es justamente lo que buscamos.
          </p>
        </div>
      )}
    </div>
  )
}
