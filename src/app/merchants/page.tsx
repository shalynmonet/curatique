import Link from "next/link";
import { listMerchants } from "@/lib/paypal-merchants";
import { MerchantCheck } from "@/components/MerchantCheck";

export const dynamic = "force-dynamic";

export default async function MerchantsPage() {
  const merchants = await listMerchants();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm underline opacity-70">← Curatique</Link>
      <h1 className="font-display mt-4 text-4xl">PayPal merchant table</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Cached list of merchant domains and whether they accept PayPal. Seeded with known retailers; unknown domains are checked by a Claude agent
        that searches and reads the retailer&apos;s checkout / payment FAQ, then stores the verdict and evidence here.
      </p>
      <MerchantCheck />
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-xs text-neutral-500">
          <tr>
            <th className="py-1">Domain</th>
            <th>PayPal</th>
            <th>Source</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {merchants.map((m) => (
            <tr key={m.domain} className="border-t border-black/10 align-top">
              <td className="py-1.5 font-mono text-xs">{m.domain}</td>
              <td>{m.acceptsPayPal === true ? "✓ accepts" : m.acceptsPayPal === false ? "✗ no" : "? unclear"}</td>
              <td className="text-xs">{m.source === "llm" ? `AI agent · ${m.checkedAt.slice(0, 10)}` : "seed"}</td>
              <td className="text-xs text-neutral-600">
                {m.evidence}
                {m.evidenceUrl && (
                  <>
                    {" "}
                    <a className="underline" href={m.evidenceUrl} target="_blank" rel="noopener noreferrer">source</a>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
