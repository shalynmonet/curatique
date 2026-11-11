import type { PayPalStatus } from "@/lib/types";

export function PayPalBadge({ status, size = "sm" }: { status: PayPalStatus; size?: "sm" | "md" }) {
  if (status !== "accepts") return null;
  const cls = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-[#ffc439] font-semibold text-[#003087] shadow ${cls}`}>
      <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
        <path
          fill="#003087"
          d="M7.1 20.6H4.2a.5.5 0 0 1-.5-.6L6.5 3.4a.7.7 0 0 1 .7-.6h6.3c3.3 0 5.4 1.6 4.9 4.8-.6 3.9-3.2 5.6-6.6 5.6h-2l-1 6.8a.7.7 0 0 1-.7.6Z"
        />
        <path fill="#0070e0" d="M19.4 8.1c-.6 3.6-3 5.6-6.6 5.6h-1.6l-1 6.6a.6.6 0 0 1-.6.5H7.4l.2-1.3 1-6.4h2c3.4 0 6-1.7 6.6-5.6.1-.5.1-1 0-1.4 1.6.7 2.4 1.9 2.2 2Z" />
      </svg>
      Pay with PayPal
    </span>
  );
}
