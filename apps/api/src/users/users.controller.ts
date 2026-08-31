import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { PrivyAuthService } from "../auth/privy-auth.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { MAX_AVATAR_BYTES, type AvatarUploadFile } from "./avatar-image";
import { UsersService } from "./users.service";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto, DeleteAccountResponseDto, UserResponseDto } from "../openapi/openapi.models";

@Controller("me")
@UseGuards(PrivyAuthGuard)
@ApiTags("Account")
@ApiBearerAuth("privy")
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: "Missing, invalid, expired, or revoked Privy access token.",
})
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly privy: PrivyAuthService,
  ) {}
  @Get()
  @ApiOperation({
    summary: "Get the current account",
    description:
      "Returns the Mongo-backed Capela profile, creating or synchronizing it from the verified Privy identity when needed.",
  })
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.users.ensureUser(auth.privyUserId, await this.privy.getUserProfile(auth.privyUserId));
  }
  @Patch()
  @ApiOperation({
    summary: "Update profile and preferences",
    description: "Updates only the supplied display name or functional investigation-view preferences.",
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Validation failed for the submitted fields." })
  updateMe(@CurrentAuth() auth: AuthenticatedIdentity, @Body() input: UpdateUserDto) {
    return this.users.update(auth.privyUserId, input);
  }

  @Patch("avatar")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } }))
  @ApiOperation({
    summary: "Upload a profile image",
    description:
      "Validates the file signature and MIME type server-side, uploads it to Cloudinary, and replaces the previous managed avatar.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "A valid JPG, PNG, or WebP image, no larger than 5 MB.",
        },
      },
    },
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: "File is missing, oversized, or its bytes do not match an accepted image format.",
  })
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponseDto,
    description: "Cloudinary is not configured or the upload service is unavailable.",
  })
  async updateAvatar(@CurrentAuth() auth: AuthenticatedIdentity, @UploadedFile() file?: AvatarUploadFile) {
    if (!file) throw new BadRequestException("Choose a JPG, PNG, or WebP image to upload");
    return this.users.updateAvatar(auth.privyUserId, file);
  }

  @Delete()
  @ApiOperation({
    summary: "Permanently delete the account",
    description:
      "Permanently removes the user's Capela investigations, notifications, sessions, profile, managed avatar, and Privy identity. This cannot be undone.",
  })
  @ApiOkResponse({ type: DeleteAccountResponseDto })
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponseDto,
    description: "Capela data or the Privy identity could not be deleted completely.",
  })
  deleteMe(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.users.deleteAccount(auth.privyUserId);
  }
}
