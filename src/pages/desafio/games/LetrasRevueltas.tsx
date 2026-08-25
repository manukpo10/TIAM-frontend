import { useEffect, useRef, useState } from 'react'
import { Shuffle, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'
import { useSequencingPuzzle } from './useSequencingPuzzle'

/**
 * "Letras revueltas" — día 17, Mes 2, lenguaje. Reemplaza a EsEstaSombra.tsx:
 * el usuario lo encontró demasiado fácil.
 *
 * Área cambiada de agnosias (el día 17 original, "Es esta sombra", un juego
 * de reconocimiento visual) a lenguaje: armar palabras es manipulación
 * verbal, no reconocimiento perceptivo — dejarlo en agnosias hubiera sido
 * categorizarlo mal.
 *
 * DISTINTO A PROPÓSITO de "Las mismas letras" (día 25, Mes 1, ejecutivas),
 * el otro juego de anagramas del catálogo — el usuario pidió explícitamente
 * diferenciarlos más allá de "uno arma y el otro empareja":
 *   - Las mismas letras: reconocimiento PASIVO puro. Dos listas de
 *     palabras ya completas; sólo hay que COMPARAR letras entre ellas, sin
 *     ninguna pista ni saber el significado de nada.
 *   - Letras revueltas: acá cada ronda es una ADIVINANZA con pista
 *     ("¿Cuál es la capital de Italia?") — primero hay que EVOCAR la
 *     palabra correcta a partir de un dato, y RECIÉN DESPUÉS construirla
 *     letra por letra. Es una tarea doble (recuperar una palabra por
 *     significado + reconstruirla por ortografía) que Las mismas letras no
 *     pide en absoluto.
 *   - Ningún par de palabras se repite entre los dos archivos (se comparó
 *     la lista completa antes de escribir el pool de acá).
 *
 * Reutiliza useSequencingPuzzle (el mismo motor de tocar-en-orden de
 * ElPasoAPaso/ArmaLaEscena/CopiaElPatron): acá el "pool" pasado al hook es
 * la palabra RESPUESTA separada en letras — el banco que arma el hook,
 * barajando esas letras, ES literalmente el banco de fichas revueltas. La
 * clave que se le pasa (`${levelIdx}-${roundKey}-${roundIdx}`) tiene que
 * cambiar en CADA ronda, no sólo en cada reinicio de día — el hook sólo
 * vuelve a barajar cuando esa clave cambia, y cada ronda usa una palabra
 * distinta (mismo patrón exacto que ArmaLaEscena.tsx).
 *
 * Pool armado y verificado a mano con un script descartable que compara
 * las letras ordenadas de las dos palabras de cada par (mismo criterio que
 * Coordenadas/DondeEsta/LaPiramide). Ningún par usa una palabra con letra
 * repetida a propósito: con useSequencingPuzzle el orden correcto se
 * rastrea por POSICIÓN original, no por valor, así que dos fichas
 * idénticas (dos "A", por ejemplo) serían visualmente indistinguibles
 * pero sólo una de las dos contaría como la correcta en cada paso — mejor
 * evitar esa ambigüedad de entrada que confundir al jugador con una ficha
 * "mal puesta" que en realidad decía la letra correcta.
 *
 * Dificultad sube por longitud de palabra (4 → 5 → 6 letras), no por
 * cantidad de rondas (2 por nivel, mismo patrón uniforme del resto del
 * catálogo). Sólo "Repetir" al final — sin "Hacer otro", como el resto
 * del catálogo.
 */

interface WordRiddle {
  source: string
  target: string
  clue: string
}

const L1_PAIRS: WordRiddle[] = [
  { source: 'AMOR', target: 'ROMA', clue: '¿Cuál es la capital de Italia?' },
  { source: 'LOSA', target: 'SOLA', clue: '¿Cómo se dice estar sin compañía?' },
  { source: 'ARCO', target: 'CARO', clue: '¿Cómo se dice algo que cuesta mucho?' },
  { source: 'PASO', target: 'SOPA', clue: '¿Qué comida es líquida y caliente?' },
  { source: 'TOPE', target: 'POTE', clue: '¿Cómo se llama un recipiente para guardar cosas?' },
]
const L2_PAIRS: WordRiddle[] = [
  { source: 'AIRES', target: 'ARIES', clue: '¿Cuál es un signo del zodíaco?' },
  { source: 'CIELO', target: 'LICEO', clue: '¿Cómo se llama un tipo de escuela secundaria?' },
  { source: 'CALOR', target: 'CORAL', clue: '¿Qué animal marino forma arrecifes?' },
  { source: 'PRESA', target: 'PARES', clue: '¿Cómo se le dice a lo contrario de impares?' },
  { source: 'TRAPO', target: 'PARTO', clue: '¿Cómo se llama el momento en que nace un bebé?' },
]
const L3_PAIRS: WordRiddle[] = [
  { source: 'CRANEO', target: 'CORNEA', clue: '¿Cómo se llama la parte transparente del ojo?' },
  { source: 'CASTOR', target: 'CASTRO', clue: '¿Cómo se llama un poblado antiguo fortificado?' },
  { source: 'TALCOS', target: 'COSTAL', clue: '¿Cómo se llama una bolsa grande de tela áspera?' },
]

interface Level {
  n: number
  name: string
  rounds: number
  pool: WordRiddle[]
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, pool: L1_PAIRS },
  { n: 2, name: 'Nivel 2', rounds: 2, pool: L2_PAIRS },
  { n: 3, name: 'Nivel 3', rounds: 2, pool: L3_PAIRS },
]

const PRAISE_GOOD = ['¡Exacto!', '¡Muy bien armada!', '¡Perfecto!', '¡Así se hace!']
const PRAISE_OK = ['¡Buen intento! Mirá cómo se armaba.', '¡Casi! Con la práctica te sale cada vez mejor.']

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

export function LetrasRevueltas({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)

  // `rounds` adivinanzas distintas por nivel para ESTA "epoch" — elegidas
  // una sola vez al montar, nunca vueltas a tirar por "Repetir" ni por
  // re-visitar un nivel a mitad de epoch.
  const [epochOrder] = useState(() => LEVELS.map((lvl) => shuffle(lvl.pool).slice(0, lvl.rounds)))
  const level = LEVELS[levelIdx]
  const order = epochOrder[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const riddle = order[roundIdx]

  const { bank, placed, place, unplace } = useSequencingPuzzle(
    riddle.target.split(''),
    `${levelIdx}-${roundKey}-${roundIdx}`,
  )
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const isCorrect = bank.length === 0 && placed.every((item, i) => item.id === i)
  const readyToCheck = bank.length === 0
  const done = checked && roundIdx >= level.rounds - 1

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    const stepMistakes = placed.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + stepMistakes)
    setAccAttempts((a) => a + riddle.target.length)
  }
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }
  function advanceLevel() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
  }
  function restartEpoch() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  function restartSame() {
    restartEpoch()
  }

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
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Letras revueltas</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que el resto del catálogo. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Shuffle className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a ver una palabra y una pista. Con esas mismas letras, en otro orden, se arma la respuesta a la
            pista. Tocá las letras del banco, en el orden correcto, para armarla.
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

      {phase === 'playing' && !done && !checked && (
        <>
          {/* Palabra origen + pista */}
          <div className="mt-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Palabra</p>
            <p className="mt-1 text-3xl font-black tracking-wide text-slate-900">{riddle.source}</p>
            <p className="mt-2 text-base text-slate-600">
              Pista: <span className="font-semibold text-slate-800">{riddle.clue}</span>
            </p>
          </div>

          {/* Tira que se arma con las letras tocadas, en orden */}
          <div className="mx-auto mt-4 flex flex-wrap justify-center gap-1.5">
            {riddle.target.split('').map((_, i) => {
              const item = placed[i]
              if (!item) {
                return (
                  <div
                    key={i}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50"
                  />
                )
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => unplace(item)}
                  aria-label={`Quitar letra ${item.value}`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-tiam-green bg-tiam-green/5 text-xl font-extrabold text-tiam-green transition hover:-translate-y-0.5"
                >
                  {item.value}
                </button>
              )
            })}
          </div>

          {/* Banco de letras */}
          <div className="mx-auto mt-5 flex max-w-xs flex-wrap justify-center gap-2">
            {bank.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => place(item)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-xl font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
              >
                {item.value}
              </button>
            ))}
          </div>

          {readyToCheck && (
            <div className="mt-5 text-center">
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

      {/* Resultado */}
      {checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <p className="mt-2 text-base text-slate-600">
              La palabra era: <span className="font-bold text-slate-900">{riddle.target}</span>
            </p>
          )}
          {!done ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente palabra
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
