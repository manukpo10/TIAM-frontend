import { useLayoutEffect, useRef, type RefObject } from 'react'
import { watchReveal } from '@/lib/reveal'

/**
 * Makes the plants inside the returned element grow when it first scrolls into view. The element gets `data-grow="static" | "pending" | "done"` and the
 * CSS does the rest (the "Plantas" block of index.css). The rules (reduced motion, what starts above the fold, what happens on a failure) live in
 * lib/reveal.ts, with their tests.
 *
 * It writes the attribute straight on the DOM node, not through React state: no re-render, and the box never changes size. The layout effect runs before
 * the first paint, so a plant that has to wait is never seen for a frame first. With `enabled = false` it does nothing: the element is left as it is.
 */
export function useReveal<T extends HTMLElement>(enabled = true): RefObject<T | null> {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    return watchReveal(
      el,
      {
        matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
        IntersectionObserver: window.IntersectionObserver,
        viewportHeight: window.innerHeight,
      },
      (state) => {
        el.dataset.grow = state
      },
    )
  }, [enabled])
  return ref
}
