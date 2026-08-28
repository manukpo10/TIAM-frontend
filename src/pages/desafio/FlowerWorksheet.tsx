import type { WorksheetPrompt } from '@/lib/challengeContent'

/**
 * Fixed 9-slot flower layout, positions as percentages of the container's
 * own box (so it scales fluidly with width via the `aspect-ratio` on the
 * container — no JS measurement, no breakpoints needed). Hand-tuned against
 * a 410×505 design grid, not derived from a generic algorithm — there's
 * only one flower-shaped day, so this stays a one-off rather than a
 * reusable layout engine.
 *
 * `items` (from ChallengeDayContent.worksheet) must line up with this
 * array by index — see the order comment on `worksheetShape` in
 * challengeContent.ts.
 */
const SLOTS: { top: string; left: string; width: string; height: string; center?: boolean }[] = [
  { top: '38.6%', left: '31.1%', width: '35.4%', height: '25.7%', center: true }, // 0 Mis fortalezas
  { top: '12.4%', left: '29.9%', width: '37.8%', height: '18.8%' }, // 1 Me llamo (top)
  { top: '24.6%', left: '62.9%', width: '31.7%', height: '19.8%' }, // 2 Soy de (upper-right)
  { top: '46.2%', left: '70.2%', width: '29.3%', height: '20.8%' }, // 3 Vivo en (right)
  { top: '63.1%', left: '58.2%', width: '32.9%', height: '18.8%' }, // 4 No me gusta (lower-right)
  { top: '24.6%', left: '2.9%', width: '31.7%', height: '19.8%' }, // 5 Mi edad (upper-left)
  { top: '63.1%', left: '6.5%', width: '32.9%', height: '18.8%' }, // 6 Me gusta (lower-left)
  { top: '82.3%', left: '48.0%', width: '26.8%', height: '14.9%' }, // 7 Mi mejor amigo/a (leaf)
  { top: '82.3%', left: '22.7%', width: '26.8%', height: '14.9%' }, // 8 Mi color favorito (leaf)
]

interface FlowerWorksheetProps {
  items: WorksheetPrompt[]
  color: string
}

/** Renders día28's worksheet as an actual flower — real, area-colored,
 * responsive text in each petal, not a static illustration (a generated
 * photo can't hold live text that stays legible at phone widths). */
export function FlowerWorksheet({ items, color }: FlowerWorksheetProps) {
  return (
    <div className="relative mx-auto w-full max-w-sm" style={{ aspectRatio: '410 / 505' }}>
      {/* Stem, rendered first so petals visually sit on top of it */}
      <div
        className="absolute rounded-full"
        style={{ top: '64.4%', left: '48.2%', width: '1.6%', height: '14.8%', backgroundColor: `${color}55` }}
      />
      {SLOTS.map((slot, i) => {
        const item = items[i]
        if (!item) return null
        return (
          <div
            key={item.label}
            className="absolute flex flex-col items-center justify-center rounded-full border-2 bg-slate-50 px-2 text-center shadow-sm"
            style={{ top: slot.top, left: slot.left, width: slot.width, height: slot.height, borderColor: `${color}33` }}
          >
            <span
              className={slot.center ? 'text-sm font-extrabold leading-tight sm:text-base' : 'text-[11px] font-bold leading-tight sm:text-xs'}
              style={{ color }}
            >
              {item.label}
            </span>
            <div className="mt-1.5 w-3/4 border-b border-dashed border-slate-300" />
            {slot.center && (
              <>
                <div className="mt-1.5 w-3/4 border-b border-dashed border-slate-300" />
                <div className="mt-1.5 w-3/4 border-b border-dashed border-slate-300" />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
