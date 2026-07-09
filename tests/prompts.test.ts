import { describe, expect, it } from 'vitest'
import { loadPrompt } from '../src/prompts.js'

describe('loadPrompt', () => {
  it('loads v1 (the n8n prompt without the id-echo artifact)', () => {
    const p = loadPrompt('v1')
    expect(p).toContain('You are an email classifier.')
    expect(p).not.toContain('echo the exact id')
  })

  it('v2-fewshot contains class definitions and examples', () => {
    const p = loadPrompt('v2-fewshot')
    expect(p).toContain('Definitions:')
    expect(p).toContain('Examples:')
  })

  it('throws on unknown version', () => {
    expect(() => loadPrompt('v999')).toThrow()
  })
})
