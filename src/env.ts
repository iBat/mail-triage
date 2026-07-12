export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function parseLookbackHours(raw: string | undefined): number {
  const hours = Number(raw ?? '24')
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(`Invalid LOOKBACK_HOURS "${raw}": must be a positive number of hours`)
  }
  return hours
}
