import Link from "next/link";
import { FounderForm } from "@/components/FounderForm";

export default function FounderPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm underline opacity-70">← Curatique</Link>
      <h1 className="font-display mt-4 text-4xl">Launch your niche store</h1>
      <p className="mt-2 text-neutral-600">
        Tell us your signature niche. Our Claude agent designs the brand, plans searches across the Channel3 catalog, curates only the items that
        truly fit, and ranks PayPal-accepting merchants first. You review it, then launch with PayPal.
      </p>
      <FounderForm />
    </div>
  );
}
