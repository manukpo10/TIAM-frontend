import type { WorksheetPrompt } from '@/lib/challengeContent'

/**
 * Fixed 9-slot flower layout, positions as percentages of the container's
 * own box (so it scales fluidly with width via the `aspect-ratio` on the
 * container — no JS measurement, no breakpoints needed). Hand-tuned against
 * a 410×505 design grid, not derived from a generic algorithm — there's
 * only one flower-shaped day, so this stays a one-off rather than a
 * reusable layout engine.
 *
 * Petals deliberately overlap each other and the center (boxes genuinely
 * intersect, not just touch) so the whole thing reads as one fused flower
 * silhouette instead of a cluster of separate badges — matching the
 * reference sheet's hand-drawn look more closely than the first pass did.
 *
 * `items` (from ChallengeDayContent.worksheet) must line up with this
 * array by index — see the order comment on `worksheetShape` in
 * challengeContent.ts.
 */
const SLOTS: { top: string; left: string; width: string; height: string; shape: 'center' | 'petal' | 'leaf-left' | 'leaf-right' }[] = [
  { top: '36.6%', left: '28.7%', width: '40.2%', height: '29.7%', shape: 'center' }, // 0 Mis fortalezas
  { top: '14.0%', left: '27.1%', width: '43.4%', height: '21.6%', shape: 'petal' }, // 1 Me llamo (top)
  { top: '24.8%', left: '57.5%', width: '36.6%', height: '22.8%', shape: 'petal' }, // 2 Soy de (upper-right)
  { top: '44.2%', left: '64.4%', width: '33.7%', height: '24.0%', shape: 'petal' }, // 3 Vivo en (right)
  { top: '60.0%', left: '48.8%', width: '37.8%', height: '21.6%', shape: 'petal' }, // 4 No me gusta (lower-right)
  { top: '24.8%', left: '3.5%', width: '36.6%', height: '22.8%', shape: 'petal' }, // 5 Mi edad (upper-left)
  { top: '60.0%', left: '11.0%', width: '37.8%', height: '21.6%', shape: 'petal' }, // 6 Me gusta (lower-left)
  { top: '76.0%', left: '46.3%', width: '29.3%', height: '19.8%', shape: 'leaf-right' }, // 7 Mi mejor amigo/a
  { top: '76.0%', left: '22.0%', width: '29.3%', height: '19.8%', shape: 'leaf-left' }, // 8 Mi color favorito
]

/** Corner radii per shape — leaves get one sharp corner (pointing outward,
 * away from the stem) instead of the petals' plain ellipse. Set via inline
 * style rather than Tailwind's `rounded-*` utilities: mixing a `rounded-full`
 * class with a corner override risks losing depending on Tailwind's
 * generated CSS order, which doesn't follow className order. */
function borderRadiusFor(shape: (typeof SLOTS)[number]['shape']): string {
  if (shape === 'leaf-right') return '50% 50% 0% 50%'
  if (shape === 'leaf-left') return '50% 50% 50% 0%'
  return '50%'
}

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
        style={{ top: '66.3%', left: '47.8%', width: '2%', height: '25.7%', backgroundColor: color, opacity: 0.5 }}
      />
      {/* Petals/leaves painted first, center last — so the center circle
          sits crisply on top where it overlaps them, like the reference
          sheet's "Mi retrato" disc in front of the petals behind it. */}
      {SLOTS.map((slot, i) => ({ slot, item: items[i] }))
        .filter((e): e is { slot: (typeof SLOTS)[number]; item: WorksheetPrompt } => e.item !== undefined)
        .sort((a, b) => (a.slot.shape === 'center' ? 1 : 0) - (b.slot.shape === 'center' ? 1 : 0))
        .map(({ slot, item }) => {
        const isCenter = slot.shape === 'center'
        return (
          <div
            key={item.label}
            className="absolute flex flex-col items-center justify-center border-[3px] bg-white px-2 text-center"
            style={{
              top: slot.top,
              left: slot.left,
              width: slot.width,
              height: slot.height,
              borderRadius: borderRadiusFor(slot.shape),
              borderColor: color,
            }}
          >
            <span
              className={isCenter ? 'text-sm font-extrabold leading-tight sm:text-base' : 'text-xs font-bold leading-tight sm:text-sm'}
              style={{ color }}
            >
              {item.label}
            </span>
            <div className="mt-1.5 w-3/4 border-b border-dashed border-slate-300" />
            {isCenter && (
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
