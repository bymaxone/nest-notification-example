/**
 * @fileoverview Shell smoke test — verifies the notification console chrome
 * renders correctly: topbar brand mark, all seven sidebar destinations, and
 * the global controls (tenant/role selects + live toggle). No backend required.
 *
 * @module e2e/shell.spec
 */
import { expect, test } from '@playwright/test'

test.describe('Shell smoke', () => {
  test('renders the topbar brand mark', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('nest-notification-example')).toBeVisible()
  })

  test('renders all seven sidebar destinations', async ({ page }) => {
    await page.goto('/')
    for (const label of [
      'Overview',
      'Trigger Center',
      'Audit Explorer',
      'OTP Verify',
      'Providers & Templates',
      'Roadmap',
      'Settings',
    ]) {
      // exact: true so a sidebar label (e.g. "Trigger Center") never also matches a body CTA
      // whose accessible name merely contains it ("Fire one from the Trigger Center →").
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
  })

  test('marks Overview active on the root route', async ({ page }) => {
    await page.goto('/')
    const overview = page.getByRole('link', { name: 'Overview', exact: true })
    await expect(overview).toHaveAttribute('aria-current', 'page')
  })

  test('navigates between destinations', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Trigger Center', exact: true }).click()
    await expect(page).toHaveURL('/trigger')
    await expect(page.getByRole('link', { name: 'Trigger Center', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('renders the tenant and role selects in the topbar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('combobox', { name: 'Tenant' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Role' })).toBeVisible()
  })

  test('writes the tenant to the URL query string', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Tenant' }).click()
    await page.getByRole('option', { name: 'acme' }).click()
    await expect(page).toHaveURL(/tenantId=acme/)
  })

  test('renders the live toggle button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /live/i })).toBeVisible()
  })

  test('toggling live writes live=true to the URL', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /live off/i }).click()
    await expect(page).toHaveURL(/live=true/)
  })
})
