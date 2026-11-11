"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MerchantCheck() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);

  return (
    <form
      className="mt-6 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!domain) return;
        setBusy(true);
        setOut(null);
        const res = await fetch("/api/paypal-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
        const j = await res.json();
        setOut(res.ok ? `${j.domain}: ${j.acceptsPayPal === true ? "accepts PayPal" : j.acceptsPayPal === false ? "does not accept PayPal" : "unclear"} — ${j.evidence ?? ""}` : j.error);
        setBusy(false);
        router.refresh();
      }}
    >
      <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="retailer.com" className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm" />
      <button disabled={busy} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        {busy ? "Agent checking…" : "Check with AI agent"}
      </button>
      {out && <p className="w-full text-sm text-neutral-700">{out}</p>}
    </form>
  );
}
