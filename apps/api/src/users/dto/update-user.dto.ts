import { Type } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: "Render evidence cards in the compact layout." })
  @IsOptional()
  @IsBoolean()
  compactEvidence?: boolean;

  @ApiPropertyOptional({ description: "Open evidence details in the dossier side drawer." })
  @IsOptional()
  @IsBoolean()
  openEvidenceInDrawer?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "Ada Researcher", maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ type: UpdatePreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesDto)
  preferences?: UpdatePreferencesDto;
}
