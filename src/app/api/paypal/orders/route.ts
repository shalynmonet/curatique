import { NextResponse } from "next/server";
import { z } from "zod";
import { createLaunchOrder } from "@/lib/paypal";
import { getStore } from "@/lib/stores";

// Create a PayPal Checkout order for the store launch fee (amount is set server-side).
export async function POST(req: Request) {
  const parsed = z.object({ slug: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const store = await getStore(parsed.data.slug);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  if (store.status === "live") return NextResponse.json({ error: "Store is already live" }, { status: 409 });
  try {
    const order = await createLaunchOrder(store.slug, store.name);
    return NextResponse.json({ id: order.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "PayPal error" }, { status: 502 });
  }
}
