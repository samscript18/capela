const assert = require("node:assert/strict");
const { test } = require("node:test");
const { PrivyAuthGuard } = require("../dist/auth/privy-auth.guard.js");

function context(request) {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

test("PrivyAuthGuard rejects a request without a bearer token", async () => {
  const guard = new PrivyAuthGuard(
    {
      verify: async () => {
        throw new Error("should not run");
      },
    },
    { assertActiveAndTouch: async () => assert.fail("should not run") },
  );
  await assert.rejects(() => guard.canActivate(context({ headers: {} })), { status: 401 });
});

test("PrivyAuthGuard registers the verified Privy session before attaching the identity", async () => {
  const identity = {
    privyUserId: "did:privy:test-user",
    sessionId: "session-1",
    issuedAt: new Date("2026-08-31T00:00:00.000Z"),
    expiresAt: new Date("2026-08-31T01:00:00.000Z"),
  };
  const request = {
    headers: {
      authorization: "Bearer valid-token",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
    },
  };
  let touched;
  const guard = new PrivyAuthGuard(
    {
      verify: async (token) => {
        assert.equal(token, "valid-token");
        return identity;
      },
    },
    {
      assertActiveAndTouch: async (...args) => {
        touched = args;
      },
    },
  );
  assert.equal(await guard.canActivate(context(request)), true);
  assert.deepEqual(touched, [identity, { userAgent: request.headers["user-agent"] }]);
  assert.deepEqual(request.auth, identity);
});

test("PrivyAuthGuard accepts a case-insensitive bearer scheme and rejects other authorization schemes", async () => {
  const guard = new PrivyAuthGuard(
    {
      verify: async (token) => ({
        privyUserId: token,
        sessionId: "session",
        issuedAt: new Date("2026-08-31T00:00:00.000Z"),
        expiresAt: new Date("2026-08-31T01:00:00.000Z"),
      }),
    },
    { assertActiveAndTouch: async () => undefined },
  );
  const request = { headers: { authorization: "bearer   access-token" } };
  assert.equal(await guard.canActivate(context(request)), true);
  assert.equal(request.auth.privyUserId, "access-token");
  await assert.rejects(() => guard.canActivate(context({ headers: { authorization: "Basic access-token" } })), {
    status: 401,
  });
});

test("PrivyAuthGuard does not attach identities for locally revoked sessions", async () => {
  const request = { headers: { authorization: "Bearer valid-token" } };
  const guard = new PrivyAuthGuard(
    {
      verify: async () => ({
        privyUserId: "did:privy:test-user",
        sessionId: "revoked-session",
        issuedAt: new Date("2026-08-31T00:00:00.000Z"),
        expiresAt: new Date("2026-08-31T01:00:00.000Z"),
      }),
    },
    {
      assertActiveAndTouch: async () => {
        const error = new Error("This Privy session has been revoked");
        error.status = 401;
        throw error;
      },
    },
  );
  await assert.rejects(() => guard.canActivate(context(request)), { status: 401 });
  assert.equal(request.auth, undefined);
});
