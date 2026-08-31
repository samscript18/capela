import { IsString, Matches } from "class-validator";

export class VerifyPaymentDto {
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  transactionHash!: `0x${string}`;
}
