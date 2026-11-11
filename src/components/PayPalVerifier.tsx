"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// For merchants not yet in the PayPal table, ask the Claude agent to check their payment FAQ.
// Results are cached server-side; when any resolves we refresh so ranking + badges update.
export function PayPalVerifier({ domains }: { domains: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, string>>({});

  useEffect(() => {
    const todo = domains.slice(0, 4);
    if (!todo.length) return;
    let cancelled = false;
    let changed = false;
    setState(Object.fromEntries(todo.map((d) => [d, "checking"])));
    Promise.all(
      todo.map(async (d) => {
        try {
          const res = await fetch("/api/paypal-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: d }) });
          const j = await res.json();
          const v = j.acceptsPayPal === true ? "accepts PayPal" : j.acceptsPayPal === false ? "no PayPal" : "unclear";
          if (j.acceptsPayPal !== null && j.acceptsPayPal !== undefined) changed = true;
          if (!cancelled) setState((s) => ({ ...s, [d]: v }));
        } catch {
          if (!cancelled) setState((s) => ({ ...s, [d]: "check failed" }));
        }
      }),
    ).then(() => {
      if (!cancelled && changed) router.refresh();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains.join(",")]);

  const entries = Object.entries(state);
  if (!entries.length) return null;
  return (
    <div className="rounded-md border border-dashed border-black/15 bg-white/90 px-3 py-2 text-[11px] text-neutral-600">
      <span className="font-medium">PayPal agent:</span>{" "}
      {entries.map(([d, s]) => (
        <span key={d} className="mr-3">
          {d} — {s === "checking" ? <span className="animate-pulse">checking checkout/FAQ…</span> : s}
        </span>
      ))}
    </div>
  );
}
