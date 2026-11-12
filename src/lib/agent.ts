import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getProduct, searchProducts, similarProducts } from "./channel3";
import { anthropic, fallbackParams, model, textOf } from "./claude";
import { AUDIENCE_RULE, audienceFor, type Audience } from "./audience";
import { paypalStatuses } from "./paypal-merchants";
import { rankProducts } from "./ranking";
import type { RankedProduct, Store } from "./types";

type Msg = Anthropic.Beta.BetaMessageParam;

const tools: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "search_products",
    description:
      "Search the live Channel3 product catalog (millions of products across merchants). Results are already PayPal-priority ranked: " +
      "each item has `paypal` = accepts | unknown | no for its best merchant. Use concrete product queries.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string" },
        min_price: { type: "number" },
        max_price: { type: "number" },
      },
    },
  },
  {
    name: "get_product_details",
    description: "Get full details for one product (description, materials, features, all merchant offers and which accept PayPal).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["product_id"],
      properties: { product_id: { type: "string" } },
    },
  },
  {
    name: "find_similar",
    description: "Get recommendations similar to a product (Channel3 similar-products). Results are PayPal-priority ranked.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["product_id"],
      properties: { product_id: { type: "string" }, max_price: { type: "number" } },
    },
  },
  {
    name: "show_products",
    description:
      "Display product cards to the shopper. Call this once at the end with the ids you recommend, best first (max 8). " +
      "Only ids returned by search_products / find_similar / the store catalog are valid.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["product_ids"],
      properties: { product_ids: { type: "array", items: { type: "string" } } },
    },
  },
];

function compact(r: RankedProduct) {
  return { id: r.id, title: r.title, brand: r.brand, price: r.price, merchant: r.domain, paypal: r.paypal, other_merchants: r.offerCount - 1 };
}

export interface AgentResult {
  reply: string;
  products: RankedProduct[];
  trace: { tool: string; input: unknown }[];
}

export async function runShoppingAgent(store: Store, history: { role: "user" | "assistant"; content: string }[]): Promise<AgentResult> {
  const pool = new Map<string, RankedProduct>(store.products.map((p) => [p.id, p]));
  const trace: AgentResult["trace"] = [];
  let shown: string[] = [];

  const system =
    `You are the AI shopping concierge for "${store.name}", a Curatique niche store. Signature niche: ${store.niche}. ` +
    `Tagline: ${store.tagline}.\n` +
    `Help the shopper find products that fit both their request and the store's niche. Use your tools to search the live catalog — ` +
    `don't invent products, prices or merchants. Prefer items whose merchant accepts PayPal (paypal: "accepts"); mention when an item can be paid with PayPal. ` +
    `Non-PayPal items are allowed when they are clearly the better fit — say so. ` +
    `${AUDIENCE_RULE} Include the audience in your search queries (e.g. "women's holiday dress").\n` +
    `Finish by calling show_products with your picks, then give a short, warm answer (2-4 sentences, no markdown lists, no URLs).\n` +
    `The store's curated catalog (you may recommend these directly):\n` +
    JSON.stringify(store.products.slice(0, 40).map(compact));

  const messages: Msg[] = history.slice(-10).map((m) => ({ role: m.role, content: m.content }));

  // Who the shopper is buying for: kids only if the shopper (or a kids-focused store niche) says so;
  // gender from the search words first, then from what the shopper said.
  const shopperText = history.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join(" ");
  const shopper = audienceFor(shopperText);
  const kidsOk = shopper.kids || audienceFor(store.niche).kids;
  const audienceOf = (query: string): Audience => {
    const q = audienceFor(query);
    return { kids: kidsOk && (q.kids || shopper.kids || audienceFor(store.niche).kids), gender: q.gender ?? shopper.gender };
  };
  let reply = "";

  for (let turn = 0; turn < 8; turn++) {
    const msg = await anthropic.beta.messages.create({
      model: model(),
      max_tokens: 16000,
      ...fallbackParams(),
      output_config: { effort: "low" },
      system,
      tools,
      messages,
    });
    if (msg.stop_reason === "refusal") {
      reply = "Sorry — I can't help with that request. Try asking about products in this store.";
      break;
    }
    const text = textOf(msg);
    if (text) reply = text;
    const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (msg.stop_reason !== "tool_use" || uses.length === 0) break;

    messages.push({ role: "assistant", content: msg.content });
    const results = await Promise.all(
      uses.map(async (u): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const input = u.input as Record<string, unknown>;
        trace.push({ tool: u.name, input });
        try {
          let out: unknown;
          if (u.name === "search_products") {
            const ranked = await rankProducts(
              await searchProducts(String(input.query), {
                limit: 15,
                minPrice: input.min_price as number | undefined,
                maxPrice: input.max_price as number | undefined,
                userId: store.slug,
                audience: audienceOf(String(input.query)),
              }),
            );
            ranked.forEach((r) => pool.set(r.id, pool.get(r.id) ?? r));
            out = ranked.slice(0, 12).map(compact);
          } else if (u.name === "find_similar") {
            const ranked = await rankProducts(
              await similarProducts(String(input.product_id), { limit: 10, maxPrice: input.max_price as number | undefined, userId: store.slug, audience: { kids: kidsOk, gender: shopper.gender } }),
            );
            ranked.forEach((r) => pool.set(r.id, pool.get(r.id) ?? r));
            out = ranked.map(compact);
          } else if (u.name === "get_product_details") {
            const p = await getProduct(String(input.product_id), { userId: store.slug });
            const st = await paypalStatuses((p.offers ?? []).map((o) => o.domain));
            out = {
              id: p.id,
              title: p.title,
              brand: p.brands?.[0]?.name,
              description: p.description?.slice(0, 800),
              materials: p.materials,
              key_features: p.key_features?.slice(0, 6),
              ratings: p.ratings,
              offers: (p.offers ?? []).map((o) => ({ merchant: o.domain, price: o.price?.price, availability: o.availability, paypal: st[o.domain] ?? "unknown" })),
            };
          } else if (u.name === "show_products") {
            shown = (input.product_ids as string[]).filter((id) => pool.has(id)).slice(0, 8);
            out = { displayed: shown.length };
          } else {
            throw new Error(`unknown tool ${u.name}`);
          }
          return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: u.id, is_error: true, content: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }

  return { reply: reply.trim(), products: shown.map((id) => pool.get(id)!).filter(Boolean), trace };
}
