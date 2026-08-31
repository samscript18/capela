const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Types } = require("mongoose");
const { PaymentsService } = require("../dist/payments/payments.service.js");

const hash = `0x${"a".repeat(64)}`;
const receiver = "0x1111111111111111111111111111111111111111";
const sender = "0x2222222222222222222222222222222222222222";
const privy = { getEthereumWalletAddresses: async () => [sender] };

function config(overrides = {}) {
  const values = {
    PAYMENTS_ENABLED: "true",
    BASE_RPC_URL: "https://base.example.test",
    BASE_CHAIN_ID: "84532",
    INVESTIGATION_PRICE_WEI: "1000",
    PAYMENT_RECEIVER_ADDRESS: receiver,
    BASE_MIN_CONFIRMATIONS: "1",
    ...overrides,
  };
  return { get: (key) => values[key] };
}

test("payment verification is unavailable while payments are disabled", async () => {
  const service = new PaymentsService({}, {}, config({ PAYMENTS_ENABLED: "false" }), privy);
  await assert.rejects(
    () => service.verify("did:privy:user", hash),
    (error) => error.response.code === "PAYMENTS_DISABLED",
  );
});

test("a successful Base transfer is verified and persisted from RPC facts", async () => {
  const userId = new Types.ObjectId();
  let saved;
  const model = {
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
    create: async (input) => {
      saved = input;
      return { _id: new Types.ObjectId(), ...input };
    },
  };
  const service = new PaymentsService(model, { ensureUser: async () => ({ _id: userId }) }, config(), privy);
  service.client = {
    getChainId: async () => 84532,
    getTransaction: async () => ({ to: receiver, from: sender, value: 1000n }),
    waitForTransactionReceipt: async () => ({ status: "success", blockNumber: 10n }),
    getBlockNumber: async () => 10n,
  };
  const result = await service.verify("did:privy:user", hash);
  assert.equal(result.status, "verified");
  assert.equal(result.amountWei, "1000");
  assert.equal(saved.transactionHash, hash);
  assert.equal(String(saved.userId), String(userId));
});

test("verification rejects a transfer to any recipient other than Capela", async () => {
  const model = {
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
    create: async () => {
      throw new Error("must not persist");
    },
  };
  const service = new PaymentsService(
    model,
    { ensureUser: async () => ({ _id: new Types.ObjectId() }) },
    config(),
    privy,
  );
  service.client = {
    getChainId: async () => 84532,
    getTransaction: async () => ({ to: sender, from: sender, value: 1000n }),
    waitForTransactionReceipt: async () => ({ status: "success", blockNumber: 10n }),
    getBlockNumber: async () => 10n,
  };
  await assert.rejects(
    () => service.verify("did:privy:user", hash),
    (error) => error.response.code === "INVALID_RECIPIENT",
  );
});

test("verification fails closed for wrong chain, failed receipt, low value, low confirmations, and an unlinked sender", async () => {
  const cases = [
    { code: "WRONG_CHAIN", client: { getChainId: async () => 8453 } },
    {
      code: "TRANSACTION_FAILED",
      client: { waitForTransactionReceipt: async () => ({ status: "reverted", blockNumber: 10n }) },
    },
    {
      code: "INSUFFICIENT_PAYMENT",
      client: { getTransaction: async () => ({ to: receiver, from: sender, value: 999n }) },
    },
    { code: "INSUFFICIENT_CONFIRMATIONS", config: { BASE_MIN_CONFIRMATIONS: "2" } },
    { code: "UNLINKED_PAYMENT_SENDER", wallets: [receiver] },
  ];
  for (const scenario of cases) {
    const model = {
      findOne: () => ({ lean: () => ({ exec: async () => null }) }),
      create: async () => {
        throw new Error("must not persist");
      },
    };
    const service = new PaymentsService(
      model,
      { ensureUser: async () => ({ _id: new Types.ObjectId() }) },
      config(scenario.config),
      { getEthereumWalletAddresses: async () => scenario.wallets ?? [sender] },
    );
    service.client = {
      getChainId: async () => 84532,
      getTransaction: async () => ({ to: receiver, from: sender, value: 1000n }),
      waitForTransactionReceipt: async () => ({ status: "success", blockNumber: 10n }),
      getBlockNumber: async () => 10n,
      ...scenario.client,
    };
    await assert.rejects(
      () => service.verify("did:privy:user", hash),
      (error) => error.response.code === scenario.code,
      scenario.code,
    );
  }
});

test("a consumed transaction hash cannot be verified again", async () => {
  const userId = new Types.ObjectId();
  const model = {
    findOne: () => ({
      lean: () => ({
        exec: async () => ({ _id: new Types.ObjectId(), userId, transactionHash: hash, status: "consumed" }),
      }),
    }),
  };
  const service = new PaymentsService(model, { ensureUser: async () => ({ _id: userId }) }, config(), privy);
  await assert.rejects(
    () => service.verify("did:privy:user", hash),
    (error) => error.response.code === "TRANSACTION_ALREADY_USED",
  );
});

test("re-verifying the same user's unconsumed hash is idempotent", async () => {
  const userId = new Types.ObjectId();
  const existing = {
    _id: new Types.ObjectId(),
    userId,
    transactionHash: hash,
    chainId: 84532,
    from: sender,
    to: receiver,
    amountWei: "1000",
    status: "verified",
  };
  const model = { findOne: () => ({ lean: () => ({ exec: async () => existing }) }) };
  const service = new PaymentsService(model, { ensureUser: async () => ({ _id: userId }) }, config(), privy);
  const result = await service.verify("did:privy:user", hash);
  assert.equal(result.id, String(existing._id));
  assert.equal(result.status, "verified");
});

test("a unique-index race prevents two users from claiming one transaction hash", async () => {
  const duplicate = Object.assign(new Error("duplicate key"), { code: 11000 });
  const model = {
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
    create: async () => {
      throw duplicate;
    },
  };
  const service = new PaymentsService(
    model,
    { ensureUser: async () => ({ _id: new Types.ObjectId() }) },
    config(),
    privy,
  );
  service.client = {
    getChainId: async () => 84532,
    getTransaction: async () => ({ to: receiver, from: sender, value: 1000n }),
    waitForTransactionReceipt: async () => ({ status: "success", blockNumber: 10n }),
    getBlockNumber: async () => 10n,
  };
  await assert.rejects(
    () => service.verify("did:privy:user", hash),
    (error) => error.response.code === "TRANSACTION_ALREADY_USED",
  );
});

test("payment consumption uses a verified-only conditional update", async () => {
  const userId = new Types.ObjectId();
  const paymentId = new Types.ObjectId().toString();
  const investigationId = new Types.ObjectId();
  let filter;
  const model = {
    findOneAndUpdate: (inputFilter) => {
      filter = inputFilter;
      return { lean: () => ({ exec: async () => ({ _id: paymentId, status: "consumed" }) }) };
    },
  };
  const service = new PaymentsService(model, {}, config(), privy);
  await service.consume(userId, paymentId, investigationId);
  assert.equal(filter.status, "verified");
  assert.equal(filter.investigationId.$exists, false);
  assert.equal(String(filter.userId), String(userId));
});
