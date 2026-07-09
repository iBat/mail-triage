// USD per 1M tokens. Verified 2026-07-09 against:
//   OpenAI:    https://developers.openai.com/api/docs/models/gpt-5-mini
//              (gpt-5-mini is active, not deprecated; not shown on the
//              aggregate https://developers.openai.com/api/docs/pricing table,
//              which currently spotlights the gpt-5.4/5.5 generation, but its
//              own model page confirms $0.25 / $2.00, cached input $0.025)
//   Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
//              (docs.claude.com redirects here)
// claude-sonnet-5 uses intro pricing through 2026-08-31 (standard: $3/$15).
// Re-verify before publishing README numbers.
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gpt-5-mini': { input: 0.25, output: 2.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
}

export function costUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): number {
  const p = PRICES_PER_MTOK[model]
  if (!p) return 0
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000
}
