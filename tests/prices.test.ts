import { describe, expect, it } from 'vitest'
import { PRICES_PER_MTOK, costUsd } from '../evals/prices.js'

describe('prices', () => {
  it('has prices for all three candidate models', () => {
    for (const model of ['gpt-5-mini', 'claude-haiku-4-5', 'claude-sonnet-5']) {
      expect(PRICES_PER_MTOK[model]).toBeDefined()
    }
  })

  it('computes cost from usage', () => {
    // 1M input + 1M output at $0.25/$2.00 = $2.25
    expect(costUsd('gpt-5-mini', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(2.25)
  })

  it('returns 0 for unknown model instead of throwing', () => {
    expect(costUsd('unknown-model', { inputTokens: 1000, outputTokens: 1000 })).toBe(0)
  })
})
