import "server-only";
import { curate, fetchCandidates, verifyUnknownMerchants } from "./curator";
import { getStore, patchStore } from "./stores";
import type { RankedProduct, Store, StoreQuery } from "./types";

export const INITIAL_PAGE = 50;
export const PAGE_SIZE = 25;

const inflight = new Map<string, Promise<void>>();

function storeQueries(store: Store): { queries: StoreQuery[]; first: boolean } {
  if (store.queries?.length) return { queries: store.queries, first: false };
  // Stores built before queries were saved: derive searches from the niche + collections.
  return { queries: store.collections.map((c) => ({ collection: c, q: `${store.niche} ${c}`, next: null })), first: true };
}

function canExtend(store: Store) {
  return !store.queries?.length || store.queries.some((q) => q.next);
}

/**
 * Grow the catalog: fetch the next Channel3 page for each of the store's searches, have Claude curate
 * the new candidates, append the picks, and save the advanced page tokens.
 */
async function extend(store: Store): Promise<number> {
  let added = 0;
  let current = store;
  for (let round = 0; round < 2 && added < PAGE_SIZE && canExtend(current); round++) {
    const { queries, first } = storeQueries(current);
    const existing = new Set(current.products.map((p) => p.id));
    const { candidates, queries: advanced } = await fetchCandidates(queries, existing, current.slug, first);
    const picks = candidates.length
      ? await curate({
          niche: current.niche,
          storeName: current.name,
          collections: current.collections,
          candidates,
          target: "Pick up to 35 items",
          effort: "low",
        })
      : [];
    current = await patchStore(current.slug, (s) => {
      const have = new Set(s.products.map((p) => p.id));
      const fresh = picks.filter((p) => !have.has(p.id));
      added += fresh.length;
      return { ...s, products: [...s.products, ...fresh], queries: advanced };
    });
    verifyUnknownMerchants(picks);
  }
  return added;
}

/** Next page of products the shopper hasn't seen yet, curating more from Channel3 when the catalog runs low. */
export async function loadMore(
  slug: string,
  seenIds: string[],
): Promise<{ products: RankedProduct[]; hasMore: boolean; notice?: string }> {
  let store = await getStore(slug);
  if (!store) throw new Error("Store not found");
  const seen = new Set(seenIds);
  let remaining = store.products.filter((p) => !seen.has(p.id));

  let notice: string | undefined;
  if (remaining.length < PAGE_SIZE && canExtend(store)) {
    const job = inflight.get(slug) ?? extend(store).then(() => undefined);
    inflight.set(slug, job);
    try {
      await job;
      store = (await getStore(slug))!;
      remaining = store.products.filter((p) => !seen.has(p.id));
    } catch (e) {
      // Curating more failed (e.g. Claude or Channel3 unavailable): still serve what's already curated.
      console.error("catalog extend failed:", e);
      notice = "The AI curator couldn't fetch more pieces right now — try again in a moment.";
      if (!remaining.length) throw new Error(notice);
    } finally {
      inflight.delete(slug);
    }
  }

  return {
    products: remaining.slice(0, PAGE_SIZE),
    hasMore: remaining.length > PAGE_SIZE || canExtend(store),
    notice,
  };
}
