import { LABELS, type Label } from '../src/types.js'

export interface GradedCase {
  id: string
  expected: Label
  predicted: Label | 'error'
}

export interface ClassStats {
  precision: number | null // null when the class was never predicted
  recall: number
  support: number
}

export interface Metrics {
  total: number
  correct: number
  accuracy: number
  errors: number
  confusion: Record<Label, Record<Label | 'error', number>>
  perClass: Record<Label, ClassStats>
  urgentRecall: number
  newsletterPrecision: number | null
}

export function grade(cases: GradedCase[]): Metrics {
  const confusion = Object.fromEntries(
    LABELS.map(l => [l, { urgent: 0, normal: 0, newsletter: 0, error: 0 }]),
  ) as Metrics['confusion']

  let correct = 0
  for (const c of cases) {
    confusion[c.expected][c.predicted] += 1
    if (c.expected === c.predicted) correct += 1
  }

  const perClass = {} as Metrics['perClass']
  for (const l of LABELS) {
    const support = cases.filter(c => c.expected === l).length
    const predicted = cases.filter(c => c.predicted === l).length
    const tp = confusion[l][l]
    perClass[l] = {
      recall: support === 0 ? 0 : tp / support,
      precision: predicted === 0 ? null : tp / predicted,
      support,
    }
  }

  return {
    total: cases.length,
    correct,
    accuracy: cases.length === 0 ? 0 : correct / cases.length,
    errors: cases.filter(c => c.predicted === 'error').length,
    confusion,
    perClass,
    urgentRecall: perClass.urgent.recall,
    newsletterPrecision: perClass.newsletter.precision,
  }
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}
