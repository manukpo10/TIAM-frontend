import { GARDEN } from '@/lib/areaPlants'

/**
 * The garden band at the top of every footer: the seven area plants peeking up, as at the bottom of the Cuadernos TIAM covers. It sits right on top of the
 * footer, in the flow (never over the content above, so it can't cover any text or button), and the plants' stems are cut by the footer's edge.
 *
 * Pure decoration: `aria-hidden`, `alt=""`, nothing focusable. It is lazy and low priority (it is the last thing on every page), AVIF first with a WebP
 * fallback, and the box is reserved from the file's own size, so it can't shift the page. The same band is in pack/_partials/footer.html for the static landings.
 */
export function GardenBand() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none">
      <picture>
        <source type="image/avif" srcSet={GARDEN.avifSrcSet} sizes="(min-width: 1600px) 1600px, 100vw" />
        <source type="image/webp" srcSet={GARDEN.webpSrcSet} sizes="(min-width: 1600px) 1600px, 100vw" />
        <img
          src={GARDEN.src}
          width={GARDEN.width}
          height={GARDEN.height}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          className="mx-auto block h-auto w-full max-w-[1600px]"
        />
      </picture>
    </div>
  )
}
