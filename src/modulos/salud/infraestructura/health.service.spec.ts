import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../../comun/prisma/prisma.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("confirma que PostgreSQL responde", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }]),
    } as unknown as PrismaService;

    await expect(new HealthService(prisma).check()).resolves.toEqual({
      status: "ok",
      database: "up",
      timestamp: expect.any(String),
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("responde 503 cuando PostgreSQL no esta disponible", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as PrismaService;

    await expect(new HealthService(prisma).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
