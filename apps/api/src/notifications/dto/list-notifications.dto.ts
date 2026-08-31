import { Type } from "class-transformer";
import { IsInt, IsMongoId, IsOptional, Max, Min } from "class-validator";

export class ListNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsMongoId()
  cursor?: string;
}
