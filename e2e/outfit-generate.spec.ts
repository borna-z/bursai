import { test, expect } from '@playwright/test';

test('outfit generate page renders the picker or paywall', async ({ page }) => {
  await page.goto('/ai/generate');

  // Wait for route-specific URL — never networkidle (Vite HMR keeps it alive)
  await page.waitForURL(/\/(ai\/generate|auth|onboarding)/, { timeout: 15000 });

  const body = page.locator('body');
  await expect(body).not.toBeEmpty();

  const currentUrl = page.url();
  const isAuthRedirect = currentUrl.includes('/auth');
  const isOnboardingRedirect = currentUrl.includes('/onboarding');

  if (!isAuthRedirect && !isOnboardingRedirect) {
    // Look for key interactive elements on the generate page
    const hasGenerateUI = await page
      .locator('button, [role="button"], form, select, input')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasGenerateUI).toBeTruthy();
  }
});
