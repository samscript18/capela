import { INVESTIGATION_STATUSES, type InvestigationStatus } from "@capela/shared";
import { IsIn, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ListInvestigationsDto {
  @ApiPropertyOptional({
    enum: INVESTIGATION_STATUSES,
    description: "Return only investigations in this lifecycle state.",
  })
  @IsOptional()
  @IsIn(INVESTIGATION_STATUSES)
  status?: InvestigationStatus;
}
