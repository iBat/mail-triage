import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts')

export function loadPrompt(version: string): string {
  try {
    return readFileSync(join(PROMPTS_DIR, `${version}.txt`), 'utf8').trim()
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      const list = readdirSync(PROMPTS_DIR)
        .filter((f) => f.endsWith('.txt'))
        .map((f) => f.slice(0, -'.txt'.length))
        .join(', ')
      throw new Error(`Unknown prompt version "${version}". Available: ${list}`)
    }
    throw err
  }
}
