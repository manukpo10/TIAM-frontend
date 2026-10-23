import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Formal o informal" — día 26, mes 5, ejecutivas (shown as "Razonamiento"). A language-register game: the same
 * message is said one way to a doctor, a bank or in a letter (formal) and another way to a friend, a neighbour or a
 * grandchild (informal), and the player chooses the one that fits. It replaced "Los departamentos" at the
 * tallerista's request, who sent a school worksheet on "lenguaje formal e informal" as the model.
 *
 * ORIGINAL CONTENT. Only the idea of the worksheet's sections (tell which example is formal, match each situation
 * with its kind of language) is borrowed; every phrase and situation is TIAM's own and is about adult life
 * (the obra social, the bank, a WhatsApp to a grandchild, a chat with the neighbour), in the Argentine voseo, not
 * about school. Nothing is graded on vocabulary the player may not know: the clues are the markers people use every
 * day («quisiera», «le agradezco», «disculpe» against «che», «dale», «mirá vos»), and every answer explains itself.
 *
 * THREE LEVELS, ONE TASK EACH (nine questions in all, three per level, like days 22 and 23), the ramp being how much
 * has to be weighed at once:
 *   1. a phrase: formal or informal? (two big buttons: a yes/no on the register);
 *   2. a situation ("Le escribís una carta a la obra social…"): which of three phrases fits it? (the register of the
 *      situation has to be worked out first, then the phrase that matches it);
 *   3. a phrase in one register: which of three says the SAME in the OTHER register? Of the two wrong options one
 *      says the same but stays in the original register and the other is in the right register but says something
 *      else, so the player has to keep the meaning and change the register at once.
 *
 * Every question has exactly one right option; a wrong tap switches that option off, costs ONE mistake and says why
 * it is not (muted gray, never red); the right tap says why it is, and a short pause shows it before the next
 * question (taps are off meanwhile, which also swallows a double tap on the right option).
 *
 * Three questions per level out of a pool of five or six (so two people can get different ones), picked ONCE at mount
 * (`epoch`): "Repetir" replays exactly the same nine. A pick always mixes the registers (never three formal phrases
 * in a row). The options of levels 2 and 3 are shuffled at mount; level 1 always shows "Formal" then "Informal".
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level
 * ("Empezar", "Siguiente nivel", "Repetir") is ignored, so it never answers a question: the options sit where that
 * button was.
 *
 * totalAttempts = mistakes + every question of the day (TOTAL_QUESTIONS, derived).
 */

// ── data:start ──
type Register = 'formal' | 'informal'

/** Level 1: is this phrase formal or informal? */
interface ClassifyItem {
  text: string
  register: Register
  /** Why it is that register: shown after a tap, right or wrong. */
  why: string
}
/** Level 2: which phrase goes with this situation? */
interface SituationItem {
  situation: string
  /** The register the situation asks for. */
  register: Register
  /** The phrase of that register. */
  right: string
  /** Two phrases of the OTHER register. */
  wrong: [string, string]
  why: string
}
/** Level 3: say the same in the other register. The register asked for is the opposite of `from`. */
interface RewriteItem {
  original: string
  from: Register
  /** Same message, in the other register. */
  right: string
  /** Same message, but still in `from`. */
  sameRegister: string
  /** In the other register, but another message. */
  otherMeaning: string
  why: string
}

const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3']
/** Questions played in every level. */
const QUESTIONS_PER_LEVEL = 3
const TOTAL_QUESTIONS = LEVEL_NAMES.length * QUESTIONS_PER_LEVEL

const CLASSIFY: ClassifyItem[] = [
  {
    text: 'Buenos días, quisiera solicitar un turno con el doctor.',
    register: 'formal',
    why: '«Quisiera solicitar» es una manera cuidada y cortés de pedir algo: es lenguaje formal.',
  },
  {
    text: 'Estimada señora Gómez: le agradezco mucho su atención.',
    register: 'formal',
    why: '«Estimada», «señora» y «le» (usted) muestran respeto, como en una carta: es lenguaje formal.',
  },
  {
    text: 'Disculpe, ¿podría indicarme dónde queda la farmacia?',
    register: 'formal',
    why: '«Disculpe» y «¿podría indicarme?» piden con cortesía a alguien que no conocemos: es lenguaje formal.',
  },
  {
    text: '¡Che, qué alegría verte! ¿Cómo andás?',
    register: 'informal',
    why: '«Che» y «¿cómo andás?» son de charla entre gente de confianza: es lenguaje informal.',
  },
  {
    text: 'Dale, nos vemos a la tarde y tomamos unos mates.',
    register: 'informal',
    why: '«Dale» y «tomamos unos mates» suenan a un plan entre amigos: es lenguaje informal.',
  },
  {
    text: '¡Mirá vos, qué buena noticia! Me alegraste el día.',
    register: 'informal',
    why: '«Mirá vos» es una expresión de todos los días, de charla con alguien cercano: es lenguaje informal.',
  },
]

const SITUATIONS: SituationItem[] = [
  {
    situation: 'Le escribís una carta a la obra social para pedir una autorización.',
    register: 'formal',
    right: 'Me dirijo a ustedes para solicitar la autorización de mi estudio médico.',
    wrong: ['Hola, ¿me das la autorización del estudio? Dale, gracias.', 'Che, necesito el permiso para el estudio, ¿ya lo tenés?'],
    why: 'A una institución se le escribe con respeto: «me dirijo a ustedes» y «solicitar» son formales.',
  },
  {
    situation: 'Charlás con tu vecina en la puerta del edificio.',
    register: 'informal',
    right: '¿Viste qué calor hace hoy, Ana? No se aguanta.',
    wrong: ['Estimada vecina, le comunico que la temperatura es elevada.', 'Buenos días, señora. Quisiera conversar acerca del clima.'],
    why: 'Con una vecina de confianza se charla natural, como se habla todos los días.',
  },
  {
    situation: 'Te presentás a una entrevista de trabajo.',
    register: 'formal',
    right: 'Mucho gusto. Soy Marta Pérez y me interesa el puesto que ofrecen.',
    wrong: ['¡Buenas! Soy la Marta, vengo por el laburo, dale que va.', 'Hola, che, ¿qué tal? Vengo por lo del trabajo.'],
    why: 'En una entrevista se cuida el trato: se saluda con respeto y se explica con claridad.',
  },
  {
    situation: 'Le mandás un mensaje de WhatsApp a tu nieto.',
    register: 'informal',
    right: '¡Hola, mi vida! ¿Venís a almorzar el domingo? Hago ravioles.',
    wrong: ['Estimado nieto: le solicito que confirme su asistencia al almuerzo del domingo.', 'Por la presente lo invito a almorzar el domingo.'],
    why: 'A un nieto se le escribe con cariño y confianza, igual que se le habla.',
  },
  {
    situation: 'Llamás por teléfono al banco para consultar tu cuenta.',
    register: 'formal',
    right: 'Buenas tardes, quisiera consultar el saldo de mi cuenta, por favor.',
    wrong: ['¡Hola! Dale, decime cuánta plata tengo en la cuenta.', 'Che, pasame el saldo que estoy apurada.'],
    why: 'Con el banco se habla con respeto: «buenas tardes», «quisiera» y «por favor».',
  },
]

const REWRITES: RewriteItem[] = [
  {
    original: 'Pasame el número del médico, dale.',
    from: 'informal',
    right: '¿Sería tan amable de facilitarme el número del médico?',
    sameRegister: 'Dame el teléfono del doctor, che.',
    otherMeaning: 'Le agradezco mucho su atención, doctor.',
    why: '«¿Sería tan amable de facilitarme…?» pide lo mismo, pero con cortesía y trato de usted.',
  },
  {
    original: 'Estimado señor Rossi: le informo que mañana no podré asistir.',
    from: 'formal',
    right: 'Rossi, mañana no voy a poder ir, te aviso nomás.',
    sameRegister: 'Señor Rossi, le comunico que mañana no concurriré.',
    otherMeaning: 'Rossi, ¿venís mañana a tomar unos mates?',
    why: 'Dice lo mismo, pero como se habla con alguien de confianza: sin «estimado» ni «le informo».',
  },
  {
    original: 'Che, ¿me prestás la lapicera un ratito?',
    from: 'informal',
    right: 'Disculpe, ¿podría prestarme su lapicera un momento?',
    sameRegister: 'Dale, prestame la lapicera un segundo.',
    otherMeaning: 'Disculpe, ¿a qué hora cierra la oficina?',
    why: '«Disculpe» y «¿podría prestarme…?» piden lo mismo, pero con respeto.',
  },
  {
    original: 'Le ruego me disculpe por la demora.',
    from: 'formal',
    right: 'Perdoname por la demora, che.',
    sameRegister: 'Lamento mucho el retraso y pido disculpas.',
    otherMeaning: 'Dale, te espero en la plaza.',
    why: 'Se pide perdón igual, pero con palabras de todos los días: «perdoname» y «che».',
  },
  {
    original: '¿Podría decirme qué hora es, por favor?',
    from: 'formal',
    right: '¿Me decís qué hora es, che?',
    sameRegister: 'Disculpe, ¿tendría la amabilidad de indicarme la hora?',
    otherMeaning: '¿Viste qué lindo día hace, che?',
    why: 'Pregunta lo mismo, pero hablado: «¿me decís…?» y «che» en lugar de «¿podría decirme…?».',
  },
]
// ── data:end ──

const other = (r: Register): Register => (r === 'formal' ? 'informal' : 'formal')

/** One option the player can tap. */
interface Choice {
  id: string
  label: string
  /** A short line under the label (level 1 only). */
  sub?: string
  right: boolean
  /** What to say when this option is tapped and is wrong. */
  miss: string
}
/** A question as the screen needs it. */
interface QuestionContent {
  /** Small caption above the stem. */
  stemLabel: string
  /** The phrase or situation. */
  stem: string
  /** What the player is asked to do. */
  ask: string
  /** 'pair' = two big side-by-side buttons, 'stack' = full sentences one under another. */
  layout: 'pair' | 'stack'
  choices: Choice[]
  /** Shown when the right option is tapped. */
  why: string
  /** The line of the level's recap card. */
  recap: { title: string; detail: string }
  /** What the pick has to mix (a level never plays three questions with the same value). */
  mix: Register
}

function fromClassify(it: ClassifyItem): QuestionContent {
  const choices: Choice[] = (['formal', 'informal'] as Register[]).map((r) => ({
    id: r,
    label: r === 'formal' ? 'Formal' : 'Informal',
    sub: r === 'formal' ? 'Con respeto y cuidado' : 'Como entre amigos',
    right: r === it.register,
    miss: `Fijate: ${it.why} Probá con la otra.`,
  }))
  return {
    stemLabel: 'Leé esta frase:',
    stem: `«${it.text}»`,
    ask: '¿Esta frase es formal o informal?',
    layout: 'pair',
    choices,
    why: it.why,
    recap: { title: `«${it.text}»`, detail: it.register === 'formal' ? 'Lenguaje formal' : 'Lenguaje informal' },
    mix: it.register,
  }
}

function fromSituation(it: SituationItem): QuestionContent {
  const bad = other(it.register)
  const choices: Choice[] = [
    { id: 'right', label: it.right, right: true, miss: '' },
    ...it.wrong.map((w, i) => ({
      id: `wrong${i}`,
      label: w,
      right: false,
      miss: `Esa frase es ${bad}, y acá hace falta una frase ${it.register}. Probá con otra.`,
    })),
  ]
  return {
    stemLabel: 'Situación:',
    stem: it.situation,
    ask: '¿Qué frase va con esta situación?',
    layout: 'stack',
    choices,
    why: it.why,
    recap: { title: it.situation, detail: it.register === 'formal' ? 'Va con lenguaje formal' : 'Va con lenguaje informal' },
    mix: it.register,
  }
}

function fromRewrite(it: RewriteItem): QuestionContent {
  const target = other(it.from)
  const choices: Choice[] = [
    { id: 'right', label: it.right, right: true, miss: '' },
    { id: 'same', label: it.sameRegister, right: false, miss: `Dice lo mismo, pero sigue siendo ${it.from}. Probá con otra.` },
    { id: 'meaning', label: it.otherMeaning, right: false, miss: `Es ${target}, pero no dice lo mismo que la frase de arriba. Probá con otra.` },
  ]
  return {
    stemLabel: 'Frase original:',
    stem: `«${it.original}»`,
    ask: `Elegí la manera ${target} de decir lo mismo`,
    layout: 'stack',
    choices,
    why: it.why,
    recap: { title: it.right, detail: `Dicho de manera ${target}` },
    mix: target,
  }
}

/** The pool of every level, in level order. */
const POOLS: QuestionContent[][] = [CLASSIFY.map(fromClassify), SITUATIONS.map(fromSituation), REWRITES.map(fromRewrite)]

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

/** QUESTIONS_PER_LEVEL questions of a pool that do not all share the same register. */
function pickMixed(pool: QuestionContent[]): QuestionContent[] {
  for (let i = 0; i < 20; i++) {
    const picked = shuffle(pool).slice(0, QUESTIONS_PER_LEVEL)
    if (new Set(picked.map((q) => q.mix)).size > 1) return picked
  }
  return shuffle(pool).slice(0, QUESTIONS_PER_LEVEL)
}

interface LevelContent {
  questions: QuestionContent[]
}

function buildEpoch(): LevelContent[] {
  return POOLS.map((pool) => ({
    questions: pickMixed(pool).map((q) => (q.layout === 'stack' ? { ...q, choices: shuffle(q.choices) } : q)),
  }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen oído para las palabras!']
/** The pause after the right option, with its reason on screen, before the next question; taps are ignored meanwhile. */
const ADVANCE_MS = 2200
/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel", "Repetir") is the second
 * tap of a double tap, and it must not answer a question: the options sit right where that button was. */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Leé la frase o la situación.',
    'Elegí la respuesta que corresponde. Si no es, se apaga y te explicamos por qué.',
  ]
  // Phrases that are not in the game itself.
  const example = [
    { text: '«Buenas tardes, ¿cómo se encuentra usted?»', label: 'Formal', tone: 'formal' },
    { text: '«¡Hola! ¿Qué hacés?»', label: 'Informal', tone: 'informal' },
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <p className="mt-3 text-center text-base leading-snug text-slate-700">
        <span className="font-bold text-slate-900">Formal</span> es el lenguaje con respeto y cuidado: con el médico, el banco, en
        una carta. <span className="font-bold text-slate-900">Informal</span> es el de todos los días, con la gente de confianza.
      </p>
      <ol className="mt-3 space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 space-y-2 rounded-2xl bg-white p-3">
        <p className="text-center text-base font-semibold text-slate-500">Por ejemplo:</p>
        {example.map((e) => (
          <div key={e.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-base font-semibold leading-snug text-slate-800">{e.text}</span>
            <span className="shrink-0 rounded-full bg-tiam-blue/10 px-2.5 py-1 text-sm font-bold text-tiam-blue">{e.label}</span>
          </div>
        ))}
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
  content: LevelContent
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, content, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const levelName = LEVEL_NAMES[levelIdx]
  const isLast = levelIdx === LEVEL_NAMES.length - 1
  const { questions } = content
  const total = questions.length

  const [qIdx, setQIdx] = useState(0)
  const [wrong, setWrong] = useState<string[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Options already tapped wrong for this question: a double tap on the same option is ONE tap, even when both land
  // before React has repainted it as disabled.
  const tappedRef = useRef<Set<string>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and, when the card is
  // taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const question = questions[qIdx]

  function handleTap(choice: Choice, at: number) {
    // While the right option shows its check (`advancing`) every option is off, which is what swallows a double tap on
    // the RIGHT one; this swallows the one that follows the button that brought the level.
    if (advancing || done || tappedRef.current.has(choice.id) || at - since < SETTLE_MS) return
    tappedRef.current.add(choice.id)
    if (choice.right) {
      setAdvancing(true)
      setHint({ text: `¡Eso es! ${question.why}`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setWrong([])
          setAdvancing(false)
          setHint(null)
          tappedRef.current = new Set()
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    setWrong((w) => [...w, choice.id])
    setHint({ text: choice.miss, ok: false })
    onMistake()
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {levelName}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Pregunta {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The phrase or the situation */}
          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-tiam-blue">{question.stemLabel}</p>
            <p className="mt-1 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{question.stem}</p>
          </div>
          <h2 className="mt-3 text-balance text-center text-lg font-bold leading-snug text-slate-900 sm:text-xl">{question.ask}</h2>

          <div
            className={`mx-auto mt-3 max-w-md ${question.layout === 'pair' ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2.5'}`}
            role="group"
            aria-label="Opciones"
          >
            {question.choices.map((choice) => {
              const isWrong = wrong.includes(choice.id)
              const isRight = advancing && choice.right
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={isWrong || advancing}
                  onClick={(e) => handleTap(choice, e.timeStamp)}
                  className={[
                    'relative flex items-center rounded-2xl border-2 px-3 py-3 transition',
                    question.layout === 'pair'
                      ? 'min-h-[84px] flex-col justify-center text-center'
                      : 'min-h-[64px] justify-start text-left',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRight
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  <span className={question.layout === 'pair' ? 'text-xl font-extrabold' : 'text-lg font-semibold leading-snug'}>
                    {choice.label}
                  </span>
                  {choice.sub && <span className="mt-0.5 text-sm font-medium leading-snug opacity-80">{choice.sub}</span>}
                  {isRight && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mx-auto mt-3 min-h-[4.5rem] max-w-md text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Respondiste las {total} preguntas. ¡Completaste el {levelName.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {questions.map((q) => (
              <li key={q.recap.title} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{q.recap.title}</span>
                  <span className="text-slate-500"> — {q.recap.detail}</span>
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

export function FormalOInformal({ onComplete }: GameProps) {
  // Which questions each level plays and the order of their options — decided once, at mount, so "Repetir" replays
  // exactly the same content.
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
    if (levelIdx !== LEVEL_NAMES.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_QUESTIONS })
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
            {LEVEL_NAMES[0]}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cómo se dice?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
