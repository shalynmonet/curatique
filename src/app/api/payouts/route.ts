import { NextResponse } from "next/server";
import { z } from "zod";
import { sampleEarnings } from "@/lib/earnings";
import { createPayout } from "@/lib/paypal";
import { getStore, patchStore } from "@/lib/stores";

// PayPal Payouts: pay the founder their available (DEMO DATA) affiliate balance.
export async function POST(req: Request) {
  const parsed = z.object({ slug: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const store = await getStore(parsed.data.slug);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  const { available } = sampleEarnings(store);
  if (available <= 0) return NextResponse.json({ error: "No available balance to pay out" }, { status: 409 });
  const amount = available.toFixed(2);
  const batchId = `cq-${store.slug}-${Date.now()}`.slice(0, 120);
  try {
    const res = await createPayout({
      batchId,
      receiver: store.founder.paypalEmail,
      amount,
      note: `Curatique affiliate earnings for ${store.name} (sandbox demo data)`,
    });
    await patchStore(store.slug, (s) => ({
      ...s,
      payouts: [
        ...s.payouts,
        {
          batchId: res.batch_header.payout_batch_id,
          status: res.batch_header.batch_status,
          amount: Number(amount),
          receiver: store.founder.paypalEmail,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    return NextResponse.json({ payoutBatchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status, amount });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Payout failed" }, { status: 502 });
  }
}
