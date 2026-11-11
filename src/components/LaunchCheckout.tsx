"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LaunchCheckout({ slug, clientId, fee }: { slug: string; clientId: string; fee: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-600">
        One-time launch fee: <strong>${fee} USD</strong> (PayPal sandbox). Paying takes your store live.
      </p>
      <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "capture" }}>
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", label: "pay" }}
          createOrder={async () => {
            setErr(null);
            const res = await fetch("/api/paypal/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug }),
            });
            const j = await res.json();
            if (!res.ok) {
              setErr(j.error);
              throw new Error(j.error);
            }
            return j.id;
          }}
          onApprove={async (data) => {
            const res = await fetch(`/api/paypal/orders/${data.orderID}/capture`, { method: "POST" });
            const j = await res.json();
            if (!res.ok) {
              setErr(j.error);
              return;
            }
            setMsg(`Payment captured (${j.captureId}). Your store is live!`);
            router.refresh();
          }}
          onError={(e) => setErr(String(e))}
        />
      </PayPalScriptProvider>
      {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
