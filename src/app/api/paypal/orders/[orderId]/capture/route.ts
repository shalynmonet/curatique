import { NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";
import { patchStore } from "@/lib/stores";

// Capture the launch-fee order, then flip the store live. The store slug comes from PayPal's
// reference_id on the order itself, not from the client.
export async function POST(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  try {
    const cap = await captureOrder(orderId);
    const unit = cap.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    if (cap.status !== "COMPLETED" || !capture || !unit?.reference_id) {
      return NextResponse.json({ error: `Payment not completed (status ${cap.status})` }, { status: 402 });
    }
    const store = await patchStore(unit.reference_id, (s) => ({
      ...s,
      status: "live",
      launch: {
        orderId,
        captureId: capture.id,
        amount: `${capture.amount.value} ${capture.amount.currency_code}`,
        paidAt: new Date().toISOString(),
        payer: cap.payer?.email_address,
      },
    }));
    return NextResponse.json({ status: cap.status, captureId: capture.id, slug: store.slug });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Capture failed" }, { status: 502 });
  }
}
