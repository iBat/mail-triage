import { anthropicClassifier } from './classifier/anthropic.js'
import { openaiClassifier } from './classifier/openai.js'
import { buildUrgentDigest, type UrgentItem } from './digest.js'
import { requireEnv } from './env.js'
import { fetchRecentEmails, gmailService, markAsRead } from './gmail.js'
import { loadPrompt } from './prompts.js'
import type { InputVariant } from './render.js'
import { sendTelegramMessage } from './telegram.js'
import { appendTrace, hashEmailId } from './trace.js'
import type { Classifier, ClassifiedResult, EmailInput } from './types.js'

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

export async function runPipeline(): Promise<void> {
  const shadow = process.env.SHADOW === '1'
  const model = process.env.CLASSIFIER_MODEL ?? 'gpt-5-mini'
  const promptVersion = process.env.PROMPT_VERSION ?? 'v1'
  const inputVariant = (process.env.INPUT_VARIANT ?? 'snippet') as InputVariant
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN')
  const chatId = requireEnv('TELEGRAM_CHAT_ID')

  const gmail = gmailService({
    clientId: requireEnv('GMAIL_CLIENT_ID'),
    clientSecret: requireEnv('GMAIL_CLIENT_SECRET'),
    refreshToken: requireEnv('GMAIL_REFRESH_TOKEN'),
  })

  const systemPrompt = loadPrompt(promptVersion)
  const classifier: Classifier = model.startsWith('claude-')
    ? anthropicClassifier({ model, systemPrompt, inputVariant })
    : openaiClassifier({ model, systemPrompt, inputVariant })

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
      error: p.error,
      shadow,
    })
  }

  const urgent = selectUrgent(processed)
  if (urgent.length > 0) {
    const digest = buildUrgentDigest(urgent)
    await sendTelegramMessage(botToken, chatId, shadow ? `[shadow]\n${digest}` : digest)
  }

  if (!shadow) {
    for (const p of processed.filter(shouldMarkAsRead)) {
      await markAsRead(gmail, p.email.id)
    }
  }

  const failures = processed.filter(p => p.error).length
  console.log(`done: ${urgent.length} urgent, ${processed.filter(shouldMarkAsRead).length} newsletters, ${failures} classification errors`)
}
