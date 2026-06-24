/**
 * Unit tests for the `/dispatch` input decorator helpers.
 *
 * Covers {@link buildDispatchInput} for both channels — every payload optional supplied (the
 * "present" arm of each exactOptional-safe spread) and none (the "absent" arm) — the trusted-tenant
 * injection (the body can never widen/forge the tenant), the schema-failure → `BadRequestException`
 * path, and {@link dispatchInputFactory} reading body + `x-tenant-id` off the execution context.
 */
import { describe, expect, it } from '@jest/globals'
import { BadRequestException, type ExecutionContext } from '@nestjs/common'

import { MAX_REPORTED_ISSUES } from '../common/zod-validation.pipe.js'
import {
  buildDispatchInput,
  dispatchInputFactory,
  toDispatchInput,
} from './dispatch-input.decorator.js'

const TENANT = 'acme'

/** Extract the `{ message, errors }` body a `BadRequestException` carries, or fail. */
function badRequestBody(run: () => unknown): {
  message: string
  errors: Array<{ path: string; message: string }>
} {
  try {
    run()
  } catch (error) {
    return (error as BadRequestException).getResponse() as {
      message: string
      errors: Array<{ path: string; message: string }>
    }
  }
  throw new Error('expected a BadRequestException')
}

describe('buildDispatchInput', () => {
  it('builds an email input with every supplied optional + the trusted header tenant', () => {
    /** Contract: the email branch + the "present" arm of every email-payload spread. */
    const input = buildDispatchInput(
      {
        channel: 'email',
        payload: {
          to: 'jane@acme.com',
          template: 'welcome',
          data: { name: 'Jane' },
          locale: 'pt-BR',
          subject: 'Hi',
          html: '<p>Hi</p>',
          text: 'Hi',
          from: 'noreply@acme.com',
          fromName: 'Acme',
          replyTo: 'support@acme.com',
          tags: [{ name: 'k', value: 'v' }],
        },
      },
      TENANT,
    )

    expect(input).toEqual({
      channel: 'email',
      tenantId: TENANT,
      payload: {
        to: 'jane@acme.com',
        template: 'welcome',
        data: { name: 'Jane' },
        locale: 'pt-BR',
        subject: 'Hi',
        html: '<p>Hi</p>',
        text: 'Hi',
        from: 'noreply@acme.com',
        fromName: 'Acme',
        replyTo: 'support@acme.com',
        tags: [{ name: 'k', value: 'v' }],
      },
    })
  })

  it('builds a minimal email input (no optionals), exactOptional-safe', () => {
    /** Contract: the "absent" arm of every email-payload spread. */
    const input = buildDispatchInput({ channel: 'email', payload: { to: 'jane@acme.com' } }, TENANT)

    expect(input).toEqual({
      channel: 'email',
      tenantId: TENANT,
      payload: { to: 'jane@acme.com' },
    })
  })

  it('builds an otp input with every supplied optional + the trusted header tenant', () => {
    /** Contract: the otp branch + the "present" arm of every otp-payload spread. */
    const input = buildDispatchInput(
      {
        channel: 'otp',
        payload: {
          recipient: 'jane@acme.com',
          purpose: 'login',
          action: 'verify',
          code: '123456',
          deliverVia: 'manual',
          emailTemplate: 'otp_code',
          emailData: { name: 'Jane' },
          locale: 'pt-BR',
        },
      },
      TENANT,
    )

    expect(input).toEqual({
      channel: 'otp',
      tenantId: TENANT,
      payload: {
        recipient: 'jane@acme.com',
        purpose: 'login',
        action: 'verify',
        code: '123456',
        deliverVia: 'manual',
        emailTemplate: 'otp_code',
        emailData: { name: 'Jane' },
        locale: 'pt-BR',
      },
    })
  })

  it('builds a minimal otp input (no optionals), exactOptional-safe', () => {
    /** Contract: the "absent" arm of every otp-payload spread. */
    const input = buildDispatchInput(
      { channel: 'otp', payload: { recipient: 'jane@acme.com', purpose: 'login' } },
      TENANT,
    )

    expect(input).toEqual({
      channel: 'otp',
      tenantId: TENANT,
      payload: { recipient: 'jane@acme.com', purpose: 'login' },
    })
  })

  it('takes the tenant from the header and ignores a body-forged tenantId (anti-spoof)', () => {
    /**
     * Scenario: a caller forges `tenantId: 'globex'` in the body while the trusted header says
     * `acme`. Contract: the schema strips the unknown body key and the header tenant wins, so the
     * resulting input — and therefore the interceptor audit row — carries the trusted tenant only.
     */
    const input = buildDispatchInput(
      { channel: 'email', payload: { to: 'jane@acme.com' }, tenantId: 'globex' },
      'acme',
    )

    expect(input.tenantId).toBe('acme')
    expect(JSON.stringify(input)).not.toContain('globex')
  })

  it('falls back to the default tenant when the header is absent', () => {
    /** Contract: a blank/absent header resolves to the default tenant, never an empty string. */
    const input = buildDispatchInput(
      { channel: 'email', payload: { to: 'jane@acme.com' } },
      undefined,
    )

    expect(input.tenantId).toBe('default')
  })

  it('throws BadRequestException with bounded issues on an invalid body', () => {
    /** Contract: a malformed body fails schema validation as a 400, never reaching the service. */
    expect(() => buildDispatchInput({ channel: 'sms', payload: {} }, TENANT)).toThrow(
      BadRequestException,
    )
  })

  it('reports the validation failure as a dot-joined path + message, never the value', () => {
    /**
     * Scenario: an email body missing the required `to`.
     * Contract: the 400 body is `{ message: 'Validation failed', errors: [{ path, message }] }`
     * with the nested path dot-joined (`payload.to`) and no echo of the rejected value — pinning
     * the error envelope's shape, the literal message, and the path-join separator.
     */
    const body = badRequestBody(() => buildDispatchInput({ channel: 'email', payload: {} }, TENANT))

    expect(body.message).toBe('Validation failed')
    expect(body.errors[0]).toEqual({ path: 'payload.to', message: expect.any(String) })
  })

  it('caps the reported issues at the documented maximum', () => {
    /**
     * Scenario: an email payload whose every field carries the wrong type (more than the cap).
     * Contract: the issue list is sliced to {@link MAX_REPORTED_ISSUES} so a hostile body cannot
     * bloat the 400 — proving the `.slice(0, MAX_REPORTED_ISSUES)` bound is applied.
     */
    const hostile = {
      channel: 'email',
      payload: {
        to: 1,
        template: 1,
        data: 1,
        locale: 1,
        subject: 1,
        html: 1,
        text: 1,
        from: 1,
        fromName: 1,
        replyTo: 1,
        tags: 1,
      },
    }
    const body = badRequestBody(() => buildDispatchInput(hostile, TENANT))

    expect(body.errors).toHaveLength(MAX_REPORTED_ISSUES)
  })
})

describe('toDispatchInput', () => {
  it('keeps the otp branch reachable independently of the email branch', () => {
    /** Direct call documents the otp discriminant arm of the builder. */
    expect(
      toDispatchInput(TENANT, {
        channel: 'otp',
        payload: { recipient: 'a@b.com', purpose: 'login' },
      }),
    ).toEqual({
      channel: 'otp',
      tenantId: TENANT,
      payload: { recipient: 'a@b.com', purpose: 'login' },
    })
  })
})

describe('dispatchInputFactory', () => {
  /** A mutable request double the factory reads from and augments. */
  interface FakeRequest {
    body: unknown
    headers: Record<string, string | string[] | undefined>
    channel?: unknown
    tenantId?: unknown
    payload?: unknown
  }

  /** Build a minimal execution context exposing a shared request double. */
  function contextOf(request: FakeRequest): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
  }

  it('reads the body + x-tenant-id off the request and builds the trusted input', () => {
    /** Contract: the factory wires the HTTP context into {@link buildDispatchInput}. */
    const request: FakeRequest = {
      body: { channel: 'email', payload: { to: 'jane@acme.com' } },
      headers: { 'x-tenant-id': 'globex' },
    }

    const input = dispatchInputFactory(undefined, contextOf(request))

    expect(input).toEqual({
      channel: 'email',
      tenantId: 'globex',
      payload: { to: 'jane@acme.com' },
    })
  })

  it('exposes the dispatch shape on the request so the audit interceptor can narrow on it', () => {
    /**
     * The library interceptor inspects the HTTP host argument (the request); the factory must
     * attach `channel`/`tenantId`/`payload` so `isDispatchInput(request)` holds and the masked
     * boundary row is recorded.
     */
    const request: FakeRequest = {
      body: { channel: 'otp', payload: { recipient: 'a@b.com', purpose: 'login' } },
      headers: { 'x-tenant-id': 'acme' },
    }

    dispatchInputFactory(undefined, contextOf(request))

    expect(request.channel).toBe('otp')
    expect(request.tenantId).toBe('acme')
    expect(request.payload).toEqual({ recipient: 'a@b.com', purpose: 'login' })
  })
})
