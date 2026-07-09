import { loadPrompt } from '../prompts.js'
import type { InputVariant } from '../render.js'
import type { Classifier } from '../types.js'
import { anthropicClassifier } from './anthropic.js'
import { openaiClassifier } from './openai.js'

// Single routing convention shared by the pipeline and the eval harness:
// claude-* goes through the Anthropic SDK, everything else through OpenAI.
export function makeClassifier(model: string, promptVersion: string, inputVariant: InputVariant): Classifier {
  const systemPrompt = loadPrompt(promptVersion)
  return model.startsWith('claude-')
    ? anthropicClassifier({ model, systemPrompt, inputVariant })
    : openaiClassifier({ model, systemPrompt, inputVariant })
}
