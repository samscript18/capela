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

@Controller("me")
@UseGuards(PrivyAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly privy: PrivyAuthService,
  ) {}
  @Get() async getMe(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.users.ensureUser(auth.privyUserId, await this.privy.getUserProfile(auth.privyUserId));
  }
  @Patch() updateMe(@CurrentAuth() auth: AuthenticatedIdentity, @Body() input: UpdateUserDto) {
    return this.users.update(auth.privyUserId, input);
  }

  @Patch("avatar")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } }))
  async updateAvatar(@CurrentAuth() auth: AuthenticatedIdentity, @UploadedFile() file?: AvatarUploadFile) {
    if (!file) throw new BadRequestException("Choose a JPG, PNG, or WebP image to upload");
    return this.users.updateAvatar(auth.privyUserId, file);
  }

  @Delete()
  deleteMe(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.users.deleteAccount(auth.privyUserId);
  }
}
