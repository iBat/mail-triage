import type { EmailInput } from './types.js'

export interface UrgentItem {
  email: EmailInput
  summary: string
}

export function buildUrgentDigest(items: UrgentItem[]): string {
  const lines = items
    .filter(i => i.summary)
    .map(i => `• ${i.summary} <a href="https://mail.google.com/mail/u/0/#all/${i.email.id}">link</a>`)
  return `${items.length} urgent email${items.length === 1 ? '' : 's'} this morning:\n\n` + lines.join('\n\n')
}
