import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/claude";
import { z } from "zod";
import { loadMore } from "@/lib/catalog";

export const maxDuration = 300;

// POST { seen: [...product ids already on screen] } -> next 25 products (curating more if needed).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = z.object({ seen: z.array(z.string().max(200)).max(5000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "seen ids required" }, { status: 400 });
  try {
    return NextResponse.json(await loadMore(slug, parsed.data.seen));
  } catch (e) {
    console.error(e);
    const msg = friendlyError(e, "Failed to load more");
    return NextResponse.json({ error: msg }, { status: msg === "Store not found" ? 404 : 500 });
  }
}
