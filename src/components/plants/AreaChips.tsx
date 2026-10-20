import { AreaPlantIcon } from '@/components/plants/AreaPlantIcon'
import { AREA_LABELS, type AreaKey } from '@/lib/areaPlants'
import { useReveal } from '@/hooks/useReveal'
import { cn } from '@/lib/utils'

interface AreaChipsProps {
  areas: readonly AreaKey[]
  /** What the list is, for assistive tech (the visible context is the card around it). */
  label: string
  /** Height of each plant in CSS px. */
  size?: number
  /** The plants grow, one after another, the first time the list scrolls into view (the home page). Static otherwise. */
  sprout?: boolean
  className?: string
}

/**
 * The cognitive areas a product covers, each one as its plant next to its written name: «Cada área, su planta». The name is the label and always stays; the
 * plant is decoration (AreaPlantIcon). On the home it also sprouts when the card enters the viewport (hooks/useReveal.ts, "Plantas" block of index.css).
 */
export function AreaChips({ areas, label, size = 28, sprout = false, className }: AreaChipsProps) {
  const ref = useReveal<HTMLUListElement>(sprout)
  return (
    <ul ref={ref} role="list" aria-label={label} className={cn('flex flex-wrap gap-x-4 gap-y-2.5', className)}>
      {areas.map((area, index) => (
        <li key={area} className="inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-slate-700">
          <AreaPlantIcon area={area} size={size} sprout={sprout ? index * 130 : undefined} />
          {AREA_LABELS[area]}
        </li>
      ))}
    </ul>
  )
}
