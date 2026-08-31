import { Type } from "class-transformer";
import { IsInt, IsMongoId, IsOptional, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ListNotificationsDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    example: "66d2e2b59d8f09f1c2a7b431",
    description: "Opaque cursor returned as `pagination.nextCursor` by the previous page.",
  })
  @IsOptional()
  @IsMongoId()
  cursor?: string;
}
