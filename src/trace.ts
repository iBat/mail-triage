import { appendFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { Usage } from './types.js'

export interface TraceEvent {
  ts: string
  emailIdHash: string
  model: string
  promptVersion: string
  inputVariant: string
  label: string
  summary?: string
  usage?: Usage
  latencyMs?: number
  error?: string
  shadow: boolean
}

export function hashEmailId(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 12)
}

// Bucketed by the UTC date of event.ts, not the local calendar day.
export function appendTrace(dir: string, event: TraceEvent): void {
  mkdirSync(dir, { recursive: true })
  appendFileSync(join(dir, `${event.ts.slice(0, 10)}.jsonl`), JSON.stringify(event) + '\n')
}
