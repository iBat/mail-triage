import { readFileSync } from 'node:fs'
import { z } from 'zod/v4'
import { LABELS } from '../src/types.js'

export const DatasetCaseSchema = z.object({
  id: z.string().min(1),
  subject: z.string(),
  snippet: z.string(),
  body: z.string().optional(),
  expected: z.enum(LABELS),
  note: z.string().optional(),
})
export type DatasetCase = z.infer<typeof DatasetCaseSchema>

export function loadDataset(path: string): DatasetCase[] {
  const rawLines = readFileSync(path, 'utf8').split('\n')
  const cases: DatasetCase[] = []
  const seenIds = new Map<string, number>() // id -> 1-based line
  rawLines.forEach((line, i) => {
    if (line.trim() === '') return
    let parsed: DatasetCase
    try {
      parsed = DatasetCaseSchema.parse(JSON.parse(line))
    } catch (err) {
      throw new Error(`${path}:${i + 1}: invalid dataset row: ${err}`)
    }
    const firstLine = seenIds.get(parsed.id)
    if (firstLine !== undefined) {
      throw new Error(`${path}:${i + 1}: duplicate id "${parsed.id}" (first seen at line ${firstLine})`)
    }
    seenIds.set(parsed.id, i + 1)
    cases.push(parsed)
  })
  return cases
}
