import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

// Credentials: ANTHROPIC_API_KEY from the environment.
export const anthropic = new Anthropic();

// Server-side refusal fallback ("default" routes by refusal category) — opt-in beta.
export const BETAS = ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[];
export const model = () => env.claudeModel();

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
}): Promise<T> {
  const stream = anthropic.beta.messages.stream({
    model: model(),
    max_tokens: opts.maxTokens ?? 32000,
    betas: BETAS,
    fallbacks: "default",
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
