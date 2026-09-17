import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El refrán escondido" — visual search + sequencing. The pieces of a saying
 * are scattered out of order, each carrying its position number; tap them in
 * numeric order and the saying assembles itself.
 *
 * Named for the payoff, not for speed: the paper exercise this adapts is
 * called "lectura rápida," but this catalog never runs a timer, and a title
 * promising speed would set up an expectation the game deliberately refuses.
 *
 * Validation is LIVE, one tap at a time — deliberately NOT useSequencingPuzzle
 * (which places freely and checks at the end). The numbers already tell you
 * the answer, so there is nothing to "solve" at the end; the exercise is the
 * scan itself, and feedback has to land on the tap that missed.
 *
 * Fragments are derived, not hand-authored: `toFragments` splits a saying on
 * spaces and absorbs any piece of 3 letters or fewer into the next one.
 * Hand-chunking 19 sayings by eye invites inconsistency, and a lone "y" or
 * "de" is both a poor tap target and trivially findable — which would make
 * the scan, the entire point of the game, free.
 */

interface Level {
  n: number
  name: string
  rounds: number
  sayings: string[]
}

// Traditional Spanish/Rioplatense refranes — public sayings, no attribution
// needed. Grouped by length, which is what sets the fragment count and so the
// difficulty: the longer the saying, the more pieces there are to scan.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    sayings: [
      'No hay mal que por bien no venga',
      'Al mal tiempo, buena cara',
      'Donde hubo fuego, cenizas quedan',
      'Barriga llena, corazón contento',
      'Quien siembra vientos, recoge tempestades',
      'A caballo regalado no se le miran los dientes',
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    sayings: [
      'Aunque la mona se vista de seda, mona queda',
      'Camarón que se duerme, se lo lleva la corriente',
      'No dejes para mañana lo que puedas hacer hoy',
      'Agua que no has de beber, déjala correr',
      'Más vale pájaro en mano que cien volando',
      'Decime con quién andás y te digo quién sos',
      'El que se quemó con leche, ve una vaca y llora',
      'No hay peor ciego que el que no quiere ver',
      'Cuando el río suena, es porque agua trae',
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    sayings: [
      'Cuando las barbas de tu vecino veas cortar, poné las tuyas a remojar',
      'Al que nace barrigón, es al ñudo que lo fajen',
      'El que quiere celeste, que le cueste, y el que no, que se aguante',
      'No se puede estar en la misa y en la procesión',
    ],
  },
]

const lettersIn = (text: string) => text.replace(/[^a-záéíóúñü]/gi, '').length

function toFragments(sentence: string): string[] {
  const out: string[] = []
  let buffer = ''
  for (const word of sentence.split(' ')) {
    const candidate = buffer ? `${buffer} ${word}` : word
    if (lettersIn(candidate) <= 3) {
      buffer = candidate
      continue
    }
    out.push(candidate)
    buffer = ''
  }
  // A trailing scrap joins the piece before it rather than standing alone.
  if (buffer) {
    if (out.length > 0) out[out.length - 1] = `${out[out.length - 1]} ${buffer}`
    else out.push(buffer)
  }
  return out
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

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Todavía no es el turno de esa. Buscá el número que sigue.',
  'Esa viene después. Fijate cuál lleva el número siguiente.',
  'Ojo con el orden — buscá el número que va justo ahora.',
]

export function ElRefranEscondido({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` distinct sayings per level. Decided once — at mount — never
  // re-rolled just because the player re-visits a level, so "Repetir" can
  // hand back the exact same sayings deterministically (the on-screen
  // fragment scatter below still reshuffles every round).
  const [epoch] = useState(() => LEVELS.map((lvl) => shuffle(lvl.sayings).slice(0, lvl.rounds)))
  const roundSayings = epoch[levelIdx]

  const [roundIdx, setRoundIdx] = useState(0)
  const saying = roundSayings[roundIdx]
  const fragments = useMemo(() => toFragments(saying), [saying])
  const scattered = useMemo(
    () => shuffle(fragments.map((text, i) => ({ order: i, text }))),
    [fragments],
  )

  const [revealed, setRevealed] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Both accumulate across levels 1→2→3 and only zero on a genuine day
  // restart (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)
  const [correctTaps, setCorrectTaps] = useState(0)

  const roundSolved = revealed === fragments.length
  const done = roundSolved && roundIdx >= level.rounds - 1

  useEffect(() => {
    if (roundSolved) setPraise(pickOne(PRAISE))
  }, [roundSolved])

  function tap(order: number) {
    if (roundSolved) return
    if (order === revealed) {
      setRevealed((r) => r + 1)
      setCorrectTaps((c) => c + 1)
      setHint(null)
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
  }

  function nextRound() {
    setRoundIdx((i) => i + 1)
    setRevealed(0)
    setHint(null)
  }
  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render behind, so `done` would read
  // the previous level's stale-true value on the very render that arrives at
  // the new level and fire onComplete with garbage. Same as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setRevealed(0)
    setHint(null)
    if (isWrap) {
      setMistakes(0)
      setCorrectTaps(0)
    }
  }

  // Fires once per roundKey when the last level's last round resolves. A
  // genuine full-day restart (the wrap to level 1) gets a new roundKey, so it
  // can report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctTaps })
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
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Tocá las partes siguiendo los números
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Van a ir armando un refrán, de a un pedacito por vez.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Refrán {roundIdx + 1} de {level.rounds}
            </p>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Assembled so far */}
          <div className="mt-5 min-h-[72px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center">
            {revealed === 0 ? (
              <p className="text-base text-slate-400">
                Empezá por el número 1
              </p>
            ) : (
              <p className="text-lg font-semibold leading-relaxed text-slate-900">
                {fragments.slice(0, revealed).join(' ')}
                {!roundSolved && <span className="text-slate-300"> …</span>}
              </p>
            )}
          </div>

          {/* Scattered pieces */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {scattered.map((piece) => {
              const isUsed = piece.order < revealed
              return (
                <button
                  key={piece.order}
                  type="button"
                  disabled={isUsed || roundSolved}
                  onClick={() => tap(piece.order)}
                  aria-label={`${piece.text}, número ${piece.order + 1}`}
                  className={[
                    'inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-base transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isUsed
                      ? 'border-tiam-green/40 bg-tiam-green/5 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isUsed ? 'bg-tiam-green/20 text-tiam-green' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                  >
                    {piece.order + 1}
                  </span>
                  <span className="font-medium">{piece.text}</span>
                </button>
              )
            })}
          </div>

          {hint && !roundSolved && (
            <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>
          )}

          {/* Round solved — read it whole before moving on */}
          {roundSolved && (
            <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
                <Sparkles className="h-6 w-6 text-tiam-green" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
              <p className="mt-2 text-lg font-semibold text-slate-700">«{saying}»</p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={nextRound}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
                >
                  Siguiente refrán
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-2 text-lg font-semibold text-slate-700">«{saying}»</p>
          <p className="mt-2 text-slate-600">
            Armaste los {level.rounds} refranes — ¡completaste el {level.name.toLowerCase()}!
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
