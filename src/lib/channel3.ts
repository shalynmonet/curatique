import "server-only";
import { env } from "./env";
import type { C3Product } from "./types";

// Channel3 v1 API: https://channel3.ai/docs/api
const BASE = "https://api.trychannel3.com/v1";

async function c3<T>(path: string, init: RequestInit & { userId?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    "x-api-key": env.channel3Key(),
    "Content-Type": "application/json",
  };
  // x-user-id is appended by Channel3 to buy URLs for click/sale attribution — we use the store slug.
  if (init.userId) headers["x-user-id"] = init.userId;
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Channel3 ${init.method || "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface SearchOpts {
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  userId?: string;
}

function filters(o: SearchOpts) {
  const f: Record<string, unknown> = { conditions: ["new"], availability: ["InStock"] };
  if (o.minPrice != null || o.maxPrice != null) {
    f.price = { ...(o.minPrice != null && { min_price: o.minPrice }), ...(o.maxPrice != null && { max_price: o.maxPrice }) };
  }
  return f;
}

/** POST /v1/search */
export async function searchProducts(query: string, o: SearchOpts = {}): Promise<C3Product[]> {
  const data = await c3<{ products: C3Product[] }>("/search", {
    method: "POST",
    userId: o.userId,
    body: JSON.stringify({
      query,
      limit: Math.min(o.limit ?? 20, 30),
      filters: filters(o),
      config: { country: "US", currency: "USD", language: "en" },
    }),
  });
  return data.products ?? [];
}

/**
 * GET /v1/products/{id} — product enrichment/detail. `websiteIds` (domains accepted) constrains the
 * buy URL to those merchants; we pass PayPal-accepting domains so Buy points at a PayPal merchant.
 */
export async function getProduct(id: string, o: { websiteIds?: string[]; userId?: string } = {}): Promise<C3Product> {
  const qs = new URLSearchParams({ country: "US", currency: "USD", language: "en" });
  for (const w of o.websiteIds ?? []) qs.append("website_ids", w);
  return c3<C3Product>(`/products/${encodeURIComponent(id)}?${qs}`, { userId: o.userId });
}

/** POST /v1/similar — recommendations seeded by a product */
export async function similarProducts(productId: string, o: SearchOpts = {}): Promise<C3Product[]> {
  const data = await c3<{ products: C3Product[] }>("/similar", {
    method: "POST",
    userId: o.userId,
    body: JSON.stringify({
      product_id: productId,
      limit: Math.min(o.limit ?? 8, 30),
      filters: filters(o),
      config: { country: "US", currency: "USD", language: "en" },
    }),
  });
  return data.products ?? [];
}

/** POST /v1/lookup — enrich any product URL into a full Channel3 product */
export async function lookupUrl(url: string, userId?: string): Promise<C3Product> {
  const data = await c3<{ product: C3Product }>("/lookup", {
    method: "POST",
    userId,
    body: JSON.stringify({ url }),
  });
  return data.product;
}
