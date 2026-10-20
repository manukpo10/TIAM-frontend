// The scroll reveal of the plants (src/lib/reveal.ts) and its reduced-motion handling.
// The rules, in the order they are checked:
//  1. prefers-reduced-motion, or no IntersectionObserver: the plants show static, nothing is observed.
//  2. What starts inside the viewport (or above it) is never hidden: it shows static (the same rule as RouteMotion).
//  3. What starts below the fold waits ("pending") and grows ("done") the first time it enters the viewport; after that nothing is observed any more.
//  4. Anything that goes wrong leaves the plants visible: they are decoration and must never stay hidden.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { REDUCED_MOTION_QUERY, prefersReducedMotion, watchReveal, type RevealEnv, type RevealState } from '../src/lib/reveal.ts'

type Callback = (entries: Array<{ isIntersecting: boolean; target: unknown }>) => void

/** A fake IntersectionObserver that records what the code does with it and lets the test fire entries by hand. */
function fakeObserver() {
  const log = { created: 0, options: undefined as unknown, observed: [] as unknown[], unobserved: [] as unknown[], disconnected: 0 }
  let callback: Callback = () => {}
  class FakeObserver {
    constructor(cb: Callback, options?: unknown) {
      log.created += 1
      log.options = options
      callback = cb
    }
    observe(target: unknown) {
      log.observed.push(target)
    }
    unobserve(target: unknown) {
      log.unobserved.push(target)
    }
    disconnect() {
      log.disconnected += 1
    }
  }
  return { Ctor: FakeObserver as unknown as NonNullable<RevealEnv['IntersectionObserver']>, log, fire: (...entries: Array<{ isIntersecting: boolean; target: unknown }>) => callback(entries) }
}

const target = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ top, bottom }) })
const calm = (query: string) => ({ matches: query === REDUCED_MOTION_QUERY ? false : true })
const reduced = (query: string) => ({ matches: query === REDUCED_MOTION_QUERY })

function run(env: Partial<RevealEnv>, el = target(1200, 1400)) {
  const states: RevealState[] = []
  const stop = watchReveal(el, { viewportHeight: 800, matchMedia: calm, ...env }, (state) => states.push(state))
  return { states, stop, el }
}

describe('prefersReducedMotion', () => {
  it('asks the standard query and reports the answer', () => {
    assert.equal(REDUCED_MOTION_QUERY, '(prefers-reduced-motion: reduce)')
    assert.equal(prefersReducedMotion(reduced), true)
    assert.equal(prefersReducedMotion(calm), false)
  })
  it('assumes motion is allowed when the browser cannot answer', () => {
    assert.equal(prefersReducedMotion(undefined), false)
  })
  it('stays on the calm side when asking fails', () => {
    assert.equal(
      prefersReducedMotion(() => {
        throw new Error('boom')
      }),
      true,
    )
  })
})

describe('watchReveal under reduced motion or without IntersectionObserver', () => {
  it('shows the plants static, right away, and observes nothing', () => {
    const io = fakeObserver()
    const { states } = run({ matchMedia: reduced, IntersectionObserver: io.Ctor })
    assert.deepEqual(states, ['static'])
    assert.equal(io.log.created, 0)
  })
  it('shows them static when the browser has no IntersectionObserver', () => {
    const { states } = run({ IntersectionObserver: undefined })
    assert.deepEqual(states, ['static'])
  })
  it('gives back a cleanup that does nothing and does not throw', () => {
    const { stop } = run({ matchMedia: reduced })
    assert.doesNotThrow(() => stop())
  })
})

describe('watchReveal with motion allowed', () => {
  it('never hides what starts inside the viewport', () => {
    const io = fakeObserver()
    const { states } = run({ IntersectionObserver: io.Ctor }, target(300, 500))
    assert.deepEqual(states, ['static'])
    assert.equal(io.log.created, 0)
  })
  it('never hides what starts partly inside the viewport (its top edge is above the fold)', () => {
    const { states } = run({ IntersectionObserver: fakeObserver().Ctor }, target(700, 900))
    assert.deepEqual(states, ['static'])
  })
  it('never hides what is above the viewport (a scroll position that was restored)', () => {
    const { states } = run({ IntersectionObserver: fakeObserver().Ctor }, target(-900, -500))
    assert.deepEqual(states, ['static'])
  })
  it('waits below the fold, then grows once when it enters the viewport', () => {
    const io = fakeObserver()
    const { states, el } = run({ IntersectionObserver: io.Ctor })
    assert.deepEqual(states, ['pending'])
    assert.deepEqual(io.log.observed, [el])
    io.fire({ isIntersecting: false, target: el })
    assert.deepEqual(states, ['pending'], 'not yet')
    io.fire({ isIntersecting: true, target: el })
    assert.deepEqual(states, ['pending', 'done'])
  })
  it('stops observing after the first time: it grows once, it does not replay on every scroll', () => {
    const io = fakeObserver()
    const { states, el } = run({ IntersectionObserver: io.Ctor })
    io.fire({ isIntersecting: true, target: el })
    assert.deepEqual(io.log.unobserved, [el])
    assert.equal(io.log.disconnected, 1)
    io.fire({ isIntersecting: true, target: el })
    assert.deepEqual(states, ['pending', 'done'], 'no second "done"')
  })
  it('asks the observer for a partly visible element, with no root margin (a margin would leave a band where a visible block stays hidden)', () => {
    const io = fakeObserver()
    run({ IntersectionObserver: io.Ctor })
    const options = io.log.options as { threshold?: number; rootMargin?: string }
    assert.ok(options.threshold !== undefined && options.threshold > 0 && options.threshold <= 0.5, `threshold ${options.threshold}`)
    assert.equal(options.rootMargin, undefined)
  })
  it('the cleanup disconnects the observer and ignores what arrives later', () => {
    const io = fakeObserver()
    const { states, stop, el } = run({ IntersectionObserver: io.Ctor })
    stop()
    assert.equal(io.log.disconnected, 1)
    io.fire({ isIntersecting: true, target: el })
    assert.deepEqual(states, ['pending'])
  })
})

describe('watchReveal when something goes wrong', () => {
  it('leaves the plants visible if the observer cannot be created', () => {
    const Broken = class {
      constructor() {
        throw new Error('no observer for you')
      }
    } as unknown as NonNullable<RevealEnv['IntersectionObserver']>
    const { states } = run({ IntersectionObserver: Broken })
    assert.deepEqual(states, ['static'])
  })
  it('leaves the plants visible if the element cannot be measured', () => {
    const io = fakeObserver()
    const broken = {
      getBoundingClientRect: () => {
        throw new Error('detached')
      },
    }
    const { states } = run({ IntersectionObserver: io.Ctor }, broken as unknown as ReturnType<typeof target>)
    assert.deepEqual(states, ['static'])
    assert.equal(io.log.created, 0)
  })
})
