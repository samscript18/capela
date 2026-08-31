import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  compactEvidence?: boolean;

  @IsOptional()
  @IsBoolean()
  openEvidenceInDrawer?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesDto)
  preferences?: UpdatePreferencesDto;
}
