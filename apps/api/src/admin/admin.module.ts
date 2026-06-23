/**
 * @fileoverview Admin feature module exposing the roadmap-rejection probe endpoints.
 * @layer api/admin
 *
 * @module
 */
import { Module } from '@nestjs/common'

import { AdminController } from './admin.controller.js'

/** Admin module containing the three roadmap-rejection probe endpoints. */
@Module({
  controllers: [AdminController],
})
export class AdminModule {}
