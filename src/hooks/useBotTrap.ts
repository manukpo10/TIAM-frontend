import { useEffect, useRef, useState } from 'react'

/**
 * Bot traps for the public lead forms (POST /leads). Bots filled those forms with random names and dotted
 * Gmail addresses, so the backend (LeadService) silently drops a submission whose hidden honeypot comes filled
 * in or that was sent faster than a person could fill the form. Render <HoneypotField> with `website` /
 * `setWebsite` and send `trapFields()` along with the payload.
 */
export function useBotTrap() {
  const [website, setWebsite] = useState('')
  const shownAt = useRef(0)

  // performance.now() is monotonic: a clock adjustment while the form is open can't shrink the measure.
  useEffect(() => {
    shownAt.current = performance.now()
  }, [])

  return {
    website,
    setWebsite,
    trapFields: () => ({ website, elapsedMs: Math.round(performance.now() - shownAt.current) }),
  }
}
