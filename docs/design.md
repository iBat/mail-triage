# mail-triage — Design Document

## Goal

`mail-triage` replaces a production n8n workflow ("Mail processing") with a
TypeScript implementation that has an eval harness and quality numbers backing
every configuration choice. The n8n workflow currently pulls Gmail messages
from the last 12 hours, classifies each one by subject + snippet using
`gpt-5-mini`, sends an urgent digest to Telegram, and marks newsletters as
read. The end state for this project is a code version that fully replaces
the n8n workflow in production, after a verified shadow-mode run.

## Motivation

This is a portfolio project built around a simple thesis: for AI-engineering
roles in 2026, the strongest hiring signal is the ability to measure quality
(evals), read traces, and justify a model choice with numbers rather than
intuition. The existing n8n workflow measures nothing — it was built once and
left running. Its most dangerous failure mode is silent: a non-newsletter
email misclassified as a newsletter gets marked as read and disappears from
the inbox with no record of what happened.

Rebuilding this workflow in code with an eval harness turns an unmeasured
automation into a small, auditable system: every classifier decision is
traced, every configuration choice (model, prompt, input shape) is backed by
a comparison run against a labeled dataset, and the riskiest action
(mark-as-read) has an explicit fail-safe.

## Design decisions

| Question | Decision |
|---|---|
| Starting point | The existing n8n "Mail processing" workflow |
| Fate of the n8n workflow | Full replacement by code, after a parallel shadow run |
| Language | TypeScript (Node 22) |
| Models | Compare `gpt-5-mini` (production baseline) against Claude models; pick based on eval results |
| Eval data | Two datasets: a private set of real emails (gitignored) and a public synthetic sample |
| Architecture | Plain TypeScript, no frameworks — direct provider SDK calls and a custom eval harness |

## Repository structure

```
mail-triage/
├─ src/
│  ├─ main.ts             # entry point: run the pipeline, alert on failure
│  ├─ pipeline.ts         # orchestration: gmail → classify → route → telegram
│  ├─ classifier/
│  │  ├─ factory.ts       # picks the Anthropic vs OpenAI classifier by model name
│  │  ├─ anthropic.ts     # @anthropic-ai/sdk, messages.parse() + zodOutputFormat
│  │  └─ openai.ts        # openai SDK, responses.parse() + zodTextFormat
│  ├─ types.ts            # Classifier, EmailInput, Classification (zod schema)
│  ├─ prompts.ts          # loads versioned prompt files from prompts/
│  ├─ render.ts           # renders an EmailInput into model input (snippet vs body)
│  ├─ gmail.ts            # googleapis OAuth2: fetch recent mail, markAsRead
│  ├─ telegram.ts         # Bot API via fetch, no dependencies
│  ├─ digest.ts           # urgent-digest formatting (n8n parity)
│  ├─ trace.ts            # JSONL trace: hashed id, model, prompt, usage, latency
│  └─ env.ts              # required-env-var helper
├─ prompts/                # versioned prompts (v1 = ported from n8n, v2 = few-shot)
├─ evals/
│  ├─ run.ts              # matrix runner: model × prompt × input variant
│  ├─ dataset.ts          # JSONL loader and validation (zod)
│  ├─ grade.ts            # code-based grader: accuracy, confusion matrix, recall/precision
│  ├─ report.ts           # renders evals/results/*.json into a markdown table
│  ├─ prices.ts           # per-model $/MTok table and cost calculation
│  └─ results/             # committed run logs (*.json)
├─ datasets/
│  ├─ sample.jsonl        # ~12 synthetic cases, public
│  └─ real*.jsonl         # real-email set, gitignored
├─ scripts/
│  ├─ gmail-auth.ts       # local OAuth bootstrap (prints a refresh token)
│  └─ export-emails.ts    # Gmail export for dataset labeling
├─ tests/                  # vitest unit tests, mirroring src/ and evals/
└─ README.md               # portfolio write-up with eval numbers
```

## Key contracts

```ts
// zod's v4 API surface is required (see Implementation notes below).
export const ClassificationSchema = z.object({
  label: z.enum(['urgent', 'normal', 'newsletter']),
  summary: z.string(), // one sentence in English for "urgent"; empty string otherwise
})
export type Classification = z.infer<typeof ClassificationSchema>

export interface EmailInput {
  id: string
  subject: string
  snippet: string
  body?: string
}

export interface ClassifiedResult {
  label: Label
  summary?: string
  usage: { inputTokens: number; outputTokens: number }
  latencyMs: number
}

export interface Classifier {
  name: string
  classify(e: EmailInput): Promise<ClassifiedResult>
}
```

- **Anthropic**: structured outputs via `client.messages.parse()` with a Zod
  schema (`zodOutputFormat`). Candidates: `claude-haiku-4-5` ($1/$5 per MTok —
  a mini-class competitor) and `claude-sonnet-5` (intro pricing $2/$10 through
  2026-08-31, standard $3/$15 — the quality ceiling).
- **Currency rule**: the model list and prices are re-verified at
  implementation/publication time against primary sources (the Anthropic
  Models API and provider pricing pages), not against memory or this document.
- **OpenAI**: `gpt-5-mini` — the production baseline, using its SDK's
  structured-output support (`responses.parse()` + `zodTextFormat`).
- Model routing is a single naming convention: any model name starting with
  `claude-` goes through the Anthropic SDK, everything else through OpenAI's.
- `summary` (one sentence, English) is populated only for `urgent`, matching
  the current n8n behavior.

## Eval harness

- **Dataset format**: JSONL rows of `{id, subject, snippet, body, expected,
  note?}`. The real dataset is built from `scripts/export-emails.ts` plus
  manual labeling (50-100 emails). The private set produces the numbers
  reported in the README; the public sample lets anyone run the harness
  (`npm run eval -- --dataset sample`).
- **Metrics**: accuracy, per-class precision/recall, and a full confusion
  matrix. The two metrics that matter most operationally are **urgent
  recall** (missing something urgent) and **newsletter precision**
  (incorrectly marking something as read). The harness also reports
  $/1000 emails (derived from token usage and `evals/prices.ts`) and
  latency at p50/p95.
- **Experiments** (one variable at a time, results committed under
  `evals/results/`):
  1. Input shape: subject+snippet (matching n8n) vs. subject+snippet+body
     (first 2000 characters by default; length is an experiment parameter).
  2. Prompt: v1 (current, ported from n8n) vs. a few-shot variant with 2-3
     examples.
  3. Model: `gpt-5-mini` vs. `claude-haiku-4-5` vs. `claude-sonnet-5`.
- **Grader**: code-based only (exact label match). An LLM-as-judge grader
  isn't needed for a fixed three-way classification task.

## Production and rollout

- **Schedule**: daily at 09:00, via cron/launchd locally or a systemd timer
  on the server that runs n8n. Secrets live in `.env` (gitignored); the Gmail
  OAuth credential used here is separate from n8n's own credential.
- **Shadow mode (1-2 weeks)**: the pipeline reads mail and classifies it but
  mutates nothing — no mark-as-read — and sends its digest tagged `[shadow]`
  so it can be compared against the live n8n workflow's output. The n8n
  workflow is only switched off after confirmed parity or improvement.
- **Fail-safe**: mark-as-read only happens when the structured response
  parses successfully and `label === 'newsletter'`; any call error, parse
  failure, or timeout is treated as `normal`, leaving the email unread. (The
  v1 schema has no confidence field; one would be added as a separate
  experiment if the evals showed a need for it.) Pipeline errors trigger a
  Telegram alert, mirroring the original workflow's error-notification path.

## Verification plan

1. Unit tests (vitest) covering the grader, the routing/switch logic, and
   model-response parsing.
2. `npm run eval -- --dataset sample` passes from a clean clone.
3. An end-to-end dry run against a real mailbox, with the digest manually
   compared against the n8n version.
4. Final migration check: a full week of shadow-mode runs with no
   discrepancies on urgent classifications.

## Implementation notes

A few points where the implementation refined or superseded the original
design:

- **Schema library**: both classifiers validate against the same Zod schema,
  but the Anthropic SDK's `zodOutputFormat` helper calls `z.toJSONSchema`,
  which only exists on Zod's v4 API surface (available as the `zod/v4`
  subpath in the current package version). OpenAI's `zodTextFormat` helper
  works with either version, so the schema is written against v4 throughout
  for a single source of truth.
- **Privacy-safe dataset ids**: real dataset rows use a sha256 hash of the
  Gmail message id, truncated to 12 hex characters, as their `id` — the same
  scheme `trace.ts` uses for trace events. This means eval result files under
  `evals/results/`, which are committed, never carry a real Gmail message id
  even though they echo back each case's `id`.
- **Privacy-safe traces**: `trace.ts` hashes email ids the same way, and any
  error message that happens to interpolate a raw Gmail id has that id
  replaced with its hash before being written to the trace file. Traces
  contain no real mailbox data.
- **Digest format**: `digest.ts` is a byte-for-byte port of the n8n Code node
  that built the original digest, including a known parity bug — summary
  text is inserted unescaped into an HTML-mode Telegram message, so a summary
  containing `<` or `&` will make Telegram reject the whole digest. This is
  intentional for now (matching the original behavior exactly during the
  parity/shadow period) and tracked as a follow-up: `TODO(post-parity):`
  HTML-escape the summary text once parity is confirmed.

## Out of scope (YAGNI)

- No RAG or vector databases — this is a fixed three-way classification task.
- No LLM-as-judge, no LangChain/LangSmith.
- No web interface; reports are markdown.
- A second, separate mail-processing workflow exists in production and is
  intentionally left untouched here — a possible second phase if this
  migration succeeds.

---

Translated and adapted from the original Russian design document (2026-07-09).
