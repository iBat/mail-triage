import type { EmailInput } from './types.js'

export type InputVariant = 'snippet' | 'body'

export const DEFAULT_BODY_CHARS = 2000

export function renderEmail(e: EmailInput, variant: InputVariant, bodyChars = DEFAULT_BODY_CHARS): string {
  const base = `Subject: ${e.subject}\nSnippet: ${e.snippet}`
  // Empty body is deliberately treated as absent: fall back to the snippet-only shape.
  if (variant === 'body' && e.body) {
    return `${base}\nBody:\n${e.body.slice(0, bodyChars)}`
  }
  return base
}
