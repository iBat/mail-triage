# mail-triage

An email triage pipeline (Gmail → LLM classification → Telegram digest) migrated
from a no-code n8n workflow to TypeScript, with an eval harness that picks the
model, prompt, and input format based on measured quality.

Work in progress — see `docs/design.md` for the design and the Results section
below (coming) for eval numbers.
