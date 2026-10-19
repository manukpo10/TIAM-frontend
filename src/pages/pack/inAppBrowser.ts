/**
 * Facebook, Instagram and Messenger open the links of an ad (and the page Mercado Pago sends the buyer back to) in
 * their own in-app browser. On iOS that window often cannot save files, so a buyer who comes back from paying can
 * tap "Descargar" and see nothing happen. The apps tell on themselves in the user agent:
 *
 *   FBAN, FBAV   Facebook and Messenger  ...[FBAN/FBIOS;FBAV/450.0.0.38.108;...]  ...[FBAN/MessengerForiOS;FBAV/...]
 *   FB_IAB       Facebook's browser on Android  ...[FB_IAB/FB4A;FBAV/443.0.0.30.109;]  (Messenger: FB_IAB/MESSENGER)
 *   FBIOS        Facebook for iOS  (FBAN/FBIOS)
 *   Instagram    Instagram on both systems  ...Mobile/21C62 Instagram 315.1.0.30.115 (iPhone14,5; iOS 17_2; ...)
 *   Messenger    Messenger builds that spell it out
 *
 * The markers are matched with their exact spelling, the way the apps write them: a loose, case-insensitive match
 * would only add false positives.
 */
const MARKERS = ['FBAN', 'FBAV', 'FB_IAB', 'FBIOS', 'Instagram', 'Messenger'] as const

export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return MARKERS.some((marker) => userAgent.includes(marker))
}
