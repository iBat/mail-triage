import type { EmailInput } from './types.js'

export interface UrgentItem {
  email: EmailInput
  summary: string
}

// The caller is expected to invoke this only when items.length > 0
// (the pipeline gates on urgent.length).
export function buildUrgentDigest(items: UrgentItem[]): string {
  const lines = items
    .filter(i => i.summary)
    // Parity note: summaries are inserted UNESCAPED into an HTML-parse_mode
    // message, exactly like the n8n Code node this ports. A summary containing
    // '<' or '&' will make Telegram reject the whole digest (400).
    // TODO(post-parity): HTML-escape the summary text (not the <a> template).
    .map(i => `• ${i.summary} <a href="https://mail.google.com/mail/u/0/#all/${i.email.id}">link</a>`)
  return `${items.length} urgent email${items.length === 1 ? '' : 's'} this morning:\n\n` + lines.join('\n\n')
}
