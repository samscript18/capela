import { createHash, randomUUID } from "node:crypto";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { validateAvatarFile, type AvatarUploadFile } from "./avatar-image";

const AVATAR_FOLDER = "capela/avatars";

export type UploadedAvatar = {
  publicId: string;
  secureUrl: string;
};

@Injectable()
export class CloudinaryAvatarService {
  private readonly logger = new Logger(CloudinaryAvatarService.name);
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>("CLOUDINARY_CLOUD_NAME")?.trim();
    const apiKey = config.get<string>("CLOUDINARY_API_KEY")?.trim();
    const apiSecret = config.get<string>("CLOUDINARY_API_SECRET")?.trim();
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    if (this.configured)
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  async upload(file: AvatarUploadFile, privyUserId: string): Promise<UploadedAvatar> {
    const format = validateAvatarFile(file);
    this.assertConfigured();
    const userHash = createHash("sha256").update(privyUserId).digest("hex").slice(0, 20);
    const publicId = `avatar-${userHash}-${randomUUID()}`;

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            folder: AVATAR_FOLDER,
            format,
            overwrite: false,
            public_id: publicId,
            resource_type: "image",
            transformation: [{ crop: "fill", gravity: "auto", height: 512, width: 512 }],
            type: "upload",
          },
          (error, response) => {
            if (error || !response) reject(error ?? new Error("Cloudinary returned no upload result"));
            else resolve(response);
          },
        );
        stream.end(file.buffer);
      });
      if (!result.public_id || !result.secure_url) throw new Error("Cloudinary returned incomplete asset metadata");
      return { publicId: result.public_id, secureUrl: result.secure_url };
    } catch (error) {
      this.logger.warn(`Cloudinary avatar upload failed (${providerErrorLabel(error)})`);
      throw new ServiceUnavailableException("Profile image upload is temporarily unavailable");
    }
  }

  async delete(publicId: string) {
    if (!publicId.startsWith(`${AVATAR_FOLDER}/`)) {
      this.logger.warn("Refused to delete an avatar asset outside Capela's managed Cloudinary folder");
      throw new ServiceUnavailableException("Profile image cleanup could not be completed safely");
    }
    this.assertConfigured();
    try {
      const result = (await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: "image",
        type: "upload",
      })) as { result?: string };
      if (result.result !== "ok" && result.result !== "not found")
        throw new Error(`Unexpected Cloudinary destroy result: ${result.result ?? "missing"}`);
    } catch (error) {
      this.logger.warn(`Cloudinary avatar deletion failed (${providerErrorLabel(error)})`);
      throw new ServiceUnavailableException("Profile image cleanup is temporarily unavailable");
    }
  }

  private assertConfigured() {
    if (!this.configured) throw new ServiceUnavailableException("Cloudinary profile image storage is not configured");
  }
}

function providerErrorLabel(error: unknown) {
  if (!error || typeof error !== "object") return "unknown error";
  const status = "http_code" in error && typeof error.http_code === "number" ? `HTTP ${error.http_code}` : "Error";
  return status;
}
