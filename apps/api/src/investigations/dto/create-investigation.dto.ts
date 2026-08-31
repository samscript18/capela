import { IsMongoId, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateInvestigationDto {
  @ApiProperty({
    example: "aspirin",
    minLength: 1,
    maxLength: 200,
    description: "Molecule name or identifier to resolve through authoritative chemical data sources.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/, { message: "originalInput must contain a molecule name or identifier" })
  originalInput!: string;

  @ApiPropertyOptional({
    example: "66d2e2b59d8f09f1c2a7b431",
    description: "A verified, unconsumed payment ID. Omit while free or preview access is available.",
  })
  @IsOptional()
  @IsMongoId()
  paymentId?: string;
}
