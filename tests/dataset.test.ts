import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDataset } from '../evals/dataset.js'

describe('loadDataset', () => {
  it('loads the committed sample dataset (12 cases, all labels present)', () => {
    const cases = loadDataset('datasets/sample.jsonl')
    expect(cases.length).toBe(12)
    for (const label of ['urgent', 'normal', 'newsletter']) {
      expect(cases.some(c => c.expected === label)).toBe(true)
    }
  })

  it('reports file and line on an invalid row', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-'))
    const bad = join(dir, 'bad.jsonl')
    writeFileSync(bad, '{"id":"1","subject":"s","snippet":"p","expected":"spam"}\n')
    expect(() => loadDataset(bad)).toThrow(/bad\.jsonl:1/)
  })

  it('reports the real file line even when blank lines precede a bad row', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-'))
    const bad = join(dir, 'drift.jsonl')
    writeFileSync(bad, '\n\n{"id":"1","subject":"s","snippet":"p","expected":"spam"}\n')
    expect(() => loadDataset(bad)).toThrow(/drift\.jsonl:3/)
  })

  it('rejects duplicate ids naming both lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-'))
    const dup = join(dir, 'dup.jsonl')
    const row = '{"id":"same","subject":"s","snippet":"p","expected":"normal"}'
    writeFileSync(dup, row + '\n' + row + '\n')
    expect(() => loadDataset(dup)).toThrow(/dup\.jsonl:2: duplicate id "same" \(first seen at line 1\)/)
  })
})
