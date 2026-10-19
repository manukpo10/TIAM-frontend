import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { contact } from './contact'

/** Link to the contact the Pack publishes (see contact.ts). Pass `className` to style it as a button. */
export function ContactLink({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <a
      href={contact.href}
      {...(contact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(!className && 'font-medium text-tiam-blue underline underline-offset-2', className)}
    >
      {children ?? contact.label}
    </a>
  )
}
