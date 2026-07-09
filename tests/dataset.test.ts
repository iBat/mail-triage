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
})
