# mail-triage

Production email triage: Gmail → LLM classification → Telegram urgent digest,
with newsletters auto-archived. Migrated from a no-code n8n workflow to a
TypeScript implementation with an eval harness, so that every configuration
choice — model, prompt, input format — is backed by a number instead of a
guess. Runs daily against the inbox owner's mailbox; classification is done
by `gpt-5-mini` via structured outputs (a Zod schema enforced through the
provider SDK, not prompt-level JSON instructions).

## Why migrate from no-code

The n8n version worked, in the sense that it ran every day and nobody
looked at it. It also measured nothing. Its worst failure mode — a
non-newsletter email misclassified as a newsletter, silently marked as read
and archived out of the inbox — was invisible by construction: there was no
trace, no log, no way to notice it happened short of the inbox owner
remembering an email that never arrived. The prompt, the model, and the
input format (subject + snippet only) were frozen guesses made once and
never revisited.

An eval harness turns all three into measured decisions: a labeled dataset,
a code-based grader, and a committed table of accuracy/recall/precision/cost
per configuration. The rest of this document is that table, and the story of
what it changed.

## Architecture

```
Gmail inbox (last 12h)
        |  gmail.ts: fetchRecentEmails
        v
   pipeline.ts  ---------------------------------------------+
        |  classifier/factory.ts routes by model name        |
        |    "claude-*"   -> classifier/anthropic.ts          |
        |    everything else -> classifier/openai.ts          |
        |  (structured output: {label, summary}, Zod-checked) |
        v                                                     |
  trace.ts: one JSONL line per email (hashed id, model,       |
  prompt version, input variant, usage, latency)              |
        |                                                     |
   +----+---------------------+---------------------+         |
   v                          v                     v          |
 label=urgent           label=normal          label=newsletter |
   |                                                 |          |
   v                                                 v          |
 digest.ts builds the digest              gmail.ts: markAsRead  |
   |                                       (ONLY if the response|
   v                                        parsed AND label    |
 telegram.ts sends it to the                is "newsletter")   |
 owner's Telegram chat                                          |
```

Modules:

- `src/pipeline.ts` — orchestration: fetch, classify, route, fail-safe
  mark-as-read, shadow mode (`SHADOW=1` runs read-only).
- `src/classifier/{openai,anthropic,factory}.ts` — structured outputs via
  `responses.parse()` (OpenAI) / `messages.parse()` (Anthropic), both
  validated against the same Zod schema. `factory.ts` routes by a single
  naming convention: any model name starting with `claude-` goes through
  the Anthropic SDK, everything else through OpenAI's.
- `src/gmail.ts` — Gmail OAuth2 client: fetch recent mail, extract
  plain-text body, mark as read.
- `src/telegram.ts` — Telegram Bot API sender (plain `fetch`, no SDK).
- `src/digest.ts` — urgent-digest formatting, ported byte-for-byte from the
  original n8n Code node.
- `src/trace.ts` — JSONL trace of every classification: sha256-hashed email
  ids only, never a raw Gmail id.
- `prompts/` — versioned prompt files (`v1`, `v2-fewshot`, `v3-personal`).
- `evals/` — `run.ts` (matrix runner: model × prompt × input variant),
  `grade.ts` (code-based grader), `report.ts` (renders `evals/results/*.json`
  into the markdown table below).
- `datasets/` — `real*.jsonl` (private, hand-labeled, gitignored) and
  `sample.jsonl` (public synthetic set).
- `scripts/gmail-auth.ts` / `scripts/export-emails.ts` — local OAuth
  bootstrap and Gmail export for building the private dataset.
- `tools/label.html` — a single-file, offline labeling GUI (no build step,
  no upload — everything stays in the browser tab) for hand-labeling
  exported emails into the private dataset.

## Eval harness

Two datasets: 176 private real emails, hand-labeled by the inbox owner
through `tools/label.html`, and a 12-case public synthetic sample so anyone
cloning the repo can run the harness end to end:
`npm run eval -- --dataset sample`.

The grader is code-based: exact label match against a fixed three-way
classification (`urgent` / `normal` / `newsletter`), plus a full confusion
matrix. Two metrics matter more than raw accuracy:

- **Urgent recall** — the fraction of truly urgent emails the classifier
  actually flags. A miss here is the sharpest possible failure: the inbox
  owner misses a job-search deadline or an interview invitation because the
  digest never mentioned it.
- **Newsletter precision** — the fraction of emails classified as newsletter
  that really are newsletters. A false positive here is the original
  silent-failure mode: a real email gets archived and disappears.

The harness also reports `$/1000` emails (from token usage and
`evals/prices.ts`) and latency at p50/p95, since a triage job that's
accurate but slow or expensive is still the wrong choice for a daily cron.

## Results

Full table from `npm run report` (all committed runs under
`evals/results/`):

| model | prompt | input | dataset | accuracy | urgent recall | newsletter precision | $/1000 | p50 ms | p95 ms | errors |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 | v1 | snippet | sample | 91.7% | 100.0% | 100.0% | $0.43 | 1313 | 2970 | 0 |
| claude-haiku-4-5 | v2-fewshot | body | real | 87.5% | 52.6% | 97.5% | $1.55 | 1139 | 2339 | 0 |
| claude-haiku-4-5 | v3-personal | body | real | 93.2% | 84.2% | 98.4% | $1.73 | 1097 | 2224 | 0 |
| claude-sonnet-5 | v1 | snippet | sample | 100.0% | 100.0% | 100.0% | $1.22 | 2638 | 3721 | 0 |
| claude-sonnet-5 | v2-fewshot | body | real | 88.1% | 21.1% | 97.7% | $4.04 | 2659 | 4645 | 0 |
| claude-sonnet-5 | v3-personal | body | real | 92.0% | 78.9% | 98.3% | $4.62 | 2854 | 4823 | 0 |
| gpt-5-mini | v1 | body | real | 75.0% | 21.1% | 97.2% | $0.44 | 1889 | 3972 | 0 |
| gpt-5-mini | v1 | snippet | real | 70.5% | 21.1% | 95.9% | $0.34 | 2098 | 3645 | 0 |
| gpt-5-mini | v1 | snippet | sample | 91.7% | 100.0% | 100.0% | $0.32 | 1786 | 3606 | 0 |
| gpt-5-mini | v2-fewshot | body | real | 80.1% | 52.6% | 97.3% | $0.56 | 2097 | 4889 | 0 |
| gpt-5-mini | v3-personal | body | real | 89.8% | 100.0% | 97.6% | $0.63 | 2160 | 5380 | 0 |
| gpt-5-mini | v3-personal | body | sample | 91.7% | 100.0% | 100.0% | $0.42 | 1920 | 3577 | 0 |

**Chosen configuration: `gpt-5-mini` / `v3-personal` / `body`.** On the real
dataset, urgent recall went from 0.211 (v1, the ported n8n baseline) to
1.000, while newsletter precision held at 97.6%. That metric was never the
differentiator: every configuration on the real dataset sat in a narrow
95.9%-98.4% band. It's also the cheapest of the three models evaluated under
this configuration, at $0.63/1000 emails.

The twist worth stating plainly: the production model was never the
bottleneck. `gpt-5-mini` under the original prompt and input shape scored
the same 21.1% urgent recall as `claude-sonnet-5` did under the improved
few-shot prompt (v2-fewshot). What actually moved recall from 21% to 100%
was the prompt — specifically, encoding the inbox owner's real urgency
policy instead of a generic definition of "urgent."

## Experiments

**Input shape: subject+snippet vs. +body (2000 chars).** Hypothesis: more
context improves classification. Result: accuracy went from 70.5% to 75.0%
on `gpt-5-mini`/v1/real, but urgent recall was unchanged (21.1% either way).
Decision: keep body — it helps overall accuracy at no cost to the metric
that matters most, and newsletter precision moved with it.

**Prompt v2 (definitions + few-shot examples).** Hypothesis: adding explicit
label definitions and 2-3 worked examples would fix the recall problem.
Result: urgent recall roughly doubled, 21.1% → 52.6% (`gpt-5-mini`/real,
body). Better, but capped — a textbook definition of "urgent" (deadlines,
outages, security alerts) can't know what urgent means to one specific
person's inbox.

**Prompt v3 (the owner's actual policy).** Hypothesis: replace generic
definitions with the inbox owner's real urgency rule — personally-addressed
job-search correspondence (recruiter outreach, interview scheduling) is
always urgent; bulk breaking-news alerts, however dramatic the subject
line, never are. Result: recall jumped again, 52.6% → 100% (`gpt-5-mini`,
real, body). The key insight came out of the labeling process itself:
hand-labeling ground truth revealed that the owner's real policy was nearly
the opposite of what the production system did — the n8n version reliably
pinged on breaking-news digests and stayed silent on recruiter emails.

**Models under identical v3/body configuration.**
- `claude-haiku-4-5`: 93.2% accuracy / 84.2% urgent recall / $1.73 per 1000.
- `claude-sonnet-5`: 92.0% / 78.9% / $4.62.
- `gpt-5-mini`: 89.8% / 100.0% / $0.63.

The most capable general-purpose model (`claude-sonnet-5`) had the *lowest*
urgent recall of the three — it adheres most strictly to a textbook notion
of urgency and resists the policy override embedded in the prompt more than
the smaller models do. By the pre-registered selection rule (urgent recall,
then newsletter precision, then accuracy, then cost, in that order):
`gpt-5-mini` wins outright on the first criterion.

**Honest caveats.** The v3 policy was derived by hand-labeling the same
dataset it's evaluated on — the examples embedded in the prompt are
synthetic and no real dataset rows are quoted anywhere, but this is still
in-sample tuning, not a held-out test. The intended out-of-sample check is
the production shadow-mode period (see Production and rollout in
`docs/design.md`), not another eval split. Every configuration in the table
above is a single run, not an average over repeats, so differences of 1-2
emails between close configurations (e.g. the newsletter-precision gap
between models under v3) are noise, not signal.

## Failure modes & fail-safes

The original failure story: a real, non-newsletter email gets
misclassified as `newsletter`, gets marked as read by the n8n workflow, and
disappears from the unread view with no record anywhere that it happened.
This project's fail-safe rule, enforced in `src/pipeline.ts`
(`shouldMarkAsRead`): an email is archived **only** when the structured
response parses successfully *and* the label is exactly `newsletter`. Any
provider error, timeout, or parse failure is treated as `normal` — the
email is left unread rather than silently dropped.

A run where every single classification fails (bad API key, a typo'd
`CLASSIFIER_MODEL`, a provider outage) is a systemic failure, not a batch of
unlucky per-email errors — `allFailed()` detects it and the run throws,
which `main.ts` turns into a loud Telegram alert instead of a quiet run that
resolves with nothing archived and nothing sent. Digest delivery is
decoupled from archiving on purpose: if the Telegram send fails, newsletter
archiving still happens, and the digest error is only re-raised afterward —
one broken message must never block otherwise-safe cleanup. Every artifact
this project commits (trace files, eval results) stores only a sha256 hash
of the Gmail message id, truncated to 12 hex characters — never the raw id.

## Running it

```
cp .env.example .env        # fill in API keys, Gmail OAuth, Telegram bot/chat
npm run gmail-auth           # local OAuth bootstrap; prints the refresh token to add to .env
```

Note: the Google OAuth app backing Gmail access must be published to
production status — an app left in "Testing" status issues refresh tokens
that expire after 7 days, which will silently break the daily cron.

```
npm test                                                    # 75 tests
npm run eval -- --dataset sample --models gpt-5-mini --prompt v1 --input snippet
npm run pipeline                                             # SHADOW=1: read-only dry run
```

Schedule `npm run pipeline` daily via `launchd` (macOS) or `cron`/a systemd
timer (Linux), pointed at the repo with `.env` loaded. Run with `SHADOW=1`
during the parity-check period against the n8n workflow before disabling it.

## What was improved over the n8n version

- Model, prompt, and input format are now measured choices with a committed
  eval table behind them, not frozen guesses from whenever the workflow was
  first built.
- The id-echo artifact is gone: the n8n version had the model echo the
  Gmail message id back in its structured output, an extra parsing surface
  with no purpose other than being a thing that could fail. The new schema
  only asks for `label` and `summary`.
- Mark-as-read is fail-safe by construction: archiving requires a
  successfully parsed `newsletter` label; everything else — including any
  error — defaults to leaving the email unread.
- A fully-failed run now raises a loud Telegram alert instead of resolving
  as a quiet no-op.
- Committed artifacts (traces, eval results) contain only sha256-hashed
  email ids, never raw Gmail ids.
- Prompts are versioned files (`v1`/`v2-fewshot`/`v3-personal`) instead of
  a single inline string, so prompt iterations are diffable and evaluable
  independently.
- A purpose-built offline labeling GUI (`tools/label.html`) makes
  maintaining and extending the private dataset a few minutes of clicking
  instead of hand-editing JSONL.
