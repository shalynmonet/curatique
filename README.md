# Curatique

**Signature-niche stores, curated by AI, paid with PayPal.** Built for the PayPal AI Hackathon.

- **Shoppers** browse a branded niche storefront (flagship: **Houndstooth**) and chat with a Claude shopping agent that searches Channel3's live product catalog in real time. Merchants that accept PayPal rank first, carry a **Pay with PayPal** badge, and the Buy button points to a PayPal-accepting merchant whenever one sells the item.
- **Founders** type a signature niche. A Claude agent designs the brand and theme, plans Channel3 searches, curates only on-niche items, and generates the storefront. Founders pay the launch fee with **PayPal Checkout** and receive affiliate earnings via **PayPal Payouts**.

**Hosted demo:** https://curatique.onrender.com — flagship store: https://curatique.onrender.com/s/houndstooth

---

## How PayPal is central

| Flow | PayPal API | Where |
|---|---|---|
| Store launch fee | Orders v2 (create + capture) with the PayPal JS SDK buttons | `src/lib/paypal.ts`, `src/app/api/paypal/orders/**`, `src/components/LaunchCheckout.tsx` |
| Founder affiliate payouts | Payouts v1 (create batch + status) | `src/app/api/payouts/**`, `src/components/PayoutPanel.tsx` |
| PayPal-priority shopping | Cached PayPal-acceptance table + AI verification; ranking boost, badge, `website_ids` on product detail | `src/lib/paypal-merchants.ts`, `src/lib/ranking.ts`, `src/lib/product-view.ts` |

**PayPal-priority ranking.** `paypal-merchants.ts` keeps a cached table of merchant domains, seeded with known PayPal-accepting retailers. For an unknown domain, a Claude agent with web search + web fetch reads the retailer's checkout / payment FAQ, returns a verdict with evidence, and the result is stored (see `/merchants`). Ranking = Channel3 relevance + a PayPal boost (`accepts` +0.6, `unknown` +0.15, `no` 0), so non-PayPal items still appear but rank lower. On product pages we call `GET /v1/products/{id}?website_ids=<PayPal domains>` so Channel3 returns a buy URL at a PayPal merchant.

> **Sample affiliate earnings are demo data.** Commission rows on the founder dashboard are simulated from the store's catalog and are labeled **"Demo data — simulated earnings"** in the UI. The payout itself is a real PayPal Payouts sandbox call.

## Tools Used

| Tool / model | How it's used |
|---|---|
| **Claude Haiku 5.5** (`claude-haiku-5-5`, Anthropic Messages API via `@anthropic-ai/sdk`) | Fast, low-cost model for the frequent calls. (1) **Shopping agent** (`src/lib/agent.ts`): tool-use loop with `search_products`, `get_product_details`, `find_similar`, `show_products`, all backed by real Channel3 calls. (2) **PayPal merchant checks** (`src/lib/paypal-merchants.ts`): Claude with the server-side `web_search` / `web_fetch` tools reads a retailer's payment FAQ and decides whether it accepts PayPal. Set with `CLAUDE_MODEL`. |
| **Claude Sonnet 5.5** (`claude-sonnet-5-5`) | Judgment-heavy, occasional calls. **Niche curation** (`src/lib/curator.ts`): structured-output calls that design the brand/theme and Channel3 search plan, then select only on-niche items from hundreds of Channel3 candidates and write curator notes — at store build and whenever “Load 25 more” needs fresh items. Server-side refusal fallbacks (`fallbacks: "default"`) are enabled. Set with `CLAUDE_CURATOR_MODEL`. In testing, Haiku let roughly 1 in 3 off-niche items (e.g. herringbone) into a houndstooth catalog, while Sonnet's picks were all on-niche — hence the split. |
| **Channel3 API** (`api.trychannel3.com/v1`) | `POST /search` (catalog building + agent search), `GET /products/{id}` with `website_ids` (enrichment + PayPal-merchant buy URL), `POST /similar` (recommendations), `POST /lookup` (URL enrichment helper). Buy URLs carry `x-user-id` = store slug for attribution; offers with `max_commission_rate > 0` are shown as affiliate links. |
| **PayPal REST APIs (sandbox)** | Orders v2 + JS SDK buttons for Checkout; Payouts v1 for founder payouts; OAuth2 client credentials. |
| **Next.js 15 + TypeScript + Tailwind** | App Router pages and API routes. |
| **Render** | Hosting (`render.yaml`). |

## Setup & run (Windows PowerShell)

Requires Node 22+.

```powershell
git clone https://github.com/shalynmonet/curatique.git
cd curatique
npm install
Copy-Item .env.example .env.local   # then fill in the keys
npm run dev                          # http://localhost:3000
```

Generate the flagship houndstooth catalog (real Claude + Channel3 calls; writes `src/data/flagship.json`, which you commit):

```powershell
# with `npm run dev` running in another terminal
npm run seed
```

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`, `npm run lint`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API |
| `CHANNEL3_API_KEY` | yes | Channel3 product API |
| `PAYPAL_CLIENT_ID` | yes | PayPal REST app (sandbox) client id; also used by the JS SDK buttons |
| `PAYPAL_CLIENT_SECRET` | yes | PayPal REST app secret |
| `PAYPAL_API_BASE` | no | Defaults to `https://api-m.sandbox.paypal.com` |
| `LAUNCH_FEE_USD` | no | Launch fee, default `27.00` |
| `FLAGSHIP_PAYOUT_EMAIL` | no | Sandbox personal account that receives flagship-store payouts |
| `DATA_DIR` | no | JSON data store directory, default `.data` |
| `CLAUDE_MODEL` | no | Chat + merchant checks, default `claude-haiku-5-5` |
| `CLAUDE_CURATOR_MODEL` | no | Brand + catalog curation, default `claude-sonnet-5-5` |

## Deploy to Render

1. Push to a public GitHub repo.
2. Render → **New → Blueprint** → select the repo (uses `render.yaml`), or **New → Web Service** with build `npm ci && npm run build`, start `npm run start -- -p $PORT`.
3. Set the secret env vars in the Render dashboard.
4. Data (founder stores, PayPal merchant cache) is stored as JSON in `DATA_DIR`. `render.yaml` mounts a 1 GB persistent disk (paid instance). On the free plan, remove the `disk` block — the flagship store still loads from `src/data/flagship.json`, but founder-created stores reset on restart.

## Testing

Use the PayPal **sandbox** — no real money moves.

1. In [developer.paypal.com](https://developer.paypal.com) → **Testing Tools → Sandbox Accounts** you have a default **Business** account (the merchant/app) and a **Personal** account (the buyer).
2. **Sandbox buyer test credentials** (for the PayPal Checkout popup when launching a store):
   - Email: `sb-7ixdq53858600@personal.example.com`
   - Password: `}_G-a8lK`

   _(Fill these in from your sandbox Personal account → View/Edit account. These are sandbox-only test credentials.)_
3. **Launch flow:** `/founder` → enter a niche, name, and a sandbox Personal email for payouts → **Build my store with AI** → on the dashboard click the PayPal button → log in with the sandbox buyer → pay → store flips to **LIVE** and the capture id is shown.
4. **Payout flow:** on the founder dashboard click **Pay out $X via PayPal** (amount = demo available balance) → a PayPal Payouts batch is created; **Refresh status** polls PayPal. Check the receiving sandbox Personal account in the sandbox dashboard to see the payout.
5. **Shopping agent:** `/s/houndstooth` → ask e.g. "a houndstooth coat under $200 I can pay for with PayPal". Expand **Agent steps** to see the live Channel3 tool calls.
6. **PayPal merchant check:** `/merchants` → enter a retailer domain → the Claude agent reads its payment FAQ and caches the verdict.

## Affiliate disclosure

Some product links are affiliate links (marked "aff"). If a shopper buys through one, the store founder and Curatique may earn a commission at no extra cost. Other links go directly to the merchant. This disclosure appears on every storefront and product page.

## Project structure

```
src/
  app/
    page.tsx                         landing + store list
    s/[slug]/page.tsx                storefront + AI concierge
    s/[slug]/p/[id]/page.tsx         product detail (PayPal-first buy link, similar items)
    founder/page.tsx                 niche → AI-built store
    founder/[slug]/page.tsx          launch checkout, demo earnings, payouts, catalog
    merchants/page.tsx               PayPal merchant table + AI check
    api/agent                        shopping agent
    api/founder/build                catalog curation + store generation
    api/paypal/orders[/id/capture]   PayPal Checkout
    api/payouts[/batchId]            PayPal Payouts
    api/paypal-check                 AI PayPal-acceptance check
    api/products/[id]                product detail JSON
  lib/
    agent.ts curator.ts claude.ts channel3.ts paypal.ts paypal-merchants.ts ranking.ts product-view.ts stores.ts db.ts earnings.ts
  components/                        UI
  data/flagship.json                 pre-built houndstooth store (from `npm run seed`)
```

## License

MIT — see [LICENSE](LICENSE).
