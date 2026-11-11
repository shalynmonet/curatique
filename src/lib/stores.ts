import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { readJSON, updateJSON } from "./db";
import { rerank } from "./ranking";
import type { Store } from "./types";

export const FLAGSHIP_SLUG = "houndstooth";

// The flagship houndstooth catalog is generated once with real Channel3 + Claude calls
// (`npm run seed`) and committed to src/data/flagship.json so the demo loads instantly.
async function flagshipSeed(): Promise<Store | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "src", "data", "flagship.json"), "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return null;
  }
}

/**
 * The flagship lives in the committed seed file; once it's modified at runtime (payouts, catalog
 * growth) a copy is stored on disk. A newer committed seed wins over an older disk copy, keeping payouts.
 */
function resolveFlagship(stored: Store | undefined, seed: Store | null): Store | null {
  if (!seed) return stored ?? null;
  if (!stored || seed.createdAt > stored.createdAt) return { ...seed, payouts: stored?.payouts ?? seed.payouts ?? [] };
  return stored;
}

export async function getStore(slug: string): Promise<Store | null> {
  const all = await readJSON<Record<string, Store>>("stores", {});
  const found = slug === FLAGSHIP_SLUG ? resolveFlagship(all[slug], await flagshipSeed()) : all[slug] ?? null;
  if (!found) return null;
  let s: Store = found;
  // Flagship payouts go to the sandbox receiver configured for this deploy.
  if (s.flagship && process.env.FLAGSHIP_PAYOUT_EMAIL) s = { ...s, founder: { ...s.founder, paypalEmail: process.env.FLAGSHIP_PAYOUT_EMAIL } };
  // Re-apply PayPal-priority ranking so newly verified merchants move up.
  return { ...s, products: await rerank(s.products) };
}

export async function listStores(): Promise<Store[]> {
  const all = await readJSON<Record<string, Store>>("stores", {});
  const flagship = resolveFlagship(all[FLAGSHIP_SLUG], await flagshipSeed());
  const list = Object.values(all).filter((s) => s.slug !== FLAGSHIP_SLUG);
  return [...(flagship ? [flagship] : []), ...list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))];
}

export async function saveStore(store: Store): Promise<Store> {
  await updateJSON<Record<string, Store>>("stores", {}, (cur) => ({ ...cur, [store.slug]: store }));
  return store;
}

export async function uniqueSlug(base: string): Promise<string> {
  const all = await readJSON<Record<string, Store>>("stores", {});
  let slug = base, i = 2;
  while (all[slug] || slug === FLAGSHIP_SLUG) slug = `${base}-${i++}`;
  return slug;
}

export async function patchStore(slug: string, fn: (s: Store) => Store): Promise<Store> {
  let out: Store | null = null;
  const seed = slug === FLAGSHIP_SLUG ? await flagshipSeed() : null;
  await updateJSON<Record<string, Store>>("stores", {}, (cur) => {
    const s = slug === FLAGSHIP_SLUG ? resolveFlagship(cur[slug], seed) : cur[slug];
    if (!s) throw new Error(`Store ${slug} not found`);
    out = fn(s);
    return { ...cur, [slug]: out };
  });
  return out!;
}
