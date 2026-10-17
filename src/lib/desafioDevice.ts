const STORAGE_KEY = 'tiam_desafio_device'
const VALID_ID = /^[A-Za-z0-9-]{16,64}$/

/**
 * Anonymous random id of this browser, sent when the Desafío player opens so the backend can count how many
 * devices open each purchase's link (measurement only: it never blocks access, see ChallengeDeviceService).
 * No personal data and no fingerprinting: just a random value kept in this browser's storage.
 *
 * Returns null when storage is unavailable (private mode, blocked storage): sending a fresh id on every visit
 * would count the same person as many devices, so nothing is sent instead.
 */
export function desafioDeviceId(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && VALID_ID.test(saved)) return saved
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : randomHex()
    localStorage.setItem(STORAGE_KEY, id)
    return localStorage.getItem(STORAGE_KEY) === id ? id : null
  } catch {
    return null
  }
}

/** 32 hex chars from the CSPRNG, for the rare browser without crypto.randomUUID. */
function randomHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}
