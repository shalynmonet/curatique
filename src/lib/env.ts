// Server-only environment access with clear errors when a key is missing.
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Add it to .env.local (see .env.example).`);
  return v;
}

export const env = {
  channel3Key: () => req("CHANNEL3_API_KEY"),
  paypalClientId: () => req("PAYPAL_CLIENT_ID"),
  paypalSecret: () => req("PAYPAL_CLIENT_SECRET"),
  paypalBase: () => process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com",
  launchFee: () => process.env.LAUNCH_FEE_USD || "27.00",
  dataDir: () => process.env.DATA_DIR || ".data",
  /** Concierge chat + PayPal merchant checks (frequent, latency-sensitive). */
  claudeModel: () => process.env.CLAUDE_MODEL || "claude-haiku-5-5",
  /** Brand design + catalog curation (occasional, judgment-heavy). */
  curatorModel: () => process.env.CLAUDE_CURATOR_MODEL || "claude-sonnet-5-5",
};
