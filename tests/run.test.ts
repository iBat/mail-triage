import { describe, expect, it } from 'vitest'
import { evalClassifier, buildRunResult } from '../evals/run.js'
import type { Classifier } from '../src/types.js'
import type { DatasetCase } from '../evals/dataset.js'

const cases: DatasetCase[] = [
  { id: 'a', subject: 's1', snippet: 'p1', expected: 'urgent' },
  { id: 'b', subject: 's2', snippet: 'p2', expected: 'normal' },
  { id: 'c', subject: 's3', snippet: 'p3', expected: 'newsletter' },
]

const fake: Classifier = {
  name: 'fake-model',
  async classify(e) {
    if (e.id === 'c') throw new Error('boom')
    return { label: 'urgent', summary: 'x', usage: { inputTokens: 100, outputTokens: 10 }, latencyMs: 50 }
  },
}

describe('evalClassifier', () => {
  it('collects outcomes and turns thrown errors into predicted=error', async () => {
    const outcomes = await evalClassifier(fake, cases)
    expect(outcomes.map(o => o.predicted)).toEqual(['urgent', 'urgent', 'error'])
    expect(outcomes[2].error).toContain('boom')
  })
})

describe('buildRunResult', () => {
  it('aggregates metrics, cost and latency percentiles', async () => {
    const outcomes = await evalClassifier(fake, cases)
    const result = buildRunResult({
      dataset: 'sample', model: 'gpt-5-mini', promptVersion: 'v1', inputVariant: 'snippet',
    }, outcomes)
    expect(result.metrics.total).toBe(3)
    expect(result.metrics.urgentRecall).toBe(1)
    expect(result.costUsdPer1000).toBeGreaterThan(0)
    expect(result.latency.p50).toBe(50)
    expect(result.runId).toContain('sample_gpt-5-mini_v1_snippet')
  })
})
