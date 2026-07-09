import { describe, expect, it } from 'vitest'
import { PRICES_PER_MTOK, costUsd } from '../evals/prices.js'

describe('prices', () => {
  it('has prices for exactly the three candidate models', () => {
    expect(Object.keys(PRICES_PER_MTOK).sort()).toEqual([
      'claude-haiku-4-5',
      'claude-sonnet-5',
      'gpt-5-mini',
    ])
  })

  it('computes cost from usage', () => {
    // Asymmetric counts so an input/output price swap fails the test:
    // (200_000 * $0.25 + 10_000 * $2.00) / 1e6 = (50_000 + 20_000) / 1e6 = $0.07
    // (swapped it would be (200_000 * $2.00 + 10_000 * $0.25) / 1e6 = $0.4025)
    expect(costUsd('gpt-5-mini', { inputTokens: 200_000, outputTokens: 10_000 })).toBeCloseTo(0.07)
  })

  it('returns 0 for unknown model instead of throwing', () => {
    expect(costUsd('unknown-model', { inputTokens: 1000, outputTokens: 1000 })).toBe(0)
  })
})
