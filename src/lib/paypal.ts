import "server-only";
import { env } from "./env";

// PayPal REST (sandbox by default): Orders v2 for Checkout, Payouts v1 for founder earnings.
let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const auth = Buffer.from(`${env.paypalClientId()}:${env.paypalSecret()}`).toString("base64");
  const res = await fetch(`${env.paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function pp<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["PayPal-Request-Id"] = init.idempotencyKey;
  const res = await fetch(`${env.paypalBase()}${path}`, { ...init, headers, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayPal ${init.method || "GET"} ${path} failed (${res.status}): ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export async function createLaunchOrder(storeSlug: string, storeName: string) {
  return pp<{ id: string; status: string }>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: storeSlug,
          custom_id: storeSlug,
          description: `Curatique store launch fee — ${storeName}`.slice(0, 127),
          amount: { currency_code: "USD", value: env.launchFee() },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: { brand_name: "Curatique", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
        },
      },
    }),
  });
}

export interface CaptureResult {
  id: string;
  status: string;
  payer?: { email_address?: string };
  purchase_units: {
    reference_id?: string;
    payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string }; custom_id?: string }[] };
  }[];
}

export async function captureOrder(orderId: string) {
  return pp<CaptureResult>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    idempotencyKey: `capture-${orderId}`,
  });
}

export async function getOrder(orderId: string) {
  return pp<CaptureResult & { purchase_units: { reference_id?: string; amount?: { value: string } }[] }>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
  );
}

export async function createPayout(opts: { batchId: string; receiver: string; amount: string; note: string }) {
  return pp<{ batch_header: { payout_batch_id: string; batch_status: string } }>("/v1/payments/payouts", {
    method: "POST",
    idempotencyKey: opts.batchId,
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: opts.batchId,
        email_subject: "You have a Curatique affiliate payout",
        email_message: opts.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: opts.amount, currency: "USD" },
          receiver: opts.receiver,
          note: opts.note,
          sender_item_id: `${opts.batchId}-1`,
        },
      ],
    }),
  });
}

export async function getPayout(payoutBatchId: string) {
  return pp<{
    batch_header: { payout_batch_id: string; batch_status: string; amount?: { value: string } };
    items?: { transaction_status: string; payout_item_id: string }[];
  }>(`/v1/payments/payouts/${encodeURIComponent(payoutBatchId)}`);
}
