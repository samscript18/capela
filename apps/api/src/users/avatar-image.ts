import { BadRequestException } from "@nestjs/common";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarImageFormat = "jpg" | "png" | "webp";

export type AvatarUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const MIME_TYPES: Record<AvatarImageFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function validateAvatarFile(file?: AvatarUploadFile) {
  if (!file?.buffer?.length) throw new BadRequestException("Choose a JPG, PNG, or WebP image to upload");
  if (file.size > MAX_AVATAR_BYTES || file.buffer.length > MAX_AVATAR_BYTES)
    throw new BadRequestException("Profile images must be 5 MB or smaller");

  const format = detectAvatarImageFormat(file.buffer);
  if (!format || MIME_TYPES[format] !== file.mimetype.toLowerCase())
    throw new BadRequestException("The uploaded file must be a valid JPG, PNG, or WebP image");

  return format;
}

export function detectAvatarImageFormat(buffer: Buffer): AvatarImageFormat | undefined {
  if (isJpeg(buffer)) return "jpg";
  if (isPng(buffer)) return "png";
  if (isWebp(buffer)) return "webp";
  return undefined;
}

function isJpeg(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return buffer.length >= pngSignature.length && pngSignature.every((byte, index) => buffer[index] === byte);
}

function isWebp(buffer: Buffer) {
  if (buffer.length < 16) return false;
  const declaredSize = buffer.readUInt32LE(4) + 8;
  const chunkType = buffer.subarray(12, 16).toString("ascii");
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(chunkType) &&
    declaredSize <= buffer.length
  );
}
