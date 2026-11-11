import Link from "next/link";
import type { RankedProduct } from "@/lib/types";
import { PayPalBadge } from "./PayPalBadge";

export function money(n: number | null | undefined, currency = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export function ProductCard({ p, slug, compact = false }: { p: RankedProduct; slug: string; compact?: boolean }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/s/${slug}/p/${encodeURIComponent(p.id)}`} className="block">
        <div className={`relative w-full overflow-hidden bg-neutral-100 ${compact ? "aspect-square" : "aspect-[4/5]"}`}>
          {p.image ? (
            <img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-neutral-400">No image</div>
          )}
          <div className="absolute left-2 top-2">
            <PayPalBadge status={p.paypal} />
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-neutral-500">
          <span className="truncate">{p.brand}</span>
          {!compact && p.collection && <span className="shrink-0 normal-case tracking-normal text-neutral-400">{p.collection}</span>}
        </div>
        <Link href={`/s/${slug}/p/${encodeURIComponent(p.id)}`} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
          {p.title}
        </Link>
        {!compact && p.note && <p className="line-clamp-2 text-xs italic text-neutral-500">{p.note}</p>}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="text-sm font-semibold">{money(p.price, p.currency)}</div>
            <div className="text-[11px] text-neutral-500">at {p.domain}</div>
          </div>
          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel={p.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
              className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              title={p.affiliate ? "Affiliate link — Curatique may earn a commission" : "Direct merchant link"}
            >
              Buy{p.affiliate ? " ·aff" : ""}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
