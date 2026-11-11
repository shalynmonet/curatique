import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateDisclosure } from "@/components/Disclosure";
import { PayPalBadge } from "@/components/PayPalBadge";
import { PayPalVerifier } from "@/components/PayPalVerifier";
import { money, ProductCard } from "@/components/ProductCard";
import { getProductView } from "@/lib/product-view";
import { getStore } from "@/lib/stores";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  let view;
  try {
    view = await getProductView(decodeURIComponent(id), slug);
  } catch (e) {
    return (
      <div className="mx-auto max-w-3xl p-10 text-sm">
        Couldn&apos;t load this product from Channel3: {e instanceof Error ? e.message : String(e)}{" "}
        <Link className="underline" href={`/s/${slug}`}>Back to store</Link>
      </div>
    );
  }
  const { product: p, buy, offers, similar, constrainedTo } = view;
  const curated = store.products.find((x) => x.id === p.id);
  const imgs = (p.images ?? []).slice(0, 5);

  return (
    <div className="min-h-screen" style={{ background: store.theme.background, color: store.theme.text }}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href={`/s/${slug}`} className="text-sm underline opacity-70">← {store.name}</Link>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div className="grid gap-3">
            {imgs[0] && <img src={imgs[0].cleaned_url || imgs[0].url} alt={p.title} className="w-full rounded-lg bg-white object-cover" />}
            <div className="grid grid-cols-4 gap-2">
              {imgs.slice(1).map((im) => (
                <img key={im.url} src={im.cleaned_url || im.url} alt={im.alt_text ?? ""} className="aspect-square rounded bg-white object-cover" />
              ))}
            </div>
          </div>
          <div>
            {p.brands?.[0] && <div className="text-xs uppercase tracking-widest opacity-60">{p.brands[0].name}</div>}
            <h1 className="font-display mt-1 text-3xl">{p.title}</h1>
            {curated?.note && <p className="mt-2 text-sm italic opacity-70">Curator&apos;s note: {curated.note}</p>}
            {buy && (
              <div className="mt-5 rounded-lg border border-black/10 bg-white p-4 text-black">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-semibold">{money(buy.price)}</div>
                  <PayPalBadge status={buy.paypal} size="md" />
                </div>
                <div className="mt-1 text-xs text-neutral-500">Sold by {buy.domain}</div>
                <a
                  href={buy.url}
                  target="_blank"
                  rel={buy.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                  className="mt-4 block rounded-md bg-black px-4 py-3 text-center text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  {buy.paypal === "accepts" ? `Buy at ${buy.domain} — pay with PayPal` : `Buy at ${buy.domain}`}
                </a>
                <div className="mt-2 text-[11px] text-neutral-500">
                  {buy.affiliate ? "Affiliate link: the founder may earn a commission." : "Direct merchant link (no affiliate program)."}
                  {constrainedTo.length > 0 && ` Buy link requested from Channel3 with website_ids=${constrainedTo.join(",")} (PayPal merchants).`}
                </div>
              </div>
            )}
            {p.description && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed opacity-80">{p.description.slice(0, 1200)}</p>}
            {(p.materials?.length || p.key_features?.length) && (
              <ul className="mt-4 list-disc pl-5 text-sm opacity-80">
                {p.materials?.length ? <li>Materials: {p.materials.join(", ")}</li> : null}
                {p.key_features?.slice(0, 6).map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
            {offers.length > 1 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">All merchants</h3>
                <table className="mt-2 w-full text-left text-xs">
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.domain + o.url} className="border-t border-black/10">
                        <td className="py-2">{o.domain}</td>
                        <td>{money(o.price)}</td>
                        <td>{o.paypal === "accepts" ? "PayPal ✓" : o.paypal === "no" ? "No PayPal" : "PayPal ?"}</td>
                        <td className="text-right">
                          <a className="underline" href={o.url} target="_blank" rel={o.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}>
                            {o.affiliate ? "Buy (aff)" : "Buy"}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {offers.some((o) => o.paypal === "unknown") && (
          <div className="mt-6">
            <PayPalVerifier domains={[...new Set(offers.filter((o) => o.paypal === "unknown").map((o) => o.domain))]} />
          </div>
        )}

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display mb-4 text-2xl">You may also like</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {similar.map((s) => (
                <ProductCard key={s.id} p={s} slug={slug} compact />
              ))}
            </div>
          </section>
        )}
        <AffiliateDisclosure className="mt-10" />
      </div>
    </div>
  );
}
