import Link from "next/link";
import { notFound } from "next/navigation";
import { LaunchCheckout } from "@/components/LaunchCheckout";
import { PayoutPanel } from "@/components/PayoutPanel";
import { PayPalBadge } from "@/components/PayPalBadge";
import { money } from "@/components/ProductCard";
import { sampleEarnings } from "@/lib/earnings";
import { env } from "@/lib/env";
import { getStore } from "@/lib/stores";

export const dynamic = "force-dynamic";

export default async function FounderDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  const earnings = sampleEarnings(store);
  const paypalCount = store.products.filter((p) => p.paypal === "accepts").length;
  const affCount = store.products.filter((p) => p.affiliate).length;
  let clientId = "";
  try {
    clientId = env.paypalClientId();
  } catch {
    /* shown below */
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm underline opacity-70">← Curatique</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-neutral-500">Founder dashboard · {store.founder.name}</div>
          <h1 className="font-display text-4xl">{store.name}</h1>
          <p className="text-neutral-600">{store.tagline}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${store.status === "live" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
            {store.status === "live" ? "LIVE" : "DRAFT"}
          </span>
          <Link href={`/s/${store.slug}`} className="rounded-md border border-black px-4 py-2 text-sm font-medium hover:bg-black hover:text-white">
            View storefront →
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Curated products" value={String(store.products.length)} />
        <Stat label="Payable with PayPal" value={`${paypalCount} / ${store.products.length}`} />
        <Stat label="Affiliate-enabled links" value={`${affCount} / ${store.products.length}`} />
      </div>

      <section className="mt-8 rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-display text-2xl">1 · Launch with PayPal Checkout</h2>
        {store.status === "live" && store.launch ? (
          <p className="mt-2 text-sm text-green-700">
            Paid {store.launch.amount} via PayPal{store.launch.payer ? ` by ${store.launch.payer}` : ""} · capture {store.launch.captureId} · order{" "}
            {store.launch.orderId}
          </p>
        ) : store.status === "live" ? (
          <p className="mt-2 text-sm text-neutral-600">Flagship demo store — pre-launched. Build your own store to try PayPal Checkout.</p>
        ) : clientId ? (
          <div className="mt-4 max-w-sm">
            <LaunchCheckout slug={store.slug} clientId={clientId} fee={env.launchFee()} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-red-600">PAYPAL_CLIENT_ID is not configured.</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">2 · Affiliate earnings</h2>
          <span className="rounded bg-amber-400 px-2 py-1 text-xs font-bold uppercase tracking-wide text-black">Demo data — simulated earnings</span>
        </div>
        <p className="mt-1 text-xs text-amber-900">
          These commission rows are sample data generated from your catalog for the demo. No real sales have occurred. The payout below is a real PayPal
          Payouts API call in the sandbox.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Pending (demo)" value={money(earnings.pending)} />
          <Stat label="Available (demo)" value={money(earnings.available)} />
          <Stat label="Paid out (demo)" value={money(earnings.paid)} />
        </div>
        <div className="mt-5">
          <PayoutPanel slug={store.slug} available={earnings.available} receiver={store.founder.paypalEmail} payouts={store.payouts} />
        </div>
        <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-1">Date</th>
              <th>Product</th>
              <th>Merchant</th>
              <th>Order</th>
              <th>Rate</th>
              <th>Commission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {earnings.rows.map((r, i) => (
              <tr key={i} className="border-t border-amber-200">
                <td className="py-1.5">{r.date}</td>
                <td className="max-w-[220px] truncate">{r.productTitle}</td>
                <td>{r.merchant}</td>
                <td>{money(r.orderValue)}</td>
                <td>{(r.commissionRate * 100).toFixed(1)}%</td>
                <td>{money(r.commission)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-display text-2xl">3 · Your AI-curated catalog</h2>
        <p className="mt-1 text-sm text-neutral-600">Collections: {store.collections.join(" · ")}</p>
        <ul className="mt-4 divide-y divide-black/5 text-sm">
          {store.products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              {p.image && <img src={p.image} alt="" className="h-12 w-12 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.title}</div>
                <div className="truncate text-xs text-neutral-500">
                  {p.collection} · {p.domain} · {p.note}
                </div>
              </div>
              <PayPalBadge status={p.paypal} />
              <div className="w-20 text-right">{money(p.price)}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
