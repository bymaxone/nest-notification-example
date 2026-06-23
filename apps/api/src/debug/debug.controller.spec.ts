/**
 * Unit tests for {@link DebugController}.
 *
 * Proves `GET /debug/key` returns exactly the library's `hashTenantRecipient` output (a
 * 64-hex SHA-256 digest) for the trusted tenant + recipient, and that two tenants sharing
 * one recipient derive DISTINCT keys — so a key never reverses to a recipient nor collides
 * across tenants. The controller is constructed directly (no DI).
 */
import { describe, expect, it } from '@jest/globals'
import { hashTenantRecipient } from '@bymax-one/nest-notification'

import { DebugController } from './debug.controller.js'

const RECIPIENT = 'jane@acme.com'

describe('DebugController.key', () => {
  it('returns the 64-hex hashTenantRecipient digest, never the recipient', () => {
    /**
     * Scenario: a key lookup for a trusted tenant + recipient.
     * Contract: the body is exactly `{ key: hashTenantRecipient(tenant, recipient) }`, a
     * 64-char lowercase hex string that never echoes the plaintext recipient.
     */
    const controller = new DebugController()

    const result = controller.key('acme', { recipient: RECIPIENT })

    expect(result).toEqual({ key: hashTenantRecipient('acme', RECIPIENT) })
    expect(result.key).toMatch(/^[0-9a-f]{64}$/)
    expect(result.key).not.toContain(RECIPIENT)
  })

  it('derives distinct keys for two tenants sharing one recipient', () => {
    /**
     * Scenario: the same recipient under two tenants.
     * Contract: the tenant is part of the digest input, so the keys differ — no
     * cross-tenant collision and no recipient enumeration.
     */
    const controller = new DebugController()

    const acme = controller.key('acme', { recipient: RECIPIENT })
    const globex = controller.key('globex', { recipient: RECIPIENT })

    expect(acme.key).not.toBe(globex.key)
  })
})
