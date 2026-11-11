"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PayoutRecord } from "@/lib/types";

export function PayoutPanel({ slug, available, receiver, payouts }: { slug: string; available: number; receiver: string; payouts: PayoutRecord[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function payout() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refresh(batchId: string) {
    await fetch(`/api/payouts/${batchId}?store=${encodeURIComponent(slug)}`);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={payout}
        disabled={busy || available <= 0}
        className="rounded-md bg-[#0070e0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#005ea6] disabled:opacity-50"
      >
        {busy ? "Sending PayPal payout…" : `Pay out $${available.toFixed(2)} to ${receiver} via PayPal`}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {payouts.length > 0 && (
        <table className="mt-4 w-full text-left text-xs">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-1">PayPal payout batch</th>
              <th>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.batchId} className="border-t border-black/10">
                <td className="py-2 font-mono">{p.batchId}</td>
                <td>${p.amount.toFixed(2)}</td>
                <td>{p.status}</td>
                <td className="text-right">
                  <button onClick={() => refresh(p.batchId)} className="underline">
                    Refresh status
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
