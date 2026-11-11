"use client";

import { useState } from "react";
import type { RankedProduct } from "@/lib/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ slug, initial, initialHasMore }: { slug: string; initial: RankedProduct[]; initialHasMore: boolean }) {
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(slug)}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seen: items.map((p) => p.id) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load more");
      const have = new Set(items.map((p) => p.id));
      const fresh = (j.products as RankedProduct[]).filter((p) => !have.has(p.id));
      setItems((cur) => [...cur, ...fresh]);
      setHasMore(j.hasMore && (fresh.length > 0 || Boolean(j.notice)));
      if (j.notice) setError(j.notice);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-2xl">The edit</h2>
        <span className="text-xs opacity-60">{items.length} pieces shown · PayPal merchants first</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} p={p} slug={slug} />
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2">
        {hasMore ? (
          <button
            onClick={loadMore}
            disabled={busy}
            className="rounded-md border border-current px-6 py-3 text-sm font-semibold hover:bg-black hover:text-white disabled:opacity-60"
          >
            {busy ? "Curating more pieces…" : "Load 25 more"}
          </button>
        ) : (
          <p className="text-xs opacity-60">That&apos;s the whole edit for now.</p>
        )}
        {busy && <p className="text-xs opacity-60">If we&apos;ve shown everything curated so far, the AI curator pulls fresh Channel3 results — this can take ~20s.</p>}
        {error && <p className="text-sm opacity-70">{error}</p>}
      </div>
    </section>
  );
}
