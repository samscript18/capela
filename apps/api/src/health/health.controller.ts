import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  @Get() health() {
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
