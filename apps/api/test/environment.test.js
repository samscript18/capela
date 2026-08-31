const assert = require("node:assert/strict");
const { test } = require("node:test");
const { assertProductionEnvironment } = require("../dist/config/environment.js");

const productionEnvironment = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb+srv://cluster.example.test/capela",
  PRIVY_APP_ID: "privy-app",
  PRIVY_APP_SECRET: "privy-secret",
  PRIVY_JWT_VERIFICATION_KEY: "verification-key",
  CLOUDINARY_CLOUD_NAME: "capela-cloud",
  CLOUDINARY_API_KEY: "cloudinary-key",
  CLOUDINARY_API_SECRET: "cloudinary-secret",
  TAVILY_API_KEY: "tavily-key",
  GOOGLE_CLOUD_PROJECT: "capela-project",
  GOOGLE_CLOUD_LOCATION: "global",
  GEMINI_MODEL: "gemini-2.5-flash",
  GROQ_API_KEY: "groq-key",
  GROQ_MODEL: "openai/gpt-oss-20b",
  PAYMENTS_ENABLED: "true",
  PAYMENT_RECEIVER_ADDRESS: "0x1111111111111111111111111111111111111111",
  INVESTIGATION_PRICE_WEI: "100000000000000",
  BASE_CHAIN_ID: "84532",
  BASE_RPC_URL: "https://base-sepolia.example.test",
  WEB_ORIGIN: "https://capela.example.test,https://preview.example.test",
};

test("production startup accepts a complete Base Sepolia configuration", () => {
  assert.doesNotThrow(() => assertProductionEnvironment(productionEnvironment));
});

test("production startup allows Privy's managed JWKS verification path", () => {
  const environment = { ...productionEnvironment };
  delete environment.PRIVY_JWT_VERIFICATION_KEY;
  assert.doesNotThrow(() => assertProductionEnvironment(environment));
});

test("production startup accepts a Vertex AI Express Mode API key without project credentials", () => {
  const environment = { ...productionEnvironment, GOOGLE_CLOUD_API_KEY: "express-key" };
  delete environment.GOOGLE_CLOUD_PROJECT;
  delete environment.GOOGLE_CLOUD_LOCATION;
  assert.doesNotThrow(() => assertProductionEnvironment(environment));
});

test("production startup reports missing integrations without exposing values", () => {
  assert.throws(
    () => assertProductionEnvironment({ NODE_ENV: "production", MONGODB_URI: "configured" }),
    (error) => error.message.includes("TAVILY_API_KEY") && !error.message.includes("configured"),
  );
});

test("production startup does not require Base configuration while payments are disabled", () => {
  const environment = { ...productionEnvironment, PAYMENTS_ENABLED: "false" };
  delete environment.PAYMENT_RECEIVER_ADDRESS;
  delete environment.INVESTIGATION_PRICE_WEI;
  delete environment.BASE_CHAIN_ID;
  delete environment.BASE_RPC_URL;
  assert.doesNotThrow(() => assertProductionEnvironment(environment));
});

test("production startup requires Tavily, Gemini, and the Groq fallback", () => {
  for (const key of ["TAVILY_API_KEY", "GOOGLE_CLOUD_PROJECT", "GEMINI_MODEL", "GROQ_API_KEY"]) {
    const environment = { ...productionEnvironment };
    delete environment[key];
    assert.throws(() => assertProductionEnvironment(environment), new RegExp(key));
  }
});

test("production startup requires server-side Cloudinary avatar storage", () => {
  for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
    const environment = { ...productionEnvironment };
    delete environment[key];
    assert.throws(() => assertProductionEnvironment(environment), new RegExp(key));
  }
});

test("production startup rejects invalid payment values and non-Base chains", () => {
  assert.throws(
    () => assertProductionEnvironment({ ...productionEnvironment, INVESTIGATION_PRICE_WEI: "0" }),
    /positive integer/,
  );
  assert.throws(
    () => assertProductionEnvironment({ ...productionEnvironment, BASE_CHAIN_ID: "1" }),
    /Base mainnet or Base Sepolia/,
  );
});

test("development startup remains available before external services are configured", () => {
  assert.doesNotThrow(() => assertProductionEnvironment({ NODE_ENV: "development" }));
});
