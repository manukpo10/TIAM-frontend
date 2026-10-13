import { useEffect, useState, type FocusEvent } from 'react'

/** True when the element got focus from the keyboard (not from a tap or a click). */
function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    // Browsers without :focus-visible: treat any focus as keyboard focus.
    return true
  }
}

/**
 * State for something that moves on its own (a carousel, a deck of cards).
 * It follows the rules every auto-advancing piece of the site follows:
 *  - a pause button must exist (WCAG 2.2.2): `paused` + `togglePaused`;
 *  - nothing advances on its own for anyone whose OS asks for reduced motion;
 *  - it holds still while hovered (only on devices with a real pointer: on a
 *    touch screen a tap leaves an emulated mouseenter stuck "on") and while
 *    KEYBOARD focus is inside (only :focus-visible, so tapping the pause button
 *    on a phone doesn't freeze it).
 *
 * Spread `regionProps` on the element that wraps the whole thing.
 */
export function useAutoCarousel(count: number, intervalMs: number) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [canHover] = useState(() => window.matchMedia('(hover: hover)').matches)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    // The OS setting can change while the page is open: if it turns on, stop.
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setPaused(true)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (paused || hovered || focused) return
    const id = setInterval(() => {
      setActive((i) => (i + 1) % count)
    }, intervalMs)
    return () => clearInterval(id)
  }, [paused, hovered, focused, count, intervalMs])

  function togglePaused() {
    // An explicit resume moves on right away instead of waiting for the pointer
    // to leave or the focus to move — both still there after the click.
    if (paused) {
      setHovered(false)
      setFocused(false)
    }
    setPaused((p) => !p)
  }

  /** Picking one means "let me look at this one", so it stops there. */
  function select(i: number) {
    setActive(i)
    setPaused(true)
  }

  const regionProps = {
    onMouseEnter: () => {
      if (canHover) setHovered(true)
    },
    onMouseLeave: () => setHovered(false),
    onFocus: (e: FocusEvent) => {
      if (isKeyboardFocus(e.target as Element)) setFocused(true)
    },
    onBlur: () => setFocused(false),
  }

  return { active, paused, togglePaused, select, regionProps }
}
