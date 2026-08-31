import { isAddress } from "viem";

const REQUIRED_PRODUCTION_KEYS = [
  "MONGODB_URI",
  "PRIVY_APP_ID",
  "PRIVY_APP_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "TAVILY_API_KEY",
  "GEMINI_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "WEB_ORIGIN",
] as const;

export function assertProductionEnvironment(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV !== "production") return;

  const missing = REQUIRED_PRODUCTION_KEYS.filter((key) => !environment[key]?.trim());
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);

  const googleCloudApiKey = environment.GOOGLE_CLOUD_API_KEY?.trim() || environment.GOOGLE_API_KEY?.trim();
  const googleCloudProjectConfigured = Boolean(
    environment.GOOGLE_CLOUD_PROJECT?.trim() && environment.GOOGLE_CLOUD_LOCATION?.trim(),
  );
  if (!googleCloudApiKey && !googleCloudProjectConfigured)
    throw new Error(
      "Configure Gemini with GOOGLE_CLOUD_API_KEY (Vertex AI Express Mode) or GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION (Application Default Credentials).",
    );

  if (environment.PAYMENTS_ENABLED === "true") validatePaymentEnvironment(environment);
  for (const origin of environment
    .WEB_ORIGIN!.split(",")
    .map((value) => value.trim())
    .filter(Boolean))
    validateUrl("WEB_ORIGIN", origin);
}

function validatePaymentEnvironment(environment: NodeJS.ProcessEnv) {
  const paymentKeys = ["PAYMENT_RECEIVER_ADDRESS", "INVESTIGATION_PRICE_WEI", "BASE_CHAIN_ID", "BASE_RPC_URL"] as const;
  const missing = paymentKeys.filter((key) => !environment[key]?.trim());
  if (missing.length) throw new Error(`Missing required payment environment variables: ${missing.join(", ")}`);
  const receiver = environment.PAYMENT_RECEIVER_ADDRESS!.trim();
  if (!isAddress(receiver)) throw new Error("PAYMENT_RECEIVER_ADDRESS must be a valid EVM address.");
  let price = 0n;
  try {
    price = BigInt(environment.INVESTIGATION_PRICE_WEI!);
  } catch {
    throw new Error("INVESTIGATION_PRICE_WEI must be a positive integer.");
  }
  if (price <= 0n) throw new Error("INVESTIGATION_PRICE_WEI must be a positive integer.");
  const chainId = Number(environment.BASE_CHAIN_ID);
  if (chainId !== 8453 && chainId !== 84532)
    throw new Error("BASE_CHAIN_ID must identify Base mainnet or Base Sepolia.");
  validateUrl("BASE_RPC_URL", environment.BASE_RPC_URL!);
}

function validateUrl(name: string, value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`${name} must contain a valid HTTP(S) URL.`);
  }
}
