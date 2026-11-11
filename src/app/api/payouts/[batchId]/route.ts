import { NextResponse } from "next/server";
import { getPayout } from "@/lib/paypal";
import { patchStore } from "@/lib/stores";

// Refresh a payout batch's status from PayPal and store it on the founder's store.
export async function GET(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const slug = new URL(req.url).searchParams.get("store");
  try {
    const p = await getPayout(batchId);
    const status = p.batch_header.batch_status;
    if (slug) {
      await patchStore(slug, (s) => ({
        ...s,
        payouts: s.payouts.map((x) => (x.batchId === batchId ? { ...x, status } : x)),
      })).catch(() => undefined);
    }
    return NextResponse.json({ status, items: p.items?.map((i) => i.transaction_status) ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lookup failed" }, { status: 502 });
  }
}
