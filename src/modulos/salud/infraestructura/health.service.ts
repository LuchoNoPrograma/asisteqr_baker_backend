import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../comun/prisma/prisma.service";

interface HealthResponse {
  status: "ok" | "error";
  database: "up" | "down";
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        database: "down",
        timestamp: new Date().toISOString(),
      } satisfies HealthResponse);
    }

    return {
      status: "ok",
      database: "up",
      timestamp: new Date().toISOString(),
    };
  }
}
