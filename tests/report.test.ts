import { describe, expect, it } from 'vitest'
import { reportTable } from '../evals/report.js'
import { buildRunResult, type EvalCaseOutcome } from '../evals/run.js'

const outcomes: EvalCaseOutcome[] = [
  { id: 'a', expected: 'urgent', predicted: 'urgent', latencyMs: 100, usage: { inputTokens: 100, outputTokens: 10 } },
  { id: 'b', expected: 'newsletter', predicted: 'newsletter', latencyMs: 200, usage: { inputTokens: 100, outputTokens: 10 } },
]

describe('reportTable', () => {
  it('renders one markdown row per run', () => {
    const run = buildRunResult({ dataset: 'sample', model: 'gpt-5-mini', promptVersion: 'v1', inputVariant: 'snippet' }, outcomes)
    const table = reportTable([run])
    expect(table).toContain('| model |')
    expect(table).toContain('| gpt-5-mini | v1 | snippet | sample | 100.0% | 100.0% | 100.0% |')
  })

  it('renders n/a for null newsletter precision', () => {
    const run = buildRunResult(
      { dataset: 'sample', model: 'gpt-5-mini', promptVersion: 'v1', inputVariant: 'snippet' },
      [{ id: 'a', expected: 'urgent', predicted: 'urgent', latencyMs: 10, usage: { inputTokens: 1, outputTokens: 1 } }],
    )
    expect(reportTable([run])).toContain('n/a')
  })

  it('renders an empty-state message when there are no runs', () => {
    expect(reportTable([])).toContain('No eval runs found')
  })
})
