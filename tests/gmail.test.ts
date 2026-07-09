import { describe, expect, it } from 'vitest'
import { extractPlainText, toEmailInput } from '../src/gmail.js'

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
})
