const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Types } = require("mongoose");
const { InvestigationsService } = require("../dist/investigations/investigations.service.js");

const noCompletedInvestigation = () => ({ sort: () => ({ exec: async () => null }) });
const paymentsOn = { get: (key) => (key === "PAYMENTS_ENABLED" ? "true" : undefined) };

test("access grants three successful free investigations per UTC day", async () => {
  let countFilter;
  const model = {
    exists: async () => null,
    countDocuments: async (filter) => {
      countFilter = filter;
      return 1;
    },
  };
  const users = { ensureUser: async () => ({ _id: "user-1", freeInvestigationUsed: false }) };
  const config = {
    get: (key) => ({ PAYMENTS_ENABLED: "true", INVESTIGATION_PRICE_WEI: "1000", BASE_CHAIN_ID: "84532" })[key],
  };
  const service = new InvestigationsService(
    model,
    users,
    config,
    { run: async () => undefined },
    { availablePaymentId: async () => undefined },
  );
  const access = await service.access("did:privy:user-1");
  assert.equal(access.freeInvestigationAvailable, true);
  assert.equal(access.freeInvestigationsLimit, 3);
  assert.equal(access.freeInvestigationsUsedToday, 1);
  assert.equal(access.freeInvestigationsRemaining, 2);
  assert.equal(access.paymentRequired, false);
  assert.equal(access.priceWei, "1000");
  assert.equal(access.chainId, 84532);
  assert.equal(new Date(access.freeInvestigationsResetAt).getUTCHours(), 0);
  assert.equal(countFilter.status, "completed");
  assert.equal(countFilter["access.type"], "free");
});

test("creation requires payment after three successful free investigations today", async () => {
  const model = { exists: async () => null, findOne: noCompletedInvestigation, countDocuments: async () => 3 };
  const users = { ensureUser: async () => ({ _id: "user-1", freeInvestigationUsed: true }) };
  const service = new InvestigationsService(model, users, paymentsOn, { run: async () => undefined }, {});
  await assert.rejects(
    () => service.create("did:privy:user-1", { originalInput: "Loliolide" }),
    (error) => error.getStatus() === 402,
  );
});

test("disabled payments provide free preview access beyond the daily allowance", async () => {
  let created;
  const model = {
    exists: async () => null,
    findOne: noCompletedInvestigation,
    countDocuments: async () => 3,
    create: async (input) => {
      created = input;
      return { ...input, id: "preview-investigation" };
    },
  };
  const users = { ensureUser: async () => ({ _id: new Types.ObjectId() }) };
  const service = new InvestigationsService(
    model,
    users,
    { get: () => undefined },
    { run: async () => undefined },
    {
      availablePaymentId: async () => {
        throw new Error("must not inspect payments");
      },
    },
  );
  const access = await service.access("did:privy:preview");
  assert.equal(access.paymentsEnabled, false);
  assert.equal(access.unlimitedInvestigations, true);
  assert.equal(access.freeInvestigationAvailable, true);
  assert.equal(access.paymentRequired, false);
  assert.equal(access.priceWei, "0");
  assert.equal(access.paymentReceiverAddress, undefined);
  await service.create("did:privy:preview", { originalInput: "Caffeine" });
  assert.equal(created.access.type, "free");
});

test("free creation reserves the database-enforced active slot", async () => {
  let created;
  const model = {
    exists: async () => null,
    countDocuments: async () => 2,
    findOne: noCompletedInvestigation,
    create: async (input) => {
      created = input;
      return { ...input, id: "investigation-1" };
    },
  };
  const users = { ensureUser: async () => ({ _id: new Types.ObjectId(), freeInvestigationUsed: false }) };
  const service = new InvestigationsService(model, users, { get: () => undefined }, { run: async () => undefined }, {});
  await service.create("did:privy:user-1", { originalInput: "Loliolide" });
  assert.equal(created.activeFreeSlot, true);
  assert.equal(created.access.type, "free");
});

test("a unique active-slot collision becomes a safe free-investigation conflict", async () => {
  const duplicate = Object.assign(new Error("duplicate key"), { code: 11000 });
  const model = {
    exists: async () => null,
    countDocuments: async () => 0,
    findOne: noCompletedInvestigation,
    create: async () => {
      throw duplicate;
    },
  };
  const users = { ensureUser: async () => ({ _id: new Types.ObjectId(), freeInvestigationUsed: false }) };
  const service = new InvestigationsService(model, users, { get: () => undefined }, { run: async () => undefined }, {});
  await assert.rejects(
    () => service.create("did:privy:user-1", { originalInput: "Loliolide" }),
    (error) => error.getStatus() === 409 && error.getResponse().code === "FREE_INVESTIGATION_ACTIVE",
  );
});

test("history deletion is scoped to the authenticated user's database id", async () => {
  let deletionFilter;
  const model = {
    deleteMany: (filter) => {
      deletionFilter = filter;
      return { exec: async () => ({ deletedCount: 3 }) };
    },
  };
  const users = { ensureUser: async () => ({ _id: "owned-user-id", freeInvestigationUsed: true }) };
  const service = new InvestigationsService(model, users, { get: () => undefined }, { run: async () => undefined }, {});
  assert.deepEqual(await service.deleteHistory("did:privy:user-1"), { deletedCount: 3 });
  assert.deepEqual(deletionFilter, { userId: "owned-user-id" });
});

test("a verified payment is atomically consumed into a paid investigation", async () => {
  const userId = new Types.ObjectId();
  const paymentId = new Types.ObjectId().toString();
  let created;
  let consumed;
  let started;
  const model = {
    findOne: noCompletedInvestigation,
    countDocuments: async () => 3,
    create: async (input) => {
      created = input;
      return { ...input, id: input._id.toString() };
    },
  };
  const users = { ensureUser: async () => ({ _id: userId, freeInvestigationUsed: true }) };
  const payments = {
    consume: async (...args) => {
      consumed = args;
      return { _id: paymentId };
    },
    release: async () => undefined,
  };
  const service = new InvestigationsService(
    model,
    users,
    paymentsOn,
    {
      run: async (id) => {
        started = id;
      },
    },
    payments,
  );
  const result = await service.create("did:privy:user-1", { originalInput: "Loliolide", paymentId });
  assert.equal(created.access.type, "paid");
  assert.equal(String(created.access.paymentId), paymentId);
  assert.equal(String(consumed[0]), String(userId));
  assert.equal(consumed[1], paymentId);
  assert.equal(started, result.id);
});

test("daily-limit access exposes a refresh-safe verified entitlement", async () => {
  const userId = new Types.ObjectId();
  const model = { exists: async () => null, countDocuments: async () => 3 };
  const users = { ensureUser: async () => ({ _id: userId, freeInvestigationUsed: true }) };
  const config = {
    get: (key) =>
      ({
        INVESTIGATION_PRICE_WEI: "1000",
        BASE_CHAIN_ID: "84532",
        PAYMENT_RECEIVER_ADDRESS: "0x1111111111111111111111111111111111111111",
        PAYMENTS_ENABLED: "true",
      })[key],
  };
  const service = new InvestigationsService(model, users, config, {}, { availablePaymentId: async () => "payment-1" });
  const access = await service.access("did:privy:user-1");
  assert.equal(access.paymentRequired, true);
  assert.equal(access.freeInvestigationsRemaining, 0);
  assert.equal(access.verifiedPaymentId, "payment-1");
  assert.equal(access.paymentReceiverAddress, "0x1111111111111111111111111111111111111111");
});

test("a paid entitlement is released when investigation persistence fails", async () => {
  const userId = new Types.ObjectId();
  const paymentId = new Types.ObjectId().toString();
  let released;
  const model = {
    findOne: noCompletedInvestigation,
    countDocuments: async () => 3,
    create: async () => {
      throw new Error("database unavailable");
    },
  };
  const users = { ensureUser: async () => ({ _id: userId, freeInvestigationUsed: true }) };
  const payments = {
    consume: async () => ({ _id: paymentId }),
    release: async (...args) => {
      released = args;
    },
  };
  const service = new InvestigationsService(model, users, paymentsOn, {}, payments);
  await assert.rejects(
    () => service.create("did:privy:user-1", { originalInput: "Loliolide", paymentId }),
    /database unavailable/,
  );
  assert.equal(released[0], paymentId);
  assert.ok(released[1] instanceof Types.ObjectId);
});

test("a completed dossier is reopened without consuming payment or starting another run", async () => {
  const completed = {
    _id: new Types.ObjectId(),
    id: "completed-1",
    originalInput: "Loliolide",
    status: "completed",
    dossier: { overview: {} },
  };
  let lookupFilter;
  let consumed = false;
  let started = false;
  const model = {
    findOne: (filter) => {
      lookupFilter = filter;
      return { sort: () => ({ exec: async () => completed }) };
    },
    create: async () => {
      throw new Error("must not create");
    },
  };
  const users = { ensureUser: async () => ({ _id: new Types.ObjectId(), freeInvestigationUsed: true }) };
  const payments = {
    consume: async () => {
      consumed = true;
    },
  };
  const runner = {
    run: async () => {
      started = true;
    },
  };
  const service = new InvestigationsService(model, users, { get: () => undefined }, runner, payments);

  const result = await service.create("did:privy:user-1", { originalInput: "  loliolide  " });

  assert.equal(result, completed);
  assert.equal(consumed, false);
  assert.equal(started, false);
  assert.equal(lookupFilter.status, "completed");
  assert.deepEqual(lookupFilter.dossier, { $exists: true, $ne: null });
  assert.equal(lookupFilter.$or[0].originalInput.$regex, "^loliolide$");
  assert.equal(lookupFilter.$or[0].originalInput.$options, "i");
});

test("a failed free investigation is atomically reset and retried without consuming access", async () => {
  const userId = new Types.ObjectId();
  const investigationId = new Types.ObjectId();
  const failed = { _id: investigationId, status: "failed", access: { type: "free" } };
  let retryUpdate;
  let started;
  const model = {
    countDocuments: async () => 1,
    exists: async () => null,
    findOne: () => ({ lean: () => ({ exec: async () => failed }) }),
    findOneAndUpdate: (_filter, update) => {
      retryUpdate = update;
      return { exec: async () => ({ ...failed, status: "queued", id: investigationId.toString() }) };
    },
  };
  const service = new InvestigationsService(
    model,
    { ensureUser: async () => ({ _id: userId }) },
    { get: () => undefined },
    { run: async (id) => (started = id) },
    {},
  );

  const retried = await service.retry("did:privy:user-1", investigationId.toString());

  assert.equal(retried.status, "queued");
  assert.equal(retryUpdate.$set.activeFreeSlot, true);
  assert.equal(retryUpdate.$set.progress.message, "Investigation queued for retry");
  assert.equal(retryUpdate.$unset.error, 1);
  assert.equal(retryUpdate.$unset.paperEvidence, 1);
  assert.equal(started, investigationId.toString());
});

test("retry rejects completed investigations but preserves a failed run's original free entitlement", async () => {
  const userId = new Types.ObjectId();
  const investigationId = new Types.ObjectId();
  const users = { ensureUser: async () => ({ _id: userId }) };
  const completedService = new InvestigationsService(
    { findOne: () => ({ lean: () => ({ exec: async () => ({ status: "completed", access: { type: "free" } }) }) }) },
    users,
    { get: () => undefined },
    {},
    {},
  );
  await assert.rejects(
    () => completedService.retry("did:privy:user-1", investigationId.toString()),
    (error) => error.getResponse().code === "INVESTIGATION_NOT_FAILED",
  );

  let retriedAtDailyLimit = false;
  const exhaustedService = new InvestigationsService(
    {
      countDocuments: async () => 3,
      exists: async () => null,
      findOne: () => ({
        lean: () => ({ exec: async () => ({ _id: investigationId, status: "failed", access: { type: "free" } }) }),
      }),
      findOneAndUpdate: () => ({
        exec: async () => ({ _id: investigationId, id: investigationId.toString(), status: "queued" }),
      }),
    },
    users,
    { get: () => undefined },
    { run: async () => (retriedAtDailyLimit = true) },
    {},
  );
  const retried = await exhaustedService.retry("did:privy:user-1", investigationId.toString());
  assert.equal(retried.status, "queued");
  assert.equal(retriedAtDailyLimit, true);
});
