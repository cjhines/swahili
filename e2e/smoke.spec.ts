import { expect, test } from '@playwright/test';

test('the built app loads entirely from under /swahili/', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const sameOrigin: { path: string; status: number }[] = [];

  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === origin)
      sameOrigin.push({ path: url.pathname, status: response.status() });
  });

  await page.goto('/swahili/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');

  // Anything requested outside /swahili/ would hit the main cjhin.es site in production.
  expect(sameOrigin.length).toBeGreaterThan(1);
  for (const { path, status } of sameOrigin) {
    expect(path, `${path} is outside the base path`).toMatch(/^\/swahili\//);
    expect(status, `${path} returned ${status}`).toBeLessThan(400);
  }
});

test('declares cjhin.es as the canonical URL', async ({ page }) => {
  await page.goto('/swahili/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://cjhin.es/swahili/'
  );
});
