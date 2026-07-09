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
    // Derivation from the fixture (gpt-5-mini: $0.25/MTok in, $2.00/MTok out):
    // - accuracy / urgent recall / newsletter precision: both cases correct -> 100.0% each
    // - cost per case = (100*0.25 + 10*2.00)/1e6 = $0.000045; total $0.00009 over 2 cases;
    //   costUsdPer1000 = 0.00009/2*1000 = 0.045, whose nearest double is 0.045000000000000005,
    //   so toFixed(2) rounds UP -> '$0.05' (not '$0.04')
    // - latencies [100, 200], nearest-rank percentile (evals/grade.ts): p50 = 100, p95 = 200
    // - errors = 0
    expect(table).toContain('| gpt-5-mini | v1 | snippet | sample | 100.0% | 100.0% | 100.0% | $0.05 | 100 | 200 | 0 |')
  })

  it('sorts rows deterministically by dataset when model/prompt/input tie', () => {
    const sample = buildRunResult({ dataset: 'sample', model: 'gpt-5-mini', promptVersion: 'v1', inputVariant: 'snippet' }, outcomes)
    const real = buildRunResult({ dataset: 'real', model: 'gpt-5-mini', promptVersion: 'v1', inputVariant: 'snippet' }, outcomes)
    // Passed in reverse of the expected order: output must not depend on input order.
    const table = reportTable([sample, real])
    const realIdx = table.indexOf('| gpt-5-mini | v1 | snippet | real |')
    const sampleIdx = table.indexOf('| gpt-5-mini | v1 | snippet | sample |')
    expect(realIdx).toBeGreaterThan(-1)
    expect(sampleIdx).toBeGreaterThan(-1)
    expect(realIdx).toBeLessThan(sampleIdx)
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
