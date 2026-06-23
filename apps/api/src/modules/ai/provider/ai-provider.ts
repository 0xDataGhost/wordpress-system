/**
 * Swappable AI provider abstraction (Phase 12.5).
 *
 * The service builds a provider-agnostic request (system + user prompt + a
 * structured `context`) and a concrete provider turns it into text. Keeping the
 * surface this small means a new backend (OpenAI, a local model, …) only has to
 * implement `complete`. The `task` discriminator lets the deterministic mock
 * provider produce sensible output without calling anything external.
 */

export type AITask =
  | "product_description"
  | "sales_summary"
  | "low_stock_insights";

export interface AICompletionRequest {
  /** Which assistant is asking — drives the mock provider's deterministic output. */
  task: AITask;
  /** System instruction (persona + format). */
  system: string;
  /** The rendered user prompt. */
  user: string;
  /** Structured inputs/metrics the mock uses to build a deterministic response. */
  context: Record<string, unknown>;
  /** True when the provider should return strict JSON (product description). */
  json?: boolean;
}

export interface AIProvider {
  /** Stable identifier surfaced to callers (e.g. "openai", "mock"). */
  readonly name: string;
  /** Produces a completion (plain text, or a JSON string when `req.json`). */
  complete(req: AICompletionRequest): Promise<string>;
}
