import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

/** Waits until the service worker is installed and controlling the page. */
const controlledBySw = async (page: Page) => {
  await page.goto('/swahili/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // the first load isn't controlled; the next one is
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
};

test('the manifest and service worker are scoped to /swahili/ only', async ({
  page,
  request,
}) => {
  await controlledBySw(page);
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope
  );
  expect(new URL(scope).pathname).toBe('/swahili/');

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href');
  const manifest = await (
    await request.get(new URL(manifestHref!, page.url()).href)
  ).json();
  expect(manifest).toMatchObject({
    start_url: '/swahili/',
    scope: '/swahili/',
    display: 'standalone',
  });
  for (const icon of manifest.icons) {
    expect(
      (
        await request.get(
          new URL(icon.src, new URL(manifestHref!, page.url())).href
        )
      ).ok()
    ).toBe(true);
  }
});

test('works offline once loaded', async ({ page, context }) => {
  await controlledBySw(page);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: /Kadi za Kiswahili/ })
  ).toBeVisible();

  // A whole card, offline: the FSRS model chunk must have been precached too.
  await page.getByRole('radio', { name: 'Complete deck' }).check();
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();
});

test('backup round trip: save, wipe the browser, restore, and every card is back', async ({
  page,
}) => {
  // Learn all of Time + dates.
  await page.goto('/swahili/');
  await page.getByRole('radio', { name: 'Complete deck' }).check();
  await page.getByLabel(/^Numbers/).uncheck();
  await page.getByRole('button', { name: /^Start/ }).click();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowRight');
  }
  await page.getByRole('button', { name: 'Done' }).click();

  // Save a backup.
  await page.getByRole('button', { name: 'Settings and backup' }).click();
  await expect(page.getByText('Last backup: never')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save a backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^swahili-progress-\d{4}-\d{2}-\d{2}\.json$/
  );
  const backupPath = await download.path();

  // Wipe everything, as Safari's 7-day rule would.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('swahili');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
  await page.goto('/swahili/');
  await page.getByRole('radio', { name: 'Practice' }).check();
  await expect(page.getByText('0 cards due · 7 new')).toBeVisible(); // all forgotten

  // Restore.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Settings and backup' }).click();
  await page
    .getByLabel('Replace everything with a backup…')
    .setInputFiles(backupPath);
  await expect(page.getByRole('status')).toHaveText(
    'Restored 7 cards from the backup.'
  );

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('radio', { name: 'Practice' }).check();
  await expect(page.getByText(/Nothing due right now/)).toBeVisible(); // all remembered again
});
