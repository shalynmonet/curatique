import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/claude";
import { z } from "zod";
import { buildStore, slugify } from "@/lib/curator";
import { saveStore, uniqueSlug } from "@/lib/stores";

export const maxDuration = 300;

const Body = z.object({
  niche: z.string().min(3).max(120),
  founderName: z.string().min(1).max(80),
  paypalEmail: z.string().email(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please provide a niche, your name and a valid PayPal email." }, { status: 400 });
  try {
    const draft = await buildStore(parsed.data);
    const slug = await uniqueSlug(slugify(draft.name));
    const store = await saveStore({ ...draft, slug });
    return NextResponse.json({ slug: store.slug, name: store.name, products: store.products.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyError(e, "Build failed") }, { status: 500 });
  }
}
