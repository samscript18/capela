import { INVESTIGATION_STATUSES, type InvestigationStatus } from "@capela/shared";
import { IsIn, IsOptional } from "class-validator";

export class ListInvestigationsDto {
  @IsOptional()
  @IsIn(INVESTIGATION_STATUSES)
  status?: InvestigationStatus;
}
