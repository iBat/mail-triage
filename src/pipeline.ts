import { makeClassifier } from './classifier/factory.js'
import { buildUrgentDigest, type UrgentItem } from './digest.js'
import { requireEnv } from './env.js'
import { fetchRecentEmails, gmailService, markAsRead } from './gmail.js'
import { INPUT_VARIANTS, type InputVariant } from './render.js'
import { sendTelegramMessage } from './telegram.js'
import { appendTrace, hashEmailId } from './trace.js'
import type { ClassifiedResult, EmailInput } from './types.js'

export interface ProcessedEmail {
  email: EmailInput
  result: ClassifiedResult | null // null => classification failed
  error?: string
}

// Spec fail-safe: mark-as-read ONLY when the structured response parsed
// successfully AND label === 'newsletter'. Anything else stays unread.
export function shouldMarkAsRead(p: ProcessedEmail): boolean {
  return p.result !== null && p.result.label === 'newsletter'
}

export function selectUrgent(processed: ProcessedEmail[]): UrgentItem[] {
  return processed
    .filter(p => p.result?.label === 'urgent')
    .map(p => ({ email: p.email, summary: p.result?.summary ?? '' }))
}

// A run where every single classification failed is a systemic failure
// (bad API key, typo'd CLASSIFIER_MODEL, provider outage) — never a batch
// of coincidental per-email errors. An empty run is fine: no emails is not
// a failure.
export function allFailed(processed: ProcessedEmail[]): boolean {
  return processed.length > 0 && processed.every(p => p.result === null)
}

export async function runPipeline(): Promise<void> {
  const shadow = process.env.SHADOW === '1'
  const model = process.env.CLASSIFIER_MODEL ?? 'gpt-5-mini'
  const promptVersion = process.env.PROMPT_VERSION ?? 'v1'
  const rawVariant = process.env.INPUT_VARIANT ?? 'snippet'
  // Hard-fail on a typo'd variant instead of silently classifying with the
  // wrong input shape (same misconfig class the eval CLI guards against).
  if (!(INPUT_VARIANTS as readonly string[]).includes(rawVariant)) {
    throw new Error(`Unknown INPUT_VARIANT "${rawVariant}". Valid: ${INPUT_VARIANTS.join(', ')}`)
  }
  const inputVariant = rawVariant as InputVariant
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN')
  const chatId = requireEnv('TELEGRAM_CHAT_ID')

  const gmail = gmailService({
    clientId: requireEnv('GMAIL_CLIENT_ID'),
    clientSecret: requireEnv('GMAIL_CLIENT_SECRET'),
    refreshToken: requireEnv('GMAIL_REFRESH_TOKEN'),
  })

  const classifier = makeClassifier(model, promptVersion, inputVariant)

  const emails = await fetchRecentEmails(gmail, 12)
  console.log(`${emails.length} emails in the last 12h; shadow=${shadow}`)

  const processed: ProcessedEmail[] = []
  for (const email of emails) {
    try {
      processed.push({ email, result: await classifier.classify(email) })
    } catch (err) {
      processed.push({ email, result: null, error: String(err) })
    }
  }

  for (const p of processed) {
    appendTrace('traces', {
      ts: new Date().toISOString(),
      emailIdHash: hashEmailId(p.email.id),
      model,
      promptVersion,
      inputVariant,
      // Spec: classification errors are treated as 'normal'
      label: p.result?.label ?? 'normal',
      summary: p.result?.summary,
      usage: p.result?.usage,
      latencyMs: p.result?.latencyMs,
      // Classifier errors interpolate the raw Gmail id — keep traces hash-only.
      error: p.error?.replaceAll(p.email.id, hashEmailId(p.email.id)),
      shadow,
    })
  }

  const failures = processed.filter(p => p.error).length
  // Systemic failure must resolve loudly (main.ts alerts on rejection), not
  // as a silent run with no digest and nothing archived. This also makes a
  // typo'd CLASSIFIER_MODEL loud without needing a model allowlist here.
  // Traces are written first: an all-failed day needs its audit trail the most.
  if (allFailed(processed)) {
    throw new Error(`all ${failures} classifications failed — check model/keys (first error: ${processed[0]?.error})`)
  }

  // Deliberate ordering: a digest send failure (e.g. Telegram 400 on the
  // known unescaped-HTML parity bug) must NOT block unrelated newsletter
  // archiving. Remember the error, archive first, then surface it loudly.
  let digestError: unknown
  const urgent = selectUrgent(processed)
  if (urgent.length > 0) {
    const digest = buildUrgentDigest(urgent)
    try {
      await sendTelegramMessage(botToken, chatId, shadow ? `[shadow]\n${digest}` : digest, 'HTML')
    } catch (err) {
      digestError = err
    }
  }

  const newsletters = processed.filter(shouldMarkAsRead)
  if (!shadow) {
    for (const p of newsletters) {
      await markAsRead(gmail, p.email.id)
    }
  }

  console.log(`done: ${urgent.length} urgent, ${newsletters.length} newsletters, ${failures} classification errors`)
  if (digestError) throw digestError
}
