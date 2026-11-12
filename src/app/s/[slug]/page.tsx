import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentChat } from "@/components/AgentChat";
import { AffiliateDisclosure } from "@/components/Disclosure";
import { patternCss } from "@/components/pattern";
import { PayPalVerifier } from "@/components/PayPalVerifier";
import { ProductGrid } from "@/components/ProductGrid";
import { INITIAL_PAGE } from "@/lib/catalog";
import { getStore } from "@/lib/stores";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const t = store.theme;
  const unknownDomains = [...new Set(store.products.filter((p) => p.paypal === "unknown" && p.domain).map((p) => p.domain!))];
  const paypalCount = store.products.filter((p) => p.paypal === "accepts").length;
  const canGrow = !store.queries?.length || store.queries.some((q) => q.next);
  const suggestions = [
    `Show me the best ${store.niche} pieces under $150`,
    `I need a gift — what's your favorite item I can pay for with PayPal?`,
    `Something like the top pick, but cheaper`,
  ];

  return (
    <div style={{ background: t.background, color: t.text }} className="min-h-screen">
      {store.status === "draft" && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
          Preview — this store isn&apos;t live yet.{" "}
          <Link href={`/founder/${store.slug}`} className="underline">
            Launch it with PayPal
          </Link>
        </div>
      )}
      <header
        className="relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: store.heroImage ? `url("${store.heroImage}")` : patternCss(t), backgroundColor: t.primary }}
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="inline-block max-w-xl rounded-xl p-6 shadow-lg sm:p-8" style={{ background: t.background, color: t.text }}>
            <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: t.accent }}>
              {store.niche}
            </div>
            <h1 className="font-display mt-2 text-4xl sm:text-5xl">{store.name}</h1>
            <p className="mt-2 text-lg opacity-80">{store.heroCopy}</p>
            <p className="mt-4 text-sm opacity-70">{store.tagline}</p>
            <div className="mt-4 text-xs opacity-60">
              {store.products.length}+ curated pieces · {paypalCount} payable with PayPal · curated by {store.founder.name}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
        <AgentChat slug={store.slug} storeName={store.name} suggestions={suggestions} />

        {unknownDomains.length > 0 && <PayPalVerifier domains={unknownDomains} />}

        <ProductGrid
          slug={store.slug}
          initial={store.products.slice(0, INITIAL_PAGE)}
          initialHasMore={store.products.length > INITIAL_PAGE || canGrow}
        />

        <section className="rounded-xl bg-white/80 p-6 text-sm text-neutral-700">
          <h3 className="font-display mb-2 text-lg text-black">About {store.name}</h3>
          <p>{store.about}</p>
          <p className="mt-3 text-xs text-neutral-500">
            Ranking: items sold by merchants that accept PayPal are boosted and carry a “Pay with PayPal” badge; other items are still shown, ranked lower.
          </p>
        </section>
        <AffiliateDisclosure />
      </main>
      <footer className="border-t border-black/10 py-6 text-center text-xs opacity-60">
        <Link href="/">Powered by Curatique</Link> · Catalog by Channel3 · AI by Claude · Payments by PayPal
      </footer>
    </div>
  );
}
