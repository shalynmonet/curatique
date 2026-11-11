import "server-only";
import { z } from "zod";
import { anthropic, BETAS, model, textOf } from "./claude";
import { readJSON, updateJSON } from "./db";
import type { PayPalStatus } from "./types";

export interface MerchantRecord {
  domain: string;
  acceptsPayPal: boolean | null; // null = could not determine
  source: "seed" | "llm";
  evidence?: string;
  evidenceUrl?: string;
  checkedAt: string;
}

/**
 * Seed list of merchant domains known to offer PayPal at checkout (US). Unknown domains are checked
 * by the Claude agent (web search + fetch of the retailer's checkout / payment FAQ) and cached.
 */
const SEED_ACCEPTS = [
  "ebay.com", "etsy.com", "target.com", "bestbuy.com", "nordstrom.com", "nordstromrack.com", "macys.com",
  "bloomingdales.com", "saksfifthavenue.com", "neimanmarcus.com", "asos.com", "farfetch.com", "ssense.com",
  "revolve.com", "zara.com", "hm.com", "uniqlo.com", "jcrew.com", "gap.com", "oldnavy.com", "bananarepublic.com",
  "anthropologie.com", "urbanoutfitters.com", "freepeople.com", "net-a-porter.com", "mrporter.com",
  "mytheresa.com", "matchesfashion.com", "lululemon.com", "adidas.com", "newbalance.com", "puma.com",
  "wayfair.com", "homedepot.com", "lowes.com", "apple.com", "dell.com", "newegg.com", "overstock.com",
  "kohls.com", "jcpenney.com", "ralphlauren.com", "brooksbrothers.com", "bonobos.com", "everlane.com",
  "madewell.com", "abercrombie.com", "hollisterco.com", "ae.com", "express.com", "forever21.com",
  "shein.com", "boohoo.com", "prettylittlething.com", "lulus.com", "torrid.com", "dsw.com", "zappos.com",
  "6pm.com", "endclothing.com", "selfridges.com", "harrods.com", "johnlewis.com", "marksandspencer.com",
];
const SEED_NO = ["amazon.com", "costco.com", "walmart.com"];

function normalize(domain: string) {
  return domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

let memo: Record<string, MerchantRecord> | null = null;

async function table(): Promise<Record<string, MerchantRecord>> {
  if (memo) return memo;
  const stored = await readJSON<Record<string, MerchantRecord>>("paypal-merchants", {});
  const now = new Date(0).toISOString();
  const seeded: Record<string, MerchantRecord> = {};
  for (const d of SEED_ACCEPTS) seeded[d] = { domain: d, acceptsPayPal: true, source: "seed", checkedAt: now };
  for (const d of SEED_NO) seeded[d] = { domain: d, acceptsPayPal: false, source: "seed", checkedAt: now };
  memo = { ...seeded, ...stored };
  return memo;
}

function lookup(t: Record<string, MerchantRecord>, domain: string): MerchantRecord | undefined {
  const d = normalize(domain);
  if (t[d]) return t[d];
  // subdomains: shop.brand.com -> brand.com
  const parts = d.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (t[parent]) return t[parent];
  }
  return undefined;
}

export async function paypalStatus(domain: string | null | undefined): Promise<PayPalStatus> {
  if (!domain) return "unknown";
  const r = lookup(await table(), domain);
  if (!r || r.acceptsPayPal === null) return "unknown";
  return r.acceptsPayPal ? "accepts" : "no";
}

export async function paypalStatuses(domains: string[]): Promise<Record<string, PayPalStatus>> {
  const t = await table();
  const out: Record<string, PayPalStatus> = {};
  for (const d of domains) {
    const r = lookup(t, d);
    out[d] = !r || r.acceptsPayPal === null ? "unknown" : r.acceptsPayPal ? "accepts" : "no";
  }
  return out;
}

export async function listMerchants(): Promise<MerchantRecord[]> {
  return Object.values(await table()).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
}

const Verdict = z.object({
  accepts_paypal: z.enum(["yes", "no", "unknown"]),
  evidence: z.string(),
  evidence_url: z.string().optional().default(""),
});

const inflight = new Map<string, Promise<MerchantRecord>>();

/**
 * LLM agent check: Claude uses web search + web fetch to read the retailer's checkout / payment
 * methods FAQ and decides whether PayPal is accepted. Result is cached in the merchant table.
 */
export async function checkDomain(rawDomain: string): Promise<MerchantRecord> {
  const domain = normalize(rawDomain);
  const existing = lookup(await table(), domain);
  if (existing && existing.acceptsPayPal !== null) return existing;
  if (inflight.has(domain)) return inflight.get(domain)!;

  const job = (async () => {
    const messages: Parameters<typeof anthropic.beta.messages.create>[0]["messages"] = [
      {
        role: "user",
        content:
          `Determine whether the online retailer at ${domain} accepts PayPal as a payment method at checkout for US shoppers.\n` +
          `Search for and read the retailer's own payment methods / checkout / FAQ / help page on ${domain} (prefer the retailer's own site over third-party sources). ` +
          `A PayPal logo in the site footer or "Pay with PayPal"/"PayPal Pay Later" at checkout counts as yes. Shopify stores that list PayPal in accepted payments count as yes.\n` +
          `When done, reply with ONLY a JSON object: {"accepts_paypal":"yes"|"no"|"unknown","evidence":"<one sentence quoting or summarizing what you found>","evidence_url":"<url>"}`,
      },
    ];
    let text = "";
    for (let turn = 0; turn < 4; turn++) {
      const msg = await anthropic.beta.messages.create({
        model: model(),
        max_tokens: 16000,
        betas: BETAS,
        fallbacks: "default",
        output_config: { effort: "low" },
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 3 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
        ],
        messages,
      });
      text = textOf(msg);
      if (msg.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      break;
    }
    let verdict: z.infer<typeof Verdict> = { accepts_paypal: "unknown", evidence: "No verdict returned.", evidence_url: "" };
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = Verdict.safeParse(JSON.parse(m[0]));
        if (parsed.success) verdict = parsed.data;
      } catch {
        /* keep unknown */
      }
    }
    const rec: MerchantRecord = {
      domain,
      acceptsPayPal: verdict.accepts_paypal === "yes" ? true : verdict.accepts_paypal === "no" ? false : null,
      source: "llm",
      evidence: verdict.evidence,
      evidenceUrl: verdict.evidence_url || undefined,
      checkedAt: new Date().toISOString(),
    };
    await updateJSON<Record<string, MerchantRecord>>("paypal-merchants", {}, (cur) => ({ ...cur, [domain]: rec }));
    if (memo) memo[domain] = rec;
    return rec;
  })();
  inflight.set(domain, job);
  try {
    return await job;
  } finally {
    inflight.delete(domain);
  }
}
