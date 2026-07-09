import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { loadDataset, type DatasetCase } from './dataset.js'
import { grade, percentile, type Metrics } from './grade.js'
import { costUsd } from './prices.js'
import { loadPrompt } from '../src/prompts.js'
import { anthropicClassifier } from '../src/classifier/anthropic.js'
import { openaiClassifier } from '../src/classifier/openai.js'
import type { Classifier, Label, Usage } from '../src/types.js'
import type { InputVariant } from '../src/render.js'

export interface EvalCaseOutcome {
  id: string
  expected: Label
  predicted: Label | 'error'
  latencyMs?: number
  usage?: Usage
  error?: string
}

export interface RunConfig {
  dataset: string
  model: string
  promptVersion: string
  inputVariant: InputVariant
}

export interface EvalRunResult extends RunConfig {
  runId: string
  startedAt: string
  metrics: Metrics
  costUsdPer1000: number
  latency: { p50: number; p95: number }
  cases: EvalCaseOutcome[]
}

export function makeClassifier(model: string, promptVersion: string, inputVariant: InputVariant): Classifier {
  const systemPrompt = loadPrompt(promptVersion)
  return model.startsWith('claude-')
    ? anthropicClassifier({ model, systemPrompt, inputVariant })
    : openaiClassifier({ model, systemPrompt, inputVariant })
}

// Sequential on purpose: ~100 cases per combo is minutes of wall-clock and
// stays far below provider rate limits.
export async function evalClassifier(classifier: Classifier, cases: DatasetCase[]): Promise<EvalCaseOutcome[]> {
  const outcomes: EvalCaseOutcome[] = []
  for (const c of cases) {
    try {
      const r = await classifier.classify({ id: c.id, subject: c.subject, snippet: c.snippet, body: c.body })
      outcomes.push({ id: c.id, expected: c.expected, predicted: r.label, latencyMs: r.latencyMs, usage: r.usage })
    } catch (err) {
      outcomes.push({ id: c.id, expected: c.expected, predicted: 'error', error: String(err) })
    }
  }
  return outcomes
}

export function buildRunResult(config: RunConfig, outcomes: EvalCaseOutcome[]): EvalRunResult {
  const latencies = outcomes.flatMap(o => (o.latencyMs === undefined ? [] : [o.latencyMs]))
  const totalCost = outcomes.reduce((sum, o) => sum + (o.usage ? costUsd(config.model, o.usage) : 0), 0)
  return {
    ...config,
    runId: `${config.dataset}_${config.model}_${config.promptVersion}_${config.inputVariant}_${Date.now()}`,
    startedAt: new Date().toISOString(),
    metrics: grade(outcomes),
    costUsdPer1000: outcomes.length === 0 ? 0 : (totalCost / outcomes.length) * 1000,
    latency: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    cases: outcomes,
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      dataset: { type: 'string', default: 'sample' },
      models: { type: 'string', default: 'gpt-5-mini' },
      prompt: { type: 'string', default: 'v1' },
      input: { type: 'string', default: 'snippet' },
    },
  })
  const cases = loadDataset(`datasets/${values.dataset}.jsonl`)
  mkdirSync('evals/results', { recursive: true })

  for (const model of values.models!.split(',')) {
    for (const promptVersion of values.prompt!.split(',')) {
      for (const inputVariant of values.input!.split(',') as InputVariant[]) {
        const config: RunConfig = { dataset: values.dataset!, model, promptVersion, inputVariant }
        console.log(`running ${model} / ${promptVersion} / ${inputVariant} on ${values.dataset} (${cases.length} cases)`)
        const outcomes = await evalClassifier(makeClassifier(model, promptVersion, inputVariant), cases)
        const result = buildRunResult(config, outcomes)
        const file = join('evals/results', `${result.runId}.json`)
        writeFileSync(file, JSON.stringify(result, null, 2) + '\n')
        console.log(`  accuracy=${result.metrics.accuracy.toFixed(3)} urgentRecall=${result.metrics.urgentRecall.toFixed(3)} errors=${result.metrics.errors} -> ${file}`)
      }
    }
  }
}

if (process.argv[1]?.endsWith('run.ts')) {
  main().catch(err => { console.error(err); process.exit(1) })
}
