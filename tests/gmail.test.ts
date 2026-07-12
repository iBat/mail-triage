import { afterEach, describe, expect, it, vi } from 'vitest'
import type { gmail_v1 } from 'googleapis'
import { extractPlainText, fetchRecentEmails, markAsRead, toEmailInput } from '../src/gmail.js'

const b64 = (s: string): string => Buffer.from(s).toString('base64url')

const message = {
  id: 'abc123',
  snippet: 'preview text',
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      { name: 'From', value: 'a@b.c' },
      { name: 'Subject', value: 'Test subject' },
    ],
    parts: [
      { mimeType: 'text/html', body: { data: b64('<b>html</b>') } },
      { mimeType: 'text/plain', body: { data: b64('plain text body') } },
    ],
  },
}

describe('toEmailInput', () => {
  it('extracts id, subject, snippet and plain-text body', () => {
    expect(toEmailInput(message)).toEqual({
      id: 'abc123',
      subject: 'Test subject',
      snippet: 'preview text',
      body: 'plain text body',
    })
  })

  it('tolerates a missing subject header', () => {
    const noSubject = { ...message, payload: { ...message.payload, headers: [] } }
    expect(toEmailInput(noSubject).subject).toBe('')
  })
})

describe('extractPlainText', () => {
  it('returns undefined when there is no text/plain part', () => {
    expect(extractPlainText({ mimeType: 'text/html', body: { data: b64('<p>x</p>') } })).toBeUndefined()
  })

  it('decodes a top-level text/plain body', () => {
    expect(extractPlainText({ mimeType: 'text/plain', body: { data: b64('hello') } })).toBe('hello')
  })

  it('skips text/plain attachments and returns the nested body', () => {
    const mixed = {
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', filename: 'notes.txt', body: { data: b64('attachment content') } },
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/html', body: { data: b64('<b>html</b>') } },
            { mimeType: 'text/plain', filename: '', body: { data: b64('actual body') } },
          ],
        },
      ],
    }
    expect(extractPlainText(mixed)).toBe('actual body')
  })
})

describe('fetchRecentEmails', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const listOnlyGmail = () => {
    const list = vi.fn().mockResolvedValue({ data: { messages: [] } })
    const gmail = { users: { messages: { list } } } as unknown as gmail_v1.Gmail
    return { gmail, list }
  }

  it('queries unread mail after now minus the window when unreadOnly is set', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T09:00:00Z'))
    const { gmail, list } = listOnlyGmail()
    await fetchRecentEmails(gmail, 24, true)
    const after = Math.floor(new Date('2026-07-12T09:00:00Z').getTime() / 1000) - 24 * 3600
    expect(list).toHaveBeenCalledExactlyOnceWith({
      userId: 'me',
      q: `is:unread after:${after}`,
      maxResults: 100,
      pageToken: undefined,
    })
  })

  it('fetches read and unread mail by default (dataset export needs both)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T09:00:00Z'))
    const { gmail, list } = listOnlyGmail()
    await fetchRecentEmails(gmail, 12)
    const after = Math.floor(new Date('2026-07-12T09:00:00Z').getTime() / 1000) - 12 * 3600
    expect(list).toHaveBeenCalledExactlyOnceWith({
      userId: 'me',
      q: `after:${after}`,
      maxResults: 100,
      pageToken: undefined,
    })
  })
})

describe('markAsRead', () => {
  it('removes the UNREAD label via messages.modify', async () => {
    const modify = vi.fn().mockResolvedValue({})
    const gmail = { users: { messages: { modify } } } as unknown as gmail_v1.Gmail
    await markAsRead(gmail, 'x')
    expect(modify).toHaveBeenCalledExactlyOnceWith({
      userId: 'me',
      id: 'x',
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  })
})
