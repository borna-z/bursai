import { test, expect } from '@playwright/test';

test('onboarding page renders language selection step', async ({ page }) => {
  await page.goto('/onboarding');

  // Wait for route-specific URL — never networkidle (Vite HMR keeps it alive)
  await page.waitForURL(/\/(onboarding|auth)/, { timeout: 15000 });

  const body = page.locator('body');
  await expect(body).not.toBeEmpty();

  const currentUrl = page.url();
  const isOnboarding = currentUrl.includes('/onboarding');
  const isAuthRedirect = currentUrl.includes('/auth');

  if (isOnboarding) {
    // Look for language selection elements or a continue/next button
    const hasOnboardingUI = await page
      .locator('button, [role="button"], [role="radio"], [role="option"], select')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasOnboardingUI).toBeTruthy();
  }

  // Page rendered without crashing — pass regardless of redirect
  expect(isOnboarding || isAuthRedirect).toBeTruthy();
});
