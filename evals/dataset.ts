import { readFileSync } from 'node:fs'
import { z } from 'zod/v4'
import { LABELS } from '../src/types.js'

export const DatasetCaseSchema = z.object({
  id: z.string(),
  subject: z.string(),
  snippet: z.string(),
  body: z.string().optional(),
  expected: z.enum(LABELS),
  note: z.string().optional(),
})
export type DatasetCase = z.infer<typeof DatasetCaseSchema>

export function loadDataset(path: string): DatasetCase[] {
  const lines = readFileSync(path, 'utf8').split('\n').filter(l => l.trim() !== '')
  return lines.map((line, i) => {
    try {
      return DatasetCaseSchema.parse(JSON.parse(line))
    } catch (err) {
      throw new Error(`${path}:${i + 1}: invalid dataset row: ${err}`)
    }
  })
}
