"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = [
  "Designing your brand and theme…",
  "Planning catalog searches…",
  "Searching the Channel3 catalog…",
  "Curating items that truly fit your niche…",
  "Ranking PayPal-accepting merchants first…",
];

export function FounderForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [busy]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setStep(0);
    setError(null);
    try {
      const res = await fetch("/api/founder/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: f.get("niche"), founderName: f.get("founderName"), paypalEmail: f.get("paypalEmail") }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Build failed");
      router.push(`/founder/${j.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
      <label className="text-sm font-medium">
        Signature niche
        <input name="niche" required minLength={3} placeholder="e.g. mid-century brass desk objects, gingham everything, glass beaded bags" className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        Your name
        <input name="founderName" required placeholder="Ada" className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 font-normal" />
      </label>
      <label className="text-sm font-medium">
        PayPal email for payouts
        <input name="paypalEmail" type="email" required defaultValue={defaultEmail} placeholder="you@example.com" className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 font-normal" />
        <span className="mt-1 block text-xs font-normal text-neutral-500">Sandbox demo: use a PayPal sandbox personal account email (see README → Testing).</span>
      </label>
      <button disabled={busy} className="mt-2 rounded-md bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? STEPS[step] : "Build my store with AI"}
      </button>
      {busy && <p className="text-xs text-neutral-500">This takes about a minute — the agent makes real Claude + Channel3 calls.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
