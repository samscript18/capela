const assert = require("node:assert/strict");
const { test } = require("node:test");
const { UsersService } = require("../dist/users/users.service.js");

function modelCapturingUpdate(capture) {
  return {
    findOneAndUpdate: (_filter, update) => {
      capture.update = update;
      return { lean: () => ({ orFail: () => ({ exec: async () => ({ ok: true }) }) }) };
    },
  };
}

test("preference updates do not erase an existing display name", async () => {
  const capture = {};
  const service = new UsersService(modelCapturingUpdate(capture));
  await service.update("did:privy:user-1", { preferences: { compactEvidence: true } });
  assert.deepEqual(capture.update, { $set: { "preferences.compactEvidence": true } });
});

test("an explicitly empty display name removes only the display name", async () => {
  const capture = {};
  const service = new UsersService(modelCapturingUpdate(capture));
  await service.update("did:privy:user-1", { displayName: "" });
  assert.deepEqual(capture.update, { $unset: { displayName: 1 } });
});

function selectedQuery(value) {
  return {
    select: () => ({ lean: () => ({ exec: async () => value }) }),
  };
}

function deletionModel(name, calls) {
  return {
    deleteMany: (filter) => ({
      exec: async () => {
        calls.push([name, filter]);
      },
    }),
  };
}

test("Privy profile synchronization does not overwrite a custom Cloudinary avatar", async () => {
  const capture = {};
  const userModel = {
    findOne: () => selectedQuery({ avatarPublicId: "capela/avatars/current" }),
    findOneAndUpdate: (_filter, update) => {
      capture.update = update;
      return { lean: () => ({ orFail: () => ({ exec: async () => ({ ok: true }) }) }) };
    },
  };
  const service = new UsersService(userModel);

  await service.ensureUser("did:privy:user-1", {
    avatarUrl: "https://privy.example.test/social-avatar.jpg",
    email: "researcher@example.test",
  });

  assert.deepEqual(capture.update.$set, { email: "researcher@example.test" });
});

test("avatar replacement stores the new Cloudinary asset before cleaning up the prior one", async () => {
  const calls = [];
  const userModel = {
    findOne: () => selectedQuery({ avatarPublicId: "capela/avatars/old" }),
    findOneAndUpdate: (_filter, update) => {
      calls.push(["database", update.$set]);
      return {
        lean: () => ({
          orFail: () => ({
            exec: async () => ({ avatarUrl: update.$set.avatarUrl }),
          }),
        }),
      };
    },
  };
  const avatars = {
    upload: async () => {
      calls.push(["upload"]);
      return { publicId: "capela/avatars/new", secureUrl: "https://res.cloudinary.com/capela/new.webp" };
    },
    delete: async (publicId) => {
      calls.push(["delete", publicId]);
    },
  };
  const service = new UsersService(userModel, undefined, undefined, undefined, undefined, avatars, undefined);

  const result = await service.updateAvatar("did:privy:user-1", {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    mimetype: "image/jpeg",
    originalname: "avatar.jpg",
    size: 4,
  });

  assert.equal(result.avatarUrl, "https://res.cloudinary.com/capela/new.webp");
  assert.deepEqual(calls, [
    ["upload"],
    [
      "database",
      {
        avatarPublicId: "capela/avatars/new",
        avatarUrl: "https://res.cloudinary.com/capela/new.webp",
      },
    ],
    ["delete", "capela/avatars/old"],
  ]);
});

test("account deletion removes every owner-scoped record before deleting the Privy identity", async () => {
  const calls = [];
  const userModel = {
    findOne: () => selectedQuery({ _id: "mongo-user-1", avatarPublicId: "capela/avatars/current" }),
    deleteOne: (filter) => ({
      exec: async () => {
        calls.push(["user", filter]);
      },
    }),
  };
  const avatars = {
    delete: async (publicId) => {
      calls.push(["avatar", publicId]);
    },
  };
  const privy = {
    deleteUser: async (privyUserId) => {
      calls.push(["privy", privyUserId]);
    },
  };
  const service = new UsersService(
    userModel,
    deletionModel("investigations", calls),
    deletionModel("notifications", calls),
    deletionModel("payments", calls),
    deletionModel("sessions", calls),
    avatars,
    privy,
  );

  assert.deepEqual(await service.deleteAccount("did:privy:user-1"), { deleted: true });
  assert.deepEqual(calls, [
    ["avatar", "capela/avatars/current"],
    ["notifications", { userId: "mongo-user-1" }],
    ["payments", { userId: "mongo-user-1" }],
    ["investigations", { userId: "mongo-user-1" }],
    ["sessions", { privyUserId: "did:privy:user-1" }],
    ["user", { privyUserId: "did:privy:user-1" }],
    ["privy", "did:privy:user-1"],
  ]);
});
