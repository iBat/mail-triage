import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { EvalRunResult } from './run.js'

export function reportTable(runs: EvalRunResult[]): string {
  if (runs.length === 0) {
    return 'No eval runs found in evals/results — run `npm run eval` first.'
  }
  const pct = (x: number | null): string => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`)
  const header = '| model | prompt | input | dataset | accuracy | urgent recall | newsletter precision | $/1000 | p50 ms | p95 ms | errors |'
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|'
  const rows = [...runs]
    .sort((a, b) => `${a.model}${a.promptVersion}${a.inputVariant}`.localeCompare(`${b.model}${b.promptVersion}${b.inputVariant}`))
    .map(r => `| ${r.model} | ${r.promptVersion} | ${r.inputVariant} | ${r.dataset} | ${pct(r.metrics.accuracy)} | ${pct(r.metrics.urgentRecall)} | ${pct(r.metrics.newsletterPrecision)} | $${r.costUsdPer1000.toFixed(2)} | ${r.latency.p50} | ${r.latency.p95} | ${r.metrics.errors} |`)
  return [header, sep, ...rows].join('\n')
}

function main(): void {
  // Resolves relative to cwd; supported invocation is `npm run report` from the repo root.
  const dir = 'evals/results'
  const runs = existsSync(dir)
    ? readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as EvalRunResult)
    : []
  console.log(reportTable(runs))
}

if (process.argv[1]?.endsWith('report.ts')) {
  main()
}
