import { writeFileSync } from 'node:fs'
import { requireEnv } from '../src/env.js'
import { fetchRecentEmails, gmailService } from '../src/gmail.js'
import { hashEmailId } from '../src/trace.js'

// Dataset id is hashEmailId(gmail id), NOT the raw Gmail id
// so committed eval results never contain anything private.
const days = Number(process.argv[2] ?? 14)

const gmail = gmailService({
  clientId: requireEnv('GMAIL_CLIENT_ID'),
  clientSecret: requireEnv('GMAIL_CLIENT_SECRET'),
  refreshToken: requireEnv('GMAIL_REFRESH_TOKEN'),
})

const emails = await fetchRecentEmails(gmail, days * 24)
const lines = emails.map(e =>
  JSON.stringify({
    id: hashEmailId(e.id),
    subject: e.subject,
    snippet: e.snippet,
    body: e.body?.slice(0, 4000),
    expected: '',
  }),
)
const out = 'datasets/real.unlabeled.jsonl'
writeFileSync(out, lines.join('\n') + '\n')
console.log(`${emails.length} emails from the last ${days} days -> ${out}`)
console.log('Label each row (expected: urgent | normal | newsletter), then rename to datasets/real.jsonl')
