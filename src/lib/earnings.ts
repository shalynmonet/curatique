import type { Store } from "./types";

// DEMO DATA: no real sales have happened, so sales are simulated (and labeled as demo data in the UI).
// To stay honest, only items with a real Channel3 affiliate commission can "sell", at their real
// Channel3 rate, and the founder's commission is Channel3's published payout share of that rate.
// Real commissions would come from Channel3's reporting API (/v1/reporting/transactions).

/** Channel3 keeps 50% of commissions ("We take a 50% cut of commissions paid out on our platform"). */
export const CHANNEL3_PAYOUT_SHARE = 0.5;

export interface EarningRow {
  date: string;
  productTitle: string;
  merchant: string;
  orderValue: number;
  /** Channel3's max commission rate for the offer (real) */
  commissionRate: number;
  /** Founder's commission after Channel3's share */
  commission: number;
  status: "pending" | "available" | "paid";
}

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function sampleEarnings(store: Store) {
  const r = rng(store.slug);
  // Only real affiliate items can earn a commission.
  const items = store.products.filter((p) => p.price && p.affiliate && p.commissionRate > 0);
  const rows: EarningRow[] = [];
  const paidThrough = store.payouts.length ? store.payouts[store.payouts.length - 1].createdAt : null;
  for (let i = 0; i < Math.min(12, items.length); i++) {
    const p = items[Math.floor(r() * items.length)];
    const qty = 1 + Math.floor(r() * 2);
    const orderValue = Math.round((p.price ?? 0) * qty * 100) / 100;
    const daysAgo = Math.floor(r() * 28) + 1;
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
    rows.push({
      date,
      productTitle: p.title,
      merchant: p.domain ?? "",
      orderValue,
      commissionRate: p.commissionRate,
      commission: Math.round(orderValue * p.commissionRate * CHANNEL3_PAYOUT_SHARE * 100) / 100,
      status: daysAgo < 5 ? "pending" : paidThrough ? "paid" : "available",
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const sum = (s: EarningRow["status"]) => Math.round(rows.filter((x) => x.status === s).reduce((a, x) => a + x.commission, 0) * 100) / 100;
  return { rows, pending: sum("pending"), available: sum("available"), paid: sum("paid"), affiliateItems: items.length };
}
