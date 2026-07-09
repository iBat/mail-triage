import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { ClassificationSchema, toResult, type ClassifiedResult, type Classifier, type EmailInput } from '../types.js'
import { renderEmail, type InputVariant } from '../render.js'

export interface OpenAIClassifierOptions {
  model: string
  systemPrompt: string
  inputVariant: InputVariant
  client?: OpenAI
}

export function openaiClassifier(opts: OpenAIClassifierOptions): Classifier {
  // Small classification calls: fail fast into the upstream fail-safe
  // instead of stalling the batch on the SDK's long default timeout.
  const client = opts.client ?? new OpenAI({ timeout: 60_000 })
  return {
    name: opts.model,
    async classify(e: EmailInput): Promise<ClassifiedResult> {
      const started = performance.now()
      // No max_output_tokens / reasoning.effort overrides: the n8n production
      // baseline ran gpt-5-mini with provider defaults, and the eval baseline
      // must reproduce that configuration. Revisit as a separate experiment
      // (reasoning effort is a cost/latency knob, not a free win).
      const response = await client.responses.parse({
        model: opts.model,
        instructions: opts.systemPrompt,
        input: renderEmail(e, opts.inputVariant),
        text: { format: zodTextFormat(ClassificationSchema, 'classification') },
      })
      // Wall-clock latency including SDK retries/backoff — as the caller experienced it.
      const latencyMs = Math.round(performance.now() - started)
      if (!response.output_parsed) {
        // OpenAI sets output_parsed = null WITHOUT throwing on incomplete
        // responses (e.g. token truncation) — surface the reason explicitly.
        throw new Error(
          `openai structured output parse failed for email ${e.id} ` +
          `(status: ${response.status}, reason: ${response.incomplete_details?.reason ?? 'unknown'})`,
        )
      }
      // A synchronous completed response always carries usage; the `?? 0` only
      // satisfies the SDK's optional typing (streaming/background states this code never produces).
      return toResult(response.output_parsed, {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      }, latencyMs)
    },
  }
}
