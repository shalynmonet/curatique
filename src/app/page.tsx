import Link from "next/link";
import { patternCss } from "@/components/pattern";
import { FLAGSHIP_SLUG, listStores } from "@/lib/stores";

export const dynamic = "force-dynamic";

const houndstooth = patternCss({ primary: "#111111", accent: "#b91c1c", background: "#faf9f6", text: "#111111", pattern: "houndstooth" }, 28);

export default async function Home() {
  const stores = await listStores();
  return (
    <div className="min-h-screen">
      <header style={{ backgroundImage: houndstooth }}>
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-2xl rounded-2xl bg-[#faf9f6] p-8 shadow-xl sm:p-10">
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Curatique</div>
            <h1 className="font-display mt-3 text-5xl leading-tight">Signature-niche stores, curated by AI, paid with PayPal.</h1>
            <p className="mt-4 text-neutral-600">
              Founders name a niche. A Claude agent builds the catalog from Channel3&apos;s live product graph and brands the storefront. Shoppers get an AI
              concierge that puts PayPal-accepting merchants first. Founders launch with PayPal Checkout and get paid with PayPal Payouts.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/s/${FLAGSHIP_SLUG}`} className="rounded-md bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800">
                Shop the Houndstooth flagship
              </Link>
              <Link href="/founder" className="rounded-md border border-black px-5 py-3 text-sm font-semibold hover:bg-black hover:text-white">
                Launch your own store
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            ["1 · Curate", "Claude plans searches, queries Channel3 (search, product detail, similar), and rejects anything off-niche."],
            ["2 · PayPal-first", "Merchants are checked against a cached PayPal-acceptance table; unknown retailers are verified by the agent reading their payment FAQ. PayPal offers rank higher and Buy buttons point to them."],
            ["3 · Launch & earn", "PayPal Checkout for the launch fee; PayPal Payouts send founders their affiliate earnings (sample data in this demo)."],
          ].map(([h, b]) => (
            <div key={h} className="rounded-xl border border-black/10 bg-white p-5">
              <h3 className="font-display text-xl">{h}</h3>
              <p className="mt-2 text-sm text-neutral-600">{b}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display mt-14 text-3xl">Stores</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <div key={s.slug} className="overflow-hidden rounded-xl border border-black/10 bg-white">
              <div className="h-16" style={{ backgroundImage: patternCss(s.theme), backgroundColor: s.theme.primary }} />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl">{s.name}</h3>
                  <span className="text-[10px] uppercase text-neutral-500">{s.status}</span>
                </div>
                <p className="text-xs text-neutral-500">{s.niche} · {s.products.length} items</p>
                <div className="mt-3 flex gap-3 text-sm">
                  <Link className="underline" href={`/s/${s.slug}`}>Storefront</Link>
                  <Link className="underline" href={`/founder/${s.slug}`}>Founder dashboard</Link>
                </div>
              </div>
            </div>
          ))}
          {stores.length === 0 && <p className="text-sm text-neutral-500">No stores yet — run the flagship seed or launch one.</p>}
        </div>
        <p className="mt-10 text-xs text-neutral-500">
          <Link href="/merchants" className="underline">PayPal merchant table</Link> · Some product links are affiliate links; see each store&apos;s disclosure.
        </p>
      </main>
    </div>
  );
}
