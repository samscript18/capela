import { IsMongoId, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateInvestigationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/, { message: "originalInput must contain a molecule name or identifier" })
  originalInput!: string;

  @IsOptional()
  @IsMongoId()
  paymentId?: string;
}
