/**
 * Shared contract test between this frontend and the backend (review item I-15). There is no test runner in this repo,
 * so the test is the compiler: `npm run build` runs `tsc -b`, which type-checks this file.
 *
 * The *.json files next to it are the backend's golden answers, copied verbatim from
 * backend `src/test/resources/contract/`. The backend's tests assert that its real controllers answer those exact
 * bytes, so a fixture is what the browser will really receive. Each check below ties one fixture to the TypeScript type
 * the pages use for it (packTypes.ts). It fails to compile when:
 *   - the backend renames, adds or drops a field (the fixture's keys stop matching the type's keys),
 *   - a field changes shape (string <-> number, null <-> object, array <-> object),
 *   - or a type here stops describing what the backend sends.
 *
 * When the backend changes a fixture: copy the files again, fix packTypes.ts, then follow the compiler errors.
 *
 * What this cannot see: TypeScript widens every string in an imported JSON file to `string`, so the exact values of
 * `status`, `edition` and `paper` are not checked here (a new status, say, still compiles). The pages cover that at run
 * time: an unknown status gets the calm "apenas se acredite te llega el email" screen, never a dead end.
 *
 * This file is never imported by the app: it only exists for the compiler and adds nothing to any bundle.
 */

import type { DownloadLink, OrderConfirmation, PackFile, PackItem, PackOrder, RegretReceipt } from '../packTypes'

import confirmPaid from './confirm-paid.json'
import confirmReview from './confirm-review.json'
import downloadLink from './download-link.json'
import orderFailed from './order-failed.json'
import orderPaid from './order-paid.json'
import orderPending from './order-pending.json'
import orderReview from './order-review.json'
import regretReceipt from './regret-receipt.json'
import resendAccepted from './resend-accepted.json'

/** Exact type equality (not just assignability). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/** The envelope every JSON answer comes in. packClient unwraps it and hands the pages `data`. */
interface Envelope {
  success: boolean
  data: unknown
  message: string | null
}

/** A type as the JSON file can show it: string unions become `string`, because that is all an imported JSON keeps. */
type Wire<T> = T extends string ? string : T extends readonly (infer U)[] ? Wire<U>[] : T extends object ? { [K in keyof T]: Wire<T[K]> } : T

/** The fixture has exactly the keys of the type, and each value fits the type's shape. */
type Matches<Fixture, Type> = Equal<keyof Fixture, keyof Type> extends true ? (Fixture extends Wire<Type> ? true : false) : false

export type ContractChecks = [
  // The envelope: { success, data, message } in every fixture.
  Expect<Equal<keyof typeof orderPaid, keyof Envelope>>,
  Expect<typeof orderPaid extends Envelope ? true : false>,
  Expect<typeof resendAccepted extends Envelope ? true : false>,

  // GET /packs/orders/{token}: one fixture per state the browser can see.
  Expect<Matches<typeof orderPaid.data, PackOrder>>,
  Expect<Matches<typeof orderPending.data, PackOrder>>,
  Expect<Matches<typeof orderReview.data, PackOrder>>,
  Expect<Matches<typeof orderFailed.data, PackOrder>>,
  // ...and the nested pieces of the paid one (items, files, games).
  Expect<Matches<(typeof orderPaid.data.items)[number], PackItem>>,
  Expect<Matches<(typeof orderPaid.data.items)[number]['files'][number], PackFile>>,
  Expect<Matches<NonNullable<typeof orderPaid.data.games>, NonNullable<PackOrder['games']>>>,

  // POST /packs/orders/{token}/confirm
  Expect<Matches<typeof confirmPaid.data, OrderConfirmation>>,
  Expect<Matches<typeof confirmReview.data, OrderConfirmation>>,

  // POST /packs/orders/{token}/files/{key}/link
  Expect<Matches<typeof downloadLink.data, DownloadLink>>,

  // POST /packs/regret: the constancia the buyer sees on screen.
  Expect<Matches<typeof regretReceipt.data, RegretReceipt>>,

  // POST /packs/access/resend: no data on purpose (the answer must not reveal whether the email bought).
  Expect<Equal<typeof resendAccepted.data, null>>,
]
