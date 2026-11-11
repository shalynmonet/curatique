import { NextResponse } from "next/server";
import { z } from "zod";
import { runShoppingAgent } from "@/lib/agent";
import { getStore } from "@/lib/stores";

export const maxDuration = 120;

const Body = z.object({
  slug: z.string(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(20),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const store = await getStore(parsed.data.slug);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  try {
    return NextResponse.json(await runShoppingAgent(store, parsed.data.messages));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Agent failed" }, { status: 500 });
  }
}
