import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Palabra y definición" — vocabulary retrieval. A closed pool of words at
 * the top, a list of definitions below; place each word on the definition it
 * belongs to.
 *
 * The closed pool is the design, not a shortcut. Four independent
 * multiple-choice questions would be "Deducí la palabra" (mes 1, día 15) with
 * new text. Here every word is spent when it is placed, so the last
 * definitions are solvable by elimination — which is a different and gentler
 * curve, and the one the paper sheet actually has.
 *
 * Definitions are written plainly on purpose: dictionary phrasing
 * ("utensilio cóncavo destinado a contener") is itself the obstacle for a lot
 * of readers here, and the exercise is meant to be the word, not the prose.
 */

interface Entry {
  word: string
  definition: string
}
interface WordSet {
  theme: string
  entries: Entry[]
}

const SETS_L1: WordSet[] = [
  {
    theme: 'cosas de la casa',
    entries: [
      { word: 'Anillo', definition: 'Aro que se lleva en un dedo de la mano, como adorno o como símbolo.' },
      { word: 'Espejo', definition: 'Superficie de vidrio que devuelve la imagen de lo que tiene enfrente.' },
      { word: 'Botella', definition: 'Recipiente alto y de cuello angosto, de vidrio o plástico, para líquidos.' },
      { word: 'Colador', definition: 'Utensilio lleno de agujeritos que separa lo sólido de lo líquido.' },
    ],
  },
  {
    theme: 'la cocina',
    entries: [
      { word: 'Sartén', definition: 'Recipiente chato y con mango que se usa para freír.' },
      { word: 'Heladera', definition: 'Mueble que enfría por dentro para conservar los alimentos.' },
      { word: 'Pava', definition: 'Recipiente con pico y asa que se usa para calentar el agua.' },
      { word: 'Cuchara', definition: 'Cubierto con una parte hueca, para tomar la sopa o revolver.' },
    ],
  },
]

const SETS_L2: WordSet[] = [
  {
    theme: 'herramientas',
    entries: [
      { word: 'Martillo', definition: 'Herramienta con una cabeza pesada que sirve para clavar.' },
      { word: 'Serrucho', definition: 'Hoja de metal con dientes que sirve para cortar madera.' },
      { word: 'Pinza', definition: 'Herramienta de dos brazos que sirve para agarrar o apretar.' },
      { word: 'Destornillador', definition: 'Herramienta de punta plana o en cruz, para poner y sacar tornillos.' },
      { word: 'Llave', definition: 'Pieza de metal que abre y cierra una cerradura.' },
    ],
  },
  {
    theme: 'el clima',
    entries: [
      { word: 'Niebla', definition: 'Nube baja y espesa que se apoya en el suelo y no deja ver lejos.' },
      { word: 'Granizo', definition: 'Lluvia que cae hecha bolitas de hielo.' },
      { word: 'Rocío', definition: 'Gotitas de agua que amanecen sobre el pasto y las plantas.' },
      { word: 'Relámpago', definition: 'Luz brusca que cruza el cielo durante una tormenta.' },
      { word: 'Brisa', definition: 'Viento suave y agradable.' },
    ],
  },
]

const SETS_L3: WordSet[] = [
  {
    // Three of these are joints: the definitions only separate once you read
    // WHICH bones each one joins, which is the point of the hardest level.
    theme: 'el cuerpo',
    entries: [
      { word: 'Codo', definition: 'Articulación que une el brazo con el antebrazo.' },
      { word: 'Rodilla', definition: 'Articulación que está en el medio de la pierna.' },
      { word: 'Tobillo', definition: 'Articulación que une la pierna con el pie.' },
      { word: 'Hombro', definition: 'Parte donde el brazo se une al tronco.' },
      { word: 'Talón', definition: 'Parte de atrás del pie, la que apoya primero al caminar.' },
      { word: 'Pantorrilla', definition: 'Parte carnosa de atrás de la pierna, debajo de la rodilla.' },
    ],
  },
  {
    // Five of the six are neighbourhood shops; only the plaza isn't, and the
    // shops separate solely by what they sell.
    theme: 'el barrio',
    entries: [
      { word: 'Farmacia', definition: 'Negocio donde se venden remedios.' },
      { word: 'Panadería', definition: 'Negocio donde se hace y se vende el pan.' },
      { word: 'Ferretería', definition: 'Negocio donde se venden herramientas, clavos y tornillos.' },
      { word: 'Verdulería', definition: 'Negocio donde se venden frutas y verduras.' },
      { word: 'Quiosco', definition: 'Puesto chico donde se venden golosinas, bebidas y cigarrillos.' },
      { word: 'Plaza', definition: 'Espacio abierto del barrio, con bancos y árboles, para pasear.' },
    ],
  },
]

interface Level {
  n: number
  name: string
  sets: WordSet[]
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', sets: SETS_L1 },
  { n: 2, name: 'Nivel 2', sets: SETS_L2 },
  { n: 3, name: 'Nivel 3', sets: SETS_L3 },
]

/**
 * One set per level, every definition resolving with exactly one correct tap.
 * Every set inside a level must therefore hold the same number of entries, or
 * the reported attempt total would depend on which set got drawn — asserted
 * here rather than left as an unwritten rule.
 */
const TOTAL_PLACEMENTS = LEVELS.reduce((sum, l) => {
  const sizes = new Set(l.sets.map((s) => s.entries.length))
  if (sizes.size !== 1) throw new Error(`${l.name}: los sets tienen distinta cantidad de palabras`)
  return sum + l.sets[0].entries.length
}, 0)

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

const PRAISE = ['¡Muy bien!', '¡Excelente vocabulario!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esa no va ahí. Volvé a leer la definición despacio.',
  'No es esa palabra — fijate qué más podría ser.',
  'Casi. Buscá la palabra que describe exactamente eso.',
]

export function PalabraYDefinicion({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Which of each level's two authored sets this "época" plays, picked
  // once at random per level — at mount — never re-rolled, so "Repetir"
  // always brings back the same words and definitions (same content-
  // freezing convention as QuienLoDijo.tsx).
  const [epochSets] = useState(() => LEVELS.map((lvl) => pickOne(lvl.sets)))
  const set = epochSets[levelIdx]
  const pool = useMemo(() => shuffle(set.entries.map((e) => e.word)), [set])
  const prompts = useMemo(() => shuffle(set.entries), [set])

  /** definition word -> the word placed on it */
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [pickedWord, setPickedWord] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  const done = Object.keys(placed).length === set.entries.length

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function tapWord(word: string) {
    if (done || Object.values(placed).includes(word)) return
    setPickedWord((w) => (w === word ? null : word))
    setHint(null)
  }
  function tapPrompt(entry: Entry) {
    if (done || placed[entry.word] || !pickedWord) return
    if (pickedWord === entry.word) {
      setPlaced((p) => ({ ...p, [entry.word]: pickedWord }))
      setPickedWord(null)
      setHint(null)
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    setPickedWord(null)
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` (derived from
  // `placed`) would read the previous level's stale-true value on the very
  // render that arrives at the new level and fire onComplete with garbage.
  // Same reasoning as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPlaced({})
    setPickedWord(null)
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level's set is complete. A genuine
  // full-day restart (the wrap to level 1) gets a new roundKey so it can
  // report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PLACEMENTS })
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
              ¿Qué palabra es cada definición?
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Todas son de <span className="font-bold text-tiam-blue">{set.theme}</span>. Tocá una
              palabra y después su definición.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {Object.keys(placed).length} de {set.entries.length}
            </p>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* The closed pool */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {pool.map((word) => {
              const spent = Object.values(placed).includes(word)
              const isPicked = pickedWord === word
              return (
                <button
                  key={word}
                  type="button"
                  disabled={spent}
                  onClick={() => tapWord(word)}
                  aria-pressed={isPicked}
                  className={[
                    'min-h-[44px] rounded-xl border-2 px-3 py-2 text-base font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    spent ? 'border-slate-200 bg-slate-50 text-slate-300' : '',
                    isPicked ? 'border-tiam-blue bg-tiam-blue/5 text-tiam-blue-dark ring-2 ring-tiam-blue/30' : '',
                    !spent && !isPicked
                      ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {word}
                </button>
              )
            })}
          </div>

          {/* The definitions */}
          <div className="mt-5 flex flex-col gap-2.5">
            {prompts.map((entry) => {
              const answered = placed[entry.word]
              return (
                <button
                  key={entry.word}
                  type="button"
                  disabled={!!answered || !pickedWord}
                  onClick={() => tapPrompt(entry)}
                  className={[
                    'rounded-2xl border-2 px-4 py-3 text-left text-base leading-snug transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    answered ? 'border-tiam-green bg-tiam-green/5' : '',
                    !answered && pickedWord
                      ? 'border-tiam-blue/40 bg-white text-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                    !answered && !pickedWord ? 'border-slate-200 bg-white text-slate-600' : '',
                  ].join(' ')}
                >
                  {answered && (
                    <span className="mb-1 flex items-center gap-1.5 text-base font-bold text-tiam-green">
                      <Check className="h-4 w-4" strokeWidth={3} />
                      {answered}
                    </span>
                  )}
                  <span className={answered ? 'text-slate-500' : ''}>{entry.definition}</span>
                </button>
              )
            })}
          </div>

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
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
            Ubicaste las {set.entries.length} palabras — ¡completaste el {level.name.toLowerCase()}!
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
