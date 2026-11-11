import { NextResponse } from "next/server";
import { getProductView } from "@/lib/product-view";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = new URL(req.url).searchParams.get("store") ?? undefined;
  try {
    return NextResponse.json(await getProductView(id, store));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 502 });
  }
}
