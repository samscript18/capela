import { IsString, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyPaymentDto {
  @ApiProperty({
    example: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    pattern: "^0x[0-9a-fA-F]{64}$",
    description:
      "Base transaction hash. The backend verifies chain, receipt, recipient, value, sender, and uniqueness.",
  })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  transactionHash!: `0x${string}`;
}
