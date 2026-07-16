import { useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, Pause, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué sonido es?" — second audio-based game in the challenge (after "La
 * canción de tu juventud", día 15) and third agnosias (auditory recognition,
 * not visual this time — see QueSera/QueSeEsconde) game overall. Reemplaza
 * la tarjeta de reflexión original "Sabores de antes" (recuerdos de recetas
 * familiares) por un ejercicio real de escuchar-e-identificar.
 *
 * 6 clips cortos de sonidos domésticos/de cocina (ver SOURCES.md en la
 * carpeta de assets para las licencias — ese archivo no se toca). Cada ronda
 * reproduce un clip y la persona toca cuál de 4 opciones (1 correcta + 3
 * distractoras, elegidas de nuevo cada ronda) describe lo que escuchó.
 *
 * A diferencia de "La canción de tu juventud" — donde la dificultad sube por
 * CANTIDAD DE OPCIONES (3→4→5, siempre con reproducción libre y distractores
 * puramente al azar durante todo el juego) — acá el contenido está fijo en 6
 * sonidos (siempre 4 opciones en los 3 niveles), así que la dificultad sube
 * por un eje distinto: ACCESO A REPRODUCCIÓN + curaduría de distractores:
 *   Nivel 1: reproducción libre (sin límite) + distractores curados para
 *            EVITAR el sonido acústicamente más parecido al objetivo (ver
 *            GROUP_PARTNER: pava/frito son texturas continuas, picar/reloj
 *            son rítmicos/percusivos, puerta/vajilla son los dos sonidos
 *            "distintivos" sueltos sin pareja acústica cercana).
 *   Nivel 2: reproducción libre, pero distractores 100% al azar entre los 5
 *            sonidos restantes — sin curaduría.
 *   Nivel 3: el clip se puede reproducir UNA sola vez por ronda — el botón
 *            se deshabilita apenas arranca esa reproducción y recién se
 *            reactiva al entrar a una ronda nueva.
 *
 * VARIAS rondas por nivel (mismo patrón que LaCancionDeTuJuventud/QueSera):
 * cada nivel identifica `rounds` sonidos objetivo distintos (sin repetir
 * dentro del mismo nivel) elegidos al azar del pool completo de 6 — con sólo
 * 6 sonidos, SE REPITEN entre niveles (mismo criterio que QueSera con sus 20
 * objetos: "pueden repetirse entre niveles", nunca dentro de un mismo
 * nivel). 12 identificaciones en total (3+4+5). Toda ronda se resuelve con
 * un acierto genuino (sin "me rindo"), así que totalAttempts = mistakes +
 * TOTAL_ROUNDS (misma fórmula plana que LaCancionDeTuJuventud/ElVuelto).
 */

interface Sound {
  id: string
  label: string
}
const SOUNDS: Sound[] = [
  { id: 'pava', label: 'Una pava hirviendo' },
  { id: 'frito', label: 'Algo friendo' },
  { id: 'picar', label: 'Picando verduras' },
  { id: 'reloj', label: 'Un reloj' },
  { id: 'puerta', label: 'Una puerta' },
  { id: 'vajilla', label: 'La vajilla' },
]

// Nivel 1 evita emparejar cada sonido con su "pareja" acústicamente más
// parecida (ver comentario de cabecera). Los 3 pares cubren los 6 sonidos
// completos, así que todo target siempre tiene una pareja para excluir.
const GROUP_PARTNER: Record<string, string> = {
  pava: 'frito',
  frito: 'pava',
  picar: 'reloj',
  reloj: 'picar',
  puerta: 'vajilla',
  vajilla: 'puerta',
}

interface Level {
  n: number
  name: string
  rounds: number
  singlePlay: boolean
  curateDecoys: boolean
}
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 3, singlePlay: false, curateDecoys: true },
  { n: 2, name: 'Nivel 2', rounds: 4, singlePlay: false, curateDecoys: false },
  { n: 3, name: 'Nivel 3', rounds: 5, singlePlay: true, curateDecoys: false },
]
// Cada ronda se resuelve con un único acierto (sin "me rindo"), así que
// totalAttempts = mistakes + esta suma.
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

const CLIPS = import.meta.glob('../../../assets/desafio/games/que-sonido-es/*.mp3', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function clipFor(id: string): string | undefined {
  const match = Object.entries(CLIPS).find(([path]) => path.endsWith(`/${id}.mp3`))
  return match?.[1]
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

// 4 opciones siempre (1 correcta + 3 distractoras). Nivel 1 excluye la
// pareja acústica del target antes de elegir; los demás niveles no.
function buildOptions(target: Sound, level: Level): Sound[] {
  let decoyPool = SOUNDS.filter((s) => s.id !== target.id)
  if (level.curateDecoys) {
    const partnerId = GROUP_PARTNER[target.id]
    decoyPool = decoyPool.filter((s) => s.id !== partnerId)
  }
  const decoys = shuffle(decoyPool).slice(0, 3)
  return shuffle([target, ...decoys])
}

const PRAISE = ['¡Muy bien!', '¡Excelente oído!', '¡Así se hace!', '¡Perfecto!']
const ROUND_OK = ['¡Bien!', '¡Ese es!', '¡Exacto!', '¡Muy bien!']

export function QueSonidoEs({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Sonidos objetivo del nivel: tantos distintos como rondas tenga, al azar,
  // recalculados una sola vez por nivel/roundKey (sin repetir dentro del nivel).
  const roundTargets = useMemo(
    () => shuffle(SOUNDS).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const target = roundTargets[roundIdx]
  const done = roundIdx >= level.rounds

  const options = useMemo(() => {
    if (!target) return []
    return buildOptions(target, level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, levelIdx])

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  // Se pone en true la primera vez que se reproduce el clip EN ESTA RONDA.
  // Nivel 3 la usa para deshabilitar el botón tras la primera reproducción;
  // niveles 1-2 sólo la usan para el texto ("escuchar" vs "de nuevo").
  const [hasPlayedRound, setHasPlayedRound] = useState(false)
  const [roundOk, setRoundOk] = useState(ROUND_OK[0])
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Errores acumulados a través de los 3 niveles, reseteados sólo en el
  // wrap real (nextLevel al terminar nivel 3) — nunca en "otra ronda".
  const [mistakes, setMistakes] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => audioRef.current?.pause()
  }, [])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function toggleClip() {
    if (!target) return
    const src = clipFor(target.id)
    if (!src) return
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.onended = () => setIsPlaying(false)
    }
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }
    if (audioRef.current.src !== src) audioRef.current.src = src
    audioRef.current.currentTime = 0
    audioRef.current.play()
    setIsPlaying(true)
    setHasPlayedRound(true)
  }

  function guess(id: string) {
    if (!target || solved || eliminated.has(id)) return
    if (id === target.id) {
      setSolved(true)
      setRoundOk(pickOne(ROUND_OK))
      audioRef.current?.pause()
      setIsPlaying(false)
      // Avanzá a la próxima ronda del nivel tras un breve feedback. Cuando
      // roundIdx llega a level.rounds, `done` pasa a true y se muestra la
      // pantalla de fin de nivel. El reset de `hasPlayedRound` (la bandera
      // de "ya reproducido esta ronda" del nivel 3) va ACÁ, sincrónico con
      // el resto — nunca en un efecto separado sobre [levelIdx, roundKey]
      // (mismo bug ya resuelto en otros juegos de este desafío: un efecto
      // llega un render tarde y puede leer/dejar estado viejo).
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
        setHasPlayedRound(false)
      }, 850)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
    }
  }

  // Reset sincrónico dentro de nextLevel()/replay() — nunca en un efecto
  // separado sobre [levelIdx, roundKey] (mismo bug ya resuelto en otros
  // juegos de este desafío: un efecto llega un render tarde y dispara
  // onComplete con datos viejos, o deja `hasPlayedRound` en true al recién
  // entrar al nivel 3 y el botón nace deshabilitado sin que nadie escuchara
  // nada todavía).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    audioRef.current?.pause()
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setIsPlaying(false)
    setHasPlayedRound(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    audioRef.current?.pause()
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setIsPlaying(false)
    setHasPlayedRound(false)
    // NOT setMistakes(0) — una repetición del mismo nivel no borra lo acumulado.
  }

  // Dispara una vez por roundKey cuando la última ronda del nivel 3 se
  // completa → DesafioPlayPage muestra la pantalla de estrellas encima.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const playDisabled = solved || (level.singlePlay && hasPlayedRound)

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-sm font-medium text-tiam-blue">
              Escuchá el sonido y tocá qué es lo que suena.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-orange transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && target && (
        <>
          {/* Play button */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={toggleClip}
              disabled={playDisabled}
              aria-label={
                isPlaying
                  ? 'Pausar'
                  : level.singlePlay && hasPlayedRound
                    ? 'Ya escuchaste este sonido'
                    : hasPlayedRound
                      ? 'Escuchar de nuevo'
                      : 'Escuchar'
              }
              className={[
                'flex h-24 w-24 items-center justify-center rounded-full bg-tiam-blue text-white shadow-lg transition hover:bg-tiam-blue-dark active:scale-95 disabled:opacity-50',
                isPlaying ? 'animate-pulse' : '',
              ].join(' ')}
            >
              {isPlaying ? <Pause className="h-10 w-10" /> : <Volume2 className="h-10 w-10" />}
            </button>
          </div>
          <p className="mt-3 text-center text-sm text-slate-400">
            {solved
              ? `${roundOk} Era ${target.label.toLowerCase()}.`
              : isPlaying
                ? 'Escuchando…'
                : level.singlePlay && hasPlayedRound
                  ? 'Ya la escuchaste — elegí una opción'
                  : hasPlayedRound
                    ? 'Tocá para escuchar de nuevo'
                    : 'Tocá para escuchar'}
          </p>

          {/* Options */}
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
            {options.map((s) => {
              const isEliminated = eliminated.has(s.id)
              const isCorrect = solved && s.id === target.id
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(s.id)}
                  className={[
                    'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-base font-bold transition focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrect
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            {levelIdx === LEVELS.length - 1 ? (
              <Sparkles className="h-6 w-6 text-tiam-blue" />
            ) : (
              <Volume2 className="h-6 w-6 text-tiam-blue" />
            )}
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Reconociste los {level.rounds} sonidos — completaste el nivel {levelIdx + 1}.
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
