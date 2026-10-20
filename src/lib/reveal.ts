/**
 * The scroll reveal of the plants: they grow the first time their section enters the viewport. Pure logic (no React, no DOM types), with its tests in
 * tests/reveal.test.ts (`npm test`); the hook that uses it is hooks/useReveal.ts and the CSS side is the "Plantas" block of index.css.
 *
 * It reports a state to the caller, which writes it on the element as `data-grow`:
 *  - `static`  shown as it is, no motion. Under prefers-reduced-motion, without IntersectionObserver, for what starts inside or above the viewport, and whenever
 *              something goes wrong: the plants are decoration and must never be left hidden (the same rule as RouteMotion).
 *  - `pending` below the fold: hidden by the CSS until it is seen.
 *  - `done`    it entered the viewport: the CSS plays the growth once. The observer is gone after that.
 * Only `opacity`, `scale`, `translate` and `rotate` are animated (all compositor-friendly), and the boxes keep their size in every state: nothing shifts.
 */

export type RevealState = 'static' | 'pending' | 'done'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export interface RevealEnv {
  /** `window.matchMedia`; absent in an old browser. */
  matchMedia?: (query: string) => { matches: boolean }
  /** `window.IntersectionObserver`; absent in an old browser. */
  IntersectionObserver?: new (
    callback: (entries: Array<{ isIntersecting: boolean; target: unknown }>) => void,
    options?: { threshold?: number },
  ) => { observe(target: unknown): void; unobserve(target: unknown): void; disconnect(): void }
  /** `window.innerHeight`. */
  viewportHeight: number
}

export interface RevealTarget {
  getBoundingClientRect(): { top: number; bottom: number }
}

/** Reduced motion is respected; when the browser cannot answer the query it is assumed that motion is allowed, and when asking fails it stays on the calm side. */
export function prefersReducedMotion(matchMedia?: RevealEnv['matchMedia']): boolean {
  if (!matchMedia) return false
  try {
    return matchMedia(REDUCED_MOTION_QUERY).matches
  } catch {
    return true
  }
}

/** A quarter of the element is enough to start the growth. No root margin: a margin leaves a band inside the viewport where a visible block would stay hidden. */
const OBSERVER_OPTIONS = { threshold: 0.25 }

/**
 * Watches `target` and reports its state through `onState`. Returns the cleanup (disconnects the observer; whatever arrives later is ignored).
 */
export function watchReveal(target: RevealTarget & object, env: RevealEnv, onState: (state: RevealState) => void): () => void {
  const { IntersectionObserver: Observer } = env
  if (prefersReducedMotion(env.matchMedia) || !Observer) {
    onState('static')
    return () => {}
  }

  let observer: InstanceType<NonNullable<RevealEnv['IntersectionObserver']>> | undefined
  let stopped = false
  try {
    // What starts inside the viewport, or above it, is never hidden: a short page could leave a plant waiting for a scroll that never comes.
    if (target.getBoundingClientRect().top < env.viewportHeight) {
      onState('static')
      return () => {}
    }
    observer = new Observer((entries) => {
      if (stopped || !entries.some((entry) => entry.isIntersecting)) return
      stopped = true
      observer?.unobserve(target)
      observer?.disconnect()
      onState('done')
    }, OBSERVER_OPTIONS)
    observer.observe(target)
    onState('pending')
  } catch {
    observer?.disconnect()
    stopped = true
    onState('static')
    return () => {}
  }

  return () => {
    stopped = true
    observer?.disconnect()
  }
}
