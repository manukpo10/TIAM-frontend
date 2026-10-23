import type { ReactNode } from 'react'
import { Mail } from 'lucide-react'
import { Card } from './PackShell'
import { EMAIL_NOTICE } from './emailNoticeCopy'

/**
 * "Te mandamos también los archivos por mail... revisá Spam": an info card (the blue tint of the Pack pages,
 * the Mail icon) shown once the payment is confirmed. The copy lives in emailNoticeCopy.ts. Children go under the text
 * (the thank-you page puts its link to the downloads page there).
 */
export function EmailNotice({ children }: { children?: ReactNode }) {
  return (
    <Card className="border-tiam-blue/30 bg-tiam-blue/5">
      <div role="note" className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden />
        <div className="text-slate-700">
          <p className="font-semibold text-slate-900">{EMAIL_NOTICE.title}</p>
          <p className="mt-1 leading-relaxed">{EMAIL_NOTICE.body}</p>
          {children}
        </div>
      </div>
    </Card>
  )
}
