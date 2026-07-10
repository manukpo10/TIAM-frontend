import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La charla desordenada" — a conversation-sequencing / executive-function
 * game. Order dialogue lines into a coherent conversation; the hardest
 * level adds one line that doesn't belong at all, exercising inhibition of
 * irrelevant information (shown to decline more with age than plain
 * reordering does).
 *
 * Shares the tap-to-place mechanic (and `useSequencingPuzzle`) with
 * "Ordená la frase," but is a separate component: dialogue lines are much
 * longer than single words and read better as stacked rows than inline
 * chips, and the distractor levels need "done"/"correct" rules the shared
 * hook deliberately doesn't know about — that logic lives here instead.
 */

interface Conversation {
  lines: string[]
  distractor?: string
}
interface ConvLevel {
  n: number
  name: string
  conversations: Conversation[]
}

const LEVELS: ConvLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    conversations: [
      {
        lines: [
          'Buen día, ¿cómo amaneció?',
          'Buen día, muy bien, gracias. ¿Y usted?',
          'Tirando, gracias a Dios. Que tenga un lindo día.',
        ],
      },
      {
        lines: [
          'Disculpe, ¿me podría decir la hora?',
          'Sí, cómo no. Son las cuatro y cuarto.',
          'Muchas gracias, muy amable.',
        ],
      },
      {
        lines: [
          '¡Qué calor que hace hoy, ¿no?!',
          'Uy, sí, un horno. Mejor quedarse a la sombra.',
          'Tal cual, yo ya regué las plantas bien tempranito.',
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    conversations: [
      {
        lines: [
          'Buenas tardes, ¿qué le puedo dar?',
          'Buenas tardes, deme media docena de facturas, por favor.',
          '¿De grasa o de manteca?',
          'De grasa, que me gustan más.',
          'Perfecto, ya se las preparo.',
        ],
      },
      {
        lines: [
          'Perdone, ¿cómo hago para llegar a la plaza San Martín?',
          'Siga derecho dos cuadras y después doble a la izquierda.',
          '¿Y queda lejos de ahí?',
          'No, para nada, a media cuadra más la va a ver.',
        ],
        distractor: 'Buenas, ¿a qué hora cierra la farmacia de la esquina?',
      },
      {
        lines: [
          'Hola má, ¿cómo andás?',
          'Hola hijo, bien acá. ¿Vos cómo estás?',
          'Todo bien. Che, ¿te parece si paso el domingo a comer con vos?',
          '¡Dale, me encantaría! Te espero al mediodía.',
        ],
      },
      {
        lines: [
          '¡Pero mirá quién está acá! ¡Cuánto tiempo, Susana!',
          '¡No lo puedo creer! ¿Cómo estás? Hace años que no nos vemos.',
          'Estoy bien, gracias a Dios. Tenemos que juntarnos a tomar unos mates y ponernos al día.',
          'Sí, por favor. Te paso mi número y así coordinamos.',
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    conversations: [
      {
        lines: [
          'Hola mamá, te llamaba por lo de Tomás.',
          'Hola hija, contame, ¿qué pasa con el cumpleaños?',
          'Estaba pensando en hacerle una fiesta el sábado que viene.',
          'Me parece una idea hermosa, ¿puedo ayudar con la torta?',
          '¡Obvio! Vos hacé la de chocolate que a él le encanta.',
          'Y yo me ocupo de las guirnaldas y los globos, así entre las dos dejamos todo lindo.',
        ],
        distractor: 'Buen día, ¿tiene pan fresco recién horneado?',
      },
      {
        lines: [
          'Farmacia San José, buenos días, ¿en qué le puedo ayudar?',
          'Buenos días, quería consultar si tienen para medir la presión arterial.',
          'Sí, señora, tenemos el aparato acá en el mostrador, sin turno ni nada.',
          'Uy, qué bueno. ¿Y a qué hora conviene venir para no esperar mucho?',
          'A la mañana temprano está más tranquilo, antes de las diez.',
          'Perfecto, entonces paso mañana temprano. Muchas gracias, que tenga buen día.',
        ],
        distractor: 'Para el tensiómetro no hace falta, pero para las vacunas sí hay que sacar turno.',
      },
      {
        lines: [
          'Buenas, ¿se enteró que el centro de jubilados hace un asado el domingo?',
          'No, no sabía nada. ¿A qué hora es?',
          'Dicen que arrancan a las doce, en el patio de atrás.',
          'Qué bueno, hace rato que no voy por ahí. ¿Hay que anotarse?',
          'Sí, mejor anotarse antes en la secretaría, así saben cuánta carne comprar.',
          'Yo aviso en el grupo del barrio para que se anote el que quiera ir.',
        ],
        distractor: 'Con permiso, ¿este es el colectivo que va al centro?',
      },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Así se conversa!', '¡Excelente razonamiento!', '¡Muy bien!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo queda la charla ordenada.',
  '¡Casi! Con la práctica te sale cada vez mejor.',
]

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function LaCharlaDesordenada({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const conversation = useMemo(
    () => pickOne(level.conversations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const pool = useMemo(
    () => (conversation.distractor ? [...conversation.lines, conversation.distractor] : conversation.lines),
    [conversation],
  )
  const distractorId = conversation.distractor ? conversation.lines.length : null

  const { bank, placed, place, unplace } = useSequencingPuzzle(pool, `${levelIdx}-${roundKey}`)
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Accumulated across levels 1→2→3 (and across any same-level replay —
  // every submission counts), only zeroed on a true day restart (see
  // nextLevel's wrap branch). Same model as QueSeEsconde.tsx.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  // "Done" isn't just "bank empty" here — if the round has a distractor, the
  // player is also done the moment only the distractor is left un-placed
  // (that's the correct outcome). Deliberately NOT part of the shared hook:
  // this rule only makes sense for conversations with a foreign line.
  const readyToCheck =
    bank.length === 0 || (distractorId !== null && bank.length === 1 && bank[0].id === distractorId)

  const includedDistractor = distractorId !== null && placed.some((item) => item.id === distractorId)
  const placedReal = placed.filter((item) => item.id !== distractorId)
  const isCorrect =
    !includedDistractor &&
    placedReal.length === conversation.lines.length &&
    placedReal.every((item, i) => item.id === i)

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    // Per-word (per-line) mistake count, derived from state the component
    // already has: every placed real line sitting outside its correct slot
    // is a mistake, plus one more if the distractor got placed at all (that
    // alone can make a round wrong even when every real line is in order).
    const lineMistakes = placedReal.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + lineMistakes + (includedDistractor ? 1 : 0))
    setAccAttempts((a) => a + pool.length)
  }
  // Resets happen HERE, synchronously with the level/round change (checked
  // was already reset this way before this retrofit) — keeping it that way
  // means the onComplete-reporting effect below never sees a stale `checked`
  // paired with a fresh `levelIdx` on the same render.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setChecked(false)
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
    setRoundKey((k) => k + 1)
  }

  // Reports the SUM across levels 1→2→3, not just level 3: check() already
  // folded this level's numbers into accMistakes/accAttempts above. Fires
  // once per roundKey so a genuine full-day restart (wrap to level 1, new
  // roundKey) can report again.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (checked && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, levelIdx, roundKey, accMistakes, accAttempts])

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          Razonamiento · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          {conversation.distractor
            ? 'Ordená la charla — ¡una de estas frases no pertenece!'
            : 'Ordená estas frases para armar la charla'}
        </h2>
        <p className="mt-2 text-base text-slate-500">Tocalas en el orden que creas correcto.</p>
      </div>

      {/* Sequence being built */}
      <div className="mt-6 min-h-[64px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
        {placed.length === 0 && (
          <p className="text-center text-sm text-slate-400">Tocá las frases de abajo para empezar</p>
        )}
        <div className="flex flex-col gap-2">
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
                  'flex items-start gap-2 rounded-xl border-2 px-4 py-2.5 text-left text-base transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  isRight ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : '',
                  isWrong ? 'border-slate-300 bg-white text-slate-500' : '',
                  !checked ? 'border-tiam-blue bg-tiam-blue/5 text-slate-900 hover:bg-tiam-blue/10' : '',
                ].join(' ')}
              >
                <span className="mt-0.5 shrink-0 font-bold text-slate-400">{i + 1}.</span>
                <span>{item.value}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bank */}
      {!checked && (
        <div className="mt-4 flex flex-col gap-2">
          {bank.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => place(item)}
              className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-left text-base text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
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
            <div className="mt-3 text-left text-sm text-slate-600">
              <p className="font-semibold text-slate-700">La charla en orden era:</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {conversation.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              {conversation.distractor && (
                <p className="mt-2 text-slate-500">Y esta no pertenecía a la charla: "{conversation.distractor}"</p>
              )}
            </div>
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
              Otra charla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
