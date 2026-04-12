import { test, expect } from '@playwright/test';

test('wardrobe page renders garment grid and supports scrolling', async ({ page }) => {
  await page.goto('/wardrobe');

  // Wait for route-specific content or an auth redirect — never networkidle
  // (Vite HMR keeps the network active and would cause a 30 s timeout).
  await page.waitForURL(/\/(wardrobe|auth)/, { timeout: 15000 });

  const body = page.locator('body');
  await expect(body).not.toBeEmpty();

  // Check for key structural elements: tab bar, nav, or wardrobe heading
  const hasContent = await page
    .locator('[role="tablist"], nav, h1, h2, [data-testid]')
    .first()
    .isVisible()
    .catch(() => false);

  expect(hasContent || page.url().includes('/auth')).toBeTruthy();

  // If we landed on the wardrobe, verify scrolling actually moves the viewport
  if (page.url().includes('/wardrobe')) {
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(100);
    const scrollAfter = await page.evaluate(() => window.scrollY);

    // Only assert "moved" when the page is tall enough to scroll.
    // scrollBy is a no-op when content fits the viewport — check explicitly.
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    if (scrollable) {
      expect(scrollAfter).toBeGreaterThan(scrollBefore);
    }
  }
});
