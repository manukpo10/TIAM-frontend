import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * The site's route motion, mounted once inside the router. The CSS side is the "Movimiento"
 * block of index.css.
 *
 * 1. A navigation starts at the top of the new page. In a single-page app the browser keeps the
 *    old scroll offset, so a link clicked from the footer landed at the bottom of the next page.
 *    Back/Forward and URLs with a #hash are left alone: the browser, and the pages that own their
 *    hash (Talleres, Material digital), put the scroll where it belongs. This is where the page
 *    starts, not motion, so it also runs under prefers-reduced-motion and on the player routes.
 * 2. The new page's <main> fades in, unless the page's own title comes in (3).
 * 3. The page's title and the line under it (or the elements marked data-enter="1", "2"…) come in:
 *    text slides up, anything else also fades. Text never starts transparent: it is what the
 *    browser measures as the page's largest paint, and a fade would delay that.
 * 4. The blocks that start below the fold stay hidden until they scroll into view, then rise in,
 *    one after another when several arrive together. What starts inside the viewport is never
 *    hidden.
 *
 * Motion (2-4) is skipped under prefers-reduced-motion and on the two player surfaces, whose
 * cards and buttons are hit-tested and guarded against accidental double taps. The signed-in app
 * (it marks its shell with data-app-shell) only gets the fade: it is a tool, not a showroom.
 * Everything here is decoration, and the app has no error boundary, so a failure is logged and
 * skipped instead of taking the page down.
 *
 * Markup contract: data-enter="n" on the pieces of a hero (n = the step it comes in at; pieces
 * sharing a step come in together), data-stagger on the container of a group of cards (each child
 * is revealed on its own, one after another).
 */

const PAGE_FADE_MS = 220
const STAGGER_MS = 60
const MAX_STAGGER_STEPS = 5
const PLAYER_ROUTES = ['/jugar/', '/desafio/']
// What scrolls in: every section of <main>, and the children of whatever carries data-stagger.
const REVEAL_TARGETS = 'main > section, [data-stagger] > *'
// Not visible even when "in view": they are left alone and show up as they are when opened.
const NEVER_SEEN = '[hidden], details:not([open])'
// Text blocks are what the browser can measure as the largest paint: they slide but never fade.
const TEXT_BLOCKS = 'h1, h2, p'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isPlayer = (pathname: string) => PLAYER_ROUTES.some((prefix) => pathname.startsWith(prefix))
const cssValue = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const easing = () => cssValue('--ease-soft') || 'cubic-bezier(0.22, 1, 0.36, 1)'

function riseIn(el: Element, step: number) {
  const keyframes: PropertyIndexedKeyframes = {
    translate: [`0 ${cssValue('--reveal-distance') || '16px'}`, 'none'],
  }
  if (!el.matches(TEXT_BLOCKS)) keyframes.opacity = [0, 1]
  el.animate(keyframes, {
    duration: parseFloat(cssValue('--reveal-duration')) || 520,
    delay: step * STAGGER_MS,
    easing: easing(),
    fill: 'backwards',
  })
}

function enterPage() {
  const page = document.querySelector('main') ?? document.getElementById('root')?.firstElementChild
  page?.animate({ opacity: [0, 1] }, { duration: PAGE_FADE_MS, easing: easing() })
}

// Returns whether anything came in.
function enterHero() {
  const marked = document.querySelectorAll<HTMLElement>('main [data-enter]')
  if (marked.length > 0) {
    marked.forEach((el) => riseIn(el, Math.max(Number(el.dataset.enter) || 1, 1) - 1))
    return true
  }
  const title = document.querySelector('main h1')
  const lead = title?.nextElementSibling
  if (title) riseIn(title, 0)
  if (lead instanceof HTMLParagraphElement) riseIn(lead, 1)
  return title !== null
}

export function RouteMotion() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()
  const lastPathname = useRef<string | null>(null)

  // 1-3: where the page starts and how it comes in.
  useLayoutEffect(() => {
    const previous = lastPathname.current
    lastPathname.current = pathname
    if (previous === pathname) return // a hash-only change, or StrictMode's second run
    const navigated = previous !== null
    if (navigated && !hash && navigationType !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' })
    if (prefersReducedMotion() || isPlayer(pathname)) return
    try {
      // A page whose title comes in doesn't also fade as a whole: over a dark hero that would be a
      // dip to the white page background and back.
      const heroCameIn = !document.querySelector('[data-app-shell]') && enterHero()
      if (navigated && !heroCameIn) enterPage()
    } catch (error) {
      console.warn('RouteMotion: the page entrance was skipped', error)
    }
  }, [pathname, hash, navigationType])

  // 4: scroll-reveal.
  useLayoutEffect(() => {
    if (prefersReducedMotion() || isPlayer(pathname) || !('IntersectionObserver' in window)) return
    if (document.querySelector('[data-app-shell]')) return

    try {
      // A block that starts inside the viewport is never hidden, so a page too short to scroll
      // can't leave one waiting for a scroll that never comes.
      const fold = window.innerHeight
      const pending: HTMLElement[] = []
      document.querySelectorAll<HTMLElement>(REVEAL_TARGETS).forEach((el) => {
        const state = el.dataset.revealState
        if (state === 'done' || el.hidden || el.parentElement?.closest(NEVER_SEEN)) return
        // Already pending: StrictMode ran the effect twice and the first observer is gone.
        if (state !== 'pending' && el.getBoundingClientRect().top < fold) return
        el.dataset.revealState = 'pending'
        // These only fade: anchor targets (scrollIntoView aligns the box as it is, shifted or not)
        // and blocks whose children already rise (a double rise reads as one long, heavy move).
        if (el.id || el.querySelector('[data-stagger]')) el.dataset.revealFade = ''
        pending.push(el)
      })
      if (pending.length === 0) return

      document.documentElement.dataset.motion = 'on'
      const reveal = (el: HTMLElement, step: number) => {
        el.style.setProperty('--reveal-delay', `${Math.min(step, MAX_STAGGER_STEPS) * STAGGER_MS}ms`)
        el.dataset.revealState = 'done'
        observer.unobserve(el)
      }
      // No margin on the observer's root: a margin would leave a band inside the viewport that
      // the observer can't see, and a block focused or found there would stay invisible.
      const observer = new IntersectionObserver((entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left,
          )
          .forEach((entry, index) => reveal(entry.target as HTMLElement, index))
      })
      pending.forEach((el) => observer.observe(el))
      // Keyboard focus reveals the block it lands in right away, instead of waiting for the browser
      // to scroll it into view (a smooth scroll: the focus ring would be invisible meanwhile).
      const onFocusIn = (event: FocusEvent) => {
        let block = (event.target as Element).closest<HTMLElement>('[data-reveal-state="pending"]')
        while (block) {
          reveal(block, 0)
          block = block.parentElement?.closest<HTMLElement>('[data-reveal-state="pending"]') ?? null
        }
      }
      document.addEventListener('focusin', onFocusIn)
      return () => {
        document.removeEventListener('focusin', onFocusIn)
        observer.disconnect()
      }
    } catch (error) {
      console.warn('RouteMotion: the scroll reveal was skipped', error)
      // Never leave content hidden with no observer left to show it.
      document.querySelectorAll<HTMLElement>('[data-reveal-state="pending"]').forEach((el) => {
        delete el.dataset.revealState
      })
    }
  }, [pathname])

  return null
}
