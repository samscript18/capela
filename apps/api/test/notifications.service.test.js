const test = require("node:test");
const assert = require("node:assert/strict");
const { Types } = require("mongoose");
const { NotificationsService } = require("../dist/notifications/notifications.service.js");

test("terminal investigation activity creates an owner-scoped idempotent notification", async () => {
  let captured;
  const notifications = {
    findOneAndUpdate(filter, update, options) {
      captured = { filter, update, options };
      return {
        lean() {
          return { exec: async () => ({ _id: new Types.ObjectId(), ...update.$setOnInsert }) };
        },
      };
    },
  };
  const service = new NotificationsService(notifications, {}, {});
  const investigationId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  await service.recordInvestigation({
    _id: investigationId,
    userId,
    originalInput: "Loliolide",
    status: "completed",
    molecule: { preferredName: "Loliolide" },
  });

  assert.deepEqual(captured.filter, {
    userId,
    idempotencyReference: `investigation:${investigationId}:completed`,
  });
  assert.equal(captured.options.upsert, true);
  assert.equal(captured.update.$setOnInsert.type, "INVESTIGATION_COMPLETED");
  assert.equal(captured.update.$setOnInsert.title, "Dossier ready");
  assert.equal(captured.update.$setOnInsert.actionUrl, `/dashboard/investigations/${investigationId}`);
  assert.equal(captured.update.$setOnInsert.metadata.molecule, "Loliolide");
});

test("non-terminal investigation activity never creates a notification", async () => {
  let writes = 0;
  const service = new NotificationsService(
    {
      findOneAndUpdate() {
        writes += 1;
      },
    },
    {},
    {},
  );

  const result = await service.recordInvestigation({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    originalInput: "Loliolide",
    status: "extracting_evidence",
  });

  assert.equal(result, null);
  assert.equal(writes, 0);
});

test("investigation notification deletion is soft and scoped to the authenticated owner", async () => {
  const ownerId = new Types.ObjectId();
  let captured;
  const service = new NotificationsService(
    {
      updateMany: async (filter, update) => {
        captured = { filter, update };
        return { modifiedCount: 2 };
      },
    },
    {},
    { ensureUser: async () => ({ _id: ownerId }) },
  );

  const result = await service.deleteInvestigationNotifications("did:privy:owner");

  assert.deepEqual(result, { deletedCount: 2 });
  assert.equal(captured.filter.userId, ownerId);
  assert.deepEqual(captured.filter.type, {
    $in: ["INVESTIGATION_COMPLETED", "INVESTIGATION_FAILED"],
  });
  assert.deepEqual(captured.filter.deletedAt, { $exists: false });
  assert.ok(captured.update.$set.deletedAt instanceof Date);
});
