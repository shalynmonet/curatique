"use client";

import { useState } from "react";
import type { RankedProduct } from "@/lib/types";
import { ProductCard } from "./ProductCard";

interface Turn {
  role: "user" | "assistant";
  content: string;
  products?: RankedProduct[];
  trace?: { tool: string; input: unknown }[];
}

export function AgentChat({ slug, storeName, suggestions }: { slug: string; storeName: string; suggestions: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: text.trim() }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent error");
      setTurns([...next, { role: "assistant", content: data.reply || "Here's what I found.", products: data.products, trace: data.trace }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-black/10 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">Ask the {storeName} concierge</h2>
        <span className="text-[11px] text-neutral-500">Claude agent · live Channel3 search · PayPal-first</span>
      </div>

      <div className="flex max-h-[560px] flex-col gap-4 overflow-y-auto">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-black/15 px-3 py-1.5 text-xs hover:bg-black hover:text-white">
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "self-end max-w-[85%]" : "self-start w-full"}>
            <div className={`rounded-lg px-3 py-2 text-sm ${t.role === "user" ? "bg-black text-white" : "bg-neutral-100"}`}>{t.content}</div>
            {t.trace && t.trace.length > 0 && (
              <details className="mt-1 text-[11px] text-neutral-500">
                <summary className="cursor-pointer">Agent steps ({t.trace.length})</summary>
                <ul className="ml-4 list-disc">
                  {t.trace.map((s, j) => (
                    <li key={j}>
                      <code>{s.tool}</code> {JSON.stringify(s.input)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {t.products && t.products.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {t.products.map((p) => (
                  <ProductCard key={p.id} p={p} slug={slug} compact />
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="animate-pulse text-sm text-neutral-500">Searching the catalog and checking PayPal merchants…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. a houndstooth coat under $200 I can pay for with PayPal"
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black"
        />
        <button disabled={busy} className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Ask
        </button>
      </form>
    </section>
  );
}
