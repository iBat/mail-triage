import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { anthropicClassifier } from '../../src/classifier/anthropic.js'

function stubClient(parsedOutput: unknown, stopReason = 'end_turn') {
  return {
    messages: {
      parse: vi.fn().mockResolvedValue({
        parsed_output: parsedOutput,
        stop_reason: stopReason,
        usage: { input_tokens: 150, output_tokens: 30 },
      }),
    },
  } as unknown as Anthropic
}

const email = { id: 'm1', subject: 'Server down', snippet: 'prod is on fire' }

describe('anthropicClassifier', () => {
  it('returns a ClassifiedResult with usage and latency', async () => {
    const client = stubClient({ label: 'urgent', summary: 'Production is down.' })
    const c = anthropicClassifier({ model: 'claude-haiku-4-5', systemPrompt: 'sys', inputVariant: 'snippet', client })
    const r = await c.classify(email)
    expect(r.label).toBe('urgent')
    expect(r.summary).toBe('Production is down.')
    expect(r.usage).toEqual({ inputTokens: 150, outputTokens: 30 })
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('passes model, system prompt, and rendered input to the API', async () => {
    const client = stubClient({ label: 'normal', summary: '' })
    const c = anthropicClassifier({ model: 'claude-haiku-4-5', systemPrompt: 'sys prompt', inputVariant: 'snippet', client })
    await c.classify(email)
    const call = (client.messages.parse as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.model).toBe('claude-haiku-4-5')
    expect(call.system).toBe('sys prompt')
    expect(call.messages[0].content).toBe('Subject: Server down\nSnippet: prod is on fire')
    expect(call.max_tokens).toBe(1024)
    // Pin the structured-output contract produced by zodOutputFormat(ClassificationSchema).
    expect(call.output_config.format.type).toBe('json_schema')
    expect(call.output_config.format.schema.required).toEqual(['label', 'summary'])
  })

  it('throws when parsed_output is null (fail-safe upstream treats it as normal)', async () => {
    const client = stubClient(null, 'refusal')
    const c = anthropicClassifier({ model: 'claude-haiku-4-5', systemPrompt: 'sys', inputVariant: 'snippet', client })
    await expect(c.classify(email)).rejects.toThrow(/parse failed/)
    await expect(c.classify(email)).rejects.toThrow(/stop_reason: refusal/)
  })

  it('propagates API errors from messages.parse', async () => {
    const client = {
      messages: { parse: vi.fn().mockRejectedValue(new Error('rate limited')) },
    } as unknown as Anthropic
    const c = anthropicClassifier({ model: 'claude-haiku-4-5', systemPrompt: 'sys', inputVariant: 'snippet', client })
    await expect(c.classify(email)).rejects.toThrow('rate limited')
  })
})
