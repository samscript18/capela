import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { HealthResponseDto, HealthUnavailableResponseDto } from "../openapi/openapi.models";

@Controller("health")
@ApiTags("Health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({
    summary: "Check API readiness",
    description: "Returns healthy only when the Nest application is running and its MongoDB connection is ready.",
  })
  @ApiOkResponse({ type: HealthResponseDto, description: "API and database are ready." })
  @ApiServiceUnavailableResponse({ type: HealthUnavailableResponseDto, description: "MongoDB is not connected." })
  health() {
    if (this.connection.readyState !== 1) {
      throw new ServiceUnavailableException({ status: "unavailable", service: "capela-api", database: "unavailable" });
    }
    return {
      status: "ok",
      service: "capela-api",
      database: "connected",
    };
  }
}
