import { describe, expect, it } from 'vitest'
import { shouldMarkAsRead, selectUrgent, type ProcessedEmail } from '../src/pipeline.js'

const email = { id: 'e1', subject: 's', snippet: 'p' }
const ok = (label: 'urgent' | 'normal' | 'newsletter', summary?: string): ProcessedEmail => ({
  email,
  result: { label, summary, usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 1 },
})
const failed: ProcessedEmail = { email, result: null, error: 'timeout' }

describe('shouldMarkAsRead (spec fail-safe)', () => {
  it('true only for successfully parsed newsletter', () => {
    expect(shouldMarkAsRead(ok('newsletter'))).toBe(true)
  })

  it('false for urgent and normal', () => {
    expect(shouldMarkAsRead(ok('urgent', 'x'))).toBe(false)
    expect(shouldMarkAsRead(ok('normal'))).toBe(false)
  })

  it('false when classification failed — the email must stay unread', () => {
    expect(shouldMarkAsRead(failed)).toBe(false)
  })
})

describe('selectUrgent', () => {
  it('collects urgent results with their summaries', () => {
    const urgent = selectUrgent([ok('urgent', 'Fire!'), ok('normal'), failed])
    expect(urgent).toEqual([{ email, summary: 'Fire!' }])
  })

  it('treats failed classification as normal: not urgent, no digest entry', () => {
    expect(selectUrgent([failed])).toEqual([])
  })
})
