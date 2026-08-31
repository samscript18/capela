const assert = require("node:assert/strict");
const { test } = require("node:test");
const { detectAvatarImageFormat, validateAvatarFile, MAX_AVATAR_BYTES } = require("../dist/users/avatar-image.js");
const { CloudinaryAvatarService } = require("../dist/users/cloudinary-avatar.service.js");

test("avatar validation recognizes JPG, PNG, and WebP signatures", () => {
  assert.equal(detectAvatarImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(detectAvatarImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  const webp = Buffer.alloc(16);
  webp.write("RIFF", 0, "ascii");
  webp.writeUInt32LE(8, 4);
  webp.write("WEBP", 8, "ascii");
  webp.write("VP8X", 12, "ascii");
  assert.equal(detectAvatarImageFormat(webp), "webp");
});

test("avatar validation rejects MIME spoofing and oversize buffers", () => {
  assert.throws(
    () =>
      validateAvatarFile({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        mimetype: "image/png",
        originalname: "spoof.png",
        size: 4,
      }),
    /valid JPG, PNG, or WebP/,
  );
  assert.throws(
    () =>
      validateAvatarFile({
        buffer: Buffer.alloc(MAX_AVATAR_BYTES + 1),
        mimetype: "image/jpeg",
        originalname: "large.jpg",
        size: MAX_AVATAR_BYTES + 1,
      }),
    /5 MB or smaller/,
  );
});

test("avatar storage fails closed when Cloudinary is not configured", async () => {
  const service = new CloudinaryAvatarService({ get: () => undefined });
  await assert.rejects(
    () =>
      service.upload(
        {
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          mimetype: "image/jpeg",
          originalname: "avatar.jpg",
          size: 4,
        },
        "did:privy:user-1",
      ),
    /not configured/,
  );
  await assert.rejects(() => service.delete("user-controlled/public-id"), /could not be completed safely/);
});
