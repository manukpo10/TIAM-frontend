import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { plantIcon, type AreaKey } from '@/lib/areaPlants'

interface AreaPlantIconProps {
  area: AreaKey
  /** Height in CSS px (24 to 48). The width follows the 4:5 proportion of the files. */
  size?: number
  /**
   * Sits the plant on a small cream paper disc, like the covers: for a dark background, where the darker plants (violet, teal, gold) would
   * disappear. The disc is `size + 8` px wide and tall.
   */
  onPaper?: boolean
  /**
   * Takes part in the growth of the nearest `data-grow` ancestor (see hooks/useReveal.ts and the "Plantas" block of index.css). The number is the
   * delay in ms, to stagger several plants.
   */
  sprout?: number
  className?: string
}

/**
 * The small cut-paper plant of a cognitive area (lib/areaPlants.ts), to put NEXT TO the area's written label: it is decoration (`alt=""`, `aria-hidden`),
 * the label always stays. The box is reserved with width and height, so nothing shifts when the file arrives.
 */
export function AreaPlantIcon({ area, size = 28, onPaper = false, sprout, className }: AreaPlantIconProps) {
  const icon = plantIcon(area, size)
  const style = sprout === undefined ? undefined : ({ '--plant-delay': `${sprout}ms` } as CSSProperties)
  const img = (
    <img
      src={icon.src}
      srcSet={icon.srcSet}
      width={icon.width}
      height={icon.height}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      // Low priority: in the Desafío's hero the first card of the deck is the LCP image, and these icons sit next to its label.
      fetchPriority="low"
      draggable={false}
      style={style}
      className={cn('block shrink-0 select-none', sprout !== undefined && 'plant-sprout', !onPaper && className)}
    />
  )
  if (!onPaper) return img
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-[#FDF9EB] pb-1', className)}
      style={{ width: size + 8, height: size + 8 }}
    >
      {img}
    </span>
  )
}
