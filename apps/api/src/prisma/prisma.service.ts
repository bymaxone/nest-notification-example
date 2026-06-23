/**
 * Injectable Prisma database client for `apps/api`.
 *
 * Layer: app/prisma. Extends `PrismaClient` using the `@prisma/adapter-pg` driver
 * adapter (Prisma 7), so the connection URL is sourced from `ConfigService` rather
 * than the schema file. Connects in `onModuleInit` and disconnects in
 * `onApplicationShutdown`, so `app.close()` releases the connection pool cleanly.
 *
 * @module
 */
import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/** Prisma database client, injectable into any NestJS provider. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  constructor(config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    })
    super({ adapter })
  }

  /**
   * Connect to the database when the module initialises.
   *
   * @returns A promise that resolves once the connection is established.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  /**
   * Disconnect from the database when the application shuts down.
   *
   * Invoked by `app.close()` via the `OnApplicationShutdown` lifecycle so the
   * connection pool is released before the process exits.
   *
   * @returns A promise that resolves once the connection pool is torn down.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect()
  }
}
