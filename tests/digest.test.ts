import { describe, expect, it } from 'vitest'
import { buildUrgentDigest } from '../src/digest.js'

describe('buildUrgentDigest', () => {
  it('matches the n8n digest format', () => {
    const text = buildUrgentDigest([
      { email: { id: 'id1', subject: 's', snippet: 'p' }, summary: 'Server is down.' },
      { email: { id: 'id2', subject: 's', snippet: 'p' }, summary: 'Invoice overdue.' },
    ])
    expect(text).toBe(
      '2 urgent emails this morning:\n\n' +
      '• Server is down. <a href="https://mail.google.com/mail/u/0/#all/id1">link</a>\n\n' +
      '• Invoice overdue. <a href="https://mail.google.com/mail/u/0/#all/id2">link</a>',
    )
  })

  it('uses singular for one email', () => {
    const text = buildUrgentDigest([{ email: { id: 'id1', subject: 's', snippet: 'p' }, summary: 'X.' }])
    expect(text.startsWith('1 urgent email this morning:')).toBe(true)
  })

  it('counts items without summary but omits their lines (n8n parity)', () => {
    const text = buildUrgentDigest([
      { email: { id: 'id1', subject: 's', snippet: 'p' }, summary: 'X.' },
      { email: { id: 'id2', subject: 's', snippet: 'p' }, summary: '' },
    ])
    expect(text.startsWith('2 urgent emails')).toBe(true)
    expect(text).not.toContain('id2')
  })
})
