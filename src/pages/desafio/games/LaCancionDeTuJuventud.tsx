import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, ArrowRight, Music, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La canción de tu juventud" — first audio-based game in the challenge.
 * Escuchás un fragmento instrumental corto y tocás a qué género se parece
 * más. Reemplaza el pedido original de escribir una estrofa de memoria — acá
 * el estímulo evocador es el género/época en sí, no una canción puntual que
 * dejaría afuera a cualquiera cuya música no sea esa.
 *
 * Los 5 clips son fragmentos de ~15s de pistas instrumentales de Pixabay
 * (Pixabay Content License: uso comercial permitido, sin atribución
 * obligatoria; embeberlos como estímulo de juego no es "reventa standalone").
 * Recortados con PyAV a 96kbps para peso liviano en mobile.
 *
 * VARIAS rondas por nivel (patrón de "Los opuestos"): cada nivel identifica
 * `rounds` géneros distintos (sin repetir dentro del mismo nivel), y la
 * dificultad sube por cantidad de opciones (3→4→5). En Nivel 3 con 5 opciones
 * se muestran los 5 géneros — el más difícil. 12 identificaciones en total.
 */

interface Genre {
  id: string
  label: string
}
const GENRES: Genre[] = [
  { id: 'tango', label: 'Tango' },
  { id: 'folclore', label: 'Folclore' },
  { id: 'rock_nacional', label: 'Rock nacional' },
  { id: 'cumbia', label: 'Cumbia' },
  { id: 'bolero', label: 'Bolero' },
]

interface Level {
  rounds: number
  options: number
}
const LEVELS: Level[] = [
  { rounds: 3, options: 3 },
  { rounds: 4, options: 4 },
  { rounds: 5, options: 5 },
]
// Cada ronda se resuelve con un único acierto (sin "me rindo"), así que
// totalAttempts = mistakes + esta suma.
const TOTAL_ROUNDS = LEVELS.reduce((sum, l) => sum + l.rounds, 0)

const CLIPS = import.meta.glob('../../../assets/desafio/games/la-cancion-de-tu-juventud/*.mp3', {
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

const PRAISE = ['¡Muy bien!', '¡Excelente oído!', '¡Así se hace!', '¡Perfecto!']
const ROUND_OK = ['¡Bien!', '¡Ese es!', '¡Exacto!', '¡Muy bien!']

export function LaCancionDeTuJuventud({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Géneros objetivo del nivel: tantos distintos como rondas tenga, al azar,
  // recalculados una sola vez por nivel/roundKey (sin repetir dentro del nivel).
  const roundTargets = useMemo(
    () => shuffle(GENRES).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const target = roundTargets[roundIdx]
  const done = roundIdx >= level.rounds

  const options = useMemo(() => {
    if (!target) return []
    const decoyPool = GENRES.filter((g) => g.id !== target.id)
    const decoys = shuffle(decoyPool).slice(0, level.options - 1)
    return shuffle([target, ...decoys])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, levelIdx])

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasListened, setHasListened] = useState(false)
  const [roundOk, setRoundOk] = useState(ROUND_OK[0])
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Errores acumulados a través de los 3 niveles, reseteados solo en el
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
    setHasListened(true)
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
      // pantalla de fin de nivel.
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
        setHasListened(false)
      }, 850)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
    }
  }

  // Reset sincrónico dentro de nextLevel()/replay() — nunca en un efecto
  // separado sobre [levelIdx, roundKey] (mismo bug ya resuelto en El vuelto:
  // un efecto llega un render tarde y dispara onComplete con datos viejos).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    audioRef.current?.pause()
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setIsPlaying(false)
    setHasListened(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    audioRef.current?.pause()
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setIsPlaying(false)
    setHasListened(false)
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

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          Memoria · Nivel {levelIdx + 1}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué género es?</h2>
            <p className="mt-2 text-sm font-medium text-tiam-blue">
              Escuchá el fragmento y tocá a qué género musical se parece más.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
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
              disabled={solved}
              aria-label={isPlaying ? 'Pausar' : hasListened ? 'Escuchar de nuevo' : 'Escuchar'}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-tiam-blue text-white shadow-lg transition hover:bg-tiam-blue-dark active:scale-95 disabled:opacity-50"
            >
              {isPlaying ? <Pause className="h-10 w-10" /> : <Play className="ml-1 h-10 w-10" />}
            </button>
          </div>
          <p className="mt-3 text-center text-sm text-slate-400">
            {solved
              ? `${roundOk} Era ${target.label.toLowerCase()}.`
              : isPlaying
                ? 'Escuchando…'
                : hasListened
                  ? 'Tocá para escuchar de nuevo'
                  : 'Tocá para escuchar'}
          </p>

          {/* Options */}
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
            {options.map((g) => {
              const isEliminated = eliminated.has(g.id)
              const isCorrect = solved && g.id === target.id
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(g.id)}
                  className={[
                    'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrect
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {g.label}
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
              <Music className="h-6 w-6 text-tiam-blue" />
            )}
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Reconociste los {level.rounds} géneros — completaste el nivel {levelIdx + 1}.
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
