import { Controller, Get } from "@nestjs/common";
import { HealthResponse, HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  check(): Promise<HealthResponse> {
    return this.service.check();
  }
}
