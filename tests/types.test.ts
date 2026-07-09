import { describe, expect, it } from 'vitest'
import { ClassificationSchema, toResult } from '../src/types.js'

describe('ClassificationSchema', () => {
  it('accepts a valid classification', () => {
    expect(ClassificationSchema.parse({ label: 'urgent', summary: 'Server is down.' }))
      .toEqual({ label: 'urgent', summary: 'Server is down.' })
  })

  it('rejects unknown labels', () => {
    expect(() => ClassificationSchema.parse({ label: 'spam', summary: '' })).toThrow()
  })
})

describe('toResult', () => {
  it('normalizes empty summary to undefined (n8n empty-string convention)', () => {
    const r = toResult({ label: 'newsletter', summary: '' }, { inputTokens: 10, outputTokens: 5 }, 120)
    expect(r).toEqual({ label: 'newsletter', summary: undefined, usage: { inputTokens: 10, outputTokens: 5 }, latencyMs: 120 })
  })

  it('keeps non-empty summary', () => {
    const r = toResult({ label: 'urgent', summary: 'Pay now.' }, { inputTokens: 10, outputTokens: 5 }, 80)
    expect(r.summary).toBe('Pay now.')
  })
})
