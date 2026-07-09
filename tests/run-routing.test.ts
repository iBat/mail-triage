import { describe, expect, it, vi } from 'vitest'
import { makeClassifier } from '../evals/run.js'

// vi.mock is hoisted and applies to the whole file — these routing tests live
// in their own file so tests/run.test.ts keeps exercising the real modules.
vi.mock('../src/classifier/anthropic.js', () => ({
  anthropicClassifier: vi.fn(() => ({ name: 'anthropic-fake', classify: vi.fn() })),
}))
vi.mock('../src/classifier/openai.js', () => ({
  openaiClassifier: vi.fn(() => ({ name: 'openai-fake', classify: vi.fn() })),
}))
vi.mock('../src/prompts.js', () => ({
  loadPrompt: vi.fn(() => 'fake system prompt'),
}))

describe('makeClassifier', () => {
  it('routes claude-* models to the Anthropic classifier', () => {
    expect(makeClassifier('claude-haiku-4-5', 'v1', 'snippet').name).toBe('anthropic-fake')
  })

  it('routes everything else to the OpenAI classifier', () => {
    expect(makeClassifier('gpt-5-mini', 'v1', 'snippet').name).toBe('openai-fake')
  })
})
