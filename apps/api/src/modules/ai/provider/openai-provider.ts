import { env } from "../../../config/env";
import { ServiceUnavailableError } from "../../../lib/errors";
import { logger } from "../../../lib/logger";
import type { AICompletionRequest, AIProvider } from "./ai-provider";

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * OpenAI Chat Completions provider. Implemented with `fetch` (no SDK dependency)
 * so the provider stays a thin, swappable adapter. Calls are deterministic
 * (temperature 0) and time-bounded; product-description requests ask for strict
 * JSON via `response_format`. Failures surface as a 503 the controller returns
 * gracefully — they never crash a request.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = env.OPENAI_MODEL;
    this.baseUrl = env.OPENAI_BASE_URL.replace(/\/$/, "");
  }

  async complete(req: AICompletionRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.AI_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          ...(req.json
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        logger.error(
          { status: response.status, detail: detail.slice(0, 500) },
          "OpenAI request failed",
        );
        throw new ServiceUnavailableError(
          "تعذّر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى لاحقًا.",
        );
      }

      const body = (await response.json()) as OpenAIChatResponse;
      const content = body.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new ServiceUnavailableError(
          "لم تُرجع خدمة الذكاء الاصطناعي أي نتيجة.",
        );
      }
      return content;
    } catch (err) {
      if (err instanceof ServiceUnavailableError) {
        throw err;
      }
      logger.error({ err }, "OpenAI request errored");
      throw new ServiceUnavailableError(
        "تعذّر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى لاحقًا.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
