import type { WorksheetPrompt } from '@/lib/challengeContent'

/**
 * Fixed 9-slot flower layout, positions as percentages of the container's
 * own box (so it scales fluidly with width via the `aspect-ratio` on the
 * container — no JS measurement, no breakpoints needed). Hand-tuned against
 * a 410×505 design grid, not derived from a generic algorithm — there's
 * only one flower-shaped day, so this stays a one-off rather than a
 * reusable layout engine.
 *
 * Sized by hand from actual distances, not eyeballed: the 6 ring petals are
 * a UNIFORM size (100×150 on a 520×640 design grid) placed at radius 130
 * from the center — chosen so adjacent petals touch or lightly overlap
 * (checked per-pair: chord between neighboring petal centers vs. petal
 * width) while their inner tips overlap the center circle by ~15 units, so
 * the center (painted last, see below) cleanly swallows the petal-tip
 * tangle instead of it staying visible. The 2 leaves sit lower, at a wider
 * radius (210) than the first version of this layout — their boxes still
 * overlap "No me gusta"/"Me gusta" a bit (outline overlap is fine, wanted
 * even, it's what fuses the shapes), but their TEXT CENTERS are ~100
 * design-units apart, verified with a live `getBoundingClientRect()` probe
 * (see the bugfix this replaced — an earlier pass "verified" this by hand
 * trig assuming single-line labels, which was wrong: several labels wrap
 * to 2 lines, eating the margin a center-point calculation alone misses).
 *
 * `items` (from ChallengeDayContent.worksheet) must line up with this
 * array by index — see the order comment on `worksheetShape` in
 * challengeContent.ts.
 */

/**
 * Purely decorative circle, no label — the ring has 3 petals on the right
 * (Soy de/Vivo en/No me gusta) but only 2 on the left (Mi edad/Me gusta),
 * since there's no 10th worksheet prompt to fill the mirror slot. This is
 * the mirror image of "Vivo en"'s box (left = 100% − Vivo en's left − Vivo
 * en's width) so the ring reads as evenly balanced left/right, without
 * inventing content that isn't there — an unlabeled petal-sized shape,
 * empty and unremarkable enough not to look like a missed worksheet field.
 */
const BALANCE_CIRCLE = { top: '35.4%', left: '15.5%', width: '19.2%', height: '23.4%' }
const SLOTS: { top: string; left: string; width: string; height: string; shape: 'center' | 'petal' | 'leaf-left' | 'leaf-right' }[] = [
  { top: '33.6%', left: '35.6%', width: '28.8%', height: '23.4%', shape: 'center' }, // 0 Mis fortalezas
  { top: '13.3%', left: '40.4%', width: '19.2%', height: '23.4%', shape: 'petal' }, // 1 Me llamo (top)
  { top: '20.5%', left: '59.5%', width: '19.2%', height: '23.4%', shape: 'petal' }, // 2 Soy de (upper-right)
  { top: '35.4%', left: '65.3%', width: '19.2%', height: '23.4%', shape: 'petal' }, // 3 Vivo en (right)
  { top: '47.2%', left: '59.0%', width: '19.2%', height: '23.4%', shape: 'petal' }, // 4 No me gusta (lower-right)
  { top: '20.5%', left: '21.2%', width: '19.2%', height: '23.4%', shape: 'petal' }, // 5 Mi edad (upper-left)
  { top: '47.2%', left: '21.8%', width: '19.2%', height: '23.4%', shape: 'petal' }, // 6 Me gusta (lower-left)
  { top: '66.5%', left: '50.4%', width: '18.3%', height: '17.2%', shape: 'leaf-right' }, // 7 Mi mejor amigo/a
  { top: '66.5%', left: '31.4%', width: '18.3%', height: '17.2%', shape: 'leaf-left' }, // 8 Mi color favorito
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
    <div className="relative mx-auto w-full max-w-lg" style={{ aspectRatio: '520 / 640' }}>
      {/* Stem, rendered first so petals sit on top of it — starts at the
          center's bottom edge and runs well past the leaves so a real
          length of it stays visible below them, not just a sliver. */}
      <div
        className="absolute rounded-full"
        style={{ top: '57.0%', left: '48.9%', width: '2.3%', height: '33%', backgroundColor: color, opacity: 0.5 }}
      />
      <div
        className="absolute rounded-full border-[3px] bg-white"
        style={{ ...BALANCE_CIRCLE, borderColor: color }}
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
