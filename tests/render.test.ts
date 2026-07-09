import { describe, expect, it } from 'vitest'
import { renderEmail } from '../src/render.js'

const email = { id: 'x1', subject: 'Hello', snippet: 'short preview', body: 'B'.repeat(3000) }

describe('renderEmail', () => {
  it('snippet variant matches the n8n input shape (minus Id)', () => {
    expect(renderEmail(email, 'snippet')).toBe('Subject: Hello\nSnippet: short preview')
  })

  it('body variant appends body truncated to 2000 chars by default', () => {
    const out = renderEmail(email, 'body')
    expect(out.startsWith('Subject: Hello\nSnippet: short preview\nBody:\n')).toBe(true)
    expect(out.length).toBe('Subject: Hello\nSnippet: short preview\nBody:\n'.length + 2000)
  })

  it('body variant without body falls back to snippet shape', () => {
    expect(renderEmail({ id: 'x2', subject: 'S', snippet: 'p' }, 'body')).toBe('Subject: S\nSnippet: p')
  })
})
