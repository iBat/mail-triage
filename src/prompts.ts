import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts')

export function loadPrompt(version: string): string {
  return readFileSync(join(PROMPTS_DIR, `${version}.txt`), 'utf8').trim()
}
