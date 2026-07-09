import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireEnv } from '../src/env.js'

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
