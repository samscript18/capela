const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseUserAgent, PrivySessionsService } = require("../dist/auth/privy-sessions.service.js");

function updateChain(value) {
  return {
    lean: () => ({
      orFail: () => ({ exec: async () => value }),
    }),
  };
}

function findChain(value) {
  return {
    sort: () => ({ lean: () => ({ exec: async () => value }) }),
  };
}

const identity = {
  privyUserId: "did:privy:user-1",
  sessionId: "privy-session-1",
  issuedAt: new Date("2026-08-31T10:00:00.000Z"),
  expiresAt: new Date("2026-08-31T11:00:00.000Z"),
};

test("session tracking stores only verified identity and derived client metadata", async () => {
  const capture = {};
  const model = {
    findOneAndUpdate(filter, update, options) {
      capture.filter = filter;
      capture.update = update;
      capture.options = options;
      return updateChain({ ...filter, ...update.$set, createdAt: identity.issuedAt });
    },
  };
  const service = new PrivySessionsService(model);

  await service.assertActiveAndTouch(identity, {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
  });

  assert.deepEqual(capture.filter, {
    privyUserId: identity.privyUserId,
    sessionId: identity.sessionId,
  });
  assert.equal(capture.update.$set.deviceName, "Mac");
  assert.equal(capture.update.$set.platform, "macOS");
  assert.equal(capture.update.$set.browser, "Chrome");
  assert.equal(capture.update.$setOnInsert.privyUserId, identity.privyUserId);
  assert.equal(capture.update.$setOnInsert.sessionId, identity.sessionId);
  assert.deepEqual(capture.update.$max, {
    tokenIssuedAt: identity.issuedAt,
    expiresAt: identity.expiresAt,
  });
  assert.equal(capture.options.upsert, true);
});

test("a revoked Privy session remains revoked when its valid token is presented again", async () => {
  const model = {
    findOneAndUpdate: () =>
      updateChain({
        privyUserId: identity.privyUserId,
        sessionId: identity.sessionId,
        revokedAt: new Date("2026-08-31T10:30:00.000Z"),
      }),
  };
  const service = new PrivySessionsService(model);
  await assert.rejects(() => service.assertActiveAndTouch(identity, {}), { status: 401 });
});

test("session inventory marks the current Privy session without exposing revocation fields", async () => {
  const createdAt = new Date("2026-08-31T09:00:00.000Z");
  const lastUsedAt = new Date("2026-08-31T10:00:00.000Z");
  const expiresAt = new Date("2026-08-31T11:00:00.000Z");
  const model = {
    find: () =>
      findChain([
        {
          sessionId: "privy-session-1",
          deviceName: "Mac",
          platform: "macOS",
          browser: "Safari",
          userAgentSummary: "Safari user agent",
          createdAt,
          lastUsedAt,
          expiresAt,
          revokedReason: "must not be returned",
        },
        {
          sessionId: "privy-session-2",
          createdAt,
          lastUsedAt,
          expiresAt,
        },
      ]),
  };
  const service = new PrivySessionsService(model);
  const result = await service.list(identity.privyUserId, identity.sessionId);

  assert.deepEqual(result, [
    {
      id: "privy-session-1",
      current: true,
      deviceName: "Mac",
      platform: "macOS",
      browser: "Safari",
      userAgentSummary: "Safari user agent",
      createdAt,
      lastUsedAt,
      expiresAt,
    },
    {
      id: "privy-session-2",
      current: false,
      deviceName: "Unknown device",
      platform: "Unknown platform",
      browser: "Unknown browser",
      createdAt,
      lastUsedAt,
      expiresAt,
    },
  ]);
});

test("single-session revocation is owner scoped and reports unknown sessions", async () => {
  const calls = [];
  const model = {
    updateOne(filter, update) {
      calls.push({ filter, update });
      return { exec: async () => ({ matchedCount: calls.length === 1 ? 1 : 0 }) };
    },
  };
  const service = new PrivySessionsService(model);

  await service.revoke(identity.privyUserId, "privy-session-2");
  assert.deepEqual(calls[0].filter, {
    privyUserId: identity.privyUserId,
    sessionId: "privy-session-2",
    revokedAt: { $exists: false },
  });
  assert.equal(calls[0].update.$set.revokedReason, "USER_REVOKED");
  await assert.rejects(() => service.revoke(identity.privyUserId, "unknown-session"), { status: 404 });
});

test("bulk revocation preserves the current session", async () => {
  const capture = {};
  const model = {
    updateMany(filter, update) {
      capture.filter = filter;
      capture.update = update;
      return { exec: async () => ({ modifiedCount: 2 }) };
    },
  };
  const service = new PrivySessionsService(model);
  const result = await service.revokeOthers(identity.privyUserId, identity.sessionId);

  assert.deepEqual(capture.filter, {
    privyUserId: identity.privyUserId,
    sessionId: { $ne: identity.sessionId },
    revokedAt: { $exists: false },
  });
  assert.equal(capture.update.$set.revokedReason, "USER_REVOKED_OTHER_SESSIONS");
  assert.deepEqual(result, { revokedCount: 2 });
});

test("user-agent parsing covers common mobile and desktop clients", () => {
  assert.deepEqual(
    parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
    ),
    { browser: "Safari", platform: "iOS", deviceName: "iPhone" },
  );
  assert.deepEqual(parseUserAgent("unknown client"), {
    browser: "Unknown browser",
    platform: "Unknown platform",
    deviceName: "Unknown device",
  });
});
