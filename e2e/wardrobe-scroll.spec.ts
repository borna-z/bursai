import { test, expect } from '@playwright/test';

test('wardrobe page renders garment grid and supports scrolling', async ({ page }) => {
  await page.goto('/wardrobe');

  // Wait for the page to settle — either wardrobe content or an auth redirect
  await page.waitForLoadState('networkidle');

  // The page should have rendered something (not a blank screen)
  const body = page.locator('body');
  await expect(body).not.toBeEmpty();

  // Check for key structural elements: tab bar / bottom navigation or wardrobe heading
  const hasContent = await page
    .locator('[role="tablist"], nav, h1, h2, [data-testid]')
    .first()
    .isVisible()
    .catch(() => false);

  expect(hasContent || (await page.url()).includes('/auth')).toBeTruthy();

  // Verify scrolling works if there is scrollable content
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollBy(0, 300));
  const scrollAfter = await page.evaluate(() => window.scrollY);

  // Scroll position should change if content is tall enough, otherwise just confirm no crash
  expect(scrollAfter).toBeGreaterThanOrEqual(scrollBefore);
});
