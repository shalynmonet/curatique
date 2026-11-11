import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

// Credentials: ANTHROPIC_API_KEY from the environment.
export const anthropic = new Anthropic();

export const model = () => env.claudeModel();
export const curatorModel = () => env.curatorModel();

/**
 * Server-side refusal fallback ("default" routes by refusal category) — opt-in beta, only on models that
 * support it (Opus 5 / 5.5, Sonnet 5.5, Fable 5.1 / 5.2). Claude Haiku 5.5 has no server-side fallback.
 */
export function fallbackParams(m: string = model()): { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: "default" } {
  return /^claude-(opus-5|sonnet-5-5|fable-5-[12])/.test(m)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }
    : {};
}

/** Web search / fetch tool versions: dynamic-filtering variants where supported, basic ones otherwise (e.g. Haiku). */
export function webTools(maxUses: number) {
  const dynamic = /^claude-(opus-5|opus-4-[678]|sonnet-5|sonnet-4-6|fable|mythos)/.test(model());
  return dynamic
    ? ([
        { type: "web_search_20260209", name: "web_search", max_uses: maxUses },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxUses },
      ] as const)
    : ([
        { type: "web_search_20250305", name: "web_search", max_uses: maxUses },
        { type: "web_fetch_20250910", name: "web_fetch", max_uses: maxUses },
      ] as const);
}

/** User-facing message for a failed request; raw Claude API errors are logged, not shown. */
export function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof Anthropic.APIError) {
    console.error("Claude API error:", e.status, e.message);
    return "Our AI curator is temporarily unavailable. Please try again in a few minutes.";
  }
  return e instanceof Error ? e.message : fallback;
}

export function textOf(msg: Anthropic.Beta.BetaMessage): string {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** One-shot call with a JSON-schema constrained response (structured outputs). */
export async function claudeJSON<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  const m = opts.model ?? model();
  const stream = anthropic.beta.messages.stream({
    model: m,
    max_tokens: opts.maxTokens ?? 32000,
    ...fallbackParams(m),
    system: opts.system,
    output_config: {
      effort: opts.effort ?? "medium",
      format: { type: "json_schema", schema: opts.schema },
    },
    messages: [{ role: "user", content: opts.user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (msg.stop_reason === "max_tokens") throw new Error("Claude response was truncated.");
  return JSON.parse(textOf(msg)) as T;
}
