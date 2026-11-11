// Builds the flagship houndstooth store with real Claude + Channel3 calls through the running app,
// then writes it to src/data/flagship.json so it ships with the deploy.
// Usage: npm run dev (in another terminal), then: npm run seed
import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.SEED_BASE_URL || "http://localhost:3000";
const dataDir = process.env.DATA_DIR || ".data";

console.log(`Building flagship via ${base}/api/founder/build … (about a minute)`);
const res = await fetch(`${base}/api/founder/build`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    niche: "houndstooth — anything in the houndstooth / dogstooth pattern: coats, blazers, skirts, scarves, bags, shoes, home",
    founderName: "Curatique Studio",
    paypalEmail: process.env.FLAGSHIP_PAYOUT_EMAIL || "sb-flagship@personal.example.com",
  }),
});
const j = await res.json();
if (!res.ok) {
  console.error("Build failed:", j);
  process.exit(1);
}
const stores = JSON.parse(await fs.readFile(path.join(dataDir, "stores.json"), "utf8"));
const built = stores[j.slug];
const flagship = { ...built, niche: "Houndstooth", slug: "houndstooth", status: "live", flagship: true, payouts: [] };
await fs.mkdir("src/data", { recursive: true });
await fs.writeFile("src/data/flagship.json", JSON.stringify(flagship, null, 2));
delete stores[j.slug];
await fs.writeFile(path.join(dataDir, "stores.json"), JSON.stringify(stores, null, 2));
console.log(`Wrote src/data/flagship.json — "${flagship.name}" with ${flagship.products.length} products.`);
