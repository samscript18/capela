const assert = require("node:assert/strict");
const { test } = require("node:test");
const { HistoryController } = require("../dist/investigations/history.controller.js");

test("history deletion removes investigations before their owner-scoped notifications", async () => {
  const calls = [];
  const controller = new HistoryController(
    {
      deleteHistory: async (privyUserId) => {
        calls.push(["investigations", privyUserId]);
        return { deletedCount: 3 };
      },
    },
    {
      deleteInvestigationNotifications: async (privyUserId) => {
        calls.push(["notifications", privyUserId]);
        return { deletedCount: 2 };
      },
    },
  );

  const result = await controller.deleteHistory({ privyUserId: "did:privy:owner" });

  assert.deepEqual(calls, [
    ["investigations", "did:privy:owner"],
    ["notifications", "did:privy:owner"],
  ]);
  assert.deepEqual(result, { deletedCount: 3, notificationsDeletedCount: 2 });
});
