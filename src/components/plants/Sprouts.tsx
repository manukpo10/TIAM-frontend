import type { CSSProperties } from 'react'
import { plantGrow, type AreaKey } from '@/lib/areaPlants'
import { useReveal } from '@/hooks/useReveal'
import { cn } from '@/lib/utils'

interface SproutsProps {
  /** The plants, left to right. */
  areas: readonly AreaKey[]
  /** Height of each plant in CSS px (the file is 240 px tall: sharp up to 2x at 120). */
  height?: number
  /** Extra classes for each plant, for example `h-14 w-auto` to make them smaller on a phone (the width and height attributes keep the proportion). */
  plantClassName?: string
  className?: string
}

/**
 * A few whole plants that grow out of the ground the first time they scroll into view: the home page's way of showing the garden (the footer's band is the
 * garden itself, on every page). They stand on whatever edge the parent puts the bottom of this box on.
 *
 * Pure decoration: `aria-hidden`, `alt=""`, not interactive, lazy and low priority. The box is reserved with the plants' own size, so nothing shifts; the motion is only
 * opacity/scale/translate/rotate and is static under prefers-reduced-motion (lib/reveal.ts has the rules and their tests; the CSS is the "Plantas" block of index.css).
 */
export function Sprouts({ areas, height = 120, plantClassName, className }: SproutsProps) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} aria-hidden="true" className={cn('pointer-events-none flex select-none items-end', className)}>
      {areas.map((area, index) => {
        const plant = plantGrow(area, height)
        return (
          <img
            key={area}
            src={plant.src}
            width={plant.width}
            height={plant.height}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            draggable={false}
            style={{ '--plant-delay': `${index * 140}ms` } as CSSProperties}
            className={cn('plant-sprout shrink-0', plantClassName)}
          />
        )
      })}
    </div>
  )
}
