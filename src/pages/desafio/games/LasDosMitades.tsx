import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Las dos mitades" — día 9, mes 6, reconocimiento (agnosias). The LEFT half of a face is on screen and four RIGHT
 * halves wait below; the player taps the one that belongs to the same person. The chosen half goes next to the one
 * on the left, so the player sees the face close up (or not). The mechanic comes from a worksheet where the halves of
 * several faces are cut out and matched; here the halves are not cut out, one is given and the other is chosen.
 *
 * ORIGINAL CONTENT. Only the idea (matching the two halves of a face) is borrowed. The faces are TIAM's own flat
 * drawings of older adults, made in code (SVG): nothing of the worksheet's faces, hair or style is used.
 *
 * WHY THE FACES ARE DRAWN IN CODE AND NOT GENERATED. Two halves must JOIN exactly and the difficulty must be exact: the
 * faces are symmetrical and made of a few features (skin, hair colour, hairstyle, glasses, moustache, beard, earrings,
 * clothes), so a half shows every one of them and the right half that matches is the only one with ALL of them. A
 * throwaway script (not committed) checks, for every puzzle, how many features each wrong half differs in (level 1: at
 * least four, level 2: exactly two, level 3: exactly ONE), that the four halves are all different and that the features
 * make sense together (earrings only with the ears showing, a moustache or beard only on short hair).
 *
 * THE RAMP is how alike the wrong halves are. Level 1: four different people. Level 2: the same person drawn with two
 * features changed (the hair and the clothes, the glasses and the skin…). Level 3: the same person with ONE feature
 * changed each time (the glasses, the moustache, the earrings, the shade of the hair), so the player has to compare
 * the details one by one. Nothing is timed, nothing asks for a name.
 *
 * A WRONG HALF costs ONE mistake: it goes next to the left half for a moment so the player can see it does not fit, then
 * it is switched off (muted gray, never red). The hint grows with the misses: what to look at, which feature does not
 * match, and the last one standing. The features are not told by colour alone: the clothes and the hair are also
 * named in the screen-reader label of every half.
 *
 * THREE FACES A LEVEL. Each level has a pool of four puzzles; three are picked ONCE at mount (`epoch`, with the order of
 * the four halves), so "Repetir" replays exactly the same nine.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in <LevelView>,
 * keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is ignored (the
 * halves sit where that button was) and a half already tried is ignored.
 *
 * totalAttempts = mistakes + every face of the day (TOTAL_FACES, derived).
 */

// ── data:start ──
type Skin = 'clara' | 'trigueña' | 'morena'
type HairColor = 'negro' | 'castaño' | 'gris' | 'blanco' | 'colorado'
type Style = 'corto' | 'calvo' | 'carre' | 'largo' | 'rulos' | 'rodete'
type Glasses = 'no' | 'redondos' | 'cuadrados'
type Top = 'azul' | 'verde' | 'bordó' | 'mostaza' | 'violeta' | 'celeste'

interface FaceDef {
  skin: Skin
  hair: HairColor
  style: Style
  glasses: Glasses
  mustache: boolean
  beard: boolean
  earrings: boolean
  top: Top
}
type Feature = keyof FaceDef
const FEATURES: Feature[] = ['skin', 'hair', 'style', 'glasses', 'mustache', 'beard', 'earrings', 'top']

/** Four people for level 1: they share almost nothing. */
const PEOPLE: Record<string, FaceDef> = {
  rosa: { skin: 'clara', hair: 'gris', style: 'rodete', glasses: 'no', mustache: false, beard: false, earrings: true, top: 'azul' },
  hugo: { skin: 'morena', hair: 'negro', style: 'corto', glasses: 'cuadrados', mustache: true, beard: false, earrings: false, top: 'mostaza' },
  nilda: { skin: 'trigueña', hair: 'colorado', style: 'largo', glasses: 'no', mustache: false, beard: false, earrings: false, top: 'violeta' },
  ramon: { skin: 'clara', hair: 'blanco', style: 'calvo', glasses: 'redondos', mustache: false, beard: true, earrings: false, top: 'verde' },
  elsa: { skin: 'morena', hair: 'gris', style: 'rulos', glasses: 'redondos', mustache: false, beard: false, earrings: false, top: 'bordó' },
  jorge: { skin: 'trigueña', hair: 'castaño', style: 'corto', glasses: 'no', mustache: true, beard: true, earrings: false, top: 'celeste' },
  ines: { skin: 'trigueña', hair: 'castaño', style: 'carre', glasses: 'cuadrados', mustache: false, beard: false, earrings: false, top: 'verde' },
  tito: { skin: 'clara', hair: 'negro', style: 'calvo', glasses: 'no', mustache: true, beard: false, earrings: false, top: 'bordó' },
}

interface PuzzleDef {
  /** The face whose left half is shown, and whose right half is the answer. */
  target: FaceDef
  /** The three faces whose right halves are the wrong options. */
  others: FaceDef[]
}
interface LevelDef {
  name: string
  /** How many features each wrong half must differ in: at least this many (level 1) or exactly this many. */
  differ: { min: number; max: number }
  /** Pool of puzzles; FACES_PER_LEVEL of them are played. */
  pool: PuzzleDef[]
}

const FACES_PER_LEVEL = 3

/** The same person with some features changed. */
const vary = (base: FaceDef, change: Partial<FaceDef>): FaceDef => ({ ...base, ...change })
const group = (target: FaceDef, ...others: FaceDef[]): PuzzleDef => ({ target, others })

const BASE_2A: FaceDef = { skin: 'clara', hair: 'colorado', style: 'largo', glasses: 'no', mustache: false, beard: false, earrings: false, top: 'violeta' }
const BASE_2B: FaceDef = { skin: 'trigueña', hair: 'castaño', style: 'corto', glasses: 'no', mustache: true, beard: false, earrings: false, top: 'azul' }
const BASE_2C: FaceDef = { skin: 'morena', hair: 'gris', style: 'rulos', glasses: 'redondos', mustache: false, beard: false, earrings: false, top: 'bordó' }
const BASE_2D: FaceDef = { skin: 'clara', hair: 'blanco', style: 'calvo', glasses: 'no', mustache: false, beard: true, earrings: false, top: 'mostaza' }

const BASE_3A: FaceDef = { skin: 'clara', hair: 'gris', style: 'calvo', glasses: 'redondos', mustache: true, beard: false, earrings: false, top: 'verde' }
const BASE_3B: FaceDef = { skin: 'trigueña', hair: 'castaño', style: 'rodete', glasses: 'no', mustache: false, beard: false, earrings: true, top: 'azul' }
const BASE_3C: FaceDef = { skin: 'morena', hair: 'negro', style: 'corto', glasses: 'cuadrados', mustache: false, beard: true, earrings: false, top: 'bordó' }
const BASE_3D: FaceDef = { skin: 'clara', hair: 'gris', style: 'carre', glasses: 'redondos', mustache: false, beard: false, earrings: false, top: 'celeste' }

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    differ: { min: 4, max: 8 },
    pool: [
      group(PEOPLE.rosa, PEOPLE.hugo, PEOPLE.nilda, PEOPLE.ramon),
      group(PEOPLE.hugo, PEOPLE.elsa, PEOPLE.rosa, PEOPLE.ines),
      group(PEOPLE.nilda, PEOPLE.jorge, PEOPLE.elsa, PEOPLE.tito),
      group(PEOPLE.ramon, PEOPLE.ines, PEOPLE.nilda, PEOPLE.hugo),
    ],
  },
  {
    name: 'Nivel 2',
    differ: { min: 2, max: 2 },
    pool: [
      group(BASE_2A, vary(BASE_2A, { hair: 'negro', top: 'verde' }), vary(BASE_2A, { glasses: 'cuadrados', skin: 'morena' }), vary(BASE_2A, { style: 'carre', top: 'mostaza' })),
      group(BASE_2B, vary(BASE_2B, { mustache: false, glasses: 'redondos' }), vary(BASE_2B, { hair: 'gris', top: 'verde' }), vary(BASE_2B, { beard: true, skin: 'clara' })),
      group(BASE_2C, vary(BASE_2C, { glasses: 'no', hair: 'negro' }), vary(BASE_2C, { style: 'largo', top: 'celeste' }), vary(BASE_2C, { skin: 'clara', glasses: 'cuadrados' })),
      group(BASE_2D, vary(BASE_2D, { beard: false, mustache: true }), vary(BASE_2D, { glasses: 'cuadrados', hair: 'gris' }), vary(BASE_2D, { skin: 'trigueña', top: 'verde' })),
    ],
  },
  {
    name: 'Nivel 3',
    differ: { min: 1, max: 1 },
    pool: [
      group(BASE_3A, vary(BASE_3A, { glasses: 'cuadrados' }), vary(BASE_3A, { mustache: false }), vary(BASE_3A, { hair: 'blanco' })),
      group(BASE_3B, vary(BASE_3B, { earrings: false }), vary(BASE_3B, { glasses: 'redondos' }), vary(BASE_3B, { top: 'violeta' })),
      group(BASE_3C, vary(BASE_3C, { beard: false }), vary(BASE_3C, { glasses: 'redondos' }), vary(BASE_3C, { skin: 'trigueña' })),
      group(BASE_3D, vary(BASE_3D, { glasses: 'cuadrados' }), vary(BASE_3D, { hair: 'blanco' }), vary(BASE_3D, { top: 'mostaza' })),
    ],
  },
]
const TOTAL_FACES = LEVELS.length * FACES_PER_LEVEL

/** What each feature is called in a hint. */
const FEATURE_LABEL: Record<Feature, string> = {
  skin: 'el color de la piel',
  hair: 'el color del pelo',
  style: 'el peinado',
  glasses: 'los anteojos',
  mustache: 'el bigote',
  beard: 'la barba',
  earrings: 'los aros',
  top: 'la ropa',
}

/** The features in which two faces differ. */
function differences(a: FaceDef, b: FaceDef): Feature[] {
  return FEATURES.filter((f) => a[f] !== b[f])
}
/** The face in words, for a screen reader. */
function describe(f: FaceDef): string {
  const parts = [`pelo ${f.hair}${f.style === 'calvo' ? ' a los costados' : ''}`, `piel ${f.skin}`, `ropa ${f.top}`]
  if (f.glasses !== 'no') parts.push(`anteojos ${f.glasses}`)
  if (f.mustache) parts.push('bigote')
  if (f.beard) parts.push('barba')
  if (f.earrings) parts.push('aros')
  return parts.join(', ')
}

/** The faces of the how-to screen: they are not in the game. */
const EXAMPLE: FaceDef = { skin: 'trigueña', hair: 'blanco', style: 'corto', glasses: 'redondos', mustache: false, beard: false, earrings: false, top: 'celeste' }
// ── data:end ──

// ── faces:start ──
const SKIN: Record<Skin, { base: string; shade: string }> = {
  clara: { base: '#f3d3b6', shade: '#e0b592' },
  trigueña: { base: '#dcaa7d', shade: '#c48d5f' },
  morena: { base: '#ab7650', shade: '#8f5c3a' },
}
const HAIR: Record<HairColor, string> = { negro: '#2a2a31', castaño: '#6d442b', gris: '#98a0a9', blanco: '#e8eaee', colorado: '#b6542c' }
const TOP: Record<Top, string> = { azul: '#2f6fb5', verde: '#3e9a59', bordó: '#a53a4c', mostaza: '#d6a329', violeta: '#7b56a8', celeste: '#6db8d8' }

/** The whole face as SVG (viewBox 0 0 200 250, centred on x = 100). Symmetrical, so the two halves carry the same
 * features; a half is just a window on one side of x = 100. */
function faceSvg(f: FaceDef): string {
  const skin = SKIN[f.skin]
  const hair = HAIR[f.hair]
  const stroke = `stroke="${f.hair === 'blanco' ? '#9aa1aa' : 'rgba(0,0,0,0.16)'}" stroke-width="1.5"`
  const earsShow = f.style === 'corto' || f.style === 'rodete' || f.style === 'calvo'
  const brow = f.hair === 'blanco' ? '#b4bac2' : hair
  const out: string[] = []
  // shirt
  out.push(`<path d="M18 250 C22 214 58 204 100 204 C142 204 178 214 182 250 Z" fill="${TOP[f.top]}"/>`)
  // hair behind the head
  if (f.style === 'largo') out.push(`<path d="M34 120 C28 60 60 30 100 30 C140 30 172 60 166 120 C166 160 172 205 176 236 L24 236 C28 205 34 160 34 120 Z" fill="${hair}" ${stroke}/>`)
  if (f.style === 'carre') out.push(`<path d="M36 120 C30 62 60 32 100 32 C140 32 170 62 164 120 C164 148 160 170 154 178 L46 178 C40 170 36 148 36 120 Z" fill="${hair}" ${stroke}/>`)
  if (f.style === 'rodete') out.push(`<circle cx="100" cy="30" r="21" fill="${hair}" ${stroke}/>`)
  if (f.style === 'rulos') {
    for (let a = 150; a <= 390; a += 24) {
      const r = (a * Math.PI) / 180
      out.push(`<circle cx="${(100 + 62 * Math.cos(r)).toFixed(1)}" cy="${(94 + 62 * Math.sin(r)).toFixed(1)}" r="18" fill="${hair}" ${stroke}/>`)
    }
    for (const [x, y] of [[40, 130], [160, 130], [38, 152], [162, 152]]) out.push(`<circle cx="${x}" cy="${y}" r="16" fill="${hair}" ${stroke}/>`)
  }
  // neck
  out.push(`<path d="M80 166 L80 208 Q100 226 120 208 L120 166 Z" fill="${skin.shade}"/>`)
  // ears
  if (earsShow) out.push(`<ellipse cx="45" cy="130" rx="10" ry="16" fill="${skin.base}" stroke="${skin.shade}" stroke-width="2"/><ellipse cx="155" cy="130" rx="10" ry="16" fill="${skin.base}" stroke="${skin.shade}" stroke-width="2"/>`)
  // head
  out.push(`<ellipse cx="100" cy="120" rx="56" ry="68" fill="${skin.base}"/>`)
  out.push(`<ellipse cx="68" cy="148" rx="11" ry="7" fill="#e58d8d" opacity=".22"/><ellipse cx="132" cy="148" rx="11" ry="7" fill="#e58d8d" opacity=".22"/>`)
  // hair over the head
  if (f.style === 'corto' || f.style === 'rodete') out.push(`<path d="M42 112 C34 52 66 34 100 34 C134 34 166 52 158 112 C152 84 136 70 100 68 C64 70 48 84 42 112 Z" fill="${hair}" ${stroke}/>`)
  if (f.style === 'carre' || f.style === 'largo') out.push(`<path d="M42 116 C38 54 70 36 100 36 C130 36 162 54 158 116 C152 86 136 74 100 72 C64 74 48 86 42 116 Z" fill="${hair}" ${stroke}/>`)
  if (f.style === 'calvo') out.push(`<path d="M44 126 C38 98 46 80 58 72 C56 90 54 108 57 130 Z" fill="${hair}" ${stroke}/><path d="M156 126 C162 98 154 80 142 72 C144 90 146 108 143 130 Z" fill="${hair}" ${stroke}/><ellipse cx="82" cy="62" rx="16" ry="7" fill="#fff" opacity=".28"/>`)
  if (f.style === 'rulos') for (const [x, y] of [[66, 72], [100, 64], [134, 72], [48, 90], [152, 90]]) out.push(`<circle cx="${x}" cy="${y}" r="17" fill="${hair}" ${stroke}/>`)
  // lines of an older face
  out.push(`<path d="M76 84 Q100 79 124 84" stroke="${skin.shade}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>`)
  out.push(`<path d="M80 142 Q71 154 78 168" stroke="${skin.shade}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/><path d="M120 142 Q129 154 122 168" stroke="${skin.shade}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/>`)
  out.push(`<path d="M57 106 L48 102 M57 113 L47 113" stroke="${skin.shade}" stroke-width="2" stroke-linecap="round" opacity=".8"/><path d="M143 106 L152 102 M143 113 L153 113" stroke="${skin.shade}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`)
  // brows, eyes, nose, mouth
  out.push(`<path d="M64 97 Q78 90 92 97" stroke="${brow}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M108 97 Q122 90 136 97" stroke="${brow}" stroke-width="5" fill="none" stroke-linecap="round"/>`)
  out.push(`<ellipse cx="78" cy="112" rx="5" ry="6" fill="#26262e"/><ellipse cx="122" cy="112" rx="5" ry="6" fill="#26262e"/>`)
  out.push(`<path d="M100 114 C94 134 90 142 96 146 Q100 148 104 146" stroke="${skin.shade}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
  if (f.beard) out.push(`<path d="M46 134 C48 178 76 198 100 198 C124 198 152 178 154 134 C146 160 132 174 100 174 C68 174 54 160 46 134 Z" fill="${hair}" ${stroke}/>`)
  out.push(`<path d="M82 163 Q100 175 118 163" stroke="#9a4a4a" stroke-width="4.5" fill="none" stroke-linecap="round"/>`)
  if (f.mustache) out.push(`<path d="M100 156 C92 148 80 149 73 158 C83 164 94 162 100 159 C106 162 117 164 127 158 C120 149 108 148 100 156 Z" fill="${hair}" ${stroke}/>`)
  // glasses and earrings
  if (f.glasses === 'redondos') {
    out.push(`<circle cx="78" cy="112" r="17" fill="#fff" fill-opacity=".25" stroke="#2c2c36" stroke-width="3.5"/><circle cx="122" cy="112" r="17" fill="#fff" fill-opacity=".25" stroke="#2c2c36" stroke-width="3.5"/>`)
    out.push(`<path d="M95 110 Q100 106 105 110 M61 108 L47 112 M139 108 L153 112" stroke="#2c2c36" stroke-width="3.5" fill="none" stroke-linecap="round"/>`)
  }
  if (f.glasses === 'cuadrados') {
    out.push(`<rect x="60" y="99" width="36" height="27" rx="6" fill="#fff" fill-opacity=".25" stroke="#2c2c36" stroke-width="3.5"/><rect x="104" y="99" width="36" height="27" rx="6" fill="#fff" fill-opacity=".25" stroke="#2c2c36" stroke-width="3.5"/>`)
    out.push(`<path d="M96 108 L104 108 M60 106 L47 112 M140 106 L153 112" stroke="#2c2c36" stroke-width="3.5" fill="none" stroke-linecap="round"/>`)
  }
  if (f.earrings && earsShow) out.push(`<circle cx="45" cy="152" r="6" fill="#e0b13a" stroke="#a97d1a" stroke-width="1.5"/><circle cx="155" cy="152" r="6" fill="#e0b13a" stroke="#a97d1a" stroke-width="1.5"/>`)
  return out.join('')
}
/** Which side of the face a half shows. */
function halfViewBox(side: 'left' | 'right'): string {
  return side === 'left' ? '0 16 100 212' : '100 16 100 212'
}
// ── faces:end ──

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

interface PreparedPuzzle {
  target: FaceDef
  /** The four faces whose right halves show, in the order they show. */
  options: FaceDef[]
}
function buildEpoch(): PreparedPuzzle[][] {
  return LEVELS.map((lvl) =>
    shuffle(lvl.pool)
      .slice(0, FACES_PER_LEVEL)
      .map((p) => ({ target: p.target, options: shuffle([p.target, ...p.others]) })),
  )
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo!', '¡Perfecto!']
/** How long a wrong half stays next to the left one, and how long the right one is admired. */
const PEEK_MS = 1100
const ADVANCE_MS = 1500
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a half: the halves sit where that button was. */
const SETTLE_MS = 400

/** One half of a face. */
function Half({ face, side, className }: { face: FaceDef; side: 'left' | 'right'; className?: string }) {
  return (
    <svg viewBox={halfViewBox(side)} className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: faceSvg(face) }} />
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Mirá la mitad de una cara de la izquierda: el pelo, los anteojos, el bigote, la ropa.',
    'Tocá, entre las cuatro de abajo, la otra mitad que le corresponde a esa persona.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-base font-semibold text-slate-500">Por ejemplo:</p>
        <div className="mt-1 flex justify-center">
          <Half face={EXAMPLE} side="left" className="h-32 w-auto" />
          <Half face={EXAMPLE} side="right" className="h-32 w-auto" />
        </div>
        <p className="mt-1 text-base text-slate-600">Las dos mitades forman la misma persona.</p>
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

/** The hint after a wrong half: it grows with every miss on the same face, and from the third one only one is left. */
function missHint(target: FaceDef, tried: FaceDef, misses: number): string {
  if (misses === 1) return 'Esa no es. Fijate en el pelo, los anteojos, el bigote y la ropa.'
  if (misses === 2) {
    const first = differences(target, tried)[0]
    return `Esa tampoco. Mirá ${FEATURE_LABEL[first]}: tiene que ser igual en las dos mitades.`
  }
  return 'Queda una sola: tocala.'
}

interface LevelViewProps {
  levelIdx: number
  puzzles: PreparedPuzzle[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, puzzles, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = puzzles.length

  const [qIdx, setQIdx] = useState(0)
  // Halves already tried wrong for this face (by their index in the row) and the one shown next to the left half.
  const [tried, setTried] = useState<number[]>([])
  const [shown, setShown] = useState<{ idx: number; right: boolean } | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same keys, but readable at once: a double tap lands before React has repainted the half as disabled.
  const lockedRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const current = puzzles[qIdx]
  const busy = advancing || done || shown !== null

  function tapHalf(idx: number, at: number) {
    if (busy || at - since < SETTLE_MS || tried.includes(idx)) return
    const key = `${qIdx}|${idx}`
    if (lockedRef.current.has(key)) return
    lockedRef.current.add(key)
    const face = current.options[idx]
    if (face === current.target) {
      setShown({ idx, right: true })
      setAdvancing(true)
      setHint({ text: '¡Eso es! Las dos mitades son de la misma persona.', ok: true })
      timerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setTried([])
          setShown(null)
          setHint(null)
          setAdvancing(false)
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    const n = tried.length + 1
    setShown({ idx, right: false })
    setHint({ text: missHint(current.target, face, n), ok: false })
    onMistake()
    // The wrong half stays next to the left one for a moment, so the player sees that it does not fit.
    timerRef.current = window.setTimeout(() => {
      setTried((t) => [...t, idx])
      setShown(null)
    }, PEEK_MS)
  }

  const slotFace = shown ? current.options[shown.idx] : null

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Cara {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The left half and the place of the right one */}
          <div className="mx-auto mt-2 flex w-fit overflow-hidden rounded-2xl border-2 border-tiam-blue/30 bg-sky-50" role="img" aria-label={`Mitad izquierda de una cara: ${describe(current.target)}`}>
            <Half face={current.target} side="left" className="h-44 w-auto" />
            <div className={`relative h-44 w-[83px] border-l-2 border-dashed ${shown?.right ? 'border-tiam-green' : 'border-slate-300'}`}>
              {slotFace ? <Half face={slotFace} side="right" className="h-44 w-auto" /> : <span className="flex h-full items-center justify-center text-4xl font-extrabold text-slate-300">?</span>}
            </div>
          </div>

          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.75rem] max-w-md text-center text-base font-medium leading-snug ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? 'Tocá la otra mitad de esta cara.'}
          </p>

          {/* The four right halves */}
          <div role="group" aria-label="Mitades derechas" className="mx-auto grid max-w-md grid-cols-4 gap-1.5">
            {current.options.map((face, idx) => {
              const isTried = tried.includes(idx)
              const isRight = shown?.idx === idx && shown.right
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={busy || isTried}
                  aria-label={`Mitad derecha ${idx + 1}: ${describe(face)}`}
                  onClick={(e) => tapHalf(idx, e.timeStamp)}
                  className={[
                    'flex items-center justify-center overflow-hidden rounded-xl border-2 bg-sky-50 transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRight ? 'border-tiam-green' : isTried ? 'cursor-not-allowed border-slate-200 opacity-35 grayscale' : 'border-slate-300 hover:border-tiam-blue/40 hover:shadow-md',
                  ].join(' ')}
                >
                  <Half face={face} side="right" className="h-auto w-full" />
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Juntaste las {total} caras. ¡Terminaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 flex justify-center gap-3" aria-label="Las caras completas">
            {puzzles.map((p, i) => (
              <li key={i} className="flex overflow-hidden rounded-xl bg-white" aria-hidden="true">
                <Half face={p.target} side="left" className="h-24 w-auto" />
                <Half face={p.target} side="right" className="h-24 w-auto" />
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-base text-slate-600">
            <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} aria-hidden="true" />
            Cada mitad encontró a la suya.
          </p>
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

export function LasDosMitades({ onComplete }: GameProps) {
  // Which faces each level plays and the order of the four halves — decided once, at mount, so "Repetir" replays
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
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_FACES })
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
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Quién es?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      puzzles={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
