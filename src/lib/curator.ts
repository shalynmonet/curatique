import "server-only";
import { searchProducts } from "./channel3";
import { claudeJSON } from "./claude";
import { checkDomain } from "./paypal-merchants";
import { rankProducts, rerank } from "./ranking";
import type { RankedProduct, Store, StoreTheme } from "./types";

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
      description: "3-5 collections; each has 2-3 concrete product search queries a shopping search engine understands",
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
    effort: "medium",
  });

  const slug = input.slug ?? slugify(plan.name);

  // Run every search in parallel against Channel3.
  const searches = plan.collections.flatMap((c) => c.queries.slice(0, 3).map((q) => ({ collection: c.name, q })));
  const results = await Promise.allSettled(searches.map((s) => searchProducts(s.q, { limit: 12, userId: slug })));
  const seen = new Map<string, { p: Awaited<ReturnType<typeof searchProducts>>[number]; collection: string; q: string }>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    for (const p of r.value) if (!seen.has(p.id)) seen.set(p.id, { p, collection: searches[i].collection, q: searches[i].q });
  });
  if (seen.size === 0) {
    const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw new Error(`Channel3 returned no products for this niche. ${firstErr ? String(firstErr.reason) : ""}`);
  }

  const ranked = await rankProducts([...seen.values()].map((v) => v.p));
  const byId = new Map(ranked.map((r) => [r.id, r]));

  const candidates = ranked.map((r) => ({
    id: r.id,
    title: r.title,
    brand: r.brand,
    price: r.price,
    merchant: r.domain,
    pays_with_paypal: r.paypal,
    found_via: seen.get(r.id)?.q,
    materials: seen.get(r.id)?.p.materials?.slice(0, 3),
  }));

  const { picks } = await claudeJSON<{ picks: { id: string; collection: string; note: string }[] }>({
    system:
      "You are a ruthless niche merchandiser. From candidate products, select only items that truly fit the store's signature niche " +
      "(e.g. for houndstooth: the item itself must be houndstooth/dogstooth patterned — reject plain items that merely matched a keyword). " +
      "Aim for 16-28 picks spread across the collections, varied in brand, merchant and price. " +
      "Select purely on niche fit, quality and variety — do NOT drop items because of their merchant or payment method; PayPal-priority ranking is applied afterwards. " +
      "Use only ids from the candidate list and only the given collection names.",
    user: JSON.stringify({
      niche: input.niche,
      store: plan.name,
      collections: plan.collections.map((c) => c.name),
      candidates,
    }),
    schema: pickSchema,
    effort: "medium",
  });

  let products: RankedProduct[] = picks
    .filter((p) => byId.has(p.id))
    .map((p) => ({ ...byId.get(p.id)!, collection: p.collection, note: p.note }));
  products = await rerank(products);

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
    payouts: [],
    createdAt: new Date().toISOString(),
  };

  // Background: have the agent verify PayPal acceptance for the catalog's unknown merchants.
  const unknown = [...new Set(products.filter((p) => p.paypal === "unknown" && p.domain).map((p) => p.domain!))].slice(0, 8);
  void Promise.allSettled(unknown.map((d) => checkDomain(d)));

  return store;
}
