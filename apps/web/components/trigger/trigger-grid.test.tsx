/**
 * @fileoverview Component + descriptor tests for the Trigger Center grid.
 *
 * Mocks `triggerApi` + the card so the test covers: the grid renders one card per
 * descriptor (and wires `hrefFor` through `explorerHref`), every descriptor's
 * `fire` calls its endpoint wrapper, the spoof forges the *other* tenant (and the
 * blank-tenant fallback), and `explorerTarget` builds the deep-link with/without a
 * purpose.
 *
 * @module components/trigger/trigger-grid.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

import type { TriggerResult } from '@/lib/trigger-api'

/** A sample fire result with a purpose. */
const RESULT: TriggerResult = {
  status: 201,
  ok: true,
  recipient: 'd***@example.com',
  channel: 'otp',
  purpose: 'login',
  verb: 'generated',
}

vi.mock('@/lib/trigger-api', () => ({
  triggerApi: {
    sendEmail: vi.fn(() => Promise.resolve(RESULT)),
    generateOtp: vi.fn(() => Promise.resolve(RESULT)),
    verifyWrong: vi.fn(() => Promise.resolve(RESULT)),
    tripCooldown: vi.fn(() => Promise.resolve(RESULT)),
    forceMaxAttempts: vi.fn(() => Promise.resolve(RESULT)),
    oversizeAttachment: vi.fn(() => Promise.resolve(RESULT)),
    spoofTenant: vi.fn(() => Promise.resolve(RESULT)),
    dispatch: vi.fn(() => Promise.resolve(RESULT)),
  },
}))

vi.mock('./trigger-card', () => ({
  TriggerCard: ({
    descriptor,
    hrefFor,
  }: {
    descriptor: { id: string }
    hrefFor: (result: TriggerResult) => string
  }) => (
    <a data-testid="card" href={hrefFor(RESULT)}>
      {descriptor.id}
    </a>
  ),
}))

const { TRIGGERS, TriggerGrid } = await import('./trigger-grid')
const { triggerApi } = await import('@/lib/trigger-api')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Render the grid under a nuqs adapter seeded from `search`. */
function renderGrid(search = ''): void {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={vi.fn()}>
      {children}
    </NuqsTestingAdapter>
  )
  render(<TriggerGrid />, { wrapper })
}

describe('TriggerGrid', () => {
  /** Renders one card per descriptor and wires the Explorer deep-link. */
  it('renders a card per descriptor with an explorer deep-link', () => {
    renderGrid()
    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(TRIGGERS.length)
    expect(cards[0]).toHaveAttribute('href', expect.stringContaining('/explorer?'))
    expect(cards[0]).toHaveAttribute('href', expect.stringContaining('range=15m'))
  })
})

describe('descriptors', () => {
  /** Every descriptor's fire calls its endpoint wrapper. */
  it('wires each fire to its endpoint wrapper', async () => {
    for (const descriptor of TRIGGERS) {
      await descriptor.fire({ tenantId: 'acme' })
    }
    expect(triggerApi.sendEmail).toHaveBeenCalled()
    expect(triggerApi.generateOtp).toHaveBeenCalled()
    expect(triggerApi.verifyWrong).toHaveBeenCalled()
    expect(triggerApi.tripCooldown).toHaveBeenCalled()
    expect(triggerApi.forceMaxAttempts).toHaveBeenCalled()
    expect(triggerApi.oversizeAttachment).toHaveBeenCalled()
    expect(triggerApi.dispatch).toHaveBeenCalled()
    expect(triggerApi.spoofTenant).toHaveBeenCalledWith('acme', 'globex')
  })

  /** The spoof forges the other tenant; a blank tenant falls back to acme→globex. */
  it('forges the other tenant on spoof, with a blank-tenant fallback', async () => {
    const spoof = TRIGGERS.find((t) => t.id === 'spoof')!
    await spoof.fire({ tenantId: 'globex' })
    expect(triggerApi.spoofTenant).toHaveBeenCalledWith('globex', 'acme')
    await spoof.fire({ tenantId: '' })
    expect(triggerApi.spoofTenant).toHaveBeenCalledWith('acme', 'globex')
  })

  /** explorerTarget includes the purpose when present and omits it when null. */
  it('builds the deep-link target with and without a purpose', () => {
    const withPurpose = TRIGGERS[0]!.explorerTarget(RESULT)
    expect(withPurpose).toMatchObject({
      recipient: 'd***@example.com',
      channel: 'otp',
      purpose: 'login',
      range: '15m',
    })
    const noPurpose = TRIGGERS[0]!.explorerTarget({ ...RESULT, purpose: null })
    expect(noPurpose.purpose).toBeUndefined()
  })
})
