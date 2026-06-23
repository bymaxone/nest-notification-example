/**
 * @fileoverview DI metadata shim for the library's `NotificationService`.
 * @layer infrastructure
 *
 * The published `@bymax-one/nest-notification` bundle is built with tsup/esbuild,
 * which does NOT emit TypeScript's `emitDecoratorMetadata` (a documented esbuild
 * limitation). Every other library provider injects via explicit `@Inject(<token>)`,
 * so it resolves without that metadata — but `NotificationService` declares its two
 * channel dependencies as bare `@Optional()` constructor parameters and relies on the
 * `design:paramtypes` reflection metadata to resolve them by type. With that metadata
 * stripped from the bundle, Nest resolves both parameters to `undefined`, so
 * `getEnabledChannels()` returns `[]` and `dispatch()` raises `CHANNEL_DISABLED`.
 *
 * This re-declares exactly the metadata the library source intends
 * (`constructor(emailService: EmailService, otpService: OtpService)`), restoring the
 * façade for consumers of the compiled bundle. Remove once the library ships its
 * bundle with decorator metadata intact.
 *
 * @module
 */
import 'reflect-metadata'
import { EmailService, NotificationService, OtpService } from '@bymax-one/nest-notification'

/**
 * Re-declares `NotificationService`'s constructor `design:paramtypes` so Nest can
 * resolve its `@Optional()` `EmailService` / `OtpService` channel dependencies by type.
 *
 * Idempotent: `Reflect.defineMetadata` overwrites, so repeated calls are harmless. Must
 * run before the module instantiates `NotificationService` (i.e. before app init).
 */
export function applyNotificationServiceMetadata(): void {
  Reflect.defineMetadata('design:paramtypes', [EmailService, OtpService], NotificationService)
}
