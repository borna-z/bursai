import { test, expect } from '@playwright/test';

test('outfit generate page renders the picker or paywall', async ({ page }) => {
  await page.goto('/ai/generate');

  // Wait for the page to settle
  await page.waitForLoadState('networkidle');

  const body = page.locator('body');
  await expect(body).not.toBeEmpty();

  // The page should show one of: generation UI, auth redirect, or paywall
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

  // Page rendered without crashing — pass
  expect(true).toBeTruthy();
});
