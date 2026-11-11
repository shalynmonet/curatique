import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDomain, listMerchants } from "@/lib/paypal-merchants";

export const maxDuration = 120;

// GET: the cached merchant table. POST {domain}: Claude agent checks the retailer's payment FAQ, result cached.
export async function GET() {
  return NextResponse.json({ merchants: await listMerchants() });
}

export async function POST(req: Request) {
  const parsed = z.object({ domain: z.string().min(3).max(120) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "domain required" }, { status: 400 });
  try {
    return NextResponse.json(await checkDomain(parsed.data.domain));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "check failed" }, { status: 500 });
  }
}
