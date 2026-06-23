/**
 * @fileoverview Admin controller demonstrating the library's v0.2 startup-rejection surface.
 * @layer api/admin
 *
 * Each endpoint compiles a throwaway `BymaxNotificationModule` in an isolated DI
 * container, captures the library's real startup-rejection error, and discards the
 * container. The running application's module is never touched.
 *
 * @module
 */
import { Controller, HttpCode, HttpStatus, Injectable, Post } from '@nestjs/common'
import { BymaxNotificationModule } from '@bymax-one/nest-notification'
import type {
  BymaxNotificationModuleAsyncOptions,
  BymaxNotificationModuleOptions,
  BymaxNotificationModuleOptionsFactory,
  PushChannelOptions,
  SmsChannelOptions,
} from '@bymax-one/nest-notification'

import { attemptConfigure } from './roadmap-rejection.probe.js'
import type { RoadmapRejectionResult } from './dto/roadmap-rejection.result.js'

/**
 * Minimal options factory supplied only to trigger the `forRootAsync({ useClass })` rejection.
 *
 * Exported for testing: the `createNotificationOptions` method is never invoked at runtime
 * because the library throws at the `forRootAsync` call site before any factory resolution,
 * but it must be implemented to satisfy {@link BymaxNotificationModuleOptionsFactory}.
 *
 * Decorated with `@Injectable()` so it is a valid `useClass` provider: the "rejected"
 * outcome must come from the library refusing `useClass`, never from Nest failing to
 * instantiate a metadata-less class — which would be a false-positive hiding a real change.
 */
@Injectable()
export class RejectedOptionsFactory implements BymaxNotificationModuleOptionsFactory {
  /**
   * Would create module options in a real useClass registration.
   * Never called here — the library throws at the `forRootAsync` call site before
   * resolving the factory.
   *
   * @returns An empty options object (all fields are optional).
   */
  createNotificationOptions(): BymaxNotificationModuleOptions {
    return {}
  }
}

/**
 * Admin controller that honestly demonstrates the library's declared but not-yet-implemented
 * v0.2 surfaces. Each endpoint compiles a throwaway isolated module configured with a
 * rejected option and returns the library's real startup-rejection message.
 */
@Controller('admin')
export class AdminController {
  /**
   * Proves the SMS channel is rejected at startup.
   *
   * Compiles a throwaway module with the v0.2 `sms` channel and returns the library's
   * verbatim error message.
   *
   * @returns The probe outcome with the verbatim SMS rejection message.
   */
  @Post('try-configure-sms')
  @HttpCode(HttpStatus.OK)
  async tryConfigureSms(): Promise<RoadmapRejectionResult> {
    // Cast is intentional: the library rejects the sms key before inspecting provider fields.
    const smsOptions = {} as unknown as SmsChannelOptions
    return attemptConfigure('sms', () => BymaxNotificationModule.forRoot({ sms: smsOptions }))
  }

  /**
   * Proves the Push channel is rejected at startup.
   *
   * Compiles a throwaway module with the v0.2 `push` channel and returns the library's
   * verbatim error message.
   *
   * @returns The probe outcome with the verbatim Push rejection message.
   */
  @Post('try-configure-push')
  @HttpCode(HttpStatus.OK)
  async tryConfigurePush(): Promise<RoadmapRejectionResult> {
    // Cast is intentional: the library rejects the push key before inspecting provider fields.
    const pushOptions = {} as unknown as PushChannelOptions
    return attemptConfigure('push', () => BymaxNotificationModule.forRoot({ push: pushOptions }))
  }

  /**
   * Proves the `forRootAsync({ useClass })` form is rejected.
   *
   * Compiles a throwaway module using the v0.2 async `useClass` pattern and returns the
   * library's verbatim error message.
   *
   * @returns The probe outcome with the verbatim async-useclass rejection message.
   */
  @Post('try-configure-async-useclass')
  @HttpCode(HttpStatus.OK)
  async tryConfigureAsyncUseClass(): Promise<RoadmapRejectionResult> {
    // Cast is intentional: useClass is a v0.2 surface; the library rejects it synchronously
    // inside forRootAsync via assertUseFactory before any factory resolution.
    const asyncOpts = {
      useClass: RejectedOptionsFactory,
    } as unknown as BymaxNotificationModuleAsyncOptions
    return attemptConfigure('async-useclass', () => BymaxNotificationModule.forRootAsync(asyncOpts))
  }
}
