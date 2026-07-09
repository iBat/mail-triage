import { z } from 'zod'

export const LABELS = ['urgent', 'normal', 'newsletter'] as const
export type Label = (typeof LABELS)[number]

// Wire schema mirrors the n8n contract: summary is always present,
// empty string for non-urgent. Keeping it a required string (not optional)
// keeps the schema strict-friendly for both providers.
export const ClassificationSchema = z.object({
  label: z.enum(LABELS),
  summary: z
    .string()
    .describe('One sentence in English when label is "urgent"; empty string otherwise.'),
})
export type Classification = z.infer<typeof ClassificationSchema>

export interface EmailInput {
  id: string
  subject: string
  snippet: string
  body?: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export interface ClassifiedResult {
  label: Label
  summary?: string
  usage: Usage
  latencyMs: number
}

export interface Classifier {
  name: string
  classify(e: EmailInput): Promise<ClassifiedResult>
}

export function toResult(c: Classification, usage: Usage, latencyMs: number): ClassifiedResult {
  return { label: c.label, summary: c.summary || undefined, usage, latencyMs }
}
