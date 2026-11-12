import "server-only";
import { looksLikeKids } from "./audience";
import { getProduct, similarProducts } from "./channel3";
import { paypalStatuses } from "./paypal-merchants";
import { paypalDomainsFor, rankProducts, saneOffers } from "./ranking";
import type { C3Product, PayPalStatus, RankedProduct } from "./types";

export interface ProductView {
  product: C3Product;
  buy: { url: string; domain: string; price: number | null; paypal: PayPalStatus; affiliate: boolean } | null;
  offers: { domain: string; price: number | null; url: string; paypal: PayPalStatus; affiliate: boolean; availability: string }[];
  similar: RankedProduct[];
  constrainedTo: string[];
}

/**
 * Product detail with PayPal-first buy link: fetch once to learn the merchants, then (if any accept
 * PayPal) re-request with website_ids = those domains so Channel3 returns a PayPal-merchant buy URL.
 */
export async function getProductView(id: string, storeSlug?: string): Promise<ProductView> {
  let product = await getProduct(id, { userId: storeSlug });
  const paypalDomains = await paypalDomainsFor(product);
  if (paypalDomains.length) {
    try {
      const constrained = await getProduct(id, { websiteIds: paypalDomains, userId: storeSlug });
      if (constrained.offers?.length) product = { ...constrained, offers: mergeOffers(constrained, product) };
    } catch {
      /* fall back to unconstrained */
    }
  }
  product = { ...product, offers: saneOffers(product.offers ?? []) };
  const st = await paypalStatuses((product.offers ?? []).map((o) => o.domain));
  const offers = (product.offers ?? [])
    .map((o) => ({
      domain: o.domain,
      price: o.price?.price ?? null,
      url: o.url,
      paypal: st[o.domain] ?? ("unknown" as PayPalStatus),
      affiliate: (o.max_commission_rate ?? 0) > 0,
      availability: o.availability,
    }))
    .sort((a, b) => Number(b.paypal === "accepts") - Number(a.paypal === "accepts") || (a.price ?? 1e9) - (b.price ?? 1e9));
  const best = offers.find((o) => o.availability !== "OutOfStock") ?? offers[0];
  let similar: RankedProduct[] = [];
  try {
    similar = (await rankProducts(await similarProducts(id, {
          limit: 8,
          userId: storeSlug,
          // Recommendations stay in the viewed item's audience (adult item -> adult suggestions).
          audience: { kids: looksLikeKids(product), gender: product.gender ?? undefined },
        }))).slice(0, 8);
  } catch {
    /* recommendations are optional */
  }
  return {
    product,
    buy: best ? { url: best.url, domain: best.domain, price: best.price, paypal: best.paypal, affiliate: best.affiliate } : null,
    offers,
    similar,
    constrainedTo: paypalDomains,
  };
}

// Constrained call's offers come first (PayPal merchant buy URLs); keep other merchants for transparency.
function mergeOffers(constrained: C3Product, full: C3Product) {
  const first = constrained.offers ?? [];
  const seen = new Set(first.map((o) => o.domain));
  return [...first, ...(full.offers ?? []).filter((o) => !seen.has(o.domain))];
}
