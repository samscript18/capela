const assert = require("node:assert/strict");
const { test } = require("node:test");
const { PrivyAuthService, normalizePrivyVerificationKey } = require("../dist/auth/privy-auth.service.js");

const validKey = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEexample\n-----END PUBLIC KEY-----";

test("Privy verification keys normalize escaped newlines", () => {
  assert.equal(normalizePrivyVerificationKey(validKey.replaceAll("\n", "\\n")), validKey);
});

test("malformed Privy verification keys fall back to the SDK JWKS path", () => {
  assert.equal(normalizePrivyVerificationKey("not-a-spki-public-key"), undefined);
  assert.equal(normalizePrivyVerificationKey(""), undefined);
  assert.equal(normalizePrivyVerificationKey(undefined), undefined);
});

test("account deletion delegates to Privy's server SDK", async () => {
  const deleted = [];
  const service = new PrivyAuthService({ get: () => undefined });
  service.client = {
    users: () => ({
      delete: async (userId) => deleted.push(userId),
    }),
  };

  await service.deleteUser("did:privy:user-1");

  assert.deepEqual(deleted, ["did:privy:user-1"]);
});

test("a missing Privy identity is an idempotent account deletion success", async () => {
  const service = new PrivyAuthService({ get: () => undefined });
  service.client = {
    users: () => ({
      delete: async () => {
        throw { status: 404 };
      },
    }),
  };

  await assert.doesNotReject(() => service.deleteUser("did:privy:already-deleted"));
});
