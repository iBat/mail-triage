import { google, type gmail_v1 } from 'googleapis'
import type { EmailInput } from './types.js'

export interface GmailCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export function gmailService(creds: GmailCredentials): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2(creds.clientId, creds.clientSecret)
  auth.setCredentials({ refresh_token: creds.refreshToken })
  return google.gmail({ version: 'v1', auth })
}

export async function fetchRecentEmails(gmail: gmail_v1.Gmail, hours = 12): Promise<EmailInput[]> {
  const after = Math.floor(Date.now() / 1000) - hours * 3600
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q: `after:${after}`, maxResults: 100, pageToken })
    for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id)
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  const emails: EmailInput[] = []
  for (const id of ids) {
    const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
    emails.push(toEmailInput(res.data))
  }
  return emails
}

export function toEmailInput(msg: gmail_v1.Schema$Message): EmailInput {
  const headers = msg.payload?.headers ?? []
  const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value ?? ''
  return { id: msg.id ?? '', subject, snippet: msg.snippet ?? '', body: extractPlainText(msg.payload) }
}

export function extractPlainText(part: gmail_v1.Schema$MessagePart | undefined): string | undefined {
  if (!part) return undefined
  // A truthy filename marks the part as an attachment, not the message body.
  if (part.mimeType === 'text/plain' && part.body?.data && !part.filename) {
    // TODO: charset — decodes as UTF-8 only; non-UTF8 parts (e.g. windows-1251) will garble. Known v1 limitation.
    return Buffer.from(part.body.data, 'base64url').toString('utf8')
  }
  for (const child of part.parts ?? []) {
    const text = extractPlainText(child)
    if (text) return text
  }
  return undefined
}

export async function markAsRead(gmail: gmail_v1.Gmail, id: string): Promise<void> {
  await gmail.users.messages.modify({ userId: 'me', id, requestBody: { removeLabelIds: ['UNREAD'] } })
}
