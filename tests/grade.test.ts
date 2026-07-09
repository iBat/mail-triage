import { describe, expect, it } from 'vitest'
import { grade, percentile, type GradedCase } from '../evals/grade.js'

const cases: GradedCase[] = [
  { id: '1', expected: 'urgent', predicted: 'urgent' },
  { id: '2', expected: 'urgent', predicted: 'normal' },      // missed urgent
  { id: '3', expected: 'normal', predicted: 'normal' },
  { id: '4', expected: 'normal', predicted: 'error' },        // failed call -> counts as error
  { id: '5', expected: 'newsletter', predicted: 'newsletter' },
  { id: '6', expected: 'normal', predicted: 'newsletter' },   // false mark-as-read candidate
]

describe('grade', () => {
  const m = grade(cases)

  it('computes accuracy', () => {
    expect(m.total).toBe(6)
    expect(m.correct).toBe(3)
    expect(m.accuracy).toBeCloseTo(0.5)
  })

  it('computes urgent recall (1 of 2 urgent found)', () => {
    expect(m.urgentRecall).toBeCloseTo(0.5)
  })

  it('computes newsletter precision (1 TP of 2 predicted newsletter)', () => {
    expect(m.newsletterPrecision).toBeCloseTo(0.5)
  })

  it('fills the confusion matrix', () => {
    expect(m.confusion.urgent.normal).toBe(1)
    expect(m.confusion.normal.error).toBe(1)
    expect(m.confusion.newsletter.newsletter).toBe(1)
  })

  it('counts errors', () => {
    expect(m.errors).toBe(1)
  })

  it('precision is null when a class was never predicted', () => {
    const m2 = grade([{ id: '1', expected: 'urgent', predicted: 'normal' }])
    expect(m2.perClass.newsletter.precision).toBeNull()
  })
})

describe('percentile', () => {
  it('computes p50 and p95', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    expect(percentile(values, 50)).toBe(500)
    expect(percentile(values, 95)).toBe(1000)
  })

  it('handles empty input', () => {
    expect(percentile([], 50)).toBe(0)
  })
})
