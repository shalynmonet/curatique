export function AffiliateDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-neutral-500 ${className}`}>
      <strong>Affiliate disclosure:</strong> Some links on this store are affiliate links (marked “aff”). If you buy through them, the
      store founder and Curatique may earn a commission at no extra cost to you. Other links go directly to the merchant. Prices and
      availability come from Channel3 and may change.
    </p>
  );
}
