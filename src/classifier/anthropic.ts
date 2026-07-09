import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ClassificationSchema, toResult, type ClassifiedResult, type Classifier, type EmailInput } from '../types.js'
import { renderEmail, type InputVariant } from '../render.js'

export interface AnthropicClassifierOptions {
  model: string
  systemPrompt: string
  inputVariant: InputVariant
  client?: Anthropic
}

export function anthropicClassifier(opts: AnthropicClassifierOptions): Classifier {
  const client = opts.client ?? new Anthropic()
  return {
    name: opts.model,
    async classify(e: EmailInput): Promise<ClassifiedResult> {
      const started = performance.now()
      const response = await client.messages.parse({
        model: opts.model,
        max_tokens: 1024,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: renderEmail(e, opts.inputVariant) }],
        output_config: { format: zodOutputFormat(ClassificationSchema) },
      })
      const latencyMs = Math.round(performance.now() - started)
      if (!response.parsed_output) {
        throw new Error(`anthropic structured output parse failed for email ${e.id}`)
      }
      return toResult(
        response.parsed_output,
        {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        latencyMs,
      )
    },
  }
}
