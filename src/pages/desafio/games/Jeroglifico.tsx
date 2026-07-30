import { useEffect, useMemo, useRef, useState } from 'react'
import { Anchor, Bell, Diamond, Egg, Star, Moon, Feather, Cloud, Turtle, Umbrella, Cake, Gift, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Jeroglífico" — día 7 (mes 2), lenguaje. Una clave fija ícono→letra queda
 * siempre visible; abajo, una secuencia de íconos codifica una frase corta.
 * Para cada ícono el jugador elige la letra correcta entre 4 opciones (nunca
 * un teclado completo — así lo pide el brief) hasta descifrar toda la frase.
 *
 * Motor calcado de "Clave de símbolos" (ClaveDeSimbolos.tsx, día 4 del mes 1
 * — el mismo paradigma de sustitución-por-clave, tipo WAIS Digit-Symbol): la
 * clave arriba siempre visible, la fila a decodificar debajo mostrando el
 * ícono (arriba) y la letra ya resuelta (abajo, vacío hasta acertar). Única
 * diferencia estructural: en vez de un teclado numérico completo (todas las
 * opciones de la clave), acá cada posición ofrece sólo 4 letras (la correcta
 * + 3 señuelos de la MISMA clave, para que un señuelo nunca sea una letra
 * imposible de encontrar en la clave visible).
 *
 * Sin ronda interna: cada nivel ES una frase (mismo achatamiento que
 * LasMismasLetras.tsx — "ONE board per level, no inner round-index layer"),
 * porque una frase de hasta 13 letras ya son 13 toques de por sí.
 *
 * La clave (12 letras: A,B,D,E,I,M,N,O,T,U,V,Y → Anchor,Bell,Diamond,Egg,
 * Star,Moon,Feather,Cloud,Turtle,Umbrella,Cake,Gift) es fija y arbitraria —
 * igual que en Clave de símbolos un círculo no "significa" 1, acá un ancla no
 * significa A; son sólo 12 formas bien distinguibles entre sí. Las 3 frases
 * fueron elegidas para reusar EXACTAMENTE esas 12 letras entre sí (nivel 3 no
 * agrega ninguna letra nueva a la clave, sólo combina las de los niveles
 * anteriores en una frase más larga) y para tener un arco cálido y afín al
 * tono de la app: "MUY BIEN" → "TODO VA BIEN" → "TODO VA MUY BIEN".
 */

interface Level {
  n: number
  name: string
  words: string[]
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', words: ['MUY', 'BIEN'] },
  { n: 2, name: 'Nivel 2', words: ['TODO', 'VA', 'BIEN'] },
  { n: 3, name: 'Nivel 3', words: ['TODO', 'VA', 'MUY', 'BIEN'] },
]

// Total de letras a través de los 3 niveles — cada posición se resuelve tras
// el toque correcto (no hay forma de "rendirse"), así que totalAttempts =
// mistakes + esta constante.
const TOTAL_LETTERS = LEVELS.reduce((sum, lvl) => sum + lvl.words.join('').length, 0)

// Clave fija — cubre exactamente las letras usadas por las 3 frases de
// arriba (A,B,D,E,I,M,N,O,T,U,V,Y). Orden alfabético para que la clave sea
// fácil de recorrer con la vista.
const LEGEND: { letter: string; Icon: LucideIcon }[] = [
  { letter: 'A', Icon: Anchor },
  { letter: 'B', Icon: Bell },
  { letter: 'D', Icon: Diamond },
  { letter: 'E', Icon: Egg },
  { letter: 'I', Icon: Star },
  { letter: 'M', Icon: Moon },
  { letter: 'N', Icon: Feather },
  { letter: 'O', Icon: Cloud },
  { letter: 'T', Icon: Turtle },
  { letter: 'U', Icon: Umbrella },
  { letter: 'V', Icon: Cake },
  { letter: 'Y', Icon: Gift },
]
const LEGEND_LETTERS = LEGEND.map((l) => l.letter)
function iconFor(letter: string): LucideIcon {
  return (LEGEND.find((l) => l.letter === letter) ?? LEGEND[0]).Icon
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

const HINTS = [
  'Esa no. Fijate en la clave qué letra le toca a esa figura.',
  'Casi. Buscá la figura arriba, en la clave.',
  'No es esa letra. Mirá la clave de nuevo y probá otra opción.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo!']

export function Jeroglifico({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const sequence = useMemo(() => level.words.join(''), [level])

  const [posIdx, setPosIdx] = useState(0)
  // Espejo en ref de `posIdx`, leído dentro de handleLetter en vez del valor
  // de clausura: dos toques en el mismo batch de React (un doble-toque de un
  // adulto mayor es un riesgo real) leerían ambos la posición VIEJA si sólo
  // dependieran del estado — la lección de ClaveDeSimbolos.tsx.
  const posIdxRef = useRef(0)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Acumulado a través de los niveles 1→2→3, sólo se pone en cero en un
  // reinicio real del día (ver la rama isWrap de nextLevel).
  const [mistakes, setMistakes] = useState(0)

  const done = posIdx >= sequence.length

  // 4 opciones para la posición actual: la letra correcta + 3 señuelos de la
  // misma clave (nunca una letra ajena a la clave visible).
  const options = useMemo(() => {
    if (done) return []
    const correct = sequence[posIdx]
    const decoyPool = LEGEND_LETTERS.filter((l) => l !== correct)
    return shuffle([correct, ...shuffle(decoyPool).slice(0, 3)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIdx, roundKey, posIdx])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function handleLetter(letter: string) {
    if (done) return
    const pos = posIdxRef.current
    if (pos >= sequence.length) return
    if (letter === sequence[pos]) {
      setHint(null)
      const next = pos + 1
      posIdxRef.current = next
      setPosIdx(next)
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
  }

  // Resets sincrónicos acá mismo — nunca en un efecto separado keyed on
  // [levelIdx, roundKey], que llegaría un render tarde y dejaría el
  // onComplete de abajo leyendo `done` viejo justo al llegar al nivel 3
  // (misma disciplina que ClaveDeSimbolos/LasMismasLetras).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    posIdxRef.current = 0
    setPosIdx(0)
    setHint(null)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    posIdxRef.current = 0
    setPosIdx(0)
    setHint(null)
  }

  // Dispara una vez por roundKey cuando se descifra la última letra del
  // nivel 3. Un reinicio completo del día (wrap a nivel 1) trae un roundKey
  // nuevo, así que una repetición genuina vuelve a reportar.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_LETTERS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-sm font-medium text-tiam-blue">
              Para cada figura, tocá la letra que le corresponde según la clave.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Letra {posIdx} de {sequence.length}
            </p>
          </>
        )}
      </div>

      {!done && (
        <>
          {/* Clave (siempre visible) */}
          <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-400">La clave</p>
            <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-2">
              {LEGEND.map(({ letter, Icon }) => (
                <div key={letter} className="flex flex-col items-center">
                  <Icon className="h-6 w-6 text-slate-700" />
                  <span className="mt-0.5 text-sm font-extrabold text-slate-700">{letter}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Frase a decodificar, agrupada por palabra */}
          <div className="mt-4 flex flex-wrap items-start justify-center gap-3">
            {level.words.map((word, wi) => {
              const wordStart = level.words.slice(0, wi).join('').length
              return (
                <div key={wi} className="flex gap-1.5">
                  {word.split('').map((_, ci) => {
                    const globalIdx = wordStart + ci
                    const isSolved = globalIdx < posIdx
                    const isCurrent = globalIdx === posIdx
                    const letter = sequence[globalIdx]
                    const Icon = iconFor(letter)
                    return (
                      <div key={ci} className="flex flex-col items-center">
                        <div
                          className={[
                            'flex h-11 w-11 items-center justify-center rounded-lg border-2 transition',
                            isCurrent
                              ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
                              : 'border-slate-200 bg-white',
                          ].join(' ')}
                        >
                          <Icon className="h-6 w-6 text-slate-700" />
                        </div>
                        <div className="mt-1 flex h-7 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-base font-extrabold text-tiam-green">
                          {isSolved ? letter : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Opciones de letra (multiple choice, nunca un teclado completo) */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            {options.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => handleLetter(letter)}
                aria-label={`Letra ${letter}`}
                className="flex h-14 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-2xl font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
              >
                {letter}
              </button>
            ))}
          </div>

          {hint && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Descifraste: <span className="font-semibold uppercase text-slate-800">{level.words.join(' ')}</span>
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
              Otra frase
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
