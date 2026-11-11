import "server-only";
import { paypalStatuses } from "./paypal-merchants";
import type { C3Offer, C3Product, PayPalStatus, RankedProduct } from "./types";

// PayPal-priority ranking weights. Relevance (Channel3's order) stays the base signal; PayPal
// acceptance is a strong boost so PayPal-accepting offers float up, while non-PayPal items stay listed.
const PAYPAL_BOOST: Record<PayPalStatus, number> = { accepts: 0.6, unknown: 0.15, no: 0 };

/** Drop offers with implausible prices (e.g. a $1 listing when other merchants sell at $500+). */
export function saneOffers<T extends { price?: { price: number } | null }>(offers: T[]): T[] {
  const prices = offers.map((o) => o.price?.price).filter((p): p is number => typeof p === "number" && p > 0).sort((a, b) => a - b);
  if (prices.length < 2) return offers.filter((o) => (o.price?.price ?? 1) > 0);
  const median = prices[Math.floor(prices.length / 2)];
  return offers.filter((o) => (o.price?.price ?? 0) >= median * 0.2);
}

function bestOffer(all: C3Offer[], st: Record<string, PayPalStatus>): C3Offer | undefined {
  const offers = saneOffers(all);
  const inStock = offers.filter((o) => o.availability !== "OutOfStock");
  const pool = inStock.length ? inStock : offers;
  // Prefer PayPal merchants, then cheapest.
  return [...pool].sort((a, b) => {
    const pa = PAYPAL_BOOST[st[a.domain] ?? "unknown"], pb = PAYPAL_BOOST[st[b.domain] ?? "unknown"];
    if (pa !== pb) return pb - pa;
    return (a.price?.price ?? Infinity) - (b.price?.price ?? Infinity);
  })[0];
}

export function toRanked(p: C3Product, st: Record<string, PayPalStatus>, relevance = 1): RankedProduct {
  const offers = p.offers ?? [];
  const o = bestOffer(offers, st);
  const paypal: PayPalStatus = o ? st[o.domain] ?? "unknown" : "unknown";
  const img = p.images?.find((i) => i.is_main_image) ?? p.images?.[0];
  return {
    id: p.id,
    title: p.title,
    brand: p.brands?.[0]?.name ?? null,
    image: img ? img.cleaned_url || img.url : null,
    price: o?.price?.price ?? null,
    currency: o?.price?.currency ?? "USD",
    domain: o?.domain ?? null,
    url: o?.url ?? null,
    affiliate: (o?.max_commission_rate ?? 0) > 0,
    commissionRate: o?.max_commission_rate ?? 0,
    paypal,
    offerCount: offers.length,
    paypalOfferCount: offers.filter((x) => st[x.domain] === "accepts").length,
    score: relevance + PAYPAL_BOOST[paypal],
  };
}

/** Rank a Channel3 result list with PayPal priority. */
export async function rankProducts(products: C3Product[]): Promise<RankedProduct[]> {
  const domains = [...new Set(products.flatMap((p) => (p.offers ?? []).map((o) => o.domain)))];
  const st = await paypalStatuses(domains);
  const n = Math.max(products.length, 1);
  return products
    .map((p, i) => toRanked(p, st, 1 - i / n))
    .filter((r) => r.url)
    .sort((a, b) => b.score - a.score);
}

/** Re-sort already-ranked products (e.g. a stored catalog) after PayPal statuses changed. */
export async function rerank(items: RankedProduct[]): Promise<RankedProduct[]> {
  const st = await paypalStatuses(items.map((i) => i.domain).filter(Boolean) as string[]);
  return items
    .map((it, i) => {
      const paypal = it.domain ? st[it.domain] ?? "unknown" : "unknown";
      const rel = 1 - i / Math.max(items.length, 1);
      return { ...it, paypal, score: rel + PAYPAL_BOOST[paypal] };
    })
    .sort((a, b) => b.score - a.score);
}

export async function paypalDomainsFor(p: C3Product): Promise<string[]> {
  const domains = saneOffers(p.offers ?? []).map((o) => o.domain);
  const st = await paypalStatuses(domains);
  return domains.filter((d) => st[d] === "accepts");
}
