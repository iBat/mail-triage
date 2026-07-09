import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { openaiClassifier } from '../../src/classifier/openai.js'

function stubClient(outputParsed: unknown, extra: Record<string, unknown> = {}) {
  return {
    responses: {
      parse: vi.fn().mockResolvedValue({
        output_parsed: outputParsed,
        usage: { input_tokens: 120, output_tokens: 25 },
        status: 'completed',
        ...extra,
      }),
    },
  } as unknown as OpenAI
}

const email = { id: 'm2', subject: 'Weekly digest', snippet: 'news of the week' }

describe('openaiClassifier', () => {
  it('returns a ClassifiedResult and normalizes empty summary', async () => {
    const client = stubClient({ label: 'newsletter', summary: '' })
    const c = openaiClassifier({ model: 'gpt-5-mini', systemPrompt: 'sys', inputVariant: 'snippet', client })
    const r = await c.classify(email)
    expect(r.label).toBe('newsletter')
    expect(r.summary).toBeUndefined()
    expect(r.usage).toEqual({ inputTokens: 120, outputTokens: 25 })
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('passes model, instructions, rendered input, and the structured-output format', async () => {
    const client = stubClient({ label: 'normal', summary: '' })
    const c = openaiClassifier({ model: 'gpt-5-mini', systemPrompt: 'sys prompt', inputVariant: 'snippet', client })
    await c.classify(email)
    const call = (client.responses.parse as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.model).toBe('gpt-5-mini')
    expect(call.instructions).toBe('sys prompt')
    expect(call.input).toBe('Subject: Weekly digest\nSnippet: news of the week')
    expect(call.text.format.type).toBe('json_schema')
    expect(call.text.format.name).toBe('classification')
  })

  it('throws with diagnostics when output_parsed is null (e.g. incomplete response)', async () => {
    const client = stubClient(null, { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })
    const c = openaiClassifier({ model: 'gpt-5-mini', systemPrompt: 'sys', inputVariant: 'snippet', client })
    await expect(c.classify(email)).rejects.toThrow(/parse failed.*incomplete.*max_output_tokens/)
  })

  it('propagates SDK errors unchanged', async () => {
    const client = {
      responses: { parse: vi.fn().mockRejectedValue(new Error('rate limited')) },
    } as unknown as OpenAI
    const c = openaiClassifier({ model: 'gpt-5-mini', systemPrompt: 'sys', inputVariant: 'snippet', client })
    await expect(c.classify(email)).rejects.toThrow('rate limited')
  })
})
