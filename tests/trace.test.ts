import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendTrace, hashEmailId } from '../src/trace.js'

describe('trace', () => {
  it('hashEmailId is a stable 12-char hex prefix, not the raw id', () => {
    const h = hashEmailId('gmail-id-1')
    expect(h).toMatch(/^[0-9a-f]{12}$/)
    expect(h).toBe(hashEmailId('gmail-id-1'))
    expect(h).not.toContain('gmail')
  })

  it('appends one JSONL line per event into a per-day file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trace-'))
    const event = {
      ts: '2026-07-09T09:00:00.000Z', emailIdHash: 'abc', model: 'm', promptVersion: 'v1',
      inputVariant: 'snippet', label: 'normal', shadow: true,
    }
    appendTrace(dir, event)
    appendTrace(dir, event)
    const lines = readFileSync(join(dir, '2026-07-09.jsonl'), 'utf8').trim().split('\n')
    expect(lines.length).toBe(2)
    expect(JSON.parse(lines[0]).label).toBe('normal')
  })
})
