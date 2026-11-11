import "server-only";
import { searchPage } from "./channel3";
import { claudeJSON, curatorModel } from "./claude";
import { checkDomain } from "./paypal-merchants";
import { rankProducts, rerank } from "./ranking";
import type { C3Product, RankedProduct, Store, StoreQuery, StoreTheme } from "./types";

interface Plan {
  name: string;
  tagline: string;
  about: string;
  heroCopy: string;
  theme: StoreTheme;
  collections: { name: string; queries: string[] }[];
}

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "tagline", "about", "heroCopy", "theme", "collections"],
  properties: {
    name: { type: "string", description: "Short, memorable store name (1-3 words)" },
    tagline: { type: "string", description: "One-line tagline, under 70 characters" },
    about: { type: "string", description: "2-3 sentence founder-voice 'about this store' paragraph" },
    heroCopy: { type: "string", description: "Hero headline, under 60 characters" },
    theme: {
      type: "object",
      additionalProperties: false,
      required: ["primary", "accent", "background", "text", "pattern"],
      properties: {
        primary: { type: "string", description: "hex color like #111111" },
        accent: { type: "string", description: "hex color" },
        background: { type: "string", description: "hex color, light enough for dark text unless text is light" },
        text: { type: "string", description: "hex color with strong contrast against background" },
        pattern: { type: "string", enum: ["houndstooth", "stripes", "dots", "grid", "none"] },
      },
    },
    collections: {
      type: "array",
      description: "4-5 collections; each has 3-4 distinct, concrete product search queries a shopping search engine understands (vary item type, gender and price tier so the catalog can grow past 100 items)",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "queries"],
        properties: {
          name: { type: "string" },
          queries: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const pickSchema = {
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "collection", "note"],
        properties: {
          id: { type: "string" },
          collection: { type: "string" },
          note: { type: "string", description: "One-sentence curator note on why it belongs, under 110 chars" },
        },
      },
    },
  },
};

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "store";
}

/** Founder flow: niche -> Claude plans brand + search strategy -> Channel3 searches -> Claude curates. */
export async function buildStore(input: { niche: string; founderName: string; paypalEmail: string; slug?: string }) {
  const plan = await claudeJSON<Plan>({
    system:
      "You are Curatique's brand strategist and merchandiser. Founders give you a 'signature niche' and you design a focused, tasteful niche storefront. " +
      "Search queries must be concrete product searches (e.g. 'houndstooth wool blazer women') that will return real purchasable products — never vague themes.",
    user: `Signature niche: "${input.niche}". Founder: ${input.founderName}. Design the store brand, theme and collections.`,
    schema: planSchema,
    model: curatorModel(),
    effort: "medium",
  });

  const slug = input.slug ?? slugify(plan.name);
  const queries: StoreQuery[] = plan.collections.flatMap((c) => c.queries.slice(0, 4).map((q) => ({ collection: c.name, q, next: null })));

  // Run every search in parallel against Channel3 (30 per query = the API max per page).
  const { candidates, queries: advanced, errors } = await fetchCandidates(queries, new Set(), slug, true);
  if (candidates.length === 0) throw new Error(`Channel3 returned no products for this niche. ${errors[0] ?? ""}`);

  const products = await curate({
    niche: input.niche,
    storeName: plan.name,
    collections: plan.collections.map((c) => c.name),
    candidates,
    target: "Aim for 55-75 picks",
    effort: "medium",
  });

  const store: Store = {
    slug,
    niche: input.niche,
    name: plan.name,
    tagline: plan.tagline,
    about: plan.about,
    heroCopy: plan.heroCopy,
    theme: plan.theme,
    collections: plan.collections.map((c) => c.name),
    founder: { name: input.founderName, paypalEmail: input.paypalEmail },
    status: "draft",
    products,
    queries: advanced,
    payouts: [],
    createdAt: new Date().toISOString(),
  };
  verifyUnknownMerchants(products);
  return store;
}

interface Candidate {
  product: C3Product;
  q: string;
}

/**
 * Run the store's Channel3 searches (first page, or the next page via page_token) and return
 * products not already in the catalog. `next` on each query is advanced; exhausted queries get null.
 */
export async function fetchCandidates(queries: StoreQuery[], exclude: Set<string>, slug: string, first = false) {
  const active = first ? queries : queries.filter((q) => q.next);
  const results = await Promise.allSettled(
    active.map((q) => searchPage(q.q, { limit: 30, userId: slug, pageToken: first ? null : q.next })),
  );
  const out = new Map<string, Candidate>();
  const errors: string[] = [];
  const nextByQuery = new Map<StoreQuery, string | null>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") {
      errors.push(String(r.reason));
      return;
    }
    nextByQuery.set(active[i], r.value.next);
    for (const p of r.value.products) if (!exclude.has(p.id) && !out.has(p.id)) out.set(p.id, { product: p, q: active[i].q });
  });
  const advanced = queries.map((q) => (nextByQuery.has(q) ? { ...q, next: nextByQuery.get(q) ?? null } : first ? { ...q, next: null } : q));
  return { candidates: [...out.values()], queries: advanced, errors };
}

/** Claude selects the on-niche items from Channel3 candidates and writes curator notes. */
export async function curate(opts: {
  niche: string;
  storeName: string;
  collections: string[];
  candidates: Candidate[];
  target: string;
  effort: "low" | "medium";
}): Promise<RankedProduct[]> {
  const ranked = await rankProducts(opts.candidates.map((c) => c.product));
  const byId = new Map(ranked.map((r) => [r.id, r]));
  const meta = new Map(opts.candidates.map((c) => [c.product.id, c]));

  const { picks } = await claudeJSON<{ picks: { id: string; collection: string; note: string }[] }>({
    system:
      "You are a ruthless niche merchandiser. From candidate products, select only items that truly fit the store's signature niche " +
      "(e.g. for houndstooth: the item itself must be houndstooth/dogstooth patterned — reject plain items that merely matched a keyword). " +
      `${opts.target}, spread across the collections, varied in brand, merchant and price; never pad with off-niche items — fewer is fine if the candidates are weak. ` +
      "Select purely on niche fit, quality and variety — do NOT drop items because of their merchant or payment method; PayPal-priority ranking is applied afterwards. " +
      "Skip near-duplicates (same item in another colorway or size listing). Use only ids from the candidate list and only the given collection names.",
    user: JSON.stringify({
      niche: opts.niche,
      store: opts.storeName,
      collections: opts.collections,
      candidates: ranked.map((r) => ({
        id: r.id,
        title: r.title,
        brand: r.brand,
        price: r.price,
        merchant: r.domain,
        found_via: meta.get(r.id)?.q,
        materials: meta.get(r.id)?.product.materials?.slice(0, 3),
      })),
    }),
    schema: pickSchema,
    model: curatorModel(),
    effort: opts.effort,
    maxTokens: 64000,
  });

  const seen = new Set<string>();
  const products = picks
    .filter((p) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ ...byId.get(p.id)!, collection: p.collection, note: p.note }));
  return rerank(products);
}

/** Background: have the agent verify PayPal acceptance for unknown merchants in a batch of products. */
export function verifyUnknownMerchants(products: RankedProduct[]) {
  const unknown = [...new Set(products.filter((p) => p.paypal === "unknown" && p.domain).map((p) => p.domain!))].slice(0, 8);
  void Promise.allSettled(unknown.map((d) => checkDomain(d)));
}
