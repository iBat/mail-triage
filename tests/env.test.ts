import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseLookbackHours, requireEnv } from '../src/env.js'

describe('requireEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the value when the variable is set', () => {
    vi.stubEnv('MAIL_TRIAGE_TEST_VAR', 'secret')
    expect(requireEnv('MAIL_TRIAGE_TEST_VAR')).toBe('secret')
  })

  it('throws when the variable is unset', () => {
    expect(() => requireEnv('MAIL_TRIAGE_MISSING_VAR')).toThrow('Missing required env var: MAIL_TRIAGE_MISSING_VAR')
  })

  it('throws when the variable is an empty string', () => {
    vi.stubEnv('MAIL_TRIAGE_EMPTY_VAR', '')
    expect(() => requireEnv('MAIL_TRIAGE_EMPTY_VAR')).toThrow('Missing required env var: MAIL_TRIAGE_EMPTY_VAR')
  })
})

describe('parseLookbackHours', () => {
  it('defaults to 24 when unset', () => {
    expect(parseLookbackHours(undefined)).toBe(24)
  })

  it('parses an explicit value', () => {
    expect(parseLookbackHours('12')).toBe(12)
  })

  it('throws on non-numeric input', () => {
    expect(() => parseLookbackHours('abc')).toThrow('LOOKBACK_HOURS')
  })

  it('throws on zero or negative values', () => {
    expect(() => parseLookbackHours('0')).toThrow('LOOKBACK_HOURS')
    expect(() => parseLookbackHours('-6')).toThrow('LOOKBACK_HOURS')
  })
})
