import { useEffect } from 'react'

/**
 * Locks page scroll while `active` is true — for full-screen modals/drawers,
 * so an accidental touch or drag near the backdrop can't scroll the page
 * underneath. Plain `overflow: hidden` on body isn't reliable on iOS Safari
 * (touch-scroll can still bleed through a fixed overlay), so this pins the
 * body with `position: fixed` and restores the exact scroll offset on unlock.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    const scrollY = window.scrollY
    const { style } = document.body
    const prev = {
      position: style.position,
      top: style.top,
      width: style.width,
      overflow: style.overflow,
    }

    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.width = '100%'
    style.overflow = 'hidden'

    return () => {
      style.position = prev.position
      style.top = prev.top
      style.width = prev.width
      style.overflow = prev.overflow
      // `instant`: the page's CSS sets `scroll-behavior: smooth`, and the unlock leaves the scroll
      // at the top, so a plain scrollTo would replay a long smooth scroll back down to `scrollY`.
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    }
  }, [active])
}
