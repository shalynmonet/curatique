// Shared app types. Channel3 response shapes mirror https://channel3.ai/docs (v1 API).

export interface C3Price {
  price: number;
  compare_at_price?: number | null;
  currency: string;
}

export interface C3Offer {
  url: string;
  domain: string;
  price: C3Price;
  availability: "InStock" | "OutOfStock";
  condition?: "new" | "used" | null;
  max_commission_rate?: number;
}

export interface C3Image {
  url: string;
  cleaned_url?: string | null;
  is_main_image?: boolean;
  alt_text?: string | null;
}

export interface C3Product {
  id: string;
  title: string;
  description?: string | null;
  brands?: { id: string; name: string }[];
  images?: C3Image[];
  category?: { slug: string; title: string; path?: { slug: string; title: string }[] } | null;
  gender?: "male" | "female" | null;
  age?: "newborn" | "infant" | "toddler" | "kids" | "adult" | null;
  materials?: string[] | null;
  key_features?: string[] | null;
  offers?: C3Offer[];
  ratings?: { value: number; count: number } | null;
}

export type PayPalStatus = "accepts" | "no" | "unknown";

/** A product as shown in the UI, after PayPal-priority ranking picked its best offer. */
export interface RankedProduct {
  id: string;
  title: string;
  brand: string | null;
  image: string | null;
  price: number | null;
  currency: string;
  domain: string | null;
  url: string | null;
  /** true when Channel3 reports a commission on this offer, i.e. the buy URL is an affiliate link */
  affiliate: boolean;
  commissionRate: number;
  paypal: PayPalStatus;
  /** number of merchants selling it, and how many accept PayPal */
  offerCount: number;
  paypalOfferCount: number;
  score: number;
  /** curator / agent note */
  note?: string;
  collection?: string;
}

export interface StoreTheme {
  primary: string;
  accent: string;
  background: string;
  text: string;
  pattern: "houndstooth" | "stripes" | "dots" | "grid" | "none";
}

export interface PayoutRecord {
  batchId: string;
  status: string;
  amount: number;
  receiver: string;
  createdAt: string;
}

export interface StoreQuery {
  collection: string;
  q: string;
  next: string | null;
}

export interface Store {
  slug: string;
  niche: string;
  name: string;
  tagline: string;
  about: string;
  heroCopy: string;
  theme: StoreTheme;
  collections: string[];
  founder: { name: string; paypalEmail: string };
  status: "draft" | "live";
  launch?: { orderId: string; captureId?: string; amount: string; paidAt: string; payer?: string };
  products: RankedProduct[];
  /** Channel3 searches behind the catalog; `next` is the page token used to curate more on demand. */
  queries?: StoreQuery[];
  payouts: PayoutRecord[];
  createdAt: string;
  flagship?: boolean;
}
