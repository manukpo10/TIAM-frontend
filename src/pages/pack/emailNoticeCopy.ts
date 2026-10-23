/**
 * The copy of the "también te lo mandamos por mail" notice of the thank-you page (tests/email-notice.test.ts). Not named emailNotice.ts: it would differ from EmailNotice.tsx only in casing.
 *
 * Why it exists: some mailboxes (Yahoo) file the delivery email in Spam and disable its links until the buyer marks it
 * as "No es spam". The email says the same thing in its first lines. Plain voseo, no technical words.
 */
export const EMAIL_NOTICE = {
  title: 'Revisá tu correo',
  body: 'Te mandamos también los archivos por mail. Si no lo ves, revisá la carpeta de Spam o Correo no deseado, y marcalo como "No es spam" para que funcionen los enlaces.',
} as const
