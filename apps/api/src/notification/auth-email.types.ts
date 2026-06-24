/**
 * @fileoverview Local, type-only mirror of @bymax-one/nest-auth's email provider port.
 * @layer app/notification
 *
 * Mirrors the port shape so the adapter can be typed without depending on
 * @bymax-one/nest-auth at runtime. The package is an illustrative peer — never a hard
 * dependency of this application.
 *
 * @module
 */

/**
 * Contextual information about a new user session, included in security alerts.
 *
 * Mirrors @bymax-one/nest-auth's `SessionInfo` interface.
 */
export interface SessionInfo {
  /** Human-readable description of the device or browser (e.g. "Chrome on macOS"). */
  device: string
  /**
   * IP address from which the session was established.
   *
   * Consider masking the last octet in privacy-sensitive jurisdictions (e.g. `'192.168.1.x'`).
   */
  ip: string
  /**
   * A short hash of the session identifier suitable for display purposes only.
   * Never the raw session token.
   */
  sessionHash: string
}

/**
 * Data required to render and send a tenant invitation email.
 *
 * Mirrors @bymax-one/nest-auth's `InviteData` interface.
 */
export interface InviteData {
  /** Display name of the user who sent the invitation. */
  inviterName: string
  /** Name of the tenant (workspace/organisation) the invitee is joining. */
  tenantName: string
  /**
   * Raw invitation token that the adapter embeds into an accept URL.
   * Never log or expose this value directly.
   */
  inviteToken: string
  /** UTC timestamp after which the invitation link is no longer valid. */
  expiresAt: Date
}

/**
 * Local, type-only mirror of @bymax-one/nest-auth's `IEmailProvider` port.
 *
 * Named to match the real interface for faithful mirroring; all 7 methods are mapped to
 * canonical templates by {@link NotificationAuthEmailProvider}. Kept type-only so no
 * runtime import of @bymax-one/nest-auth is required — the package is an illustrative peer.
 */
export interface IEmailProvider {
  /** Send a password-reset link containing a signed token. */
  sendPasswordResetToken(email: string, token: string, locale?: string): Promise<void>
  /** Send a one-time password for password reset. */
  sendPasswordResetOtp(email: string, otp: string, locale?: string): Promise<void>
  /** Send a one-time password to verify the user's email address. */
  sendEmailVerificationOtp(email: string, otp: string, locale?: string): Promise<void>
  /** Notify the user that MFA has been enabled on their account. */
  sendMfaEnabledNotification(email: string, locale?: string): Promise<void>
  /** Notify the user that MFA has been disabled on their account. */
  sendMfaDisabledNotification(email: string, locale?: string): Promise<void>
  /** Send a security alert when a new session is detected from an unrecognised device. */
  sendNewSessionAlert(email: string, sessionInfo: SessionInfo, locale?: string): Promise<void>
  /** Send a tenant invitation email to a prospective member. */
  sendInvitation(email: string, inviteData: InviteData, locale?: string): Promise<void>
}
