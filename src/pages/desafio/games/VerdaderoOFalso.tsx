import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Verdadero o falso?" — a binary statement-judgment game, first of its
 * kind in the app: two big stacked buttons, no tile grid anywhere.
 *
 * Structurally different from every other multi-choice game on purpose.
 * CadaCosaEnSuGrupo/QueObjetoEs/QueSera all handle a wrong tap by
 * eliminating that one option and letting the player try again among what's
 * left — that only works with 3+ options. With exactly two options,
 * eliminating one on a miss would hand the second tap for free, so this
 * resolves fully on the FIRST tap, right or wrong — the one deliberate
 * departure from the "keep trying" pattern used elsewhere.
 *
 * The correct button always gets the check-badge treatment, whether or not
 * the player tapped it; a wrong tap just mutes that button (never red). The
 * explanation shows every time, correct or not, so a miss reads as "here's
 * what I learned," never as a distinct penalty tier.
 */

interface Statement {
  id: string
  text: string
  answer: boolean
  explanation: string
}
interface Level {
  n: number
  name: string
  hint?: string
  statements: Statement[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    statements: [
      { id: 'l1-sol-este', text: 'El sol sale por el este.', answer: true, explanation: 'Así es: el sol siempre sale por el este y se pone por el oeste.' },
      { id: 'l1-anio-meses', text: 'Un año tiene 10 meses.', answer: false, explanation: 'Un año tiene 12 meses, no 10.' },
      { id: 'l1-hielo', text: 'El hielo es agua congelada.', answer: true, explanation: 'Exacto: cuando el agua se enfría mucho, se convierte en hielo.' },
      { id: 'l1-peces', text: 'Los peces pueden respirar fuera del agua sin problema.', answer: false, explanation: 'Los peces respiran por branquias y necesitan agua; fuera de ella no pueden respirar.' },
      { id: 'l1-navidad', text: 'La Navidad se festeja el 25 de diciembre.', answer: true, explanation: 'Sí, el 25 de diciembre es Navidad.' },
      { id: 'l1-triangulo', text: 'Un triángulo tiene cuatro lados.', answer: false, explanation: 'Un triángulo tiene tres lados; el que tiene cuatro es el cuadrado o el rectángulo.' },
      { id: 'l1-cafe-leche', text: 'El café con leche es una bebida caliente típica del desayuno.', answer: true, explanation: 'Sí, es una de las bebidas más elegidas para desayunar en Argentina.' },
      { id: 'l1-semana', text: 'Una semana tiene ocho días.', answer: false, explanation: 'Una semana tiene siete días: de lunes a domingo.' },
      { id: 'l1-fuego', text: 'El fuego quema.', answer: true, explanation: 'Correcto, por eso hay que tener cuidado al acercarse al fuego.' },
      { id: 'l1-elefante', text: 'Los elefantes son animales muy pequeños, más chicos que un gato.', answer: false, explanation: 'Al revés: el elefante es uno de los animales terrestres más grandes que existen.' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    hint: 'Estas frases piden pensarlas un poco más.',
    statements: [
      { id: 'l2-suma-12', text: '7 + 5 = 12.', answer: true, explanation: 'Correcto: 7 más 5 son 12.' },
      { id: 'l2-suma-14', text: '8 + 5 = 14.', answer: false, explanation: '8 más 5 son 13, no 14.' },
      { id: 'l2-plumas-plomo', text: 'Un kilo de plumas pesa lo mismo que un kilo de plomo.', answer: true, explanation: 'Los dos pesan exactamente un kilo; lo que cambia es el tamaño, no el peso.' },
      { id: 'l2-lunes-miercoles', text: 'Si hoy es lunes, mañana es miércoles.', answer: false, explanation: 'Si hoy es lunes, mañana es martes.' },
      { id: 'l2-media-docena', text: 'Media docena son seis unidades.', answer: true, explanation: 'Así es: una docena son doce, y la mitad, seis.' },
      { id: 'l2-litro-taza', text: 'Un litro de agua entra completo en una taza chica de café.', answer: false, explanation: 'Un litro es mucho más de lo que entra en una taza chica; hace falta un recipiente bastante más grande.' },
      { id: 'l2-multiplicacion', text: '3 × 4 = 12.', answer: true, explanation: 'Correcto: 3 multiplicado por 4 son 12.' },
      { id: 'l2-diciembre-invierno', text: 'En diciembre, en Argentina, es invierno.', answer: false, explanation: 'Al revés: en Argentina diciembre es un mes de verano, no de invierno.' },
      { id: 'l2-vuelto', text: 'Si algo cuesta 100 pesos y pagás con 200, te dan 100 de vuelto.', answer: true, explanation: 'Correcto: si pagás 200 por algo de 100, te dan 100 de vuelto.' },
      { id: 'l2-dos-docenas', text: 'Dos docenas son 20 unidades.', answer: false, explanation: 'Dos docenas son 24, no 20 (una docena son 12).' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    hint: '¡Atención! Algunas frases se parecen mucho a la verdad, pero tienen un detalle cambiado.',
    statements: [
      { id: 'l3-provincias', text: 'Argentina tiene 23 provincias.', answer: true, explanation: 'Correcto: son 23 provincias, más la Ciudad Autónoma de Buenos Aires, que no es una provincia.' },
      { id: 'l3-pajaros-vuelan', text: 'Todos los pájaros pueden volar.', answer: false, explanation: 'No todos: hay aves que no vuelan, como el ñandú o el pingüino.' },
      { id: 'l3-aconcagua', text: 'El Aconcagua, en Mendoza, es la montaña más alta de toda América.', answer: true, explanation: 'Así es, con casi 7.000 metros de altura es la cumbre más alta de todo el continente.' },
      { id: 'l3-refran-camaron', text: 'El refrán dice "Camarón que se duerme, se lo lleva el viento".', answer: false, explanation: 'La palabra correcta es "corriente", no "viento": camarón que se duerme, se lo lleva la corriente.' },
      { id: 'l3-agua-hierve', text: 'El agua hierve a 100 grados al nivel del mar.', answer: true, explanation: 'Correcto: al nivel del mar, el agua hierve justo a 100 grados.' },
      { id: 'l3-corazon', text: 'El corazón humano tiene tres cavidades.', answer: false, explanation: 'El corazón tiene cuatro cavidades —dos aurículas y dos ventrículos—, no tres.' },
      { id: 'l3-refran-tarde', text: 'El refrán dice "Más vale tarde que nunca".', answer: true, explanation: 'Así es, ese es el refrán completo y correcto.' },
      { id: 'l3-tierra-sol', text: 'La Tierra tarda un mes en dar una vuelta completa alrededor del Sol.', answer: false, explanation: 'La Tierra tarda un año, no un mes, en dar la vuelta completa alrededor del Sol.' },
      { id: 'l3-luna-mes', text: 'La Luna tarda aproximadamente un mes en dar la vuelta completa a la Tierra.', answer: true, explanation: 'Correcto: la Luna completa su órbita alrededor de la Tierra en unos 27 a 29 días, es decir, cerca de un mes.' },
      { id: 'l3-kilometro', text: 'Un kilómetro tiene 100 metros.', answer: false, explanation: 'Un kilómetro tiene 1.000 metros, no 100: "kilo" significa mil.' },
      { id: 'l3-huesos', text: 'El cuerpo humano adulto tiene 300 huesos.', answer: false, explanation: 'El cuerpo humano adulto tiene 206 huesos; de bebés tenemos más, pero se van fusionando con el crecimiento.' },
      { id: 'l3-rio-de-la-plata', text: 'El Río de la Plata es el río más ancho del mundo.', answer: true, explanation: 'Así es: aunque no lo parezca por su nombre, el Río de la Plata es considerado el río más ancho del planeta.' },
    ],
  },
]

// Total question count across all 3 levels — every statement resolves on a
// single tap (no retry, see file header), so this doubles as totalAttempts.
const TOTAL_ROUNDS = LEVELS.reduce((sum, lvl) => sum + lvl.statements.length, 0)

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

const ITEM_PRAISE = ['¡Correcto!', '¡Muy bien!', '¡Exacto!', '¡Así es!', '¡Perfecto!']
const WRONG_LEADIN = ['¡Buen intento!', 'Casi.', '¡Vamos bien!', 'No exactamente.']
const LEVEL_PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen razonamiento!']
const LEVEL_PRAISE_OK = [
  '¡Buen intento! Con cada ronda vas a acertar más.',
  '¡Bien ahí! Seguí practicando.',
]

export function VerdaderoOFalso({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.statements),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState<boolean | null>(null)
  const [feedbackLine, setFeedbackLine] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  // Wrong-answer count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  const current = order[currentIndex]
  const done = currentIndex >= order.length
  const wasWrong = userAnswer !== null && userAnswer !== current?.answer

  function handleAnswer(value: boolean) {
    if (userAnswer !== null || !current) return
    setUserAnswer(value)
    if (value === current.answer) {
      setCorrectCount((c) => c + 1)
      setFeedbackLine(pickOne(ITEM_PRAISE))
    } else {
      setMistakes((m) => m + 1)
      setFeedbackLine(`${pickOne(WRONG_LEADIN)} En realidad, era ${current.answer ? 'verdadero' : 'falso'}.`)
    }
  }

  function handleNext() {
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    setUserAnswer(null)
    if (nextIndex >= order.length) {
      const ratio = order.length ? correctCount / order.length : 0
      setLevelPraise(pickOne(ratio >= 0.6 ? LEVEL_PRAISE_GOOD : LEVEL_PRAISE_OK))
    }
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see ElVuelto.tsx for
  // why: an effect-based reset lags one render behind, letting `done` read
  // stale-true right as levelIdx reaches the last level and firing
  // onComplete with garbage data.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setUserAnswer(null)
    setCorrectCount(0)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra ronda" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setUserAnswer(null)
    setCorrectCount(0)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when level 3's last statement is answered. A full
  // day restart (the wrap to level 1) gets a new roundKey, so a genuine
  // replay reports again; re-rendering while already done on level 3 does
  // not fire twice. No retry in this game (see file header), so
  // totalAttempts is just the fixed question count, not mistakes + it.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  function btnClass(thisIsCorrect: boolean, color: 'green' | 'blue') {
    const base =
      'relative flex min-h-[96px] sm:min-h-[112px] w-full items-center justify-center rounded-3xl text-2xl sm:text-3xl font-extrabold text-white transition'
    const fill = color === 'green' ? 'bg-tiam-green' : 'bg-tiam-blue'
    if (userAnswer === null) {
      return `${base} ${fill} hover:brightness-110 active:scale-95`
    }
    const userTappedThis = (color === 'green') === userAnswer
    if (userTappedThis && wasWrong) {
      return `${base} ${fill} opacity-40`
    }
    if (thisIsCorrect) {
      return `${base} ${fill} scale-[1.02] shadow-lg`
    }
    return `${base} ${fill}`
  }

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
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Verdadero o falso?</h2>
            {level.hint && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(currentIndex / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && current && (
        <>
          {/* Statement */}
          <div className="mt-6 flex min-h-[120px] items-center justify-center rounded-3xl border-2 border-slate-100 bg-slate-50 p-6 text-center sm:p-8">
            <p className="text-xl font-bold leading-relaxed text-slate-800 sm:text-2xl">{current.text}</p>
          </div>

          {/* The two buttons */}
          <div className="mt-6 flex flex-col gap-4">
            <button
              type="button"
              disabled={userAnswer !== null}
              onClick={() => handleAnswer(true)}
              className={btnClass(current.answer === true, 'green')}
            >
              Verdadero
              {userAnswer !== null && current.answer === true && (
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow">
                  <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                </span>
              )}
            </button>
            <button
              type="button"
              disabled={userAnswer !== null}
              onClick={() => handleAnswer(false)}
              className={btnClass(current.answer === false, 'blue')}
            >
              Falso
              {userAnswer !== null && current.answer === false && (
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow">
                  <Check className="h-4 w-4 text-tiam-blue" strokeWidth={3} />
                </span>
              )}
            </button>
          </div>

          {/* Feedback */}
          {userAnswer !== null && (
            <div
              className={[
                'mt-6 rounded-3xl border p-6 text-center',
                wasWrong ? 'border-tiam-blue/20 bg-tiam-blue/5' : 'border-tiam-green/20 bg-tiam-green/5',
              ].join(' ')}
            >
              <div
                className={[
                  'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
                  wasWrong ? 'bg-tiam-blue/15' : 'bg-tiam-green/15',
                ].join(' ')}
              >
                {wasWrong ? (
                  <Lightbulb className="h-6 w-6 text-tiam-blue" />
                ) : (
                  <Sparkles className="h-6 w-6 text-tiam-green" />
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{feedbackLine}</p>
              <p className="mt-2 text-slate-600">{current.explanation}</p>
              <button
                type="button"
                onClick={handleNext}
                className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Acertaste {correctCount} de {order.length} — completaste el {level.name.toLowerCase()}.
          </p>
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
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
