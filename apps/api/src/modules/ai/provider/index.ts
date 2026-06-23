import { env } from "../../../config/env";
import { logger } from "../../../lib/logger";
import type { AIProvider } from "./ai-provider";
import { MockAIProvider } from "./mock-provider";
import { OpenAIProvider } from "./openai-provider";

export type { AIProvider, AICompletionRequest, AITask } from "./ai-provider";

let cached: AIProvider | null = null;

/**
 * Returns the active AI provider (singleton). Selects the OpenAI provider when
 * OPENAI_API_KEY is set, otherwise the deterministic mock provider so the
 * assistants work offline. Swapping providers is a one-line change here.
 */
export function getAIProvider(): AIProvider {
  if (cached) {
    return cached;
  }
  cached = env.OPENAI_API_KEY
    ? new OpenAIProvider(env.OPENAI_API_KEY)
    : new MockAIProvider();
  logger.info({ provider: cached.name }, "AI provider initialised");
  return cached;
}
