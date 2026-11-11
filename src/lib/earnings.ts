import type { Store } from "./types";

// DEMO DATA: affiliate earnings are simulated (clearly labeled in the UI). Real commissions would come
// from Channel3's reporting API (/v1/reporting/transactions) once real sales occur.
export interface EarningRow {
  date: string;
  productTitle: string;
  merchant: string;
  orderValue: number;
  commissionRate: number;
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
  const items = store.products.filter((p) => p.price);
  const rows: EarningRow[] = [];
  const paidThrough = store.payouts.length ? store.payouts[store.payouts.length - 1].createdAt : null;
  for (let i = 0; i < Math.min(12, items.length); i++) {
    const p = items[Math.floor(r() * items.length)];
    const rate = p.commissionRate > 0 ? p.commissionRate : 0.04 + Math.round(r() * 6) / 100;
    const qty = 1 + Math.floor(r() * 2);
    const orderValue = Math.round((p.price ?? 50) * qty * 100) / 100;
    const daysAgo = Math.floor(r() * 28) + 1;
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
    rows.push({
      date,
      productTitle: p.title,
      merchant: p.domain ?? "",
      orderValue,
      commissionRate: rate,
      commission: Math.round(orderValue * rate * 100) / 100,
      status: daysAgo < 5 ? "pending" : paidThrough ? "paid" : "available",
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const sum = (s: EarningRow["status"]) => Math.round(rows.filter((x) => x.status === s).reduce((a, x) => a + x.commission, 0) * 100) / 100;
  return { rows, pending: sum("pending"), available: sum("available"), paid: sum("paid") };
}
