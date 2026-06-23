/**
 * @fileoverview Library export-surface probe for `@bymax-one/nest-notification`.
 *
 * References every public `.` (server) export with no natural feature-level home —
 * the resolved-options types, the declared-only v0.2 SMS/Push surface, the
 * options-factory contract, the DI tokens, the zero-arg class-form providers, the
 * crypto utils, the cooldown helpers, the canonical constants, and the
 * `NoOpNotificationLogRepository` — so the export-usage audit
 * (`scripts/audit-library-exports.mjs`) proves the type/token-only surface is
 * demonstrated. Feature-drivable exports (`EmailService`, `OtpService`,
 * `NotificationService`, `NotificationAuditInterceptor`, `ResendEmailProvider`,
 * `RedisOtpStorage`, `DefaultTemplateRenderer`, `NotificationException`,
 * `BymaxNotificationModule`) are exercised in their own feature surfaces; they are
 * not repeated here.
 *
 * @module
 */

import {
  BYMAX_NOTIFICATION_EMAIL_PROVIDER,
  BYMAX_NOTIFICATION_LOG_REPOSITORY,
  BYMAX_NOTIFICATION_OPTIONS,
  BYMAX_NOTIFICATION_OTP_STORAGE,
  BYMAX_NOTIFICATION_PUSH_PROVIDER,
  BYMAX_NOTIFICATION_SMS_PROVIDER,
  BYMAX_NOTIFICATION_TEMPLATE_RENDERER,
  CANONICAL_EMAIL_TEMPLATES,
  DEFAULT_TTLS,
  InMemoryOtpStorage,
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_ERROR_DEFINITIONS,
  NOTIFICATION_PURPOSES,
  NoOpEmailProvider,
  NoOpNotificationLogRepository,
  cooldownExpiresAt,
  formatCooldown,
  generateOtpCode,
  hashTenantRecipient,
  safeCompare,
  toRetryAfterHeader,
  type AuditOptions,
  type BymaxNotificationModuleAsyncOptions,
  type BymaxNotificationModuleOptions,
  type BymaxNotificationModuleOptionsFactory,
  type CanonicalEmailTemplate,
  type CanonicalNotificationPurpose,
  type ConsumeAttemptResult,
  type DefaultTemplateRendererOptions,
  type DispatchInput,
  type DispatchResult,
  type EmailAttachment,
  type EmailChannelOptions,
  type EmailDispatchPayload,
  type EmailSendInput,
  type EmailSendOptions,
  type EmailSendResult,
  type EmailSendTemplateInput,
  type GlobalOptions,
  type IEmailProvider,
  type IEmailTemplateRenderer,
  type INotificationLogRepository,
  type IOtpStorage,
  type IPushProvider,
  type ISmsProvider,
  type InMemoryStorageSize,
  type MissingVariableMode,
  type NotificationChannel,
  type NotificationErrorCode,
  type NotificationErrorDefinition,
  type NotificationErrorKey,
  type NotificationErrorResponse,
  type NotificationLogEntry,
  type NotificationLogVerb,
  type NotificationRequest,
  type OtpChannelOptions,
  type OtpConsumeInput,
  type OtpDispatchPayload,
  type OtpEntry,
  type OtpGenerateInput,
  type OtpGenerateResult,
  type OtpPurpose,
  type OtpPurposeConfig,
  type OtpStatusInput,
  type OtpStatusResult,
  type OtpVerifyInput,
  type OtpVerifyResult,
  type PushChannelOptions,
  type PushSendOptions,
  type PushSendResult,
  type RedisLike,
  type RedisOtpStorageOptions,
  type RenderedEmail,
  type ResendEmailProviderOptions,
  type ResolvedAuditOptions,
  type ResolvedEmailOptions,
  type ResolvedGlobalOptions,
  type ResolvedNotificationOptions,
  type ResolvedOtpOptions,
  type SmsChannelOptions,
  type SmsSendOptions,
  type SmsSendResult,
  type TemplateDefinition,
} from '@bymax-one/nest-notification'

// ─── Type-position proofs (erased at runtime) ────────────────────────────────

/** Type-position proof: the class-based options-factory contract. */
export type ServerOptionsFactory = BymaxNotificationModuleOptionsFactory

/** Type-position proof: the async-options contract accepted by `forRootAsync`. */
export type ServerAsyncOptions = BymaxNotificationModuleAsyncOptions

/** Type-position proof: the full synchronous module options bag. */
export type ServerModuleOptions = BymaxNotificationModuleOptions

/** Type-position proof: the email provider interface. */
export type ServerEmailProvider = IEmailProvider

/** Type-position proof: the OTP storage interface. */
export type ServerOtpStorage = IOtpStorage

/** Type-position proof: the template renderer interface. */
export type ServerTemplateRenderer = IEmailTemplateRenderer

/** Type-position proof: the audit-log repository interface. */
export type ServerLogRepository = INotificationLogRepository

/** Type-position proof: the declared-only v0.2 SMS provider contract. */
export type V02SmsProvider = ISmsProvider

/** Type-position proof: the declared-only v0.2 push provider contract. */
export type V02PushProvider = IPushProvider

/** Type-position proof: the declared-only v0.2 SMS channel options. */
export type V02SmsChannelOptions = SmsChannelOptions

/** Type-position proof: the declared-only v0.2 push channel options. */
export type V02PushChannelOptions = PushChannelOptions

/** Type-position proof: the declared-only v0.2 SMS send options. */
export type V02SmsSendOptions = SmsSendOptions

/** Type-position proof: the declared-only v0.2 SMS send result. */
export type V02SmsSendResult = SmsSendResult

/** Type-position proof: the declared-only v0.2 push send options. */
export type V02PushSendOptions = PushSendOptions

/** Type-position proof: the declared-only v0.2 push send result. */
export type V02PushSendResult = PushSendResult

/** Type-position proof: the advanced resolved-options root surface. */
export type ResolvedOptionsSurface = ResolvedNotificationOptions

/** Type-position proof: the resolved global section. */
export type ResolvedGlobalSurface = ResolvedGlobalOptions

/** Type-position proof: the resolved email section. */
export type ResolvedEmailSurface = ResolvedEmailOptions

/** Type-position proof: the resolved OTP section. */
export type ResolvedOtpSurface = ResolvedOtpOptions

/** Type-position proof: the resolved audit section. */
export type ResolvedAuditSurface = ResolvedAuditOptions

/** Type-position proof: the global options input shape. */
export type ServerGlobalOptions = GlobalOptions

/** Type-position proof: the email channel options input shape. */
export type ServerEmailChannelOptions = EmailChannelOptions

/** Type-position proof: the OTP channel options input shape. */
export type ServerOtpChannelOptions = OtpChannelOptions

/** Type-position proof: the per-purpose OTP config shape. */
export type ServerOtpPurposeConfig = OtpPurposeConfig

/** Type-position proof: the audit options input shape. */
export type ServerAuditOptions = AuditOptions

/** Type-position proof: the notification request union. */
export type ServerNotificationRequest = NotificationRequest

/** Type-position proof: the dispatch input shape. */
export type ServerDispatchInput = DispatchInput

/** Type-position proof: the dispatch result shape. */
export type ServerDispatchResult = DispatchResult

/** Type-position proof: the email dispatch payload. */
export type ServerEmailDispatchPayload = EmailDispatchPayload

/** Type-position proof: the OTP dispatch payload. */
export type ServerOtpDispatchPayload = OtpDispatchPayload

/** Type-position proof: the email send input. */
export type ServerEmailSendInput = EmailSendInput

/** Type-position proof: the email send template input. */
export type ServerEmailSendTemplateInput = EmailSendTemplateInput

/** Type-position proof: the email send options. */
export type ServerEmailSendOptions = EmailSendOptions

/** Type-position proof: the email send result. */
export type ServerEmailSendResult = EmailSendResult

/** Type-position proof: the email attachment shape. */
export type ServerEmailAttachment = EmailAttachment

/** Type-position proof: the rendered email shape. */
export type ServerRenderedEmail = RenderedEmail

/** Type-position proof: the OTP generate input shape. */
export type ServerOtpGenerateInput = OtpGenerateInput

/** Type-position proof: the OTP verify input shape. */
export type ServerOtpVerifyInput = OtpVerifyInput

/** Type-position proof: the OTP consume input shape. */
export type ServerOtpConsumeInput = OtpConsumeInput

/** Type-position proof: the OTP status input shape. */
export type ServerOtpStatusInput = OtpStatusInput

/** Type-position proof: the OTP generate result shape. */
export type ServerOtpGenerateResult = OtpGenerateResult

/** Type-position proof: the OTP status result shape. */
export type ServerOtpStatusResult = OtpStatusResult

/** Type-position proof: the OTP verify result shape. */
export type ServerOtpVerifyResult = OtpVerifyResult

/** Type-position proof: the OTP entry stored in the storage backend. */
export type ServerOtpEntry = OtpEntry

/** Type-position proof: the consume-attempt result. */
export type ServerConsumeAttemptResult = ConsumeAttemptResult

/** Type-position proof: the in-memory storage size option. */
export type ServerInMemoryStorageSize = InMemoryStorageSize

/** Type-position proof: the Redis-like interface accepted by `RedisOtpStorage`. */
export type ServerRedisLike = RedisLike

/** Type-position proof: the `RedisOtpStorage` constructor options. */
export type ServerRedisOtpStorageOptions = RedisOtpStorageOptions

/** Type-position proof: the `ResendEmailProvider` constructor options. */
export type ServerResendEmailProviderOptions = ResendEmailProviderOptions

/** Type-position proof: the `DefaultTemplateRenderer` constructor options. */
export type ServerDefaultTemplateRendererOptions = DefaultTemplateRendererOptions

/** Type-position proof: the template definition shape used in the template registry. */
export type ServerTemplateDefinition = TemplateDefinition

/** Type-position proof: the template missing-variable mode. */
export type ServerMissingVariableMode = MissingVariableMode

/** Type-position proof: the notification log entry persisted by the audit log. */
export type ServerNotificationLogEntry = NotificationLogEntry

/** Type-position proof: the audit log verb union. */
export type ServerNotificationLogVerb = NotificationLogVerb

/** Type-position proof: the error key union. */
export type ServerNotificationErrorKey = NotificationErrorKey

/** Type-position proof: the error definition shape. */
export type ServerNotificationErrorDefinition = NotificationErrorDefinition

/** Type-position proof: the error code literal-union type. */
export type ServerNotificationErrorCode = NotificationErrorCode

/** Type-position proof: the error response envelope. */
export type ServerNotificationErrorResponse = NotificationErrorResponse

/** Type-position proof: the OTP purpose string union. */
export type ServerOtpPurpose = OtpPurpose

/** Type-position proof: the delivery channel union (`email`, `otp`, `sms`, `push`). */
export type ServerNotificationChannel = NotificationChannel

// ─── Runtime proofs ───────────────────────────────────────────────────────────

/**
 * Runtime proof: the seven DI-token symbols are unique; their labels prove the
 * advanced DI surface resolved.
 */
export const injectionTokenLabels: readonly string[] = [
  BYMAX_NOTIFICATION_OPTIONS.toString(),
  BYMAX_NOTIFICATION_EMAIL_PROVIDER.toString(),
  BYMAX_NOTIFICATION_OTP_STORAGE.toString(),
  BYMAX_NOTIFICATION_TEMPLATE_RENDERER.toString(),
  BYMAX_NOTIFICATION_LOG_REPOSITORY.toString(),
  BYMAX_NOTIFICATION_SMS_PROVIDER.toString(),
  BYMAX_NOTIFICATION_PUSH_PROVIDER.toString(),
]

/**
 * Runtime proof: the zero-arg class-form providers resolve (the `useClass`
 * async-registration path needs a zero-argument constructor).
 */
export const zeroArgClassNames: readonly [string, string, string] = [
  NoOpEmailProvider.name,
  InMemoryOtpStorage.name,
  NoOpNotificationLogRepository.name,
]

/** Runtime proof: a generated OTP code of the requested length (crypto util resolved). */
export const sampleCodeLength: number = generateOtpCode(6, 'numeric').length

/** Runtime proof: constant-time comparison returns `true` for equal inputs. */
export const compareMatches: boolean = safeCompare('123456', '123456')

/** Runtime proof: constant-time comparison returns `false` for differing inputs. */
export const compareMismatch: boolean = safeCompare('123456', '999999')

/** Runtime proof: hash utility resolved — produces a hex string from tenant + recipient. */
export const sampleHash: string = hashTenantRecipient('tenant-a', 'user@example.com')

/** Runtime proof: `NOTIFICATION_ERROR_CODES` resolved — spot-checks one stable entry. */
export const sampleErrorCode: string = NOTIFICATION_ERROR_CODES.OTP_INVALID_CODE

/** Runtime proof: `NOTIFICATION_ERROR_DEFINITIONS` resolved — maps error keys to metadata. */
export const errorDefinitionKeys: readonly string[] = Object.keys(NOTIFICATION_ERROR_DEFINITIONS)

/** Runtime proof: `NOTIFICATION_PURPOSES` resolved — the canonical purpose constants. */
export const purposeKeys: readonly string[] = Object.keys(NOTIFICATION_PURPOSES)

/** Runtime proof: `CANONICAL_EMAIL_TEMPLATES` resolved — the template-name constants. */
export const canonicalTemplateKeys: readonly string[] = Object.keys(CANONICAL_EMAIL_TEMPLATES)

/** Runtime proof: `DEFAULT_TTLS` resolved — spot-checks one stable field. */
export const resendCooldownSeconds: number = DEFAULT_TTLS.RESEND_COOLDOWN_SECONDS

/** Runtime proof: `toRetryAfterHeader` cooldown helper resolved. */
export const sampleRetryAfterHeader: string = toRetryAfterHeader(60)

/** Runtime proof: `cooldownExpiresAt` helper resolved — returns a future timestamp. */
export const sampleCooldownExpiresAt: number = cooldownExpiresAt(60)

/** Runtime proof: `formatCooldown` helper resolved — formats seconds into a display string. */
export const sampleFormattedCooldown: string = formatCooldown(90)

// Type-position proofs for CanonicalEmailTemplate and CanonicalNotificationPurpose
// (these are string-union types; the runtime constant access proves the value + type)
const _templateEntry: CanonicalEmailTemplate = CANONICAL_EMAIL_TEMPLATES.OTP_CODE
const _purposeEntry: CanonicalNotificationPurpose = NOTIFICATION_PURPOSES.EMAIL_VERIFICATION

// Keep the type-annotated constants referenced so verbatimModuleSyntax cannot prune them
void _templateEntry
void _purposeEntry

/**
 * Aggregates every runtime proof so a single import asserts the whole token/util
 * surface of the `.` subpath.
 */
export const probe = {
  injectionTokenLabels,
  zeroArgClassNames,
  sampleCodeLength,
  compareMatches,
  compareMismatch,
  sampleHash,
  sampleErrorCode,
  errorDefinitionKeys,
  purposeKeys,
  canonicalTemplateKeys,
  resendCooldownSeconds,
  sampleRetryAfterHeader,
  sampleCooldownExpiresAt,
  sampleFormattedCooldown,
} as const
