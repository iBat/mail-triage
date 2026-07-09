import { describe, expect, it } from 'vitest'
import { loadPrompt } from '../src/prompts.js'
import { LABELS } from '../src/types.js'

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

  it.each(['v1', 'v2-fewshot'])('%s mentions every label from the schema', version => {
    const p = loadPrompt(version)
    for (const label of LABELS) expect(p).toContain(label)
  })

  it('throws on unknown version', () => {
    expect(() => loadPrompt('v999')).toThrow()
    expect(() => loadPrompt('v999')).toThrow(/v1/)
  })
})
