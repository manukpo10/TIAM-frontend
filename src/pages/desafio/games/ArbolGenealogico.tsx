import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El árbol de la familia" — día 22, área ejecutivas: kinship-deduction
 * puzzle. A set of statements describes one family (who married whom, who
 * their children are, who is nuera/yerno, sobrino/a, primos...) and the
 * player fills an empty family tree by tapping a name from the bank below
 * and then the box it belongs in. Tapping an already-filled box returns
 * that name to the bank. Once every box is full the round auto-checks: all
 * correct solves the level; otherwise one mistake is logged, a gentle hint
 * appears, and ONLY the incorrect names pop back to the bank (correct
 * placements stay put), so the player retries just what's wrong — never a
 * red flash, never a full reset.
 *
 * BOX-AMBIGUITY DECISION (mandatory per spec — read this before touching
 * the tree JSX or the family data below): every box carries a fixed,
 * pre-printed structural ROLE label ("Abuelo", "Nuera", "Hijo del medio"…)
 * — only the name is blank. Spanish kinship terms are inherently gendered
 * (abuelo≠abuela, nuera≠yerno, hijo≠hija…) and every author-chosen name
 * below has one unambiguous real-world gender matching its role, so no two
 * boxes in any family ever share both the same role AND the same required
 * gender — no box is ever visually or logically interchangeable with
 * another. The one place a role-gender repeats within a single generation
 * is level 1's three siblings (two "varones"): there, a birth-order
 * statement ("hermanos menores", "el más chico", "menor que") breaks the
 * tie too. Net result: EVERY box has exactly one
 * correct name, fully decided by the statements — this file declares no
 * interchangeable slots anywhere, and the checker below does plain,
 * per-box exact matching (no set/group comparison needed).
 *
 * UNIQUENESS INVARIANT: each of the 6 families below (2 per level, so a
 * replay never repeats the same one twice in a row) was authored by hand
 * and independently checked with a throwaway brute-force script — every
 * permutation of that family's names across its boxes, filtered by the
 * role-gender rule above, tested against every statement translated into a
 * relational predicate over the tree's own fixed spouse/parent/sibling
 * structure (not hand-waved — e.g. "casado con" only matches an actual
 * spouse-pair of roles, "sobrino de" is derived compositionally from
 * sibling + parent-of, never hardcoded to the intended box). Exactly one
 * permutation survived for all 6 families, matching what's encoded below.
 * The script lived only in the scratchpad and was deleted after use.
 *
 * STATEMENTS NEVER NAME A BOX'S OWN ROLE: every box already prints its
 * role, so "Marta es la hija mayor" would reduce the puzzle to matching
 * labels. Statements use relations the boxes don't print — mamá, tío,
 * sobrina, suegra, cuñado, "menor que" — so every placement takes a step
 * of reasoning. The in-law readings of tío/sobrino/cuñado (tío político,
 * concuñado) were brute-forced too: each family keeps exactly one
 * solution under both the strict and the broad reading.
 *
 * DIFFERENCE FROM QuienEsQuien / DesafioDeDeduccion: QuienEsQuien is pure
 * face↔name RECOGNITION memory (study a set, then multiple-choice match) —
 * no reasoning about how people relate to each other. DesafioDeDeduccion
 * is numeric/algebraic deduction (solve 3 equations for 3 symbol values),
 * zero kinship content. This game is a spatial PLACEMENT puzzle (tap-to-
 * place into a fixed tree, never multiple-choice) whose entire reasoning
 * is relational kinship vocabulary (nuera, yerno, cuñado, sobrino, primo)
 * — nothing here is memorized from an earlier study phase or computed
 * arithmetically; it is read-the-clues-and-place.
 */

interface FamilyData {
  id: string
  statements: string[]
  /** roleId -> the one correct name for that box. */
  names: Record<string, string>
}
interface Level {
  n: number
  name: string
  /** Box/role ids for this level's tree shape (shared by every family below). */
  roles: string[]
  families: FamilyData[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    roles: ['abuelo', 'abuela', 'hijaMayor', 'hijoMedio', 'hijoMenor'],
    families: [
      {
        id: 'familia-ramon',
        names: { abuelo: 'Ramón', abuela: 'Susana', hijaMayor: 'Marta', hijoMedio: 'Raúl', hijoMenor: 'Jorge' },
        statements: [
          'Ramón y Susana tuvieron tres hijos.',
          'Marta tiene dos hermanos menores: Raúl y Jorge.',
          'Jorge es el más chico de los tres.',
        ],
      },
      {
        id: 'familia-carlos',
        names: { abuelo: 'Carlos', abuela: 'Silvia', hijaMayor: 'Graciela', hijoMedio: 'Rubén', hijoMenor: 'Alberto' },
        statements: [
          'Carlos está casado con Silvia.',
          'Graciela es la hermana de Rubén y de Alberto.',
          'Rubén es menor que Graciela, pero mayor que Alberto.',
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    roles: ['abuelo', 'abuela', 'hijo', 'hija', 'yerno', 'nieta'],
    families: [
      {
        id: 'familia-eduardo',
        names: { abuelo: 'Eduardo', abuela: 'Beatriz', hija: 'Claudia', hijo: 'Martín', yerno: 'Hugo', nieta: 'Lucía' },
        statements: [
          'Eduardo está casado con Beatriz.',
          'Martín es el tío de Lucía.',
          'Claudia es la mamá de Lucía.',
          'Eduardo es el suegro de Hugo.',
        ],
      },
      {
        id: 'familia-roberto',
        names: { abuelo: 'Roberto', abuela: 'Amalia', hija: 'Patricia', hijo: 'Ignacio', yerno: 'Daniel', nieta: 'Valeria' },
        statements: [
          'Roberto es el papá de Patricia.',
          'Valeria es la sobrina de Ignacio.',
          'Daniel es el cuñado de Ignacio.',
          'Amalia es la suegra de Daniel.',
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    roles: ['abuelo', 'abuela', 'hijo', 'nuera', 'hija', 'yerno', 'nieto', 'nieta'],
    families: [
      {
        id: 'familia-osvaldo',
        names: {
          abuelo: 'Osvaldo',
          abuela: 'Nélida',
          hijo: 'Fernando',
          hija: 'Teresa',
          nuera: 'Adriana',
          yerno: 'Gustavo',
          nieto: 'Tomás',
          nieta: 'Julieta',
        },
        statements: [
          'Osvaldo es el suegro de Adriana.',
          'Adriana es la mamá de Tomás.',
          'Teresa es la cuñada de Adriana.',
          'Julieta es la sobrina de Fernando.',
          'Nélida es la suegra de Gustavo.',
        ],
      },
      {
        id: 'familia-hector',
        names: {
          abuelo: 'Héctor',
          abuela: 'Mónica',
          hijo: 'Sergio',
          hija: 'Laura',
          nuera: 'Marisa',
          yerno: 'Pablo',
          nieto: 'Julián',
          nieta: 'Carla',
        },
        statements: [
          'Héctor y Mónica son los suegros de Marisa.',
          'Marisa es la cuñada de Laura.',
          'Julián es el sobrino de Laura.',
          'Pablo es el papá de Carla.',
          'Sergio es el cuñado de Pablo.',
        ],
      },
    ],
  },
]

const TOTAL_BOXES = LEVELS.reduce((sum, l) => sum + l.roles.length, 0)

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

function emptyPlacements(level: Level): Record<string, string | null> {
  return Object.fromEntries(level.roles.map((id) => [id, null]))
}
function freshBank(level: Level, family: FamilyData): string[] {
  const inRoleOrder = level.roles.map((id) => family.names[id])
  // roles[] follows the tree's reading order, so a shuffle that lands back on
  // it would lay the bank out as the answer key — reshuffle until it doesn't.
  let bank = shuffle(inRoleOrder)
  while (bank.every((name, i) => name === inRoleOrder[i])) bank = shuffle(inRoleOrder)
  return bank
}

const PRAISE = ['¡Armaste el árbol completo!', '¡Excelente, cada uno en su lugar!', '¡Muy bien deducido!', '¡Así se arma un árbol genealógico!']
const HINTS = [
  'Algo no cierra — esos nombres volvieron a la lista. Releé las pistas con calma.',
  'Casi. Fijate bien quién es hijo, nuera o nieto de quién antes de ubicarlo.',
  'Todavía no — repasá el parentesco de los nombres que volvieron abajo.',
]

// Small fixed connectors — no props, so there is never a Tailwind class to
// interpolate. Reused identically at every generation join in every tree.
function VStem() {
  return <div className="h-3 w-0.5 shrink-0 bg-slate-300" />
}
function HStem() {
  return <div className="h-0.5 w-3 shrink-0 bg-slate-300" />
}

function NameBox({
  label,
  name,
  solved,
  onTap,
}: {
  label: string
  name: string | null
  solved: boolean
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={name ? `${label}: ${name}. Tocar para devolver a la lista.` : `${label}, vacío. Tocar para ubicar un nombre.`}
      className={[
        'flex min-h-11 w-20 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 py-1 text-center transition sm:w-24',
        'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
        name
          ? solved
            ? 'border-tiam-green bg-tiam-green/10'
            : 'border-tiam-blue bg-tiam-blue/5 hover:bg-tiam-blue/10'
          : 'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400',
      ].join(' ')}
    >
      <span className="text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">{label}</span>
      {name ? (
        <span className="break-words text-sm font-extrabold leading-tight text-slate-900">{name}</span>
      ) : (
        <span className="text-base leading-none text-slate-300">—</span>
      )}
      {solved && name && <Check className="h-3 w-3 shrink-0 text-tiam-green" strokeWidth={3} />}
    </button>
  )
}

interface TreeProps {
  placements: Record<string, string | null>
  solved: boolean
  onTapBox: (roleId: string) => void
}

// Level 1 — flat: a couple and their three children in one row. Two
// generations only, no nesting needed, so the couple is labelled Papá/Mamá
// (nobody here is a grandparent yet); the role ids stay abuelo/abuela so
// every level shares one set of ids.
function TreeL1({ placements, solved, onTapBox }: TreeProps) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        <NameBox label="Papá" name={placements.abuelo} solved={solved} onTap={() => onTapBox('abuelo')} />
        <HStem />
        <NameBox label="Mamá" name={placements.abuela} solved={solved} onTap={() => onTapBox('abuela')} />
      </div>
      <VStem />
      <div className="flex items-start gap-2">
        <NameBox label="Hija mayor" name={placements.hijaMayor} solved={solved} onTap={() => onTapBox('hijaMayor')} />
        <NameBox label="Hijo del medio" name={placements.hijoMedio} solved={solved} onTap={() => onTapBox('hijoMedio')} />
        <NameBox label="Hijo menor" name={placements.hijoMenor} solved={solved} onTap={() => onTapBox('hijoMenor')} />
      </div>
    </div>
  )
}

// Level 2 — the unmarried sibling sits beside a "branch card" (border +
// tint) that groups the married sibling with their spouse and child. The
// card is what visually (and structurally) says "these three belong
// together" instead of a fourth generation-1 box floating unattached.
function TreeL2({ placements, solved, onTapBox }: TreeProps) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        <NameBox label="Abuelo" name={placements.abuelo} solved={solved} onTap={() => onTapBox('abuelo')} />
        <HStem />
        <NameBox label="Abuela" name={placements.abuela} solved={solved} onTap={() => onTapBox('abuela')} />
      </div>
      <VStem />
      <div className="flex items-start gap-3">
        <NameBox label="Hijo" name={placements.hijo} solved={solved} onTap={() => onTapBox('hijo')} />
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50 p-2">
          <div className="flex items-center gap-1.5">
            <NameBox label="Hija" name={placements.hija} solved={solved} onTap={() => onTapBox('hija')} />
            <HStem />
            <NameBox label="Yerno" name={placements.yerno} solved={solved} onTap={() => onTapBox('yerno')} />
          </div>
          <VStem />
          <NameBox label="Nieta" name={placements.nieta} solved={solved} onTap={() => onTapBox('nieta')} />
        </div>
      </div>
    </div>
  )
}

// Level 3 — MOBILE-WIDTH FIX: both children are married here, so a naive
// layout would put 4 boxes across (hijo, nuera, hija, yerno) at generation
// 1. Instead the two branch cards (child+spouse+their kid) are STACKED
// vertically instead of placed side by side — the widest element in the
// whole level-3 tree is then a single branch card (~184px), never two of
// them side by side (~380px, which would overflow a 375px phone). See the
// width arithmetic in the session report.
function TreeL3({ placements, solved, onTapBox }: TreeProps) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        <NameBox label="Abuelo" name={placements.abuelo} solved={solved} onTap={() => onTapBox('abuelo')} />
        <HStem />
        <NameBox label="Abuela" name={placements.abuela} solved={solved} onTap={() => onTapBox('abuela')} />
      </div>
      <VStem />
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50 p-2">
          <div className="flex items-center gap-1.5">
            <NameBox label="Hijo" name={placements.hijo} solved={solved} onTap={() => onTapBox('hijo')} />
            <HStem />
            <NameBox label="Nuera" name={placements.nuera} solved={solved} onTap={() => onTapBox('nuera')} />
          </div>
          <VStem />
          <NameBox label="Nieto" name={placements.nieto} solved={solved} onTap={() => onTapBox('nieto')} />
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50 p-2">
          <div className="flex items-center gap-1.5">
            <NameBox label="Hija" name={placements.hija} solved={solved} onTap={() => onTapBox('hija')} />
            <HStem />
            <NameBox label="Yerno" name={placements.yerno} solved={solved} onTap={() => onTapBox('yerno')} />
          </div>
          <VStem />
          <NameBox label="Nieta" name={placements.nieta} solved={solved} onTap={() => onTapBox('nieta')} />
        </div>
      </div>
    </div>
  )
}

export function ArbolGenealogico({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Which family plays at each level THIS epoch (one full pass through the
  // 3 levels) — drawn at random once at mount, then switched to each level's
  // other family on a genuine day restart, never re-rolled just by revisiting
  // a level. Unlike QuienEsQuien's epochLevels (deliberately frozen forever,
  // "Repetir" reruns the exact same faces), this DOES change on restart —
  // see restartEpoch — because the button says so ("Otra familia").
  const [epochFamilies, setEpochFamilies] = useState(() => LEVELS.map((lvl) => pickOne(lvl.families)))
  const level = LEVELS[levelIdx]
  const family = epochFamilies[levelIdx]

  const [placements, setPlacements] = useState<Record<string, string | null>>(() => emptyPlacements(level))
  const [bank, setBank] = useState<string[]>(() => freshBank(level, family))
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3, zeroed only on a genuine day restart
  // (restartEpoch) — never on an in-level retry (wrong names simply come
  // back to the bank, there is no separate "replay this level" action).
  const [mistakes, setMistakes] = useState(0)

  function tapBankName(name: string) {
    if (solved) return
    setSelectedName((prev) => (prev === name ? null : name))
    setHint(null)
  }

  function evaluate(finalPlacements: Record<string, string | null>) {
    const allCorrect = level.roles.every((id) => finalPlacements[id] === family.names[id])
    if (allCorrect) {
      setPraise(pickOne(PRAISE))
      setSolved(true)
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    const corrected = { ...finalPlacements }
    const returned: string[] = []
    for (const id of level.roles) {
      if (corrected[id] !== family.names[id]) {
        returned.push(corrected[id] as string)
        corrected[id] = null
      }
    }
    setPlacements(corrected)
    setBank((prev) => [...prev, ...shuffle(returned)])
  }

  function tapBox(roleId: string) {
    if (solved) return
    const current = placements[roleId]
    if (current !== null) {
      // Tapping a placed name returns it to the bank — always allowed,
      // regardless of what (if anything) is currently selected.
      setPlacements((prev) => ({ ...prev, [roleId]: null }))
      setBank((prev) => [...prev, current])
      return
    }
    if (!selectedName) return
    const placedName = selectedName
    const next = { ...placements, [roleId]: placedName }
    setPlacements(next)
    setBank((prev) => prev.filter((n) => n !== placedName))
    setSelectedName(null)
    setHint(null)

    // Auto-check the instant the last box is filled — synchronous with
    // this same tap, not a separate effect, so there is no intermediate
    // render where the board looks full but hasn't been graded yet.
    if (level.roles.every((id) => next[id] !== null)) {
      evaluate(next)
    }
  }

  // Resets happen HERE, synchronously with the level/round change — never
  // in a useEffect keyed on levelIdx. An effect lags one render behind, so
  // `solved` (state, not derived) would still read true on the very render
  // that arrives at the new level, and the onComplete effect below would
  // fire on a level that was never actually finished. Same discipline as
  // every sibling game (see SumaHastaDiez.tsx's comment on this exact bug).

  // "Siguiente nivel" — advance within the SAME attempt. epochFamilies is
  // left alone: level i+1's family was already drawn when this epoch started.
  function advanceLevel() {
    const nextIdx = levelIdx + 1
    const nextLevel = LEVELS[nextIdx]
    const nextFamily = epochFamilies[nextIdx]
    setLevelIdx(nextIdx)
    setPlacements(emptyPlacements(nextLevel))
    setBank(freshBank(nextLevel, nextFamily))
    setSelectedName(null)
    setSolved(false)
    setHint(null)
  }
  // "Otra familia" — only reachable from level 3's complete card, so
  // always a genuine day restart: moves every level to its OTHER family
  // (hence the button's name, not "Repetir" — a fresh random pick from a
  // pool of two would repeat the same family half the time) and zeroes the
  // accumulators. roundKey always bumps here — the onComplete effect uses
  // it to allow firing again on this new attempt.
  function restartEpoch() {
    const newFamilies = LEVELS.map(
      (lvl, i) => lvl.families[(lvl.families.indexOf(epochFamilies[i]) + 1) % lvl.families.length],
    )
    setEpochFamilies(newFamilies)
    setLevelIdx(0)
    setPlacements(emptyPlacements(LEVELS[0]))
    setBank(freshBank(LEVELS[0], newFamilies[0]))
    setSelectedName(null)
    setSolved(false)
    setHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey, only once the LAST level is solved. A genuine
  // day restart gets a new roundKey, so it can report again.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (solved && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_BOXES })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Armá el árbol de la familia</h2>
        {!solved && (
          <p className="mt-2 text-base text-slate-500">
            Tocá un nombre de la lista y después el casillero donde va. Si te equivocás, solo eso vuelve abajo.
          </p>
        )}
      </div>

      {/* Statements — stay visible the whole time, including after solving,
          so the player can re-read why each name landed where it did. */}
      <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Así es esta familia</p>
        <ul className="mt-1.5 flex flex-col gap-1 text-base text-slate-600">
          {family.statements.map((s) => (
            <li key={s}>• {s}</li>
          ))}
        </ul>
      </div>

      {/* Tree */}
      {level.n === 1 && <TreeL1 placements={placements} solved={solved} onTapBox={tapBox} />}
      {level.n === 2 && <TreeL2 placements={placements} solved={solved} onTapBox={tapBox} />}
      {level.n === 3 && <TreeL3 placements={placements} solved={solved} onTapBox={tapBox} />}

      {/* Bank */}
      {!solved && (
        <>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {bank.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => tapBankName(n)}
                aria-pressed={selectedName === n}
                className={[
                  'min-h-[48px] rounded-xl border-2 px-4 text-base font-bold transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  selectedName === n
                    ? 'border-tiam-blue bg-tiam-blue text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>

          {hint && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Completion */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Completaste el árbol del {level.name.toLowerCase()} — cada nombre en su lugar.</p>
          {levelIdx < LEVELS.length - 1 ? (
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
                onClick={restartEpoch}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Otra familia
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
